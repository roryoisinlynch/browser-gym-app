# Project Context

This project is a training evaluation and workout logging system designed to measure training quality using three primary metrics:

- **Consistency**
- **Volume**
- **Intensity**

The system compares **what the program prescribed** with **what the user actually performed**.

---

# Core Metrics

## Consistency

Consistency measures how many sessions were completed relative to how many were prescribed by the program structure.

Consistency compares the **template hierarchy**:

- `SeasonTemplate`
- `WeekTemplate`
- `SessionTemplate`

with the **instance hierarchy**:

- `SeasonInstance`
- `WeekInstance`
- `SessionInstance`

Example:

```
Consistency = 2 / 3 sessions completed
```

Consistency evaluates **adherence to the program structure over time**.

---

## Volume

Volume is measured as the total number of **working sets** performed.

Volume targets are defined at the **muscle-group level within a session template**:

```
SessionTemplateMuscleGroup.targetWorkingSets
```

This means volume is **not prescribed per exercise**.

Instead:

- A session defines a **muscle-group volume target**
- The user may perform **one or more exercises** within that muscle-group section
- All qualifying **working sets** contribute toward that section's volume target

Example:

```
Push 1
  Chest → target 6 working sets
```

The user might perform:

```
Bench Press → 3 working sets
Incline Press → 3 working sets
```

Total chest volume = **6 working sets**.

---

### Working Set Definition

A set is classified as a **working set** if its estimated intensity is at least **60% of the user's historical maximum** for that exercise.

To evaluate this, the system computes an **estimated 1RM (e1RM)** using the Epley formula:

```
e1RM = weight × (1 + reps / 30)
```

The set's e1RM is compared to the user's **historical best e1RM** for that exercise:

```
intensity = set_e1RM / historical_best_e1RM
```

Classification rule:

```
intensity ≥ 0.60 → working set
intensity < 0.60 → warmup set
```

This allows sets with different weight-rep combinations to be evaluated on a **common intensity scale**.

---

## Intensity

Intensity measures how hard the user trained relative to their historical capability.

For each exercise:

- every set has a **set e1RM**
- the user's **historical e1RM** represents their best estimated strength for that exercise

Intensity can therefore be expressed as:

```
set_intensity = set_e1RM / historical_best_e1RM
```

This allows sets with different weight–rep combinations to be compared on a common scale.

---

# Time Domains

Training is structured across three time domains:

- **Session**
- **Week**
- **Season**

---

## Session

A **Session** represents a single workout.

Template:

```
SessionTemplate
```

Instance:

```
SessionInstance
```

A session instance records:

- start time
- completion time
- exercises performed
- sets logged

Example:

```
SessionTemplate → "Legs 1"
SessionInstance → "Legs 1 performed on 2026-03-18"
```

---

## Week

A **Week** groups sessions and rest days into a repeating structural unit.

Template:

```
WeekTemplate (one canonical template per SeasonTemplate)
```

Instance:

```
WeekInstance (one per week of the season, all referencing the same template)
```

Each `SeasonTemplate` has exactly **one canonical `WeekTemplate`** that defines the structural layout — the ordered list of sessions and rest days that make up a week. When a season is started, this template is replicated once per entry in `SeasonTemplate.rirSequence` to produce the actual `WeekInstance` records.

The RIR target for each week is **not stored on the template**. It is derived at runtime from `SeasonTemplate.rirSequence[weekInstance.order - 1]`.

Example — a 5-week season with `rirSequence: [4, 3, 2, 1, 0]`:

```
WeekInstance order 1 → RIR 4  (rirSequence[0])
WeekInstance order 2 → RIR 3  (rirSequence[1])
WeekInstance order 3 → RIR 2  (rirSequence[2])
WeekInstance order 4 → RIR 1  (rirSequence[3])
WeekInstance order 5 → RIR 0  (rirSequence[4])
```

All five week instances share the same session and rest-day structure. Only the intensity target changes week to week.

---

## Season

A **Season** represents a complete training block.

Template:

```
SeasonTemplate
```

Instance:

