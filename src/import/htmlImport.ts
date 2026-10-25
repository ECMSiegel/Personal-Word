import type { JSONContent } from "@tiptap/react";
import { newProject, textOf, validateProject } from "../model";
import { emptyResearch, type Footnote } from "../research/types";
import { createPendingAsset, inspectImage } from "../assets/assets";
import type { PendingAsset } from "../assets/types";
import {
  MAX_TEXT_IMPORT_BYTES,
  MAX_IMPORT_IMAGE_BYTES,
  MAX_IMAGE_PIXELS,
  MAX_STAGED_IMAGES_TOTAL_BYTES,
  assertTreeDepth,
  checkAbortSignal,
  type ImportDraft,
} from "./importLimits";

export function htmlTitle(filename: string): string {
  return filename.replace(/\.(html|htm)$/i, "").trim() || "Imported writing";
}

const BLOCK_TAGS = new Set([
  "P",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "BLOCKQUOTE",
  "PRE",
  "UL",
  "OL",
  "LI",
  "HR",
  "TABLE",
  "DIV",
  "ARTICLE",
  "SECTION",
  "HEADER",
  "FOOTER",
  "NAV",
  "ASIDE",
  "FIGURE",
  "FIGCAPTION",
]);

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

function isBlockElement(node: Node): boolean {
  return node.nodeType === ELEMENT_NODE && BLOCK_TAGS.has((node as Element).tagName);
}

