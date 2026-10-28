import "./shortcuts-settings.css";
import { useEffect, useState } from "react";
import { isModifierOnly, formatChord, parseChord } from "../shortcuts/chords";
import { ACTIONS, type ActionId } from "../shortcuts/registry";
import { chordFor, chordProblem, type ShortcutOverrides } from "../shortcuts/store";

type Props = {
  overrides: ShortcutOverrides;
  onChange: (next: ShortcutOverrides) => void;
};

export function ShortcutsSettings({ overrides, onChange }: Props) {
  const [recording, setRecording] = useState<ActionId | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!recording) return;
    const onKey = (event: KeyboardEvent) => {
      if (isModifierOnly(event)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        setRecording(null);
        setMessage("");
        return;
      }
      const chord = parseChord(event);
      const problem = chordProblem(recording, chord, overrides);
      if (problem) {
        setMessage(problem);
        return;
      }
      onChange({ ...overrides, [recording]: chord });
      setRecording(null);
      setMessage("");
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording, overrides, onChange]);

  const reset = (id: ActionId) => {
    const { [id]: _removed, ...rest } = overrides;
    onChange(rest);
  };

  return (
    <section className="shortcuts-settings" aria-label="Shortcuts">
      <h2>Shortcuts</h2>
      <ul>
        {ACTIONS.map((action) => (
          <li key={action.id} data-shortcut={action.id}>
            <span>{action.label}</span>
            <kbd className="shortcut-chord">
              {recording === action.id
                ? "Press keys…"
                : formatChord(chordFor(action.id, overrides))}
            </kbd>
            {action.readOnly ? null : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMessage("");
                    setRecording(recording === action.id ? null : action.id);
                  }}
                >
                  {recording === action.id ? "Cancel" : "Change"}
                </button>
                <button
                  type="button"
                  disabled={!overrides[action.id]}
                  onClick={() => reset(action.id)}
                >
                  Reset
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <p role="status">{message}</p>
      <button
        type="button"
        disabled={Object.keys(overrides).length === 0}
        onClick={() => {
          setRecording(null);
          setMessage("");
          onChange({});
        }}
      >
        Reset all
      </button>
    </section>
  );
}
