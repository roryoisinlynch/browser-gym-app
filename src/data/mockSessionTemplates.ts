import type { SessionTemplate } from "../domain/models";
import { mockSeasonTemplates } from "./mockSeasonTemplates";

const seasonTemplate = mockSeasonTemplates[0]!;

export const mockSessionTemplates: SessionTemplate[] = [
  { id: "chest-back-a", seasonTemplateId: seasonTemplate.id, name: "Chest Back A", order: 1 },
  { id: "arms-shoulder-a", seasonTemplateId: seasonTemplate.id, name: "Arms Shoulder A", order: 2 },
  { id: "legs-a", seasonTemplateId: seasonTemplate.id, name: "Legs A", order: 3 },
  { id: "chest-back-b", seasonTemplateId: seasonTemplate.id, name: "Chest Back B", order: 4 },
  { id: "arms-shoulder-b", seasonTemplateId: seasonTemplate.id, name: "Arms Shoulder B", order: 5 },
  { id: "legs-b", seasonTemplateId: seasonTemplate.id, name: "Legs B", order: 6 },
];
