import JSZip from "jszip";
import type { JSONContent } from "@tiptap/react";
import { newProject, textOf, validateProject } from "../model";
import { emptyResearch, type Footnote } from "../research/types";
import { createPendingAsset, inspectImage } from "../assets/assets";
import type { PendingAsset } from "../assets/types";
import {
  MAX_DOCX_COMPRESSED_BYTES,
  MAX_IMPORT_IMAGE_BYTES,
  MAX_IMAGE_PIXELS,
  MAX_STAGED_IMAGES_TOTAL_BYTES,
  assertTreeDepth,
  checkAbortSignal,
  validateXmlSafe,
  validateZipContainer,
  type ImportDraft,
} from "./importLimits";
import { previewManuscript } from "./manuscript";
import { previewHtml } from "./htmlImport";

export function docxTitle(filename: string): string {
  return filename.replace(/\.docx$/i, "").trim() || "Imported writing";
}

function findChildByLocalName(parent: Element | null, name: string): Element | null {
  if (!parent) return null;
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child.localName === name) return child;
  }
  return null;
}

function getChildrenByLocalName(parent: Element | Document | null, name: string): Element[] {
  if (!parent) return [];
  const result: Element[] = [];
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child.localName === name) result.push(child);
  }
  return result;
}

function getValAttr(elem: Element | null): string | null {
  if (!elem) return null;
  return (
    elem.getAttribute("w:val") ??
    elem.getAttribute("val") ??
    elem.getAttributeNS("http://schemas.openxmlformats.org/wordprocessingml/2006/main", "val")
  );
}

function isBooleanPropTrue(elem: Element | null): boolean {
  if (!elem) return false;
  const val = getValAttr(elem);
  if (val === null) return true;
  return val !== "0" && val !== "false" && val !== "off";
}

type ListItemAcc = {
  kind: "ordered" | "bullet";
  ilvl: number;
  paragraph: JSONContent;
};

function buildNestedList(items: ListItemAcc[]): JSONContent[] {
  if (items.length === 0) return [];

  const rootLists: JSONContent[] = [];
  type StackEntry = {
    ilvl: number;
    kind: "ordered" | "bullet";
    listNode: JSONContent;
    currentListItem: JSONContent | null;
  };
  const stack: StackEntry[] = [];

  for (const item of items) {
    while (stack.length > 0 && stack[stack.length - 1].ilvl > item.ilvl) {
      stack.pop();
    }

    if (stack.length === 0) {
      const listNode: JSONContent = {
        type: item.kind === "ordered" ? "orderedList" : "bulletList",
        content: [],
      };
      if (item.kind === "ordered") listNode.attrs = { start: 1 };
      const listItem: JSONContent = {
        type: "listItem",
        content: [item.paragraph],
      };
      listNode.content!.push(listItem);
      rootLists.push(listNode);
      stack.push({
        ilvl: item.ilvl,
        kind: item.kind,
        listNode,
        currentListItem: listItem,
      });
    } else {
      const top = stack[stack.length - 1];
      if (top.ilvl === item.ilvl) {
        if (top.kind === item.kind) {
          const listItem: JSONContent = {
            type: "listItem",
            content: [item.paragraph],
          };
          top.listNode.content!.push(listItem);
          top.currentListItem = listItem;
        } else {
          const listNode: JSONContent = {
            type: item.kind === "ordered" ? "orderedList" : "bulletList",
            content: [],
          };
          if (item.kind === "ordered") listNode.attrs = { start: 1 };
          const listItem: JSONContent = {
            type: "listItem",
            content: [item.paragraph],
          };
          listNode.content!.push(listItem);

          if (stack.length === 1) {
            stack.pop();
            rootLists.push(listNode);
            stack.push({
              ilvl: item.ilvl,
              kind: item.kind,
              listNode,
              currentListItem: listItem,
            });
          } else {
            stack.pop();
            const parent = stack[stack.length - 1];
            parent.currentListItem!.content!.push(listNode);
            stack.push({
              ilvl: item.ilvl,
              kind: item.kind,
              listNode,
              currentListItem: listItem,
            });
          }
        }
      } else {
        const listNode: JSONContent = {
          type: item.kind === "ordered" ? "orderedList" : "bulletList",
          content: [],
        };
        if (item.kind === "ordered") listNode.attrs = { start: 1 };
        const listItem: JSONContent = {
          type: "listItem",
          content: [item.paragraph],
        };
        listNode.content!.push(listItem);
        if (top.currentListItem) {
          top.currentListItem.content!.push(listNode);
        } else {
          top.listNode.content!.push(listNode);
        }
        stack.push({
          ilvl: item.ilvl,
          kind: item.kind,
          listNode,
          currentListItem: listItem,
        });
      }
    }
  }

  return rootLists;
}

