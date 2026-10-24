import { useState } from "react";
import { getSchema } from "@tiptap/core";
import type { Annotation, Entry, Project } from "../model";
import { documentExtensions } from "../editor/extensions";
import {
  migrateLegacyCommentAnchor,
  resolveCommentAnchor,
} from "../editor/commentAnchors";

const documentSchema = getSchema(documentExtensions());

function getEntryDocument(entry: Entry) {
  try {
    return documentSchema.nodeFromJSON(entry.content);
  } catch {
    return null;
  }
}

export function CommentsPanel({
  project,
  onChange,
  onJump,
  onReattach,
  onAdd,
}: {
  project: Project;
  onChange: (items: Annotation[]) => void;
  onJump: (annotation: Annotation) => void;
  onReattach: (annotation: Annotation) => void;
  onAdd: () => void;
}) {
  const [all, setAll] = useState(false);
  const items = project.annotations ?? [];
  const visible = items.filter((annotation) => all || !annotation.resolved);

  return (
    <section className="feature-panel">
      <header>
        <h1>Comments & tasks</h1>
        <button onClick={onAdd}>Add task</button>
      </header>
      <label>
        <input
          type="checkbox"
          checked={all}
          onChange={(event) => setAll(event.target.checked)}
        />{" "}
        Show resolved
      </label>
      {visible.map((annotation) => {
        const entry = project.entries.find((item) => item.id === annotation.entryId);
        let current = annotation;
        let anchorStatus: "attached" | "detached" | "ambiguous" = "detached";
        let canJump = false;

        if (entry) {
          if (!annotation.quote) {
            anchorStatus = "attached";
            canJump = true;
          } else {
            const doc = getEntryDocument(entry);
            if (doc) {
              if (!annotation.anchor)
                current = migrateLegacyCommentAnchor(
                  annotation,
                  doc,
                  entry.contentRevision ?? 0,
                );
              anchorStatus = current.anchor?.status ?? "detached";
              canJump =
                anchorStatus === "attached" &&
                current.anchor?.entryRevision === (entry.contentRevision ?? 0) &&
                resolveCommentAnchor(current, doc) !== null;
              if (!canJump && anchorStatus === "attached")
                anchorStatus = "detached";
            }
          }
        }

        return (
          <article className="feature-item" key={annotation.id}>
            <label>
              <input
                type="checkbox"
                checked={annotation.resolved}
                onChange={(event) =>
                  onChange(
                    items.map((item) =>
                      item.id === annotation.id
                        ? { ...item, resolved: event.target.checked }
                        : item,
                    ),
                  )
                }
              />
              {annotation.text}
            </label>
            <small>
              {annotation.kind} -- {entry?.title ?? "Removed section"}
              {anchorStatus === "detached" ? " -- Detached from text" : ""}
              {anchorStatus === "ambiguous" ? " -- Ambiguous passage" : ""}
            </small>
            {annotation.quote && <blockquote>{annotation.quote}</blockquote>}
            <button disabled={!canJump} onClick={() => onJump(current)}>
              Go to passage
            </button>
            {entry && annotation.quote && !canJump && (
              <button onClick={() => onReattach(annotation)}>
                Reattach to selection
              </button>
            )}
            <button
              onClick={() =>
                onChange(items.filter((item) => item.id !== annotation.id))
              }
            >
              Delete
            </button>
          </article>
        );
      })}
      {!visible.length && <p>No unresolved comments or tasks.</p>}
    </section>
  );
}
