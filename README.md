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
date = SeasonInstance.startedAt + (weekIndex × 9 + (sessionOrder − 1)) days
```

`SeasonInstance.startedAt` is the sole anchor: it is written as `new Date().toISOString()` when `startSeasonFromTemplate` is called (either explicitly or automatically when the last session of the previous season is completed). Every scheduled session date in the season is an offset from that value.

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
| Working set threshold | 60% of best e1RM | always counted as working |
| Season prescription | weight + rep target | rep target only |
| Progress chart y-axis | e1RM over time | max reps over time |

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

# To do:
 - can you add an 'up next' section at the top of the dashboard page? It should (in priority order) either: direct the user to select and activate a program, direct a user to an active exercise, an active session, or an active week. Anything else I might have missed on that list? it should be clickable to link through to the appropriate section. If the current day is scheduled to be a rest day (and the user is on track with the schedule) then it should just say today is a rest day, but identify the 'up next' gym day.
 - can you add a season timeline section after the 'up next' section on the dashboard page? it should appear conditionally based on whether a season is currently active. It should be a timeline which represents the scheduled start and finish of a season, it should identify where the user should be currently based on the schedule, and where they currently are.
 - can you add a PRs section at the end of the dashboard page? it should present exactly the same way as the PRs sections in the summary pages, showing all PRs in descending order. Unlike the summary pages however, if a given exercise has multiple PRs, they can show as separate records (though if this requires significant code change then it isn't the end of the world to keep it the same).
 - if this is feasible (is it?) can we add links from the dashboard page to view the most recent summary page for the last completed session, week, and season (conditionally appearing based on whether or not these instances exist yet). It would be cool if we could somehow include a visual of the rank for each entity (a traffic light, an emoji, a grade)
 - just above the PRs section on the dashboard page, can we add a section to spotlight the most recent PR, outlining the lift, the old and new e1RM, the date the PR was set, the days since the previous PR, and a line graph for the given exercise just like the one on the exercise sets page (with the same bin toggles etc)
 - is it possible to conditionally present a QR code if a user opens the application on a desktop browser? I have a PNG file of the QR code (which i can convert if needed to any other file type), where in the project files should i store it?
 - is it possible to identify whether or not a mobile user has opened the app as an installd PWA app as opposed to just opening it raw in their mobile browser? I'm wondering whether we can conditionally present instructions to install as PWA.
 - can you add an import/export feature to the settings screen which allows users to export all relevant data from the model as a file (json perhaps? whatever is best) so they can migrate to another device, or save for backup purposes. 
 - on the exercise sets instance page, can you conditionally add a button to take the user to the exercise settings page where they can select a working weight? Ideally, they would be redirected back to this exercise set instance after they make their changes. The conditions which should surface this button are: the exercise has no selected working weight yet, the exercise is prescribed target reps that are outside the range of 5-20. There may already be a conditional label prompting users to do this based on one of these conditions but i don't think it links to settings.
 - add tooltip on the exercise settings page to suggest bodyweight weight mode where working weight choices are less than 3, or where they have 30+ reps
 - have 'Target' read as AMRAP instead of emdash for AMRAP sets
 - fix the intensity target bar so that it's clear when the target is met
 - is it easy to add a 'share' button on the summary pages which takes a screenshot and allows you to post to whatsapp?
 - check epley logic when entering sets, it seems off
 - check that new PRs affect the e1RM for the next session, not just the next week or next season
 - test program hopping, delete a full program and see if exercise history persists (test both as a new user and a user with csv imports)
 - on the edit exercise screen in the config screen there is no back button in the top nav bar, can we add one like we have on the other screens.
 - update readme to explain how working weight is set in config and its relation to RIR schemes, the philosophy behind consistent weights week to week
 - how are warmup sets classified for bodyweight exercises?
 - consider starting the target bar from the warmup threshold instead of at 0
 - OR add a warmup bar above it with 0-60 intensity and have the current one 61-100
 - OR denote section markers: warmup, RIR target, local e1RM, max e1RM
 - fix the settings settings settings label
 - add an exercise detail screen where you can see a table of all exercises and their: last lift, e1RM local, e1RM max, total lifts, days since PR. Sortable by each column.
 - is seed data taken from mock data or does it have its own definiton, should it? what do we want the final seed data to look like
 - can the app tell whether it has been downloaded and installed? if so condition on mobile to tell the user how
 - add clear directions when creating days, muscle groups, exercises and movement types
 - i think home page is no longer used, can you confirm? it's an old version of what has now become the week page.