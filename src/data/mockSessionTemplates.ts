import type { SessionTemplate } from "../domain/models";
import { mockSeasonTemplates } from "./mockSeasonTemplates";

const seasonTemplate = mockSeasonTemplates[0]!;

export const mockSessionTemplates: SessionTemplate[] = [
  {
    id: "chest-back-1",
    seasonTemplateId: seasonTemplate.id,
    name: "Chest Back 1",
    order: 1,
  },
  {
    id: "arms-shoulder-1",
    seasonTemplateId: seasonTemplate.id,
    name: "Arms Shoulder 1",
    order: 2,
  },
  {
    id: "legs-1",
    seasonTemplateId: seasonTemplate.id,
    name: "Legs 1",
    order: 4,
  },
  {
    id: "chest-back-2",
    seasonTemplateId: seasonTemplate.id,
    name: "Chest Back 2",
    order: 5,
  },
  {
    id: "arms-shoulder-2",
    seasonTemplateId: seasonTemplate.id,
    name: "Arms Shoulder 2",
    order: 7,
  },
  {
    id: "legs-2",
    seasonTemplateId: seasonTemplate.id,
    name: "Legs 2",
    order: 8,
  },
];
