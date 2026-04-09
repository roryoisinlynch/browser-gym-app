import type { SessionTemplateMuscleGroup } from "../domain/models";

export const mockSessionTemplateMuscleGroups: SessionTemplateMuscleGroup[] = [
  // ── Chest Back A (chest priority: 9, back: 6) ─────────────────────────────
  { id: "cb-a-chest", sessionTemplateId: "chest-back-a", muscleGroupId: "chest", order: 1, targetWorkingSets: 9 },
  { id: "cb-a-back", sessionTemplateId: "chest-back-a", muscleGroupId: "back", order: 2, targetWorkingSets: 6 },

  // ── Chest Back B (back priority: 9, chest: 6) ─────────────────────────────
  { id: "cb-b-back", sessionTemplateId: "chest-back-b", muscleGroupId: "back", order: 1, targetWorkingSets: 9 },
  { id: "cb-b-chest", sessionTemplateId: "chest-back-b", muscleGroupId: "chest", order: 2, targetWorkingSets: 6 },

  // ── Arms Shoulder A (shoulder priority: 9, arms: 6, forearms: 5) ──────────
  { id: "as-a-shoulder", sessionTemplateId: "arms-shoulder-a", muscleGroupId: "shoulder", order: 1, targetWorkingSets: 9 },
  { id: "as-a-arms", sessionTemplateId: "arms-shoulder-a", muscleGroupId: "arms", order: 2, targetWorkingSets: 6 },
  { id: "as-a-forearms", sessionTemplateId: "arms-shoulder-a", muscleGroupId: "forearms", order: 3, targetWorkingSets: 5 },

  // ── Arms Shoulder B (arms priority: 9, shoulder: 6, forearms: 5) ──────────
  { id: "as-b-arms", sessionTemplateId: "arms-shoulder-b", muscleGroupId: "arms", order: 1, targetWorkingSets: 9 },
  { id: "as-b-shoulder", sessionTemplateId: "arms-shoulder-b", muscleGroupId: "shoulder", order: 2, targetWorkingSets: 6 },
  { id: "as-b-forearms", sessionTemplateId: "arms-shoulder-b", muscleGroupId: "forearms", order: 3, targetWorkingSets: 5 },

  // ── Legs A ────────────────────────────────────────────────────────────────
  { id: "legs-a-quads", sessionTemplateId: "legs-a", muscleGroupId: "quads", order: 1, targetWorkingSets: 3 },
  { id: "legs-a-hamstring", sessionTemplateId: "legs-a", muscleGroupId: "hamstring", order: 2, targetWorkingSets: 3 },
  { id: "legs-a-forearms", sessionTemplateId: "legs-a", muscleGroupId: "forearms", order: 3, targetWorkingSets: 3 },
  { id: "legs-a-core", sessionTemplateId: "legs-a", muscleGroupId: "core", order: 4, targetWorkingSets: 5 },

  // ── Legs B ────────────────────────────────────────────────────────────────
  { id: "legs-b-quads", sessionTemplateId: "legs-b", muscleGroupId: "quads", order: 1, targetWorkingSets: 3 },
  { id: "legs-b-hamstring", sessionTemplateId: "legs-b", muscleGroupId: "hamstring", order: 2, targetWorkingSets: 3 },
  { id: "legs-b-forearms", sessionTemplateId: "legs-b", muscleGroupId: "forearms", order: 3, targetWorkingSets: 3 },
  { id: "legs-b-core", sessionTemplateId: "legs-b", muscleGroupId: "core", order: 4, targetWorkingSets: 5 },
];
