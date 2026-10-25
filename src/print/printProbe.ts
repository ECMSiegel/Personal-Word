import type { JSONContent } from "@tiptap/react";
import type { Entry, Project } from "../model";
import type { PendingAsset } from "../assets/types";
import { buildPrintHtml, uint8ArrayToBase64, type PrintRequest } from "./nativePdf";

/**
 * Layout L1 probe fixtures. Positive fixtures are schema-valid projects rendered by
 * buildPrintHtml; the hostile fixture is hand-written markup that simulates a builder bug so
 * the native lockdown itself is exercised. Expectations live beside each fixture so the
 * harness asserts against one contract.
 */

export const PROBE_TEXT = {
  latin: "The quick brown fox jumps over the lazy dog.",
  ligatures: "office affine flow fjord",
  greek: "Ελευθερία και ισότητα.",
  cyrillic: "Красота спасёт мир.",
  hebrew: "שלום עולם",
  hebrewPointed: "שָׁלוֹם עֲלֵיכֶם",
  arabic: "السلام عليكم",
  devanagari: "सत्यमेव जयते",
  chinese: "天地玄黃 宇宙洪荒",
  japanese: "吾輩は猫である",
  korean: "모든 인간은",
  mixed: "Chapter 12: עברית 2026 and العربية 42!",
};

export type ProbeExpectation =
  | {
      outcome: "render";
      paper: "letter" | "a4";
      marginInches: number;
      /** Exact page count, or a minimum when a note is meant to flow across pages. */
      pages?: number;
      minPages?: number;
      /** markersByPage[i] must appear on page i + 1 and on no other page. */
      markersByPage?: string[][];
      /** Must be found in extracted text (after NFKC; RTL also accepted reversed). */
      requiredText: string[];
      /** Extracted for the report and inspected visually; extraction may legitimately differ. */
      informationalText: string[];
      /** Raster images expected in the PDF; null when not asserted. */
      images: number | null;
      embeddedFontFamily?: string;
      runningHeaders: boolean;
      noteSentences?: { prefix: string; count: number };
      hostile?: boolean;
    }
  | { outcome: "reject"; error: string };

export interface ProbeFixture {
  name: string;
  kind: "positive" | "hostile" | "reject" | "readiness-control";
  request: PrintRequest;
  expect: ProbeExpectation;
  /** native-print.js pads pagesHtml past the native size bound before sending. */
  padToBytes?: number;
}

const STAMP = "2026-10-25T00:00:00.000Z";

const text = (value: string): JSONContent => ({ type: "text", text: value });
const para = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });
const heading = (level: number, value: string): JSONContent => ({
  type: "heading",
  attrs: { level },
  content: [text(value)],
});
const cell = (header: boolean, value: string): JSONContent => ({
  type: header ? "tableHeader" : "tableCell",
  content: [para(text(value))],
});
const row = (header: boolean, ...values: string[]): JSONContent => ({
  type: "tableRow",
  content: values.map((v) => cell(header, v)),
});

function project(
  id: string,
  entryId: string,
  title: string,
  content: JSONContent[],
  footnotes: { id: string; text: string }[] = [],
  font: "serif" | "sans" = "serif",
  marginInches = 1,
): Project {
  const entry: Entry = {
    id: entryId,
    kind: "section",
    title,
    text: "",
    updatedAt: STAMP,
    origin: null,
    content: { type: "doc", content },
  };
  return {
    id,
    title,
    createdAt: STAMP,
    updatedAt: STAMP,
    revision: 7,
    order: [entryId],
    entries: [entry],
    research: { sources: [], notes: [], footnotes },
    documentSettings: {
      font,
      fontSize: 11,
      lineSpacing: 1.5,
      marginInches,
      firstLineIndent: false,
      bibliography: false,
      pageNumbers: true,
    },
  };
}

