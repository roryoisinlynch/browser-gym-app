import type { ImportedSet } from "./importedSetStore";

export interface CsvParseResult {
  rows: ImportedSet[];
  errors: string[];
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

    const weight = Number(weightStr);
    const reps = Number(repsStr);

    if (!Number.isFinite(weight) || weight <= 0) {
      errors.push(`Row ${i}: invalid weight "${weightStr}".`);
      continue;
    }

    if (!Number.isFinite(reps) || reps <= 0) {
      errors.push(`Row ${i}: invalid reps "${repsStr}".`);
      continue;
    }

    if (!dateStr || isNaN(Date.parse(dateStr))) {
      errors.push(`Row ${i}: invalid date "${dateStr}".`);
      continue;
    }

    rows.push({
      id: `imp-${Date.now()}-${i}`,
      exerciseName,
      weight,
      reps,
      date: new Date(dateStr).toISOString().slice(0, 10),
    });
  }

  return { rows, errors };
}