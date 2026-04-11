export type MovementTone = {
  bg: string;
  text: string;
  border: string;
  hue: number;
};

// 12 pastel tones spread across the colour wheel (~30° steps).
// Slot index is the stable identity used to detect within-group collisions.
export const PALETTE: MovementTone[] = [
  { bg: "#fce6e4", text: "#8a4a40", border: "#f2ccc8", hue:  10 }, //  0 red-orange
  { bg: "#fff0e7", text: "#9a6b56", border: "#f2d9ca", hue:  28 }, //  1 orange
  { bg: "#fff4df", text: "#8c6d3f", border: "#efddba", hue:  48 }, //  2 amber
  { bg: "#eef8df", text: "#5a7840", border: "#cde8b0", hue:  88 }, //  3 lime
  { bg: "#e7f5ea", text: "#56785f", border: "#9fcbb0", hue: 125 }, //  4 green
  { bg: "#e0f5ec", text: "#4a7860", border: "#b8e8d0", hue: 158 }, //  5 seafoam
  { bg: "#e0f8f8", text: "#4a7878", border: "#b8e8e8", hue: 182 }, //  6 teal
  { bg: "#e4eefb", text: "#4f6a94", border: "#c8d8f5", hue: 210 }, //  7 sky
  { bg: "#eaeaf8", text: "#585888", border: "#c8c8f0", hue: 238 }, //  8 indigo
  { bg: "#eeeaff", text: "#6a5a90", border: "#ddd4f5", hue: 262 }, //  9 violet
  { bg: "#f8e0f5", text: "#884878", border: "#f0c0e8", hue: 300 }, // 10 fuchsia
  { bg: "#fce4ef", text: "#8a4860", border: "#f5c8dc", hue: 328 }, // 11 pink
];

// Named movement type → palette slot.
// Within each muscle group, assigned slots are intentionally spread apart on the
// colour wheel so no two types in the same group look similar.
//
// Chest:     flat_press(7/sky)  incline_press(9/violet)  dip(11/pink)  chest_fly(1/orange)
// Back:      vertical_pull(6/teal)  horizontal_row(4/green)  rear_delts(10/fuchsia)
// Shoulder:  vertical_press(2/amber)  side_delts(8/indigo)  rear_delt(6/teal)
// Arms:      bicep(7/sky)  tricep(3/lime)
// Forearms:  forearm_curl(11/pink)  forearm_extension(5/seafoam)  grip_strength(9/violet)
// Quads:     squat(4/green)  extension(7/sky)
// Hamstring: hamstring(6/teal)  hinge(2/amber)
// Core:      leg_raise(5/seafoam)  crunch(9/violet)
export const MOVEMENT_TYPE_SLOTS: Record<string, number> = {
  flat_press:          7,
  incline_press:       9,
  dip:                11,
  chest_fly:           1,
  vertical_pull:       6,
  horizontal_row:      4,
  rear_delts:         10,
  vertical_press:      2,
  side_delts:          8,
  rear_delt:           6,
  bicep:               7,
  tricep:              3,
  forearm_curl:       11,
  forearm_extension:   5,
  grip_strength:       9,
  squat:               4,
  extension:           7,
  hamstring:           6,
  hinge:               2,
  leg_raise:           5,
  crunch:              9,
};

export function normaliseMovementTypeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

// Returns the minimum angular hue distance from the given slot to any
// already-used slot. Returns 360 if no slots are used yet.
function minDistanceToUsed(slot: number, usedSlots: Set<number>): number {
  if (usedSlots.size === 0) return 360;
  let min = 360;
  for (const used of usedSlots) {
    const d = hueDistance(PALETTE[slot].hue, PALETTE[used].hue);
    if (d < min) min = d;
  }
  return min;
}

// Build a tone map for a set of exercises, guaranteeing that no two
// movement types share the same palette slot, and choosing fallback slots
// to maximise contrast with already-assigned colours.
export function buildGroupToneMap(
  exercises: Array<{ movementType: { name: string } }>
): Map<string, MovementTone> {
  const seen = new Set<string>();
  const distinctNames: string[] = [];
  for (const { movementType } of exercises) {
    if (!seen.has(movementType.name)) {
      seen.add(movementType.name);
      distinctNames.push(movementType.name);
    }
  }

  const map = new Map<string, MovementTone>();
  const usedSlots = new Set<number>();

  // First pass: assign types that have a known preferred slot (no conflicts yet).
  for (const name of distinctNames) {
    const slot = MOVEMENT_TYPE_SLOTS[normaliseMovementTypeKey(name)];
    if (slot != null && !usedSlots.has(slot)) {
      map.set(name, PALETTE[slot]);
      usedSlots.add(slot);
    }
  }

  // Second pass: assign remaining types (unknown names or preferred-slot
  // conflicts) to whichever unused slot maximises contrast with the colours
  // already assigned in this group.
  for (const name of distinctNames) {
    if (map.has(name)) continue;

    let bestSlot = -1;
    let bestDistance = -1;
    for (let i = 0; i < PALETTE.length; i++) {
      if (usedSlots.has(i)) continue;
      const dist = minDistanceToUsed(i, usedSlots);
      if (dist > bestDistance) {
        bestDistance = dist;
        bestSlot = i;
      }
    }

    if (bestSlot >= 0) {
      map.set(name, PALETTE[bestSlot]);
      usedSlots.add(bestSlot);
    } else {
      // Safety fallback if all 12 slots are somehow exhausted.
      map.set(name, PALETTE[distinctNames.indexOf(name) % PALETTE.length]);
    }
  }

  return map;
}
