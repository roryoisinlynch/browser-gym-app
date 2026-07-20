import "./PageLoader.css";

interface PageLoaderProps {
  /** Short factual label, e.g. "Building your week summary…". */
  label: string;
  /** Load progress from 0 to 100. */
  progress: number;
}

/**
 * Centered loading screen shared by the day / week / season summary reports.
 * A single label sits above one thin progress bar so the reports come up with
 * one calm indicator instead of a spinner and a bar competing for attention.
 */
export default function PageLoader({ label, progress }: PageLoaderProps) {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <p className="page-loader__label">{label}</p>
      <div className="page-loader__bar">
        <div className="page-loader__fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
