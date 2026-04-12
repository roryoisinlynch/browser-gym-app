import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { HeuristicQuestion, HeuristicEntry } from "../domain/models";
import {
  getQuestions,
  getEntriesForDate,
  bulkPutEntries,
  isHeuristicsEnabled,
  setHeuristicsEnabled,
  seedDefaultQuestions,
} from "../repositories/heuristicsRepository";
import HeuristicScaleInput from "../components/HeuristicScaleInput";
import BottomNav from "../components/BottomNav";
import TopBar from "../components/TopBar";
import "./HeuristicsPage.css";

function localDateIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function friendlyDateLabel(iso: string): string {
  const today = localDateIso();
  if (iso === today) return "Today";
  const yesterday = localDateIso(new Date(Date.now() - 86400000));
  if (iso === yesterday) return "Yesterday";
  const d = new Date(iso + "T00:00:00");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const ord = (n: number) => {
    const v = n % 100;
    return n + (["th", "st", "nd", "rd"][(v - 20) % 10] || ["th", "st", "nd", "rd"][v] || "th");
  };
  return `${days[d.getDay()]} ${ord(d.getDate())} ${months[d.getMonth()]}`;
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return localDateIso(d);
}

// Map of questionId -> value (undefined = not answered)
type Answers = Map<string, number | null | undefined>;

export default function HeuristicsPage() {
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [questions, setQuestions] = useState<HeuristicQuestion[]>([]);
  const [date, setDate] = useState(localDateIso());
  const [answers, setAnswers] = useState<Answers>(new Map());
  const [saved, setSaved] = useState(false);

  const isFuture = date > localDateIso();

  const load = useCallback(async () => {
    const on = await isHeuristicsEnabled();
    setEnabled(on);
    if (!on) return;
    const qs = await getQuestions();
    setQuestions(qs);
    const entries = await getEntriesForDate(date);
    const map: Answers = new Map();
    for (const q of qs) {
      const entry = entries.find((e) => e.questionId === q.id);
      map.set(q.id, entry !== undefined ? entry.value : undefined);
    }
    setAnswers(map);
    setSaved(false);
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleEnable() {
    await setHeuristicsEnabled(true);
    await seedDefaultQuestions();
    setEnabled(true);
    load();
  }

  function handleChange(questionId: string, value: number | null) {
    setAnswers((prev) => {
      const next = new Map(prev);
      // If value matches current, treat as toggle-off (back to unanswered)
      next.set(questionId, value);
      return next;
    });
    setSaved(false);
  }

  async function handleSave() {
    const entries: HeuristicEntry[] = [];
    for (const [questionId, value] of answers) {
      if (value === undefined) continue; // not answered, skip
      entries.push({
        id: `${questionId}_${date}`,
        questionId,
        date,
        value,
      });
    }
    await bulkPutEntries(entries);
    setSaved(true);
  }

  const answeredCount = [...answers.values()].filter((v) => v !== undefined).length;
  const allAnswered = answeredCount === questions.length && questions.length > 0;

  if (enabled === null) return null; // loading

  if (!enabled) {
    return (
      <main className="heuristics-page">
        <TopBar title="Heuristics" />
        <section className="heuristics-shell">
          <div className="heuristics-disabled">
            <p className="heuristics-disabled__heading">Heuristics tracking is off</p>
            <p className="heuristics-disabled__desc">
              Track daily factors like sleep, hydration, and diet alongside your training.
            </p>
            <button
              type="button"
              className="heuristics-disabled__btn"
              onClick={handleEnable}
            >
              Enable heuristics
            </button>
          </div>
        </section>
        <BottomNav activeTab="heuristics" />
      </main>
    );
  }

  return (
    <main className="heuristics-page">
      <TopBar title="Heuristics" />
      <section className="heuristics-shell">
        {/* Date navigation */}
        <div className="heuristics-date-nav">
          <button
            type="button"
            className="heuristics-date-nav__arrow"
            onClick={() => setDate((d) => shiftDate(d, -1))}
            aria-label="Previous day"
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="heuristics-date-nav__label">{friendlyDateLabel(date)}</span>
          <button
            type="button"
            className="heuristics-date-nav__arrow"
            onClick={() => setDate((d) => shiftDate(d, 1))}
            disabled={isFuture || date === localDateIso()}
            aria-label="Next day"
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Questions */}
        {questions.length === 0 ? (
          <div className="heuristics-empty">
            <p className="heuristics-empty__text">No questions configured.</p>
            <button
              type="button"
              className="heuristics-empty__btn"
              onClick={() => navigate("/heuristics/questions")}
            >
              Manage questions →
            </button>
          </div>
        ) : (
          <>
            <div className="heuristics-questions">
              {questions.map((q) => (
                <HeuristicScaleInput
                  key={q.id}
                  label={q.label}
                  value={answers.get(q.id)}
                  onChange={(v) => handleChange(q.id, v as number | null)}
                />
              ))}
            </div>

            <div className="heuristics-actions">
              <button
                type="button"
                className={`heuristics-save${allAnswered ? " heuristics-save--ready" : ""}`}
                onClick={handleSave}
                disabled={answeredCount === 0}
              >
                {saved ? "Saved" : `Save${answeredCount > 0 ? ` (${answeredCount}/${questions.length})` : ""}`}
              </button>
            </div>

            <div className="heuristics-footer">
              <button
                type="button"
                className="heuristics-footer__link"
                onClick={() => navigate("/heuristics/questions")}
              >
                Manage questions →
              </button>
            </div>
          </>
        )}
      </section>
      <BottomNav activeTab="heuristics" />
    </main>
  );
}
