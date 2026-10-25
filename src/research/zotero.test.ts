import { afterEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

// Pretend to be the desktop app (isNativeApp looks for __TAURI_INTERNALS__ on window).
const asDesktop = () => vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
afterEach(() => {
  vi.unstubAllGlobals();
  invokeMock.mockReset();
});
import {
  checkZoteroUrl,
  fetchZoteroItems,
  fetchAllZoteroItems,
  previewZoteroChanges,
  pollZoteroUpdates,
  computeZotero3WayDiff,
  ZOTERO_DESKTOP_ONLY,
  type ZoteroOrigin,
} from "./zotero";
import type { Source } from "./types";

describe("checkZoteroUrl", () => {
  it("accepts valid 127.0.0.1:23119 Zotero local API URLs", () => {
    expect(() =>
      checkZoteroUrl("http://127.0.0.1:23119/api/users/0/items?format=csljson"),
    ).not.toThrow();
    expect(() =>
      checkZoteroUrl("http://127.0.0.1:23119/api/users/0/collections/ABC/items"),
    ).not.toThrow();
  });

  it("rejects non-loopback hosts (including localhost for DNS rebinding protection)", () => {
    expect(() =>
      checkZoteroUrl("http://localhost:23119/api/users/0/items"),
    ).toThrow(/127\.0\.0\.1:23119/);
    expect(() =>
      checkZoteroUrl("http://192.168.1.1:23119/api/users/0/items"),
    ).toThrow(/127\.0\.0\.1:23119/);
    expect(() =>
      checkZoteroUrl("http://google.com/api/users/0/items"),
    ).toThrow(/127\.0\.0\.1:23119/);
    expect(() =>
      checkZoteroUrl("http://[::1]:23119/api/users/0/items"),
    ).toThrow(/127\.0\.0\.1:23119/);
  });

  it("rejects non-http schemes", () => {
    expect(() =>
      checkZoteroUrl("https://127.0.0.1:23119/api/users/0/items"),
    ).toThrow(/unencrypted HTTP/);
    expect(() =>
      checkZoteroUrl("file:///etc/passwd"),
    ).toThrow();
    expect(() =>
      checkZoteroUrl("ftp://127.0.0.1:23119/api/users/0/items"),
    ).toThrow();
  });

  it("rejects ports other than 23119", () => {
    expect(() =>
      checkZoteroUrl("http://127.0.0.1:80/api/users/0/items"),
    ).toThrow(/23119/);
    expect(() =>
      checkZoteroUrl("http://127.0.0.1:8080/api/users/0/items"),
    ).toThrow(/23119/);
    expect(() =>
      checkZoteroUrl("http://127.0.0.1:23120/api/users/0/items"),
    ).toThrow(/23119/);
  });

  it("rejects credentials in URL authority", () => {
    expect(() =>
      checkZoteroUrl("http://admin:secret@127.0.0.1:23119/api/users/0/items"),
    ).toThrow(/Credentials/);
  });

  it("rejects path traversal and paths outside /api/", () => {
    expect(() =>
      checkZoteroUrl("http://127.0.0.1:23119/api/../items"),
    ).toThrow(/traversal/i);
    expect(() =>
      checkZoteroUrl("http://127.0.0.1:23119/api/%2e%2e/items"),
    ).toThrow(/traversal/i);
    expect(() =>
      checkZoteroUrl("http://127.0.0.1:23119/not-api/items"),
    ).toThrow(/\/api\//);
  });

  it("rejects whitespace and control characters in URL", () => {
    expect(() =>
      checkZoteroUrl("http://127.0.0.1:23119/api/items with spaces"),
    ).toThrow(/whitespace or control characters/);
    expect(() =>
      checkZoteroUrl("http://127.0.0.1:23119/api/items\twith\ttab"),
    ).toThrow(/whitespace or control characters/);
    expect(() =>
      checkZoteroUrl("http://127.0.0.1:23119/api/items\nwith\nnewline"),
    ).toThrow(/whitespace or control characters/);
    expect(() =>
      checkZoteroUrl("http://127.0.0.1:23119/api/items\r\nCRLF"),
    ).toThrow(/whitespace or control characters/);
  });
});

describe("fetchZoteroItems", () => {
  it("rejects invalid URLs before attempting network fetch", async () => {
    await expect(
      fetchZoteroItems({ resource: "http://malicious.com/api/users/0/items" }),
    ).rejects.toThrow(/127\.0\.0\.1:23119/);
  });

  it("rejects resource with whitespace before network fetch", async () => {
    await expect(
      fetchZoteroItems({ resource: "users/0/items with spaces" }),
    ).rejects.toThrow(/whitespace or control characters/);
  });

  it("refuses in the browser preview without any network call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(fetchZoteroItems({ resource: "users/0/items" })).rejects.toThrow(
      "Zotero refresh works in the desktop app only.",
    );
    expect(ZOTERO_DESKTOP_ONLY).toBe("Zotero refresh works in the desktop app only.");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("reads through the native zotero_read command in the desktop app", async () => {
    asDesktop();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const response = { items: [{ id: "A" }], version: 42, notModified: false };
    invokeMock.mockResolvedValue(response);
    const request = { resource: "users/0/items", since: 10 };
    await expect(fetchZoteroItems(request)).resolves.toBe(response);
    expect(invokeMock).toHaveBeenCalledWith("zotero_read", { request });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("fetchAllZoteroItems pagination", () => {
  // Native reader answers: paging data arrives as fields, not headers.
  const page = (items: unknown[], extra: Record<string, unknown> = {}) => ({
    items,
    notModified: false,
    ...extra,
  });

  it("follows the next-page link until the library is complete", async () => {
    asDesktop();
    invokeMock
      .mockResolvedValueOnce(page([{ id: "A", type: "book", title: "Page one" }], { totalResults: 2, version: 9, nextStart: 1 }))
      .mockResolvedValueOnce(page([{ id: "B", type: "book", title: "Page two" }], { totalResults: 2, version: 9 }));
    const res = await fetchAllZoteroItems({ resource: "users/0/items" });
    expect(res.items.map((item) => item.id)).toEqual(["A", "B"]);
    expect(res.version).toBe(9);
    expect(res.nextStart).toBeUndefined();
    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(invokeMock.mock.calls[0][1].request.limit).toBe(100);
    expect(invokeMock.mock.calls[1][1].request.start).toBe(1);
  });

  it("stops with a message instead of returning part of the library when the page bound is hit", async () => {
    asDesktop();
    let start = 0;
    invokeMock.mockImplementation(async () => {
      start += 1;
      return page([{ id: `K${start}`, type: "book", title: `Item ${start}` }], { totalResults: 1000, nextStart: start });
    });
    await expect(fetchAllZoteroItems({ resource: "users/0/items" }, { maxPages: 3 })).rejects.toThrow(
      /more items than|only part/i,
    );
    expect(invokeMock).toHaveBeenCalledTimes(3);
  });

  it("stops with a message when a full page arrives without any paging data", async () => {
    asDesktop();
    const full = Array.from({ length: 100 }, (_, i) => ({ id: `F${i}`, type: "book", title: `Full ${i}` }));
    invokeMock.mockResolvedValue(page(full));
    await expect(fetchAllZoteroItems({ resource: "users/0/items" })).rejects.toThrow(/only part/i);
  });

  it("stops with a message when Zotero reports more items than it sent", async () => {
    asDesktop();
    invokeMock.mockResolvedValue(page([{ id: "A", type: "book", title: "Only one" }], { totalResults: 5 }));
    await expect(fetchAllZoteroItems({ resource: "users/0/items" })).rejects.toThrow(/only part/i);
  });
});

describe("previewZoteroChanges 3-way merge and retention", () => {
  const baseSource: Source = {
    id: "src-1",
    kind: "book",
    title: "Original Title",
    authors: ["Original Author"],
    creators: [{ role: "author", family: "Author", given: "Original" }],
    year: "2020",
    publisher: "Original Publisher",
    cslId: "ITEM1",
    cslData: {
      zoteroOrigin: {
        libraryId: "0",
        itemKey: "ITEM1",
        version: 10,
        lastImportedFields: {
          kind: "book",
          title: "Original Title",
          authors: ["Original Author"],
          creators: [{ role: "author", family: "Author", given: "Original" }],
          year: "2020",
          publisher: "Original Publisher",
        },
      } satisfies ZoteroOrigin,
    },
  };

  it("keeps each Zotero key on its own item when an untitled item comes first", () => {
    const incoming = [
      { id: "KEY_UNTITLED", type: "book" },
      { id: "KEY_REAL", type: "book", title: "Real Book" },
    ];
    const fresh = previewZoteroChanges([], incoming, 12);
    expect(fresh.sources).toHaveLength(1);
    expect((fresh.sources[0].cslData?.zoteroOrigin as ZoteroOrigin).itemKey).toBe("KEY_REAL");

    // A local source linked to KEY_REAL (only by its Zotero origin) must be matched.
    const linked: Source = {
      id: "local-real",
      kind: "book",
      title: "Real Book",
      authors: [],
      cslData: { zoteroOrigin: { itemKey: "KEY_REAL", lastImportedFields: { kind: "book", title: "Real Book" } } },
    };
    const refreshed = previewZoteroChanges([linked], incoming, 12);
    expect(refreshed.review.exactDuplicates.map((row) => row.existingSourceIds)).toEqual([["local-real"]]);
    expect(refreshed.review.newSources).toHaveLength(0);
  });

  it("identifies new incoming sources not present locally", () => {
    const incoming = [
      {
        id: "ITEM2",
        type: "book",
        title: "New Book",
        author: [{ family: "New", given: "Author" }],
      },
    ];
    const result = previewZoteroChanges([baseSource], incoming, 11);
    expect((result as { format?: string }).format).toBe("zotero");
    expect(result.review.newSources).toHaveLength(1);
    expect(result.review.newSources[0].candidate.title).toBe("New Book");
  });

  it("identifies exact duplicate when incoming matches existing unchanged source", () => {
    const incoming = [
      {
        id: "ITEM1",
        type: "book",
        title: "Original Title",
        author: [{ family: "Author", given: "Original" }],
        issued: { "date-parts": [[2020]] },
        publisher: "Original Publisher",
      },
    ];
    const result = previewZoteroChanges([baseSource], incoming, 10);
    expect(result.review.exactDuplicates).toHaveLength(1);
    expect(result.review.exactDuplicates[0].existingSourceIds).toContain("src-1");
    const dup = result.review.exactDuplicates[0] as { diff3?: { cleanRemoteUpdates: string[]; localEditsPreserved: string[]; conflicts: string[] } };
    expect(dup.diff3?.cleanRemoteUpdates).toHaveLength(0);
    expect(dup.diff3?.localEditsPreserved).toHaveLength(0);
    expect(dup.diff3?.conflicts).toHaveLength(0);
  });

  it("detects clean remote updates when local is unchanged and remote is modified", () => {
    const incoming = [
      {
        id: "ITEM1",
        type: "book",
        title: "Updated Remote Title",
        author: [{ family: "Author", given: "Original" }],
        issued: { "date-parts": [[2020]] },
        publisher: "Original Publisher",
      },
    ];
    const result = previewZoteroChanges([baseSource], incoming, 12);
    expect(result.review.exactDuplicates).toHaveLength(1);
    const dup = result.review.exactDuplicates[0] as { diff3?: { cleanRemoteUpdates: string[]; localEditsPreserved: string[]; conflicts: string[]; fields: Record<string, unknown> } };
    expect(dup.diff3).toBeDefined();
    expect(dup.diff3?.cleanRemoteUpdates).toContain("title");
    expect(dup.diff3?.localEditsPreserved).not.toContain("title");
    expect(dup.diff3?.conflicts).not.toContain("title");
    expect(dup.diff3?.fields.title).toEqual({
      field: "title",
      status: "cleanRemoteUpdate",
      base: "Original Title",
      local: "Original Title",
      remote: "Updated Remote Title",
    });
  });

  it("preserves local edits when local was modified and remote is unchanged", () => {
    const locallyModifiedSource: Source = {
      ...baseSource,
      title: "User Modified Title Locally",
    };
    const incoming = [
      {
        id: "ITEM1",
        type: "book",
        title: "Original Title",
        author: [{ family: "Author", given: "Original" }],
        issued: { "date-parts": [[2020]] },
        publisher: "Original Publisher",
      },
    ];
    const result = previewZoteroChanges([locallyModifiedSource], incoming, 12);
    expect(result.review.exactDuplicates).toHaveLength(1);
    const dup = result.review.exactDuplicates[0] as { diff3?: { cleanRemoteUpdates: string[]; localEditsPreserved: string[]; conflicts: string[]; fields: Record<string, unknown> } };
    expect(dup.diff3).toBeDefined();
    expect(dup.diff3?.localEditsPreserved).toContain("title");
    expect(dup.diff3?.cleanRemoteUpdates).not.toContain("title");
    expect(dup.diff3?.conflicts).not.toContain("title");
    expect(dup.diff3?.fields.title).toEqual({
      field: "title",
      status: "localEditPreserved",
      base: "Original Title",
      local: "User Modified Title Locally",
      remote: "Original Title",
    });
    expect(result.existingSources[0].title).toBe("User Modified Title Locally");
  });

  it("detects conflicts when both local and remote modified the same field to different values", () => {
    const locallyModifiedSource: Source = {
      ...baseSource,
      title: "User Modified Title Locally",
    };
    const incoming = [
      {
        id: "ITEM1",
        type: "book",
        title: "Remote Divergent Title",
        author: [{ family: "Author", given: "Original" }],
        issued: { "date-parts": [[2020]] },
        publisher: "Original Publisher",
      },
    ];
    const result = previewZoteroChanges([locallyModifiedSource], incoming, 12);
    expect(result.review.exactDuplicates).toHaveLength(1);
    const dup = result.review.exactDuplicates[0] as { diff3?: { cleanRemoteUpdates: string[]; localEditsPreserved: string[]; conflicts: string[]; fields: Record<string, unknown> } };
    expect(dup.diff3).toBeDefined();
    expect(dup.diff3?.conflicts).toContain("title");
    expect(dup.diff3?.cleanRemoteUpdates).not.toContain("title");
    expect(dup.diff3?.localEditsPreserved).not.toContain("title");
    expect(dup.diff3?.fields.title).toEqual({
      field: "title",
      status: "conflict",
      base: "Original Title",
      local: "User Modified Title Locally",
      remote: "Remote Divergent Title",
    });
  });

  it("computes multi-field 3-way merge correctly across diverse fields", () => {
    const source: Source = {
      ...baseSource,
      year: "2024", // Local edit (base was 2020)
      publisher: "Local Press", // Local edit (base was Original Publisher)
    };
    const incoming = [
      {
        id: "ITEM1",
        type: "book",
        title: "New Remote Title", // Remote edit (base was Original Title, local was Original Title)
        author: [{ family: "Author", given: "Original" }], // Unchanged in all three
        issued: { "date-parts": [[2020]] }, // Remote unchanged (still 2020)
        publisher: "Remote Press", // Remote edit (different from local and base)
      },
    ];
    const result = previewZoteroChanges([source], incoming, 13);
    const dup = result.review.exactDuplicates[0] as { diff3?: { cleanRemoteUpdates: string[]; localEditsPreserved: string[]; conflicts: string[]; fields: Record<string, { status: string }> } };
    expect(dup.diff3).toBeDefined();

    // title: cleanRemoteUpdate
    expect(dup.diff3?.cleanRemoteUpdates).toContain("title");
    expect(dup.diff3?.fields.title.status).toBe("cleanRemoteUpdate");

    // year: localEditPreserved
    expect(dup.diff3?.localEditsPreserved).toContain("year");
    expect(dup.diff3?.fields.year.status).toBe("localEditPreserved");

    // publisher: conflict (local=Local Press, remote=Remote Press, base=Original Publisher)
    expect(dup.diff3?.conflicts).toContain("publisher");
    expect(dup.diff3?.fields.publisher.status).toBe("conflict");

    // authors: unchanged
    expect(dup.diff3?.cleanRemoteUpdates).not.toContain("authors");
    expect(dup.diff3?.localEditsPreserved).not.toContain("authors");
    expect(dup.diff3?.conflicts).not.toContain("authors");
  });

  it("remote deletion does NOT delete local sources or unlink references", () => {
    // Incoming is empty (e.g. item was deleted in Zotero)
    const incoming: Record<string, unknown>[] = [];
    const result = previewZoteroChanges([baseSource], incoming, 15);
    // Existing sources must remain intact
    expect(result.existingSources).toHaveLength(1);
    expect(result.existingSources[0].id).toBe("src-1");
  });

  it("preserves manual citation fields regardless of incoming changes", () => {
    const sourceWithManual: Source = {
      ...baseSource,
      manualFull: "Custom Full Citation Text",
      manualShort: "Custom Short Note",
      manualBibliography: "Custom Bibliography Entry",
    };
    const incoming = [
      {
        id: "ITEM1",
        type: "book",
        title: "Different Remote Title",
      },
    ];
    const result = previewZoteroChanges([sourceWithManual], incoming, 12);
    const existing = result.existingSources[0];
    expect(existing.manualFull).toBe("Custom Full Citation Text");
    expect(existing.manualShort).toBe("Custom Short Note");
    expect(existing.manualBibliography).toBe("Custom Bibliography Entry");
  });
});

describe("computeZotero3WayDiff unit tests", () => {
  it("falls back gracefully when base lastImportedFields is absent", () => {
    const sourceWithoutBase: Source = {
      id: "src-no-base",
      kind: "book",
      title: "Existing Title",
      authors: ["Existing Author"],
    };
    const candidate = {
      kind: "book" as const,
      title: "Different Remote Title",
      authors: ["Existing Author"],
      year: "2025",
    };
    const diff = computeZotero3WayDiff(sourceWithoutBase, candidate);
    expect(diff.conflicts).toContain("title"); // Both have different non-empty titles
    expect(diff.cleanRemoteUpdates).toContain("year"); // Only remote has year
  });
});

describe("pollZoteroUpdates", () => {
  it("enforces minimum polling interval and supports cancellation via AbortSignal", async () => {
    const controller = new AbortController();
    const onUpdate = vi.fn();
    const onError = vi.fn();

    // Abort immediately
    controller.abort();

    await pollZoteroUpdates({
      resource: "users/0/items",
      intervalMs: 1000, // Should be clamped to at least 30000ms
      signal: controller.signal,
      onUpdate,
      onError,
    });

    expect(onUpdate).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});