function blipEmbedId(blip: Element): string | null {
  return (
    blip.getAttribute("r:embed") ??
    blip.getAttribute("embed") ??
    blip.getAttributeNS(
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "embed",
    )
  );
}

export async function previewDocx(
  bytes: ArrayBuffer,
  filename: string,
  options?: { signal?: AbortSignal },
): Promise<ImportDraft> {
  const signal = options?.signal;
  checkAbortSignal(signal);

  if (bytes.byteLength > MAX_DOCX_COMPRESSED_BYTES) {
    throw new RangeError("DOCX file exceeds 20MB compressed size limit.");
  }

  // 1. Central directory pre-inflation inspection
  validateZipContainer(bytes, signal);
  checkAbortSignal(signal);

  // 2. Load zip
  const zip = await JSZip.loadAsync(bytes);
  checkAbortSignal(signal);

  const docXmlEntry = zip.file("word/document.xml");
  if (!docXmlEntry) {
    throw new Error("Invalid DOCX file: word/document.xml is missing.");
  }

  const warnings: string[] = [];
  const stagedAssets = new Map<string, PendingAsset>();
  const assets: PendingAsset[] = [];
  let totalStagedBytes = 0;

  // 3. Parse Relationships (word/_rels/document.xml.rels)
  type Rel = { id: string; type: string; target: string; targetMode?: string };
  const relMap = new Map<string, Rel>();
  const relsEntry = zip.file("word/_rels/document.xml.rels");
  if (relsEntry) {
    const relsXml = await relsEntry.async("text");
    validateXmlSafe(relsXml);
    const relsDoc = new DOMParser().parseFromString(relsXml, "application/xml");
    const relElems = relsDoc.getElementsByTagName("Relationship");
    for (let i = 0; i < relElems.length; i++) {
      const el = relElems[i];
      const id = el.getAttribute("Id") ?? "";
      const type = el.getAttribute("Type") ?? "";
      const target = el.getAttribute("Target") ?? "";
      const targetMode = el.getAttribute("TargetMode") ?? "";
      if (id) {
        relMap.set(id, { id, type, target, targetMode });
      }
    }
  }

  // Check external relationships
  for (const rel of relMap.values()) {
    if (
      rel.targetMode === "External" ||
      /^(https?:|ftp:|file:)/i.test(rel.target)
    ) {
      if (rel.type.includes("image")) {
        warnings.push(
          `External image reference (${rel.target}) was omitted; remote network resources are never fetched.`,
        );
      }
    }
  }

  // 5. Footnotes parsing (word/footnotes.xml)
  const docxFootnoteMap = new Map<string, string>();
  const footnotes: Footnote[] = [];
  const footnotesEntry = zip.file("word/footnotes.xml");
  if (footnotesEntry) {
    const footnotesXml = await footnotesEntry.async("text");
    validateXmlSafe(footnotesXml);
    const fnDoc = new DOMParser().parseFromString(footnotesXml, "application/xml");
    const fnElems = getChildrenByLocalName(fnDoc.documentElement, "footnote");
    for (const fnEl of fnElems) {
      const wId = fnEl.getAttribute("w:id") ?? fnEl.getAttribute("id") ?? "";
      const wType = fnEl.getAttribute("w:type") ?? fnEl.getAttribute("type") ?? "";
      if (wType === "separator" || wType === "continuationSeparator" || Number(wId) <= 0) {
        continue;
      }

      const pElems = getChildrenByLocalName(fnEl, "p");
      const pTexts: string[] = [];
      for (const p of pElems) {
        const textParts: string[] = [];
        const rElems = getChildrenByLocalName(p, "r");
        for (const r of rElems) {
          const tElems = getChildrenByLocalName(r, "t");
          for (const t of tElems) {
            textParts.push(t.textContent ?? "");
          }
        }
        const combined = textParts.join("").trim();
        if (combined) pTexts.push(combined);
      }

      const noteText = pTexts.join("\n\n").trim();
      if (noteText) {
        const internalId = crypto.randomUUID();
        docxFootnoteMap.set(wId, internalId);
        footnotes.push({ id: internalId, text: noteText });
      }
    }
  }

  // 6. Numbering definitions (word/numbering.xml)
  const numKindMap = new Map<string, "ordered" | "bullet">();
  const numberingEntry = zip.file("word/numbering.xml");
  if (numberingEntry) {
    const numXml = await numberingEntry.async("text");
    validateXmlSafe(numXml);
    const numDoc = new DOMParser().parseFromString(numXml, "application/xml");

    // abstractNumId -> kind
    const abstractMap = new Map<string, "ordered" | "bullet">();
    const abstractElems = numDoc.getElementsByTagName("w:abstractNum");
    for (let i = 0; i < abstractElems.length; i++) {
      const absEl = abstractElems[i];
      const absId = absEl.getAttribute("w:abstractNumId") ?? absEl.getAttribute("abstractNumId") ?? "";
      const lvl = findChildByLocalName(absEl, "lvl");
      const numFmt = findChildByLocalName(lvl, "numFmt");
      const fmtVal = getValAttr(numFmt);
      abstractMap.set(absId, fmtVal === "decimal" ? "ordered" : "bullet");
    }

    const numElems = numDoc.getElementsByTagName("w:num");
    for (let i = 0; i < numElems.length; i++) {
      const numEl = numElems[i];
      const numId = numEl.getAttribute("w:numId") ?? numEl.getAttribute("numId") ?? "";
      const absRef = findChildByLocalName(numEl, "abstractNumId");
      const absId = getValAttr(absRef) ?? "";
      numKindMap.set(numId, abstractMap.get(absId) ?? "bullet");
    }
  }

  // 7. Parse word/document.xml
  const docXml = await docXmlEntry.async("text");
  validateXmlSafe(docXml);
  checkAbortSignal(signal);

  const doc = new DOMParser().parseFromString(docXml, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("Failed to parse word/document.xml: malformed XML");
  }

  const body = findChildByLocalName(doc.documentElement, "body");
  if (!body) {
    throw new Error("Invalid DOCX file: w:body is missing.");
  }

  // 4. Staging embedded media (PNG/JPEG). Only pictures the document body actually
  // draws are staged; other embedded media would be saved as orphan assets.
  const referencedEmbeds = new Set<string>();
  for (const tag of ["a:blip", "blip"]) {
    const blips = doc.getElementsByTagName(tag);
    for (let i = 0; i < blips.length; i++) {
      const id = blipEmbedId(blips[i]);
      if (id) referencedEmbeds.add(id);
    }
  }
  for (const rel of relMap.values()) {
    checkAbortSignal(signal);
    if (
      rel.type.includes("image") &&
      rel.targetMode !== "External" &&
      !/^(https?:|ftp:|file:)/i.test(rel.target)
    ) {
      let targetPath = rel.target;
      if (targetPath.startsWith("../")) {
        targetPath = targetPath.replace(/^\.\.\//, "");
      } else if (!targetPath.startsWith("word/")) {
        targetPath = `word/${targetPath.replace(/^\/+/, "")}`;
      }

      const mediaEntry = zip.file(targetPath);
      if (mediaEntry && !referencedEmbeds.has(rel.id)) {
        warnings.push(
          `Embedded image '${rel.target}' is not used in the document and was not imported.`,
        );
      } else if (mediaEntry) {
        const ext = targetPath.split(".").pop()?.toLowerCase() ?? "";
        try {
          const imgBytes = await mediaEntry.async("uint8array");
          if (imgBytes.byteLength > MAX_IMPORT_IMAGE_BYTES) {
            warnings.push(
              `Embedded image '${rel.target}' exceeds 10MB limit and was omitted.`,
            );
            continue;
          }
          if (totalStagedBytes + imgBytes.byteLength > MAX_STAGED_IMAGES_TOTAL_BYTES) {
            warnings.push(
              `Total staged images exceed 50MB limit; image '${rel.target}' was omitted.`,
            );
            continue;
          }

          // Inspect image format (PNG or JPEG only)
          const meta = inspectImage(imgBytes);
          if (meta.width * meta.height > MAX_IMAGE_PIXELS) {
            warnings.push(
              `Embedded image '${rel.target}' exceeds 25 megapixel limit and was omitted.`,
            );
            continue;
          }

          const pending = await createPendingAsset(imgBytes);
          stagedAssets.set(rel.id, pending);
          assets.push(pending);
          totalStagedBytes += imgBytes.byteLength;
        } catch {
          warnings.push(
            `Unsupported image format (${ext || "unknown"}) for image '${rel.target}' was omitted. Only PNG and JPEG images are supported.`,
          );
        }
      }
    }
  }

  let hasMergedCells = false;
  let hasTrackedChanges = false;
  let hasUnsupportedElements = false;

  function parseRun(r: Element, depth: number): JSONContent[] {
    assertTreeDepth(depth);
    const rPr = findChildByLocalName(r, "rPr");
    const marks: { type: string; attrs?: Record<string, unknown> }[] = [];

    if (isBooleanPropTrue(findChildByLocalName(rPr, "b"))) marks.push({ type: "bold" });
    if (isBooleanPropTrue(findChildByLocalName(rPr, "i"))) marks.push({ type: "italic" });

    const uElem = findChildByLocalName(rPr, "u");
    const uVal = uElem ? (getValAttr(uElem) ?? "single") : null;
    if (uVal && uVal !== "none" && uVal !== "false" && uVal !== "0") {
      marks.push({ type: "underline" });
    }

    const strikeElem =
      findChildByLocalName(rPr, "strike") ?? findChildByLocalName(rPr, "dstrike");
    if (isBooleanPropTrue(strikeElem)) marks.push({ type: "strike" });

    const rFonts = findChildByLocalName(rPr, "rFonts");
    const fontName = rFonts ? (rFonts.getAttribute("w:ascii") ?? rFonts.getAttribute("ascii")) : null;
    const szElem = findChildByLocalName(rPr, "sz");
    const szVal = getValAttr(szElem);
    const fontSize = szVal ? `${Number(szVal) / 2}pt` : null;

    if (fontName || fontSize) {
      marks.push({
        type: "textFormat",
        attrs: {
          ...(fontName ? { fontFamily: fontName } : {}),
          ...(fontSize ? { fontSize } : {}),
        },
      });
    }

    const inlines: JSONContent[] = [];

    for (let i = 0; i < r.children.length; i++) {
      const child = r.children[i];
      const name = child.localName;

      if (name === "t") {
        const text = child.textContent ?? "";
        if (text) {
          inlines.push({
            type: "text",
            text,
            ...(marks.length > 0 ? { marks } : {}),
          });
        }
      } else if (name === "br") {
        const typeAttr = child.getAttribute("w:type") ?? child.getAttribute("type");
        if (typeAttr === "page") {
          // Page breaks are handled at paragraph level if standalone, or inline hardBreak
          inlines.push({ type: "hardBreak" });
        } else {
          inlines.push({ type: "hardBreak" });
        }
      } else if (name === "footnoteReference") {
        const wId = child.getAttribute("w:id") ?? child.getAttribute("id") ?? "";
        const internalId = docxFootnoteMap.get(wId);
        if (internalId) {
          inlines.push({
            type: "footnoteReference",
            attrs: { id: internalId },
          });
        } else {
          warnings.push(
            `Footnote reference '${wId}' was missing from footnotes.xml and was rendered as plain text.`,
          );
          inlines.push({
            type: "text",
            text: `[${wId}]`,
            ...(marks.length > 0 ? { marks } : {}),
          });
        }
      } else if (name === "drawing") {
        // Drawings are extracted as block images
      }
    }

    return inlines;
  }

  function parseDrawing(drawingEl: Element): JSONContent | null {
    const inlineOrAnchor =
      findChildByLocalName(drawingEl, "inline") ??
      findChildByLocalName(drawingEl, "anchor");
    if (!inlineOrAnchor) return null;

    const extent = findChildByLocalName(inlineOrAnchor, "extent");
    const cx = extent ? Number(extent.getAttribute("cx") ?? "0") : 0;
    const cy = extent ? Number(extent.getAttribute("cy") ?? "0") : 0;
    const width = cx > 0 ? Math.round(cx / 9525) : null;
    const height = cy > 0 ? Math.round(cy / 9525) : null;

    const docPr = findChildByLocalName(inlineOrAnchor, "docPr");
    const alt = docPr?.getAttribute("descr") || docPr?.getAttribute("title") || "";
    const title = docPr?.getAttribute("title") || null;

    // Find blip
    const blips = drawingEl.getElementsByTagName("a:blip");
    let blip = blips.length > 0 ? blips[0] : null;
    if (!blip) {
      // fallback without prefix
      const fallbackBlips = drawingEl.getElementsByTagName("blip");
      if (fallbackBlips.length > 0) blip = fallbackBlips[0];
    }
    if (!blip) return null;

    const embedId = blipEmbedId(blip);

    if (!embedId) return null;
    const asset = stagedAssets.get(embedId);
    if (!asset) return null;

    return {
      type: "image",
      attrs: {
        assetId: asset.id,
        alt,
        title,
        width,
        height,
      },
    };
  }

  function parseParagraph(
    p: Element,
    depth: number,
  ): {
    blocks: JSONContent[];
    listItem?: ListItemAcc;
    isPageBreak?: boolean;
  } {
    assertTreeDepth(depth);
    const pPr = findChildByLocalName(p, "pPr");

    // Check heading level
    const pStyle = findChildByLocalName(pPr, "pStyle");
    const styleVal = getValAttr(pStyle);
    let headingLevel: number | undefined;
    if (styleVal) {
      const match = /^Heading([1-6])$/i.exec(styleVal);
      if (match) headingLevel = Number(match[1]);
    }

    // Check alignment
    const jc = findChildByLocalName(pPr, "jc");
    const jcVal = getValAttr(jc);
    let textAlign: "center" | "right" | "justify" | undefined;
    if (jcVal === "center") textAlign = "center";
    else if (jcVal === "right") textAlign = "right";
    else if (jcVal === "both") textAlign = "justify";

    // Check list
    const numPr = findChildByLocalName(pPr, "numPr");
    let listKind: "ordered" | "bullet" | null = null;
    let listIlvl = 0;
    if (numPr) {
      const ilvlEl = findChildByLocalName(numPr, "ilvl");
      const numIdEl = findChildByLocalName(numPr, "numId");
      listIlvl = ilvlEl ? Number(getValAttr(ilvlEl) ?? "0") : 0;
      const numId = numIdEl ? (getValAttr(numIdEl) ?? "1") : "1";
      listKind = numKindMap.get(numId) ?? "bullet";
    }

    // Check standalone pageBreakBefore
    const pageBreakBefore = findChildByLocalName(pPr, "pageBreakBefore");
    const hasPageBreakBefore = isBooleanPropTrue(pageBreakBefore);

    const inlines: JSONContent[] = [];
    const imageBlocks: JSONContent[] = [];

    for (let i = 0; i < p.children.length; i++) {
      const child = p.children[i];
      const name = child.localName;

      if (name === "r") {
        // Check for drawing inside run
        const drawings = getChildrenByLocalName(child, "drawing");
        for (const drawing of drawings) {
          const imgBlock = parseDrawing(drawing);
          if (imgBlock) imageBlocks.push(imgBlock);
        }
        // Run inlines
        inlines.push(...parseRun(child, depth + 1));
      } else if (name === "hyperlink") {
        const rId =
          child.getAttribute("r:id") ??
          child.getAttribute("id") ??
          child.getAttributeNS(
            "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
            "id",
          );
        const rel = rId ? relMap.get(rId) : null;
        const href = rel?.target ?? "";
        const isValidLink = /^(https?:|mailto:)/i.test(href);

        if (!isValidLink && href) {
          warnings.push(
            `Relative or unsupported link '${href}' was retained as plain text.`,
          );
        }

        const linkInlines: JSONContent[] = [];
        const rChildren = getChildrenByLocalName(child, "r");
        for (const r of rChildren) {
          linkInlines.push(...parseRun(r, depth + 1));
        }

        if (isValidLink) {
          for (const item of linkInlines) {
            item.marks = [...(item.marks ?? []), { type: "link", attrs: { href } }];
          }
        }
        inlines.push(...linkInlines);
      } else if (name === "ins") {
        hasTrackedChanges = true;
        const rChildren = getChildrenByLocalName(child, "r");
        for (const r of rChildren) {
          inlines.push(...parseRun(r, depth + 1));
        }
      } else if (name === "del") {
        hasTrackedChanges = true;
        // Omitted in accepted state
      } else if (name === "oMath" || name === "smartArt") {
        hasUnsupportedElements = true;
      }
    }

    const blocks: JSONContent[] = [];
    if (hasPageBreakBefore) {
      blocks.push({ type: "pageBreak" });
    }

    if (imageBlocks.length > 0) {
      // Paragraph with images: emit inlines as paragraph, then images
      if (inlines.length > 0) {
        blocks.push({
          type: headingLevel ? "heading" : "paragraph",
          attrs: {
            ...(headingLevel ? { level: headingLevel } : {}),
            ...(textAlign ? { textAlign } : {}),
          },
          content: inlines,
        });
      }
      for (const img of imageBlocks) {
        blocks.push(img);
      }
    } else {
      const pNode: JSONContent = {
        type: headingLevel ? "heading" : "paragraph",
        attrs: {
          ...(headingLevel ? { level: headingLevel } : {}),
          ...(textAlign ? { textAlign } : {}),
        },
        content: inlines.length > 0 ? inlines : undefined,
      };

      if (listKind) {
        return {
          blocks,
          listItem: {
            kind: listKind,
            ilvl: listIlvl,
            paragraph: pNode,
          },
        };
      } else {
        blocks.push(pNode);
      }
    }

    return { blocks };
  }

  function parseTable(tbl: Element, depth: number): JSONContent {
    assertTreeDepth(depth);
    const rows: JSONContent[][] = [];
    const trElems = getChildrenByLocalName(tbl, "tr");

    for (let rIdx = 0; rIdx < trElems.length; rIdx++) {
      const tr = trElems[rIdx];
      const trPr = findChildByLocalName(tr, "trPr");
      const isHeaderRow =
        rIdx === 0 &&
        (findChildByLocalName(trPr, "tblHeader") !== null ||
          isBooleanPropTrue(findChildByLocalName(trPr, "tblHeader")));

      const cells: JSONContent[] = [];
      const tcElems = getChildrenByLocalName(tr, "tc");

      for (const tc of tcElems) {
        const tcPr = findChildByLocalName(tc, "tcPr");
        if (
          findChildByLocalName(tcPr, "gridSpan") ||
          findChildByLocalName(tcPr, "vMerge")
        ) {
          hasMergedCells = true;
        }

        const cellBlocks: JSONContent[] = [];
        const pElems = getChildrenByLocalName(tc, "p");
        for (const p of pElems) {
          const parsed = parseParagraph(p, depth + 1);
          cellBlocks.push(...parsed.blocks);
          if (parsed.listItem) {
            cellBlocks.push(parsed.listItem.paragraph);
          }
        }

        // Guaranteed at least one block element
        if (cellBlocks.length === 0) {
          cellBlocks.push({ type: "paragraph" });
        }

        cells.push({
          type: isHeaderRow ? "tableHeader" : "tableCell",
          attrs: { colspan: 1, rowspan: 1 },
          content: cellBlocks,
        });
      }

      rows.push(cells);
    }

    // Equalize columns across rows (rectangular grid)
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

  // Iterate body children
  const documentBlocks: JSONContent[] = [];
  let pendingListItems: ListItemAcc[] = [];

  function flushListItems() {
    if (pendingListItems.length > 0) {
      documentBlocks.push(...buildNestedList(pendingListItems));
      pendingListItems = [];
    }
  }

  for (let i = 0; i < body.children.length; i++) {
    checkAbortSignal(signal);
    const child = body.children[i];
    const name = child.localName;

    if (name === "p") {
      const parsed = parseParagraph(child, 1);
      if (parsed.listItem) {
        pendingListItems.push(parsed.listItem);
      } else {
        flushListItems();
        documentBlocks.push(...parsed.blocks);
      }
    } else if (name === "tbl") {
      flushListItems();
      documentBlocks.push(parseTable(child, 1));
    } else if (name === "ins") {
      hasTrackedChanges = true;
      // Unwrap inserted paragraphs
      const pElems = getChildrenByLocalName(child, "p");
      for (const p of pElems) {
        const parsed = parseParagraph(p, 1);
        if (parsed.listItem) {
          pendingListItems.push(parsed.listItem);
        } else {
          flushListItems();
          documentBlocks.push(...parsed.blocks);
        }
      }
    } else if (name === "del") {
      hasTrackedChanges = true;
    }
  }

  flushListItems();

  if (hasMergedCells) {
    warnings.push("Merged table cells were flattened to standard cells.");
  }
  if (hasTrackedChanges) {
    warnings.push(
      "Document contains tracked changes; revisions were imported in their accepted state.",
    );
  }
  if (hasUnsupportedElements) {
    warnings.push("Unsupported elements (such as equations or shapes) were omitted.");
  }

  const finalBlocks =
    documentBlocks.length > 0 ? documentBlocks : [{ type: "paragraph" }];

  const project = newProject(docxTitle(filename));
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
      images: counts.images,
      tables: counts.tables,
      notes: footnotes.length,
    },
    format: "DOCX",
    filename,
  };
}

