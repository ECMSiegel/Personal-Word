// Font-name helpers shared by the font menus and both exporters.

/** First family of a CSS font value, without quotes or extra spaces:
 * `'"Times New Roman", serif'` -> `Times New Roman`. */
export function primaryFamily(value: string): string {
  const text = value.trim();
  const quote = text[0];
  let name: string;
  if (quote === '"' || quote === "'") {
    const end = text.indexOf(quote, 1);
    name = end < 0 ? text.slice(1) : text.slice(1, end);
  } else {
    name = text.split(",")[0];
  }
  return name.trim().replace(/\s+/g, " ");
}

/** True when both values name the same first family, ignoring case. */
export function sameFont(a: string, b: string): boolean {
  return primaryFamily(a).toLowerCase() === primaryFamily(b).toLowerCase();
}

/** A CSS font value for one family, always double-quoted so a name such as
 * "Source Sans 3" stays valid CSS. */
export function fontValue(family: string): string {
  return `"${family}", sans-serif`;
}
