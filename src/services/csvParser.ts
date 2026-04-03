export interface CsvImportRow {
  exerciseName: string;
  weight: number;
  reps: number;
  date: string; // ISO date string, e.g. "2025-11-03"
}

export interface CsvParseResult {
  rows: CsvImportRow[];
  errors: string[];
}

export function parseCsv(text: string): CsvParseResult {
  const lines = text.trim().split("\n");
  const rows: CsvImportRow[] = [];
  const errors: string[] = [];

  if (lines.length < 2) {
    return { rows: [], errors: ["File appears to be empty or has no data rows."] };
  }

  // Skip header row (index 0)
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
      exerciseName,
      weight,
      reps,
      date: new Date(dateStr).toISOString().slice(0, 10),
    });
  }

  return { rows, errors };
}