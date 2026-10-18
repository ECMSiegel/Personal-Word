import { words } from "../model";

export function cleanPastedQuote(raw: string): string {
  const joined = raw.replace(/-\r?\n\s*/g, "").replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  const pairs: Array<[string, string]> = [["\"", "\""], ["'", "'"], ["“", "”"], ["‘", "’"]];
  for (const [open, close] of pairs) {
    if (joined.startsWith(open) && joined.endsWith(close) && joined.length >= open.length + close.length)
      return joined.slice(open.length, -close.length).trim();
  }
  return joined;
}

export function quoteTextForStorage(raw: string): string {
  return raw.trim();
}

export function pasteIntoQuote(
  current: string,
  start: number,
  end: number,
  rawPaste: string,
): { text: string; caret: number } {
  const pasted = cleanPastedQuote(rawPaste);
  return {
    text: current.slice(0, start) + pasted + current.slice(end),
    caret: start + pasted.length,
  };
}

export function isBlockQuote(text: string): boolean {
  return words(text) >= 100;
}
