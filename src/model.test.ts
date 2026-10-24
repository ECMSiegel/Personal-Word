import { expect, it } from "vitest";
import { textOf, newProject, validateProject, isValidGoalDeadline } from "./model";
it("preserves paragraph boundaries in quoted and list fragment exports", () => {
  const paragraph = (text: string) => ({
    type: "paragraph",
    content: [{ type: "text", text }],
  });
  expect(
    textOf({
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [paragraph("First"), paragraph("Second")],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [paragraph("Third"), paragraph("Fourth")],
            },
          ],
        },
      ],
    }),
  ).toBe("First\nSecond\nThird\nFourth");
});
it("rejects unsupported imported editor content before it can be opened", () => {
  const p = newProject("Import");
  p.entries[0].content = { type: "doc", content: [{ type: "unknown" }] };
  expect(() => validateProject(p)).toThrow();
});
it("starts new projects with automatic short notes enabled", () => {
  expect(newProject("x").research?.autoShortNotes).toBe(true);
});
it("rejects invalid footnote forms", () => {
  const p = newProject("x");
  p.research!.footnotes.push({ id: "n", text: "", form: "sometimes" as "full" });
  expect(() => validateProject(p)).toThrow("Invalid footnote form");
});
it.each([
  ["shortTitle", 42],
  ["cslId", 42],
])("rejects a non-string source %s", (field, value) => {
  const p = newProject("x");
  p.research!.sources.push({ id: "s", kind: "book", title: "T", authors: [] });
  (p.research!.sources[0] as Record<string, unknown>)[field] = value;
  expect(() => validateProject(p)).toThrow("Invalid research source.");
});
it("rejects a non-boolean automatic short note preference", () => {
  const p = newProject("x");
  (p.research as { autoShortNotes?: unknown }).autoShortNotes = "yes";
  expect(() => validateProject(p)).toThrow("Invalid research data.");
});
it.each([
  [null], [[]], ["ibid"], [{ scope: "chapter", repeats: "short" }], [{ scope: "section", repeats: "op. cit." }],
  [{ scope: "section" }], [{ repeats: "ibid" }],
])("rejects an invalid citation policy %j", (citationPolicy) => {
  const p = newProject("x");
  (p.research as { citationPolicy?: unknown }).citationPolicy = citationPolicy;
  expect(() => validateProject(p)).toThrow("Invalid research data.");
});
it("accepts a valid citation policy, keeps extra fields, and allows none", () => {
  const p = newProject("x");
  expect(p.research?.citationPolicy).toBeUndefined();
  expect(() => validateProject(p)).not.toThrow();
  (p.research as { citationPolicy?: unknown }).citationPolicy = { scope: "section", repeats: "ibid", later: 1 };
  expect(() => validateProject(p)).not.toThrow();
});
it.each([
  null, [], "goal", { totalWords: 0 }, { dailyWords: -1 },
  { totalWords: 2.5 }, { dailyWords: "10" },
  { deadline: "tomorrow" }, { deadline: "2026-02-30" },
  { deadline: "2026-02-29" }, { deadline: "10000-01-01" },
])("rejects invalid writing goals: %j", (goals) => {
  expect(() => validateProject({ ...newProject("Goals"), goals })).toThrow("Invalid writing goals");
});
it("accepts additive writing goals and cleared goals", () => {
  expect(() => validateProject({ ...newProject("Goals"), goals: { totalWords: 1000, dailyWords: 50, deadline: "2026-10-31" } })).not.toThrow();
  expect(() => validateProject({ ...newProject("Goals"), goals: { deadline: "2024-02-29" } })).not.toThrow();
  expect(() => validateProject({ ...newProject("Goals"), goals: { deadline: "0000-01-01" } })).not.toThrow();
  expect(() => validateProject({ ...newProject("Goals"), goals: {} })).not.toThrow();
});

it.each([
  ["2026-02-28", true],
  ["2024-02-29", true],
  ["2026-02-29", false],
  ["2026-02-30", false],
  ["10000-01-01", false],
  ["0000-01-01", true],
])("validates goal deadline %s as %s", (date, valid) => {
  expect(isValidGoalDeadline(date)).toBe(valid);
});

it("accepts additive structured source data and retains raw prototype-named CSL fields", () => {
  const p = newProject("Sources");
  p.research!.sources.push({ id: "s", kind: "chapter", title: "T", authors: ["Organization"], creators: [{ role: "author", literal: "Organization" }], cslData: JSON.parse('{"__proto__":{"kept":true},"constructor":"raw"}'), edition: "2" });
  expect(() => validateProject(p)).not.toThrow();
  const restored = JSON.parse(JSON.stringify(p));
  validateProject(restored);
  expect(Object.hasOwn(restored.research!.sources[0].cslData!, "__proto__")).toBe(true);
  expect(({} as { kept?: boolean }).kept).toBeUndefined();
});
it.each([ { creators: "bad" }, { creators: [{ role: 7 }] }, { creators: [{ role: "author", literal: 7 }] }, { cslData: [] }, { manualFull: 7 }, { edition: 7 } ])("rejects malformed additive source data %j", (fields) => {
  const p = newProject("Sources");
  p.research!.sources.push({ id: "s", kind: "book", title: "T", authors: [], ...fields } as never);
  expect(() => validateProject(p)).toThrow("Invalid research source.");
});
