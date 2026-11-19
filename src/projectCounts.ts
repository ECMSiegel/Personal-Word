import { type Project, entryWords } from "./model";

/** Words and sections in the manuscript only (kind "section"); fragments are not counted. */
export function projectCounts(project: Pick<Project, "entries">): {
  wordCount: number;
  sectionCount: number;
} {
  let wordCount = 0;
  let sectionCount = 0;
  for (const e of project.entries)
    if (e.kind === "section") {
      sectionCount++;
      wordCount += entryWords(e);
    }
  return { wordCount, sectionCount };
}
