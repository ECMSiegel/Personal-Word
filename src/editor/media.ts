import { Node, mergeAttributes } from "@tiptap/core";

const ASSET_ID = /^[0-9a-f]{64}$/;
export const isAssetId = (value: unknown): value is string =>
  typeof value === "string" && ASSET_ID.test(value);

export type ImageAttrs = {
  assetId: string;
  alt?: string;
  title?: string | null;
  width?: number | null;
  height?: number | null;
};

/** Turns a stored asset id into a displayable (object) URL; null when the bytes are missing. */
export type ImageSourceResolver = (assetId: string) => Promise<string | null>;
let resolver: ImageSourceResolver | null = null;
const resolverListeners = new Set<() => void>();
export function setImageSourceResolver(fn: ImageSourceResolver | null) {
  if (resolver === fn) return;
  resolver = fn;
  // NodeViews can mount before the project installs its resolver in an effect.
  for (const refresh of resolverListeners) refresh();
}

const dimension = (value: unknown) => {
  const n = typeof value === "string" ? Number.parseFloat(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    image: {
      insertImage: (attrs: ImageAttrs) => ReturnType;
    };
  }
}

/**
 * Block image that points at a stored asset by id. It never carries a URL:
 * the src is filled in at display time by the registered resolver.
 */
export const Image = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: false,
  selectable: true,
  addAttributes() {
    return {
      assetId: {
        default: undefined,
        validate: (value: unknown) => {
          if (!isAssetId(value)) throw new RangeError("Invalid image assetId");
        },
        parseHTML: (el) => el.getAttribute("data-asset-id"),
        renderHTML: () => ({}),
      },
      alt: {
        default: "",
        parseHTML: (el) => (el.tagName === "IMG" ? el : el.querySelector("img"))?.getAttribute("alt") ?? "",
        renderHTML: () => ({}),
      },
      title: {
        default: null,
        parseHTML: (el) => (el.tagName === "IMG" ? el : el.querySelector("img"))?.getAttribute("title") ?? null,
        renderHTML: () => ({}),
      },
      width: { default: null, parseHTML: (el) => dimension((el.tagName === "IMG" ? el : el.querySelector("img"))?.getAttribute("width")), renderHTML: () => ({}) },
      height: { default: null, parseHTML: (el) => dimension((el.tagName === "IMG" ? el : el.querySelector("img"))?.getAttribute("height")), renderHTML: () => ({}) },
    };
  },
  parseHTML() {
    const valid = (el: string | HTMLElement) =>
      typeof el !== "string" && isAssetId(el.getAttribute("data-asset-id")) ? null : false;
    return [
      { tag: "figure[data-asset-id]", getAttrs: valid },
      { tag: "img[data-asset-id]", getAttrs: valid },
    ];
  },
  renderHTML({ node }) {
    const { assetId, alt, title, width, height } = node.attrs;
    const img: Record<string, string> = { alt: alt ?? "" };
    if (title) img.title = title;
    if (width) img.width = String(width);
    if (height) img.height = String(height);
    return ["figure", mergeAttributes({ "data-asset-id": assetId }), ["img", img]];
  },
  addCommands() {
    return {
      insertImage:
        (attrs) =>
        ({ commands }) => {
          if (!isAssetId(attrs.assetId)) return false;
          return commands.insertContent({
            type: this.name,
            attrs: { alt: "", title: null, width: null, height: null, ...attrs },
          });
        },
    };
  },
  addNodeView() {
    return ({ node }) => {
      let current = node;
      const dom = document.createElement("figure");
      dom.className = "doc-image";
      dom.contentEditable = "false";
      const img = document.createElement("img");
      const placeholder = document.createElement("span");
      placeholder.className = "doc-image-alt";
      dom.append(img, placeholder);
      let token = 0;
      let alive = true;
      const show = (ready: boolean) => {
        img.hidden = !ready;
        placeholder.hidden = ready;
      };
      const paint = () => {
        const { assetId, alt, title, width, height } = current.attrs;
        dom.setAttribute("data-asset-id", assetId);
        img.alt = alt ?? "";
        if (title) img.title = title; else img.removeAttribute("title");
        if (width) img.width = width; else img.removeAttribute("width");
        if (height) img.height = height; else img.removeAttribute("height");
        placeholder.textContent = alt || "Image";
      };
      const load = () => {
        const mine = ++token;
        img.removeAttribute("src");
        show(false);
        if (!resolver) return;
        resolver(current.attrs.assetId).then(
          (url) => {
            if (!alive || mine !== token || !url) return;
            img.src = url;
            show(true);
          },
          () => undefined,
        );
      };
      paint();
      resolverListeners.add(load);
      load();
      return {
        dom,
        update(next) {
          if (next.type !== current.type) return false;
          const idChanged = next.attrs.assetId !== current.attrs.assetId;
          current = next;
          paint();
          if (idChanged) load();
          return true;
        },
        destroy() {
          alive = false;
          resolverListeners.delete(load);
        },
      };
    };
  },
});
