import { useRef, useState, type KeyboardEvent } from "react";
import SubScreen from "./SubScreen";
import { WEIGHT_PRESETS } from "../data/weightPresets";
import { normaliseWeightList, weightsFromIncrement } from "../services/weightOptions";
import {
  DEFAULT_STEP,
  describeWeightConfig,
  detectConstantStep,
  type WeightConfig,
} from "../services/weightConfig";
import "./WeightListWizard.css";

type Step = "start" | "presets" | "define";

const MAX_FILL_ENTRIES = 500;

const TITLES: Record<Step, string> = {
  start: "Available weights",
  presets: "Presets",
  define: "Define your own",
};

// ── Row editor helpers (pure) ───────────────────────────────────────────────

interface WeightRow {
  id: number;
  text: string;
}

function rowValue(row: WeightRow): number | null {
  const v = parseFloat(row.text);
  return Number.isFinite(v) && v > 0 ? v : null;
}

function rowValues(rows: WeightRow[]): number[] {
  const out: number[] = [];
  for (const row of rows) {
    const v = rowValue(row);
    if (v != null) out.push(v);
  }
  return out;
}

function isBlank(row: WeightRow): boolean {
  return row.text.trim() === "";
}

// Invariant: the last row is always blank, so there is always somewhere to type.
function withTrailingEmpty(rows: WeightRow[], allocId: () => number): WeightRow[] {
  const last = rows[rows.length - 1];
  return last && isBlank(last) ? rows : [...rows, { id: allocId(), text: "" }];
}

// Ids 0..n-1 for the existing weights, n for the trailing blank row.
function initialRows(initial: WeightConfig): WeightRow[] {
  const values = initial.kind === "list" ? normaliseWeightList(initial.weights) : [];
  const rows = values.map((w, i) => ({ id: i, text: String(w) }));
  return [...rows, { id: rows.length, text: "" }];
}

// ── Range generator ─────────────────────────────────────────────────────────

type RangeResult = { error: string } | { weights: number[]; step: number };

function evaluateRange(fromText: string, toText: string, stepText: string): RangeResult {
  const from = parseFloat(fromText);
  const to = parseFloat(toText);
  const step = parseFloat(stepText);
  if (!(step > 0)) return { error: "Step must be greater than 0." };
  if (!(from > 0)) return { error: "From must be greater than 0." };
  if (!(to >= from)) return { error: "To must be at least From." };
  if (Math.floor((to - from) / step) + 1 > MAX_FILL_ENTRIES) {
    return {
      error: `That range would produce more than ${MAX_FILL_ENTRIES} weights. Use a larger step or a smaller range.`,
    };
  }
  return { weights: weightsFromIncrement(step, from, to), step };
}

// ── Rows shared by the start and presets screens ────────────────────────────

interface RowProps {
  title: string;
  description?: string;
  onClick: () => void;
}

function WizardRow({ title, description, onClick }: RowProps) {
  return (
    <button type="button" className="weight-wizard__row" onClick={onClick}>
      <span className="weight-wizard__row-body">
        <span className="weight-wizard__row-title">{title}</span>
        {description && (
          <span className="weight-wizard__row-desc">{description}</span>
        )}
      </span>
      <span className="weight-wizard__row-chevron">›</span>
    </button>
  );
}

// ── Wizard ──────────────────────────────────────────────────────────────────

interface WeightListWizardProps {
  initial: WeightConfig;
  onApply: (config: WeightConfig) => void;
  onClose: () => void;
}

