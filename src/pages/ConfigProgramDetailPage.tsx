import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  SeasonTemplate,
  SessionTemplate,
  WeekTemplate,
  WeekTemplateItem,
} from "../domain/models";
import {
  getSeasonTemplateById,
  getCanonicalWeekTemplateForSeason,
  getWeekTemplateItemsForWeekTemplate,
  getSessionTemplateById,
  getSessionTemplateMuscleGroups,
  saveSeasonTemplate,
  saveSessionTemplate,
  saveWeekTemplateItem,
  deleteWeekTemplateItemById,
  deleteSessionTemplateById,
} from "../repositories/programRepository";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import "./ConfigProgramDetailPage.css";

interface ProgramItem {
  weekTemplateItem: WeekTemplateItem;
  sessionTemplate: SessionTemplate | null;
  totalWorkingSets: number;
}

// ── Sortable item wrapper ─────────────────────────────────────────────────────

interface SortableItemProps {
  id: string;
  children: (dragHandleProps: React.HTMLAttributes<HTMLElement>, isDragging: boolean) => React.ReactNode;
}

function SortableItem({ id, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: "relative",
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ ...attributes, ...listeners }, isDragging)}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ConfigProgramDetailPage() {
  const { seasonTemplateId } = useParams<{ seasonTemplateId: string }>();
  const navigate = useNavigate();

  const [seasonTemplate, setSeasonTemplate] = useState<SeasonTemplate | null>(null);
  const [weekTemplate, setWeekTemplate] = useState<WeekTemplate | null>(null);
  const [items, setItems] = useState<ProgramItem[]>([]);

  // Name edit
  const [nameInput, setNameInput] = useState("");

  // RIR edit
  const [rirInput, setRirInput] = useState("");
  const [rirError, setRirError] = useState<string | null>(null);
  const [rirSaving, setRirSaving] = useState(false);

  // Add session
  const [showAddSession, setShowAddSession] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");
  const [addingSession, setAddingSession] = useState(false);

  // Delete confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // RIR tooltip
  const [rirTooltipOpen, setRirTooltipOpen] = useState(false);
  const rirTooltipRef = useRef<HTMLDivElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  async function loadData() {
    if (!seasonTemplateId) return;
    const [season, wt] = await Promise.all([
      getSeasonTemplateById(seasonTemplateId),
      getCanonicalWeekTemplateForSeason(seasonTemplateId),
    ]);
    if (!season) return;

    setSeasonTemplate(season);
    setNameInput(season.name);
    setRirInput(season.rirSequence?.join(", ") ?? "");

    if (!wt) return;
    setWeekTemplate(wt);

    const templateItems = await getWeekTemplateItemsForWeekTemplate(wt.id);
    const programItems: ProgramItem[] = await Promise.all(
      templateItems.map(async (item) => {
        if (item.type === "session" && item.sessionTemplateId) {
          const [sessionTemplate, muscleGroups] = await Promise.all([
            getSessionTemplateById(item.sessionTemplateId),
            getSessionTemplateMuscleGroups(item.sessionTemplateId),
          ]);
          const totalWorkingSets = muscleGroups.reduce(
            (sum, mg) => sum + mg.sessionTemplateMuscleGroup.targetWorkingSets,
            0
          );
          return { weekTemplateItem: item, sessionTemplate: sessionTemplate ?? null, totalWorkingSets };
        }
        return { weekTemplateItem: item, sessionTemplate: null, totalWorkingSets: 0 };
      })
    );
    setItems(programItems);
  }

  useEffect(() => {
    loadData();
  }, [seasonTemplateId]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!rirTooltipRef.current?.contains(e.target as Node)) {
        setRirTooltipOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function parseRir(input: string): number[] | null {
    const parts = input.split(",").map((s) => s.trim());
    if (parts.some((p) => p === "")) return null;
    const nums = parts.map(Number);
    if (nums.some(isNaN)) return null;
    return nums;
  }

  async function handleSaveName() {
    if (!seasonTemplate) return;
    const name = nameInput.trim();
    if (!name || name === seasonTemplate.name) return;
    const updated = { ...seasonTemplate, name };
    await saveSeasonTemplate(updated);
    setSeasonTemplate(updated);
  }

  async function handleSaveRir() {
    if (!seasonTemplate) return;
    const rirSequence = parseRir(rirInput);
    if (!rirSequence || rirSequence.length === 0) {
      setRirError("Enter a valid sequence, e.g. 4, 3, 2, 1, 0");
      return;
    }
    setRirError(null);
    setRirSaving(true);
    try {
      await saveSeasonTemplate({
        ...seasonTemplate,
        rirSequence,
        plannedWeekCount: rirSequence.length,
      });
      setSeasonTemplate((s) =>
        s ? { ...s, rirSequence, plannedWeekCount: rirSequence.length } : s
      );
    } finally {
      setRirSaving(false);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.weekTemplateItem.id === active.id);
    const newIndex = items.findIndex((i) => i.weekTemplateItem.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);

    // Optimistic update
    setItems(reordered);

    // Persist new order values
    for (let i = 0; i < reordered.length; i++) {
      await saveWeekTemplateItem({
        ...reordered[i].weekTemplateItem,
        order: i + 1,
      });
    }
  }

  async function handleAddSession() {
    if (!weekTemplate || !seasonTemplateId) return;
    const name = newSessionName.trim();
    if (!name) return;
    setAddingSession(true);
    try {
      const maxOrder = items.reduce(
        (m, i) => Math.max(m, i.weekTemplateItem.order),
        0
      );
      const sessionTemplate: SessionTemplate = {
        id: crypto.randomUUID(),
        seasonTemplateId,
        name,
        order: maxOrder + 1,
      };
      const weekTemplateItem: WeekTemplateItem = {
        id: crypto.randomUUID(),
        weekTemplateId: weekTemplate.id,
        order: maxOrder + 1,
        type: "session",
        sessionTemplateId: sessionTemplate.id,
      };
      await saveSessionTemplate(sessionTemplate);
      await saveWeekTemplateItem(weekTemplateItem);
      setNewSessionName("");
      setShowAddSession(false);
      await loadData();
    } finally {
      setAddingSession(false);
    }
  }

  async function handleAddRestDay() {
    if (!weekTemplate) return;
    const maxOrder = items.reduce(
      (m, i) => Math.max(m, i.weekTemplateItem.order),
      0
    );
    const weekTemplateItem: WeekTemplateItem = {
      id: crypto.randomUUID(),
      weekTemplateId: weekTemplate.id,
      order: maxOrder + 1,
      type: "rest",
      label: "Rest",
    };
    await saveWeekTemplateItem(weekTemplateItem);
    await loadData();
  }

  async function handleDeleteItem(item: ProgramItem) {
    try {
      if (item.weekTemplateItem.type === "session" && item.sessionTemplate) {
        await deleteSessionTemplateById(item.sessionTemplate.id);
      }
      await deleteWeekTemplateItemById(item.weekTemplateItem.id);
      setConfirmDeleteId(null);
      setDeleteError(null);
      await loadData();
    } catch (error) {
      setConfirmDeleteId(null);
      setDeleteError(error instanceof Error ? error.message : "Could not delete session.");
    }
  }

  if (!seasonTemplate) return null;

  return (
    <main className="config-program-detail-page">
      <TopBar
        title={seasonTemplate.name}
        backTo="/config/programs"
        backLabel="Programs"
      />
      <section className="config-program-detail-shell">

        {/* Program name */}
        <div className="config-program-detail__section">
          <p className="config-program-detail__section-label">Program Name</p>
          <input
            className="config-program-detail__name-input"
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
        </div>

        {/* RIR sequence */}
        <div className="config-program-detail__section">
          <div className="config-program-detail__label-row" ref={rirTooltipRef}>
            <p className="config-program-detail__section-label">RIR Progression</p>
            <button
              type="button"
              className="config-program-detail__info-btn"
              aria-expanded={rirTooltipOpen}
              onClick={() => setRirTooltipOpen((v) => !v)}
            >?</button>
            {rirTooltipOpen && (
              <div className="config-program-detail__info-tooltip">
                <strong>Reps In Reserve (RIR)</strong> is an effort metric describing how many reps you could still perform at the end of a working set. A value of 3 means stopping with 3 reps left in the tank; 0 means going to technical failure. In this app, −1 represents going beyond failure — in practice this means hitting a personal record. Values above 4 represent very easy effort and are typically only used during deload weeks.<br /><br />
                The RIR sequence defines the target effort for each week of the program in order, which also determines the total number of weeks. A sequence of <em>3, 2, 1, 0</em> produces a 4-week program with intensity increasing each week.
              </div>
            )}
          </div>
          <div className="config-program-detail__rir-row">
            <input
              className="config-program-detail__rir-input"
              type="text"
              value={rirInput}
              onChange={(e) => { setRirInput(e.target.value); setRirError(null); }}
              placeholder="e.g. 4, 3, 2, 1, 0"
            />
            <button
              type="button"
              className="config-program-detail__rir-save"
              onClick={handleSaveRir}
              disabled={rirSaving}
            >
              {rirSaving ? "Saving…" : "Save"}
            </button>
          </div>
          {rirError && (
            <p className="config-program-detail__rir-error">{rirError}</p>
          )}
          <p className="config-program-detail__rir-hint">
            Comma-separated RIR targets, one per week · {seasonTemplate.rirSequence?.length ?? 0} weeks
          </p>
        </div>

        {/* Warnings */}
        {(() => {
          const rir = seasonTemplate.rirSequence ?? [];
          const trainingItems = items.filter((i) => i.weekTemplateItem.type === "session");
          const restItems = items.filter((i) => i.weekTemplateItem.type === "rest");
          const warnings: string[] = [];

          const lowVolume = trainingItems.filter((i) => i.totalWorkingSets < 5);
          for (const item of lowVolume) {
            warnings.push(
              `${item.sessionTemplate?.name ?? "Unnamed session"} has fewer than 5 target working sets (this should typically be around 15)`
            );
          }

          const highVolume = trainingItems.filter((i) => i.totalWorkingSets > 25);
          for (const item of highVolume) {
            warnings.push(
              `${item.sessionTemplate?.name ?? "Unnamed session"} has more than 25 target working sets (this should typically be around 15)`
            );
          }

          if (restItems.length === 0 && trainingItems.length > 0) {
            warnings.push("No rest days are scheduled");
          } else if (restItems.length > 0 && trainingItems.length / restItems.length > 6) {
            warnings.push(
              `High training-to-rest ratio: ${trainingItems.length} training ${trainingItems.length === 1 ? "day" : "days"} for every ${restItems.length} rest ${restItems.length === 1 ? "day" : "days"}`
            );
          }

          if (rir.length > 0 && rir.length < 3) {
            warnings.push(
              `RIR progression has only ${rir.length} ${rir.length === 1 ? "value" : "values"} (this would typically be around 3 to 6)`
            );
          }

          const outOfRange = rir.filter((v) => v < -1 || v > 5);
          if (outOfRange.length > 0) {
            warnings.push("RIR values outside the typical range (typically between 4 and 0)");
          }

          if (warnings.length === 0) return null;

          return (
            <div className="config-program-detail__section">
              <div className="config-program-detail__warnings">
                <p className="config-program-detail__warnings-title">
                  {warnings.length} {warnings.length === 1 ? "warning" : "warnings"}
                </p>
                <ul className="config-program-detail__warnings-list">
                  {warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })()}

        {deleteError && (
          <p className="config-program-detail__rir-error">{deleteError}</p>
        )}

        {/* Sessions & rest days */}
        <div className="config-program-detail__section">
          <p className="config-program-detail__section-label">Week Structure</p>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((i) => i.weekTemplateItem.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="config-program-detail__item-list">
                {items.map((item) => {
                  const id = item.weekTemplateItem.id;
                  const isRest = item.weekTemplateItem.type === "rest";

                  return (
                    <SortableItem key={id} id={id}>
                      {(dragHandleProps) =>
                        isRest ? (
                          <div className="config-program-detail__rest-row">
                            <div className="config-program-detail__rest-divider">
                              <span
                                className="config-program-detail__drag-handle"
                                {...dragHandleProps}
                              >
                                ⠿
                              </span>
                              {item.weekTemplateItem.label ?? "Rest"}
                            </div>
                            {confirmDeleteId === id ? (
                              <div className="config-program-detail__delete-confirm">
                                <button
                                  type="button"
                                  className="config-program-detail__delete-confirm-yes"
                                  onClick={() => handleDeleteItem(item)}
                                >
                                  Remove
                                </button>
                                <button
                                  type="button"
                                  className="config-program-detail__delete-confirm-no"
                                  onClick={() => setConfirmDeleteId(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="config-program-detail__delete-btn"
                                onClick={() => setConfirmDeleteId(id)}
                                aria-label="Remove rest day"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="config-program-detail__session-row">
                            <span
                              className="config-program-detail__drag-handle"
                              {...dragHandleProps}
                            >
                              ⠿
                            </span>
                            <button
                              type="button"
                              className="config-program-detail__session-card"
                              onClick={() =>
                                navigate(`/config/sessions/${item.sessionTemplate?.id}`)
                              }
                            >
                              <span className="config-program-detail__session-body">
                                <span className="config-program-detail__session-name">
                                  {item.sessionTemplate?.name ?? "Unnamed session"}
                                </span>
                                <span className="config-program-detail__session-volume">
                                  Target working set volume: {item.totalWorkingSets}
                                </span>
                              </span>
                              <span className="config-program-detail__session-chevron">›</span>
                            </button>
                            {confirmDeleteId === id ? (
                              <div className="config-program-detail__delete-confirm">
                                <button
                                  type="button"
                                  className="config-program-detail__delete-confirm-yes"
                                  onClick={() => handleDeleteItem(item)}
                                >
                                  Delete
                                </button>
                                <button
                                  type="button"
                                  className="config-program-detail__delete-confirm-no"
                                  onClick={() => setConfirmDeleteId(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="config-program-detail__delete-btn"
                                onClick={() => setConfirmDeleteId(id)}
                                aria-label={`Delete ${item.sessionTemplate?.name}`}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        )
                      }
                    </SortableItem>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>

          {showAddSession ? (
            <div className="config-program-detail__add-session-form">
              <input
                className="config-program-detail__add-session-input"
                type="text"
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                placeholder="Session name, e.g. Chest Back 1"
                autoFocus
              />
              <div className="config-program-detail__add-session-actions">
                <button
                  type="button"
                  className="config-program-detail__add-cancel"
                  onClick={() => { setShowAddSession(false); setNewSessionName(""); }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="config-program-detail__add-save"
                  onClick={handleAddSession}
                  disabled={addingSession || !newSessionName.trim()}
                >
                  {addingSession ? "Adding…" : "Add"}
                </button>
              </div>
            </div>
          ) : (
            <div className="config-program-detail__add-row">
              <button
                type="button"
                className="config-program-detail__add-btn"
                onClick={() => setShowAddSession(true)}
              >
                + Session
              </button>
              <button
                type="button"
                className="config-program-detail__add-btn config-program-detail__add-btn--rest"
                onClick={handleAddRestDay}
              >
                + Rest Day
              </button>
            </div>
          )}
        </div>

      </section>
      <BottomNav activeTab="program" />
    </main>
  );
}
