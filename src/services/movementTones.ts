export type MovementTone = {
  bg: string;
  text: string;
  border: string;
};

// 12 pastel tones spread across the colour wheel (~30° steps).
// Slot index is the stable identity used to detect within-group collisions.
export const PALETTE: MovementTone[] = [
  { bg: "#fce6e4", text: "#8a4a40", border: "#f2ccc8" }, //  0 red-orange  ~10°
  { bg: "#fff0e7", text: "#9a6b56", border: "#f2d9ca" }, //  1 orange      ~28°
  { bg: "#fff4df", text: "#8c6d3f", border: "#efddba" }, //  2 amber       ~48°
  { bg: "#eef8df", text: "#5a7840", border: "#cde8b0" }, //  3 lime        ~88°
  { bg: "#e7f5ea", text: "#56785f", border: "#9fcbb0" }, //  4 green      ~125°
  { bg: "#e0f5ec", text: "#4a7860", border: "#b8e8d0" }, //  5 seafoam    ~158°
  { bg: "#e0f8f8", text: "#4a7878", border: "#b8e8e8" }, //  6 teal       ~182°
  { bg: "#e4eefb", text: "#4f6a94", border: "#c8d8f5" }, //  7 sky        ~210°
  { bg: "#eaeaf8", text: "#585888", border: "#c8c8f0" }, //  8 indigo     ~238°
  { bg: "#eeeaff", text: "#6a5a90", border: "#ddd4f5" }, //  9 violet     ~262°
  { bg: "#f8e0f5", text: "#884878", border: "#f0c0e8" }, // 10 fuchsia    ~300°
  { bg: "#fce4ef", text: "#8a4860", border: "#f5c8dc" }, // 11 pink       ~328°
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

// Build a tone map for a set of exercises, guaranteeing that no two
// movement types share the same palette slot.
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

  // Second pass: assign remaining types (unknown names or preferred-slot conflicts)
  // to the first unused palette slot.
  for (const name of distinctNames) {
    if (map.has(name)) continue;
    for (let i = 0; i < PALETTE.length; i++) {
      if (!usedSlots.has(i)) {
        map.set(name, PALETTE[i]);
        usedSlots.add(i);
        break;
      }
    }
    // Safety fallback if all 12 slots are somehow exhausted.
    if (!map.has(name)) {
      map.set(name, PALETTE[distinctNames.indexOf(name) % PALETTE.length]);
    }
  }

  return map;
}
