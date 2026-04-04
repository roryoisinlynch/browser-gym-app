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

A **Week** groups sessions and defines the intensity context for that phase of training.

Template:

```
WeekTemplate
```

Instance:

```
WeekInstance
```

Weeks define the **target RIR** for the season progression.

Example:

```
Week 1 → 4 RIR
Week 2 → 3 RIR
Week 3 → 2 RIR
Week 4 → 1 RIR
Week 5 → 0 RIR
```

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

# Install Local Dev App on Phone (PWA)

This workflow lets you run the app locally and install it on your phone as a PWA during development.

---

## 1. Start the Vite dev server

From the project root:

```bash
npm run dev -- --host
```

Expected output:

```
Local:   https://localhost:5173/
Network: https://192.168.x.x:5173/
```

Leave this terminal running.

---

## 2. Start a Cloudflare tunnel

Open a **second terminal** and run:

```bash
cloudflared tunnel --url https://localhost:5173 --no-tls-verify
```

If `cloudflared` is not in PATH:

```bash
C:\Users\<username>\Downloads\cloudflared-windows-amd64.exe tunnel --url https://localhost:5173 --no-tls-verify
```

Cloudflare will generate a public URL like:

```
https://something-random.trycloudflare.com
```

Leave this terminal running.

---

## 3. Open the tunnel URL on your phone

On your phone browser navigate to:

```
https://something-random.trycloudflare.com
```

Your local development app should load.

---

## 4. Install the app

In Chrome on the phone:

1. Open the browser menu (⋮)
2. Tap **Install app** or **Add to Home Screen**

Because the app is served over HTTPS through the tunnel, Chrome will install it as a proper PWA.

Expected result:

- Custom app icon
- No browser UI
- Opens fullscreen like a native app

---

## 5. Launch the installed app

Open the app from the phone home screen.

The installed PWA will continue loading from your local dev server.

---

# Important Development Notes

During development the app **does not need to be reinstalled for normal code changes**.

Hot reload from Vite will update the running app automatically.

The installed app will stop working if either of these stops:

```
npm run dev
cloudflared tunnel
```

Restart both to reconnect the app.

---

# When Reinstalling May Be Required

You may need to reinstall the PWA if you change:

- `manifest.json`
- app name
- icons
- display mode
- service worker behaviour

Normal UI or logic changes do not require reinstalling.

---

# Typical Workflow

Start development environment:

```bash
# Terminal 1
npm run dev -- --host
```

```bash
# Terminal 2
cloudflared tunnel --url https://localhost:5173 --no-tls-verify
```

Open the generated Cloudflare URL on your phone and launch the installed app.

# To do:
 - add weight increment support for exercises
 - Local vs Historical Max Logic
 - Summary pages
 - Config pages
 - CRUD UI 
 - Support for bodyweight exercises (how will this work with the hist import)
 - add support for first-time exercises with no e1RM (AMRAP for first two attempts?) 
 - check that new PRs affect the e1RM for the next session, not just the next week or next season