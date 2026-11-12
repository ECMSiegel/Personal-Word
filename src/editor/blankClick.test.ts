import { describe, expect, it, vi } from "vitest";
import { getSchema } from "@tiptap/core";
import { EditorState, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { documentExtensions } from "./extensions";
import { blankPageClick } from "./blankClick";

const viewWith = (contains: (node: unknown) => boolean) =>
  ({ dom: { contains } }) as unknown as EditorView;

const click = (overrides: Partial<MouseEvent> = {}) =>
  ({
    button: 0,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    target: {},
    ...overrides,
  }) as MouseEvent;

const targetWithClosest = (matchedSelector: string) => ({
  closest: vi.fn((selector: string) => (selector.includes(matchedSelector) ? {} : null)),
});

describe("blankPageClick target decisions", () => {
  it.each([
    ["non-primary button", { button: 1 }],
    ["Control", { ctrlKey: true }],
    ["Command", { metaKey: true }],
    ["Option", { altKey: true }],
  ])("ignores %s", (_label, overrides) => {
    const view = viewWith(() => false);
    expect(blankPageClick(view, click(overrides))).toBe(false);
  });

  it("leaves descendants of the editor to ProseMirror", () => {
    const child = {};
    const view = viewWith((node) => node === child);
    expect(blankPageClick(view, click({ target: child as unknown as EventTarget }))).toBe(false);
  });

  it.each([
    ["document ruler", ".document-ruler"],
    ["side ruler", ".side-ruler"],
    ["page spacer", ".page-spacer"],
    ["footnote marker", "[data-footnote-id]"],
    ["page footnotes", ".page-footnotes"],
    ["footnote area", ".footnote-area"],
    ["role button", "[role='button']"],
    ["button", "button"],
    ["link", "a"],
    ["input", "input"],
    ["textarea", "textarea"],
    ["select", "select"],
    ["slider", "[role='slider']"],
  ])("ignores a click inside a %s", (_label, selector) => {
    const target = targetWithClosest(selector);
    const view = viewWith(() => false);
    expect(blankPageClick(view, click({ target: target as unknown as EventTarget }))).toBe(false);
    expect(target.closest).toHaveBeenCalled();
  });
});

// Native WebKit reports rects inside the CSS-zoomed page in drawn / zoom, while the click's
// clientX/clientY are drawn px (owner's Mac app, 150% zoom, 2026-11-11: a click in the left
// margin beside line two put the caret at the end of the document).
describe("blankPageClick under WebKit's unzoomed rects", () => {
  const rectOf = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom });

  it("compares the click with drawn rects, so a margin click beside a middle line is not 'below the text'", async () => {
    vi.resetModules();
    vi.doMock("../components/floating", () => ({ reportsUnzoomedRects: () => true, totalZoom: () => 1.5 }));
    const { blankPageClick: zoomedClick } = await import("./blankClick");
    const posAtCoords = vi.fn(() => ({ pos: 7, inside: -1 }));
    const setSelection = vi.fn(() => ({ scrollIntoView: () => "tr" }));
    const doc = { content: { size: 40 }, resolve: (pos: number) => ({ pos, parent: { inlineContent: true }, min: () => pos, max: () => pos, depth: 1 }) };
    const view = {
      dom: {
        contains: () => false,
        // Unzoomed: drawn is x1.5, so the text column is drawn at 150..750 x 150..300.
        getBoundingClientRect: () => rectOf(100, 100, 500, 200),
        lastElementChild: { getBoundingClientRect: () => rectOf(100, 170, 500, 190) }, // drawn bottom 285
      },
      state: { doc, selection: { anchor: 1 }, tr: { setSelection } },
      posAtCoords,
      dispatch: vi.fn(),
      focus: vi.fn(),
    } as unknown as EditorView;
    const event = click({ clientX: 120, clientY: 225, preventDefault: vi.fn() } as Partial<MouseEvent>);

    expect(zoomedClick(view, event)).toBe(true);
    // Left of the drawn column: clamped just inside it, on the clicked line.
    expect(posAtCoords).toHaveBeenCalledWith({ left: 151, top: 225 });
    vi.doUnmock("../components/floating");
  });

  // Native run T278 (2026-11-11): ProseMirror's posAtCoords also compares WebKit's drawn / zoom block
  // rects with drawn px and answers "after paragraph 2" for a margin click beside line 2. Under zoom the
  // handler takes the caret from caretRangeFromPoint (drawn px) instead.
  it("under zoom takes the position from caretRangeFromPoint at the clamped point, not posAtCoords", async () => {
    vi.resetModules();
    vi.doMock("../components/floating", () => ({ reportsUnzoomedRects: () => true, totalZoom: () => 1.5 }));
    const { blankPageClick: zoomedClick } = await import("./blankClick");
    const textNode = { nodeType: 3 };
    const caretRangeFromPoint = vi.fn(() => ({ startContainer: textNode, startOffset: 0 }));
    const posAtCoords = vi.fn(() => ({ pos: 53, inside: -1 }));
    const posAtDOM = vi.fn(() => 27);
    const setSelection = vi.fn(() => ({ scrollIntoView: () => "tr" }));
    const doc = { content: { size: 112 }, resolve: (pos: number) => ({ pos, parent: { inlineContent: true }, min: () => pos, max: () => pos, depth: 1 }) };
    const view = {
      dom: {
        contains: (node: unknown) => node === textNode,
        ownerDocument: { caretRangeFromPoint },
        getBoundingClientRect: () => rectOf(100, 100, 500, 200),
        lastElementChild: { getBoundingClientRect: () => rectOf(100, 170, 500, 190) },
      },
      state: { doc, selection: { anchor: 1 }, tr: { setSelection } },
      posAtCoords,
      posAtDOM,
      dispatch: vi.fn(),
      focus: vi.fn(),
    } as unknown as EditorView;
    const event = click({ clientX: 120, clientY: 225, preventDefault: vi.fn() } as Partial<MouseEvent>);

    expect(zoomedClick(view, event)).toBe(true);
    expect(caretRangeFromPoint).toHaveBeenCalledWith(151, 225);
    expect(posAtDOM).toHaveBeenCalledWith(textNode, 0);
    expect(posAtCoords).not.toHaveBeenCalled();
    expect((setSelection.mock.calls[0] as unknown[])[0]).toMatchObject({ $head: { pos: 27 } });
    vi.doUnmock("../components/floating");
  });

  // Review S3: Chromium (rects already drawn) and WebKit at zoom 1 keep the old posAtCoords path.
  it.each([
    ["Chromium", false, 1.5],
    ["WebKit at zoom 1", true, 1],
  ])("%s does not take the caretRangeFromPoint branch", async (_label, unzoomed, zoom) => {
    vi.resetModules();
    vi.doMock("../components/floating", () => ({ reportsUnzoomedRects: () => unzoomed, totalZoom: () => zoom }));
    const { blankPageClick: plainClick } = await import("./blankClick");
    const caretRangeFromPoint = vi.fn(() => ({ startContainer: {}, startOffset: 0 }));
    const posAtCoords = vi.fn(() => ({ pos: 7, inside: -1 }));
    const setSelection = vi.fn(() => ({ scrollIntoView: () => "tr" }));
    const doc = { content: { size: 40 }, resolve: (pos: number) => ({ pos, parent: { inlineContent: true }, min: () => pos, max: () => pos, depth: 1 }) };
    const view = {
      dom: {
        contains: () => true,
        ownerDocument: { caretRangeFromPoint },
        getBoundingClientRect: () => rectOf(100, 100, 500, 200),
        lastElementChild: { getBoundingClientRect: () => rectOf(100, 170, 500, 190) },
      },
      state: { doc, selection: { anchor: 1 }, tr: { setSelection } },
      posAtCoords,
      posAtDOM: vi.fn(() => 3),
      dispatch: vi.fn(),
      focus: vi.fn(),
    } as unknown as EditorView;
    // The target must not count as inside the editor, so give it its own object.
    const event = click({ clientX: 120, clientY: 150, target: { closest: () => null } as unknown as EventTarget, preventDefault: vi.fn() } as Partial<MouseEvent>);
    (view.dom as unknown as { contains: (n: unknown) => boolean }).contains = (n) => n !== event.target;

    expect(plainClick(view, event)).toBe(true);
    expect(caretRangeFromPoint).not.toHaveBeenCalled();
    expect(posAtCoords).toHaveBeenCalledWith({ left: 120, top: 150 });
    vi.doUnmock("../components/floating");
  });

  // Review S1: a position between blocks (page-gap widget, image, the zoom fallback) is moved to the nearest text.
  it("never places a TextSelection between blocks", async () => {
    vi.resetModules();
    vi.doMock("../components/floating", () => ({ reportsUnzoomedRects: () => true, totalZoom: () => 1.5 }));
    const { blankPageClick: zoomedClick } = await import("./blankClick");
    const schema = getSchema(documentExtensions());
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [schema.text("one")]),
      schema.node("paragraph", null, [schema.text("two")]),
    ]);
    let state = EditorState.create({ doc });
    const textNode = { nodeType: 3 };
    const dispatched: Transaction[] = [];
    const view = {
      dom: {
        contains: (node: unknown) => node === textNode,
        ownerDocument: { caretRangeFromPoint: () => ({ startContainer: textNode, startOffset: 0 }) },
        getBoundingClientRect: () => rectOf(100, 100, 500, 200),
        lastElementChild: { getBoundingClientRect: () => rectOf(100, 170, 500, 190) },
      },
      get state() {
        return state;
      },
      posAtCoords: vi.fn(() => ({ pos: 5, inside: -1 })),
      posAtDOM: vi.fn(() => 5), // between the two paragraphs
      dispatch: (tr: Transaction) => {
        dispatched.push(tr);
        state = state.apply(tr);
      },
      focus: vi.fn(),
    } as unknown as EditorView;
    const event = click({ clientX: 120, clientY: 225, preventDefault: vi.fn() } as Partial<MouseEvent>);

    expect(zoomedClick(view, event)).toBe(true);
    const selection = dispatched[0]!.selection;
    expect(selection.$head.parent.type.name).toBe("paragraph");
    expect(selection.head).toBe(4);
    vi.doUnmock("../components/floating");
  });
});
