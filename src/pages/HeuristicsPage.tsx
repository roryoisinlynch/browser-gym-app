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
import { deleteItem, STORE_NAMES } from "../db/db";
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

interface LastAction {
  item: PendingItem;
  value: number | null;   // null = dismissed
  entryId: string;
}

const LOOKBACK_DAYS = 3;
const SCALE = [1, 2, 3, 4, 5] as const;
const SCALE_COLORS = ["#e76f51", "#f4a261", "#f4d35e", "#a8d065", "#6bcb77"];
const SCALE_LABELS = ["Poor", "Low", "OK", "Good", "Great"];

/** Max stacked cards visible behind the active one */
const STACK_COUNT = 3;

export default function HeuristicsPage() {
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [queue, setQueue] = useState<PendingItem[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [lastAction, setLastAction] = useState<LastAction | null>(null);

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
    setQueue(questions.map((q) => ({ question: q, date: today })));
    setIndex(0);
    setLoading(false);
  }

  function advance() {
    setTransitioning(true);
    setTimeout(() => {
      setIndex((i) => i + 1);
      setTransitioning(false);
    }, 320);
  }

  async function handleScore(value: number) {
    if (transitioning) return;
    const item = queue[index];
    const entryId = `${item.question.id}_${item.date}`;
    await putEntry({
      id: entryId,
      questionId: item.question.id,
      date: item.date,
      value,
    });
    setLastAction({ item, value, entryId });
    advance();
  }

  async function handleDismiss() {
    if (transitioning) return;
    const item = queue[index];
    const entryId = `${item.question.id}_${item.date}`;
    await putEntry({
      id: entryId,
      questionId: item.question.id,
      date: item.date,
      value: null,
    });
    setLastAction({ item, value: null, entryId });
    advance();
  }

  function handleAnswerLater() {
    if (transitioning) return;
    setLastAction(null);
    advance();
  }

  async function handleUndo() {
    if (!lastAction || transitioning) return;
    await deleteItem(STORE_NAMES.heuristicEntries, lastAction.entryId);
    setLastAction(null);
    setIndex((i) => i - 1);
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

  // Stacked cards behind the active one (up to STACK_COUNT, naturally fewer near end)
  const remaining = queue.length - index - 1;
  const stackCount = Math.min(STACK_COUNT, remaining);
  const stackCards: PendingItem[] = [];
  for (let i = 1; i <= stackCount; i++) {
    stackCards.push(queue[index + i]);
  }

  const activeItem = queue[index];
  const nextItem = queue[index + 1];

  /** Render the full interactive card content for a given item */
  function renderCardContent(item: PendingItem, interactive: boolean) {
    return (
      <>
        <span className="heuristics-card__date">{friendlyDateLabel(item.date)}</span>
        <p className="heuristics-card__question">{item.question.label}</p>

        {/* Score bar */}
        <div className="heuristics-scale">
          {SCALE.map((n, i) => (
            <button
              key={n}
              type="button"
              className="heuristics-scale__segment"
              style={{
                "--segment-color": SCALE_COLORS[i],
                "--segment-color-dim": SCALE_COLORS[i] + "33",
              } as React.CSSProperties}
              onClick={interactive ? () => handleScore(n) : undefined}
              tabIndex={interactive ? 0 : -1}
              aria-label={`${n} — ${SCALE_LABELS[i]}`}
            >
              <span className="heuristics-scale__number">{n}</span>
              <span className="heuristics-scale__label">{SCALE_LABELS[i]}</span>
            </button>
          ))}
        </div>

        {/* Card actions */}
        <div className="heuristics-card__actions">
          <button
            type="button"
            className="heuristics-card__action"
            onClick={interactive ? handleAnswerLater : undefined}
            tabIndex={interactive ? 0 : -1}
          >
            Skip for now
            <span className="heuristics-card__action-note">answer later</span>
          </button>
          <button
            type="button"
            className="heuristics-card__action"
            onClick={interactive ? handleDismiss : undefined}
            tabIndex={interactive ? 0 : -1}
          >
            N/A
            <span className="heuristics-card__action-note">no impact on scores</span>
          </button>
        </div>
      </>
    );
  }

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
          {/* Background stacked cards (rendered first = behind) */}
          {stackCards.map((item, i) => {
            const depth = i + 1; // 1, 2, 3
            return (
              <div
                key={`${item.question.id}_${item.date}`}
                className="heuristics-card heuristics-card--stacked"
                style={{
                  bottom: `${-depth * 8}px`,
                  left: `${depth * 8}px`,
                  right: `${depth * 8}px`,
                  zIndex: STACK_COUNT - depth,
                  opacity: Math.max(0.2, 0.7 - (depth - 1) * 0.2),
                }}
                aria-hidden
              />
            );
          })}

          {/* Next card — sits behind active, revealed as it exits */}
          {nextItem && (
            <div
              key={`next_${nextItem.question.id}_${nextItem.date}`}
              className="heuristics-card heuristics-card--next"
              aria-hidden
            >
              {renderCardContent(nextItem, false)}
            </div>
          )}

          {/* Active card */}
          <div
            key={`${activeItem.question.id}_${activeItem.date}`}
            className={[
              "heuristics-card heuristics-card--active",
              transitioning && "heuristics-card--exiting",
            ].filter(Boolean).join(" ")}
          >
            {renderCardContent(activeItem, !transitioning)}
          </div>
        </div>

        {/* Undo bar */}
        {lastAction && (
          <div className="heuristics-undo">
            <span className="heuristics-undo__text">
              {lastAction.item.question.label}:{" "}
              {lastAction.value !== null ? (
                <>
                  <strong>{lastAction.value}</strong>
                  <span className="heuristics-undo__label">
                    {" "}({SCALE_LABELS[lastAction.value - 1]})
                  </span>
                </>
              ) : (
                <span className="heuristics-undo__label">Dismissed</span>
              )}
            </span>
            <button type="button" className="heuristics-undo__btn" onClick={handleUndo}>
              Undo
            </button>
          </div>
        )}

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
