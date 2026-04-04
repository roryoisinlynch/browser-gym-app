import { useEffect, useState } from "react";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import type { SetRecord } from "../repositories/programRepository";
import { getAllSetRecords, updateExerciseSet, deleteExerciseSet } from "../repositories/programRepository";
import { updateImportedSet, deleteImportedSet } from "../services/importedSetStore";
import "./SetsPage.css";

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

interface EditState {
  id: string;
  weight: string;
  reps: string;
}

export default function SetsPage() {
  const [records, setRecords] = useState<SetRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      setRecords(await getAllSetRecords());
    } catch (e) {
      console.error(e);
      setError("Could not load records.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function toggleGroup(name: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  function startEdit(record: SetRecord) {
    setEditing({
      id: record.id,
      weight: record.weight != null ? String(record.weight) : "",
      reps: record.reps != null ? String(record.reps) : "",
    });
  }

  async function saveEdit(record: SetRecord) {
    if (!editing || editing.id !== record.id) return;
    const weight = editing.weight === "" ? null : Number(editing.weight);
    const reps = editing.reps === "" ? null : Number(editing.reps);
    try {
      if (record.source === "imported") {
        if (weight != null && reps != null) {
          await updateImportedSet(record.id, { weight, reps });
        }
      } else {
        await updateExerciseSet(record.id, { performedWeight: weight, performedReps: reps });
      }
      setEditing(null);
      await load();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDelete(record: SetRecord) {
    const label = `${record.weight ?? "?"}kg × ${record.reps ?? "?"} reps`;
    if (!window.confirm(`Delete this ${record.source} set?\n${record.exerciseName} — ${label}`)) return;
    try {
      if (record.source === "imported") {
        await deleteImportedSet(record.id);
      } else {
        await deleteExerciseSet(record.id);
      }
      await load();
    } catch (e) {
      console.error(e);
    }
  }

  function buildGroups(source: "native" | "imported") {
    const groups = records
      .filter((r) => r.source === source)
      .reduce<Record<string, SetRecord[]>>((acc, r) => {
        (acc[r.exerciseName] ??= []).push(r);
        return acc;
      }, {});
    return Object.keys(groups)
      .sort()
      .map((name) => ({ name, sets: groups[name]! }));
  }

  const nativeGroups = buildGroups("native");
  const importedGroups = buildGroups("imported");

  function renderSection(
    title: string,
    groups: { name: string; sets: SetRecord[] }[],
    ns: string
  ) {
    if (groups.length === 0) return null;
    return (
      <div className="sets-section">
        <h2 className="sets-section__title">{title}</h2>
        {groups.map(({ name, sets }) => {
          const key = `${ns}:${name}`;
          const isOpen = expandedGroups.has(key);
          return (
            <div key={key} className="sets-group">
              <button
                className="sets-group__header"
                onClick={() => toggleGroup(key)}
                aria-expanded={isOpen}
              >
                <span className="sets-group__name">{name}</span>
                <span className="sets-group__meta">
                  <span className="sets-group__count">{sets.length}</span>
                  <span className="sets-group__chevron">{isOpen ? "▲" : "▼"}</span>
                </span>
              </button>

              {isOpen && (
                <ul className="sets-group__list">
                  {sets.map((record) => {
                    const isEditing = editing?.id === record.id;
                    return (
                      <li key={record.id} className={`sets-row${isEditing ? " sets-row--editing" : ""}`}>
                        <span className="sets-row__date">{formatDate(record.date)}</span>

                        {isEditing ? (
                          <>
                            <span className="sets-row__inputs">
                              <input
                                className="sets-row__input"
                                type="number"
                                value={editing.weight}
                                onChange={(e) => setEditing({ ...editing, weight: e.target.value })}
                                placeholder="kg"
                                aria-label="Weight"
                              />
                              <span className="sets-row__sep">×</span>
                              <input
                                className="sets-row__input"
                                type="number"
                                value={editing.reps}
                                onChange={(e) => setEditing({ ...editing, reps: e.target.value })}
                                placeholder="reps"
                                aria-label="Reps"
                              />
                            </span>
                            <span className="sets-row__actions">
                              <button className="sets-row__btn sets-row__btn--save" onClick={() => saveEdit(record)}>
                                Save
                              </button>
                              <button className="sets-row__btn sets-row__btn--cancel" onClick={() => setEditing(null)}>
                                Cancel
                              </button>
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="sets-row__value">
                              {record.weight ?? "—"}kg × {record.reps ?? "—"}
                            </span>
                            <span className="sets-row__actions">
                              <button className="sets-row__btn sets-row__btn--edit" onClick={() => startEdit(record)}>
                                Edit
                              </button>
                              <button className="sets-row__btn sets-row__btn--delete" onClick={() => handleDelete(record)}>
                                Delete
                              </button>
                            </span>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (isLoading) {
    return (
      <main className="sets-page">
        <TopBar title="Set Records" backTo="/settings" backLabel="Settings" />
        <section className="sets-shell"><p className="sets-message">Loading…</p></section>
        <BottomNav activeTab="settings" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="sets-page">
        <TopBar title="Set Records" backTo="/settings" backLabel="Settings" />
        <section className="sets-shell"><p className="sets-message">{error}</p></section>
        <BottomNav activeTab="settings" />
      </main>
    );
  }

  return (
    <main className="sets-page">
      <TopBar title="Set Records" backTo="/settings" backLabel="Settings" />

      <section className="sets-shell">
        {nativeGroups.length === 0 && importedGroups.length === 0 && (
          <p className="sets-message">No set records yet.</p>
        )}

        {renderSection("App Records", nativeGroups, "native")}
        {renderSection("CSV Imports", importedGroups, "imported")}
      </section>

      <BottomNav activeTab="settings" />
    </main>
  );
}
