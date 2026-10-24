import { useMemo, useState } from "react";
import type { JSONContent } from "@tiptap/react";
import type { Entry, Project } from "../model";
import { Dropdown } from "../components/Dropdown";
import { boundedGraphemeExcerpt, compareEntries, createRestorePatch, type AlignedBlock, type DiffSpan, type RestorePatch } from "./revisionDiff";

const MAX_SELECTED_PASSAGE = 4000;

export function RevisionComparison({
  before,
  current,
  onRestore,
}: {
  before: Project;
  current: Project;
  onRestore: (entry: Entry, patch?: RestorePatch) => void;
}) {
  const [selected, setSelected] = useState(before.order[0] ?? before.entries[0]?.id ?? "");
  const [changeCursor, setChangeCursor] = useState(0);
  const [selectingPassage, setSelectingPassage] = useState(false);
  const [passageTexts, setPassageTexts] = useState({ snapshot: "", current: "" });
  const [passageDiff, setPassageDiff] = useState<ReturnType<typeof compareEntries> | null>(null);
  const [passageLocation, setPassageLocation] = useState({ snapshotBlock: 0, currentBlock: 0, snapshotOffset: 0, currentOffset: 0 });
  const old = before.entries.find((e) => e.id === selected);
  const live = current.entries.find((e) => e.id === selected);
  const diff = useMemo(() => old && live ? compareEntries(old, live) : null, [old, live]);
  const changes = diff?.blocks.filter((block) => block.status !== "unchanged") ?? [];
  const restoreBlock = (block: AlignedBlock) => {
    if (!old || !live) return;
    const patch = createRestorePatch(old, live, current.revision, block);
    if (patch) onRestore(old, patch);
  };
  const moveChange = (delta: number) => {
    const next = (changeCursor + delta + changes.length) % changes.length;
    setChangeCursor(next);
    const target = document.getElementById(`revision-change-current-${changes[next].id}`)
      ?? document.getElementById(`revision-change-snapshot-${changes[next].id}`);
    target?.scrollIntoView({ block: "nearest" });
  };
  const compareSelectedPassage = () => {
    if (!old || !live || !passageTexts.snapshot.trim() || !passageTexts.current.trim()) return;
    setPassageDiff(compareEntries(
      { ...old, content: textDocument(passageTexts.snapshot) },
      { ...live, content: textDocument(passageTexts.current) },
    ));
  };
  const excerpt = (entry: Entry | undefined, blockIndex: number, offset: number) => {
    const block = entry?.content.content?.[blockIndex];
    return block ? boundedGraphemeExcerpt(plainText(block), offset, MAX_SELECTED_PASSAGE) : "";
  };
  const snapshotExcerpt = excerpt(old, passageLocation.snapshotBlock, passageLocation.snapshotOffset);
  const currentExcerpt = excerpt(live, passageLocation.currentBlock, passageLocation.currentOffset);
  return (
    <div className="revision-comparison">
      <label>
        Compare section{" "}
        <Dropdown
          label="Compare section"
          value={selected}
          onChange={(id) => { setSelected(id); setChangeCursor(0); setPassageLocation({ snapshotBlock: 0, currentBlock: 0, snapshotOffset: 0, currentOffset: 0 }); setPassageTexts({ snapshot: "", current: "" }); setPassageDiff(null); setSelectingPassage(false); }}
          options={before.entries.map((e) => ({ value: e.id, label: e.title }))}
        />
      </label>
      {old && (
        <>
          {diff?.oversized ? (
            <div className="revision-oversized">
              <p role="status" className="revision-summary">{diff.summary}</p>
              {!selectingPassage ? (
                <button type="button" onClick={() => { setSelectingPassage(true); setPassageDiff(null); }}>Compare selected passage</button>
              ) : (
                <div className="revision-selected-passage">
                  <p>Choose a paragraph and character offset from each version. Compare at most 4,000 characters at a time. This read-only comparison cannot restore text.</p>
                  <div className="revision-selection-locations">
                    <label>Snapshot paragraph<input type="number" min={1} max={old.content.content?.length ?? 1} value={passageLocation.snapshotBlock + 1} onChange={(event) => setPassageLocation((value) => ({ ...value, snapshotBlock: Math.max(0, Number(event.target.value) - 1), snapshotOffset: 0 }))} /></label>
                    <label>Snapshot character offset<input type="number" min={0} max={Math.max(0, plainText(old.content.content?.[passageLocation.snapshotBlock]).length - 1)} value={passageLocation.snapshotOffset} onChange={(event) => setPassageLocation((value) => ({ ...value, snapshotOffset: Math.max(0, Number(event.target.value)) }))} /></label>
                    <label>Current paragraph<input type="number" min={1} max={live?.content.content?.length ?? 1} value={passageLocation.currentBlock + 1} onChange={(event) => setPassageLocation((value) => ({ ...value, currentBlock: Math.max(0, Number(event.target.value) - 1), currentOffset: 0 }))} /></label>
                    <label>Current character offset<input type="number" min={0} max={Math.max(0, plainText(live?.content.content?.[passageLocation.currentBlock]).length - 1)} value={passageLocation.currentOffset} onChange={(event) => setPassageLocation((value) => ({ ...value, currentOffset: Math.max(0, Number(event.target.value)) }))} /></label>
                  </div>
                  <div className="revision-selection-previews">
                    <pre aria-label="Snapshot passage excerpt">{snapshotExcerpt ?? "This grapheme is larger than the comparison limit on this system."}</pre>
                    <pre aria-label="Current passage excerpt">{currentExcerpt ?? "This grapheme is larger than the comparison limit on this system."}</pre>
                  </div>
                  <button type="button" disabled={snapshotExcerpt === null || currentExcerpt === null} onClick={() => { setPassageTexts({ snapshot: snapshotExcerpt ?? "", current: currentExcerpt ?? "" }); setPassageDiff(null); }}>Use these passages</button>
                  <label>Snapshot passage<textarea aria-label="Snapshot passage" readOnly maxLength={4000} value={passageTexts.snapshot} /></label>
                  <label>Current passage<textarea aria-label="Current passage" readOnly maxLength={4000} value={passageTexts.current} /></label>
                  <div className="revision-change-controls">
                    <button type="button" onClick={compareSelectedPassage} disabled={!passageTexts.snapshot.trim() || !passageTexts.current.trim()}>Compare selected passage</button>
                    <button type="button" onClick={() => { setSelectingPassage(false); setPassageDiff(null); }}>Cancel</button>
                  </div>
                  {passageDiff && <div className="revision-selected-result" aria-live="polite">
                    {passageDiff.oversized ? <p role="status">{passageDiff.summary}</p> : <>
                      <p role="status">{passageDiff.summary}</p>
                      <div className="revision-columns">
                        <section aria-label="Selected snapshot passage"><h3>Snapshot selection</h3><p>{renderSpans(passageDiff.blocks[0]?.beforeSpans ?? [])}</p></section>
                        <section aria-label="Selected current passage"><h3>Current selection</h3><p>{renderSpans(passageDiff.blocks[0]?.currentSpans ?? [])}</p></section>
                      </div>
                    </>}
                  </div>}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="revision-change-controls" aria-label="Comparison navigation">
                <button type="button" onClick={() => moveChange(-1)} disabled={!changes.length}>Previous change</button>
                <span aria-live="polite">{changes.length ? `Change ${Math.min(changeCursor + 1, changes.length)} of ${changes.length}` : "No changes"}</span>
                <button type="button" onClick={() => moveChange(1)} disabled={!changes.length}>Next change</button>
              </div>
              <p className="revision-summary" role="status">{diff?.summary ?? "This section was removed."}</p>
              <div className="revision-columns">
                <section aria-label="Snapshot version">
                  <h3>Snapshot</h3>
                  {diff?.blocks.map((block) => block.beforeIndex === null ? null : (
                    <div className="revision-block" key={block.id} id={block.status !== "unchanged" ? `revision-change-snapshot-${block.id}` : undefined}>
                      <p>{renderSpans(block.beforeSpans)}</p>
                      {block.structuralChanges.map((change) => <p className="revision-structure" key={change}>{change}</p>)}
                      {block.currentIndex !== null && block.status === "changed" && (
                        <button type="button" onClick={() => restoreBlock(block)}>Restore paragraph from snapshot</button>
                      )}
                    </div>
                  ))}
                  {old.content.content?.length === 0 && <p>This snapshot section is empty.</p>}
                </section>
                <section aria-label="Current version">
                  <h3>Current</h3>
                  {diff?.blocks.map((block) => block.currentIndex === null ? null : (
                    <div className="revision-block" key={block.id} id={block.status !== "unchanged" ? `revision-change-current-${block.id}` : undefined}>
                      <p>{renderSpans(block.currentSpans)}</p>
                      {block.structuralChanges.map((change) => <p className="revision-structure" key={change}>{change}</p>)}
                    </div>
                  ))}
                  {!live && <p>This section has been removed.</p>}
                </section>
              </div>
            </>
          )}
          <button type="button" onClick={() => onRestore(old)}>Restore this section</button>
          <p className="panel-help">Added text is underlined and labeled; deleted text is struck through and labeled. Restoring a paragraph restores the complete rich-text paragraph. A safety snapshot is kept first.</p>
        </>
      )}
    </div>
  );
}

function textDocument(text: string) {
  return { type: "doc" as const, content: [{ type: "paragraph" as const, content: [{ type: "text" as const, text }] }] };
}

function plainText(node?: JSONContent): string {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  return (node.content ?? []).map((child) => plainText(child)).join("");
}

function renderSpans(spans: DiffSpan[]) {
  return spans.map((span, index) => span.kind === "added"
    ? <ins key={`${span.from}-${index}`}><span className="sr-only">Added: </span>{span.text}</ins>
    : span.kind === "deleted"
      ? <del key={`${span.from}-${index}`}><span className="sr-only">Deleted: </span>{span.text}</del>
      : <span key={`${span.from}-${index}`}>{span.text}</span>);
}