function hasBlockChildren(element: Element): boolean {
  for (let i = 0; i < element.childNodes.length; i++) {
    const child = element.childNodes[i];
    if (isBlockElement(child)) return true;
  }
  return false;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function previewHtml(
  input: string | ArrayBuffer,
  filename: string,
  options?: { signal?: AbortSignal },
): Promise<ImportDraft> {
  const signal = options?.signal;
  checkAbortSignal(signal);

  let htmlText: string;
  if (typeof input === "string") {
    htmlText = input;
  } else {
    htmlText = new TextDecoder("utf-8").decode(input);
  }

  if (htmlText.length > MAX_TEXT_IMPORT_BYTES) {
    throw new RangeError("HTML file exceeds 20MB limit.");
  }

  // 1. Inert DOM Parsing (never attached to live DOM)
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, "text/html");
  checkAbortSignal(signal);

  const warnings: string[] = [];
  let hadActiveContent = false;
  let hasMergedCells = false;

  // 2. Sanitize and strip active/forbidden elements & attributes
  function sanitizeNode(node: Node, depth: number) {
    assertTreeDepth(depth);
    if (node.nodeType !== ELEMENT_NODE) return;
    const el = node as Element;
    const tagName = el.tagName.toUpperCase();

    // Strip unsafe elements
    if (
      tagName === "SCRIPT" ||
      tagName === "STYLE" ||
      tagName === "IFRAME" ||
      tagName === "OBJECT" ||
      tagName === "EMBED" ||
      tagName === "FORM" ||
      tagName === "INPUT" ||
      tagName === "BUTTON" ||
      tagName === "SELECT" ||
      tagName === "TEXTAREA"
    ) {
      hadActiveContent = true;
      el.remove();
      return;
    }

    // Strip event handler attributes (on*) and javascript: URIs
    const attrsToRemove: string[] = [];
    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes[i];
      if (/^on/i.test(attr.name)) {
        hadActiveContent = true;
        attrsToRemove.push(attr.name);
      } else if (
        (attr.name.toLowerCase() === "href" || attr.name.toLowerCase() === "src") &&
        /^javascript:/i.test(attr.value.trim())
      ) {
        hadActiveContent = true;
        attrsToRemove.push(attr.name);
      }
    }
    for (const name of attrsToRemove) {
      el.removeAttribute(name);
    }

    // Recurse children
    const children = Array.from(el.childNodes);
    for (const child of children) {
      sanitizeNode(child, depth + 1);
    }
  }

  sanitizeNode(doc.body, 1);
  if (hadActiveContent) {
    warnings.push("Active content and embedded scripts were removed for security.");
  }
  checkAbortSignal(signal);

  // 3. Staging assets & footnotes
  const assets: PendingAsset[] = [];
  let totalStagedBytes = 0;

  // Detect footnote sections (e.g. <section class="footnotes"> or <div class="footnotes">)
  const footnotes: Footnote[] = [];
  const footnoteIdMap = new Map<string, string>(); // htmlRefId -> internalUUID

  const footnoteContainers = doc.querySelectorAll(
    "section.footnotes, div.footnotes, section[role='doc-endnotes'], .footnotes-list",
  );
  for (const container of footnoteContainers) {
    const listItems = container.querySelectorAll("li");
    for (const li of listItems) {
      const id = li.getAttribute("id") || (li as any).id || li.getAttribute("data-footnote-id") || "";
      // Extract text, excluding back-links
      const clone = li.cloneNode(true) as HTMLElement;
      const backLinks = clone.querySelectorAll(
        "a.footnote-back, a[href^='#fnref'], a[role='doc-backlink']",
      );
      for (const bl of backLinks) bl.remove();
      const text = (clone.textContent ?? "").trim();
      if (text) {
        const internalId = crypto.randomUUID();
        if (id) footnoteIdMap.set(id, internalId);
        // Also map numeric or raw id like "fn:1" or "fn1"
        const numMatch = id.match(/\d+/);
        if (numMatch) footnoteIdMap.set(numMatch[0], internalId);
        footnotes.push({ id: internalId, text });
      }
    }
    container.remove(); // Remove footnote container from main body flow
  }

  // 4. Transform DOM nodes into ProseMirror AST
  async function parseInlineChildren(
    parentElement: Element,
    depth: number,
    inheritedMarks: { type: string; attrs?: Record<string, unknown> }[] = [],
  ): Promise<JSONContent[]> {
    assertTreeDepth(depth);
    const inlines: JSONContent[] = [];

    for (let i = 0; i < parentElement.childNodes.length; i++) {
      const child = parentElement.childNodes[i];

      if (child.nodeType === TEXT_NODE) {
        const text = child.textContent ?? "";
        if (text) {
          inlines.push({
            type: "text",
            text,
            ...(inheritedMarks.length > 0 ? { marks: inheritedMarks } : {}),
          });
        }
      } else if (child.nodeType === ELEMENT_NODE) {
        const el = child as Element;
        const tag = el.tagName.toUpperCase();

        if (tag === "BR") {
          inlines.push({ type: "hardBreak" });
          continue;
        }

        // Footnote references in HTML (e.g. <sup data-footnote-id="1"> or <a href="#fn1">)
        const footnoteAttr = el.getAttribute("data-footnote-id");
        const href = el.getAttribute("href") ?? "";
        const isFootnoteRef =
          footnoteAttr !== null ||
          el.classList.contains("footnote-ref") ||
          (tag === "A" && /^#fn:?\d+/i.test(href)) ||
          (tag === "SUP" && el.querySelector("a[href^='#fn']"));

        if (isFootnoteRef) {
          const rawId =
            footnoteAttr ||
            href.replace(/^#fn:?/, "") ||
            el.querySelector("a[href^='#fn']")?.getAttribute("href")?.replace(/^#fn:?/, "") ||
            el.textContent?.trim() ||
            "";
          const numMatch = rawId.match(/\d+/);
          const key = numMatch ? numMatch[0] : rawId;
          let internalId = footnoteIdMap.get(key) ?? footnoteIdMap.get(rawId);

          if (!internalId && el.textContent?.trim()) {
            // Self-contained footnote reference without endnotes section
            internalId = crypto.randomUUID();
            footnoteIdMap.set(key, internalId);
            footnotes.push({ id: internalId, text: el.textContent.trim() });
          }

          if (internalId) {
            inlines.push({
              type: "footnoteReference",
              attrs: { id: internalId },
            });
            continue;
          }
        }

        const currentMarks = [...inheritedMarks];
        if (tag === "STRONG" || tag === "B") currentMarks.push({ type: "bold" });
        if (tag === "EM" || tag === "I") currentMarks.push({ type: "italic" });
        if (tag === "U") currentMarks.push({ type: "underline" });
        if (tag === "S" || tag === "DEL" || tag === "STRIKE") currentMarks.push({ type: "strike" });
        if (tag === "CODE") currentMarks.push({ type: "code" });

        if (tag === "A") {
          const aHref = el.getAttribute("href") ?? "";
          if (/^(https?:|mailto:)/i.test(aHref)) {
            currentMarks.push({ type: "link", attrs: { href: aHref } });
          } else if (aHref && !aHref.startsWith("#")) {
            warnings.push(
              `Relative or unsupported link '${aHref}' was retained as plain text.`,
            );
          }
        }

        const childInlines = await parseInlineChildren(el, depth + 1, currentMarks);
        inlines.push(...childInlines);
      }
    }

    return inlines;
  }

  async function parseTableElement(tableEl: Element, depth: number): Promise<JSONContent> {
    assertTreeDepth(depth);
    const rows: JSONContent[][] = [];
    const trElements = tableEl.querySelectorAll("tr");

    for (let rIdx = 0; rIdx < trElements.length; rIdx++) {
      const tr = trElements[rIdx];
      const cells: JSONContent[] = [];
      const cellElements = tr.querySelectorAll("th, td");

      for (const cellEl of cellElements) {
        const isHeader = cellEl.tagName.toUpperCase() === "TH";
        const colspan = Number(cellEl.getAttribute("colspan") || "1");
        const rowspan = Number(cellEl.getAttribute("rowspan") || "1");
        if (colspan > 1 || rowspan > 1) {
          hasMergedCells = true;
        }

        const cellBlocks: JSONContent[] = [];
        if (hasBlockChildren(cellEl)) {
          for (let i = 0; i < cellEl.childNodes.length; i++) {
            const childNode = cellEl.childNodes[i];
            if (isBlockElement(childNode)) {
              cellBlocks.push(...(await parseBlockElement(childNode as Element, depth + 1)));
            } else if (childNode.nodeType === TEXT_NODE && childNode.textContent?.trim()) {
              cellBlocks.push({
                type: "paragraph",
                content: [{ type: "text", text: childNode.textContent.trim() }],
              });
            }
          }
        } else {
          const inlines = await parseInlineChildren(cellEl, depth + 1);
          cellBlocks.push({
            type: "paragraph",
            content: inlines.length > 0 ? inlines : undefined,
          });
        }

        if (cellBlocks.length === 0) {
          cellBlocks.push({ type: "paragraph" });
        }

        cells.push({
          type: isHeader ? "tableHeader" : "tableCell",
          attrs: { colspan: 1, rowspan: 1 },
          content: cellBlocks,
        });
      }

      if (cells.length > 0) {
        rows.push(cells);
      }
    }

    // Rectangular grid
    let maxCols = 0;
    for (const r of rows) {
      if (r.length > maxCols) maxCols = r.length;
    }
    if (maxCols === 0) maxCols = 1;

    for (const r of rows) {
      while (r.length < maxCols) {
        r.push({
          type: "tableCell",
          attrs: { colspan: 1, rowspan: 1 },
          content: [{ type: "paragraph" }],
        });
      }
    }

    return {
      type: "table",
      content: rows.map((cells) => ({
        type: "tableRow",
        content: cells,
      })),
    };
  }

  async function parseImageElement(imgEl: Element): Promise<JSONContent | null> {
    const src = imgEl.getAttribute("src") ?? "";
    const alt = imgEl.getAttribute("alt") ?? "";
    const title = imgEl.getAttribute("title") || null;
    const widthAttr = imgEl.getAttribute("width");
    const heightAttr = imgEl.getAttribute("height");
    const width = widthAttr && !isNaN(Number(widthAttr)) ? Math.round(Number(widthAttr)) : null;
    const height = heightAttr && !isNaN(Number(heightAttr)) ? Math.round(Number(heightAttr)) : null;

    if (/^https?:/i.test(src)) {
      warnings.push(
        `Remote image (${src}) was omitted; remote network resources are never fetched.`,
      );
      return null;
    }

    if (/^data:image\/(png|jpeg|jpg);base64,/i.test(src)) {
      try {
        const parts = src.split(",");
        const bytes = base64ToBytes(parts[1]);

        if (bytes.byteLength > MAX_IMPORT_IMAGE_BYTES) {
          warnings.push("Data URI image exceeds 10MB limit and was omitted.");
          return null;
        }
        if (totalStagedBytes + bytes.byteLength > MAX_STAGED_IMAGES_TOTAL_BYTES) {
          warnings.push("Total staged images exceed 50MB limit; image was omitted.");
          return null;
        }

        const meta = inspectImage(bytes);
        if (meta.width * meta.height > MAX_IMAGE_PIXELS) {
          warnings.push("Data URI image exceeds 25 megapixel limit and was omitted.");
          return null;
        }

        const pending = await createPendingAsset(bytes);
        assets.push(pending);
        totalStagedBytes += bytes.byteLength;

        return {
          type: "image",
          attrs: {
            assetId: pending.id,
            alt,
            title,
            width: width || meta.width,
            height: height || meta.height,
          },
        };
      } catch {
        warnings.push(
          "Unsupported or invalid inline data image was omitted. Only PNG and JPEG images are supported.",
        );
        return null;
      }
    }

    if (src) {
      warnings.push(`Image reference (${src}) was omitted.`);
    }
    return null;
  }

  async function parseBlockElement(el: Element, depth: number): Promise<JSONContent[]> {
    assertTreeDepth(depth);
    const tag = el.tagName.toUpperCase();

    if (/^H([1-6])$/.test(tag)) {
      const level = Number(tag.charAt(1));
      const inlines = await parseInlineChildren(el, depth + 1);
      return [
        {
          type: "heading",
          attrs: { level },
          content: inlines.length > 0 ? inlines : undefined,
        },
      ];
    }

    if (tag === "HR") {
      return [{ type: "horizontalRule" }];
    }

    if (tag === "PRE") {
      const codeChild = el.querySelector("code");
      const text = (codeChild ? codeChild.textContent : el.textContent) ?? "";
      return [
        {
          type: "codeBlock",
          content: text ? [{ type: "text", text }] : undefined,
        },
      ];
    }

    if (tag === "BLOCKQUOTE") {
      const childBlocks: JSONContent[] = [];
      for (let i = 0; i < el.childNodes.length; i++) {
        const child = el.childNodes[i];
        if (isBlockElement(child)) {
          childBlocks.push(...(await parseBlockElement(child as Element, depth + 1)));
        } else if (child.nodeType === TEXT_NODE && child.textContent?.trim()) {
          childBlocks.push({
            type: "paragraph",
            content: [{ type: "text", text: child.textContent.trim() }],
          });
        }
      }
      return [
        {
          type: "blockquote",
          content: childBlocks.length > 0 ? childBlocks : [{ type: "paragraph" }],
        },
      ];
    }

    if (tag === "UL" || tag === "OL") {
      const isOrdered = tag === "OL";
      const start = isOrdered ? Number(el.getAttribute("start") || "1") : undefined;
      const listItems: JSONContent[] = [];
      const liElements = el.children;

      for (let i = 0; i < liElements.length; i++) {
        const li = liElements[i];
        if (li.tagName.toUpperCase() !== "LI") continue;

        const liBlocks: JSONContent[] = [];
        if (hasBlockChildren(li)) {
          for (let j = 0; j < li.childNodes.length; j++) {
            const childNode = li.childNodes[j];
            if (isBlockElement(childNode)) {
              liBlocks.push(...(await parseBlockElement(childNode as Element, depth + 1)));
            } else if (childNode.nodeType === TEXT_NODE && childNode.textContent?.trim()) {
              liBlocks.push({
                type: "paragraph",
                content: [{ type: "text", text: childNode.textContent.trim() }],
              });
            }
          }
        } else {
          const inlines = await parseInlineChildren(li, depth + 1);
          liBlocks.push({
            type: "paragraph",
            content: inlines.length > 0 ? inlines : undefined,
          });
        }

        if (liBlocks.length === 0) {
          liBlocks.push({ type: "paragraph" });
        }

        listItems.push({
          type: "listItem",
          content: liBlocks,
        });
      }

      return [
        {
          type: isOrdered ? "orderedList" : "bulletList",
          ...(isOrdered ? { attrs: { start } } : {}),
          content: listItems,
        },
      ];
    }

    if (tag === "TABLE") {
      return [await parseTableElement(el, depth)];
    }

    if (tag === "IMG") {
      const imgBlock = await parseImageElement(el);
      return imgBlock ? [imgBlock] : [];
    }

    // Default container or paragraph (P, DIV, SECTION, ARTICLE, etc.)
    if (hasBlockChildren(el)) {
      const blocks: JSONContent[] = [];
      for (let i = 0; i < el.childNodes.length; i++) {
        const child = el.childNodes[i];
        if (isBlockElement(child)) {
          blocks.push(...(await parseBlockElement(child as Element, depth + 1)));
        } else if (child.nodeType === TEXT_NODE && child.textContent?.trim()) {
          blocks.push({
            type: "paragraph",
            content: [{ type: "text", text: child.textContent.trim() }],
          });
        }
      }
      return blocks;
    }

    // Check if element contains any images
    const imgChild = el.querySelector("img");
    if (imgChild) {
      const blocks: JSONContent[] = [];
      // Extract inlines before and after image
      const inlines = await parseInlineChildren(el, depth + 1);
      const imgBlock = await parseImageElement(imgChild);
      if (inlines.length > 0) {
        blocks.push({ type: "paragraph", content: inlines });
      }
      if (imgBlock) {
        blocks.push(imgBlock);
      }
      return blocks.length > 0 ? blocks : [{ type: "paragraph" }];
    }

    const inlines = await parseInlineChildren(el, depth + 1);
    return [
      {
        type: "paragraph",
        content: inlines.length > 0 ? inlines : undefined,
      },
    ];
  }

  // 5. Parse root body children
  const documentBlocks: JSONContent[] = [];
  const bodyNodes = doc.body.childNodes;

  for (let i = 0; i < bodyNodes.length; i++) {
    checkAbortSignal(signal);
    const child = bodyNodes[i];
    if (isBlockElement(child)) {
      documentBlocks.push(...(await parseBlockElement(child as Element, 1)));
    } else if (child.nodeType === TEXT_NODE && child.textContent?.trim()) {
      documentBlocks.push({
        type: "paragraph",
        content: [{ type: "text", text: child.textContent.trim() }],
      });
    } else if (child.nodeType === ELEMENT_NODE) {
      const el = child as Element;
      if (el.tagName.toUpperCase() === "IMG") {
        const imgBlock = await parseImageElement(el);
        if (imgBlock) documentBlocks.push(imgBlock);
      } else {
        const inlines = await parseInlineChildren(el, 1);
        if (inlines.length > 0) {
          documentBlocks.push({ type: "paragraph", content: inlines });
        }
      }
    }
  }

  if (hasMergedCells) {
    warnings.push("Merged table cells were flattened to standard cells.");
  }

  const finalBlocks =
    documentBlocks.length > 0 ? documentBlocks : [{ type: "paragraph" }];

  const project = newProject(htmlTitle(filename));
  project.entries[0].content = { type: "doc", content: finalBlocks };
  project.entries[0].text = textOf(project.entries[0].content);

  if (footnotes.length > 0) {
    project.research = { ...(project.research ?? emptyResearch()), footnotes };
  }

  validateProject(project);

  function countItems(nodes: JSONContent[]): {
    paragraphs: number;
    images: number;
    tables: number;
  } {
    let paragraphs = 0;
    let images = 0;
    let tables = 0;

    function walk(n: JSONContent) {
      if (n.type === "paragraph") paragraphs++;
      else if (n.type === "image") images++;
      else if (n.type === "table") tables++;

      if (Array.isArray(n.content)) {
        for (const c of n.content) walk(c);
      }
    }

    for (const b of nodes) walk(b);
    return { paragraphs, images, tables };
  }

  const counts = countItems(finalBlocks);

  return {
    project,
    assets,
    warnings: [...new Set(warnings)],
    counts: {
      paragraphs: counts.paragraphs,
      images: assets.length,
      tables: counts.tables,
      notes: footnotes.length,
    },
    format: "HTML",
    filename,
  };
}
