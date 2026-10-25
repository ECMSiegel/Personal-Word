import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { validateProject, type Project } from "../model";
import { buildPrintHtml, renderNativePdf } from "./nativePdf";
import { buildProbeFixtures } from "./printProbe";

const hostile = `"><script>window.__EVIL__=1</script><img src="http://127.0.0.1:9/x.png">`;

function hostileProject(): Project {
  return {
    id: "6f1b8f0e-2d7c-4c62-9a0e-2b8e8c1d4a10",
    title: `Title ${hostile}`,
    createdAt: "2026-10-25T00:00:00.000Z",
    updatedAt: "2026-10-25T00:00:00.000Z",
    revision: 3,
    order: ["7a2c9e44-1b3d-4f55-8c66-9d7e0f1a2b3c"],
    entries: [
      {
        id: "7a2c9e44-1b3d-4f55-8c66-9d7e0f1a2b3c",
        kind: "section",
        title: "Section",
        text: "",
        updatedAt: "2026-10-25T00:00:00.000Z",
        origin: null,
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: `Body ${hostile}` },
                { type: "footnoteReference", attrs: { id: hostile } },
              ],
            },
          ],
        },
      },
    ],
    research: {
      sources: [],
      notes: [],
      footnotes: [{ id: hostile, text: `Note ${hostile}` }],
    },
  } as Project;
}

/** The markup between <head> and the first CSP meta, if any. */
function beforeCsp(html: string): string | null {
  const head = html.indexOf("<head>");
  const csp = html.search(/<meta http-equiv="Content-Security-Policy"/);
  return head < 0 || csp < 0 ? null : html.slice(head + 6, csp);
}

describe("buildPrintHtml", () => {
  it("escapes imported text, titles and note ids so no markup or script escapes", () => {
    const html = buildPrintHtml(hostileProject(), {
      geometry: { paper: "letter", marginInches: 1 },
    });
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toContain('src="http');
    expect(html).not.toContain(hostile);
    // Every src attribute is an inline data image.
    for (const m of html.matchAll(/\ssrc="([^"]*)"/g)) {
      expect(m[1]).toMatch(/^data:image\/(png|jpeg);base64,/);
    }
  });

  it("puts the default-src 'none' CSP first in <head>, before any style or resource", () => {
    const html = buildPrintHtml(hostileProject(), {
      geometry: { paper: "a4", marginInches: 0.75 },
    });
    const prefix = beforeCsp(html);
    expect(prefix).not.toBeNull();
    expect(prefix!.trim()).toBe('<meta charset="utf-8">');
    expect(html).toMatch(
      /<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:">/,
    );
  });
});

describe("probe fixtures", () => {
  it("are schema-valid projects whose image asset ids are the SHA-256 of the embedded bytes", async () => {
    const fixtures = await buildProbeFixtures({ hostilePort: 9 });
    const positive = fixtures.filter((f) => f.kind === "positive");
    expect(positive.map((f) => f.name).sort()).toEqual(["a4", "letter", "note-flow"]);
    for (const f of positive) {
      expect(() => validateProject(f.request.snapshot)).not.toThrow();
      expect(f.request.layoutVersion).toBe("native-v2");
    }
    const letter = positive.find((f) => f.name === "letter")!;
    const ids = [...letter.request.pagesHtml.matchAll(/data-asset-id="([0-9a-f]{64})"/g)].map((m) => m[1]);
    expect(ids.length).toBe(1);
    const srcs = [...letter.request.pagesHtml.matchAll(/src="data:image\/png;base64,([^"]+)"/g)].map((m) => m[1]);
    expect(srcs.length).toBe(1);
    const bytes = Uint8Array.from(atob(srcs[0]), (c) => c.charCodeAt(0));
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    expect(Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("")).toBe(ids[0]);
    expect(JSON.stringify(letter.request.snapshot)).toContain(ids[0]);
  });
});

describe("renderNativePdf", () => {
  it("refuses a bare byte response instead of inventing a page count", async () => {
    vi.mocked(invoke).mockResolvedValueOnce([0x25, 0x50, 0x44, 0x46]);
    const project = hostileProject();
    await expect(
      renderNativePdf({
        snapshot: project,
        pagesHtml: "<p>x</p>",
        geometry: { paper: "letter", marginInches: 1 },
        layoutVersion: "native-v2",
      }),
    ).rejects.toThrow();
  });

  it("returns the native page count and revision when the response is well formed", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      bytes: [0x25, 0x50, 0x44, 0x46, 0x2d],
      pageCount: 3,
      warnings: [],
      sourceRevision: 3,
    });
    const result = await renderNativePdf({
      snapshot: hostileProject(),
      pagesHtml: "<p>x</p>",
      geometry: { paper: "letter", marginInches: 1 },
      layoutVersion: "native-v2",
    });
    expect(result.pageCount).toBe(3);
    expect(result.sourceRevision).toBe(3);
    expect(result.bytes).toBeInstanceOf(Uint8Array);
  });

  it("rejects a response whose revision is not the snapshot's", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      bytes: [0x25, 0x50, 0x44, 0x46, 0x2d],
      pageCount: 1,
      warnings: [],
      sourceRevision: 2,
    });
    await expect(
      renderNativePdf({
        snapshot: hostileProject(),
        pagesHtml: "<p>x</p>",
        geometry: { paper: "letter", marginInches: 1 },
        layoutVersion: "native-v2",
      }),
    ).rejects.toThrow(/revision/);
  });
});
