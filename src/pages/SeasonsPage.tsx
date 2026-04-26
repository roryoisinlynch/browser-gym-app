import { useEffect, useState } from "react";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import {
  deleteSeasonInstanceTree,
  getAllSeasonInstances,
  getSeasonTemplateById,
  getSessionInstancesForWeekInstance,
  getWeekInstancesForSeasonInstance,
  getExerciseSetsForSessionInstance,
} from "../repositories/programRepository";
import type { SeasonInstance } from "../domain/models";
import "./SeasonsPage.css";

interface SeasonRow {
  season: SeasonInstance;
  programName: string | null;
  completedSessionCount: number;
  totalSetCount: number;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(season: SeasonInstance): string {
  if (season.status === "in_progress") return "Active";
  if (season.status === "completed") return "Completed";
  return "Ended early";
}

function statusClass(season: SeasonInstance): string {
  if (season.status === "in_progress") return "seasons-row__status--active";
  if (season.status === "completed") return "seasons-row__status--completed";
  return "seasons-row__status--cancelled";
}

export default function SeasonsPage() {
  const [rows, setRows] = useState<SeasonRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const seasons = await getAllSeasonInstances();
      const built = await Promise.all(
        seasons.map(async (season): Promise<SeasonRow> => {
          const tmpl = await getSeasonTemplateById(season.seasonTemplateId);
          const weeks = await getWeekInstancesForSeasonInstance(season.id);
          const sessionsByWeek = await Promise.all(
            weeks.map((w) => getSessionInstancesForWeekInstance(w.id))
          );
          const allSessions = sessionsByWeek.flat();
          const completedSessionCount = allSessions.filter(
            (s) => s.status === "completed"
          ).length;
          const setsByssession = await Promise.all(
            allSessions.map((s) => getExerciseSetsForSessionInstance(s.id))
          );
          const totalSetCount = setsByssession.reduce((sum, arr) => sum + arr.length, 0);
          return {
            season,
            programName: tmpl?.name ?? null,
            completedSessionCount,
            totalSetCount,
          };
        })
      );
      // Most recent first: by completedAt if present, else startedAt
      built.sort((a, b) => {
        const aDate = a.season.completedAt ?? a.season.startedAt ?? "";
        const bDate = b.season.completedAt ?? b.season.startedAt ?? "";
        return bDate.localeCompare(aDate);
      });
      setRows(built);
    } catch (e) {
      console.error(e);
      setError("Could not load seasons.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(row: SeasonRow) {
    const label = row.programName
      ? `${row.programName} · ${row.season.name}`
      : row.season.name;
    const ok = window.confirm(
      `Delete ${label}?\n\nThis removes the season and every record under it (weeks, sessions, exercises, sets). This cannot be undone.`
    );
    if (!ok) return;
    setBusyId(row.season.id);
    try {
      await deleteSeasonInstanceTree(row.season.id);
      await load();
    } catch (e) {
      console.error(e);
      setError("Could not delete season.");
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) {
    return (
      <main className="seasons-page">
        <TopBar title="Season Records" backTo="/settings" backLabel="Settings" />
        <section className="seasons-shell">
          <p className="seasons-message">Loading…</p>
        </section>
        <BottomNav activeTab="settings" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="seasons-page">
        <TopBar title="Season Records" backTo="/settings" backLabel="Settings" />
        <section className="seasons-shell">
          <p className="seasons-message">{error}</p>
        </section>
        <BottomNav activeTab="settings" />
      </main>
    );
  }

  return (
    <main className="seasons-page">
      <TopBar title="Season Records" backTo="/settings" backLabel="Settings" />
      <section className="seasons-shell">
        {rows.length === 0 ? (
          <p className="seasons-message">No seasons yet.</p>
        ) : (
          <ul className="seasons-list">
            {rows.map((row) => (
              <li key={row.season.id} className="seasons-row">
                <div className="seasons-row__body">
                  <div className="seasons-row__heading">
                    <span className="seasons-row__name">
                      {row.programName
                        ? `${row.programName} · ${row.season.name}`
                        : row.season.name}
                    </span>
                    <span className={`seasons-row__status ${statusClass(row.season)}`}>
                      {statusLabel(row.season)}
                    </span>
                  </div>
                  <div className="seasons-row__meta">
                    <span>{formatDate(row.season.startedAt)} → {formatDate(row.season.completedAt)}</span>
                    <span className="seasons-row__sep">·</span>
                    <span>{row.completedSessionCount} session{row.completedSessionCount === 1 ? "" : "s"}</span>
                    <span className="seasons-row__sep">·</span>
                    <span>{row.totalSetCount} set{row.totalSetCount === 1 ? "" : "s"}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="seasons-row__delete"
                  onClick={() => handleDelete(row)}
                  disabled={busyId === row.season.id}
                >
                  {busyId === row.season.id ? "…" : "Delete"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <BottomNav activeTab="settings" />
    </main>
  );
}
