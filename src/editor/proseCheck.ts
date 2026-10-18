export type ProseIssue = {
  from: number;
  to: number;
  kind: "repeat" | "passive" | "filler" | "long";
  message: string;
};

type Word = { text: string; from: number; to: number };
const STOP_WORDS = new Set("a an and are as at be been but by for from had has have he her hers him his i if in into is it its me my of on or our ours she than that the their them they this those to was we were what when where which who will with you your".split(" "));
const BE = new Set(["am", "is", "are", "was", "were", "be", "been", "being"]);
const IRREGULAR = new Set("been born built bought caught chosen come done drawn driven eaten fallen felt found given gone grown heard held kept known left lost made meant met paid read run said seen sent shown sold spoken spent stood taken taught told thought understood worn won written".split(" "));
const FILLERS = ["very", "really", "just", "quite", "basically", "actually", "simply", "somewhat", "rather", "totally", "literally", "definitely", "certainly", "extremely"];
const ABBREVIATIONS = new Set(["e.g", "i.e", "et al", "mr", "dr", "ms", "st"]);

function words(text: string): Word[] {
  return [...text.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)].map((m) => ({
    text: m[0], from: m.index!, to: m.index! + m[0].length,
  }));
}
function maskedQuotes(text: string): { text: string; ranges: Array<[number, number]> } {
  const chars = text.split("");
  const ranges: Array<[number, number]> = [];
  let start = -1;
  let quote: string | null = null;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (!quote && (c === '"' || c === "“")) { quote = c; start = i; }
    else if (quote && ((quote === '"' && c === '"') || (quote === "“" && c === "”"))) {
      for (let j = start; j <= i; j++) if (chars[j] !== "\n") chars[j] = " ";
      ranges.push([start, i + 1]);
      quote = null;
    }
  }
  return { text: chars.join(""), ranges };
}
function sentenceRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (!".!?".includes(text[i])) continue;
    if (text[i] === "." && /\d/.test(text[i - 1] ?? "") && /\d/.test(text[i + 1] ?? "")) continue;
    if (text[i] === ".") {
      const prefix = text.slice(Math.max(start, i - 10), i).toLowerCase().replace(/\s+/g, " ").trim();
      if ([...ABBREVIATIONS].some((abbr) => prefix.endsWith(abbr))) continue;
    }
    if (i + 1 < text.length && !/\s/.test(text[i + 1])) continue;
    const end = i + 1;
    ranges.push([start, end]);
    while (/\s/.test(text[i + 1] ?? "")) i++;
    start = i + 1;
  }
  if (start < text.length) ranges.push([start, text.length]);
  return ranges;
}

export function findProseIssues(text: string): ProseIssue[] {
  const { text: source, ranges: quotedRanges } = maskedQuotes(text);
  const found: ProseIssue[] = [];
  const add = (from: number, to: number, kind: ProseIssue["kind"], message: string) => {
    if (quotedRanges.some(([start, end]) => from < end && to > start)) return;
    if (!found.some((issue) => issue.kind === kind && issue.from === from && issue.to === to)) found.push({ from, to, kind, message });
  };
  const tokens = words(source);
  for (let i = 0; i < tokens.length; i++) {
    const current = tokens[i];
    const lower = current.text.toLowerCase();
    const previous = tokens[i - 1];
    if (previous && previous.text.toLowerCase() === lower) add(current.from, current.to, "repeat", `Repeated word: ${current.text}`);
    else if (lower.length >= 4 && !STOP_WORDS.has(lower)) {
      const repeated = tokens.slice(i + 1, i + 9).find((word) => word.text.toLowerCase() === lower);
      if (repeated) add(repeated.from, repeated.to, "repeat", `Repeated word: ${repeated.text}`);
    }
    if (FILLERS.includes(lower)) add(current.from, current.to, "filler", `Consider removing “${current.text}”`);
    if (BE.has(lower)) {
      let next = i + 1;
      let adverbs = 0;
      while (tokens[next] && /ly$/i.test(tokens[next].text) && adverbs < 2) { next++; adverbs++; }
      const participle = tokens[next];
      if (participle && (/ed$/i.test(participle.text) || IRREGULAR.has(participle.text.toLowerCase()))) {
        const after = tokens[next + 1]?.text.toLowerCase();
        const excluded = lower === "is" && ((participle.text.toLowerCase() === "based" && after === "on") || (participle.text.toLowerCase() === "related" && after === "to") || (participle.text.toLowerCase() === "used" && after === "to"));
        if (!excluded)
          add(current.from, participle.to, "passive", "Possible passive voice");
      }
    }
    if (lower === "in" && tokens[i + 1]?.text.toLowerCase() === "order" && tokens[i + 2]?.text.toLowerCase() === "to")
      add(current.from, tokens[i + 2].to, "filler", "Consider replacing “in order to” with “to”");
  }
  for (const [from, to] of sentenceRanges(source)) {
    const sentenceWords = words(source.slice(from, to));
    if (sentenceWords.length > 40) add(sentenceWords[0].from + from, sentenceWords.at(-1)!.to + from, "long", `Long sentence: ${sentenceWords.length} words`);
  }
  return found.sort((a, b) => a.from - b.from || a.to - b.to);
}