```
SeasonInstance
```

A season template defines:

- number of weeks
- session structure
- progression scheme

Example:

```
SeasonTemplate → 5 week strength block
RIR progression → 4,3,2,1,0
```

---

# Season Intensity Programming

Season intensity progresses week-to-week using a **user-specified RIR scheme**.

Example:

```
Week 1 → 4 RIR
Week 2 → 3 RIR
Week 3 → 2 RIR
Week 4 → 1 RIR
Week 5 → 0 RIR
```

For a given exercise within a season:

- the **same weight is prescribed each week**
- **only the rep target changes**

Example:

If the chosen weight corresponds to the user's **12RM**, the progression becomes:

```
Week 1 → 8 reps (4 RIR)
Week 2 → 9 reps (3 RIR)
Week 3 → 10 reps (2 RIR)
Week 4 → 11 reps (1 RIR)
Week 5 → 12 reps (0 RIR)
```

---

## Weight Selection

The prescribed weight is selected automatically by an optimisation process which:

1. Considers the **exercise's allowed rep range**
2. Considers **available weight increments** configured for the exercise
3. Selects a weight that best fits the rep progression across the season

This ensures:

- the rep targets remain within the desired rep range
- the same weight can be used consistently throughout the season.

---

# Exercise Execution

On the **Exercise Instance screen**, the user is shown the prescribed set target.

Example:

```
Bench Press
Target: 50kg × 5 reps
Target e1RM: 58.3kg
```

The **target e1RM** represents the intended intensity for that set.

---

## Recording a Set

The user records:

- the **weight used**
- the **reps performed**

If the user changes the weight from the prescribed value, they simply record the new weight and reps.

The system calculates:

```
actual_e1RM = weight × (1 + reps / 30)
```

---

## Evaluating Intensity

The set intensity is evaluated by comparing:

```
actual_e1RM
vs
historical_best_e1RM
```

This determines whether the performed set meets the intended training intensity.

This approach allows:

- consistent seasonal programming using RIR
- flexible execution if the user changes weight
- objective intensity tracking across workouts.

---

# Scheduled Dates vs Completion Dates

`SessionInstance` carries two distinct date concepts that serve different purposes. Confusing them is a common source of bugs.

## `date` — the scheduled date

Set once at season creation by `replicateSeasonWeeks`. Never updated after that.

```
date = SeasonInstance.startedAt + (weekIndex × weekLength + (sessionOrder − 1)) days
```

where `weekLength` is the total number of items (sessions + rest days) in the `WeekTemplate`.

`SeasonInstance.startedAt` is the sole anchor. Every scheduled session date in the season is an offset from that value.

**Use this field for:** schedule adherence / consistency KPI (did the user train on the day the program said to?), display of the program calendar.

**Do not use this field for:** showing when a session was actually done, historical ordering of sets, progress charts, or personal-record date labels. Because sessions are pre-generated for the whole season at start time, `date` can be weeks or months in the future relative to when the user is actually training.

## `completedAt` — the actual completion timestamp

Written by `stopSessionInstance` as `new Date().toISOString()` at the moment the user taps "Finish session". This reflects when the session was really done.

**Use this field for:** everything date-related that the user sees — set records, exercise history/progress charts, PR "N days ago" labels, and any future "actual vs scheduled" adherence comparison.

## `sessionCompletedDate(session)` — the helper

`src/repositories/programRepository.ts` exports a private helper that extracts a `YYYY-MM-DD` local-calendar date from a session, to be used wherever a display date is needed:

```ts
// Uses completedAt if present, falls back to date for in-progress/legacy records.
// Extracts the local calendar date (not UTC) to avoid off-by-one issues for
// users whose UTC offset means their local midnight differs from UTC midnight.
function sessionCompletedDate(session: SessionInstance): string {
  const d = new Date(session.completedAt ?? session.date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
```

Any new code that needs a date for a native set record should call this helper rather than reading `session.date` directly.

---

# Season Start Date

When a season is started the user is prompted to confirm a **start date** via a date picker. All session scheduled dates are calculated as offsets from this date, so choosing the right anchor is important for consistency tracking to be meaningful.

