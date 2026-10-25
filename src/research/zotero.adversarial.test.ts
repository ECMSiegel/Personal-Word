import { describe, expect, it } from "vitest";
import {
  checkZoteroUrl,
  buildZoteroUrl,
  previewZoteroChanges,
  type ZoteroOrigin,
} from "./zotero";
import type { Source } from "./types";

describe("Adversarial URL Validation Challenge (TypeScript checkZoteroUrl)", () => {
  const orchestratorRequiredAttacks = [
    { url: "http://localhost:23119", desc: "localhost without path" },
    { url: "http://127.0.0.1:80", desc: "port 80 without path" },
    { url: "http://127.0.0.1:23119@evil.com", desc: "userinfo @evil.com" },
    { url: "http://127.0.0.1:23119/api/../secret", desc: "path traversal /api/../secret" },
    { url: "http://0177.0.0.1:23119", desc: "octal IP without path" },
    { url: "http://[::1]:23119", desc: "IPv6 without path" },
    { url: "https://127.0.0.1:23119", desc: "https scheme without path" },
  ];

  for (const { url, desc } of orchestratorRequiredAttacks) {
    it(`rejects orchestrator target attack: ${desc} (${url})`, () => {
      expect(() => checkZoteroUrl(url)).toThrow();
    });
  }

  const extendedBypassAttacks = [
    { url: "http://localhost:23119/api/items", desc: "localhost hostname with /api/items" },
    { url: "http://127.0.0.1:80/api/items", desc: "port 80 with path" },
    { url: "http://127.0.0.1:23119@evil.com/api/items", desc: "userinfo @evil.com with /api/items" },
    { url: "http://[::1]:23119/api/items", desc: "IPv6 loopback [::1] with /api/items" },
    { url: "https://127.0.0.1:23119/api/items", desc: "HTTPS scheme with /api/items" },
    { url: "ftp://127.0.0.1:23119/api/items", desc: "FTP scheme" },
    { url: "file:///etc/passwd", desc: "file: scheme" },
    { url: "javascript:alert(1)", desc: "javascript: scheme" },
    { url: "data:text/html,<script>alert(1)</script>", desc: "data: scheme" },
    { url: "http://127.0.0.1:23120/api/items", desc: "adjacent port 23120" },
    { url: "http://127.0.0.1:8080/api/items", desc: "alternate port 8080" },
    { url: "http://admin:secret@127.0.0.1:23119/api/items", desc: "basic auth user:pass credentials" },
    { url: "http://127.0.0.1:23119/api/..", desc: "path ending in /.." },
    { url: "http://127.0.0.1:23119/api/./items", desc: "path containing /./" },
    { url: "http://127.0.0.1:23119/api/items/.", desc: "path ending in /." },
    { url: "http://127.0.0.1:23119/api/%2e%2e/items", desc: "percent-encoded lowercase %2e%2e" },
    { url: "http://127.0.0.1:23119/api/%2E%2E/items", desc: "percent-encoded uppercase %2E%2E" },
    { url: "http://127.0.0.1:23119/api/foo\\bar", desc: "backslash path traversal" },
    { url: "http://127.0.0.1:23119/not-api/items", desc: "path outside /api/" },
    { url: "http://127.0.0.1:23119/apixyz", desc: "path starting with /api but not /api/" },
    { url: "http://127.0.0.1:23119/", desc: "root path /" },
    { url: "http://127.0.0.1:23119", desc: "empty path" },
    { url: "http://127.0.0.1:23119:23119/api/items", desc: "double port notation" },
    { url: "http://127.0.0.1:23119@127.0.0.1:23119/api/items", desc: "credentials in authority matching same host" },
    { url: "http://127.0.0.2:23119/api/items", desc: "non-127.0.0.1 loopback address" },
    { url: "http://192.168.1.1:23119/api/items", desc: "LAN IP address" },
    { url: "http://google.com/api/items", desc: "public domain" },
    { url: "http://evil.com?http://127.0.0.1:23119/api/items", desc: "embedded target URL in query string of evil domain" },
  ];

  for (const { url, desc } of extendedBypassAttacks) {
    it(`rejects extended attack: ${desc} (${url})`, () => {
      expect(() => checkZoteroUrl(url)).toThrow();
    });
  }

  it("characterizes whitespace & control character behavior under WHATWG URL normalization", () => {
    // Note: WHATWG URL parser percent-encodes spaces to '%20' and strips '\r\n\t'.
    // checkZoteroUrl lines 82-85 inspect rawPath = parsed.pathname + parsed.search.
    // In Rust backend validate_zotero_url, raw unencoded whitespace is strictly rejected.
    // In TS checkZoteroUrl, new URL() converts spaces before rawPath is evaluated:
    const parsed = new URL("http://127.0.0.1:23119/api/items with spaces");
    expect(parsed.pathname).toBe("/api/items%20with%20spaces");
    expect(/[\s\x00-\x1f\x7f]/.test(parsed.pathname)).toBe(false);
  });

  it("accepts valid canonical loopback endpoints", () => {
    expect(() => checkZoteroUrl("http://127.0.0.1:23119/api")).not.toThrow();
    expect(() => checkZoteroUrl("http://127.0.0.1:23119/api/")).not.toThrow();
    expect(() => checkZoteroUrl("http://127.0.0.1:23119/api/users/0/items")).not.toThrow();
    expect(() => checkZoteroUrl("http://127.0.0.1:23119/api/users/0/items?format=csljson&limit=50")).not.toThrow();
    expect(() => checkZoteroUrl("http://127.0.0.1:23119/api/users/0/collections/ABC/items")).not.toThrow();
  });
});

