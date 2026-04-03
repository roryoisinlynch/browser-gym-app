import type { ImportedSet } from "./importedSetStore";

export interface CsvParseResult {
  rows: ImportedSet[];
  errors: string[];
}

// Parses DD/MM/YYYY or DD-MM-YYYY (with optional trailing time) into YYYY-MM-DD, returns null if invalid.
function parseUkDate(str: string): string | null {
  const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (!match) return null;
  const [, d, m, y] = match.map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseWeight(str: string): number | null {
  const n = Number(str);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function parseCsv(text: string): CsvParseResult {
  const lines = text.trim().split(/\r?\n/);
  const rows: ImportedSet[] = [];
  const errors: string[] = [];

  if (lines.length < 2) {
    return { rows: [], errors: ["File has no data rows."] };
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());

    if (cols.length < 4) {
      errors.push(`Row ${i}: expected 4 columns, got ${cols.length}.`);
      continue;
    }

    const [exerciseName, weightStr, repsStr, dateStr] = cols;

    if (!exerciseName) {
      errors.push(`Row ${i}: exercise name is empty.`);
      continue;
    }

    if (weightStr.toLowerCase() === "bodyweight") continue;

    const weight = parseWeight(weightStr);
    const reps = Number(repsStr);

    if (weight === null) {
      errors.push(`Row ${i}: invalid weight "${weightStr}".`);
      continue;
    }

    if (!Number.isFinite(reps) || reps < 0) {
      errors.push(`Row ${i}: invalid reps "${repsStr}".`);
      continue;
    }

    if (reps === 0) continue;

    const isoDate = parseUkDate(dateStr);
    if (!isoDate) {
      errors.push(`Row ${i}: invalid date "${dateStr}".`);
      continue;
    }

    rows.push({
      id: `imp-${Date.now()}-${i}`,
      exerciseName,
      weight,
      reps,
      date: isoDate,
    });
  }

  return { rows, errors };
}