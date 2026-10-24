import { describe, expect, it } from "vitest";
import { entry, newProject } from "../model";
import { footnoteIdsInOrder } from "../research/noteForms";
import { createProjectIndex } from "./projectIndex";

function fixture() {
  const p = newProject("Index");
  const a = { ...p.entries[0], text: "one two", content: {type: "doc", content: [{type: "paragraph", content: [{type: "text", text: "one two"}, {type: "footnoteReference", attrs: {id: "a"}}]}]} };
  const b = { ...entry("section", "Second"), text: "three", content: {type: "doc", content: [{type: "paragraph", content: [{type: "footnoteReference", attrs: {id: "b"}}]}]} };
  const f = { ...entry("fragment", "Fragment"), text: "four five six" };
  return {...p, entries: [a,b,f], order: [a.id,b.id]};
}

describe("incremental project summaries", () => {
  it("agrees with the uncached manuscript reference and counts fragments separately", () => {
    const p = fixture(); const result = createProjectIndex().update(null,p);
    expect(result.manuscriptWords).toBe(3);
    expect(result.allWords).toBe(6);
    expect(result.referenceOrder).toEqual(footnoteIdsInOrder(p));
    expect(result.scannedEntries).toBe(3);
  });
  it("does not rescan unchanged prose after source, metadata, or order edits", () => {
    const p = fixture(); const index = createProjectIndex(); index.update(null,p);
    const next = {...p, title:"Renamed", order:[...p.order].reverse(), research:{sources:[],notes:[],footnotes:[]}};
    const result = index.update(p,next);
    expect(result.referenceOrder).toEqual(["b","a"]);
    expect(result.scannedEntries).toBe(0);
    expect(result.recountedEntries).toBe(0);
  });
  it("scans only changed content and avoids recounting formatting-only edits", () => {
    const p = fixture(); const index = createProjectIndex(); index.update(null,p);
    const next = {...p, entries:p.entries.map((e,i) => i ? e : {...e,content:{...e.content}})};
    const formatted = index.update(p,next);
    expect(formatted.scannedEntries).toBe(1);
    expect(formatted.recountedEntries).toBe(0);
    const edited = {...next,entries:next.entries.map((e,i) => i ? e : {...e,text:"one two three"})};
    const result = index.update(next,edited);
    expect(result.manuscriptWords).toBe(4);
    expect(result.scannedEntries).toBe(0);
    expect(result.recountedEntries).toBe(1);
  });
  it("invalidates reference changes, deletion and section-kind changes", () => {
    const p = fixture(); const index = createProjectIndex(); index.update(null,p);
    const next = {...p,order:[p.entries[0].id],entries:[{...p.entries[0],kind:"fragment" as const, content:{type:"doc",content:[]}}]};
    const result=index.update(p,next);
    expect(result.referenceOrder).toEqual([]);
    expect(result.manuscriptWords).toBe(0);
    expect(result.allWords).toBe(2);
  });
});


it("never numbers a fragment reference even if a malformed order lists it", () => {
  const p=fixture();
  const next={...p,entries:p.entries.map((e,i)=>i===0?{...e,kind:"fragment" as const}:e)};
  expect(createProjectIndex().update(null,next).referenceOrder).toEqual(["b"]);
});


it("keeps reference-order identity stable when only prose or sources change", () => {
  const p=fixture(); const index=createProjectIndex(); const first=index.update(null,p);
  const next={...p,entries:p.entries.map((e,i)=>i?e:{...e,text:"changed words",content:{...e.content}})};
  expect(index.update(p,next).referenceOrder).toBe(first.referenceOrder);
});