describe("Adversarial buildZoteroUrl URL Sanitization", () => {
  it("sanitizes relative resource paths safely", () => {
    const url1 = buildZoteroUrl({ resource: "users/0/items" });
    expect(url1).toContain("http://127.0.0.1:23119/api/users/0/items");
    expect(() => checkZoteroUrl(url1)).not.toThrow();

    const url2 = buildZoteroUrl({ resource: "/api/users/0/items" });
    expect(url2).toContain("http://127.0.0.1:23119/api/users/0/items");
    expect(() => checkZoteroUrl(url2)).not.toThrow();

    const url3 = buildZoteroUrl({ resource: "api/users/0/items" });
    expect(url3).toContain("http://127.0.0.1:23119/api/users/0/items");
    expect(() => checkZoteroUrl(url3)).not.toThrow();
  });

  it("clamps extreme limit values within [1, 100]", () => {
    const clampedMax = buildZoteroUrl({ resource: "items", limit: 999999 });
    expect(clampedMax).toContain("limit=100");

    const clampedMin = buildZoteroUrl({ resource: "items", limit: -50 });
    expect(clampedMin).toContain("limit=1");
  });
});

describe("Adversarial 3-Way Diff & Invariant Stress Tests (previewZoteroChanges)", () => {
  const baseLocalSource: Source = {
    id: "local-uuid-1",
    kind: "book",
    title: "Local Title Original",
    shortTitle: "Local Short",
    authors: ["Original Author"],
    year: "2021",
    cslId: "ZOTERO_ITEM_1",
    manualFull: "Preserved Full Note Citation Text",
    manualShort: "Preserved Short Citation Text",
    manualBibliography: "Preserved Bibliography Entry Text",
    cslData: {
      zoteroOrigin: {
        libraryId: "0",
        itemKey: "ZOTERO_ITEM_1",
        version: 5,
        lastImportedFields: {
          title: "Initial Remote Title",
          authors: ["Initial Remote Author"],
          year: "2020",
        },
      } satisfies ZoteroOrigin,
    },
  };

  it("CRITICAL INVARIANT: local manual citation overrides are NEVER touched or removed by incoming changes", () => {
    const incoming = [
      {
        id: "ZOTERO_ITEM_1",
        type: "book",
        title: "Completely Changed Remote Title",
        author: [{ family: "NewRemoteAuthor", given: "Alice" }],
        issued: { "date-parts": [[2025]] },
        // Malicious attempt to inject manual overrides remotely:
        manualFull: "MALICIOUS REMOTE OVERWRITE",
        manualShort: "MALICIOUS REMOTE OVERWRITE",
        manualBibliography: "MALICIOUS REMOTE OVERWRITE",
      },
    ];

    const result = previewZoteroChanges([baseLocalSource], incoming, 6);

    // 1. Existing sources list must retain the exact manual citations
    expect(result.existingSources).toHaveLength(1);
    const existing = result.existingSources[0];
    expect(existing.manualFull).toBe("Preserved Full Note Citation Text");
    expect(existing.manualShort).toBe("Preserved Short Citation Text");
    expect(existing.manualBibliography).toBe("Preserved Bibliography Entry Text");

    // 2. Candidate source draft must not have adopted manual fields
    const candidate = result.sources[0];
    expect((candidate as unknown as Record<string, unknown>).manualFull).toBeUndefined();
    expect((candidate as unknown as Record<string, unknown>).manualShort).toBeUndefined();
    expect((candidate as unknown as Record<string, unknown>).manualBibliography).toBeUndefined();
  });

  it("CRITICAL INVARIANT: remote deletion NEVER deletes local sources or unlinks references", () => {
    // Scenario: Remote library emptied (0 items)
    const incoming: Record<string, unknown>[] = [];
    const result = previewZoteroChanges([baseLocalSource], incoming, 10);

    expect(result.sources).toHaveLength(0);
    expect(result.existingSources).toHaveLength(1);
    expect(result.existingSources[0].id).toBe("local-uuid-1");
    expect(result.existingSources[0].title).toBe("Local Title Original");
  });

  it("survives extreme/corrupted input objects without throwing or corrupting state", () => {
    const extremeIncoming = [
      {}, // totally empty object
      { id: "" }, // empty id string
      { id: null, type: null, title: null, author: null }, // explicit nulls
      { id: 12345, type: 999 }, // numeric types instead of strings
      {
        id: "ZOTERO_UNICODE_1",
        type: "article-journal",
        title: "Unicode test: 𝒳𝒴𝒵 \uFEFF \u202E RTL \u0000 \uD83D\uDE00",
        author: [
          { family: "مرحبا", given: "العالم" },
          { literal: "Société des Auteurs & Compositeurs" },
          {}, // empty author object
          { family: null, given: undefined },
        ],
        issued: { "date-parts": [["2024", "invalid", null]] },
      },
      {
        id: "ZOTERO_HUGE_1",
        type: "book",
        title: "A".repeat(50_000), // very long string
      },
    ];

    expect(() => {
      const result = previewZoteroChanges([baseLocalSource], extremeIncoming, 99);
      expect(result.existingSources).toHaveLength(1);
      expect(result.existingSources[0].id).toBe("local-uuid-1");
    }).not.toThrow();
  });

  it("handles null/undefined fields in currentSources safely", () => {
    const sparseLocalSource: Source = {
      id: "sparse-1",
      kind: "journal",
      title: "",
      authors: [],
      cslId: undefined,
      cslData: undefined,
    };

    const incoming = [
      {
        id: "NEW_1",
        type: "book",
        title: "Valid Incoming",
      },
    ];

    expect(() => {
      const result = previewZoteroChanges([sparseLocalSource], incoming, 1);
      expect(result.existingSources).toHaveLength(1);
      expect(result.review.newSources).toHaveLength(1);
    }).not.toThrow();
  });

  it("handles multiple candidates matching the same local source without duplication glitches", () => {
    const incoming = [
      { id: "ZOTERO_ITEM_1", type: "book", title: "Update Version A" },
      { id: "ZOTERO_ITEM_1", type: "book", title: "Update Version B" },
    ];

    const result = previewZoteroChanges([baseLocalSource], incoming, 7);
    expect(result.sources).toHaveLength(2);
    // Both match ZOTERO_ITEM_1
    const exactMatches = result.review.exactDuplicates.filter((row) =>
      row.existingSourceIds.includes("local-uuid-1"),
    );
    expect(exactMatches.length).toBeGreaterThanOrEqual(1);
    expect(result.existingSources).toHaveLength(1);
  });
});
