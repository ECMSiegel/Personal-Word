import JSZip from "jszip";
import MarkdownIt, { type Token } from "markdown-it";
import { newProject, textOf, validateProject } from "../model";
import { emptyResearch } from "../research/types";
import { prepareMarkdownNotes } from "../import/markdownNotes";
import { projectMarkdown } from "./textExport";
import type { ExportProject } from "./document";
import {
  inspectImage,
  sha256Hex,
  verifyPendingAsset,
  collectAssetIds,
} from "../assets/assets";
import type { AssetId, AssetMeta, PendingAsset } from "../assets/types";
import {
  validateZipContainer,
  checkAbortSignal,
  type ImportDraft,
  type ImportDraftCounts,
} from "../import/importLimits";
import type { JSONContent } from "@tiptap/react";

export type MarkdownBundleManifestAsset = {
  id: string;
  path: string;
  mime: string;
  byteLength: number;
  width: number;
  height: number;
};

export type MarkdownBundleManifest = {
  format: "personal-word-markdown-bundle";
  version: 1;
  title: string;
  createdAt: string;
  assets: MarkdownBundleManifestAsset[];
};

export type MarkdownBundleDraft = Omit<ImportDraft, "format"> & {
  format: "Markdown bundle";
};

export type { ImportDraft, ImportDraftCounts };

/**
 * Exports a Personal Word project and its referenced media assets into a standard .zip archive.
 *
 * Contents:
 * - manuscript.md: GFM markdown with relative image paths `assets/<sha256>.<ext>`
 * - manifest.json: bundle metadata, document title, and cryptographically verified asset manifests
 * - assets/<sha256>.<ext>: raw binary image bytes
 */
export async function exportMarkdownBundle(
  project: ExportProject,
  assets?: Map<AssetId, PendingAsset>,
): Promise<Blob> {
  const referencedIds = collectAssetIds(project);
  const resolvedAssets = new Map<AssetId, PendingAsset>();

  for (const id of referencedIds) {
    if (assets) {
      const asset = assets.get(id);
      if (!asset) {
        throw new Error(
          `An image is missing from this export (asset ${id.slice(0, 12) || "unknown"}). Restore the image or remove it from the document before exporting.`,
        );
      }
      resolvedAssets.set(id, asset);
    } else {
      try {
        const { storage } = await import("../storage");
        const asset = await storage.readAsset(project.id, id);
        resolvedAssets.set(id, asset);
      } catch {
        throw new Error(
          `An image is missing from this export (asset ${id.slice(0, 12) || "unknown"}). Restore the image or remove it from the document before exporting.`,
        );
      }
    }
  }

  const markdownText = projectMarkdown(project, resolvedAssets);

  const manifestAssets: MarkdownBundleManifestAsset[] = Array.from(
    resolvedAssets.values(),
  ).map((asset) => {
    const ext = asset.meta.mime === "image/png" ? "png" : "jpg";
    return {
      id: asset.id,
      path: `assets/${asset.id}.${ext}`,
      mime: asset.meta.mime,
      byteLength: asset.meta.byteLength,
      width: asset.meta.width,
      height: asset.meta.height,
    };
  });

  const manifest: MarkdownBundleManifest = {
    format: "personal-word-markdown-bundle",
    version: 1,
    title: project.title,
    createdAt: new Date().toISOString(),
    assets: manifestAssets,
  };

  const zip = new JSZip();
  zip.file("manuscript.md", markdownText);
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  const assetsFolder = zip.folder("assets");
  for (const asset of resolvedAssets.values()) {
    const ext = asset.meta.mime === "image/png" ? "png" : "jpg";
    assetsFolder?.file(`${asset.id}.${ext}`, asset.bytes);
  }

  return await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

/** Last matching index helper avoiding runtime dependency on findLastIndex */
function lastIndexWhere(
  items: readonly { type: string }[],
  match: (type: string) => boolean,
): number {
  for (let at = items.length - 1; at >= 0; at--) {
    if (match(items[at].type)) return at;
  }
  return -1;
}

const BR_PATTERN = /<\s*br\s*\/?>/i;

/** Splits inline tokens into sub-arrays on `<br>` breaks */
function splitTokensByBr(tokens: Token[]): Token[][] {
  const result: Token[][] = [];
  let current: Token[] = [];

  for (const t of tokens) {
    if (t.type === "text" && BR_PATTERN.test(t.content)) {
      const parts = t.content.split(BR_PATTERN);
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          result.push(current);
          current = [];
        }
        if (parts[i]) {
          const splitToken = new (t.constructor as new (
            type: string,
            tag: string,
            nesting: number,
          ) => Token)("text", "", 0);
          splitToken.content = parts[i];
          current.push(splitToken);
        }
      }
    } else if (t.type === "html_inline" && BR_PATTERN.test(t.content)) {
      result.push(current);
      current = [];
    } else {
      current.push(t);
    }
  }

  result.push(current);
  return result;
}

