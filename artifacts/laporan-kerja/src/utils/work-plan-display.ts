import { WorkPlanItem } from "@/types/workPlan";

const normalizeText = (value?: string) => (value || "").trim();

const getUniqueTools = (tools: WorkPlanItem["tools"]) => {
  const seen = new Set<string>();

  return (tools || []).filter((tool) => {
    const key = JSON.stringify({
      name: normalizeText(tool.name),
      unit: Number(tool.unit || 0),
      usage: normalizeText(tool.usage),
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
