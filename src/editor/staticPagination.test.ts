import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { planPages } from "./pagination";
import { measureStatic, paginateStatic, unpaginateStatic } from "./staticPagination";

// A small fake DOM (vitest runs without one): elements with fixed client
// rects, and text nodes laid out as lines of `perLine` characters, each line
// `lineHeight` tall, starting at `top`. Rects never move: the layout measured
// is always the unpaginated one, which is what paginateStatic measures.
type Rect = { top: number; height: number };
const rect = (r: Rect) => ({ top: r.top, bottom: r.top + r.height, height: r.height, width: 100, left: 0, right: 100 });

class FakeText {
  nodeType = 3;
  parentNode: FakeEl | null = null;
  constructor(
    public data: string,
    public layout: { top: number; perLine: number; lineHeight: number; start: number },
  ) {}
  get parentElement() {
    return this.parentNode;
  }
  get previousSibling() {
    return sibling(this, -1);
  }
  get nextSibling() {
    return sibling(this, 1);
  }
  splitText(offset: number) {
    const tail = new FakeText(this.data.slice(offset), { ...this.layout, start: this.layout.start + offset });
    this.data = this.data.slice(0, offset);
    this.parentNode!.insertBefore(tail, this.nextSibling);
    return tail;
  }
  appendData(more: string) {
    this.data += more;
  }
  remove() {
    this.parentNode?.removeChild(this);
  }
  /** Client rects of characters [from, to): one per line touched. */
  rects(from: number, to: number) {
    const { top, perLine, lineHeight, start } = this.layout;
    const out: ReturnType<typeof rect>[] = [];
    let line = -1;
    for (let k = from; k < to; k++) {
      const l = Math.floor((start + k) / perLine);
      if (l !== line) out.push(rect({ top: top + l * lineHeight, height: lineHeight }));
      line = l;
    }
    return out;
  }
}

type Node = FakeEl | FakeText;
function sibling(node: Node, step: number) {
  const list = node.parentNode?.childNodes ?? [];
  return list[list.indexOf(node) + step] ?? null;
}

class FakeEl {
  nodeType = 1;
  parentNode: FakeEl | null = null;
  childNodes: Node[] = [];
  className = "";
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  attributes: Record<string, string> = {};
  offsetWidth = 0;
  ownerDocument = fakeDocument;
  constructor(
    public tagName: string,
    public box: Rect = { top: 0, height: 0 },
  ) {}
  get classList() {
    return { contains: (name: string) => this.className.split(" ").includes(name) };
  }
  get children() {
    return this.childNodes.filter((n): n is FakeEl => n instanceof FakeEl);
  }
  get parentElement() {
    return this.parentNode;
  }
  get previousSibling() {
    return sibling(this, -1);
  }
  get nextSibling() {
    return sibling(this, 1);
  }
  append(...nodes: Node[]) {
    for (const n of nodes) this.insertBefore(n, null);
    return this;
  }
  insertBefore(node: Node, ref: Node | null) {
    node.parentNode?.removeChild(node);
    const at = ref ? this.childNodes.indexOf(ref) : this.childNodes.length;
    this.childNodes.splice(at, 0, node);
    node.parentNode = this;
    return node;
  }
  removeChild(node: Node) {
    this.childNodes.splice(this.childNodes.indexOf(node), 1);
    node.parentNode = null;
    return node;
  }
  remove() {
    this.parentNode?.removeChild(this);
  }
  setAttribute(name: string, value: string) {
    this.attributes[name] = value;
  }
  getBoundingClientRect() {
    return rect(this.box);
  }
  closest(selector: string): FakeEl | null {
    for (let el: FakeEl | null = this; el; el = el.parentNode)
      if (el.tagName.toLowerCase() === selector) return el;
    return null;
  }
  contains(node: Node | null): boolean {
    for (let n = node; n; n = n.parentNode) if (n === this) return true;
    return false;
  }
  /** Only the selector paginateStatic uses: `.page-spacer[data-static]`. */
  querySelectorAll(selector: string) {
    expect(selector).toBe(".page-spacer[data-static]");
    const out: FakeEl[] = [];
    const walk = (el: FakeEl) =>
      el.children.forEach((c) => {
        if (c.classList.contains("page-spacer") && c.dataset.static !== undefined) out.push(c);
        walk(c);
      });
    walk(this);
    return out;
  }
}

const textsIn = (root: FakeEl): FakeText[] =>
  root.childNodes.flatMap((n) => (n instanceof FakeText ? [n] : textsIn(n)));

const fakeDocument = {
  createElement: (tag: string) => new FakeEl(tag),
  createRange: () => {
    let node: FakeText;
    let from = 0;
    let to = 0;
    return {
      selectNodeContents(n: FakeText) {
        node = n;
        from = 0;
        to = n.data.length;
      },
      setStart(n: FakeText, k: number) {
        node = n;
        from = k;
      },
      setEnd(_n: FakeText, k: number) {
        to = k;
      },
      getClientRects: () => node.rects(from, to),
    };
  },
  createTreeWalker: (root: FakeEl) => {
    const list = textsIn(root);
    let i = -1;
    return { nextNode: () => list[++i] ?? null };
  },
};