/** Converts inline tokens to JSONContent text and mark nodes */
function parseInlineTokens(
  tokens: Token[],
  warnings: string[],
): JSONContent[] {
  const marksMap: Record<string, string> = {
    strong: "bold",
    em: "italic",
    s: "strike",
  };
  const result: JSONContent[] = [];
  const active: { type: string; attrs?: Record<string, unknown> }[] = [];

  const pushText = (value: string, extra?: { type: string }) => {
    if (value) {
      result.push({
        type: "text",
        text: value,
        marks: [...active, ...(extra ? [extra] : [])],
      });
    }
  };

  for (const t of tokens) {
    const kind = t.type.replace(/_(open|close)$/, "");
    if (marksMap[kind] && t.nesting) {
      if (t.nesting === 1) {
        active.push({ type: marksMap[kind] });
      } else {
        const at = lastIndexWhere(active, (type) => type === marksMap[kind]);
        if (at >= 0) active.splice(at, 1);
      }
    } else if (t.type === "link_open") {
      const href = String(t.attrGet("href") ?? "");
      if (/^(https?:|mailto:)/i.test(href)) {
        active.push({
          type: "link",
          attrs: { href, title: t.attrGet("title") },
        });
      } else {
        active.push({ type: "unsupportedLink" });
        warnings.push("Relative or unsupported links are retained as text.");
      }
    } else if (t.type === "link_close") {
      const at = lastIndexWhere(
        active,
        (type) => type === "link" || type === "unsupportedLink",
      );
      if (at >= 0) active.splice(at, 1);
    } else if (t.type === "hardbreak" || t.type === "softbreak") {
      result.push({ type: "hardBreak" });
    } else if (t.type === "code_inline") {
      pushText(t.content, { type: "code" });
    } else if (t.type === "text" || t.type === "html_inline") {
      pushText(t.content);
    } else if (t.content) {
      pushText(t.content);
      warnings.push("Unsupported content is retained as text.");
    }
  }

  return result.map((n) =>
    n.marks
      ? { ...n, marks: n.marks.filter((m) => m.type !== "unsupportedLink") }
      : n,
  );
}

