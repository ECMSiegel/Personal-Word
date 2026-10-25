import { invoke } from "@tauri-apps/api/core";
import { parseCslJson, type CslImportResult } from "./cslImport";
import { isNativeApp, type SourceDraft } from "./lookup";
import type { ExactDuplicateRow, SourceImportReview } from "./sourceMerge";
import type { Source } from "./types";

export type ZoteroReadRequest = {
  resource: string;
  since?: number;
  start?: number;
  limit?: number;
};

export type ZoteroReadResponse = {
  items: Record<string, unknown>[];
  version?: number;
  serverId?: string;
  nextStart?: number;
  totalResults?: number;
  notModified: boolean;
};

export type ZoteroOrigin = {
  serverId?: string;
  libraryId?: string;
  itemKey?: string;
  version?: number;
  lastImportedFields?: Record<string, unknown>;
};

export type ZoteroFieldDiffStatus =
  | "cleanRemoteUpdate"
  | "localEditPreserved"
  | "conflict"
  | "unchanged";

export type ZoteroFieldDiffDetail = {
  field: string;
  status: ZoteroFieldDiffStatus;
  base: unknown;
  local: unknown;
  remote: unknown;
};

export type ZoteroDiff3 = {
  cleanRemoteUpdates: string[];
  localEditsPreserved: string[];
  conflicts: string[];
  fields: Record<string, ZoteroFieldDiffDetail>;
};

export type ZoteroExactDuplicateRow = ExactDuplicateRow & {
  diff3?: ZoteroDiff3;
};

export type ZoteroImportResult = Omit<CslImportResult, "review"> & {
  format: "zotero";
  review: Omit<SourceImportReview, "exactDuplicates"> & {
    exactDuplicates: ZoteroExactDuplicateRow[];
  };
};

export const ZOTERO_LOOPBACK_ORIGIN = "http://127.0.0.1:23119";
export const ZOTERO_MIN_POLL_INTERVAL_MS = 30_000;

export const ZOTERO_COMPARED_FIELDS = [
  "kind",
  "title",
  "shortTitle",
  "authors",
  "creators",
  "year",
  "edition",
  "container",
  "institution",
  "event",
  "publishedDate",
  "publisher",
  "journal",
  "volume",
  "issue",
  "pages",
  "url",
  "doi",
  "accessed",
  "website",
  "isbn",
] as const;

function isEmptyValue(v: unknown): boolean {
  if (v === undefined || v === null || v === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

export function areFieldValuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (isEmptyValue(a) && isEmptyValue(b)) return true;
  if (isEmptyValue(a) || isEmptyValue(b)) return false;
  if (
    (typeof a === "string" || typeof a === "number") &&
    (typeof b === "string" || typeof b === "number")
  ) {
    return String(a).trim() === String(b).trim();
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!areFieldValuesEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (typeof a === "object" && typeof b === "object" && a !== null && b !== null) {
    const keysA = Object.keys(a as object);
    const keysB = Object.keys(b as object);
    const allKeys = new Set([...keysA, ...keysB]);
    for (const k of allKeys) {
      if (
        !areFieldValuesEqual(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)[k],
        )
      ) {
        return false;
      }
    }
    return true;
  }
  return false;
}

export function snapshotSourceFields(source: Source | SourceDraft): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {};
  for (const field of ZOTERO_COMPARED_FIELDS) {
    const val = (source as Record<string, unknown>)[field];
    if (val !== undefined) {
      snapshot[field] = typeof val === "object" && val !== null ? structuredClone(val) : val;
    }
  }
  return snapshot;
}

/**
 * Validates that a URL is strictly restricted to the loopback Zotero local API:
 * - Must not contain raw whitespace or ASCII control characters
 * - Must use unencrypted HTTP (Zotero local API binds only to local plaintext HTTP)
 * - Must target 127.0.0.1:23119 (strictly rejecting localhost, external IPs, other ports)
 * - Must start with /api/
 * - Must forbid credentials in authority
 * - Must forbid path traversal (/.., %2e%2e, etc.)
 */
