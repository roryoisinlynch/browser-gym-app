import type { WeekTemplateItem } from "../domain/models";
import { mockWeekTemplates } from "./mockWeekTemplates";
import { mockSessionTemplates } from "./mockSessionTemplates";

const weekTemplate = mockWeekTemplates[0]!;

function sessionById(id: string) {
  return mockSessionTemplates.find((session) => session.id === id)!;
}

export const mockWeekTemplateItems: WeekTemplateItem[] = [
  {
    id: `${weekTemplate.id}-item-1`,
    weekTemplateId: weekTemplate.id,
    order: 1,
    type: "session",
    sessionTemplateId: sessionById("chest-back-1").id,
  },
  {
    id: `${weekTemplate.id}-item-2`,
    weekTemplateId: weekTemplate.id,
    order: 2,
    type: "session",
    sessionTemplateId: sessionById("arms-shoulder-1").id,
  },
  {
    id: `${weekTemplate.id}-item-3`,
    weekTemplateId: weekTemplate.id,
    order: 3,
    type: "rest",
    label: "Rest",
  },
  {
    id: `${weekTemplate.id}-item-4`,
    weekTemplateId: weekTemplate.id,
    order: 4,
    type: "session",
    sessionTemplateId: sessionById("legs-1").id,
  },
  {
    id: `${weekTemplate.id}-item-5`,
    weekTemplateId: weekTemplate.id,
    order: 5,
    type: "session",
    sessionTemplateId: sessionById("chest-back-2").id,
  },
  {
    id: `${weekTemplate.id}-item-6`,
    weekTemplateId: weekTemplate.id,
    order: 6,
    type: "rest",
    label: "Rest",
  },
  {
    id: `${weekTemplate.id}-item-7`,
    weekTemplateId: weekTemplate.id,
    order: 7,
    type: "session",
    sessionTemplateId: sessionById("arms-shoulder-2").id,
  },
  {
    id: `${weekTemplate.id}-item-8`,
    weekTemplateId: weekTemplate.id,
    order: 8,
    type: "session",
    sessionTemplateId: sessionById("legs-2").id,
  },
  {
    id: `${weekTemplate.id}-item-9`,
    weekTemplateId: weekTemplate.id,
    order: 9,
    type: "rest",
    label: "Rest",
  },
];