// --- A small, valid PNG encoder (stored deflate) so fixture images need no file access. ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function u32(n: number): number[] {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}
function chunk(type: string, data: Uint8Array): number[] {
  const body = new Uint8Array([...Array.from(type, (c) => c.charCodeAt(0)), ...data]);
  return [...u32(data.length), ...body, ...u32(crc32(body))];
}
/** RGB PNG with horizontal colour bands. */
export function probePng(width: number, height: number, bands: [number, number, number][]): Uint8Array {
  const raw: number[] = [];
  for (let y = 0; y < height; y++) {
    raw.push(0);
    const [r, g, b] = bands[Math.floor((y * bands.length) / height)];
    for (let x = 0; x < width; x++) raw.push(r, g, b);
  }
  const zlib: number[] = [0x78, 0x01];
  for (let i = 0; i < raw.length; i += 65535) {
    const part = raw.slice(i, i + 65535);
    const final = i + 65535 >= raw.length ? 1 : 0;
    zlib.push(final, part.length & 255, part.length >>> 8, ~part.length & 255, (~part.length >>> 8) & 255, ...part);
  }
  let a = 1;
  let b = 0;
  for (const v of raw) {
    a = (a + v) % 65521;
    b = (b + a) % 65521;
  }
  zlib.push(...u32(((b << 16) | a) >>> 0));
  const ihdr = new Uint8Array([...u32(width), ...u32(height), 8, 2, 0, 0, 0]);
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk("IHDR", ihdr),
    ...chunk("IDAT", new Uint8Array(zlib)),
    ...chunk("IEND", new Uint8Array()),
  ]);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function asset(bytes: Uint8Array, width: number, height: number): Promise<PendingAsset> {
  return { id: await sha256Hex(bytes), bytes, meta: { mime: "image/png", byteLength: bytes.length, width, height } };
}

function request(snapshot: Project, pagesHtml: string, paper: "letter" | "a4", marginInches: number): PrintRequest {
  return { snapshot, pagesHtml, geometry: { paper, marginInches }, layoutVersion: "native-v2" };
}

export interface ProbeFixtureOptions {
  /** Loopback port of the harness's request counter. */
  hostilePort: number;
  /** file:// URL of a harness-owned canary folder. */
  canaryFileUrl?: string;
  /** Licensed WOFF (the bundled Noto Serif Latin subset) to prove web-font readiness. */
  fontWoff?: Uint8Array;
}

