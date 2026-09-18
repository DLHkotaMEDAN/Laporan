"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Save, ArrowLeft, Loader2, MapPin, Users, Wrench, FileText, MessageSquare, ClipboardList, ShieldAlert, Check, HelpCircle, Copy, AlertCircle, Info, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { showSuccess, showError } from '@/utils/toast';
import { WorkPlan } from '@/types/workPlan';
import { medanDistricts } from '@/data/medan-districts';
import { workPlanService } from '@/services/workPlanService';
import { auditLogService } from '@/services/auditLogService';
import { useAuth } from '@/context/AuthContext';
import { Badge } from "@/components/ui/badge";
import { cn, uniqueAutocompleteValues } from "@/lib/utils";
import { useAvailableTeams } from '@/hooks/useAvailableTeams';
import { useFormDraft } from '@/hooks/useFormDraft';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const toolUsageMapping: Record<string, string> = {
  "Mobil Tangga (BK 9044 J)": "Alat Bantu Untuk Menjangkau Ranting Yang Tinggi",
  "Dump Truck (BK8559 J)": "Pengangkut Sampah Pemangkasan Pohon",
  "Chainsaw": "Alat Pemotong Pohon dan Ranting",
  "Truk Siram (BK 8128 A)": "Penyiraman Tanaman Median Jalan",
  "Truk Siram (BK 9031 J)": "Penyiraman Tanaman Median Jalan",
  "Mesin Babat": "Memotong Rumput"
};

const categoryCoordinatorMapping: Record<string, string> = {
  "Tim Pohon": "Budi",
  "Tim Babat": "Benget Simanjuntak",
  "Taman Kota": "Mhd. Said",
  "Taman Amplas": "Erwinsyah",
  "Taman Area": "Ismail Siregar",
};

const defaultActivityMapping: Record<string, string> = {
  "Taman Kota": "Perawatan dan Pembersihan Taman Media ",
  "Taman Area": "Perawatan dan Pembersihan Taman Media ",
  "Taman Amplas": "Perawatan dan Pembersihan Taman Media ",
};

const toolCoordinatorMapping: Record<string, string> = {
  "Truk Siram (BK 8128 A)": "M. Irwan Syahputra, SE",
  "Truk Siram (BK 9031 J)": "Aluddin Gultom",
};

const collectSearchValues = (value: unknown, values: string[] = []): string[] => {
  if (typeof value === "string" || typeof value === "number") {
    values.push(String(value));
  } else if (Array.isArray(value)) {
    value.forEach(entry => collectSearchValues(entry, values));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach(entry => collectSearchValues(entry, values));
  }
  return values;
};

const normalizeSearchText = (value: string) => value
  .toLocaleLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "");

const matchesGlobalSearch = (query: string, searchableValues: string[]) => {
  const normalizedQuery = normalizeSearchText(query.trim());
  if (!normalizedQuery) return true;

  const searchableText = normalizeSearchText(searchableValues.join(" "));
  return normalizedQuery.split(/[^a-z0-9]+/).filter(Boolean).every(queryToken => searchableText.includes(queryToken));
};

type WorkPlanItemFormValue = WorkPlan["items"][number] & {
  uiMode?: 'full' | 'activity_location' | 'location_only';
};

const getToolsSignature = (item: Pick<WorkPlanItemFormValue, "tools">) => JSON.stringify(
  (item.tools || []).map(tool => ({
    name: tool.name || "",
    unit: Number(tool.unit || 0),
    usage: tool.usage || "",
    members: Number(tool.members || 0),
  }))
);

const withInferredUiModes = <T extends WorkPlanItemFormValue>(items: T[]) => items.map((item, index) => {
  const previous = items[index - 1];
  const hasSameToolsAsPrevious = previous && getToolsSignature(previous) === getToolsSignature(item);
  const hasSameDescriptionAsPrevious = previous && (previous.description || "").trim() === (item.description || "").trim();

  return {
    ...item,
    uiMode: hasSameToolsAsPrevious
      ? (hasSameDescriptionAsPrevious ? 'location_only' as const : 'activity_location' as const)
      : 'full' as const,
  };
});

const toolSchema = z.object({
  name: z.string().optional().default(""),
  unit: z.coerce.number().default(0),
  usage: z.string().optional().default(""),
  members: z.coerce.number().min(0).optional().default(0),
});

const itemSchema = z.object({
  description: z.string().default(""),
  location: z.object({
    street: z.string().default(""),
    village: z.array(z.string()).default([""]),
    subDistrict: z.string().default(""),
  }),
  target_area: z.coerce.number().min(0).optional().default(0),
  fuel_need_liters: z.coerce.number().min(0).optional().default(0),
  fuel_usage_estimate: z.string().optional().default(""),
  tools: z.array(toolSchema).default([]),
  coordinator: z.string().optional().default(""),
  foreman: z.string().optional().default(""),
  personnel: z.object({ members: z.coerce.number().min(0) }),
  basis: z.string().default(""),
  remarks: z.string().optional().default(""),
  uiMode: z.enum(['full', 'activity_location', 'location_only']).default('full'),
});

const formSchema = z.object({
  date: z.string().min(1, "Tanggal wajib diisi"),
  category: z.string().min(1, "Kategori wajib dipilih"),
  has_no_activity: z.boolean().default(false),
  no_activity_remarks: z.string().optional().default(""),
  items: z.array(itemSchema).min(1),
  globalTools: z.array(toolSchema).optional().default([{ name: "", unit: 1, usage: "", members: 0 }]),
  globalCoordinator: z.string().optional().default(""),
  globalForeman: z.string().optional().default(""),
  globalMembers: z.coerce.number().optional().default(0),
});

