import "./HeuristicScaleInput.css";

interface HeuristicScaleInputProps {
  label: string;
  value: number | null | undefined; // undefined = not yet answered
  onChange: (value: number | null) => void;
}

const SCALE = [1, 2, 3, 4, 5] as const;

export default function HeuristicScaleInput({
  label,
  value,
  onChange,
}: HeuristicScaleInputProps) {
  return (
    <div className="hscale">
      <p className="hscale__label">{label}</p>
      <div className="hscale__buttons">
        {SCALE.map((n) => (
          <button
            key={n}
            type="button"
            className={`hscale__btn${value === n ? " hscale__btn--selected" : ""}`}
            onClick={() => onChange(value === n ? undefined as unknown as number : n)}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          className={`hscale__btn hscale__btn--skip${value === null ? " hscale__btn--skip-active" : ""}`}
          onClick={() => onChange(value === null ? undefined as unknown as number : null)}
          title="Skip this question"
        >
          —
        </button>
      </div>
    </div>
  );
}
