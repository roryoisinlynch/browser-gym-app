import { useState } from "react";
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

type Step = "presets" | "method" | "increment" | "range" | "list";

const MAX_FILL_ENTRIES = 500;

const TITLES: Record<Step, string> = {
  presets: "Available weights",
  method: "Choose a method",
  increment: "Custom increment",
  range: "Even steps over a range",
  list: "Fixed list of weights",
};

interface WeightListWizardProps {
  initial: WeightConfig;
  onApply: (config: WeightConfig) => void;
  onClose: () => void;
}

function stepOf(config: WeightConfig): number {
  if (config.kind === "increment") return config.step;
  if (config.kind === "list") {
    return config.step ?? detectConstantStep(config.weights) ?? DEFAULT_STEP;
  }
  return DEFAULT_STEP;
}

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

interface FooterProps {
  onBack: () => void;
  onDone?: () => void;
  doneDisabled?: boolean;
}

function WizardFooter({ onBack, onDone, doneDisabled }: FooterProps) {
  return (
    <div className="weight-wizard__footer">
      <button type="button" className="weight-wizard__btn" onClick={onBack}>
        Back
      </button>
      {onDone && (
        <button
          type="button"
          className="weight-wizard__btn weight-wizard__btn--primary"
          onClick={onDone}
          disabled={doneDisabled}
        >
          Done
        </button>
      )}
    </div>
  );
}