export function checkZoteroUrl(url: string): void {
  // Finding 2 fix: Validate raw input URL before WHATWG URL constructor percent-encodes spaces
  if (/[\s\x00-\x1f\x7f]/.test(url)) {
    throw new Error("URL contains whitespace or control characters");
  }

  if (
    url.includes("/..") ||
    url.endsWith("/..") ||
    url.includes("/./") ||
    url.endsWith("/.") ||
    url.includes("\\") ||
    url.toLowerCase().includes("%2e%2e")
  ) {
    throw new Error("Path traversal is forbidden");
  }

  if (!url.startsWith("http://")) {
    throw new Error("Only unencrypted HTTP is supported for Zotero local API");
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("That Zotero web address is invalid");
  }

  if (parsed.protocol !== "http:") {
    throw new Error("Only unencrypted HTTP is supported for Zotero local API");
  }

  if (parsed.username || parsed.password) {
    throw new Error("Credentials in URL authority are forbidden");
  }

  if (parsed.hostname !== "127.0.0.1" || parsed.port !== "23119") {
    throw new Error("Only 127.0.0.1:23119 is permitted for Zotero local API");
  }

  if (!parsed.pathname.startsWith("/api/") && parsed.pathname !== "/api") {
    throw new Error("Path must start with /api/");
  }

  const rawPath = parsed.pathname + parsed.search;
  if (/[\s\x00-\x1f\x7f]/.test(rawPath)) {
    throw new Error("URL contains whitespace or control characters");
  }
}

/**
 * Constructs the canonical loopback URL for a Zotero resource with query parameters.
 */
export function buildZoteroUrl(request: ZoteroReadRequest): string {
  if (/[\s\x00-\x1f\x7f]/.test(request.resource)) {
    throw new Error("URL contains whitespace or control characters");
  }

  let url = request.resource.trim();
  if (url.startsWith("http://")) {
    // Already an absolute URL
  } else if (url.startsWith("/api/")) {
    url = `${ZOTERO_LOOPBACK_ORIGIN}${url}`;
  } else if (url.startsWith("api/")) {
    url = `${ZOTERO_LOOPBACK_ORIGIN}/${url}`;
  } else {
    url = `${ZOTERO_LOOPBACK_ORIGIN}/api/${url.replace(/^\/+/, "")}`;
  }

  const parsed = new URL(url);
  if (!parsed.searchParams.has("format")) {
    parsed.searchParams.set("format", "csljson");
  }
  if (request.start !== undefined && !parsed.searchParams.has("start")) {
    parsed.searchParams.set("start", String(request.start));
  }
  if (request.limit !== undefined && !parsed.searchParams.has("limit")) {
    parsed.searchParams.set("limit", String(Math.min(100, Math.max(1, request.limit))));
  }
  if (request.since !== undefined && !parsed.searchParams.has("since")) {
    parsed.searchParams.set("since", String(request.since));
  }

  return parsed.toString();
}

export const ZOTERO_DESKTOP_ONLY = "Zotero refresh works in the desktop app only.";

/**
 * Fetches items from the local Zotero API through the native `zotero_read`
 * command (which enforces the loopback, redirect, time and size limits).
 * The browser preview never contacts Zotero.
 */
export async function fetchZoteroItems(
  request: ZoteroReadRequest,
  _options?: { signal?: AbortSignal },
): Promise<ZoteroReadResponse> {
  const url = buildZoteroUrl(request);
  checkZoteroUrl(url);

  if (!isNativeApp()) throw new Error(ZOTERO_DESKTOP_ONLY);
  try {
    return await invoke<ZoteroReadResponse>("zotero_read", { request });
  } catch (error) {
    throw new Error(String(error));
  }
}

export const ZOTERO_PAGE_SIZE = 100;
export const ZOTERO_MAX_PAGES = 50;

/**
 * Reads every page of a Zotero resource (following the next-page link) through
 * the same loopback GET path. Throws instead of returning part of a library.
 */
export async function fetchAllZoteroItems(
  request: ZoteroReadRequest,
  options?: { signal?: AbortSignal; maxPages?: number },
): Promise<ZoteroReadResponse> {
  const maxPages = options?.maxPages ?? ZOTERO_MAX_PAGES;
  const partial = (detail: string) =>
    new Error(`${detail} Nothing was imported, because only part of your Zotero library arrived.`);
  let first: ZoteroReadResponse | undefined;
  const items: Record<string, unknown>[] = [];
  let start = request.start;
  for (let page = 0; page < maxPages; page++) {
    const response = await fetchZoteroItems(
      { ...request, start, limit: request.limit ?? ZOTERO_PAGE_SIZE },
      { signal: options?.signal },
    );
    if (!first) {
      first = response;
      if (response.notModified) return response;
    }
    items.push(...response.items);
    if (response.nextStart === undefined) {
      const total = response.totalResults ?? first.totalResults;
      // A full page with no paging headers (for example hidden from a browser
      // by cross-origin rules) may not be the end of the library.
      if (total === undefined && response.items.length >= (request.limit ?? ZOTERO_PAGE_SIZE)) {
        throw partial("Zotero sent a full page but did not say whether more items follow.");
      }
      if (total !== undefined && items.length < total) {
        throw partial(`Zotero reported ${total} items but sent only ${items.length}.`);
      }
      return { ...first, items, nextStart: undefined, totalResults: total };
    }
    if (response.nextStart <= (start ?? 0)) {
      throw partial("Zotero sent a next-page link that does not move forward.");
    }
    start = response.nextStart;
  }
  throw partial(`Your Zotero library has more items than this app reads in one refresh (${maxPages} pages).`);
}

