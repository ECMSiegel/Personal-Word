import { findProseIssues, type ProseIssue } from "../editor/proseCheck";

export type ProseBlockDescriptor = { id: string; from: number; text: string };
export type ProseWorkerRequest = {
  entryId: string;
  revision: number;
  requestId: number;
  blockPositions: Array<{ id: string; from: number }>;
  changedBlocks: ProseBlockDescriptor[];
};
export type ProseWorkerResponse = {
  entryId: string;
  revision: number;
  requestId: number;
  issues: ProseIssue[];
  total: number;
};

type CachedBlock = { text: string; issues: ProseIssue[]; generation: number };

/** Pure message handler shared by the real worker and deterministic unit tests. */
export function createProseWorkerHandler(
  analyze: (text: string) => ProseIssue[] = findProseIssues,
) {
  let activeEntryId: string | null = null;
  let blocks = new Map<string, CachedBlock>();
  let generation = 0;

  return (request: ProseWorkerRequest): ProseWorkerResponse => {
    if (activeEntryId !== request.entryId) {
      activeEntryId = request.entryId;
      blocks = new Map();
      generation = 0;
    }

    const activeIds = new Set(request.blockPositions.map((block) => block.id));
    for (const blockId of blocks.keys()) if (!activeIds.has(blockId)) blocks.delete(blockId);

    for (const block of request.changedBlocks) {
      blocks.set(block.id, { text: block.text, issues: analyze(block.text), generation: ++generation });
    }
    const issues: ProseIssue[] = [];
    for (const position of request.blockPositions) {
      const cached = blocks.get(position.id);
      if (!cached) continue;
      for (const issue of cached.issues) {
        const from = position.from + issue.from;
        const to = position.from + issue.to;
        issues.push({
          ...issue,
          from,
          to,
          localFrom: issue.from,
          localTo: issue.to,
          blockId: position.id,
          id: `${request.entryId}:${position.id}:${cached.generation}:${issue.kind}:${issue.from}:${issue.to}:${issue.message}`,
        });
      }
    }
    issues.sort((a, b) => a.from - b.from || a.to - b.to || a.kind.localeCompare(b.kind));
    return {
      entryId: request.entryId,
      revision: request.revision,
      requestId: request.requestId,
      issues,
      total: issues.length,
    };
  };
}

const workerScope = globalThis as typeof globalThis & {
  document?: unknown;
  addEventListener?: (type: string, listener: (event: MessageEvent<ProseWorkerRequest>) => void) => void;
  postMessage?: (message: ProseWorkerResponse) => void;
};
if (typeof workerScope.document === "undefined" && workerScope.addEventListener && workerScope.postMessage) {
  const handle = createProseWorkerHandler();
  workerScope.addEventListener("message", (event) => workerScope.postMessage!(handle(event.data)));
}