export async function buildProbeFixtures(options: ProbeFixtureOptions): Promise<ProbeFixture[]> {
  const port = options.hostilePort;
  const canary = options.canaryFileUrl ?? "file:///nonexistent-personal-word-canary";
  const font = options.fontWoff ? { family: "PW Probe Noto Serif", woff: options.fontWoff } : undefined;
  const swatch = await asset(probePng(160, 48, [[0, 102, 204], [240, 180, 0], [20, 140, 60]]), 160, 48);
  const fixtures: ProbeFixture[] = [];

  // Letter: three explicit-break sheets with running header/footer, scripts, table, image, note.
  const letter = project(
    "1b0f6a1e-6a55-4c1e-9d0e-0a1b2c3d4e01",
    "1b0f6a1e-6a55-4c1e-9d0e-0a1b2c3d4e11",
    "PWHEAD Native print probe Letter",
    [
      heading(1, "Native print probe -- Letter"),
      para(text("PWPROBE-P1-START")),
      para(text(`Latin: ${PROBE_TEXT.latin} Ligatures: ${PROBE_TEXT.ligatures}`)),
      para(text(`Greek: ${PROBE_TEXT.greek} Cyrillic: ${PROBE_TEXT.cyrillic}`)),
      para(text(PROBE_TEXT.hebrew)),
      para(text(PROBE_TEXT.hebrewPointed)),
      para(text(PROBE_TEXT.arabic)),
      para(text(PROBE_TEXT.mixed)),
      {
        type: "table",
        content: [
          row(true, "Script", "Sample", "Direction"),
          row(false, "Hebrew", PROBE_TEXT.hebrew, "RTL"),
          row(false, "Arabic", PROBE_TEXT.arabic, "RTL"),
          row(false, "Devanagari", PROBE_TEXT.devanagari, "LTR"),
        ],
      },
      { type: "image", attrs: { assetId: swatch.id, alt: "PWIMAGE swatch", title: null, width: 160, height: 48 } },
      para(text("Note reference here"), { type: "footnoteReference", attrs: { id: "note-letter-1" } }),
      para(text("PWPROBE-P1-END")),
      { type: "pageBreak" },
      para(text("PWPROBE-P2-START")),
      para(text(`Devanagari: ${PROBE_TEXT.devanagari}`)),
      para(text(`Chinese: ${PROBE_TEXT.chinese} Japanese: ${PROBE_TEXT.japanese} Korean: ${PROBE_TEXT.korean}`)),
      { type: "blockquote", content: [para(text("A flat, restrained quotation with square corners."))] },
      { type: "codeBlock", content: [text("function probe() { return 'searchable-vector-text'; }")] },
      para(text("PWPROBE-P2-END")),
      { type: "pageBreak" },
      para(text("PWPROBE-P3-START")),
      para(text("The notes for this probe follow on this sheet.")),
    ],
    [{ id: "note-letter-1", text: "PWNOTE-1 First probe note, rendered in the notes section." }],
  );
  fixtures.push({
    name: "letter",
    kind: "positive",
    request: request(
      letter,
      buildPrintHtml(letter, { geometry: { paper: "letter", marginInches: 1 }, assets: new Map([[swatch.id, swatch]]), embeddedFont: font }),
      "letter",
      1,
    ),
    expect: {
      outcome: "render",
      paper: "letter",
      marginInches: 1,
      pages: 3,
      markersByPage: [["PWPROBE-P1-START", "PWPROBE-P1-END"], ["PWPROBE-P2-START", "PWPROBE-P2-END"], ["PWPROBE-P3-START", "PWNOTE-1"]],
      requiredText: [
        PROBE_TEXT.latin,
        PROBE_TEXT.greek,
        PROBE_TEXT.cyrillic,
        PROBE_TEXT.hebrew,
        PROBE_TEXT.arabic,
        PROBE_TEXT.chinese,
        PROBE_TEXT.japanese,
        PROBE_TEXT.korean,
        "searchable-vector-text",
        "PWIMAGE swatch",
      ],
      informationalText: [PROBE_TEXT.ligatures, PROBE_TEXT.hebrewPointed, PROBE_TEXT.devanagari, PROBE_TEXT.mixed],
      images: 1,
      embeddedFontFamily: font ? "NotoSerif" : undefined,
      runningHeaders: true,
    },
  });

  // A4: two sheets, system sans stack, an RTL-first paragraph.
  const a4 = project(
    "1b0f6a1e-6a55-4c1e-9d0e-0a1b2c3d4e02",
    "1b0f6a1e-6a55-4c1e-9d0e-0a1b2c3d4e12",
    "PWHEAD Native print probe A4",
    [
      heading(1, "Native print probe -- A4"),
      para(text("PWPROBE-A4-P1")),
      para(text(`${PROBE_TEXT.arabic} -- ${PROBE_TEXT.hebrew}`)),
      { type: "pageBreak" },
      para(text("PWPROBE-A4-P2")),
      para(text(PROBE_TEXT.latin)),
    ],
    [],
    "sans",
    0.75,
  );
  fixtures.push({
    name: "a4",
    kind: "positive",
    request: request(a4, buildPrintHtml(a4, { geometry: { paper: "a4", marginInches: 0.75 }, fontFamily: "sans" }), "a4", 0.75),
    expect: {
      outcome: "render",
      paper: "a4",
      marginInches: 0.75,
      pages: 2,
      markersByPage: [["PWPROBE-A4-P1"], ["PWPROBE-A4-P2"]],
      requiredText: [PROBE_TEXT.arabic, PROBE_TEXT.hebrew, PROBE_TEXT.latin],
      informationalText: [],
      images: 0,
      runningHeaders: true,
    },
  });

  // A note long enough to continue onto a following page.
  const sentences = Array.from(
    { length: 120 },
    (_, i) => `PWS${String(i + 1).padStart(3, "0")} The note continues with ordinary prose so its lines break naturally.`,
  );
  const flow = project(
    "1b0f6a1e-6a55-4c1e-9d0e-0a1b2c3d4e03",
    "1b0f6a1e-6a55-4c1e-9d0e-0a1b2c3d4e13",
    "Native print probe note flow",
    [heading(1, "PWNOTEFLOW-START"), para(text("A paragraph that cites one very long note."), { type: "footnoteReference", attrs: { id: "note-flow-1" } })],
    [{ id: "note-flow-1", text: sentences.join(" ") }],
  );
  fixtures.push({
    name: "note-flow",
    kind: "positive",
    request: request(
      flow,
      buildPrintHtml(flow, { geometry: { paper: "letter", marginInches: 1 }, showRunningHeaders: false, embeddedFont: font }),
      "letter",
      1,
    ),
    expect: {
      outcome: "render",
      paper: "letter",
      marginInches: 1,
      minPages: 2,
      requiredText: ["PWNOTEFLOW-START"],
      informationalText: [],
      images: 0,
      runningHeaders: false,
      noteSentences: { prefix: "PWS", count: sentences.length },
    },
  });

  // Hostile markup: every vector must be blocked by the native view, not by the builder.
  const hostileProject = project(
    "1b0f6a1e-6a55-4c1e-9d0e-0a1b2c3d4e04",
    "1b0f6a1e-6a55-4c1e-9d0e-0a1b2c3d4e14",
    "Native print probe hostile",
    [para(text("PWHOSTILE-BODY"))],
  );
  const remote = (path: string) => `http://127.0.0.1:${port}/${path}`;
  const hostileHtml = `<!DOCTYPE html><html><head>
<meta http-equiv="refresh" content="0;url=${remote("meta-refresh")}">
<link rel="stylesheet" href="${remote("link.css")}">
<link rel="stylesheet" href="${canary}/link.css">
<link rel="preload" as="image" href="${remote("preload.png")}">
<style>
@import url("${remote("import.css")}");
@import url("${canary}/import.css");
.bg { background-image: url("${remote("bg.png")}"); }
.fbg { background-image: url("${canary}/bg.png"); }
@media print { .pbg { background-image: url("${remote("print-bg.png")}"); } }
</style>
<script>document.documentElement.setAttribute("data-pw-page-script", "1");</script>
</head><body>
<p class="bg fbg pbg">PWHOSTILE-BODY inline script, remote and file resources, and navigation must all be inert.</p>
<div style="background-image:url(${remote("inline-style.png")})">PWHOSTILE-INLINE</div>
<object data="${remote("object")}" type="text/html"></object>
<svg width="20" height="20"><image href="${remote("svg-image.png")}" width="20" height="20"></image></svg>
<video poster="${remote("poster.png")}" width="20" height="20"></video>
<iframe srcdoc="<p>framed</p>" width="40" height="20"></iframe>
<a href="${remote("anchor")}">PWHOSTILE-LINK</a>
<form action="${remote("form")}"><button>PWHOSTILE-FORM</button></form>
</body></html>`;
  fixtures.push({
    name: "hostile",
    kind: "hostile",
    request: request(hostileProject, hostileHtml, "letter", 1),
    expect: {
      outcome: "render",
      paper: "letter",
      marginInches: 1,
      pages: 1,
      requiredText: ["PWHOSTILE-BODY", "PWHOSTILE-INLINE"],
      informationalText: [],
      // Not gated: WebKit draws its own "Blocked Plug-in" chrome for the blocked <object>
      // (four 12x27 px image/smask pairs, run 20261025T070345Z). Lockdown is asserted separately.
      images: null,
      runningHeaders: false,
      hostile: true,
    },
  });

  // Native readiness must fail closed: an undecodable approved image and a broken web font.
  const corrupt = probePng(40, 20, [[200, 0, 0]]);
  corrupt.fill(0x5a, 41, corrupt.length - 20); // IHDR intact, image data destroyed
  const corruptAsset = await asset(corrupt, 40, 20);
  const notReady = project(
    "1b0f6a1e-6a55-4c1e-9d0e-0a1b2c3d4e05",
    "1b0f6a1e-6a55-4c1e-9d0e-0a1b2c3d4e15",
    "Native print probe readiness control",
    [para(text("PWREADINESS-CONTROL")), { type: "image", attrs: { assetId: corruptAsset.id, alt: "broken", title: null, width: 40, height: 20 } }],
  );
  fixtures.push({
    name: "readiness-control",
    kind: "readiness-control",
    request: request(
      notReady,
      buildPrintHtml(notReady, {
        geometry: { paper: "letter", marginInches: 1 },
        assets: new Map([[corruptAsset.id, corruptAsset]]),
        embeddedFont: { family: "PW Broken Font", woff: new Uint8Array(64).fill(7) },
      }),
      "letter",
      1,
    ),
    expect: { outcome: "reject", error: "not ready" },
  });

  // Boundary rejections (no WebKit involved).
  const plain = project(
    "1b0f6a1e-6a55-4c1e-9d0e-0a1b2c3d4e06",
    "1b0f6a1e-6a55-4c1e-9d0e-0a1b2c3d4e16",
    "Native print probe boundary",
    [para(text("PWBOUNDARY"))],
  );
  const plainHtml = buildPrintHtml(plain, { geometry: { paper: "letter", marginInches: 1 } });
  const reject = (name: string, req: PrintRequest, error: string, padToBytes?: number) =>
    fixtures.push({ name, kind: "reject", request: req, expect: { outcome: "reject", error }, padToBytes });
  reject("reject-layout-version", { ...request(plain, plainHtml, "letter", 1), layoutVersion: "legacy-v1" as "native-v2" }, "layout version");
  reject("reject-paper", request(plain, plainHtml, "tabloid" as "letter", 1), "Unsupported paper");
  reject("reject-margin", request(plain, plainHtml, "letter", 5), "margins");
  reject("reject-snapshot", request({ ...plain, id: "not-a-uuid" }, plainHtml, "letter", 1), "invalid");
  reject(
    "reject-unapproved-image",
    request(plain, `${plainHtml}<img src="data:image/png;base64,${uint8ArrayToBase64(swatch.bytes)}">`, "letter", 1),
    "approved asset",
  );
  reject("reject-remote-image", request(plain, `${plainHtml}<img src="${remote("img-src.png")}">`, "letter", 1), "approved asset");
  reject("reject-oversize", request(plain, plainHtml, "letter", 1), "size limit", 8 * 1024 * 1024 + 16);
  return fixtures;
}
