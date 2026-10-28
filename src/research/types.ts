export const sourceKinds = ["book", "journal", "website", "chapter", "thesis", "report", "conference", "newspaper", "interview", "media", "other"] as const;
export type SourceCreator = { role: string; given?: string; family?: string; literal?: string; suffix?: string };
export type Source = {
  id: string;
  kind: typeof sourceKinds[number];
  title: string;
  shortTitle?: string;
  cslId?: string;
  edition?: string;
  creators?: SourceCreator[];
  /** Original imported fields, kept as data and never spread into a model object. */
  cslData?: Record<string, unknown>;
  container?: string;
  institution?: string;
  event?: string;
  publishedDate?: string;
  manualFull?: string;
  manualShort?: string;
  manualBibliography?: string;
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
  /** One attached PDF: bytes live in the project's asset store under assetId. */
  pdf?: { assetId: string; name: string; byteLength: number };
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
/** Opt-in repeat-citation rules. Absent keeps the legacy autoShortNotes behavior. */
export type CitationPolicy = {
  /** "section" restarts first full citations at each manuscript entry. */
  scope: "manuscript" | "section";
  repeats: "short" | "ibid";
};
export type ResolvedNoteForm = "full" | "short" | "ibid";
export type ResearchData = {
  sources: Source[];
  notes: ResearchNote[];
  footnotes: Footnote[];
  autoShortNotes?: boolean;
  citationPolicy?: CitationPolicy;
};
export type DocumentSettings = {
  font: "serif" | "sans" | "mono";
  fontSize: number;
  lineSpacing: number;
  marginInches: number;
  firstLineIndent: boolean;
  bibliography: boolean;
  pageNumbers: boolean;
  bibliographyOrder?: "author" | "cited" | "type";
  bibliographyScope?: "cited" | "all";
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