## Choosing a start date

- **Today** — the default. Use this when starting a new block from scratch.
- **A past date** — use this if the user has already been training the program informally and wants the schedule to reflect when they actually began. Scheduled dates in the past will show as overdue until they are completed.
- **A future date** — use this to pre-schedule a block that starts after a rest week or holiday. Sessions will appear as upcoming until that date arrives.

## When the prompt appears

The date picker appears before a season is created, at every entry point:

- **Week page / Season page** — when no program is active and the user taps a program to start it.
- **Programs config page** — when the user switches to a different program.

When the last session of a season is completed the season is marked done, but a new season is **not** started automatically. The user returns to the "No active program" screen and goes through the date picker before the next block begins. This ensures the new season's schedule is anchored to a deliberate date rather than whatever moment the finish button was tapped.

## How `startedAt` propagates

`startSeasonFromTemplate(seasonTemplateId, startedAt?)` accepts an optional ISO timestamp. When provided, it is written to `SeasonInstance.startedAt` and passed directly to `replicateSeasonWeeks`, which uses it as the anchor for every session's `date` field. When omitted it falls back to `new Date().toISOString()` (preserving the existing behaviour for any programmatic call that does not involve the UI flow).

---

# Templates vs Instances

A key architectural principle:

**Templates define what should happen.  
Instances record what actually happened.**

---

## Templates (Program Design)

```
SeasonTemplate
WeekTemplate
SessionTemplate
SessionTemplateMuscleGroup
ExerciseTemplate
```

Templates define the structure of the training program.

Example:

```
Push 1
  Chest → 6 working sets
  Delts → 4 working sets
```

---

## Instances (Performed Training)

```
SeasonInstance
WeekInstance
SessionInstance
SessionInstanceMuscleGroup   ← snapshot of SessionTemplateMuscleGroup
SessionInstanceExercise      ← snapshot of ExerciseTemplate
ExerciseInstance
ExerciseSet
```

Instances represent the workouts performed by the user.

Example:

```
SeasonInstance → "Spring 2026 Block"
WeekInstance → Week 2 performed
SessionInstance → "Push 1 on March 14"
ExerciseSet → 100kg × 8 reps
```

---

# Copy-on-Season-Start (Instance Isolation)

## The problem

Before this architecture was introduced, `ExerciseInstance` linked directly to `ExerciseTemplate` via `exerciseTemplateId`. This meant any template edit — renaming an exercise, changing its muscle-group assignment, deleting a template — would silently alter the display of historical sessions. A session completed six weeks ago would suddenly show different exercises or muscle-group breakdowns because the underlying templates had changed.

## The solution

When `startSeasonFromTemplate` is called, the app performs a **deep copy** of the full template structure into instance-level snapshot records:

```
SessionTemplateMuscleGroup  →  SessionInstanceMuscleGroup  (one per session, per muscle-group section)
ExerciseTemplate            →  SessionInstanceExercise     (one per session, per exercise)
```

These records are written once at season-start and never modified by template edits. Each `SessionInstance` also gains a `sessionName` field, a frozen copy of `SessionTemplate.name` at the time the season started.

## What the snapshot records contain

**`SessionInstanceMuscleGroup`**

| Field | Source |
|---|---|
| `id` | `simg-{sessionInstanceId}-{stmgId}` |
| `sessionInstanceId` | the owning session instance |
| `muscleGroupId` | copied from `SessionTemplateMuscleGroup` |
| `order` | copied from `SessionTemplateMuscleGroup` |
| `targetWorkingSets` | copied from `SessionTemplateMuscleGroup` |

**`SessionInstanceExercise`**

| Field | Source |
|---|---|
| `id` | `sie-{simgId}-{exerciseTemplateId}` |
| `sessionInstanceMuscleGroupId` | the owning `SessionInstanceMuscleGroup` |
| `sessionInstanceId` | the owning session instance |
| `sourceExerciseTemplateId` | the original `ExerciseTemplate.id` |
| `movementTypeId` | copied from `ExerciseTemplate` |
| `exerciseName` | copied from `ExerciseTemplate` |
| `weightMode` | copied from `ExerciseTemplate` |
| `prescribedWeight` | copied from `ExerciseTemplate` |
| `weightIncrement` / `availableWeights` | copied from `ExerciseTemplate` (when present) |

