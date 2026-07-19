import { WorkPlanItem } from "@/types/workPlan";

export interface WorkPlanResourceGroup {
  items: WorkPlanItem[];
  tools: WorkPlanItem["tools"];
  coordinator: string;
  members: number;
  basis: string;
  remarks: string;
}

const normalizeText = (value?: string) => (value || "").trim();

const getUniqueTools = (tools: WorkPlanItem["tools"]) => {
  const seen = new Set<string>();

  return (tools || []).filter((tool) => {
    const key = JSON.stringify({
      name: normalizeText(tool.name),
      unit: Number(tool.unit || 0),
      usage: normalizeText(tool.usage),
      members: Number(tool.members || 0),
    });

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const getUniqueWorkPlanItems = (items: WorkPlanItem[]) => {
  const seen = new Set<string>();

  return items.reduce<WorkPlanItem[]>((uniqueItems, item) => {
    const uniqueTools = getUniqueTools(item.tools);
    const key = JSON.stringify({
      description: normalizeText(item.description),
      location: {
        street: normalizeText(item.location?.street),
        subDistrict: normalizeText(item.location?.subDistrict),
        village: Array.isArray(item.location?.village)
          ? item.location.village.map(normalizeText)
          : [normalizeText(item.location?.village)],
      },
      tools: uniqueTools.map((tool) => ({
        name: normalizeText(tool.name),
        unit: Number(tool.unit || 0),
        usage: normalizeText(tool.usage),
        members: Number(tool.members || 0),
      })),
      coordinator: normalizeText(item.coordinator),
      members: Number(item.personnel?.members || 0),
      basis: normalizeText(item.basis),
      remarks: normalizeText(item.remarks),
    });

    if (seen.has(key)) return uniqueItems;
    seen.add(key);
    uniqueItems.push({ ...item, tools: uniqueTools });
    return uniqueItems;
  }, []);
};

export const getSequentialSpans = <T>(
  items: T[],
  keyExtractor: (item: T) => string,
) => {
  const spans: number[] = [];
  let i = 0;

  while (i < items.length) {
    let j = i + 1;
    const currentKey = keyExtractor(items[i]);

    while (j < items.length && keyExtractor(items[j]) === currentKey) {
      j++;
    }

    const count = j - i;
    for (let k = 0; k < count; k++) spans.push(k === 0 ? count : 0);
    i = j;
  }

  return spans;
};

export const getWorkPlanResourceGroups = (items: WorkPlanItem[]) => {
  const groups: WorkPlanResourceGroup[] = [];

  getUniqueWorkPlanItems(items).forEach((item) => {
    const itemToolsJson = JSON.stringify(item.tools);
    const lastGroup = groups[groups.length - 1];
    const isSameResource =
      lastGroup &&
      JSON.stringify(lastGroup.tools) === itemToolsJson &&
      lastGroup.coordinator === item.coordinator &&
      lastGroup.members === item.personnel.members &&
      lastGroup.basis === item.basis;

    if (isSameResource) {
      lastGroup.items.push(item);
    } else {
      groups.push({
        items: [item],
        tools: item.tools,
        coordinator: item.coordinator,
        members: item.personnel.members,
        basis: item.basis,
        remarks: item.remarks,
      });
    }
  });

  return groups;
};

export const getRowsInWorkPlanItems = (items: WorkPlanItem[]) => (
  items.reduce((acc, item) => acc + Math.max(item.tools.length, 1), 0)
);

export const getRowsInResourceGroups = (groups: WorkPlanResourceGroup[]) => (
  groups.reduce((acc, group) => acc + Math.max(group.items.length, group.tools.length, 1), 0)
);

export const getResourceGroupItemSpanRows = (
  group: WorkPlanResourceGroup,
  itemIndex: number,
  span: number,
) => {
  const maxGroupRows = Math.max(group.items.length, group.tools.length, 1);
  const endRow = itemIndex + span >= group.items.length ? maxGroupRows : itemIndex + span;
  return endRow - itemIndex;
};