/** Parses markdown-it token stream into Personal Word document AST */
function parseTokensToDocument(
  tokens: Token[],
  stagedAssets: Map<AssetId, PendingAsset>,
  warnings: string[],
): JSONContent {
  const doc: JSONContent = { type: "doc", content: [] };
  const blocks: JSONContent[] = [];

  let idx = 0;
  while (idx < tokens.length) {
    const token = tokens[idx];

    // Heading
    if (token.type === "heading_open") {
      const level = Math.min(6, Math.max(1, Number(token.tag.slice(1)) || 1));
      const nextToken = tokens[idx + 1];
      let headingInline: JSONContent[] = [];
      if (nextToken && nextToken.type === "inline") {
        headingInline = parseInlineTokens(nextToken.children ?? [], warnings);
      }
      blocks.push({
        type: "heading",
        attrs: { level },
        content: headingInline.length ? headingInline : undefined,
      });
      // Skip until heading_close
      while (idx < tokens.length && tokens[idx].type !== "heading_close") {
        idx++;
      }
      idx++;
      continue;
    }

    // Paragraph
    if (token.type === "paragraph_open") {
      const nextToken = tokens[idx + 1];
      if (nextToken && nextToken.type === "inline") {
        const inlineChildren = nextToken.children ?? [];
        // Check for images in inline children
        const hasImages = inlineChildren.some((c) => c.type === "image");
        if (!hasImages) {
          const parsed = parseInlineTokens(inlineChildren, warnings);
          blocks.push({
            type: "paragraph",
            content: parsed.length ? parsed : undefined,
          });
        } else {
          // Process inline children, hoisting resolvable images to block level
          let currentInline: Token[] = [];
          for (const child of inlineChildren) {
            if (child.type === "image") {
              const src = String(child.attrGet("src") ?? "");
              const alt = String(child.content || child.attrGet("alt") || "");
              const rawTitle = child.attrGet("title");
              const title = rawTitle !== null && rawTitle !== undefined ? String(rawTitle) : null;

              // Check if image matches staged asset
              const assetMatch = src.match(
                /(?:assets\/)?([0-9a-f]{64})\.(?:png|jpe?g)$/i,
              );
              const sha = assetMatch ? assetMatch[1].toLowerCase() : null;

              if (sha && stagedAssets.has(sha)) {
                // Emit any accumulated inline tokens as a paragraph
                if (currentInline.length > 0) {
                  const parsed = parseInlineTokens(currentInline, warnings);
                  if (parsed.length > 0) {
                    blocks.push({ type: "paragraph", content: parsed });
                  }
                  currentInline = [];
                }
                // Emit block image node
                blocks.push({
                  type: "image",
                  attrs: {
                    assetId: sha,
                    alt,
                    title,
                    width: null,
                    height: null,
                  },
                });
              } else {
                // Unresolvable or remote URL: zero network requests, retain as text
                warnings.push(
                  `Image ${src} could not be resolved from bundle assets and was retained as text.`,
                );
                const titlePart = title ? ` "${title}"` : "";
                const fallbackToken = new (child.constructor as new (
                  type: string,
                  tag: string,
                  nesting: number,
                ) => Token)("text", "", 0);
                fallbackToken.content = `![${alt}](${src}${titlePart})`;
                currentInline.push(fallbackToken);
              }
            } else {
              currentInline.push(child);
            }
          }
          if (currentInline.length > 0) {
            const parsed = parseInlineTokens(currentInline, warnings);
            if (parsed.length > 0) {
              blocks.push({ type: "paragraph", content: parsed });
            }
          }
        }
      } else {
        blocks.push({ type: "paragraph" });
      }
      while (idx < tokens.length && tokens[idx].type !== "paragraph_close") {
        idx++;
      }
      idx++;
      continue;
    }

    // GFM Table
    if (token.type === "table_open") {
      const rows: JSONContent[] = [];
      let currentRow: JSONContent[] = [];
      let isHeader = false;

      idx++;
      while (idx < tokens.length && tokens[idx].type !== "table_close") {
        const sub = tokens[idx];
        if (sub.type === "thead_open") {
          isHeader = true;
        } else if (sub.type === "thead_close") {
          isHeader = false;
        } else if (sub.type === "tr_open") {
          currentRow = [];
        } else if (sub.type === "tr_close") {
          rows.push({
            type: "tableRow",
            content: currentRow,
          });
        } else if (sub.type === "th_open" || sub.type === "td_open") {
          const cellType = isHeader ? "tableHeader" : "tableCell";
          const cellInlineToken = tokens[idx + 1];
          let cellParagraphs: JSONContent[] = [];

          if (cellInlineToken && cellInlineToken.type === "inline") {
            const lines = splitTokensByBr(cellInlineToken.children ?? []);
            for (const lineTokens of lines) {
              const inlineParsed = parseInlineTokens(lineTokens, warnings);
              cellParagraphs.push({
                type: "paragraph",
                content: inlineParsed.length ? inlineParsed : undefined,
              });
            }
          }

          if (cellParagraphs.length === 0) {
            cellParagraphs.push({ type: "paragraph" });
          }

          currentRow.push({
            type: cellType,
            attrs: { colspan: 1, rowspan: 1 },
            content: cellParagraphs,
          });

          while (
            idx < tokens.length &&
            tokens[idx].type !== "th_close" &&
            tokens[idx].type !== "td_close"
          ) {
            idx++;
          }
        }
        idx++;
      }

      // Ensure rectangular table grid
      let maxCols = 0;
      for (const r of rows) {
        const len = (r.content as JSONContent[] | undefined)?.length ?? 0;
        if (len > maxCols) maxCols = len;
      }
      if (maxCols === 0) maxCols = 1;

      for (const r of rows) {
        const rowContent = (r.content as JSONContent[]) ?? [];
        while (rowContent.length < maxCols) {
          rowContent.push({
            type: "tableCell",
            attrs: { colspan: 1, rowspan: 1 },
            content: [{ type: "paragraph" }],
          });
        }
      }

      blocks.push({
        type: "table",
        content: rows,
      });
      idx++;
      continue;
    }

    // Bullet & Ordered Lists
    if (token.type === "bullet_list_open" || token.type === "ordered_list_open") {
      const isOrdered = token.type === "ordered_list_open";
      const start = Number(token.attrGet("start") ?? 1);
      const listNode: JSONContent = {
        type: isOrdered ? "orderedList" : "bulletList",
        content: [],
      };
      if (isOrdered) listNode.attrs = { start };

      const closeType = isOrdered ? "ordered_list_close" : "bullet_list_close";
      idx++;
      while (idx < tokens.length && tokens[idx].type !== closeType) {
        if (tokens[idx].type === "list_item_open") {
          const itemContent: JSONContent[] = [];
          idx++;
          while (idx < tokens.length && tokens[idx].type !== "list_item_close") {
            if (tokens[idx].type === "paragraph_open") {
              const inlineToken = tokens[idx + 1];
              if (inlineToken && inlineToken.type === "inline") {
                const parsed = parseInlineTokens(
                  inlineToken.children ?? [],
                  warnings,
                );
                itemContent.push({
                  type: "paragraph",
                  content: parsed.length ? parsed : undefined,
                });
              } else {
                itemContent.push({ type: "paragraph" });
              }
              while (
                idx < tokens.length &&
                tokens[idx].type !== "paragraph_close"
              ) {
                idx++;
              }
            }
            idx++;
          }
          if (itemContent.length === 0) {
            itemContent.push({ type: "paragraph" });
          }
          (listNode.content as JSONContent[]).push({
            type: "listItem",
            content: itemContent,
          });
        }
        idx++;
      }
      blocks.push(listNode);
      idx++;
      continue;
    }

    // Blockquote
    if (token.type === "blockquote_open") {
      const bqContent: JSONContent[] = [];
      idx++;
      while (idx < tokens.length && tokens[idx].type !== "blockquote_close") {
        if (tokens[idx].type === "paragraph_open") {
          const inlineToken = tokens[idx + 1];
          if (inlineToken && inlineToken.type === "inline") {
            const parsed = parseInlineTokens(
              inlineToken.children ?? [],
              warnings,
            );
            bqContent.push({
              type: "paragraph",
              content: parsed.length ? parsed : undefined,
            });
          } else {
            bqContent.push({ type: "paragraph" });
          }
          while (idx < tokens.length && tokens[idx].type !== "paragraph_close") {
            idx++;
          }
        }
        idx++;
      }
      if (bqContent.length === 0) {
        bqContent.push({ type: "paragraph" });
      }
      blocks.push({
        type: "blockquote",
        content: bqContent,
      });
      idx++;
      continue;
    }

    // Fences and Code Blocks
    if (token.type === "fence" || token.type === "code_block") {
      const lang = token.info ? token.info.split(/\s/)[0] : null;
      blocks.push({
        type: "codeBlock",
        attrs: { language: lang || null },
        content: token.content ? [{ type: "text", text: token.content }] : [],
      });
      idx++;
      continue;
    }

    // Horizontal Rule
    if (token.type === "hr") {
      blocks.push({ type: "horizontalRule" });
      idx++;
      continue;
    }

    idx++;
  }

  doc.content = blocks.length ? blocks : [{ type: "paragraph" }];
  return doc;
}

