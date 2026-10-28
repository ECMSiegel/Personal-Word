import { Extension, Mark, Node, mergeAttributes } from "@tiptap/core";

export const TextFormat = Mark.create({
  name: "textFormat",
  addAttributes() {
    return {
      fontFamily: {
        default: null,
        parseHTML: (el) => el.style.fontFamily || null,
        renderHTML: (attrs) =>
          attrs.fontFamily ? { style: `font-family: ${attrs.fontFamily}` } : {},
      },
      fontSize: {
        default: null,
        parseHTML: (el) => el.style.fontSize || null,
        renderHTML: (attrs) =>
          attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[style]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },
});
export const ParagraphFormat = Extension.create({
  name: "paragraphFormat",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (el) => el.style.textAlign || null,
            renderHTML: (a) =>
              a.textAlign ? { style: `text-align: ${a.textAlign}` } : {},
          },
          paragraphStyle: {
            default: null,
            parseHTML: (el) => el.getAttribute("data-paragraph-style"),
            renderHTML: (a) =>
              a.paragraphStyle
                ? { "data-paragraph-style": a.paragraphStyle }
                : {},
          },
          firstLineIndent: {
            default: null,
            parseHTML: (el) => el.style.textIndent || null,
            renderHTML: (a) =>
              a.firstLineIndent !== null
                ? { style: `text-indent: ${a.firstLineIndent}` }
                : {},
          },
          indentLeft: {
            default: null,
            parseHTML: (el) => el.style.marginLeft || null,
            renderHTML: (a) =>
              a.indentLeft ? { style: `margin-left: ${a.indentLeft}` } : {},
          },
          indentRight: {
            default: null,
            parseHTML: (el) => el.style.marginRight || null,
            renderHTML: (a) =>
              a.indentRight ? { style: `margin-right: ${a.indentRight}` } : {},
          },
          lineHeight: {
            default: null,
            parseHTML: (el) => el.style.lineHeight || null,
            renderHTML: (a) =>
              a.lineHeight ? { style: `line-height: ${a.lineHeight}` } : {},
          },
          spaceBefore: {
            default: null,
            parseHTML: (el) => el.style.marginTop || null,
            renderHTML: (a) =>
              a.spaceBefore ? { style: `margin-top: ${a.spaceBefore}` } : {},
          },
          spaceAfter: {
            default: null,
            parseHTML: (el) => el.style.marginBottom || null,
            renderHTML: (a) =>
              a.spaceAfter ? { style: `margin-bottom: ${a.spaceAfter}` } : {},
          },
        },
      },
    ];
  },
});
export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: "div[data-page-break]" }];
  },
  renderHTML() {
    return [
      "div",
      {
        "data-page-break": "",
        class: "manual-page-break",
        "aria-label": "Page break",
      },
    ];
  },
});
export type PageLayout = {
  mode: "continuous" | "pages";
  paper: "letter" | "a4";
  margin: number;
  zoom: number;
};
export const defaultPageLayout: PageLayout = {
  mode: "continuous",
  paper: "letter",
  margin: 96,
  zoom: 100,
};
export function paperGeometry(layout: PageLayout) {
  const width = layout.paper === "a4" ? 793.7 : 816;
  const height = layout.paper === "a4" ? 1122.5 : 1056;
  const margin = Math.min(144, Math.max(24, layout.margin));
  return {
    width,
    height,
    margin,
    contentWidth: width - 2 * margin,
    contentHeight: height - 2 * margin,
    gap: 32,
  };
}
export const FootnoteReference = Node.create({
  name: "footnoteReference",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return {
      id: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-footnote-id"),
        renderHTML: (attrs) => ({ "data-footnote-id": attrs.id }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "sup[data-footnote-id]" }];
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("sup");
      dom.className = "footnote-reference";
      dom.dataset.footnoteId = node.attrs.id;
      dom.textContent = "※";
      dom.setAttribute("aria-label", "Footnote reference");
      return { dom };
    };
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "sup",
      mergeAttributes(HTMLAttributes, {
        class: "footnote-reference",
        "aria-label": "Footnote reference",
      }),
    ];
  },
});

export const screenplayStyles = [
  "scene",
  "action",
  "character",
  "dialogue",
  "parenthetical",
] as const;
export function screenplayAttributes(style: string) {
  const left =
    style === "character"
      ? "2.2in"
      : style === "dialogue"
        ? "1in"
        : style === "parenthetical"
          ? "1.5in"
          : "0";
  const right =
    style === "dialogue" ? "1in" : style === "parenthetical" ? "1.5in" : "0";
  return {
    paragraphStyle: style,
    lineHeight: "1",
    spaceBefore: "0pt",
    spaceAfter:
      style === "character" || style === "parenthetical" ? "0pt" : "12pt",
    firstLineIndent: "0",
    indentLeft: left,
    indentRight: right,
  };
}
