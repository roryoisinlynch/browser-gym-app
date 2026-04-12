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
const SCALE_COLORS = ["#e76f51", "#f4a261", "#f4d35e", "#a8d065", "#6bcb77"];
const SCALE_LABELS = ["Poor", "Low", "OK", "Good", "Great"];

export default function HeuristicsPage() {
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [queue, setQueue] = useState<PendingItem[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [exiting, setExiting] = useState(false);

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

      const answered = new Set(entries.map((e) => `${e.questionId}_${e.date}`));

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
    const questions = await getQuestions();
    const today = localDateIso();
    const pending: PendingItem[] = questions.map((q) => ({ question: q, date: today }));
    setQueue(pending);
    setIndex(0);
    setLoading(false);
  }

  function advance() {
    setExiting(true);
    setTimeout(() => {
      setIndex((i) => i + 1);
      setSelected(null);
      setExiting(false);
    }, 250);
  }

  async function handleConfirm() {
    if (selected === null) return;
    const item = queue[index];
    await putEntry({
      id: `${item.question.id}_${item.date}`,
      questionId: item.question.id,
      date: item.date,
      value: selected,
    });
    advance();
  }

  async function handleUnknown() {
    const item = queue[index];
    await putEntry({
      id: `${item.question.id}_${item.date}`,
      questionId: item.question.id,
      date: item.date,
      value: null,
    });
    advance();
  }

  function handleSkip() {
    advance();
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
            <button type="button" className="heuristics-disabled__btn" onClick={handleEnable}>
              Enable heuristics
            </button>
          </div>
        </section>
        <BottomNav activeTab="heuristics" />
      </main>
    );
  }

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
  // Cards to peek behind the current one
  const peekCards = queue.slice(index + 1, index + 3);

  return (
    <main className="heuristics-page">
      <TopBar title="Heuristics" />
      <section className="heuristics-shell">
        {/* Progress */}
        <p className="heuristics-progress">
          {index + 1} of {queue.length}
        </p>

        {/* Card stack */}
        <div className="heuristics-stack">
          {/* Peek cards (rendered first = behind) */}
          {peekCards.map((item, i) => (
            <div
              key={`${item.question.id}_${item.date}`}
              className={`heuristics-card heuristics-card--peek heuristics-card--peek-${i + 1}`}
              aria-hidden="true"
            >
              <span className="heuristics-card__date">{friendlyDateLabel(item.date)}</span>
              <p className="heuristics-card__question">{item.question.label}</p>
            </div>
          ))}

          {/* Active card */}
          <div
            className={`heuristics-card heuristics-card--active${exiting ? " heuristics-card--exiting" : ""}`}
            key={`${current.question.id}_${current.date}`}
          >
            <span className="heuristics-card__date">{friendlyDateLabel(current.date)}</span>
            <p className="heuristics-card__question">{current.question.label}</p>

            {/* Score bar */}
            <div className="heuristics-scale">
              {SCALE.map((n, i) => (
                <button
                  key={n}
                  type="button"
                  className={`heuristics-scale__segment${selected === n ? " heuristics-scale__segment--selected" : ""}`}
                  style={{
                    "--segment-color": SCALE_COLORS[i],
                    "--segment-color-dim": SCALE_COLORS[i] + "33",
                  } as React.CSSProperties}
                  onClick={() => setSelected(selected === n ? null : n)}
                  aria-label={`${n} — ${SCALE_LABELS[i]}`}
                >
                  <span className="heuristics-scale__number">{n}</span>
                  {selected === n && (
                    <span className="heuristics-scale__label">{SCALE_LABELS[i]}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Control panel — persists across card transitions */}
        <div className="heuristics-controls">
          <button
            type="button"
            className={`heuristics-controls__confirm${selected !== null ? " heuristics-controls__confirm--ready" : ""}`}
            onClick={handleConfirm}
            disabled={selected === null}
          >
            {selected !== null ? "Confirm" : "Select a score"}
          </button>
          <div className="heuristics-controls__secondary">
            <button type="button" className="heuristics-controls__btn" onClick={handleUnknown}>
              Unknown
            </button>
            <button type="button" className="heuristics-controls__btn" onClick={handleSkip}>
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