/**
 * Imports a Personal Word Markdown Bundle (.zip) archive into an ImportDraft.
 *
 * Enforces pre-inflation zip bounds, cryptographic SHA-256 asset validation,
 * AST reconstruction for tables, images, and multi-paragraph footnotes, with zero external network requests.
 */
export async function importMarkdownBundle(
  data: ArrayBuffer | Uint8Array | Blob,
  filename = "document.zip",
  options?: { signal?: AbortSignal },
): Promise<ImportDraft> {
  checkAbortSignal(options?.signal);

  let bytes: Uint8Array;
  if (data instanceof Blob) {
    bytes = new Uint8Array(await data.arrayBuffer());
  } else if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  } else {
    bytes = data;
  }

  // Pre-inflation Central Directory security validation
  try {
    validateZipContainer(bytes, options?.signal);
  } catch (err) {
    if (err instanceof Error && err.message.includes("encrypted DOCX")) {
      throw new Error("Password-protected or encrypted archives are not supported.");
    }
    throw err;
  }

  checkAbortSignal(options?.signal);

  const zip = await JSZip.loadAsync(bytes);

  // Extract manuscript.md
  const manuscriptEntry = zip.file("manuscript.md");
  if (!manuscriptEntry) {
    throw new Error("Archive does not contain manuscript.md.");
  }
  const manuscriptText = await manuscriptEntry.async("string");

  const warnings: string[] = [];

  // Extract optional manifest.json
  let manifestTitle: string | undefined;
  let manifestAssets: unknown[] = [];
  const manifestEntry = zip.file("manifest.json");
  if (manifestEntry) {
    let parsed: any;
    let readable = false;
    try {
      parsed = JSON.parse(await manifestEntry.async("string"));
      readable = true;
    } catch {
      warnings.push("manifest.json is invalid JSON and was ignored.");
    }
    if (readable && parsed && typeof parsed === "object") {
      if (
        parsed.format !== undefined &&
        parsed.format !== "personal-word-markdown-bundle"
      ) {
        throw new Error(
          `Unsupported manifest format '${String(parsed.format)}' (expected personal-word-markdown-bundle).`,
        );
      }
      if (parsed.version !== undefined && parsed.version !== 1) {
        throw new Error(
          `Unsupported manifest version ${String(parsed.version)} (this app reads version 1).`,
        );
      }
      if (typeof parsed.title === "string" && parsed.title.trim()) {
        manifestTitle = parsed.title.trim();
      }
      if (Array.isArray(parsed.assets)) manifestAssets = parsed.assets;
    }
  }

  // Extract and cryptographically verify all assets
  const stagedAssets = new Map<AssetId, PendingAsset>();
  const assetRegex = /^assets\/([0-9a-f]{64})\.(png|jpe?g)$/i;

  for (const [entryPath, entry] of Object.entries(zip.files)) {
    checkAbortSignal(options?.signal);
    if (entry.dir) continue;
    if (!entryPath.startsWith("assets/")) continue;

    const match = entryPath.match(assetRegex);
    if (!match) {
      warnings.push(`Ignored unexpected file in assets directory: '${entryPath}'.`);
      continue;
    }

    const expectedSha = match[1].toLowerCase();
    const rawBytes = await entry.async("uint8array");

    const actualSha = await sha256Hex(rawBytes);
    if (actualSha !== expectedSha) {
      throw new Error(
        `Asset ${entryPath} SHA-256 mismatch (expected ${expectedSha}, got ${actualSha}).`,
      );
    }

    let meta: AssetMeta;
    try {
      meta = inspectImage(rawBytes);
    } catch (e) {
      throw new Error(
        `Asset ${entryPath} is not a valid image: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    const pendingAsset: PendingAsset = {
      id: actualSha,
      meta,
      bytes: rawBytes,
    };
    await verifyPendingAsset(pendingAsset);
    stagedAssets.set(actualSha, pendingAsset);
  }

  // Content-addressed assets/<sha>.<ext> stay the source of truth. A manifest
  // asset that is missing from the archive means a truncated or edited bundle
  // and is refused; stale id/size metadata is reported as a warning.
  for (const entry of manifestAssets) {
    const a = (entry ?? {}) as { id?: unknown; path?: unknown; byteLength?: unknown };
    const id = typeof a.id === "string" ? a.id.toLowerCase() : "";
    const pathHash =
      typeof a.path === "string" ? a.path.match(assetRegex)?.[1].toLowerCase() : undefined;
    if (!id || pathHash !== id) {
      // A tampered id must not hide an asset whose file is absent.
      if (pathHash && !stagedAssets.has(pathHash)) {
        throw new Error(
          `Manifest lists asset ${pathHash.slice(0, 12)} that is missing from the archive.`,
        );
      }
      warnings.push(
        `Manifest asset '${String(a.path)}' does not match its recorded id '${String(a.id)}'; the file hash was used.`,
      );
      continue;
    }
    const staged = stagedAssets.get(id);
    if (!staged) {
      throw new Error(
        `Manifest lists asset ${id.slice(0, 12)} that is missing from the archive.`,
      );
    }
    if (a.byteLength !== undefined && a.byteLength !== staged.bytes.byteLength) {
      warnings.push(
        `Manifest asset ${id.slice(0, 12)} byte length ${String(a.byteLength)} does not match the archive (${staged.bytes.byteLength}).`,
      );
    }
  }

  checkAbortSignal(options?.signal);

  // Parse footnotes from manuscript.md
  const preparedNotes = prepareMarkdownNotes(manuscriptText);

  // Parse markdown AST
  const md = new MarkdownIt({
    html: false,
    linkify: false,
    typographer: false,
  });
  const tokens = md.parse(preparedNotes.markdown, {});
  const document = parseTokensToDocument(tokens, stagedAssets, warnings);

  // Restore footnotes into document
  const finishedNotes = preparedNotes.finish(document);
  const finalDoc = finishedNotes.document;
  for (const w of finishedNotes.warnings) {
    warnings.push(w);
  }

  // Project model construction
  let title = manifestTitle;
  if (!title) {
    const firstNode = finalDoc.content?.[0];
    if (firstNode?.type === "heading" && firstNode.attrs?.level === 1) {
      title = textOf(firstNode).trim();
    }
  }
  if (!title) {
    title = filename.replace(/\.zip$/i, "").trim() || "Imported writing";
  }

  const project = newProject(title);
  project.entries[0].content = finalDoc;
  project.entries[0].text = textOf(finalDoc);
  if (finishedNotes.footnotes.length > 0) {
    project.research = {
      ...(project.research ?? emptyResearch()),
      footnotes: finishedNotes.footnotes,
    };
  }
  validateProject(project);

  // Count nodes
  let paragraphs = 0;
  let images = 0;
  let tables = 0;

  function countNodes(node: JSONContent) {
    if (node.type === "paragraph") paragraphs++;
    else if (node.type === "image") images++;
    else if (node.type === "table") tables++;
    if (Array.isArray(node.content)) {
      for (const child of node.content) countNodes(child);
    }
  }
  countNodes(finalDoc);
  const notes = project.research?.footnotes?.length ?? 0;

  // Filter staged assets to only those referenced in document
  const referencedAssetIds = collectAssetIds(finalDoc);
  const keptAssets: PendingAsset[] = [];
  for (const id of referencedAssetIds) {
    const asset = stagedAssets.get(id);
    if (asset) keptAssets.push(asset);
  }

  for (const [id] of stagedAssets) {
    if (!referencedAssetIds.has(id)) {
      warnings.push(`Unreferenced asset ${id} in bundle was ignored.`);
    }
  }

  return {
    project,
    assets: keptAssets,
    warnings,
    counts: {
      paragraphs,
      images,
      tables,
      notes,
    },
    format: "Markdown bundle",
    filename,
  };
}
