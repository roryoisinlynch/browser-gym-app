import type { SessionTemplate } from "../domain/models";
import { mockSeasonTemplates } from "./mockSeasonTemplates";

const arnoldSeason = mockSeasonTemplates[0]!;
const pplSeason = mockSeasonTemplates[1]!;

export const mockSessionTemplates: SessionTemplate[] = [
  { id: "chest-back-a", seasonTemplateId: arnoldSeason.id, name: "Chest Back A", order: 1 },
  { id: "arms-shoulder-a", seasonTemplateId: arnoldSeason.id, name: "Arms Shoulder A", order: 2 },
  { id: "legs-a", seasonTemplateId: arnoldSeason.id, name: "Legs A", order: 3 },
  { id: "chest-back-b", seasonTemplateId: arnoldSeason.id, name: "Chest Back B", order: 4 },
  { id: "arms-shoulder-b", seasonTemplateId: arnoldSeason.id, name: "Arms Shoulder B", order: 5 },
  { id: "legs-b", seasonTemplateId: arnoldSeason.id, name: "Legs B", order: 6 },

  { id: "ppl-push", seasonTemplateId: pplSeason.id, name: "Push", order: 1 },
  { id: "ppl-pull", seasonTemplateId: pplSeason.id, name: "Pull", order: 2 },
  { id: "ppl-legs", seasonTemplateId: pplSeason.id, name: "Legs", order: 3 },
];