## Effect on ExerciseInstance

`ExerciseInstance` no longer holds an `exerciseTemplateId`. Instead it holds a `sessionInstanceExerciseId` pointing at the `SessionInstanceExercise` record for that exercise within that session. All metadata (exercise name, weight mode, movement type) is read from the `SessionInstanceExercise` snapshot rather than the live template.

## Weight propagation

Template edits are still useful going forward. When `saveExerciseTemplate` is called, it:

1. Updates the `ExerciseTemplate` record as before.
2. Propagates `prescribedWeight`, `weightMode`, `weightIncrement`, and `availableWeights` to **all existing `SessionInstanceExercise` records** that point to the same source template (via `sourceExerciseTemplateId`).

This means changing the prescribed weight on a template retroactively updates all not-yet-started sessions in the active season while leaving the overall session-isolation model intact.

## Backup version

This change is a breaking schema change. The backup version was bumped from **1 → 2**. Backups produced before this change cannot be restored directly; the migration script `migrate-backup-v1-to-v2.js` transforms a v1 backup into v2 format by:

- Generating `SessionInstanceMuscleGroup` and `SessionInstanceExercise` records from the template data for every existing session instance.
- Rewriting each `ExerciseInstance`'s `exerciseTemplateId` to `sessionInstanceExerciseId`.
- Adding `sessionName` to every `SessionInstance`.

---

# Summary

The application evaluates training by comparing:

```
Program Intent (Templates)
        vs
Performed Training (Instances)
```

Across three metrics:

```
Consistency → Did the user complete the planned sessions?

Volume → Did the user perform enough working sets for each muscle group?

Intensity → Did the performed sets reach the intended effort level?
```

# Bodyweight / Rep-Only Exercises

Some exercises do not lend themselves to weight-based intensity tracking:

- **True bodyweight exercises** (e.g. pull-ups) where no external load is recorded
- **High-rep fixed-load exercises** (e.g. lateral raises at 25+ reps) where the Epley formula becomes unreliable and e1RM is not a meaningful metric
  - These fixed-load exerciseds are named accordingly, e.g. instead of **Lateral Raise** there would be an exsercise called **2.5kg Lateral Raise** and another called **5kg Lateral Raise**  

These are handled under the `weightMode: "bodyweight"` flag on `ExerciseTemplate`. The label "bodyweight" is used broadly to mean *rep-only tracking*, regardless of whether the exercise is literally unloaded.

## How they differ from weighted exercises

| | Weighted | Bodyweight / Rep-only |
|---|---|---|
| Set logging | weight + reps | reps only |
| Intensity metric | e1RM (Epley) | max reps |
| Historical best | highest e1RM | highest rep count |
| Working set threshold | 60% of best e1RM | effective max reps − performed reps ≤ 4 |
| Season prescription | weight + rep target | rep target only |
| Progress chart y-axis | e1RM over time | max reps over time |

## Warmup classification for bodyweight exercises

For weighted exercises, a set is a warmup if its e1RM falls below 60% of the best prior e1RM. This threshold cannot be applied directly to bodyweight exercises: since bodyweight is a constant, the Epley e1RM ratio is insensitive to changes in rep count — reducing reps from 20 to 12 only moves e1RM intensity from 100% to around 84%, so almost no bodyweight set would ever be classified as warmup under the weighted rule.

Instead, warmup classification for bodyweight exercises uses a **rep gap threshold**, mirroring the same underlying RIR concept:

```
effective_max_reps = recentMaxReps ?? historicalBestReps
warmup if effective_max_reps − performed_reps > 4
```

The connection to the weighted rule: 60% e1RM ≈ 6 RPE ≈ 4 RIR. A bodyweight set with more than 4 reps in reserve relative to the effective max represents the same general effort level as a weighted set below 60% e1RM — clearly preparatory rather than a genuine working effort.

