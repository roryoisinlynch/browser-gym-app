import { useEffect, useState } from "react";
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
        const sessionTemplate =
          item.type === "session" && item.sessionTemplateId
            ? (await getSessionTemplateById(item.sessionTemplateId)) ?? null
            : null;
        return { weekTemplateItem: item, sessionTemplate };
      })
    );
    setItems(programItems);
  }

  useEffect(() => {
    loadData();
  }, [seasonTemplateId]);

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
    if (item.weekTemplateItem.type === "session" && item.sessionTemplate) {
      await deleteSessionTemplateById(item.sessionTemplate.id);
    }
    await deleteWeekTemplateItemById(item.weekTemplateItem.id);
    setConfirmDeleteId(null);
    await loadData();
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
          <p className="config-program-detail__section-label">RIR Progression</p>
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
                              <span className="config-program-detail__session-name">
                                {item.sessionTemplate?.name ?? "Unnamed session"}
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
      <BottomNav activeTab="settings" />
    </main>
  );
}
