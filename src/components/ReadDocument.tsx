import type { JSONContent } from "@tiptap/react";
import { useEffect, useState, type ReactNode } from "react";

function ReadImage({
  node,
  resolveAsset,
}: {
  node: JSONContent;
  resolveAsset?: (id: string) => Promise<string | null>;
}) {
  const assetId = node.attrs?.assetId as string | undefined;
  const alt = (node.attrs?.alt as string | undefined) ?? "";
  const title = (node.attrs?.title as string | null | undefined) ?? null;
  const width = node.attrs?.width as number | null | undefined;
  const height = node.attrs?.height as number | null | undefined;
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!assetId || !resolveAsset) {
      setSrc(null);
      return;
    }
    resolveAsset(assetId).then(
      (url) => {
        if (alive) setSrc(url);
      },
      () => {
        if (alive) setSrc(null);
      },
    );
    return () => {
      alive = false;
    };
  }, [assetId, resolveAsset]);

  return (
    <figure className="doc-image" data-asset-id={assetId}>
      {src ? (
        <img
          src={src}
          alt={alt}
          title={title ?? undefined}
          width={width ?? undefined}
          height={height ?? undefined}
        />
      ) : (
        <span className="doc-image-alt">{alt || "Image"}</span>
      )}
    </figure>
  );
}

export function ReadDocument({
  content,
  numbers,
  resolveAsset,
}: {
  content: JSONContent;
  numbers: Record<string, number>;
  resolveAsset?: (id: string) => Promise<string | null>;
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
      case "image":
        return <ReadImage key={key} node={node} resolveAsset={resolveAsset} />;
      case "table":
        return (
          <table key={key}>
            <tbody>{children}</tbody>
          </table>
        );
      case "tableRow":
        return <tr key={key}>{children}</tr>;
      case "tableHeader":
        return (
          <th
            key={key}
            colSpan={
              typeof node.attrs?.colspan === "number" && node.attrs.colspan > 1
                ? node.attrs.colspan
                : undefined
            }
            rowSpan={
              typeof node.attrs?.rowspan === "number" && node.attrs.rowspan > 1
                ? node.attrs.rowspan
                : undefined
            }
          >
            {children}
          </th>
        );
      case "tableCell":
        return (
          <td
            key={key}
            colSpan={
              typeof node.attrs?.colspan === "number" && node.attrs.colspan > 1
                ? node.attrs.colspan
                : undefined
            }
            rowSpan={
              typeof node.attrs?.rowspan === "number" && node.attrs.rowspan > 1
                ? node.attrs.rowspan
                : undefined
            }
          >
            {children}
          </td>
        );
      default:
        return <span key={key}>{children}</span>;
    }
  }
  return <>{content.content?.map((n, i) => render(n, String(i)))}</>;
}
