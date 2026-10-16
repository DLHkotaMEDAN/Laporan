import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { useAuth } from "@/context/AuthContext";
import { isSuperAdminAccess } from "@/constants/access-control";
import { useValueDraft } from "@/hooks/useFormDraft";
import type { NotaDinasCategory, NotaDinasForm, NotaDinasRecord } from "@/types/notaDinas";
import type { NotaDinasSort } from "@/components/nota-dinas/NotaDinasRecordTable";
import { NotaDinasListView } from "@/components/nota-dinas/NotaDinasListView";
import { useNotaDinasTemplates } from "@/hooks/useNotaDinasTemplates";
import { useNotaDinasRecords } from "@/hooks/useNotaDinasRecords";
import { useNotaDinasFormFields } from "@/hooks/useNotaDinasFormFields";
import { useNotaDinasRecordActions } from "@/hooks/useNotaDinasRecordActions";
import { useNotaDinasDelete } from "@/hooks/useNotaDinasDelete";
import { useNotaDinasSortedRecords } from "@/hooks/useNotaDinasSortedRecords";
import { useNotaDinasViewState } from "@/hooks/useNotaDinasViewState";
import { NotaDinasPreview } from "@/components/nota-dinas/NotaDinasPreview";
import { NotaDinasEditorToolbar } from "@/components/nota-dinas/NotaDinasEditorToolbar";
import { NotaDinasEditorFieldsPanel } from "@/components/nota-dinas/NotaDinasEditorFieldsPanel";
import { NotaDinasDeleteConfirmDialog } from "@/components/nota-dinas/NotaDinasDeleteConfirmDialog";
import {
  DRAFT_KEY,
  ITEM_CATALOG_KEY,
  getNextRequestSequence,
  readDraft,
  readItemCatalog,
} from "@/components/nota-dinas/notaDinasStorage";
import {
  formatLongDate,
  getRenderedHal,
  NOTA_CODE_BY_REGION_CODE,
} from "@/components/nota-dinas/notaDinasUtils";
import { getNotaDinasNumberLabel, getNotaDinasSavedChoices } from "@/components/nota-dinas/notaDinasRecordUtils";

