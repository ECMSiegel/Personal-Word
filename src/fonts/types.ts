// Shared font types (wave 9). C2, C3, C4, C6 and C7 build against these.

export type FontStyle = "regular" | "bold" | "italic" | "boldItalic";

export type UserFont = {
  id: string;
  family: string;
  style: FontStyle;
  fileName: string;
  format: "ttf" | "otf";
};

export type FontFile = {
  bytes: Uint8Array;
  postscriptName: string;
  collection: boolean;
};
