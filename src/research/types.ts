export type Source = {
  id: string;
  kind: "book" | "journal" | "website";
  title: string;
  shortTitle?: string;
  cslId?: string;
  /** One author per line, in natural given-name family-name order. */
  authors: string[];
  publisher?: string;
  year?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  url?: string;
  doi?: string;
  accessed?: string;
  website?: string;
  isbn?: string;
  /** Where a citation lookup found this record, e.g. "Found on Crossref". */
  lookupNote?: string;
};
export type ResearchNote = {
  id: string;
  kind: "quote" | "paraphrase" | "personal";
  text: string;
  sourceId?: string;
  locator?: string;
};
export type NoteForm = "auto" | "full" | "short";
export type Footnote = {
  id: string;
  text: string;
  sourceId?: string;
  locator?: string;
  shortened?: boolean;
  form?: NoteForm;
};
export type ResearchData = {
  sources: Source[];
  notes: ResearchNote[];
  footnotes: Footnote[];
  autoShortNotes?: boolean;
};
export type DocumentSettings = {
  font: "serif" | "sans" | "mono";
  fontSize: number;
  lineSpacing: number;
  marginInches: number;
  firstLineIndent: boolean;
  bibliography: boolean;
  pageNumbers: boolean;
};
export const defaultDocumentSettings: DocumentSettings = {
  font: "serif",
  fontSize: 12,
  lineSpacing: 2,
  marginInches: 1,
  firstLineIndent: true,
  bibliography: true,
  pageNumbers: true,
};
export const emptyResearch = (): ResearchData => ({
  sources: [],
  notes: [],
  footnotes: [],
  autoShortNotes: true,
});