/** Tag, class, data and text of the tree, for exact before/after comparison. */
function serialise(node: Node): string {
  if (node instanceof FakeText) return JSON.stringify(node.data);
  const data = Object.entries(node.dataset).map(([k, v]) => ` data-${k}="${v}"`).join("");
  return `<${node.tagName}${node.className ? ` class="${node.className}"` : ""}${data}${node.style.height ? ` h=${node.style.height}` : ""}>${node.childNodes.map(serialise).join("")}</${node.tagName}>`;
}

const GEOMETRY = { pageHeight: 100, gap: 10, margin: 10, reserve: 0 };
const para = (top: number, lines: number, perLine = 10) => {
  const p = new FakeEl("P", { top, height: lines * 20 });
  p.append(new FakeText("x".repeat(lines * perLine), { top, perLine, lineHeight: 20, start: 0 }));
  return p;
};

/**
 * Content height 80, pitch 110. A heading (0-20), a two-line paragraph
 * (20-60), a three-line paragraph (60-120) that cannot split and moves whole,
 * and a six-line paragraph (120-240) that moves whole to page 2 and then
 * splits after four lines onto page 3.
 */
function tree() {
  const surface = new FakeEl("DIV", { top: 0, height: 240 });
  const title = new FakeEl("BUTTON", { top: 0, height: 20 });
  title.className = "read-title";
  title.append(new FakeText("Title", { top: 0, perLine: 10, lineHeight: 20, start: 0 }));
  surface.append(title, para(20, 2), para(60, 3), para(120, 6));
  return surface;
}

beforeEach(() => {
  vi.stubGlobal("getComputedStyle", () => ({ marginTop: "0px", marginBottom: "0px", zoom: "1" }));
  vi.stubGlobal("NodeFilter", { SHOW_TEXT: 4 });
  vi.stubGlobal("document", fakeDocument);
});
afterEach(() => vi.unstubAllGlobals());

describe("measureStatic", () => {
  it("returns one box per direct child, headings for .read-title and h1-h3, lines for paragraphs only", () => {
    const surface = tree();
    const h2 = new FakeEl("H2", { top: 240, height: 20 });
    surface.append(h2);
    const blocks = measureStatic(surface as unknown as HTMLElement);
    expect(blocks.map((b) => [b.pos, b.top, b.height, b.heading, !!b.lines, b.spacer, b.pageBreak])).toEqual([
      [0, 0, 20, true, false, false, false],
      [1, 20, 40, false, true, false, false],
      [2, 60, 60, false, true, false, false],
      [3, 120, 120, false, true, false, false],
      [4, 240, 20, true, false, false, false],
    ]);
    expect(blocks[3].lines!()).toEqual([0, 20, 40, 60, 80, 100]);
  });
});

describe("paginateStatic", () => {
  it("inserts the spacers planPages plans: before a block, and inside a paragraph at the moving line", () => {
    const surface = tree();
    const plan = planPages(measureStatic(surface as unknown as HTMLElement), GEOMETRY);
    expect(plan.boundaries).toEqual([
      { pos: 2, height: 50, split: 30 },
      { pos: 3, height: 50, split: 30 },
      { pos: 3, line: 4, height: 30, split: 10 },
    ]);
    const pages = paginateStatic(surface as unknown as HTMLElement, GEOMETRY);
    expect(pages).toBe(plan.pageCount);
    expect(pages).toBe(4);
    const kids = surface.childNodes as FakeEl[];
    expect(kids.map((k) => k.className || k.tagName)).toEqual([
      "read-title", "P", "page-spacer", "P", "page-spacer", "P",
    ]);
    expect([kids[2].style.height, kids[4].style.height]).toEqual(["50px", "50px"]);
    // The six-line paragraph: four lines, a 30 px spacer, two lines.
    const last = kids[5];
    expect(last.childNodes.map((n) => (n instanceof FakeText ? n.data.length : (n as FakeEl).style.height))).toEqual([40, "30px", 20]);
    expect((last.childNodes[1] as FakeEl).attributes["aria-hidden"]).toBe("true");
  });

  it("removes its spacers exactly: the DOM equals the original, and a second pass gives the same DOM", () => {
    const surface = tree();
    const before = serialise(surface);
    const firstText = textsIn(surface)[3];
    paginateStatic(surface as unknown as HTMLElement, GEOMETRY);
    const paged = serialise(surface);
    expect(paged).not.toBe(before);
    unpaginateStatic(surface as unknown as HTMLElement);
    expect(serialise(surface)).toBe(before);
    // The split text node was joined back into the original node (React keeps a reference to it).
    expect(textsIn(surface)[3]).toBe(firstText);
    expect(firstText.data.length).toBe(60);
    paginateStatic(surface as unknown as HTMLElement, GEOMETRY);
    expect(serialise(surface)).toBe(paged);
    paginateStatic(surface as unknown as HTMLElement, GEOMETRY);
    expect(serialise(surface)).toBe(paged);
  });

  it("splits a paragraph twice in the same text node when it runs over two page ends", () => {
    const surface = new FakeEl("DIV", { top: 0, height: 200 });
    surface.append(para(0, 10));
    paginateStatic(surface as unknown as HTMLElement, GEOMETRY);
    const p = surface.children[0];
    expect(p.childNodes.map((n) => (n instanceof FakeText ? n.data.length : "spacer"))).toEqual([40, "spacer", 40, "spacer", 20]);
    unpaginateStatic(surface as unknown as HTMLElement);
    expect(p.childNodes.map((n) => (n as FakeText).data.length)).toEqual([100]);
  });
});
