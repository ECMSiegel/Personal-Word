import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ANIMATABLE, EASING as MOTION_EASING, MOTION_MS, checkKeyframes, play, presence, slideHighlight, staggerIn } from "./motion";

type Decl = { selector: string; prop: string; value: string };

function stylesheets(): string[] {
  const files = ["src/styles.css", "src/editor/editor.css", "src/research/research.css"];
  for (const dir of ["src/components", "src/organization"]) {
    for (const f of fs.readdirSync(dir).sort()) if (f.endsWith(".css")) files.push(path.join(dir, f));
  }
  return files;
}

// Walks the stylesheet and returns declarations whose property matches `propRe`,
// skipping every `@media (prefers-reduced-motion: reduce)` block.
function declarations(file: string, propRe: RegExp): Decl[] {
  const css = fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Decl[] = [];
  const stack: { header: string; skip: boolean }[] = [];
  let buf = "";
  for (const ch of css) {
    if (ch === "{") {
      const header = buf.trim();
      const skip = (stack[stack.length - 1]?.skip ?? false) || /prefers-reduced-motion\s*:\s*reduce/.test(header);
      stack.push({ header, skip });
      buf = "";
    } else if (ch === "}" || ch === ";") {
      const top = stack[stack.length - 1];
      const m = /^\s*([a-z-]+)\s*:([\s\S]*)$/i.exec(buf);
      if (top && !top.skip && m && propRe.test(m[1])) {
        out.push({ selector: top.header, prop: m[1], value: m[2].replace(/\s+/g, " ").trim() });
      }
      buf = "";
      if (ch === "}") stack.pop();
    } else buf += ch;
  }
  return out;
}

export function transitionDeclarations(file: string): Decl[] {
  return declarations(file, /^(transition(-property|-duration|-timing-function)?|animation(-[a-z-]+)?)$/);
}

const ALLOWED_PROPS = new Set(["transform", "opacity", "clip-path", "visibility"]);
const DURATION = /^var\(--duration-(press|fast|base|morph)\)$/;
const EASING = /^var\(--ease-(out|in|spring)\)$/;

// Splits a value on top-level commas (var(...) contains none, but keep it safe).
function splitList(value: string): string[] {
  return value.split(",").map((s) => s.trim());
}