/**
 * Computes a genuine 3-way merge diff comparing:
 * - Base: existingSource.cslData.zoteroOrigin.lastImportedFields
 * - Local: existingSource
 * - Remote: candidate
 */
export function computeZotero3WayDiff(
  localSource: Source,
  candidate: SourceDraft,
): ZoteroDiff3 {
  const origin = localSource.cslData?.zoteroOrigin as ZoteroOrigin | undefined;
  const baseFields = origin?.lastImportedFields;
  const hasBase = Boolean(baseFields && typeof baseFields === "object");

  const cleanRemoteUpdates: string[] = [];
  const localEditsPreserved: string[] = [];
  const conflicts: string[] = [];
  const fields: Record<string, ZoteroFieldDiffDetail> = {};

  const allKeys = new Set<string>([
    ...ZOTERO_COMPARED_FIELDS,
    ...(hasBase ? Object.keys(baseFields!) : []),
    ...Object.keys(candidate),
    ...Object.keys(localSource),
  ]);

  const excludedKeys = new Set([
    "id",
    "cslData",
    "lookupNote",
    "manualFull",
    "manualShort",
    "manualBibliography",
  ]);

  for (const key of allKeys) {
    if (excludedKeys.has(key)) continue;

    const baseVal = hasBase ? (baseFields as Record<string, unknown>)[key] : undefined;
    const localVal = (localSource as Record<string, unknown>)[key];
    const remoteVal = (candidate as Record<string, unknown>)[key];

    let status: ZoteroFieldDiffStatus = "unchanged";

    if (hasBase) {
      const localEqualBase = areFieldValuesEqual(localVal, baseVal);
      const remoteEqualBase = areFieldValuesEqual(remoteVal, baseVal);
      const localEqualRemote = areFieldValuesEqual(localVal, remoteVal);

      if (localEqualBase && !remoteEqualBase) {
        status = "cleanRemoteUpdate";
        cleanRemoteUpdates.push(key);
      } else if (!localEqualBase && remoteEqualBase) {
        status = "localEditPreserved";
        localEditsPreserved.push(key);
      } else if (!localEqualBase && !remoteEqualBase) {
        if (!localEqualRemote) {
          status = "conflict";
          conflicts.push(key);
        } else {
          status = "unchanged";
        }
      }
    } else {
      // Fallback when no lastImportedFields snapshot is available
      const localEqualRemote = areFieldValuesEqual(localVal, remoteVal);
      if (!localEqualRemote) {
        if (isEmptyValue(localVal) && !isEmptyValue(remoteVal)) {
          status = "cleanRemoteUpdate";
          cleanRemoteUpdates.push(key);
        } else if (!isEmptyValue(localVal) && isEmptyValue(remoteVal)) {
          status = "localEditPreserved";
          localEditsPreserved.push(key);
        } else {
          status = "conflict";
          conflicts.push(key);
        }
      }
    }

    if (
      status !== "unchanged" ||
      !isEmptyValue(baseVal) ||
      !isEmptyValue(localVal) ||
      !isEmptyValue(remoteVal)
    ) {
      fields[key] = {
        field: key,
        status,
        base: baseVal,
        local: localVal,
        remote: remoteVal,
      };
    }
  }

  return {
    cleanRemoteUpdates,
    localEditsPreserved,
    conflicts,
    fields,
  };
}

/**
 * Previews Zotero changes using a 3-way merge approach against lastImportedFields.
 * - Compares current local source vs incoming remote item vs lastImportedFields snapshot.
 * - Computes clean remote updates, local edits preserved, and true collisions.
 * - Remote deletion NEVER deletes local sources or unlinks footnotes/quotes.
 * - User manual citation overrides (manualFull, manualShort, manualBibliography) are preserved.
 * - Results are routed through the standard CslImportResult review structure.
 */
