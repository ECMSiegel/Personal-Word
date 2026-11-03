import { describe, expect, it } from "vitest";
import { scrollEdges } from "./scrollFade";

describe("scrollEdges", () => {
  it("has no edge when nothing scrolls", () => {
    expect(scrollEdges(0, 300, 300)).toEqual({ top: false, bottom: false });
  });
  it("shows only the bottom edge at the top of a long view", () => {
    expect(scrollEdges(0, 300, 900)).toEqual({ top: false, bottom: true });
  });
  it("shows both edges mid-way", () => {
    expect(scrollEdges(200, 300, 900)).toEqual({ top: true, bottom: true });
  });
  it("shows only the top edge at the end, with sub-pixel slack", () => {
    expect(scrollEdges(600, 300, 900)).toEqual({ top: true, bottom: false });
    expect(scrollEdges(599.5, 300, 900)).toEqual({ top: true, bottom: false });
    expect(scrollEdges(0.5, 300, 300)).toEqual({ top: false, bottom: false });
  });
});
