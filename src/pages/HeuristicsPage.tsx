import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { HeuristicQuestion } from "../domain/models";
import {
  getQuestions,
  getEntriesForDateRange,
  putEntry,
  isHeuristicsEnabled,
  setHeuristicsEnabled,
  seedDefaultQuestions,
} from "../repositories/heuristicsRepository";
import BottomNav from "../components/BottomNav";
import TopBar from "../components/TopBar";
import "./HeuristicsPage.css";

function localDateIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return localDateIso(d);
}

function friendlyDateLabel(iso: string): string {
  const today = localDateIso();
  if (iso === today) return "Today";
  if (iso === shiftDate(today, -1)) return "Yesterday";
  const d = new Date(iso + "T00:00:00");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const ord = (n: number) => {
    const v = n % 100;
    return n + (["th", "st", "nd", "rd"][(v - 20) % 10] || ["th", "st", "nd", "rd"][v] || "th");
  };
  return `${days[d.getDay()]} ${ord(d.getDate())} ${months[d.getMonth()]}`;
}

interface PendingItem {
  question: HeuristicQuestion;
  date: string;
}

const LOOKBACK_DAYS = 3;
const SCALE = [1, 2, 3, 4, 5] as const;

export default function HeuristicsPage() {
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [queue, setQueue] = useState<PendingItem[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const on = await isHeuristicsEnabled();
      setEnabled(on);
      if (!on) { setLoading(false); return; }

      const questions = await getQuestions();
      if (questions.length === 0) { setLoading(false); return; }

      const today = localDateIso();
      const startDate = shiftDate(today, -(LOOKBACK_DAYS - 1));
      const entries = await getEntriesForDateRange(startDate, today);

      // Build set of answered (questionId_date)
      const answered = new Set(entries.map((e) => `${e.questionId}_${e.date}`));

      // Build queue: today first (descending), then by question order within each day
      const pending: PendingItem[] = [];
      for (let i = 0; i < LOOKBACK_DAYS; i++) {
        const date = shiftDate(today, -i);
        for (const q of questions) {
          if (!answered.has(`${q.id}_${date}`)) {
            pending.push({ question: q, date });
          }
        }
      }

      setQueue(pending);
      setIndex(0);
      setLoading(false);
    }
    load();
  }, []);

  async function handleEnable() {
    await setHeuristicsEnabled(true);
    await seedDefaultQuestions();
    setEnabled(true);
    // Re-load to build the queue
    const questions = await getQuestions();
    const today = localDateIso();
    const pending: PendingItem[] = questions.map((q) => ({ question: q, date: today }));
    setQueue(pending);
    setIndex(0);
    setLoading(false);
  }

  async function handleScore(value: number) {
    const item = queue[index];
    await putEntry({
      id: `${item.question.id}_${item.date}`,
      questionId: item.question.id,
      date: item.date,
      value,
    });
    setIndex((i) => i + 1);
  }

  async function handleUnknown() {
    const item = queue[index];
    await putEntry({
      id: `${item.question.id}_${item.date}`,
      questionId: item.question.id,
      date: item.date,
      value: null,
    });
    setIndex((i) => i + 1);
  }

  function handleSkip() {
    setIndex((i) => i + 1);
  }

  if (enabled === null || loading) return null;

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

  // All done
  if (queue.length === 0 || index >= queue.length) {
    return (
      <main className="heuristics-page">
        <TopBar title="Heuristics" />
        <section className="heuristics-shell">
          <div className="heuristics-done">
            <p className="heuristics-done__heading">
              {queue.length === 0 ? "Nothing to log" : "All done"}
            </p>
            <p className="heuristics-done__desc">
              {queue.length === 0
                ? "No outstanding heuristics for the last few days."
                : "You're all caught up."}
            </p>
            <button
              type="button"
              className="heuristics-done__link"
              onClick={() => navigate("/heuristics/questions")}
            >
              Manage questions →
            </button>
          </div>
        </section>
        <BottomNav activeTab="heuristics" />
      </main>
    );
  }

  const current = queue[index];
  return (
    <main className="heuristics-page">
      <TopBar title="Heuristics" />
      <section className="heuristics-shell">
        <div className="heuristics-prompt">
          {/* Progress */}
          <p className="heuristics-prompt__progress">
            {index + 1} of {queue.length}
          </p>

          {/* Date context */}
          <span className="heuristics-prompt__date">{friendlyDateLabel(current.date)}</span>

          {/* Question */}
          <p className="heuristics-prompt__question">{current.question.label}</p>

          {/* 1-5 scale */}
          <div className="heuristics-prompt__scale">
            {SCALE.map((n) => (
              <button
                key={n}
                type="button"
                className="heuristics-prompt__score-btn"
                onClick={() => handleScore(n)}
              >
                {n}
              </button>
            ))}
          </div>

          {/* Secondary actions */}
          <div className="heuristics-prompt__actions">
            <button
              type="button"
              className="heuristics-prompt__action-btn"
              onClick={handleUnknown}
            >
              Unknown
            </button>
            <button
              type="button"
              className="heuristics-prompt__action-btn"
              onClick={handleSkip}
            >
              Skip for now
            </button>
          </div>
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
      </section>
      <BottomNav activeTab="heuristics" />
    </main>
  );
}