export async function previewWriting(
  bytes: ArrayBuffer,
  filename: string,
  options?: { signal?: AbortSignal },
): Promise<ImportDraft> {
  const isDocx = /\.docx$/i.test(filename);
  const isHtml = /\.(html|htm)$/i.test(filename);

  if (isDocx) {
    return previewDocx(bytes, filename, options);
  }

  if (isHtml) {
    return previewHtml(bytes, filename, options);
  }

  if (/\.zip$/i.test(filename)) {
    // Dynamic import keeps the bundle code in its own chunk.
    const { importMarkdownBundle } = await import("../export/markdownBundle");
    return importMarkdownBundle(bytes, filename, options);
  }

  // Plain text / Markdown fallback
  const preview = previewManuscript(bytes, filename);
  const content = preview.project.entries[0].content.content ?? [];

  let paragraphs = 0;
  let images = 0;
  let tables = 0;
  for (const n of content) {
    if (n.type === "paragraph") paragraphs++;
    else if (n.type === "image") images++;
    else if (n.type === "table") tables++;
  }

  return {
    project: preview.project,
    assets: [],
    warnings: preview.warnings,
    counts: {
      paragraphs,
      images,
      tables,
      notes: preview.project.research?.footnotes?.length ?? 0,
    },
    format: preview.format,
    filename: preview.filename,
  };
}
