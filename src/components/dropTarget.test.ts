import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DropTarget,
  dragReducer,
  firstRejection,
  hasFiles,
  idleDrag,
  itemsFromPaths,
  itemsFromTransfer,
  verdict,
} from "./DropTarget";
import type { Accept, DropItem } from "./DropTarget";

const pdfOnly: Accept = (f) =>
  f.name && !f.name.toLowerCase().endsWith(".pdf") ? "Only PDF files." : f.size > 100 ? "Too large." : null;
const pdf: DropItem = { name: "a.pdf", size: 10, type: "application/pdf" };
const txt: DropItem = { name: "a.txt", size: 10, type: "text/plain" };

describe("drag state machine", () => {
  it("is idle until a drag enters, then back when depth returns to 0", () => {
    expect(verdict(idleDrag, pdfOnly).state).toBe("idle");
    let s = dragReducer(idleDrag, { type: "enter", items: [pdf] });
    s = dragReducer(s, { type: "enter", items: [] }); // child element enter
    expect(s.depth).toBe(2);
    expect(verdict(s, pdfOnly).state).toBe("accept");
    s = dragReducer(s, { type: "leave" });
    expect(verdict(s, pdfOnly).state).toBe("accept");
    s = dragReducer(s, { type: "leave" });
    expect(s).toEqual(idleDrag);
    expect(dragReducer(s, { type: "leave" })).toEqual(idleDrag);
  });
  it("rejects when any item fails, with the first reason", () => {
    const s = dragReducer(idleDrag, { type: "enter", items: [pdf, txt] });
    expect(verdict(s, pdfOnly)).toEqual({ state: "reject", reason: "Only PDF files." });
  });
  it("end resets", () => {
    const s = dragReducer(idleDrag, { type: "enter", items: [txt] });
    expect(dragReducer(s, { type: "end" })).toEqual(idleDrag);
  });
  it("native paths carry the base name and no size", () => {
    expect(itemsFromPaths(["/Users/x/a.pdf", "C:\\b\\c.txt"])).toEqual([
      { name: "a.pdf", size: 0, type: "" },
      { name: "c.txt", size: 0, type: "" },
    ]);
    expect(firstRejection(itemsFromPaths(["/x/a.txt"]), pdfOnly)).toBe("Only PDF files.");
    expect(firstRejection(itemsFromPaths(["/x/huge.pdf"]), pdfOnly)).toBeNull();
  });
  it("reads fake drag events: names hidden during the drag, real on drop", () => {
    const during = { types: ["Files"], files: [], items: [{ kind: "file", type: "application/pdf" }] };
    expect(hasFiles(during as unknown as DataTransfer)).toBe(true);
    expect(itemsFromTransfer(during as unknown as DataTransfer)).toEqual([
      { name: "", size: 0, type: "application/pdf" },
    ]);
    const dropped = { types: ["Files"], files: [{ name: "b.txt", size: 3, type: "text/plain" }], items: [] };
    expect(itemsFromTransfer(dropped as unknown as DataTransfer)).toEqual([
      { name: "b.txt", size: 3, type: "text/plain" },
    ]);
    expect(hasFiles({ types: ["text/plain"] } as unknown as DataTransfer)).toBe(false);
  });
});

describe("DropTarget markup", () => {
  it("renders the keyboard path and no state at rest", () => {
    const html = renderToStaticMarkup(
      React.createElement(DropTarget, { accept: pdfOnly, onFiles: () => {}, label: "Drop to attach" }, "body"),
    );
    expect(html).toContain('class="select-files"');
    expect(html).toContain("Select files");
    expect(html).toContain('type="file"');
    expect(html).not.toContain("data-state");
    expect(html).not.toContain("drop-target-label");
  });
});
