import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import { parseCsv } from "../services/csvParser";
import { saveImportedSets } from "../services/importedSetStore";
import type { CsvImportRow } from "../services/csvParser";
import "./ImportPage.css";

type Step = "idle" | "preview" | "done";

export default function ImportPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("idle");
  const [parsedRows, setParsedRows] = useState<CsvImportRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text !== "string") return;

      const result = parseCsv(text);
      setParsedRows(result.rows);
      setParseErrors(result.errors);
      setStep("preview");
    };
    reader.readAsText(file);
  }

  function handleConfirm() {
    saveImportedSets(parsedRows);
    setStep("done");
  }

  function handleReset() {
    setParsedRows([]);
    setParseErrors([]);
    setStep("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <main className="import-page">
      <TopBar title="Import" backTo="/settings" backLabel="Settings" />

      <section className="import-shell">
        <header className="import-header">
          <h1 className="import-title">Import past sets</h1>
          <p className="import-subtitle">
            CSV columns: Exercise Name, Weight, Reps, Date
          </p>
        </header>

        {step === "idle" && (
          <div className="import-drop-zone" onClick={() => fileInputRef.current?.click()}>
            <p className="import-drop-label">Tap to choose a CSV file</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </div>
        )}

        {step === "preview" && (
          <>
            {parseErrors.length > 0 && (
              <div className="import-errors">
                <p className="import-errors__title">
                  {parseErrors.length} row{parseErrors.length > 1 ? "s" : ""} skipped
                </p>
                {parseErrors.map((err, i) => (
                  <p key={i} className="import-errors__item">{err}</p>
                ))}
              </div>
            )}

            <p className="import-count">
              {parsedRows.length} valid row{parsedRows.length !== 1 ? "s" : ""} ready to import
            </p>

            <div className="import-preview">
              <div className="import-preview__header">
                <span>Exercise</span>
                <span>Weight</span>
                <span>Reps</span>
                <span>Date</span>
              </div>
              {parsedRows.slice(0, 20).map((row, i) => (
                <div key={i} className="import-preview__row">
                  <span>{row.exerciseName}</span>
                  <span>{row.weight}</span>
                  <span>{row.reps}</span>
                  <span>{row.date}</span>
                </div>
              ))}
              {parsedRows.length > 20 && (
                <p className="import-preview__more">
                  …and {parsedRows.length - 20} more rows
                </p>
              )}
            </div>

            <div className="import-actions">
              <button
                type="button"
                className="import-btn import-btn--confirm"
                onClick={handleConfirm}
                disabled={parsedRows.length === 0}
              >
                Confirm import
              </button>
              <button
                type="button"
                className="import-btn import-btn--cancel"
                onClick={handleReset}
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {step === "done" && (
          <div className="import-success">
            <p className="import-success__title">Import saved</p>
            <p className="import-success__body">
              {parsedRows.length} sets will now be used as historical e1RM context.
              They won't affect volume or consistency.
            </p>
            <button
              type="button"
              className="import-btn import-btn--confirm"
              onClick={() => navigate("/settings")}
            >
              Back to settings
            </button>
            <button
              type="button"
              className="import-btn import-btn--cancel"
              onClick={handleReset}
            >
              Import another file
            </button>
          </div>
        )}
      </section>

      <BottomNav activeTab="settings" />
    </main>
  );
}