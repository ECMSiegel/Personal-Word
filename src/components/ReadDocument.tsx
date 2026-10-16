import type { JSONContent } from "@tiptap/react";
import type { ReactNode } from "react";
export function ReadDocument({
  content,
  numbers,
}: {
  content: JSONContent;
  numbers: Record<string, number>;
}) {
  function render(node: JSONContent, key: string): ReactNode {
    if (node.type === "text") {
      let value: ReactNode = node.text ?? "";
      for (const mark of node.marks ?? []) {
        if (mark.type === "bold") value = <strong>{value}</strong>;
        if (mark.type === "italic") value = <em>{value}</em>;
        if (mark.type === "underline") value = <u>{value}</u>;
        if (mark.type === "strike") value = <s>{value}</s>;
        if (mark.type === "link" && /^https?:\/\//.test(mark.attrs?.href ?? ""))
          value = (
            <a href={mark.attrs!.href} target="_blank" rel="noreferrer">
              {value}
            </a>
          );
      }
      return <span key={key}>{value}</span>;
    }
    const children = node.content?.map((n, i) => render(n, key + "." + i));
    switch (node.type) {
      case "paragraph":
        return <p key={key}>{children ?? <br />}</p>;
      case "heading":
        return node.attrs?.level === 1 ? (
          <h2 key={key}>{children}</h2>
        ) : (
          <h3 key={key}>{children}</h3>
        );
      case "bulletList":
        return <ul key={key}>{children}</ul>;
      case "orderedList":
        return (
          <ol key={key} start={node.attrs?.start ?? 1}>
            {children}
          </ol>
        );
      case "listItem":
        return <li key={key}>{children}</li>;
      case "blockquote":
        return <blockquote key={key}>{children}</blockquote>;
      case "hardBreak":
        return <br key={key} />;
      case "horizontalRule":
        return <hr key={key} />;
      case "footnoteReference":
        return <sup key={key}>{numbers[node.attrs?.id] ?? "?"}</sup>;
      case "pageBreak":
        return null;
      default:
        return <span key={key}>{children}</span>;
    }
  }
  return <>{content.content?.map((n, i) => render(n, String(i)))}</>;
}
