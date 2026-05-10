import { useEffect, useMemo, useState } from "react";
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
  index: number;
  entryId: string;
  value: number | null;
}

const LOOKBACK_DAYS = 3;
const SCALE = [1, 2, 3, 4, 5] as const;
const SCALE_COLORS = ["#e76f51", "#f4a261", "#f4d35e", "#a8d065", "#6bcb77"];
const SCALE_LABELS = ["Poor", "Low", "OK", "Good", "Great"];

export default function HeuristicsPage() {
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [queue, setQueue] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleCollapsed(date: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  async function buildQueue(): Promise<PendingItem[]> {
    const questions = await getQuestions();
    if (questions.length === 0) return [];

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
    return pending;
  }

  useEffect(() => {
    async function load() {
      const on = await isHeuristicsEnabled();
      setEnabled(on);
      if (!on) { setLoading(false); return; }
      setQueue(await buildQueue());
      setLoading(false);
    }
    load();
  }, []);

  async function handleEnable() {
    await setHeuristicsEnabled(true);
    await seedDefaultQuestions();
    setEnabled(true);
    setQueue(await buildQueue());
    setLoading(false);
  }

  async function handleAnswer(item: PendingItem, value: number | null) {
    const entryId = `${item.question.id}_${item.date}`;
    await putEntry({
      id: entryId,
      questionId: item.question.id,
      date: item.date,
      value,
    });
    const idx = queue.findIndex(
      (q) => q.question.id === item.question.id && q.date === item.date,
    );
    if (idx === -1) return;
    setQueue((q) => q.filter((_, i) => i !== idx));
    setLastAction({ item, index: idx, entryId, value });
  }

  async function handleUndo() {
    if (!lastAction) return;
    await deleteItem(STORE_NAMES.heuristicEntries, lastAction.entryId);
    const { item, index } = lastAction;
    setQueue((q) => {
      const next = [...q];
      next.splice(Math.min(index, next.length), 0, item);
      return next;
    });
    setLastAction(null);
  }

  const groups = useMemo(() => {
    const map = new Map<string, PendingItem[]>();
    for (const item of queue) {
      if (!map.has(item.date)) map.set(item.date, []);
      map.get(item.date)!.push(item);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [queue]);

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

  if (queue.length === 0) {
    return (
      <main className="heuristics-page">
        <TopBar title="Heuristics" />
        <section className="heuristics-shell">
          <div className="heuristics-done">
            <p className="heuristics-done__heading">All done</p>
            <p className="heuristics-done__desc">
              No outstanding heuristics for the last few days.
            </p>
            <button
              type="button"
              className="heuristics-done__link"
              onClick={() => navigate("/heuristics/questions")}
            >
              Heuristics settings →
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
        <div className="heuristics-scale-header" aria-hidden>
          {SCALE.map((n, i) => (
            <div
              key={n}
              className="heuristics-scale-header__col"
              style={{ "--segment-color": SCALE_COLORS[i] } as React.CSSProperties}
            >
              <span className="heuristics-scale-header__num">{n}</span>
              <span className="heuristics-scale-header__label">{SCALE_LABELS[i]}</span>
            </div>
          ))}
          <div
            className="heuristics-scale-header__col"
            style={{ "--segment-color": "#9ca3af" } as React.CSSProperties}
          >
            <span className="heuristics-scale-header__num">N/A</span>
            <span className="heuristics-scale-header__label">skip</span>
          </div>
        </div>

        {groups.map(([date, items]) => {
          const isCollapsed = collapsed.has(date);
          return (
            <div key={date} className="heuristics-group">
              <button
                type="button"
                className="heuristics-group__heading"
                onClick={() => toggleCollapsed(date)}
                aria-expanded={!isCollapsed}
              >
                <span className="heuristics-group__heading-text">
                  {friendlyDateLabel(date)}
                </span>
                <span className="heuristics-group__heading-count">{items.length}</span>
                <svg
                  className={[
                    "heuristics-group__chevron",
                    isCollapsed && "heuristics-group__chevron--collapsed",
                  ].filter(Boolean).join(" ")}
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  aria-hidden
                >
                  <path
                    d="M6 9l6 6 6-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {!isCollapsed && (
                <div className="heuristics-group__list">
                  {items.map((item) => (
                    <div
                      key={`${item.question.id}_${item.date}`}
                      className="heuristics-card"
                    >
                      <p className="heuristics-card__question">{item.question.label}</p>

                      <div className="heuristics-scale">
                        {SCALE.map((n, i) => (
                          <button
                            key={n}
                            type="button"
                            className="heuristics-scale__segment"
                            style={{ "--segment-color": SCALE_COLORS[i] } as React.CSSProperties}
                            onClick={() => handleAnswer(item, n)}
                            aria-label={`${n} — ${SCALE_LABELS[i]}`}
                          />
                        ))}
                        <button
                          type="button"
                          className="heuristics-scale__segment"
                          style={{ "--segment-color": "#9ca3af" } as React.CSSProperties}
                          onClick={() => handleAnswer(item, null)}
                          aria-label="N/A — no impact on scores"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="heuristics-footer">
          <button
            type="button"
            className="heuristics-footer__link"
            onClick={() => navigate("/heuristics/questions")}
          >
            Heuristics settings →
          </button>
        </div>

        {lastAction && (
          <div className="heuristics-last-action">
            <span className="heuristics-last-action__text">
              {lastAction.item.question.label}:{" "}
              {lastAction.value !== null
                ? `${lastAction.value} (${SCALE_LABELS[lastAction.value - 1]})`
                : "N/A"}
              {" · "}{friendlyDateLabel(lastAction.item.date)}
            </span>
            <button
              type="button"
              className="heuristics-last-action__undo"
              onClick={handleUndo}
            >
              Undo
            </button>
          </div>
        )}
      </section>
      <BottomNav activeTab="heuristics" />
    </main>
  );
}
