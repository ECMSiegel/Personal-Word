// Shortcut hints shown right-aligned and muted in menus, keyed by the
// control's aria-label. Only shortcuts the editor really installs are listed.
export const SHORTCUTS: Record<string, string> = {
  Undo: "⌘Z",
  Redo: "⇧⌘Z",
  "Bold (⌘B)": "⌘B",
  "Italic (⌘I)": "⌘I",
  "Underline (⌘U)": "⌘U",
  Strikethrough: "⇧⌘S",
  "Bullet list": "⇧⌘8",
  "Numbered list": "⇧⌘7",
  "Block quote": "⇧⌘B",
  "Focus mode": "⇧⌘F",
  "Keep as fragment": "⇧⌘X",
  "Normal text": "⌥⌘0",
  "Heading 1": "⌥⌘1",
  "Heading 2": "⌥⌘2",
};

/** The visible label for an aria-label: drops a trailing " (…)" shortcut. */
export function visibleLabel(ariaLabel: string): string {
  return ariaLabel.replace(/\s*\([^()]*\)$/, "");
}