export default function WeightListWizard({
  initial,
  onApply,
  onClose,
}: WeightListWizardProps) {
  const [step, setStep] = useState<Step>("start");

  // Row editor. All state lives here, not in a per-screen child, so typed
  // rows survive going back to the first screen and forward again.
  const [rows, setRows] = useState<WeightRow[]>(() => initialRows(initial));
  const nextIdRef = useRef(rows.length);
  const inputsRef = useRef(new Map<number, HTMLInputElement>());
  // A row created by "Add weight" focuses itself when it mounts.
  const [focusRowId, setFocusRowId] = useState<number | null>(null);

  // Inline range generator.
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [genFrom, setGenFrom] = useState("");
  const [genTo, setGenTo] = useState("");
  const [genStep, setGenStep] = useState(String(DEFAULT_STEP));
  const [genError, setGenError] = useState<string | null>(null);

  const values = normaliseWeightList(rowValues(rows));
  const preview =
    values.length > 0
      ? `${values.length} ${values.length === 1 ? "weight" : "weights"}: ${describeWeightConfig({ kind: "list", weights: values })}`
      : null;

  function allocId(): number {
    return nextIdRef.current++;
  }

  function go(next: Step) {
    setStep(next);
    setGenError(null);
    setFocusRowId(null);
  }

  function back() {
    if (step === "start") onClose();
    else go("start");
  }

  function handleRowChange(id: number, text: string) {
    const next = rows.map((row) => (row.id === id ? { ...row, text } : row));
    setRows(withTrailingEmpty(next, allocId));
  }

  function handleRowKeyDown(e: KeyboardEvent<HTMLInputElement>, id: number) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const index = rows.findIndex((row) => row.id === id);
    const next = rows[index + 1];
    if (next) inputsRef.current.get(next.id)?.focus();
  }

  function handleRemoveRow(id: number) {
    const next = rows.filter((row) => row.id !== id);
    setRows(withTrailingEmpty(next, allocId));
    if (focusRowId === id) setFocusRowId(null);
  }

  function handleAddWeight() {
    const last = rows[rows.length - 1];
    if (last && isBlank(last)) {
      inputsRef.current.get(last.id)?.focus();
      return;
    }
    const id = allocId();
    setRows([...rows, { id, text: "" }]);
    setFocusRowId(id);
  }

  function openGenerator() {
    const detected = detectConstantStep(values);
    const seed = detected ?? (initial.kind === "increment" ? initial.step : DEFAULT_STEP);
    setGenStep(String(seed));
    setGenFrom(detected != null ? String(values[0]) : "");
    setGenTo(detected != null ? String(values[values.length - 1]) : "");
    setGenError(null);
    setGeneratorOpen(true);
  }

  function handleGenerate() {
    const result = evaluateRange(genFrom, genTo, genStep);
    if ("error" in result) {
      setGenError(result.error);
      return;
    }
    const merged = normaliseWeightList([...rowValues(rows), ...result.weights]);
    const next = merged.map((w) => ({ id: allocId(), text: String(w) }));
    next.push({ id: allocId(), text: "" });
    setRows(next);
    setGeneratorOpen(false);
    setGenError(null);
    setFocusRowId(null);
  }

  function handleDone() {
    if (values.length === 0) return;
    const detected = detectConstantStep(values);
    onApply(
      detected != null
        ? { kind: "list", weights: values, step: detected }
        : { kind: "list", weights: values }
    );
  }

  return (
    <SubScreen title={TITLES[step]} onBack={back}>
      {step === "start" && (
        <div className="weight-wizard__rows">
          <WizardRow
            title="Pick from a preset"
            description="2.5 kg or 2 kg increments."
            onClick={() => go("presets")}
          />
          <WizardRow
            title="Define your own"
            description="Type your weights one by one, or generate them from a range."
            onClick={() => go("define")}
          />
        </div>
      )}

      {step === "presets" && (
        <div className="weight-wizard__rows">
          {WEIGHT_PRESETS.map((preset) => (
            <WizardRow
              key={preset.id}
              title={preset.label}
              description={preset.description}
              onClick={() => onApply(preset.config)}
            />
          ))}
        </div>
      )}

      {step === "define" && (
        <>
          <div className="weight-wizard__row-list">
            {rows.map((row, i) => {
              const trailing = i === rows.length - 1;
              const invalid = !isBlank(row) && rowValue(row) == null;
              return (
                <div key={row.id} className="weight-wizard__row-item">
                  <input
                    ref={(el) => {
                      const map = inputsRef.current;
                      if (el) map.set(row.id, el);
                      else map.delete(row.id);
                    }}
                    className="weight-wizard__input"
                    type="number"
                    inputMode="decimal"
                    enterKeyHint="next"
                    min="0.25"
                    step="0.25"
                    placeholder="kg"
                    value={row.text}
                    autoFocus={row.id === focusRowId}
                    aria-label={`Weight ${i + 1}`}
                    aria-invalid={invalid || undefined}
                    onChange={(e) => handleRowChange(row.id, e.target.value)}
                    onKeyDown={(e) => handleRowKeyDown(e, row.id)}
                  />
                  {trailing ? (
                    <span className="weight-wizard__row-spacer" aria-hidden="true" />
                  ) : (
                    <button
                      type="button"
                      className="weight-wizard__row-remove"
                      aria-label="Remove"
                      onClick={() => handleRemoveRow(row.id)}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="weight-wizard__add-row-btn"
            onClick={handleAddWeight}
          >
            + Add weight
          </button>

          {generatorOpen ? (
            <div className="weight-wizard__generator">
              <div className="weight-wizard__fill-row">
                <label className="weight-wizard__fill-field">
                  <span>From</span>
                  <input
                    className="weight-wizard__input"
                    type="number"
                    inputMode="decimal"
                    min="0.25"
                    step="0.25"
                    value={genFrom}
                    onChange={(e) => {
                      setGenFrom(e.target.value);
                      setGenError(null);
                    }}
                  />
                </label>
                <label className="weight-wizard__fill-field">
                  <span>To</span>
                  <input
                    className="weight-wizard__input"
                    type="number"
                    inputMode="decimal"
                    min="0.25"
                    step="0.25"
                    value={genTo}
                    onChange={(e) => {
                      setGenTo(e.target.value);
                      setGenError(null);
                    }}
                  />
                </label>
                <label className="weight-wizard__fill-field">
                  <span>Step</span>
                  <input
                    className="weight-wizard__input"
                    type="number"
                    inputMode="decimal"
                    min="0.25"
                    step="0.25"
                    value={genStep}
                    onChange={(e) => {
                      setGenStep(e.target.value);
                      setGenError(null);
                    }}
                  />
                </label>
              </div>
              {genError && <p className="weight-wizard__error">{genError}</p>}
              <button
                type="button"
                className="weight-wizard__btn weight-wizard__btn--primary weight-wizard__generate-btn"
                onClick={handleGenerate}
              >
                Generate
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="weight-wizard__generate-cta"
              onClick={openGenerator}
            >
              Generate the full list for me
            </button>
          )}

          {preview && <p className="weight-wizard__preview">{preview}</p>}

          <button
            type="button"
            className="weight-wizard__btn weight-wizard__btn--primary weight-wizard__done"
            onClick={handleDone}
            disabled={values.length === 0}
          >
            Done
          </button>
        </>
      )}
    </SubScreen>
  );
}