export default function WeightListWizard({
  initial,
  onApply,
  onClose,
}: WeightListWizardProps) {
  const [step, setStep] = useState<Step>("presets");
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from the current configuration, once.
  const [stepInput, setStepInput] = useState(() => String(stepOf(initial)));
  const [fillStep, setFillStep] = useState(() => String(stepOf(initial)));
  const [fillFrom, setFillFrom] = useState(() => {
    if (initial.kind !== "list" || detectConstantStep(initial.weights) == null) return "";
    return String(normaliseWeightList(initial.weights)[0]);
  });
  const [fillTo, setFillTo] = useState(() => {
    if (initial.kind !== "list" || detectConstantStep(initial.weights) == null) return "";
    const sorted = normaliseWeightList(initial.weights);
    return String(sorted[sorted.length - 1]);
  });
  const [weights, setWeights] = useState<number[]>(() =>
    initial.kind === "list" ? normaliseWeightList(initial.weights) : []
  );
  const [newWeightInput, setNewWeightInput] = useState("");

  function go(next: Step) {
    setError(null);
    setStep(next);
  }

  function applyIncrement() {
    const s = parseFloat(stepInput);
    if (!(s > 0)) {
      setError("Step must be greater than 0.");
      return;
    }
    onApply({ kind: "increment", step: s });
  }

  function applyRange() {
    const result = evaluateRange(fillFrom, fillTo, fillStep);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onApply({ kind: "list", weights: result.weights, step: result.step });
  }

  function applyList() {
    if (weights.length === 0) return;
    const detected = detectConstantStep(weights);
    onApply(
      detected != null
        ? { kind: "list", weights, step: detected }
        : { kind: "list", weights }
    );
  }

  function addWeight() {
    const val = parseFloat(newWeightInput);
    if (!Number.isFinite(val) || val <= 0) return;
    setWeights(normaliseWeightList([...weights, val]));
    setNewWeightInput("");
  }

  function removeWeight(w: number) {
    setWeights(weights.filter((v) => v !== w));
  }

  const incrementStep = parseFloat(stepInput);
  const incrementPreview =
    incrementStep > 0 ? describeWeightConfig({ kind: "increment", step: incrementStep }) : null;

  const rangeResult = evaluateRange(fillFrom, fillTo, fillStep);
  const rangePreview =
    "weights" in rangeResult
      ? `${describeWeightConfig({ kind: "list", weights: rangeResult.weights, step: rangeResult.step })} (${rangeResult.weights.length} ${rangeResult.weights.length === 1 ? "weight" : "weights"})`
      : null;

  const listPreview =
    weights.length > 0
      ? `${describeWeightConfig({ kind: "list", weights })} (${weights.length} ${weights.length === 1 ? "weight" : "weights"})`
      : null;

  return (
    <SubScreen title={TITLES[step]} onClose={onClose}>
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
          <WizardRow
            title="Something else"
            description="Set your own increment, range or list."
            onClick={() => go("method")}
          />
        </div>
      )}

      {step === "method" && (
        <>
          <div className="weight-wizard__rows">
            <WizardRow
              title="Custom increment"
              description="Any step, no upper limit."
              onClick={() => go("increment")}
            />
            <WizardRow
              title="Even steps over a range"
              description="From, to and step."
              onClick={() => go("range")}
            />
            <WizardRow
              title="Fixed list of weights"
              description="Type each weight."
              onClick={() => go("list")}
            />
          </div>
          <WizardFooter onBack={() => go("presets")} />
        </>
      )}

      {step === "increment" && (
        <>
          <label className="weight-wizard__field">
            <span>Step (kg)</span>
            <input
              className="weight-wizard__input"
              type="number"
              min="0.25"
              step="0.25"
              value={stepInput}
              onChange={(e) => {
                setStepInput(e.target.value);
                setError(null);
              }}
            />
          </label>
          {incrementPreview && (
            <p className="weight-wizard__preview">{incrementPreview}</p>
          )}
          {error && <p className="weight-wizard__error">{error}</p>}
          <WizardFooter onBack={() => go("method")} onDone={applyIncrement} />
        </>
      )}

      {step === "range" && (
        <>
          <div className="weight-wizard__fill-row">
            <label className="weight-wizard__fill-field">
              <span>From</span>
              <input
                className="weight-wizard__input"
                type="number"
                min="0.25"
                step="0.25"
                value={fillFrom}
                onChange={(e) => {
                  setFillFrom(e.target.value);
                  setError(null);
                }}
              />
            </label>
            <label className="weight-wizard__fill-field">
              <span>To</span>
              <input
                className="weight-wizard__input"
                type="number"
                min="0.25"
                step="0.25"
                value={fillTo}
                onChange={(e) => {
                  setFillTo(e.target.value);
                  setError(null);
                }}
              />
            </label>
            <label className="weight-wizard__fill-field">
              <span>Step</span>
              <input
                className="weight-wizard__input"
                type="number"
                min="0.25"
                step="0.25"
                value={fillStep}
                onChange={(e) => {
                  setFillStep(e.target.value);
                  setError(null);
                }}
              />
            </label>
          </div>
          {rangePreview && <p className="weight-wizard__preview">{rangePreview}</p>}
          {error && <p className="weight-wizard__error">{error}</p>}
          <WizardFooter onBack={() => go("method")} onDone={applyRange} />
        </>
      )}

      {step === "list" && (
        <>
          {weights.length > 0 ? (
            <div className="weight-wizard__weight-tags">
              {weights.map((w) => (
                <span key={w} className="weight-wizard__weight-tag">
                  {w}
                  <button
                    type="button"
                    className="weight-wizard__weight-tag-remove"
                    onClick={() => removeWeight(w)}
                    aria-label={`Remove ${w}kg`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="weight-wizard__empty">No weights yet.</p>
          )}
          <div className="weight-wizard__weight-add-row">
            <input
              className="weight-wizard__input"
              type="number"
              min="0.25"
              step="0.25"
              placeholder="kg"
              value={newWeightInput}
              onChange={(e) => setNewWeightInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addWeight()}
            />
            <button
              type="button"
              className="weight-wizard__add-weight-btn"
              onClick={addWeight}
            >
              Add
            </button>
          </div>
          {listPreview && <p className="weight-wizard__preview">{listPreview}</p>}
          <WizardFooter
            onBack={() => go("method")}
            onDone={applyList}
            doneDisabled={weights.length === 0}
          />
        </>
      )}
    </SubScreen>
  );
}