The baseline uses **`recentMaxReps` (last 3 seasons) in preference to the all-time best**, using the same recent-max fallback logic as the prescription system. This keeps the warmup threshold fair after a long training gap without anchoring it to a stale all-time record.

If no prior history exists, the set defaults to working — consistent with the weighted exercise behaviour.

## RIR and rep targets

The RIR progression still applies. The prescribed rep target for a given week is derived directly from the historical max rep count:

```
prescribed_reps = historical_max_reps - target_RIR
```

For example, if the user's best set of pull-ups is 12 reps and the week prescribes 4 RIR:

```
prescribed_reps = 12 - 4 = 8 reps
```

## Exercise history matching

Exercise history (for historical best e1RM, recent-max fallback, intensity analysis, and progress charts) is matched by **exercise name**, not by template ID.

This means:

- If the same exercise appears in multiple session templates (e.g. "Bench Press" in both *Push 1* and *Push 2*), all logged sets count toward a single shared history.
- If an exercise template is deleted, its prior session data is not lost — `ExerciseInstance` carries a denormalised `exerciseName` field written at creation time, so history lookup does not depend on the template still existing.

The normalisation is case-insensitive and trims whitespace, so "bench press", "Bench Press", and " Bench Press " are treated as the same exercise.

This behaviour applies consistently across:

| Context | Matched by |
|---|---|
| Historical best e1RM (prescription) | Exercise name |
| Recent-max fallback | Exercise name |
| Working-set intensity analysis | Exercise name |
| Progress charts (ExerciseInsights) | Exercise name |
| CSV import merge | Exercise name |

---

## CSV import handling

Imported sets for bodyweight exercises frequently appear as `0kg × n reps` since the source spreadsheet had no weight column. The import pipeline handles this in two stages:

1. **Template match**: if the exercise name matches a template marked `weightMode: "bodyweight"`, the weight column is ignored entirely and the set is treated as rep-only regardless of what the CSV contains.
2. **Heuristic fallback**: if no matching template exists, an exercise where the majority of imported rows have zero weight is automatically classified as rep-only. Stray non-zero weight rows in an otherwise zero-weight exercise are discarded.

---

---

# Cancelled Seasons

When the user switches to a new program while a season is still in progress, the displaced season is marked `cancelled` (status `"cancelled"` on `SeasonInstance`). This is distinct from `"completed"`, which is reserved for seasons that ran to their natural end.

## Effect on e1RM — no impact

The e1RM recent-max window groups historical sets into **season buckets** by `seasonInstanceId`, sorted by the most-recent session date, and takes the three most-recent buckets. This grouping is purely by activity — it does not filter by season status. A cancelled season that had sets logged in it counts as a normal season bucket and contributes to the window exactly like a completed one.

## Effect on the Season Summary list — excluded

The All Seasons list on `SeasonSummaryPage` filters to `status === "completed"`. Cancelled seasons are excluded, so only genuinely finished blocks appear in the comparison table.

## How cancellation happens

`activateProgram()` in `programRepository.ts` handles the transition:

1. Any in-progress sessions (and their exercises) within the displaced season are drained to `completed` so they do not appear as an active session after the switch.
2. The in-progress week is marked `completed` for the same reason.
3. The season itself is written back with `status: "cancelled"` and `completedAt: null`.
4. A fresh season is then created from the new template.

Not-started weeks in the displaced season are left as `not_started` — they are never touched.

---

# To do:
 - add an exercise detail screen where you can see a table of all exercises and their: last lift, e1RM local, e1RM max, total lifts, days since PR. Sortable by each column.
 - i should build unit tests which try to restore an old backup before every new deploy
 - exercises move to the top of the list
 - pre-define ordered list of exercises
 - heuristics survey to track protein, calories, creatine, sleep, fibre, water
 - feature to share program templates (send and recieve json)
 - generate a backup import json file to upload to the desktop/pixel user which is prepopulated with data to use as a screenshot/screenrecord/demo 