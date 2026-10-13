import { useMemo, type Dispatch, type SetStateAction } from "react";
import type { NotaDinasCategory, NotaDinasForm, NotaDinasItem, NotaDinasKind } from "@/types/notaDinas";
import { REPAIR_SAMPLE_FORM, REPAIR_SAMPLE_ITEMS, SAMPLE_FORM } from "@/components/nota-dinas/notaDinasDefaults";
import { getLetterMonth, getLetterTypeForCategory, getLetterYear, getRenderedHal, getUniqueOptions, HAL_OPTIONS, REGION_CODES } from "@/components/nota-dinas/notaDinasUtils";
import type { getNotaDinasSavedChoices } from "@/components/nota-dinas/notaDinasRecordUtils";

type SavedChoices = ReturnType<typeof getNotaDinasSavedChoices>;

type UseNotaDinasFormFieldsOptions = {
  form: NotaDinasForm;
  setForm: Dispatch<SetStateAction<NotaDinasForm>>;
  itemCatalog: string[];
  savedChoices: SavedChoices;
};

export const useNotaDinasFormFields = ({ form, setForm, itemCatalog, savedChoices }: UseNotaDinasFormFieldsOptions) => {
  const isLanjutan = form.jenisDokumen === "lanjutan";
  const isRepair = form.jenisNotaDinas === "perbaikan";
  const activeDateValue = isLanjutan ? (form.tanggalLanjutan || form.tanggal) : form.tanggal;
  const firstLetterMonth = useMemo(() => getLetterMonth(form.tanggal), [form.tanggal]);
  const firstLetterYear = useMemo(() => getLetterYear(form.tanggal), [form.tanggal]);
  const continuationLetterMonth = useMemo(() => getLetterMonth(form.tanggalLanjutan || form.tanggal), [form.tanggal, form.tanggalLanjutan]);
  const continuationLetterYear = useMemo(() => getLetterYear(form.tanggalLanjutan || form.tanggal), [form.tanggal, form.tanggalLanjutan]);
  const generatedFirstNumber = `${form.nomorUrut.trim() ? form.nomorUrut.trim().padStart(3, "0") : "....."}/${form.kodeSurat || "....."}/ Dinas-LH/ ${form.kodeWilayah || "....."}/ ${firstLetterMonth}/ ${firstLetterYear}`;
  const lanjutanNomorUrut = form.nomorLanjutanUrut.trim() || "\u00a0\u00a0\u00a0\u00a0\u00a0";
  const generatedNumber = isLanjutan
    ? `${lanjutanNomorUrut}/ Katim/ PL/ ${continuationLetterMonth}/ ${continuationLetterYear}`
    : generatedFirstNumber;
  const activeAutoNumber = isLanjutan ? form.gunakanNomorOtomatisLanjutan : form.gunakanNomorOtomatisPertama;
  const activeManualNumber = isLanjutan ? form.nomorManualLanjutan : form.nomorManualPertama;
  const firstNumber = form.gunakanNomorOtomatisPertama ? generatedFirstNumber : form.nomorManualPertama;
  const lanjutanNumber = form.gunakanNomorOtomatisLanjutan
    ? `${lanjutanNomorUrut}/ Katim/ PL/ ${continuationLetterMonth}/ ${continuationLetterYear}`
    : form.nomorManualLanjutan;
  const referenceNumber = form.gunakanRujukanOtomatis ? firstNumber : (form.nomorRujukan || ".....");
  const activeKepada = isLanjutan ? form.lanjutanKepada : form.kepada;
  const activeDari = isLanjutan ? form.lanjutanDari : form.dari;
  const activeHal = isLanjutan ? form.lanjutanHal : form.hal;
  const displayHal = getRenderedHal(form.hal, form.wilayah);
  const halOptions = useMemo(() => getUniqueOptions([...HAL_OPTIONS, ...savedChoices.hal]), [savedChoices.hal]);
  const itemOptions = useMemo(() => getUniqueOptions([...itemCatalog, ...savedChoices.items]), [itemCatalog, savedChoices.items]);
  const activeHalOption = halOptions.includes(activeHal) ? activeHal : "manual";
  const activePenutup = isLanjutan ? form.lanjutanPenutup : form.penutup;
  const activeJabatanPenandatangan = isLanjutan ? form.lanjutanJabatanPenandatangan : form.jabatanPenandatangan;
  const activeKantorPenandatangan = isLanjutan ? form.lanjutanKantorPenandatangan : form.kantorPenandatangan;
  const activeNamaPenandatangan = isLanjutan ? form.lanjutanNamaPenandatangan : form.namaPenandatangan;
  const activeNipPenandatangan = isLanjutan ? form.lanjutanNipPenandatangan : form.nipPenandatangan;

  const setActiveField = (field: "kepada" | "dari" | "hal" | "penutup" | "jabatanPenandatangan" | "kantorPenandatangan" | "namaPenandatangan" | "nipPenandatangan", value: string) => {
    const targetField = isLanjutan ? `lanjutan${field.charAt(0).toUpperCase()}${field.slice(1)}` : field;
    setForm((current) => {
      if (!isLanjutan && field === "hal") {
        return { ...current, hal: value, lanjutanHal: getRenderedHal(value, current.wilayah), halRujukan: value };
      }
      if (field === "dari") {
        return isLanjutan
          ? { ...current, lanjutanDari: value, lanjutanJabatanPenandatangan: value }
          : { ...current, dari: value, jabatanPenandatangan: value, koordinatorRujukan: value };
      }
      return { ...current, [targetField]: value };
    });
  };

  const setActiveDate = (value: string) => setForm((current) => isLanjutan
    ? { ...current, tanggalLanjutan: value }
    : { ...current, tanggal: value });
  const handleHalOptionChange = (value: string) => setActiveField("hal", value === "manual" ? "" : value);
  const handleDocumentTypeChange = (value: NotaDinasKind) => setForm((current) => ({
    ...current,
    jenisDokumen: value,
    kodeSurat: getLetterTypeForCategory(current.jenisNotaDinas),
    ...(value === "lanjutan" ? {
      lanjutanHal: getRenderedHal(current.hal, current.wilayah),
      koordinatorRujukan: current.dari || current.koordinatorRujukan,
    } : {}),
  }));
  const handleNotaCategoryChange = (value: NotaDinasCategory) => setForm((current) => ({
    ...current,
    ...(value === "perbaikan" && current.jenisNotaDinas !== "perbaikan"
      ? { ...REPAIR_SAMPLE_FORM, nomorUrut: current.nomorUrut, kodeWilayah: current.kodeWilayah, wilayah: current.wilayah, tanggal: current.tanggal, tanggalLanjutan: current.tanggalLanjutan || current.tanggal, tanggalRujukan: current.tanggal }
      : {}),
    ...(value === "perbaikan" && current.jenisNotaDinas !== "perbaikan" ? { items: REPAIR_SAMPLE_ITEMS } : {}),
    ...(value !== "perbaikan" && current.jenisNotaDinas === "perbaikan" ? { items: SAMPLE_FORM.items } : {}),
    jenisNotaDinas: value,
    kodeSurat: getLetterTypeForCategory(value),
  }));
  const handleRegionChange = (value: string) => {
    const selectedRegion = REGION_CODES.find((region) => region.code === value);
    setForm((current) => ({
      ...current,
      kodeWilayah: value,
      wilayah: selectedRegion?.label || current.wilayah,
      lanjutanHal: getRenderedHal(current.hal, selectedRegion?.label || current.wilayah),
    }));
  };
  const setField = <K extends keyof NotaDinasForm>(key: K, value: NotaDinasForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };
  const updateItem = (index: number, key: keyof NotaDinasItem, value: string) => setForm((current) => ({
    ...current,
    items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
  }));
  const addItem = () => setForm((current) => ({
    ...current,
    items: [...current.items, { jenis: "", jumlah: "", satuan: "", bkKendaraan: "", keterangan: "" }],
  }));
  const removeItem = (index: number) => setForm((current) => ({
    ...current,
    items: current.items.filter((_, itemIndex) => itemIndex !== index),
  }));

  return {
    isLanjutan, isRepair, activeDateValue, generatedNumber, activeAutoNumber, activeManualNumber,
    firstNumber, lanjutanNumber, referenceNumber, activeKepada, activeDari, activeHal,
    displayHal, halOptions, itemOptions, activeHalOption, activePenutup, activeJabatanPenandatangan,
    activeKantorPenandatangan, activeNamaPenandatangan, activeNipPenandatangan,
    setActiveField, setActiveDate, handleHalOptionChange, handleDocumentTypeChange,
    handleNotaCategoryChange, handleRegionChange, setField, updateItem, addItem, removeItem,
  };
};