describe("stylesheet motion", () => {
  const all = stylesheets().flatMap((f) => transitionDeclarations(f).map((d) => ({ ...d, file: f })));

  it("finds transitions to check", () => {
    expect(all.length).toBeGreaterThan(5);
  });

  it("(a) animates only transform, opacity, clip-path and visibility", () => {
    const bad: string[] = [];
    for (const d of all) {
      if (d.prop === "transition") {
        for (const item of splitList(d.value)) {
          const prop = item.split(" ")[0];
          if (prop !== "none" && !ALLOWED_PROPS.has(prop)) bad.push(`${d.file} ${d.selector}: ${prop}`);
        }
      } else if (d.prop === "transition-property") {
        for (const prop of splitList(d.value)) if (!ALLOWED_PROPS.has(prop)) bad.push(`${d.file} ${d.selector}: ${prop}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("(b) uses duration tokens, never literal times", () => {
    const bad: string[] = [];
    for (const d of all) {
      const parts: string[] = [];
      if (d.prop === "transition") {
        for (const item of splitList(d.value)) parts.push(...(item.match(/var\([^)]*\)|\S+/g) ?? []).slice(1, 2));
      } else if (d.prop === "transition-duration") parts.push(...splitList(d.value));
      for (const p of parts) {
        if (p === "0s" || p === "none") continue;
        if (!DURATION.test(p)) bad.push(`${d.file} ${d.selector}: ${p}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("(c) uses easing tokens (visibility may omit one)", () => {
    const bad: string[] = [];
    for (const d of all) {
      if (d.prop === "transition") {
        for (const item of splitList(d.value)) {
          const toks = item.match(/var\([^)]*\)|\S+/g) ?? [];
          if (toks[0] === "visibility" || toks[0] === "none") continue;
          if (!EASING.test(toks[2] ?? "")) bad.push(`${d.file} ${d.selector}: ${item}`);
        }
      } else if (d.prop === "transition-timing-function") {
        for (const p of splitList(d.value)) if (!EASING.test(p)) bad.push(`${d.file} ${d.selector}: ${p}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("(d) has no @keyframes or animation declarations", () => {
    for (const f of stylesheets()) expect(fs.readFileSync(f, "utf8")).not.toMatch(/@keyframes/);
    expect(all.filter((d) => d.prop.startsWith("animation"))).toEqual([]);
  });

  it("(e) :root defines the motion tokens", () => {
    const css = fs.readFileSync("src/styles.css", "utf8");
    const tokens: Record<string, string> = {
      "--duration-press": "80ms",
      "--duration-fast": "120ms",
      "--duration-base": "180ms",
      "--duration-morph": "220ms",
      "--ease-out": "cubic-bezier(0.2, 0, 0, 1)",
      "--ease-in": "cubic-bezier(0.4, 0, 1, 1)",
      "--ease-spring": "cubic-bezier(0.34, 1.4, 0.64, 1)",
    };
    for (const [name, value] of Object.entries(tokens)) {
      const m = new RegExp(`${name}:\\s*([^;]+);`).exec(css);
      expect(m?.[1].trim(), name).toBe(value);
    }
  });

  it("(f) keeps the global reduced-motion block", () => {
    const css = fs.readFileSync("src/styles.css", "utf8");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^@]*transition: none !important/);
  });
});

type Stub = {
  frames: Keyframe[];
  opts: KeyframeAnimationOptions;
  playState: AnimationPlayState;
  finished: Promise<Stub>;
  finish: () => void;
  reverse: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
};

// A fake element whose animate() records calls and returns a controllable stub.
function fakeElement() {
  const made: Stub[] = [];
  const animate = vi.fn((frames: Keyframe[], opts: KeyframeAnimationOptions) => {
    let done: (a: Stub) => void = () => {};
    const stub: Stub = {
      frames,
      opts,
      playState: "running",
      finished: new Promise<Stub>((r) => (done = r)),
      finish: () => {
        stub.playState = "finished";
        done(stub);
      },
      reverse: vi.fn(),
      cancel: vi.fn(),
    };
    made.push(stub);
    return stub;
  });
  return { el: { animate } as unknown as HTMLElement, animate, made };
}

function tokenMs(name: string): number {
  const css = fs.readFileSync("src/styles.css", "utf8");
  return Number(new RegExp(`${name}:\\s*(\\d+)ms;`).exec(css)?.[1]);
}

function tokenValue(name: string): string | undefined {
  const css = fs.readFileSync("src/styles.css", "utf8");
  return new RegExp(`${name}:\\s*([^;]+);`).exec(css)?.[1].trim();
}

describe("motion module", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("MOTION_MS matches the duration tokens and nothing exceeds 220 ms", () => {
    for (const speed of ["press", "fast", "base", "morph"] as const) {
      expect(MOTION_MS[speed], speed).toBe(tokenMs(`--duration-${speed}`));
      expect(MOTION_MS[speed]).toBeLessThanOrEqual(220);
    }
  });

  it("EASING matches the easing tokens", () => {
    expect(MOTION_EASING.out).toBe(tokenValue("--ease-out"));
    expect(MOTION_EASING.in).toBe(tokenValue("--ease-in"));
    expect(MOTION_EASING.spring).toBe(tokenValue("--ease-spring"));
  });

  it("checkKeyframes refuses layout properties and accepts the animatable ones", () => {
    for (const prop of ["width", "height", "top", "margin", "padding"]) {
      expect(() => checkKeyframes([{ [prop]: "1px" }]), prop).toThrow(`Not animatable: ${prop}`);
    }
    expect(ANIMATABLE).toEqual(["transform", "opacity", "clipPath"]);
    expect(() =>
      checkKeyframes([
        { transform: "none", opacity: 1, clipPath: "inset(0)", offset: 0, easing: "linear", composite: "replace" },
      ]),
    ).not.toThrow();
  });

  it("play creates no animation under reduced motion", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
    const { el, animate } = fakeElement();
    expect(play(el, [{ opacity: 0 }, { opacity: 1 }], { speed: "fast", easing: "out" })).toBeNull();
    expect(animate).not.toHaveBeenCalled();
  });

  it("play uses token duration and easing and no forwards fill unless asked", () => {
    const { el, made } = fakeElement();
    play(el, [{ opacity: 0 }, { opacity: 1 }], { speed: "base", easing: "out" });
    expect(made[0].opts).toMatchObject({ duration: 180, easing: MOTION_EASING.out });
    expect(made[0].opts.fill).not.toBe("forwards");
  });

  it("presence.hide() during a running show reverses that same animation", async () => {
    const { el, animate, made } = fakeElement();
    const p = presence(el, { opacity: 0, transform: "scale(0.98)" });
    p.show();
    expect(animate).toHaveBeenCalledTimes(1);
    expect(made[0].frames).toEqual([
      { opacity: 0, transform: "scale(0.98)" },
      { opacity: 1, transform: "none" },
    ]);
    const hidden = p.hide();
    expect(animate).toHaveBeenCalledTimes(1);
    expect(made[0].reverse).toHaveBeenCalledTimes(1);
    made[0].finish();
    await expect(hidden).resolves.toBe(true);
  });

  it("presence.show() during a running hide reverses it and the hide resolves false", async () => {
    const { el, animate, made } = fakeElement();
    const p = presence(el, { clipPath: "inset(0 0 100% 0)" });
    const hidden = p.hide();
    expect(made[0].frames).toEqual([{ clipPath: "inset(0)" }, { clipPath: "inset(0 0 100% 0)" }]);
    expect(made[0].opts.fill).toBe("forwards");
    p.show();
    expect(animate).toHaveBeenCalledTimes(1);
    expect(made[0].reverse).toHaveBeenCalledTimes(1);
    await expect(hidden).resolves.toBe(false);
  });

  it("presence.hide() resolves true at once under reduced motion", async () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
    const { el, animate } = fakeElement();
    await expect(presence(el, { opacity: 0 }).hide()).resolves.toBe(true);
    expect(animate).not.toHaveBeenCalled();
  });

  it("staggerIn delays items by 15 ms capped at six steps and moves only transform", () => {
    const { el, made } = fakeElement();
    staggerIn(Array.from({ length: 8 }, () => el));
    expect(made.map((a) => a.opts.delay)).toEqual([0, 15, 30, 45, 60, 75, 90, 90]);
    for (const a of made) {
      expect(a.opts).toMatchObject({ duration: 120, easing: MOTION_EASING.out });
      for (const frame of a.frames) expect(Object.keys(frame)).toEqual(["transform"]);
    }
  });
  it("slideHighlight places the box inside the container's border and scroll", () => {
    vi.stubGlobal("getComputedStyle", () => ({ transform: "none", opacity: "1" }));
    const container = {
      getBoundingClientRect: () => ({ left: 100, top: 50, width: 200, height: 300 }),
      clientLeft: 1,
      clientTop: 1,
      scrollLeft: 0,
      scrollTop: 20,
    } as unknown as HTMLElement;
    const target = {
      getBoundingClientRect: () => ({ left: 101, top: 81, width: 198, height: 28 }),
    } as unknown as HTMLElement;
    const highlight = { style: {} as CSSStyleDeclaration } as HTMLElement;
    slideHighlight(highlight, target, container);
    // 101 - 100 - 1 + 0 = 0; 81 - 50 - 1 + 20 = 50
    expect(highlight.style.transform).toBe("translate(0px, 50px) scale(198, 28)");
  });
});
