import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import AbsenceReasonWizard from "../components/AbsenceReasonWizard";
import type { Absence } from "../services/absences";
import {
  ABSENCE_MIN_DAYS,
  addAbsenceReason,
  formatAbsenceRange,
  listAbsenceReasons,
  loadAbsences,
  setAbsenceReason,
} from "../services/absences";
import { formatDayCount } from "../services/relativeTime";
import "./AbsencesPage.css";

/**
 * Every absence (7+ idle days between training) with its reason. The ones
 * still without a reason come first; tapping a row picks or changes one.
 */
export default function AbsencesPage() {
  const navigate = useNavigate();
  const [absences, setAbsences] = useState<Absence[] | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [editing, setEditing] = useState<Absence | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [all, list] = await Promise.all([loadAbsences(), listAbsenceReasons()]);
    setAbsences(all);
    setReasons(list);
  }, []);

  useEffect(() => {
    load().catch((error) => {
      console.error("Failed to load absences:", error);
      setAbsences([]);
    });
  }, [load]);

  async function save(reason: string, create: boolean) {
    if (!editing || busy) return;
    setBusy(true);
    try {
      const label = create ? await addAbsenceReason(reason) : reason;
      await setAbsenceReason(editing, label);
      await load();
      setEditing(null);
    } catch (error) {
      console.error("Failed to save absence reason:", error);
    } finally {
      setBusy(false);
    }
  }

  const withoutReason = absences?.filter((a) => a.reason == null) ?? [];
  const withReason = absences?.filter((a) => a.reason != null) ?? [];

  function renderGroup(label: string, items: Absence[]) {
    if (items.length === 0) return null;
    return (
      <div className="absences-group">
        <p className="absences-group__label">{label}</p>
        <div className="absences-list">
          {items.map((a) => (
            <button
              key={a.id}
              type="button"
              className="absences-row"
              onClick={() => setEditing(a)}
            >
              <span className="absences-row__body">
                <span className="absences-row__title">
                  {formatAbsenceRange(a.startDate, a.endDate)}
                </span>
                <span className="absences-row__desc">
                  {formatDayCount(a.dayCount)} · {a.reason ?? "Awaiting categorization"}
                </span>
              </span>
              <span className="absences-row__chevron">›</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <main className="absences-page">
      <TopBar title="Absences" onBack={() => navigate(-1)} backLabel="Back" />
      <section className="absences-shell">
        {absences && absences.length === 0 && (
          <p className="absences-empty">
            No gaps of {ABSENCE_MIN_DAYS} days or more between your sessions.
          </p>
        )}
        {renderGroup("Awaiting categorization", withoutReason)}
        {renderGroup("Categorized", withReason)}
      </section>
      <BottomNav activeTab="settings" />

      {editing && (
        <AbsenceReasonWizard
          absence={editing}
          mode="pick"
          reasons={reasons}
          currentReason={editing.reason}
          busy={busy}
          onChoose={(reason) => void save(reason, false)}
          onCreate={(label) => void save(label, true)}
          onDismiss={() => setEditing(null)}
        />
      )}
    </main>
  );
}
