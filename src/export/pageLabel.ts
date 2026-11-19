import type { DocumentSettings, PageNumberPosition } from "../research/types";

/** What one page shows in its corner: header text, page number, both or nothing. */
export function pageLabel(
  s: Pick<DocumentSettings, "pageNumbers" | "pageHeaderText" | "pageFirstDifferent">,
  templateId: string | undefined,
  pageIndex: number,
): string | null {
  const text = (s.pageHeaderText ?? "").trim();
  if (!s.pageNumbers && !text) return null;
  if (pageIndex === 0 && (templateId === "chicago" || s.pageFirstDifferent)) return null;
  const number = s.pageNumbers
    ? String(templateId === "chicago" ? pageIndex : pageIndex + 1)
    : "";
  return [text, number].filter(Boolean).join(" ");
}

export function pageLabelPosition(
  s: Pick<DocumentSettings, "pageNumberPosition">,
): PageNumberPosition {
  return s.pageNumberPosition ?? "bottom-right";
}
