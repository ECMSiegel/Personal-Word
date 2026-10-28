import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
} from "react";

export type FootnoteNote = {
  id: string;
  number: number;
  text: string;
  citation: string;
  editable: boolean;
  /** True when the note cites a source; those keep native Backspace behaviour. */
  sourced: boolean;
};

type NoteHandlers = {
  editingId: string | null;
  onEdit: (id: string) => void;
  onEditEnd: () => void;
  onTextChange?: (id: string, text: string) => void;
  onSourceDetails?: (id: string) => void;
  /** Removes the marker and the empty record of a source-less note. */
  onDeleteEmpty?: (id: string) => void;
};

/** Note rule plus rows. Used for the continuous footer and each page's footer. */
export function FootnoteBlock({
  notes,
  className,
  label,
  style,
  ...handlers
}: NoteHandlers & {
  notes: FootnoteNote[];
  className: string;
  label: string;
  style?: CSSProperties;
}) {
  return (
    <div className={className} role="region" aria-label={label} style={style}>
      <div className="footnote-rule" aria-hidden="true" />
      <FootnoteRows notes={notes} {...handlers} />
    </div>
  );
}

/** Off-screen copy of the note rows, used only to measure heights. */
export function FootnoteRows({
  notes,
  measuring = false,
  ...handlers
}: NoteHandlers & { notes: FootnoteNote[]; measuring?: boolean }) {
  return (
    <div className="footnote-list">
      {notes.map((note) => (
        <FootnoteRow
          key={note.id}
          note={note}
          measuring={measuring}
          {...handlers}
        />
      ))}
    </div>
  );
}

function FootnoteRow({
  note,
  measuring,
  editingId,
  onEdit,
  onEditEnd,
  onTextChange,
  onSourceDetails,
  onDeleteEmpty,
}: NoteHandlers & { note: FootnoteNote; measuring: boolean }) {
  const editing = editingId === note.id;
  const open = () => {
    if (measuring) return;
    if (note.editable) onEdit(note.id);
    else onSourceDetails?.(note.id);
  };
  return (
    <div
      className={"footnote-row" + (editing ? " is-editing" : "")}
      data-note-id={note.id}
    >
      <sup className="footnote-number">{note.number}</sup>
      {editing && !measuring ? (
        <FootnoteTextarea
          note={note}
          onTextChange={onTextChange}
          onDone={onEditEnd}
          onDeleteEmpty={onDeleteEmpty}
        />
      ) : (
        <div
          className="footnote-body"
          role={measuring ? undefined : "button"}
          tabIndex={measuring ? -1 : 0}
          title={measuring ? undefined : "Edit footnote"}
          onClick={open}
          onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            open();
          }}
        >
          {editing ? note.text || " " : note.citation}
        </div>
      )}
      {!measuring && (
        <button
          type="button"
          className="footnote-source"
          onClick={() => onSourceDetails?.(note.id)}
        >
          Source details
        </button>
      )}
    </div>
  );
}

function FootnoteTextarea({
  note,
  onTextChange,
  onDone,
  onDeleteEmpty,
}: {
  note: FootnoteNote;
  onTextChange?: (id: string, text: string) => void;
  onDone: () => void;
  onDeleteEmpty?: (id: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [note.text]);
  return (
    <textarea
      ref={ref}
      className="footnote-input"
      aria-label={`Footnote ${note.number} text`}
      rows={1}
      value={note.text}
      autoFocus
      onChange={(event) => onTextChange?.(note.id, event.target.value)}
      onBlur={onDone}
      onKeyDown={(event) => {
        // An empty note that cites nothing has no text to edit: Backspace
        // removes its marker and empty record together. Cited notes keep the
        // native behaviour.
        if (
          event.key === "Backspace" &&
          note.text === "" &&
          !note.sourced &&
          onDeleteEmpty
        ) {
          event.preventDefault();
          onDeleteEmpty(note.id);
          return;
        }
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.currentTarget.blur();
      }}
    />
  );
}
