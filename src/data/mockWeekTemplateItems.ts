import type { WeekTemplateItem } from "../domain/models";
import { mockWeekTemplates } from "./mockWeekTemplates";
import { mockSessionTemplates } from "./mockSessionTemplates";

const weekTemplate = mockWeekTemplates[0]!;
const pplWeekTemplate = mockWeekTemplates[1]!;

function sessionById(id: string) {
  return mockSessionTemplates.find((s) => s.id === id)!;
}

export const mockWeekTemplateItems: WeekTemplateItem[] = [
  {
    id: `${weekTemplate.id}-item-1`,
    weekTemplateId: weekTemplate.id,
    order: 1,
    type: "session",
    sessionTemplateId: sessionById("chest-back-a").id,
  },
  {
    id: `${weekTemplate.id}-item-2`,
    weekTemplateId: weekTemplate.id,
    order: 2,
    type: "session",
    sessionTemplateId: sessionById("arms-shoulder-a").id,
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
    sessionTemplateId: sessionById("legs-a").id,
  },
  {
    id: `${weekTemplate.id}-item-5`,
    weekTemplateId: weekTemplate.id,
    order: 5,
    type: "session",
    sessionTemplateId: sessionById("chest-back-b").id,
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
    sessionTemplateId: sessionById("arms-shoulder-b").id,
  },
  {
    id: `${weekTemplate.id}-item-8`,
    weekTemplateId: weekTemplate.id,
    order: 8,
    type: "session",
    sessionTemplateId: sessionById("legs-b").id,
  },
  {
    id: `${weekTemplate.id}-item-9`,
    weekTemplateId: weekTemplate.id,
    order: 9,
    type: "rest",
    label: "Rest",
  },

  // ── PPL week (Push · Rest · Pull · Rest · Legs · Rest · Rest) ─────────────
  {
    id: `${pplWeekTemplate.id}-item-1`,
    weekTemplateId: pplWeekTemplate.id,
    order: 1,
    type: "session",
    sessionTemplateId: sessionById("ppl-push").id,
  },
  {
    id: `${pplWeekTemplate.id}-item-2`,
    weekTemplateId: pplWeekTemplate.id,
    order: 2,
    type: "rest",
    label: "Rest",
  },
  {
    id: `${pplWeekTemplate.id}-item-3`,
    weekTemplateId: pplWeekTemplate.id,
    order: 3,
    type: "session",
    sessionTemplateId: sessionById("ppl-pull").id,
  },
  {
    id: `${pplWeekTemplate.id}-item-4`,
    weekTemplateId: pplWeekTemplate.id,
    order: 4,
    type: "rest",
    label: "Rest",
  },
  {
    id: `${pplWeekTemplate.id}-item-5`,
    weekTemplateId: pplWeekTemplate.id,
    order: 5,
    type: "session",
    sessionTemplateId: sessionById("ppl-legs").id,
  },
  {
    id: `${pplWeekTemplate.id}-item-6`,
    weekTemplateId: pplWeekTemplate.id,
    order: 6,
    type: "rest",
    label: "Rest",
  },
  {
    id: `${pplWeekTemplate.id}-item-7`,
    weekTemplateId: pplWeekTemplate.id,
    order: 7,
    type: "rest",
    label: "Rest",
  },
];
