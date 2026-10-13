import { useEffect, useState } from "react";
import { notaDinasTemplateService } from "@/services/notaDinasTemplateService";
import type { NotaDinasCategory, NotaDinasTemplate } from "@/types/notaDinas";

type AccountRegion = { id: string; name: string; notaCode: string } | null;

export function useNotaDinasTemplates(
  category: NotaDinasCategory,
  accountRegion: AccountRegion,
  isActive: boolean | undefined,
  pathname: string,
) {
  const [sheetTemplate, setSheetTemplate] = useState(() => notaDinasTemplateService.buildDefaultTemplate("permintaan_alat"));
  const [availableTemplates, setAvailableTemplates] = useState<NotaDinasTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  useEffect(() => {
    const regionId = accountRegion?.id ?? null;
    let active = true;

    void notaDinasTemplateService
      .getTemplatesByKategori(category, regionId)
      .then((templates) => {
        if (!active) return;
        setAvailableTemplates(templates);

        // Utamakan template default wilayah, lalu fallback ke template global.
        const ownTemplates = regionId
          ? templates.filter((template) => template.regionId === regionId)
          : templates.filter((template) => template.regionId === null);
        const globalTemplates = regionId ? templates.filter((template) => template.regionId === null) : [];
        const defaultTemplate = ownTemplates.find((template) => template.isDefault)
          ?? ownTemplates[0]
          ?? globalTemplates.find((template) => template.isDefault)
          ?? globalTemplates[0];

        if (defaultTemplate) {
          setSelectedTemplateId(defaultTemplate.id);
          setSheetTemplate(defaultTemplate);
        } else {
          setSelectedTemplateId("");
          setSheetTemplate(notaDinasTemplateService.buildDefaultTemplate(category));
        }
      })
      .catch(() => {
        if (!active) return;
        setAvailableTemplates([]);
        setSelectedTemplateId("");
        setSheetTemplate(notaDinasTemplateService.buildDefaultTemplate(category));
      });

    return () => { active = false; };
  // pathname also refreshes templates after returning from the template editor.
  }, [category, accountRegion, isActive, pathname]);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = availableTemplates.find((item) => item.id === templateId);
    if (template) setSheetTemplate(template);
  };

  return {
    sheetTemplate,
    setSheetTemplate,
    availableTemplates,
    selectedTemplateId,
    setSelectedTemplateId,
    handleTemplateSelect,
  };
}