const WorkPlanForm = ({ initialData, isEditing = false }: { initialData?: WorkPlan; isEditing?: boolean }) => {
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showAddChoiceDialog, setShowAddChoiceDialog] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateDate, setDuplicateDate] = useState("");
  const [isDuplicateMode, setIsDuplicateMode] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [sourcePlans, setSourcePlans] = useState<WorkPlan[]>([]);
  const [sourcePlanId, setSourcePlanId] = useState("");
  const [selectedSourceItemIds, setSelectedSourceItemIds] = useState<number[]>([]);
  const [sourceSearchQuery, setSourceSearchQuery] = useState("");

  // Autocomplete States
  const [history, setHistory] = useState({
    descriptions: new Set<string>(),
    streets: new Set<string>(),
    coordinators: new Set<string>(),
    foremen: new Set<string>(),
    toolNames: new Set<string>(Object.keys(toolUsageMapping)),
    basis: new Set<string>(),
    remarks: new Set<string>(),
  });

  const isPimpinan = profile?.role === 'pimpinan' || (session?.user?.email === 'pimpinan@gmail.com');
  const activeRegionId = profile?.region_id ?? initialData?.region_id ?? null;
  const { teams } = useAvailableTeams(activeRegionId);

  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData ? {
      date: initialData.date,
      category: initialData.category,
      has_no_activity: initialData.items[0]?.description === "TIDAK ADA RENCANA KERJA/ KEGIATAN",
      no_activity_remarks: initialData.items[0]?.description === "TIDAK ADA RENCANA KERJA/ KEGIATAN" ? initialData.items[0]?.remarks : "",
      items: withInferredUiModes(initialData.items.map(item => ({
        ...item,
        target_area: item.target_area ?? 0,
        fuel_need_liters: item.fuel_need_liters ?? 0,
        fuel_usage_estimate: item.fuel_usage_estimate ?? "",
        foreman: item.foreman ?? "",
        tools: item.tools.map((tool, toolIndex) => ({
          ...tool,
          members: tool.members ?? (initialData.category === "Tim Pohon" && toolIndex === 0 ? item.personnel.members : 0),
        })),
        uiMode: 'full' as const,
      }))),
      globalTools: initialData.category === "Tim Babat" ? initialData.items[0].tools.map(tool => ({ ...tool, members: tool.members ?? 0 })) : [{ name: "", unit: 1, usage: "", members: 0 }],
      globalCoordinator: initialData.category === "Tim Babat" ? initialData.items[0].coordinator : "",
      globalForeman: initialData.category === "Tim Babat" ? initialData.items[0].foreman || "" : "",
      globalMembers: initialData.category === "Tim Babat" ? initialData.items[0].personnel.members : 0,
    } : {
      date: getTomorrowDate(),
      category: profile?.role === 'user' ? (profile?.category || "") : "",
      has_no_activity: false,
      no_activity_remarks: "",
      items: [{ description: "", location: { street: "", village: [""], subDistrict: "" }, target_area: 0, fuel_need_liters: 0, fuel_usage_estimate: "", tools: [{ name: "", unit: 1, usage: "", members: 0 }], coordinator: "", foreman: "", personnel: { members: 0 }, basis: "", remarks: "", uiMode: 'full' }],
      globalTools: [{ name: "", unit: 1, usage: "", members: 0 }],
      globalCoordinator: "",
      globalForeman: "",
      globalMembers: 0,
    },
  });

  const { fields: itemFields, append: appendItem, remove: removeItem, replace: replaceItems } = useFieldArray({ control: form.control, name: "items" });
  const selectedCategory = form.watch("category");
  const selectedTeamId = teams.find(team => team.name === selectedCategory)?.id ?? initialData?.team_id ?? profile?.team_id ?? null;
  const draftKey = session?.user?.id ? `work-plan:${session.user.id}:${initialData?.id ?? "new"}` : undefined;
  const { clearDraft, lastSavedAt, restoredAt } = useFormDraft(form, draftKey);
  const hasNoActivity = form.watch("has_no_activity");
  const isGlobalStyle = selectedCategory === "Tim Babat";
  const fuelNeedCategories = ["Tim Siram"];
  const fuelEstimateCategories = ["Tim Siram", "Becak Sampah", "Becak Siram"];
  const isFuelNeedCategory = fuelNeedCategories.includes(selectedCategory);
  const isFuelEstimateCategory = fuelEstimateCategories.includes(selectedCategory);
  const isFuelPlanningCategory = isFuelEstimateCategory;
  const useWizard = selectedCategory === "Tim Siram" || selectedCategory === "Tim Pohon";
  const lastFocusState = useRef<{ selector?: string; selectionStart?: number | null; selectionEnd?: number | null; scrollX: number; scrollY: number } | null>(null);

  useEffect(() => {
    if (restoredAt) showSuccess("Draf rencana kerja sebelumnya dipulihkan");
  }, [restoredAt]);

  useEffect(() => {
    const getFocusSelector = (element: Element | null) => {
      if (!(element instanceof HTMLElement)) return undefined;
      if (element.id) return `#${CSS.escape(element.id)}`;
      const name = element.getAttribute("name");
      if (name) return `[name="${CSS.escape(name)}"]`;
      return undefined;
    };

    const storeViewState = () => {
      const activeElement = document.activeElement;
      lastFocusState.current = {
        selector: getFocusSelector(activeElement),
        selectionStart: activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement ? activeElement.selectionStart : null,
        selectionEnd: activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement ? activeElement.selectionEnd : null,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
      };
    };

    const restoreViewState = () => {
      const state = lastFocusState.current;
      if (!state) return;
      window.requestAnimationFrame(() => {
        window.scrollTo(state.scrollX, state.scrollY);
        if (!state.selector) return;
        const element = document.querySelector(state.selector);
        if (!(element instanceof HTMLElement)) return;
        element.focus({ preventScroll: true });
        if (
          (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)
          && state.selectionStart !== null
          && state.selectionEnd !== null
        ) {
          element.setSelectionRange(state.selectionStart, state.selectionEnd);
        }
        window.scrollTo(state.scrollX, state.scrollY);
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") storeViewState();
      if (document.visibilityState === "visible") restoreViewState();
    };

    window.addEventListener("blur", storeViewState);
    window.addEventListener("focus", restoreViewState);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("blur", storeViewState);
      window.removeEventListener("focus", restoreViewState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!activeRegionId) return;

      try {
        const plans = await workPlanService.getAllWorkPlans(null, false, activeRegionId);
        setSourcePlans(plans);
        const descs = new Set<string>();
        const streets = new Set<string>();
        const coords = new Set<string>();
        const foremen = new Set<string>();
        const tools = new Set<string>(history.toolNames);
        const basis = new Set<string>();
        const rems = new Set<string>();

        plans.forEach(p => {
          p.items?.forEach(item => {
            if (item.description) descs.add(item.description);
            if (item.location?.street) streets.add(item.location.street);
            if (item.coordinator) coords.add(item.coordinator);
            if (item.foreman) foremen.add(item.foreman);
            if (item.basis) basis.add(item.basis);
            if (item.remarks) rems.add(item.remarks);
            item.tools?.forEach(t => {
              if (t.name) tools.add(t.name);
            });
          });
        });

        setHistory({
          descriptions: descs,
          streets: streets,
          coordinators: coords,
          foremen,
          toolNames: tools,
          basis: basis,
          remarks: rems
        });
      } catch (e) { console.error(e); }
    };
    fetchHistory();
  }, [activeRegionId, initialData?.id]);

  useEffect(() => {
    if (!isEditing && !isDuplicateMode && selectedCategory) {
      const autoCoord = categoryCoordinatorMapping[selectedCategory];
      if (autoCoord && isGlobalStyle && !form.getValues("globalCoordinator")) form.setValue("globalCoordinator", autoCoord);
      
      const defaultDesc = defaultActivityMapping[selectedCategory];
      if (defaultDesc) {
        const currentItems = form.getValues("items");
        const updatedItems = currentItems.map(item => ({
          ...item,
          description: item.description === "" ? defaultDesc : item.description
        }));
        form.setValue("items", updatedItems);
      }
    }
  }, [selectedCategory, isGlobalStyle, isEditing, isDuplicateMode, form]);

  useEffect(() => {
    if (isFuelPlanningCategory || restoredAt) return;
    const currentItems = form.getValues("items");
    const clearedItems = currentItems.map(item => ({
      ...item,
      fuel_need_liters: 0,
      fuel_usage_estimate: "",
    }));
    form.setValue("items", clearedItems);
  }, [form, isFuelPlanningCategory, selectedCategory]);

  const performAppend = (mode: 'full' | 'activity_location' | 'location_only') => {
    const items = form.getValues("items");
    const lastItem = items[items.length - 1];
    let defaultCoord = isGlobalStyle ? form.getValues("globalCoordinator") : (categoryCoordinatorMapping[selectedCategory] || lastItem?.coordinator || "");
    const defaultForeman = isGlobalStyle ? form.getValues("globalForeman") : (lastItem?.foreman || "");
    const defaultDesc = defaultActivityMapping[selectedCategory] || "";
    const isSameToolLocation = mode === 'activity_location' || mode === 'location_only';
    const movedFuelNeedLiters = isFuelNeedCategory && isSameToolLocation ? Number(lastItem?.fuel_need_liters || 0) : 0;
    const movedFuelUsageEstimate = isFuelEstimateCategory && isSameToolLocation ? lastItem?.fuel_usage_estimate || "" : "";
    const movedRemarks = isSameToolLocation ? lastItem?.remarks || "" : "";

    if (mode === 'full') {
      appendItem({ 
        description: defaultDesc, 
        location: { street: "", village: [""], subDistrict: lastItem?.location.subDistrict || "" }, 
        target_area: 0,
        fuel_need_liters: 0,
        fuel_usage_estimate: "",
        tools: isGlobalStyle ? [] : [{ name: "", unit: 1, usage: "", members: 0 }], 
        coordinator: defaultCoord, 
        foreman: defaultForeman,
        personnel: { members: isGlobalStyle ? form.getValues("globalMembers") : lastItem?.personnel.members || 0 }, 
        basis: lastItem?.basis || "", 
        remarks: "", 
        uiMode: 'full' 
      });
    } else if (mode === 'activity_location') {
      replaceItems([
        ...items.slice(0, -1),
        { ...lastItem, fuel_need_liters: 0, fuel_usage_estimate: "", remarks: "" },
        { description: defaultDesc, location: { street: "", village: [""], subDistrict: lastItem?.location.subDistrict || "" }, target_area: 0, fuel_need_liters: movedFuelNeedLiters, fuel_usage_estimate: movedFuelUsageEstimate, tools: lastItem.tools.map(t => ({ ...t })), coordinator: lastItem.coordinator, foreman: lastItem.foreman || "", personnel: { ...lastItem.personnel }, basis: lastItem.basis, remarks: movedRemarks, uiMode: 'activity_location' }
      ]);
    } else if (mode === 'location_only') {
      replaceItems([
        ...items.slice(0, -1),
        { ...lastItem, fuel_need_liters: 0, fuel_usage_estimate: "", remarks: "" },
        { description: lastItem.description || defaultDesc, location: { street: "", village: [""], subDistrict: lastItem?.location.subDistrict || "" }, target_area: 0, fuel_need_liters: movedFuelNeedLiters, fuel_usage_estimate: movedFuelUsageEstimate, tools: lastItem.tools.map(t => ({ ...t })), coordinator: lastItem.coordinator, foreman: lastItem.foreman || "", personnel: { ...lastItem.personnel }, basis: lastItem.basis, remarks: movedRemarks, uiMode: 'location_only' }
      ]);
    }
    setShowWizard(false);
  };

  const handleAddClick = () => {
    setShowAddChoiceDialog(true);
  };

  const handleManualAddChoice = () => {
    setShowAddChoiceDialog(false);
    if (useWizard) {
      setWizardStep(1);
      setShowWizard(true);
    } else {
      performAppend('full');
    }
  };

  const handleCopyAddChoice = () => {
    setShowAddChoiceDialog(false);
    openCopyDialog();
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (profile?.is_active === false) {
      showError("Akun nonaktif hanya dapat melihat dan mencetak data.");
      return;
    }
    if (isPimpinan) { showError("Akses ditolak"); return; }
    setIsSubmitting(true);
    try {
      let processedItems;
      
      if (values.has_no_activity) {
        processedItems = [{
          description: "TIDAK ADA RENCANA KERJA/ KEGIATAN",
          location: { street: "-", village: ["-"], subDistrict: "-" },
          target_area: 0,
          fuel_need_liters: 0,
          fuel_usage_estimate: "",
          tools: [],
          coordinator: "-",
          foreman: "-",
          personnel: { members: 0 },
          basis: "-",
          remarks: values.no_activity_remarks || ""
        }];
      } else {
        const cleanGlobalTools = values.globalTools?.filter(t => t.name && t.name.trim() !== "") || [];
        processedItems = values.items.map(item => {
          const { uiMode, ...rest } = item;
          const canSaveFuelNeed = fuelNeedCategories.includes(values.category);
          const canSaveFuelEstimate = fuelEstimateCategories.includes(values.category);
          const fuelFields = canSaveFuelEstimate
            ? {
                fuel_need_liters: canSaveFuelNeed ? rest.fuel_need_liters ?? 0 : 0,
                fuel_usage_estimate: rest.fuel_usage_estimate ?? "",
              }
            : {
                fuel_need_liters: 0,
                fuel_usage_estimate: "",
              };
          if (isGlobalStyle) {
            return { ...rest, ...fuelFields, tools: cleanGlobalTools, coordinator: values.globalCoordinator || "", foreman: values.globalForeman || "", personnel: { members: values.globalMembers || 0 } };
          }
          const tools = item.tools.filter(t => t.name && t.name.trim() !== "");
          const personnel = values.category === "Tim Pohon"
            ? { members: tools.reduce((total, tool) => total + Number(tool.members || 0), 0) }
            : item.personnel;
          return { ...rest, ...fuelFields, tools, personnel };
        });
      }

      const finalValues = { 
        region_id: profile?.region_id ?? initialData?.region_id ?? null,
        team_id: selectedTeamId,
        date: values.date, 
        category: values.category, 
        items: processedItems
      };
      
      let result;
      if (isEditing && initialData && !isDuplicateMode) {
        result = await workPlanService.updateWorkPlan(initialData.id, finalValues as Partial<WorkPlan>);
        if (session?.user) {
          await auditLogService.logAction({
            action: 'UPDATE',
            entityType: 'WORK_PLAN',
            entityId: initialData.id,
            details: { title: processedItems[0]?.description, date: values.date, category: values.category },
            userId: session.user.id,
            username: profile?.username || session.user.email || "User"
          });
        }
        showSuccess("Rencana Kerja diperbarui!");
      } else {
        result = await workPlanService.createWorkPlan(finalValues as Omit<WorkPlan, 'id' | 'created_at'>);
        if (session?.user) {
          await auditLogService.logAction({
            action: 'CREATE',
            entityType: 'WORK_PLAN',
            entityId: result.id,
            details: { title: isDuplicateMode ? `(Duplikat) ${processedItems[0]?.description}` : processedItems[0]?.description, date: values.date, category: values.category },
            userId: session.user.id,
            username: profile?.username || session.user.email || "User"
          });
        }
        showSuccess(isDuplicateMode ? "Rencana Kerja baru berhasil dibuat dari duplikat!" : "Rencana Kerja disimpan!");
      }
      await clearDraft();
      navigate('/work-plans');
    } catch (error: any) {
      console.error(error);
      showError("Gagal menyimpan: " + (error.message || "Terjadi kesalahan database"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDuplicate = () => {
    if (!duplicateDate) { showError("Pilih tanggal"); return; }
    form.setValue("date", duplicateDate);
    setIsDuplicateMode(true);
    showSuccess(`Data disalin ke tanggal ${duplicateDate}. Silakan periksa dan klik Simpan.`);
    setShowDuplicateDialog(false);
  };

  const currentPlanDate = form.watch("date");
  const matchingSourcePlans = selectedCategory
    ? sourcePlans.filter(plan => plan.id !== initialData?.id && plan.category === selectedCategory && plan.date < currentPlanDate)
    : [];
  const selectedSourcePlan = matchingSourcePlans.find(plan => plan.id === sourcePlanId);

  const sourceSearch = sourceSearchQuery.trim().toLowerCase();
  const filteredSourcePlans = matchingSourcePlans.filter(plan => {
    if (!sourceSearch) return true;
    return matchesGlobalSearch(sourceSearch, collectSearchValues(plan));
  });
  const filteredSourceItems = selectedSourcePlan?.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !sourceSearch || matchesGlobalSearch(sourceSearch, collectSearchValues(item))) || [];

  const formatSourceLocation = (plan: WorkPlan) => {
    const location = plan.items?.[0]?.location;
    if (!location) return "Lokasi tidak ditentukan";
    const village = Array.isArray(location.village) ? location.village.filter(Boolean).join(", ") : "";
    return [location.street, village, location.subDistrict].filter(Boolean).join(", ") || "Lokasi tidak ditentukan";
  };

  const openCopyDialog = () => {
    if (!selectedCategory) {
      showError("Pilih Tim/Kategori terlebih dahulu");
      return;
    }
    setSourcePlanId("");
    setSelectedSourceItemIds([]);
    setSourceSearchQuery("");
    setShowCopyDialog(true);
  };

  const handleSourcePlanChange = (id: string) => {
    setSourcePlanId(id);
    const plan = matchingSourcePlans.find(source => source.id === id);
    setSelectedSourceItemIds(plan?.items?.map((_, index) => index) || []);
  };

  const toggleSourceItem = (index: number, checked: boolean) => {
    setSelectedSourceItemIds(current => checked
      ? [...new Set([...current, index])]
      : current.filter(itemIndex => itemIndex !== index));
  };

  const copySelectedActivities = () => {
    if (!selectedSourcePlan || selectedSourceItemIds.length === 0 || filteredSourceItems.length === 0) {
      showError("Pilih rencana dan minimal satu lokasi/kegiatan");
      return;
    }

    const visibleSourceItemIds = new Set(filteredSourceItems.map(({ index }) => index));
    const copiedItems = selectedSourceItemIds
      .filter(index => visibleSourceItemIds.has(index))
      .sort((a, b) => a - b)
      .map(index => selectedSourcePlan.items[index])
      .filter(Boolean)
      .map(item => ({
        description: item.description || "",
        location: {
          street: item.location?.street || "",
          village: [...(item.location?.village || [])],
          subDistrict: item.location?.subDistrict || "",
        },
        target_area: Number(item.target_area || 0),
        fuel_need_liters: Number(item.fuel_need_liters || 0),
        fuel_usage_estimate: item.fuel_usage_estimate || "",
        tools: (item.tools || []).map(tool => ({ ...tool, members: tool.members ?? 0 })),
        coordinator: item.coordinator || "",
        foreman: item.foreman || "",
        personnel: { members: Number(item.personnel?.members || 0) },
        basis: item.basis || "",
        remarks: item.remarks || "",
        uiMode: 'full' as const,
      }));

    const currentItems = form.getValues("items");
    const hasOnlyEmptyItem = currentItems.length === 1
      && !currentItems[0].description
      && !currentItems[0].location?.street;
    replaceItems(withInferredUiModes(hasOnlyEmptyItem ? copiedItems : [...currentItems, ...copiedItems]));
    form.setValue("category", selectedSourcePlan.category);
    form.setValue("has_no_activity", false);

    if (selectedSourcePlan.category === "Tim Babat") {
      const first = selectedSourcePlan.items[0];
      form.setValue("globalTools", (first?.tools || []).map(tool => ({ ...tool, members: tool.members ?? 0 })));
      form.setValue("globalCoordinator", first?.coordinator || "");
      form.setValue("globalForeman", first?.foreman || "");
      form.setValue("globalMembers", Number(first?.personnel?.members || 0));
    }

    setShowCopyDialog(false);
    showSuccess(`${copiedItems.length} lokasi/kegiatan berhasil disalin ke formulir`);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 max-w-5xl mx-auto pb-20">
        {/* DataLists for Autocomplete */}
        <datalist id="wp-history-descriptions">{uniqueAutocompleteValues(history.descriptions).map(v => <option key={v} value={v} />)}</datalist>
        <datalist id="wp-history-streets">{uniqueAutocompleteValues(history.streets).map(v => <option key={v} value={v} />)}</datalist>
        <datalist id="wp-history-coordinators">{uniqueAutocompleteValues(history.coordinators).map(v => <option key={v} value={v} />)}</datalist>
        <datalist id="wp-history-foremen">{uniqueAutocompleteValues(history.foremen).map(v => <option key={v} value={v} />)}</datalist>
        <datalist id="wp-history-tools">{uniqueAutocompleteValues(history.toolNames).map(v => <option key={v} value={v} />)}</datalist>
        <datalist id="wp-history-basis">{uniqueAutocompleteValues(history.basis).map(v => <option key={v} value={v} />)}</datalist>
        <datalist id="wp-history-remarks">{uniqueAutocompleteValues(history.remarks).map(v => <option key={v} value={v} />)}</datalist>

        <div className="flex items-center justify-between mb-6">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)} className="px-2 md:px-4">
            <ArrowLeft className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Kembali</span>
          </Button>
          <div className="flex flex-col items-center">
            <h1 className="text-lg md:text-2xl font-bold text-primary">{isEditing && !isDuplicateMode ? "Edit Rencana Kerja" : "Buat Rencana Kerja Baru"}</h1>
            {isDuplicateMode && <Badge className="bg-amber-100 text-amber-700 border-amber-200 mt-1 animate-pulse"><Copy size={10} className="mr-1" /> Mode Duplikat: Belum Tersimpan</Badge>}
            <p className="text-[10px] text-slate-500 mt-1">{lastSavedAt ? "Draft tersimpan" : "Draft akan tersimpan otomatis"}</p>
          </div>
          <div className="flex gap-2">
            {isEditing && !isDuplicateMode && <Button type="button" variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50 px-2 md:px-4" onClick={() => { setDuplicateDate(getTomorrowDate()); setShowDuplicateDialog(true); }}><Copy className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Duplikat</span></Button>}
            <Button type="submit" disabled={isSubmitting || isPimpinan} className={cn("bg-blue-600 hover:bg-blue-700 px-2 md:px-4", isPimpinan && "opacity-50 cursor-not-allowed")}>{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin md:mr-2" /> : <Save className="h-4 w-4 md:mr-2" />} <span className="hidden md:inline">{isDuplicateMode ? "Simpan Sebagai Baru" : "Simpan"}</span></Button>
          </div>
        </div>

        {isDuplicateMode && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 text-amber-800 shadow-sm">
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-sm">Perhatian: Mode Duplikat Aktif</p>
              <p className="text-xs opacity-90">Data telah disalin ke tanggal baru. Perubahan yang Anda buat sekarang tidak akan mengubah data asli, melainkan akan disimpan sebagai <strong>Rencana Kerja Baru</strong> saat Anda menekan tombol Simpan.</p>
            </div>
          </div>
        )}

        <Card className="border-t-4 border-t-blue-500">
          <CardHeader><CardTitle className="text-lg">Informasi Umum</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {profile?.region_id && <p className="rounded-md bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800">Wilayah Login: otomatis sesuai akun Anda</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="date" render={({ field }) => (<FormItem><FormLabel>Tanggal Rencana</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>)} />
              <FormField control={form.control} name="category" render={({ field }) => (<FormItem><FormLabel>Kategori / Tim</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={profile?.role === 'user' || !activeRegionId}><FormControl><SelectTrigger><SelectValue placeholder={activeRegionId ? "Pilih tim..." : "Pilih wilayah melalui akun"} /></SelectTrigger></FormControl><SelectContent>{teams.map(team => <SelectItem key={team.id} value={team.name}>{team.name}</SelectItem>)}</SelectContent></Select></FormItem>)} />
            </div>

            {selectedCategory === "Tim Pohon" && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 p-2 rounded-lg"><Info className="h-5 w-5 text-blue-600" /></div>
                  <div>
                    <p className="font-bold text-sm text-blue-900">Mode Bantuan Wilayah Lain</p>
                    <p className="text-xs text-blue-700">Aktifkan jika tidak ada kegiatan internal dan armada digunakan untuk membantu wilayah lain.</p>
                  </div>
                </div>
                <FormField control={form.control} name="has_no_activity" render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />
              </div>
            )}
          </CardContent>
        </Card>

        {hasNoActivity ? (
          <Card className="border-t-4 border-t-amber-500 shadow-md">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2 text-amber-700"><ShieldAlert className="h-5 w-5" /> Keterangan Bantuan Wilayah</CardTitle></CardHeader>
            <CardContent>
              <FormField control={form.control} name="no_activity_remarks" render={({ field }) => (
                <FormItem>
                  <FormLabel>Isi Manual Keterangan (Contoh: Membantu Wilayah Medan Amplas)</FormLabel>
                  <FormControl><Input {...field} placeholder="Ketik keterangan bantuan di sini..." className="h-12 border-amber-200 focus:ring-amber-500" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="mt-4 p-3 bg-slate-50 rounded border text-[10px] text-slate-500 italic">
                * Kolom Detail Kegiatan, Lokasi, Alat, dan Personil akan otomatis digabung menjadi "TIDAK ADA RENCANA KERJA/ KEGIATAN" pada tampilan cetak.
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {isGlobalStyle && (
              <Card className="border-t-4 border-t-orange-500 bg-orange-50/30">
                <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2 text-orange-700"><ShieldAlert className="h-5 w-5" /> Sumber Daya Tim (Global)</CardTitle></CardHeader>
                <CardContent className="space-y-6 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="globalCoordinator" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-2"><Users size={16} /> Koordinator Tim</FormLabel><FormControl><Input {...field} list="wp-history-coordinators" placeholder="Nama Koordinator..." /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="globalForeman" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-2"><Users size={16} /> Mandor</FormLabel><FormControl><Input {...field} list="wp-history-foremen" placeholder="Nama Mandor..." /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="globalMembers" render={({ field }) => (<FormItem><FormLabel>Jumlah Anggota Tim</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                  </div>
                  <div className="space-y-4 pt-4 border-t border-orange-200">
                    <div className="flex items-center justify-between"><FormLabel className="flex items-center gap-2 text-orange-700 font-bold"><Wrench size={16} /> Alat Operasional Tim</FormLabel><Button type="button" variant="outline" size="sm" className="h-8 border-orange-200 text-orange-700 hover:bg-orange-100 px-2 md:px-3" onClick={() => { const current = form.getValues("globalTools") || []; form.setValue("globalTools", [...current, { name: "", unit: 1, usage: "", members: 0 }]); }}><Plus size={14} className="md:mr-1" /> <span className="hidden md:inline">Tambah Alat</span></Button></div>
                    {form.watch("globalTools")?.map((_, toolIdx) => (
                      <div key={toolIdx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-white p-3 rounded-lg border border-orange-100">
                        <div className="md:col-span-4"><FormField control={form.control} name={`globalTools.${toolIdx}.name`} render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase">Nama Alat</FormLabel><FormControl><Input className="h-9" {...field} list="wp-history-tools" onChange={(e) => { field.onChange(e); const usage = toolUsageMapping[e.target.value]; if (usage) form.setValue(`globalTools.${toolIdx}.usage`, usage); }} /></FormControl></FormItem>)} /></div>
                        <div className="md:col-span-2"><FormField control={form.control} name={`globalTools.${toolIdx}.unit`} render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase">Unit</FormLabel><FormControl><Input type="number" className="h-9" {...field} /></FormControl></FormItem>)} /></div>
                        <div className="md:col-span-3"><FormField control={form.control} name={`globalTools.${toolIdx}.usage`} render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase">Kegunaan</FormLabel><FormControl><Input className="h-9" {...field} /></FormControl></FormItem>)} /></div>
                        <div className="md:col-span-1 flex justify-end"><Button type="button" variant="ghost" size="icon" className="text-red-400 h-9 w-9" onClick={() => { const current = form.getValues("globalTools") || []; form.setValue("globalTools", current.filter((_, i) => i !== toolIdx)); }}><Trash2 size={16} /></Button></div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold flex items-center gap-2"><ClipboardList className="text-blue-600" /> Daftar Lokasi & Kegiatan</h2></div>
              {itemFields.map((item, index) => {
                const uiMode = form.watch(`items.${index}.uiMode`);
                const nextItemMode = form.watch("items")[index + 1]?.uiMode;
                const hasMovedFuelAndRemarks = nextItemMode === 'activity_location' || nextItemMode === 'location_only';
                return (
                  <Card key={item.id} className="border-l-4 border-l-blue-400 shadow-md overflow-hidden">
                    <CardHeader className="bg-slate-50/50 py-3 flex flex-row items-center justify-between"><div className="flex items-center gap-3"><Badge className="bg-blue-600">Lokasi #{index + 1}</Badge>{uiMode !== 'full' && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]"><Check size={10} className="mr-1" /> {uiMode === 'location_only' ? 'Alat & Kegiatan Sama' : 'Alat Sama'}</Badge>}</div><div className="flex items-center gap-2">{uiMode !== 'full' && <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px] text-blue-600" onClick={() => form.setValue(`items.${index}.uiMode`, 'full')}>Tampilkan Semua</Button>}{itemFields.length > 1 && <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeItem(index)}><Trash2 className="h-4 w-4" /></Button>}</div></CardHeader>
                    <CardContent className="p-6 space-y-6">
                      {uiMode !== 'location_only' && <FormField control={form.control} name={`items.${index}.description`} render={({ field }) => (<FormItem><FormLabel className="font-bold">Detail Kegiatan</FormLabel><FormControl><Input {...field} list="wp-history-descriptions" placeholder="Contoh: Pembabatan rumput..." /></FormControl></FormItem>)} />}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <FormField control={form.control} name={`items.${index}.location.street`} render={({ field }) => (<FormItem className="md:col-span-4"><FormLabel>Nama Jalan</FormLabel><FormControl><Input {...field} list="wp-history-streets" /></FormControl></FormItem>)} />
                        <FormField control={form.control} name={`items.${index}.location.subDistrict`} render={({ field }) => (<FormItem><FormLabel>Kecamatan</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger></FormControl><SelectContent><SelectItem value=" ">Abaikan / Kosong</SelectItem>{Object.keys(medanDistricts).map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                        <FormField control={form.control} name={`items.${index}.location.village.0`} render={({ field }) => (<FormItem><FormLabel>Kelurahan</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger></FormControl><SelectContent><SelectItem value=" ">Abaikan / Kosong</SelectItem>{form.watch(`items.${index}.location.subDistrict`) && form.watch(`items.${index}.location.subDistrict`) !== " " && medanDistricts[form.watch(`items.${index}.location.subDistrict`)].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                        <FormField control={form.control} name={`items.${index}.target_area`} render={({ field }) => (<FormItem><FormLabel>Target Luas Kerja (M²)</FormLabel><FormControl><Input type="number" min={0} step="0.01" {...field} /></FormControl></FormItem>)} />
                        {isFuelNeedCategory && !hasMovedFuelAndRemarks && <FormField control={form.control} name={`items.${index}.fuel_need_liters`} render={({ field }) => (<FormItem><FormLabel>Kebutuhan BBM/Liter</FormLabel><FormControl><Input type="number" min={0} step="0.01" {...field} /></FormControl></FormItem>)} />}
                        {isFuelEstimateCategory && !hasMovedFuelAndRemarks && <FormField control={form.control} name={`items.${index}.fuel_usage_estimate`} render={({ field }) => (<FormItem className="md:col-span-4"><FormLabel>Estimasi Penggunaan BBM (Liter)</FormLabel><FormControl><Textarea rows={3} {...field} placeholder="Tuliskan estimasi penggunaan BBM..." /></FormControl></FormItem>)} />}
                      </div>
                      {uiMode === 'full' && !isGlobalStyle && (
                        <>
                          <div className="pt-4 border-t space-y-4">
                            <div className="flex items-center justify-between">
                              <FormLabel className="flex items-center gap-2 text-blue-700 font-bold"><Wrench size={16} /> Alat Operasional</FormLabel>
                              <Button type="button" variant="outline" size="sm" className="h-8 px-2 md:px-3" onClick={() => { const current = form.getValues(`items.${index}.tools`); form.setValue(`items.${index}.tools`, [...current, { name: "", unit: 1, usage: "", members: 0 }]); }}><Plus size={14} className="md:mr-1" /> <span className="hidden md:inline">Tambah Alat</span></Button>
                            </div>
                            {form.watch(`items.${index}.tools`)?.map((_, toolIdx) => (
                              <div key={toolIdx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-slate-50 p-3 rounded-lg border">
                                <div className={selectedCategory === "Tim Pohon" ? "md:col-span-2" : "md:col-span-4"}><FormField control={form.control} name={`items.${index}.tools.${toolIdx}.name`} render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase">Nama Alat</FormLabel><FormControl><Input className="h-9" {...field} list="wp-history-tools" onChange={(e) => { field.onChange(e); const usage = toolUsageMapping[e.target.value]; if (usage) form.setValue(`items.${index}.tools.${toolIdx}.usage`, usage); if (selectedCategory === "Tim Siram" && toolIdx === 0) { const autoCoord = toolCoordinatorMapping[e.target.value]; if (autoCoord) form.setValue(`items.${index}.coordinator`, autoCoord); } }} /></FormControl></FormItem>)} /></div>
                                <div className={selectedCategory === "Tim Pohon" ? "md:col-span-1" : "md:col-span-2"}><FormField control={form.control} name={`items.${index}.tools.${toolIdx}.unit`} render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase">Unit</FormLabel><FormControl><Input type="number" className="h-9" {...field} /></FormControl></FormItem>)} /></div>
                                <div className="md:col-span-3"><FormField control={form.control} name={`items.${index}.tools.${toolIdx}.usage`} render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase">{selectedCategory === "Tim Pohon" ? "Kegunaan Alat" : "Kegunaan"}</FormLabel><FormControl><Input className="h-9" {...field} /></FormControl></FormItem>)} /></div>
                                {selectedCategory === "Tim Pohon" && (
                                  <div className="md:col-span-2"><FormField control={form.control} name={`items.${index}.tools.${toolIdx}.members`} render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase">Jumlah Personel</FormLabel><FormControl><Input type="number" min={0} className="h-9" {...field} /></FormControl></FormItem>)} /></div>
                                )}
                                <div className="md:col-span-1 flex justify-end"><Button type="button" variant="ghost" size="icon" className="text-red-400 h-9 w-9" onClick={() => { const current = form.getValues(`items.${index}.tools`); form.setValue(`items.${index}.tools`, current.filter((_, i) => i !== toolIdx)); }}><Trash2 size={16} /></Button></div>
                              </div>
                            ))}
                          </div>
                          <div className={`grid grid-cols-1 ${selectedCategory === "Tim Pohon" ? "md:grid-cols-2" : "md:grid-cols-3"} gap-4 pt-4 border-t`}><FormField control={form.control} name={`items.${index}.coordinator`} render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-2"><Users size={16} /> Koordinator</FormLabel><FormControl><Input {...field} list="wp-history-coordinators" /></FormControl></FormItem>)} /><FormField control={form.control} name={`items.${index}.foreman`} render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-2"><Users size={16} /> Mandor</FormLabel><FormControl><Input {...field} list="wp-history-foremen" /></FormControl></FormItem>)} />{selectedCategory !== "Tim Pohon" && <FormField control={form.control} name={`items.${index}.personnel.members`} render={({ field }) => (<FormItem><FormLabel>Jumlah Personil</FormLabel><FormControl><Input type="text" {...field} /></FormControl></FormItem>)} />}</div>
                        </>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                        {uiMode !== 'location_only' && <FormField control={form.control} name={`items.${index}.basis`} render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-2"><FileText size={16} /> Dasar Pengerjaan</FormLabel><FormControl><Input {...field} list="wp-history-basis" placeholder="Contoh: SPT No. 123..." /></FormControl></FormItem>)} />}
                        {!hasMovedFuelAndRemarks && <FormField control={form.control} name={`items.${index}.remarks`} render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-2"><MessageSquare size={16} /> Keterangan</FormLabel><FormControl><Input {...field} list="wp-history-remarks" placeholder="Tambahkan keterangan kegiatan..." /></FormControl></FormItem>)} />}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              <Button type="button" variant="outline" className="w-full border-dashed py-8 text-blue-600 font-bold bg-white hover:bg-blue-50 px-2 md:px-4" onClick={handleAddClick}><Plus className="mr-2 h-5 w-5" /> <span className="hidden md:inline">Tambah Kegiatan / Lokasi Baru</span></Button>
            </div>
          </>
        )}

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/work-plans')} className="px-2 md:px-4">Batal</Button>
          <Button type="submit" disabled={isSubmitting || isPimpinan} className={cn("bg-blue-600 hover:bg-blue-700 px-2 md:px-8", isPimpinan && "opacity-50 cursor-not-allowed")}>{isSubmitting ? "Menyimpan..." : isDuplicateMode ? "Simpan Sebagai Baru" : "Simpan Rencana Kerja"}</Button>
        </div>
      </form>
      <Dialog open={showAddChoiceDialog} onOpenChange={setShowAddChoiceDialog}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="text-blue-600" /> Tambah Kegiatan / Lokasi Baru</DialogTitle>
            <DialogDescription>Pilih cara menambahkan kegiatan ke rencana kerja tanggal {form.getValues("date")}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <Button type="button" onClick={handleManualAddChoice} className="h-auto justify-start px-5 py-4 bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-3 h-5 w-5" />
              <span className="text-left"><span className="block font-bold">Tambah manual</span><span className="block text-xs font-normal opacity-90">Buat lokasi dan kegiatan baru dari awal.</span></span>
            </Button>
            <Button type="button" variant="outline" onClick={handleCopyAddChoice} className="h-auto justify-start border-emerald-300 px-5 py-4 text-emerald-700 hover:bg-emerald-50">
              <Copy className="mr-3 h-5 w-5" />
              <span className="text-left"><span className="block font-bold">Salin dari tanggal sebelumnya</span><span className="block text-xs font-normal text-slate-500">Pilih kegiatan dari rencana Tim/Kategori yang sama.</span></span>
            </Button>
          </div>
          <DialogFooter><Button type="button" variant="ghost" onClick={() => setShowAddChoiceDialog(false)}>Batal</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showWizard} onOpenChange={setShowWizard}><DialogContent className="sm:max-w-[450px]"><DialogHeader><DialogTitle className="flex items-center gap-2"><HelpCircle className="text-blue-600 h-5 w-5" /> {wizardStep === 1 ? "Alat Operasional" : "Detail Kegiatan"}</DialogTitle><DialogDescription>{wizardStep === 1 ? "Apakah lokasi baru ini menggunakan Alat Operasional yang sama?" : "Apakah Detail Kegiatannya juga sama?"}</DialogDescription></DialogHeader><div className="py-6 flex flex-col gap-3">{wizardStep === 1 ? (<><Button onClick={() => setWizardStep(2)} className="h-12 justify-start px-6 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"><Check className="mr-3 h-5 w-5" /> Ya, Alat Sama</Button><Button onClick={() => performAppend('full')} variant="outline" className="h-12 justify-start px-6"><Plus className="mr-3 h-5 w-5" /> Tidak, Alat Berbeda</Button></>) : (<><Button onClick={() => performAppend('location_only')} className="h-12 justify-start px-6 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"><Check className="mr-3 h-5 w-5" /> Ya, Kegiatan Sama</Button><Button onClick={() => performAppend('activity_location')} variant="outline" className="h-12 justify-start px-6"><Plus className="mr-3 h-5 w-5" /> Tidak, Kegiatan Berbeda</Button></>)}</div><DialogFooter><Button variant="ghost" onClick={() => setShowWizard(false)}>Batal</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}><DialogContent className="sm:max-w-[400px]"><DialogHeader><DialogTitle className="flex items-center gap-2"><Copy className="text-blue-600 h-5 w-5" /> Duplikat Rencana Kerja</DialogTitle><DialogDescription>Pilih tanggal baru untuk menyalin data ini ke formulir.</DialogDescription></DialogHeader><div className="py-4 space-y-4"><div className="space-y-2"><FormLabel>Tanggal Baru</FormLabel><Input type="date" value={duplicateDate} onChange={(e) => setDuplicateDate(e.target.value)} className="h-11" /></div></div><DialogFooter className="gap-2 sm:gap-0"><Button variant="ghost" onClick={() => setShowDuplicateDialog(false)}>Batal</Button><Button onClick={handleDuplicate} disabled={!duplicateDate} className="bg-blue-600 hover:bg-blue-700"><Copy className="h-4 w-4 mr-2" /> Salin ke Form</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Copy className="text-emerald-600" /> Salin Lokasi & Kegiatan</DialogTitle>
            <DialogDescription>Pilih rencana kerja yang sudah ada, lalu centang satu atau beberapa kegiatan untuk ditambahkan ke daftar saat ini. Kegiatan yang sudah ada tidak akan ditimpa, dan tanggal pada formulir tetap tidak berubah.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <FormLabel>Pencarian Global</FormLabel>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={sourceSearchQuery}
                  onChange={(event) => setSourceSearchQuery(event.target.value)}
                  placeholder="Cari tanggal, kegiatan, jalan, kelurahan, kecamatan..."
                  className="pl-9"
                />
              </div>
              {sourceSearchQuery.trim() && <p className="text-xs text-slate-500">Menampilkan {filteredSourcePlans.length} dari {matchingSourcePlans.length} rencana Tim/Kategori {selectedCategory}.</p>}
            </div>
            <div className="space-y-2">
              <FormLabel>Rencana Kerja Sumber</FormLabel>
              <Select value={sourcePlanId} onValueChange={handleSourcePlanChange}>
                <SelectTrigger><SelectValue placeholder={filteredSourcePlans.length ? "Pilih rencana kerja..." : "Tidak ada hasil pencarian"} /></SelectTrigger>
                <SelectContent className="w-[min(760px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] !max-h-[var(--radix-select-content-available-height)]">
                  {filteredSourcePlans.map(plan => (
                    <SelectItem key={plan.id} value={plan.id} className="items-start whitespace-normal py-2">
                      <span className="block min-w-0 whitespace-normal break-words leading-snug">
                        <span className="block font-medium">{plan.date} - {plan.category}</span>
                        <span className="block text-xs text-slate-600">{plan.items?.[0]?.description || "Tanpa uraian"}{(plan.items?.length || 0) > 1 ? ` (+${plan.items.length - 1} kegiatan)` : ""}</span>
                        <span className="block text-xs text-slate-500">Jalan/Lokasi: {formatSourceLocation(plan)}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedSourcePlan && (
              <div className="space-y-2">
                <div className="flex items-center justify-between"><FormLabel>Daftar Lokasi & Kegiatan{sourceSearch ? ` (${filteredSourceItems.length} hasil)` : ""}</FormLabel><Button type="button" variant="link" size="sm" className="h-auto p-0 text-emerald-700" onClick={() => setSelectedSourceItemIds(filteredSourceItems.map(({ index }) => index))}>Pilih semua</Button></div>
                <div className="max-h-64 overflow-y-auto rounded-lg border divide-y">
                  {filteredSourceItems.map(({ item, index }) => {
                    const location = [item.location?.street, item.location?.village, item.location?.subDistrict].flat().filter(Boolean).join(", ");
                    return <label key={`${selectedSourcePlan.id}-${index}`} className="flex cursor-pointer items-start gap-3 p-3 hover:bg-slate-50"><Checkbox checked={selectedSourceItemIds.includes(index)} onCheckedChange={(checked) => toggleSourceItem(index, checked === true)} className="mt-0.5" /><span className="min-w-0 text-sm"><span className="block font-semibold text-slate-800">{item.description || "Tanpa uraian kegiatan"}</span><span className="block truncate text-xs text-slate-500">{location || "Lokasi tidak ditentukan"}</span></span></label>;
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="mt-2 gap-3 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCopyDialog(false)}
              className="w-full sm:w-auto"
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={copySelectedActivities}
              disabled={!selectedSourcePlan || selectedSourceItemIds.length === 0 || filteredSourceItems.length === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto"
            >
              <Copy className="mr-2 h-4 w-4" /> Salin ke Form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Form>
  );
};

export default WorkPlanForm;