const NotaDinasTab = ({ recordCount, isActive }: { recordCount?: number | null; isActive?: boolean }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, session } = useAuth();
  const viewStorageKey = session?.user?.id ? `nota-dinas:view:${session.user.id}` : undefined;
  const [form, setForm] = useState<NotaDinasForm>(readDraft);
  const [itemCatalog, setItemCatalog] = useState<string[]>(readItemCatalog);
  const [deleteNotaConfirm, setDeleteNotaConfirm] = useState<{ open: boolean; record: NotaDinasRecord | null }>({ open: false, record: null });
  const [saving, setSaving] = useState(false);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [view, setViewState] = useState<"list" | "form">("list");
  const [viewMode, setViewMode] = useState<"view" | "edit">("edit");
  const [sort, setSort] = useState<NotaDinasSort>(null);
  const [categoryFilter, setCategoryFilter] = useState<NotaDinasCategory | "semua">("semua");
  const [accountRegion, setAccountRegion] = useState<{ id: string; name: string; notaCode: string } | null>(null);
  const [accountRegionReady, setAccountRegionReady] = useState(false);
  const {
    sheetTemplate,
    availableTemplates,
    selectedTemplateId,
    handleTemplateSelect,
  } = useNotaDinasTemplates(form.jenisNotaDinas || "permintaan_alat", accountRegion, isActive, location.pathname);
  const isSuperAdmin = isSuperAdminAccess(profile?.role, session?.user?.email);
  const isRegionalNotaAdmin = !isSuperAdmin && Boolean(profile?.region_id);
  const applyAccountRegion = useCallback((value: NotaDinasForm): NotaDinasForm => accountRegion
    ? { ...value, kodeWilayah: accountRegion.notaCode, wilayah: accountRegion.name, lanjutanHal: getRenderedHal(value.hal, accountRegion.name) }
    : value, [accountRegion]);
  const { records, setRecords, recordsLoading, recordsError } = useNotaDinasRecords({
    accountRegion,
    accountRegionReady,
    isRegionalNotaAdmin,
    applyAccountRegion,
  });
  const nextRequestSequence = useMemo(() => getNextRequestSequence(records), [records]);
  const savedChoices = useMemo(() => {
    return getNotaDinasSavedChoices(records.map((record) => record.form));
  }, [records]);
  const {
    isLanjutan, isRepair, activeDateValue, generatedNumber, activeAutoNumber, activeManualNumber,
    firstNumber, lanjutanNumber, referenceNumber, activeKepada, activeDari, activeHal,
    displayHal, halOptions, itemOptions, activeHalOption, activePenutup, activeJabatanPenandatangan,
    activeKantorPenandatangan, activeNamaPenandatangan, activeNipPenandatangan,
    setActiveField, setActiveDate, handleHalOptionChange, handleDocumentTypeChange,
    handleNotaCategoryChange, handleRegionChange, setField, updateItem, addItem, removeItem,
  } = useNotaDinasFormFields({ form, setForm, itemCatalog, savedChoices });

  const setView = (nextView: "list" | "form") => {
    setViewState(nextView);
    if (viewStorageKey && typeof window !== "undefined") {
      window.localStorage.setItem(viewStorageKey, nextView);
    }
  };

  const draftKey = session?.user?.id
    ? `nota-dinas:${session.user.id}:${activeRecordId ?? "new"}`
    : undefined;
  const { clearDraft, lastSavedAt, restoredAt } = useValueDraft(
    form,
    (values) => {
      setForm(applyAccountRegion(values));
    },
    draftKey,
  );
  useNotaDinasViewState({ isActive, viewStorageKey, setViewState, restoredAt });
  const { createNew, openRecord, duplicateRecord, saveRecord } = useNotaDinasRecordActions({
    form,
    setForm,
    records,
    setRecords,
    activeRecordId,
    setActiveRecordId,
    accountRegionId: accountRegion?.id,
    nextRequestSequence,
    penutupFromTemplate: sheetTemplate.paragrafKalimatPenutup,
    applyAccountRegion,
    setView,
    setViewMode,
    clearDraft,
    setSaving,
  });
  const { requestDelete, confirmDelete } = useNotaDinasDelete({
    deleteConfirm: deleteNotaConfirm,
    activeRecordId,
    setActiveRecordId,
    setRecords,
    setView,
    setDeleteConfirm: setDeleteNotaConfirm,
  });

  useEffect(() => {
    let active = true;

    if (!isRegionalNotaAdmin || !profile?.region_id) {
      setAccountRegion(null);
      setAccountRegionReady(true);
      return () => { active = false; };
    }

    setAccountRegionReady(false);
    void supabase
      .from("regions")
      .select("id, code, name")
      .eq("id", profile.region_id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data || !NOTA_CODE_BY_REGION_CODE[data.code]) {
          logger.error("Wilayah akun Admin Nota Dinas tidak dapat dimuat:", error);
          setAccountRegion(null);
        } else {
          setAccountRegion({ id: data.id, name: data.name, notaCode: NOTA_CODE_BY_REGION_CODE[data.code] });
        }
        setAccountRegionReady(true);
      });

    return () => { active = false; };
  }, [isRegionalNotaAdmin, profile?.region_id]);

  useEffect(() => {
    if (!accountRegion) return;
    setForm((current) => current.kodeWilayah === accountRegion.notaCode && current.wilayah === accountRegion.name
      ? current
      : applyAccountRegion(current));
  }, [accountRegion]);

  useEffect(() => {
    const nextItems = Array.from(new Set([
      ...itemCatalog,
      ...form.items.map((item) => item.jenis.trim()).filter(Boolean),
    ])).sort((left, right) => left.localeCompare(right, "id-ID"));
    if (nextItems.join("\u0000") !== itemCatalog.join("\u0000")) {
      setItemCatalog(nextItems);
      window.localStorage.setItem(ITEM_CATALOG_KEY, JSON.stringify(nextItems));
    }
  }, [form.items, itemCatalog]);

  const { sortedRecords, toggleSort } = useNotaDinasSortedRecords(records, categoryFilter, sort, setSort);

  if (view === "list") {
    return (
      <>
        <NotaDinasListView
          recordCount={recordCount}
          records={records}
          sortedRecords={sortedRecords}
          recordsError={recordsError}
          recordsLoading={recordsLoading}
          categoryFilter={categoryFilter}
          sort={sort}
          onCategoryChange={setCategoryFilter}
          onSort={toggleSort}
          onOpen={openRecord}
          onDelete={requestDelete}
          getNumberLabel={getNotaDinasNumberLabel}
          onAdd={createNew}
          onOpenTemplates={() => navigate("/nota-dinas/template")}
        />
        <NotaDinasDeleteConfirmDialog
          open={deleteNotaConfirm.open}
          record={deleteNotaConfirm.record}
          onOpenChange={(open) => setDeleteNotaConfirm((current) => ({ ...current, open }))}
          getNumberLabel={getNotaDinasNumberLabel}
          onConfirm={confirmDelete}
        />
      </>
    );
  }

  return (
    <section className="nota-dinas-page space-y-5">
      <NotaDinasEditorToolbar
        isRegionalNotaAdmin={isRegionalNotaAdmin}
        regionName={accountRegion?.name}
        activeRecordId={activeRecordId}
        viewMode={viewMode}
        saving={saving}
        onBack={() => setView("list")}
        onEdit={() => setViewMode("edit")}
        onDelete={() => {
          const record = records.find((item) => item.id === activeRecordId);
          if (record) requestDelete(record);
        }}
        onDuplicate={duplicateRecord}
        onSave={saveRecord}
        onPrint={() => window.print()}
      />

      <div className="grid items-start gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        {viewMode === "edit" && <NotaDinasEditorFieldsPanel
          form={form}
          requestFields={{
            form,
            setForm,
            isLanjutan,
            isRepair,
            isSuperAdmin,
            templates: availableTemplates,
            selectedTemplateId,
            activeRecordId,
            nextRequestSequence,
            activeAutoNumber,
            generatedNumber,
            activeManualNumber,
            activeDateValue,
            halOptions,
            activeHalOption,
            activeHal,
            referenceNumber,
            activeKepada,
            activeDari,
            onNotaCategoryChange: handleNotaCategoryChange,
            onTemplateSelect: handleTemplateSelect,
            onDocumentTypeChange: handleDocumentTypeChange,
            onSetActiveField: setActiveField,
            onSetField: setField,
            onActiveDateChange: setActiveDate,
            onHalOptionChange: handleHalOptionChange,
            onRegionChange: handleRegionChange,
          }}
          sheetTemplate={sheetTemplate}
          itemOptions={itemOptions}
          savedChoices={savedChoices}
          lastSavedAt={lastSavedAt}
          activeJabatanPenandatangan={activeJabatanPenandatangan}
          activeKantorPenandatangan={activeKantorPenandatangan}
          activeNamaPenandatangan={activeNamaPenandatangan}
          activeNipPenandatangan={activeNipPenandatangan}
          onSetActiveField={setActiveField}
          onUpdateItem={updateItem}
          onRemoveItem={removeItem}
          onAddItem={addItem}
        />}

        <NotaDinasPreview
          form={form}
          sheetTemplate={sheetTemplate}
          firstNumber={firstNumber}
          continuationNumber={lanjutanNumber}
          displayHal={displayHal}
          referenceNumber={referenceNumber}
          requestDate={formatLongDate(form.tanggal)}
          continuationDate={formatLongDate(form.tanggalLanjutan || form.tanggal)}
          isRepair={isRepair}
          isReadOnly={viewMode === "view"}
        />
      </div>

      <NotaDinasDeleteConfirmDialog
        open={deleteNotaConfirm.open}
        record={deleteNotaConfirm.record}
        onOpenChange={(open) => setDeleteNotaConfirm((current) => ({ ...current, open }))}
        getNumberLabel={getNotaDinasNumberLabel}
        onConfirm={confirmDelete}
      />
    </section>
  );
};

export default NotaDinasTab;
