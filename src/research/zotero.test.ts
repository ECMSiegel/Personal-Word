import { describe, expect, it, vi } from "vitest";
import {
  checkZoteroUrl,
  fetchZoteroItems,
  fetchAllZoteroItems,
  previewZoteroChanges,
  pollZoteroUpdates,
  computeZotero3WayDiff,
  ZOTERO_MAX_BYTES,
  ZOTERO_TIMEOUT_MS,
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

  it("handles 304 not modified responses in browser mode", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 304,
      ok: false,
      headers: new Headers(),
    });

    try {
      const res = await fetchZoteroItems({ resource: "users/0/items", since: 10 });
      expect(res.notModified).toBe(true);
      expect(res.items).toHaveLength(0);
      expect(res.version).toBe(10);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("parses 200 responses with version and items in browser mode", async () => {
    const originalFetch = globalThis.fetch;
    const headers = new Headers();
    headers.set("Last-Modified-Version", "42");
    headers.set("Total-Results", "1");
    headers.set("Link", '<http://127.0.0.1:23119/api/users/0/items?start=50>; rel="next"');

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: "ITEM1", type: "book", title: "Test Book" }]), { status: 200, headers }),
    );

    try {
      const res = await fetchZoteroItems({ resource: "users/0/items" });
      expect(res.notModified).toBe(false);
      expect(res.version).toBe(42);
      expect(res.totalResults).toBe(1);
      expect(res.nextStart).toBe(50);
      expect(res.items).toHaveLength(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("fetchZoteroItems browser-preview limits", () => {
  const withFetch = async (mock: typeof fetch, run: () => Promise<void>) => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock;
    try {
      await run();
    } finally {
      globalThis.fetch = originalFetch;
    }
  };

  it("asks the browser to refuse redirects", async () => {
    const mock = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
    await withFetch(mock as unknown as typeof fetch, async () => {
      await fetchZoteroItems({ resource: "users/0/items" });
      expect(mock).toHaveBeenCalledTimes(1);
      expect(mock.mock.calls[0][1]).toMatchObject({ method: "GET", redirect: "error" });
    });
  });

  it("gives up after the 12 second limit", async () => {
    vi.useFakeTimers();
    try {
      const mock = vi.fn((_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init!.signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
      );
      await withFetch(mock as unknown as typeof fetch, async () => {
        const pending = fetchZoteroItems({ resource: "users/0/items" });
        const settled = expect(pending).rejects.toThrow(/12 seconds/);
        await vi.advanceTimersByTimeAsync(ZOTERO_TIMEOUT_MS - 1);
        expect(mock.mock.calls[0][1]?.signal?.aborted).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        await settled;
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("refuses a response whose Content-Length is over 5 MiB without reading it", async () => {
    const headers = new Headers({ "Content-Length": String(ZOTERO_MAX_BYTES + 1) });
    const mock = vi.fn().mockResolvedValue(new Response("[]", { status: 200, headers }));
    await withFetch(mock as unknown as typeof fetch, async () => {
      await expect(fetchZoteroItems({ resource: "users/0/items" })).rejects.toThrow(/5 MiB/);
    });
  });

  it("stops reading a streamed body once it passes 5 MiB", async () => {
    // Valid JSON 3 MiB over the cap, sent in 1 MiB chunks with no Content-Length.
    const chunk = 1024 * 1024;
    const text = '["' + "a".repeat(ZOTERO_MAX_BYTES + 3 * chunk) + '"]';
    const bytes = new TextEncoder().encode(text);
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent >= bytes.length) return controller.close();
        controller.enqueue(bytes.slice(sent, sent + chunk));
        sent += chunk;
      },
    });
    const mock = vi.fn().mockResolvedValue(new Response(body, { status: 200 }));
    await withFetch(mock as unknown as typeof fetch, async () => {
      await expect(fetchZoteroItems({ resource: "users/0/items" })).rejects.toThrow(/5 MiB/);
      // Reading stopped at the cap instead of draining the whole body.
      expect(sent).toBeLessThan(bytes.length);
    });
  });

  it("still accepts a body of exactly 5 MiB", async () => {
    const text = '["' + "a".repeat(ZOTERO_MAX_BYTES - 4) + '"]';
    const mock = vi.fn().mockResolvedValue(new Response(text, { status: 200 }));
    await withFetch(mock as unknown as typeof fetch, async () => {
      const res = await fetchZoteroItems({ resource: "users/0/items" });
      expect(res.items).toHaveLength(1);
    });
  });
});

describe("fetchAllZoteroItems pagination", () => {
  const page = (items: unknown[], headers: Record<string, string>) =>
    new Response(JSON.stringify(items), { status: 200, headers });

  it("follows the next-page link until the library is complete", async () => {
    const originalFetch = globalThis.fetch;
    const mock = vi.fn()
      .mockResolvedValueOnce(page([{ id: "A", type: "book", title: "Page one" }], {
        "Total-Results": "2",
        "Last-Modified-Version": "9",
        Link: '<http://127.0.0.1:23119/api/users/0/items?start=1>; rel="next"',
      }))
      .mockResolvedValueOnce(page([{ id: "B", type: "book", title: "Page two" }], {
        "Total-Results": "2",
        "Last-Modified-Version": "9",
      }));
    globalThis.fetch = mock as unknown as typeof fetch;
    try {
      const res = await fetchAllZoteroItems({ resource: "users/0/items" });
      expect(res.items.map((item) => item.id)).toEqual(["A", "B"]);
      expect(res.version).toBe(9);
      expect(res.nextStart).toBeUndefined();
      expect(mock).toHaveBeenCalledTimes(2);
      expect(String(mock.mock.calls[0][0])).toContain("limit=100");
      expect(String(mock.mock.calls[1][0])).toMatch(/[?&]start=1(&|$)/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("stops with a message instead of returning part of the library when the page bound is hit", async () => {
    const originalFetch = globalThis.fetch;
    let start = 0;
    const mock = vi.fn(async () => {
      start += 1;
      return page([{ id: `K${start}`, type: "book", title: `Item ${start}` }], {
        "Total-Results": "1000",
        Link: `<http://127.0.0.1:23119/api/users/0/items?start=${start}>; rel="next"`,
      });
    });
    globalThis.fetch = mock as unknown as typeof fetch;
    try {
      await expect(fetchAllZoteroItems({ resource: "users/0/items" }, { maxPages: 3 })).rejects.toThrow(
        /more items than|only part/i,
      );
      expect(mock).toHaveBeenCalledTimes(3);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("stops with a message when a full page arrives without any paging headers", async () => {
    const originalFetch = globalThis.fetch;
    const full = Array.from({ length: 100 }, (_, i) => ({ id: `F${i}`, type: "book", title: `Full ${i}` }));
    globalThis.fetch = vi.fn().mockResolvedValue(page(full, {})) as unknown as typeof fetch;
    try {
      await expect(fetchAllZoteroItems({ resource: "users/0/items" })).rejects.toThrow(/only part/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("stops with a message when Zotero reports more items than it sent", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(
      page([{ id: "A", type: "book", title: "Only one" }], { "Total-Results": "5" }),
    ) as unknown as typeof fetch;
    try {
      await expect(fetchAllZoteroItems({ resource: "users/0/items" })).rejects.toThrow(/only part/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
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
