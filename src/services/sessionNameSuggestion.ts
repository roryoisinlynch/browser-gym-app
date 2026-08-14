// Suggested name for a duplicated session template. Session template names are
// not required to be unique anywhere in the data model; this only picks a
// sensible editable default that avoids colliding (case-insensitively) with the
// other session names in the program.
//
// Rules, in order:
//   trailing number  →  next free number:            "Push 1"  → "Push 2"
//   trailing letter  →  next free letter, same case: "push A"  → "push B"
//   neither          →  treat as implicit "A":       "push"    → "push B"
//   letters exhausted ("push Z", or B–Z all taken) → number the full source
//   name starting at 2: "push Z" → "push Z 2"
export function suggestDuplicateName(
  sourceName: string,
  existingNames: string[]
): string {
  const taken = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  const isTaken = (name: string) => taken.has(name.toLowerCase());
  const source = sourceName.trim();

  const numberMatch = source.match(/^(.*\S)\s+(\d+)$/);
  if (numberMatch) {
    const numbered = nextNumbered(
      numberMatch[1],
      parseInt(numberMatch[2], 10) + 1,
      isTaken
    );
    if (numbered !== null) return numbered;
  }

  const letterMatch = source.match(/^(.*\S)\s+([A-Za-z])$/);
  const base = letterMatch ? letterMatch[1] : source;
  const letter = letterMatch ? letterMatch[2] : "A";
  const upper = letter === letter.toUpperCase();

  for (let code = letter.toUpperCase().charCodeAt(0) + 1; code <= 90; code++) {
    const next = String.fromCharCode(code);
    const candidate = `${base} ${upper ? next : next.toLowerCase()}`;
    if (!isTaken(candidate)) return candidate;
  }

  return nextNumbered(source, 2, isTaken) ?? source;
}

// Returns null once the counter leaves the safe-integer range, where n + 1
// stops advancing (a trailing number like 2^53 would otherwise loop forever on
// its own name), so callers fall back to another rule instead.
function nextNumbered(
  base: string,
  start: number,
  isTaken: (name: string) => boolean
): string | null {
  for (let n = start; Number.isSafeInteger(n); n++) {
    const candidate = `${base} ${n}`;
    if (!isTaken(candidate)) return candidate;
  }
  return null;
}