export function previewZoteroChanges(
  currentSources: Source[],
  receivedItems: Record<string, unknown>[],
  lastSyncVersion?: number,
): ZoteroImportResult {
  const result = parseCslJson(JSON.stringify(receivedItems), currentSources);
  Object.assign(result, { format: "zotero" });

  // Attach zoteroOrigin metadata to candidate drafts
  // Each draft keeps its own CSL item in cslData (parseCslJson skips untitled
  // items, so drafts do not line up with receivedItems by position).
  result.sources.forEach((candidate) => {
    const raw = (candidate.cslData ?? {}) as Record<string, unknown>;
    const itemKey = (raw.id as string) || (raw.key as string) || candidate.cslId || "";
    candidate.cslData = {
      ...(candidate.cslData ?? {}),
      zoteroOrigin: {
        itemKey,
        version: lastSyncVersion,
        lastImportedFields: snapshotSourceFields(candidate),
      } satisfies ZoteroOrigin,
    };
  });

  // Promote matched zoteroOrigin items into exactDuplicates if not already identified
  const exactIndices = new Set(result.review.exactDuplicates.map((row) => row.candidateIndex));
  result.sources.forEach((candidate, candidateIndex) => {
    if (exactIndices.has(candidateIndex)) return;
    const candidateKey = (candidate.cslData?.zoteroOrigin as ZoteroOrigin | undefined)?.itemKey || candidate.cslId;
    if (!candidateKey) return;

    const matchedSourceIds: string[] = [];
    for (const source of currentSources) {
      const origin = source.cslData?.zoteroOrigin as ZoteroOrigin | undefined;
      if (
        (origin?.itemKey && origin.itemKey === candidateKey) ||
        (source.cslId && source.cslId === candidateKey)
      ) {
        matchedSourceIds.push(source.id);
      }
    }

    if (matchedSourceIds.length > 0) {
      exactIndices.add(candidateIndex);
      result.review.newSources = result.review.newSources.filter((row) => row.candidateIndex !== candidateIndex);
      result.review.possibleMatches = result.review.possibleMatches.filter((row) => row.candidateIndex !== candidateIndex);
      result.review.exactDuplicates.push({
        candidateIndex,
        candidate,
        existingSourceIds: matchedSourceIds,
        matchedBy: ["external-id"],
      });
    }
  });

  // Finding 1 fix: Compute genuine 3-way merge diff against lastImportedFields for all exact duplicates
  for (const row of result.review.exactDuplicates as ZoteroExactDuplicateRow[]) {
    const matchedSource = currentSources.find((s) => row.existingSourceIds.includes(s.id));
    if (matchedSource) {
      row.diff3 = computeZotero3WayDiff(matchedSource, row.candidate);
    }
  }

  // Guarantee retention: existing sources are NEVER pruned or modified automatically.
  // Remote deletion does not delete local sources or unlink notes.
  result.existingSources = [...currentSources];
  result.duplicates = result.review.exactDuplicates.length;

  return result as ZoteroImportResult;
}

export type PollOptions = {
  resource: string;
  intervalMs?: number;
  signal?: AbortSignal;
  onUpdate: (response: ZoteroReadResponse) => void;
  onError?: (error: Error) => void;
};

/**
 * Managed polling helper for localhost Zotero updates with cancellation and bounded interval.
 */
export async function pollZoteroUpdates(options: PollOptions): Promise<void> {
  const interval = Math.max(ZOTERO_MIN_POLL_INTERVAL_MS, options.intervalMs ?? ZOTERO_MIN_POLL_INTERVAL_MS);
  let lastVersion: number | undefined;

  while (!options.signal?.aborted) {
    try {
      const response = await fetchZoteroItems(
        { resource: options.resource, since: lastVersion },
        { signal: options.signal },
      );
      if (!response.notModified && response.version !== undefined && response.version !== lastVersion) {
        lastVersion = response.version;
        options.onUpdate(response);
      }
    } catch (err) {
      if (options.signal?.aborted) break;
      if (options.onError && err instanceof Error) {
        options.onError(err);
      }
    }

    if (options.signal?.aborted) break;

    // Await sleep or abort
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, interval);
      if (options.signal) {
        options.signal.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
      }
    });
  }
}
