export function normalizeDoi(value: string): string | null {
  const stripped = value
    .trim()
    .replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i, "")
    .trim();
  return /^10\.\d{4,9}\/\S+$/.test(stripped) ? stripped : null;
}

export function isValidIsbn(value: string): boolean {
  const digits = value.replace(/[\s-]/g, "").toUpperCase();
  if (/^\d{9}[\dX]$/.test(digits)) {
    const sum = [...digits].reduce(
      (total, char, index) =>
        total + (char === "X" ? 10 : Number(char)) * (10 - index),
      0,
    );
    return sum % 11 === 0;
  }
  if (/^\d{13}$/.test(digits)) {
    const sum = [...digits].reduce(
      (total, char, index) => total + Number(char) * (index % 2 ? 3 : 1),
      0,
    );
    return sum % 10 === 0;
  }
  return false;
}

/** Equality only: rendering retains the identifier's original suffix case. */
export const doiKey = (value: string): string | null =>
  normalizeDoi(value)?.toLowerCase() ?? null;

/** Compare valid ISBNs without inventing an ISBN-10/ISBN-13 crosswalk. */
export const isbnKey = (value: string): string | null => {
  const compact = value.replace(/[\s-]/g, "").toUpperCase();
  return isValidIsbn(compact) ? compact : null;
};
