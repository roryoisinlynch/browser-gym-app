import type { WeekInstanceItem } from "../domain/models";
import { mockSessionInstances } from "./mockSessionInstances";

import { mockWeekInstances } from "./mockWeekInstances";
import { mockWeekTemplateItems } from "./mockWeekTemplateItems";
import { mockWeekTemplates } from "./mockWeekTemplates";

function getTemplateItemsForWeekTemplate(weekTemplateId: string) {
  return mockWeekTemplateItems
    .filter((item) => item.weekTemplateId === weekTemplateId)
    .sort((a, b) => a.order - b.order);
}

export const mockWeekInstanceItems: WeekInstanceItem[] = mockWeekInstances.flatMap(
  (weekInstance) => {
    const weekTemplate = mockWeekTemplates.find(
      (template) => template.id === weekInstance.weekTemplateId
    )!;

    const sessionInstancesForWeek = mockSessionInstances.filter(
      (session) => session.weekInstanceId === weekInstance.id
    );

    const sessionByTemplateId = new Map(
      sessionInstancesForWeek.map((session) => [session.sessionTemplateId, session])
    );

    return getTemplateItemsForWeekTemplate(weekTemplate.id).map((templateItem) => ({
      id: `${weekInstance.id}-${templateItem.id}`,
      weekInstanceId: weekInstance.id,
      weekTemplateItemId: templateItem.id,
      order: templateItem.order,
      type: templateItem.type,
      sessionInstanceId: templateItem.sessionTemplateId
        ? sessionByTemplateId.get(templateItem.sessionTemplateId)?.id
        : undefined,
      label: templateItem.label ?? null,
    }));
  }
);