"use client";

import React, { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft, Save, Loader2, Fuel, MapPin, Info, 
  Plus, Trash2, MessageSquare, HelpCircle, MapPinned, Calculator, Lock, Unlock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { showSuccess, showError } from '@/utils/toast';
import { FuelReport, FuelReportType, FuelType } from '@/types/fuelReport';
import { fuelService } from '@/services/fuelService';
import { laporanBbmService } from '@/services/laporanBbmService';
import { fuelPriceService } from '@/services/fuelPriceService';
import { medanDistricts } from '@/data/medan-districts';
import { useAuth } from '@/context/AuthContext';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useRegionFilterOptions } from '@/hooks/useRegionFilterOptions';
import { useFormDraft } from '@/hooks/useFormDraft';
import { isGlobalFuelAdmin } from '@/constants/access-control';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const pusatTeams = ['Tim Babat 1', 'Tim Babat 2', 'Tim Babat 3', 'Tim Babat 4', 'Dumb Truck', 'Mobil Crane', 'Pickup', 'Mobil Tangga', 'Mobil Tangga 30M', 'Beco Loader'];

const formatRupiahInput = (value: number | string | null | undefined) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits ? Number(digits).toLocaleString('id-ID') : '';
};

const parseRupiahInput = (value: string) => Number(value.replace(/\D/g, '') || 0);

const usageItemSchema = z.object({
  vehicle_operator: z.string().optional().default(""),
  no_pol: z.string().optional().default(""),
  recipient_name: z.string().optional().default(""),
  // The form captures all fuel types in one vehicle row. They are expanded
  // back into the existing database item format when saving.
  fuel_type: z.string().optional(),
  amount_rp: z.coerce.number().min(0).optional().default(0),
  amount_liter: z.coerce.number().min(0).optional().default(0),
  pertamax_rp: z.coerce.number().min(0).optional().default(0),
  pertamax_liter: z.coerce.number().min(0).optional().default(0),
  dexlite_rp: z.coerce.number().min(0).optional().default(0),
  dexlite_liter: z.coerce.number().min(0).optional().default(0),
  oli_liter: z.coerce.number().min(0).optional().default(0),
  item_remarks: z.string().optional().default(""),
  activity_detail: z.string().optional().default(""),
  is_location_same: z.boolean().optional().default(false),
  requires_fuel: z.boolean().optional().default(true),
  location: z.object({
    street: z.string().optional().default(""),
    subDistrict: z.string().optional().default(""),
    village: z.string().optional().default(""),
  }),
});

const toFormItems = (items: FuelReport['items']) => {
  const grouped = new Map<string, any>();

  items.forEach(item => {
    const locationKey = JSON.stringify(item.location || {});
    const key = `${item.vehicle_operator}|${item.no_pol || ''}|${locationKey}`;
    const current = grouped.get(key) || {
      vehicle_operator: item.vehicle_operator || '',
      no_pol: item.no_pol || '',
      recipient_name: item.recipient_name || '',
      fuel_type: item.fuel_type,
      amount_rp: 0,
      amount_liter: 0,
      pertamax_rp: 0,
      pertamax_liter: 0,
      dexlite_rp: 0,
      dexlite_liter: 0,
      oli_liter: 0,
      item_remarks: item.item_remarks || '',
      activity_detail: item.activity_detail || '',
      is_location_same: item.is_location_same ?? false,
      requires_fuel: item.requires_fuel !== false,
      location: { ...(item.location || {}), street: item.location?.street || '', subDistrict: item.location?.subDistrict || '', village: item.location?.village || '' },
    };
    const amountRp = item.amount_rp || (item.fuel_type !== 'Oli' ? item.amount || 0 : 0);
    const amountLiter = item.amount_liter || (item.fuel_type === 'Oli' ? item.amount || 0 : 0);
    if (item.fuel_type === 'Pertamax') {
      current.pertamax_rp += amountRp;
      current.pertamax_liter += amountLiter;
    } else if (item.fuel_type === 'Dexlite') {
      current.dexlite_rp += amountRp;
      current.dexlite_liter += amountLiter;
    } else if (item.fuel_type === 'Oli') {
      current.oli_liter += amountLiter;
    }
    current.requires_fuel = current.requires_fuel || amountRp > 0 || amountLiter > 0;
    grouped.set(key, current);
  });

  return Array.from(grouped.values());
};

const formSchema = z.object({
  date: z.string().min(1, "Tanggal wajib diisi"),
  region: z.string().min(1, "Wilayah wajib dipilih"),
  team: z.string().optional().default(""),
  no_spj: z.string().optional().default(""),
  price_pertamax: z.coerce.number().min(1, "Harga wajib diisi"),
  price_dexlite: z.coerce.number().min(1, "Harga wajib diisi"),
  items: z.array(usageItemSchema).min(1, "Minimal satu detail pemakaian"),
  remarks: z.string().optional().default(""),
});

interface FuelReportFormProps {
  initialData?: FuelReport;
  isEditing?: boolean;
  reportType?: FuelReportType;
}

const FuelReportForm = ({ initialData, isEditing = false, reportType = 'admin_bbm' }: FuelReportFormProps) => {
  const navigate = useNavigate();
  const { profile, session } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTypePrompt, setShowTypePrompt] = useState(false);
  const [appendSourceIndex, setAppendSourceIndex] = useState<number | null>(null);

  // Autocomplete States
  const [history, setHistory] = useState({
    vehicles: new Set<string>(),
    noPolisi: new Set<string>(),
    streets: new Set<string>(),
    officerNames: new Set<string>()
  });

  const canEditPrice = profile?.role === 'admin'
    || profile?.role === 'admin_bbm'
    || profile?.role === 'admin_rencana_kerja_bbm'
    || profile?.role === 'admin_wilayah_bbm'
    || session?.user?.email === 'admin@gmail.com';
  const isSuperAdmin = profile?.role === 'admin' || session?.user?.email === 'admin@gmail.com';
  const isAdminBbm = profile?.role === 'admin_bbm' || profile?.role === 'admin_rencana_kerja_bbm' || profile?.role === 'admin_wilayah_bbm';
  // Admin BBM is a cross-region role. Only the combined/regional roles are
  // restricted to the region assigned to their profile.
  const isRegionalFuelAdmin = !isGlobalFuelAdmin(profile?.role) && (
    profile?.role === 'admin_rencana_kerja_bbm'
    || profile?.role === 'admin_wilayah_bbm'
    || profile?.role === 'admin_laporan_bbm'
  ) && !isSuperAdmin;
  const isLaporanBbm = reportType === 'laporan_bbm';

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData ? {
      ...initialData,
      price_pertamax: initialData.price_pertamax || 13500,
      price_dexlite: initialData.price_dexlite || 14500,
      no_spj: initialData.no_spj || '',
      items: toFormItems(initialData.items),
    } : {
      date: new Date().toISOString().split('T')[0],
      region: "",
      team: "",
      no_spj: "",
      price_pertamax: 13500,
      price_dexlite: 14500,
      items: [{
        vehicle_operator: "",
        no_pol: "",
        recipient_name: "",
        amount_rp: 0,
        amount_liter: 0,
        pertamax_rp: 0,
        pertamax_liter: 0,
        dexlite_rp: 0,
        dexlite_liter: 0,
        oli_liter: 0,
        item_remarks: "",
        activity_detail: "",
        is_location_same: false,
        requires_fuel: true,
        location: { street: "", subDistrict: "", village: "" }
      }],
      remarks: "",
    },
  });

  const draftKey = session?.user?.id
    ? `fuel-report:${reportType}:${session.user.id}:${initialData?.id ?? 'new'}`
    : undefined;
  const { clearDraft, lastSavedAt } = useFormDraft(form, draftKey);

  const { fields, insert, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
    keyName: "fieldKey"
  });

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const regionId = isRegionalFuelAdmin ? profile?.region_id || "__unassigned__" : null;
        const reports = isLaporanBbm
          ? await laporanBbmService.getAllReports(false, regionId)
          : await fuelService.getAllReports(false, regionId);
        const vehicles = new Map<string, string>();
        const noPolisi = new Map<string, string>();
        const streets = new Map<string, string>();
        const officers = new Map<string, string>();
        const addUnique = (target: Map<string, string>, value?: string | null) => {
          const cleaned = value?.trim();
          if (!cleaned) return;
          const key = cleaned.toLocaleLowerCase('id-ID');
          if (!target.has(key)) target.set(key, cleaned);
        };

        reports.forEach(r => {
          r.items?.forEach(item => {
            addUnique(vehicles, item.vehicle_operator);
            addUnique(noPolisi, item.no_pol);
            addUnique(streets, item.location?.street);
            addUnique(officers, item.item_remarks);
          });
        });

        setHistory({
          vehicles: new Set(vehicles.values()),
          noPolisi: new Set(noPolisi.values()),
          streets: new Set(streets.values()),
          officerNames: new Set(officers.values()),
        });
      } catch (e) { console.error(e); }
    };
    fetchHistory();
    if (!isEditing) fetchPrices();
  }, [isEditing, isRegionalFuelAdmin, profile?.region_id, reportType]);

  const fetchPrices = async () => {
    try {
      const data = await fuelPriceService.getPrices();
      const p = data.find(x => x.type === 'Pertamax')?.price || 13500;
      const d = data.find(x => x.type === 'Dexlite')?.price || 14500;
      if (form.getValues("price_pertamax") === 13500) form.setValue("price_pertamax", p);
      if (form.getValues("price_dexlite") === 14500) form.setValue("price_dexlite", d);
    } catch (e) { console.error(e); }
  };

  const calculateLiter = (index: number, rp: number, type: 'Pertamax' | 'Dexlite') => {
    const price = type === 'Pertamax' ? form.getValues("price_pertamax") : form.getValues("price_dexlite");
    if (price > 0) {
      const liter = parseFloat((rp / price).toFixed(2));
      form.setValue(`items.${index}.${type === 'Pertamax' ? 'pertamax_liter' : 'dexlite_liter'}`, liter);
    }
  };

  const selectedRegion = form.watch("region");
  const selectedTeam = form.watch("team");
  const normalizedTeam = selectedTeam.trim().toLocaleLowerCase('id-ID');
  const isPohonTeam = normalizedTeam === 'tim pohon' || normalizedTeam.startsWith('tim pohon ');
  const isMultiToolTeam = isPohonTeam || normalizedTeam === 'tim siram';
  const { regions, teams: allTeams } = useRegionFilterOptions(true, 'semua');
  const profileRegion = regions.find(region => region.id === profile?.region_id);
  // Keep the database foreign key independent from the displayed region name.
  // For regional roles the profile assignment is authoritative; this also
  // prevents a race while the region options are still loading.
  const selectedRegionId = isRegionalFuelAdmin
    ? profile?.region_id ?? null
    : regions.find(region => region.name === selectedRegion)?.id ?? null;
  const teams = allTeams.filter(team => team.region_id === selectedRegionId);
  const availableTeamNames = teams.length > 0 ? teams.map(team => team.name) : selectedRegion === 'Pusat' ? pusatTeams : [];
  const selectedTeamId = teams.find(team => team.name === form.getValues('team'))?.id ?? null;

  useEffect(() => {
    if (!isEditing && isRegionalFuelAdmin && profileRegion && !form.getValues("region")) {
      form.setValue("region", profileRegion.name);
      form.setValue("team", "");
    }
  }, [form, isEditing, isRegionalFuelAdmin, profileRegion]);

  const handleAddClick = () => {
    setAppendSourceIndex(null);
    setShowTypePrompt(true);
  };

  const handleTypeSelection = (requiresFuel: boolean) => {
    setShowTypePrompt(false);
    performAppend(false, requiresFuel, appendSourceIndex ?? fields.length - 1);
  };

  const performAppend = (isSameLocation: boolean, requiresFuel: boolean, sourceIndex = fields.length - 1) => {
    const sourceItem = form.getValues(`items.${sourceIndex}`);
    const lastLocation = sourceItem.location;

    const newItem = {
      vehicle_operator: requiresFuel ? "" : "-",
      no_pol: "",
      recipient_name: "",
      fuel_type: undefined,
      amount_rp: 0,
      amount_liter: 0,
      pertamax_rp: 0,
      pertamax_liter: 0,
      dexlite_rp: 0,
      dexlite_liter: 0,
      oli_liter: 0,
      item_remarks: "",
      activity_detail: "",
      is_location_same: isSameLocation,
      requires_fuel: requiresFuel,
      location: isSameLocation ? { ...lastLocation } : { street: "", subDistrict: "", village: "" }
    };
    if (!isSameLocation) {
      const currentItems = form.getValues('items');
      let insertIndex = Math.min(sourceIndex + 1, currentItems.length);
      while (insertIndex < currentItems.length && currentItems[insertIndex].is_location_same) insertIndex += 1;
      insert(insertIndex, newItem);
      return;
    }

    const currentItems = form.getValues('items');
    let insertIndex = Math.min(sourceIndex + 1, currentItems.length);
    while (insertIndex < currentItems.length && currentItems[insertIndex].is_location_same) insertIndex += 1;
    insert(insertIndex, newItem);
  };

  const handleAddPohonTool = (sourceIndex: number) => {
    performAppend(true, true, sourceIndex);
  };

  const handleAddWorkLocation = (sourceIndex: number) => {
    performAppend(false, false, sourceIndex);
  };

  const handleInvalidSubmit = (errors: Record<string, any>) => {
    const firstInvalidField = document.querySelector<HTMLElement>('[aria-invalid="true"]');
    firstInvalidField?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const errorDetails: string[] = [];
    const collectErrors = (value: any, path = '') => {
      if (!value || typeof value !== 'object') return;
      if (typeof value.message === 'string') {
        errorDetails.push(`${path || 'Form'}: ${value.message}`);
        return;
      }
      Object.entries(value).forEach(([key, child]) => {
        if (key === 'ref' || key === 'types') return;
        collectErrors(child, path ? `${path}.${key}` : key);
      });
    };
    collectErrors(errors);
    console.error('Form validation failed', errorDetails);

    if (errors.items) {
      showError(errorDetails.length ? errorDetails.slice(0, 2).join(' | ') : "Periksa kembali Kendaraan / Alat, Jenis BBM / Oli, dan Lokasi Kerja.");
    } else if (errors.region) {
      showError("Wilayah wajib dipilih.");
    } else if (errors.date) {
      showError("Tanggal wajib diisi.");
    } else {
      showError("Masih ada data wajib yang belum diisi.");
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (profile?.is_active === false) {
      showError("Akun nonaktif hanya dapat melihat dan mencetak data.");
      return;
    }
    const isAllowed = isLaporanBbm
      ? isSuperAdmin || profile?.role === 'admin_laporan_bbm'
      : profile?.role === 'admin'
        || profile?.role === 'admin_bbm'
        || profile?.role === 'admin_rencana_kerja_bbm'
        || profile?.role === 'admin_wilayah_bbm'
        || session?.user?.email === 'admin@gmail.com';
    if (!isAllowed) {
      showError("Anda tidak memiliki izin untuk menyimpan laporan ini");
      return;
    }

    setIsSubmitting(true);
    try {
      if (!values.team?.trim()) {
        showError("Tim wajib dipilih.");
        return;
      }
      if (isRegionalFuelAdmin && !profileRegion) {
        showError("Admin BBM belum memiliki wilayah. Atur wilayah akun di Manajemen Pengguna.");
        return;
      }
      if (isRegionalFuelAdmin && profileRegion && values.region !== profileRegion.name) {
        showError("Admin BBM hanya dapat menginput sesuai wilayah akun.");
        return;
      }

      if (!selectedRegionId) {
        showError("Wilayah belum siap atau belum memiliki ID wilayah. Silakan muat ulang halaman dan coba lagi.");
        return;
      }

      const normalizedItems = values.items.map((item, index) => {
        if (!item.is_location_same) return item;
        let locationOwnerIndex = index;
        while (locationOwnerIndex > 0 && values.items[locationOwnerIndex]?.is_location_same) locationOwnerIndex -= 1;
        return {
          ...item,
          location: { ...values.items[locationOwnerIndex].location },
        };
      });

      if (normalizedItems.some(item => !item.location.street?.trim())) {
        showError("Nama Jalan wajib diisi untuk setiap lokasi kerja.");
        return;
      }

      if (normalizedItems.some(item => item.requires_fuel !== false && !['Pertamax', 'Dexlite', ...(isLaporanBbm ? [] : ['Oli'])].includes(item.fuel_type || ''))) {
        showError("Setiap Kendaraan / Alat wajib memilih satu jenis BBM atau Oli.");
        return;
      }

      if (normalizedItems.some(item => item.requires_fuel !== false && !item.vehicle_operator?.trim())) {
        showError("Kendaraan / Alat wajib diisi untuk setiap pemakaian BBM / Oli.");
        return;
      }

      const finalData = {
        date: values.date,
        region: values.region,
        team: values.team,
        region_id: selectedRegionId,
        team_id: selectedTeamId,
        price_pertamax: values.price_pertamax,
        price_dexlite: values.price_dexlite,
        items: normalizedItems.flatMap(item => {
          const base = {
            vehicle_operator: item.requires_fuel === false ? "-" : item.vehicle_operator || "-",
            no_pol: item.no_pol?.trim() || "",
            recipient_name: item.recipient_name?.trim() || "",
            item_remarks: item.requires_fuel === false ? "" : item.item_remarks || "",
            activity_detail: item.activity_detail || "",
            is_location_same: item.is_location_same,
            requires_fuel: item.requires_fuel,
            location: item.location,
          };
          if (!item.requires_fuel) {
            return [{ ...base, fuel_type: 'Pertamax' as FuelType, amount_rp: 0, amount_liter: 0, amount: 0 }];
          }
          const entries = [{
            fuel_type: item.fuel_type as FuelType,
            amount_rp: item.fuel_type === 'Pertamax' ? item.pertamax_rp || 0 : item.fuel_type === 'Dexlite' ? item.dexlite_rp || 0 : 0,
            amount_liter: item.fuel_type === 'Pertamax' ? item.pertamax_liter || 0 : item.fuel_type === 'Dexlite' ? item.dexlite_liter || 0 : item.oli_liter || 0,
          }];
          return entries
            .filter(entry => (!isLaporanBbm || entry.fuel_type !== 'Oli') && (entry.amount_rp > 0 || entry.amount_liter > 0))
            .map(entry => ({ ...base, ...entry, amount: entry.fuel_type === 'Oli' ? entry.amount_liter : entry.amount_rp }));
        }),
        remarks: values.remarks,
        ...(isLaporanBbm ? { no_spj: values.no_spj.trim() } : {}),
      };

      if (!finalData.items.length) {
        showError("Minimal satu pemakaian BBM / Oli harus memiliki jumlah lebih dari 0.");
        return;
      }

      if (isEditing && initialData) {
        if (isLaporanBbm) {
          await laporanBbmService.updateReport(initialData.id, finalData);
        } else {
          await fuelService.updateReport(initialData.id, finalData);
        }
        showSuccess("Laporan BBM diperbarui");
      } else {
        if (isLaporanBbm) {
          await laporanBbmService.createReport(finalData);
        } else {
          await fuelService.createReport(finalData);
        }
        showSuccess("Laporan BBM disimpan");
      }
      await clearDraft();
      navigate(isLaporanBbm ? '/laporan-bbm' : '/fuel-reports');
    } catch (error: any) {
      const message = error?.message || "Terjadi kesalahan database";
      if (/refresh token|jwt|unauthorized|not authenticated/i.test(message)) {
        showError("Sesi login sudah kedaluwarsa. Silakan login ulang, lalu coba simpan kembali.");
      } else {
        showError(`Gagal simpan: ${message}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const watchedItems = form.watch('items');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, handleInvalidSubmit)} className="mx-auto max-w-5xl space-y-8 pb-20">
        {/* DataLists for Autocomplete */}
        <datalist id="fuel-history-vehicles">{Array.from(history.vehicles).map(v => <option key={v} value={v} />)}</datalist>
        <datalist id="fuel-history-no-polisi">{Array.from(history.noPolisi).map(v => <option key={v} value={v} />)}</datalist>
        <datalist id="fuel-history-streets">{Array.from(history.streets).map(v => <option key={v} value={v} />)}</datalist>
        <datalist id="fuel-history-officers">{Array.from(history.officerNames).map(v => <option key={v} value={v} />)}</datalist>

        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="ghost" className="w-fit px-2 text-slate-600 hover:text-slate-900" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
          </Button>
          <div className="text-left sm:text-center">
            <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">
              {isEditing ? (isLaporanBbm ? "Edit Laporan BBM" : "Edit Laporan BBM & Oli") : (isLaporanBbm ? "Input Laporan BBM" : "Input Laporan BBM & Oli")}
            </h1>
            <p className="mt-1 text-xs text-slate-500">{lastSavedAt ? "Draft tersimpan otomatis" : "Draft akan tersimpan otomatis"}</p>
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 shadow-sm hover:bg-blue-700 sm:w-auto">
            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Simpan...</> : <><Save className="h-4 w-4 mr-2" /> Simpan</>}
          </Button>
        </div>

        <Card className="overflow-hidden rounded-2xl border-slate-200 border-t-4 border-t-blue-600 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/60 pb-4"><CardTitle className="flex items-center gap-2 text-lg"><Info className="h-5 w-5 text-blue-500" /> {isLaporanBbm ? 'Informasi Wilayah, Tim & SPJ' : 'Informasi Wilayah & Tim'}</CardTitle></CardHeader>
          <CardContent className="space-y-7 pt-6">
            <div className={cn("grid grid-cols-1 gap-4", isLaporanBbm ? "md:grid-cols-3" : "md:grid-cols-2")}>
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem><FormLabel>Tanggal</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              
              <FormField control={form.control} name="region" render={({ field }) => (
                <FormItem>
                  <FormLabel>Wilayah</FormLabel>
                  <Select onValueChange={(val) => { field.onChange(val); form.setValue("team", ""); }} value={field.value} disabled={isRegionalFuelAdmin && !isSuperAdmin}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Pilih Wilayah" /></SelectTrigger></FormControl>
                    <SelectContent>{regions.filter(region => !isRegionalFuelAdmin || region.id === profile?.region_id).map(region => <SelectItem key={region.id} value={region.name}>{region.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="team" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tim / Operator</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!selectedRegion}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Pilih Tim" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {availableTeamNames.map(teamName => <SelectItem key={teamName} value={teamName}>{teamName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              {isLaporanBbm && <FormField control={form.control} name="no_spj" render={({ field }) => (
                <FormItem>
                  <FormLabel>No. SPJ</FormLabel>
                  <FormControl><Input placeholder="Masukkan nomor SPJ" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />}
            </div>

            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                {canEditPrice ? <Unlock className="h-4 w-4 text-blue-500" /> : <Lock className="h-4 w-4 text-slate-400" />}
                <span className="text-xs font-bold uppercase text-slate-500">
                  {canEditPrice ? "Harga BBM (Dapat Diubah Manual)" : "Harga BBM Hari Ini (Otomatis dari Master)"}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-2">
                <FormField control={form.control} name="price_pertamax" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold text-blue-700 flex items-center gap-1">
                      HARGA PERTAMAX (RP/LITER) {canEditPrice ? <Unlock size={10} /> : <Lock size={10} />}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="numeric"
                        className={cn("font-bold", !canEditPrice && "bg-slate-100 cursor-not-allowed")}
                        {...field}
                        value={formatRupiahInput(field.value)}
                        onChange={(event) => field.onChange(parseRupiahInput(event.target.value))}
                        readOnly={!canEditPrice}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="price_dexlite" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold text-green-700 flex items-center gap-1">
                      HARGA DEXLITE (RP/LITER) {canEditPrice ? <Unlock size={10} /> : <Lock size={10} />}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="numeric"
                        className={cn("font-bold", !canEditPrice && "bg-slate-100 cursor-not-allowed")}
                        {...field}
                        value={formatRupiahInput(field.value)}
                        onChange={(event) => field.onChange(parseRupiahInput(event.target.value))}
                        readOnly={!canEditPrice}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50"><Fuel className="text-orange-600" size={20} /></span>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Detail Pemakaian & Lokasi</h2>
              <p className="mt-0.5 text-xs text-slate-500">Tambahkan kendaraan atau alat sesuai lokasi kerja.</p>
            </div>
          </div>

          {fields.map((field, index) => {
            const scopeNumber = watchedItems
              .slice(0, index + 1)
              .filter(item => item.requires_fuel !== false).length || 1;
            const isLocationSame = form.watch(`items.${index}.is_location_same`);
            const requiresFuel = form.watch(`items.${index}.requires_fuel`);
            const locationOwnerIndex = (() => {
              let ownerIndex = index;
              while (ownerIndex > 0 && watchedItems[ownerIndex]?.is_location_same) ownerIndex -= 1;
              return ownerIndex;
            })();
            const isLastInLocationGroup = index === watchedItems.length - 1 || !watchedItems[index + 1]?.is_location_same;
            const hasFollowingTool = watchedItems[index + 1]?.is_location_same === true;
            const subDistrict = form.watch(`items.${locationOwnerIndex}.location.subDistrict`);
            
            return (
              <Card key={field.fieldKey} className={cn(
                "relative overflow-hidden border-slate-200 bg-white",
                isLocationSame || !requiresFuel
                  ? "-mt-4 rounded-none border-x border-t-0 border-b-0 shadow-none"
                  : hasFollowingTool
                    ? "rounded-t-2xl rounded-b-none border-b-0 shadow-sm"
                    : "rounded-2xl shadow-sm"
              )}>
                <CardContent className={cn("space-y-6", isLocationSame ? "px-5 py-5 sm:px-7" : "p-5 sm:p-7")}>
                  {!isLocationSame && requiresFuel && <div className="flex items-center">
                    <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700">
                      Pemakaian BBM #{scopeNumber}
                    </Badge>
                  </div>}
                  {fields.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="absolute right-5 top-5 h-8 w-8 text-red-400 hover:text-red-600" onClick={() => remove(index)}><Trash2 size={18} /></Button>
                  )}
                  
                  {requiresFuel && (
                    <>
                    <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-12">
                      <div className={cn(isLaporanBbm ? "md:col-span-2" : "md:col-span-3")}>
                        <FormField control={form.control} name={`items.${index}.vehicle_operator`} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs font-semibold text-slate-700">Kendaraan / Alat</FormLabel><FormControl><Input className="h-10" placeholder="Nama kendaraan atau alat" list="fuel-history-vehicles" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                      {isLaporanBbm && <div className="md:col-span-2">
                        <FormField control={form.control} name={`items.${index}.no_pol`} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs font-semibold text-slate-700">No. Polisi</FormLabel><FormControl><Input placeholder="Contoh: BK 1234 AB" className="h-10 uppercase" list="fuel-history-no-polisi" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>}
                      {isLaporanBbm ? <div className="space-y-3 md:col-span-2">
                        <FormField control={form.control} name={`items.${index}.recipient_name`} render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold text-slate-700">Nama Penerima</FormLabel>
                            <FormControl><Input placeholder="Nama penerima..." className="h-10" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name={`items.${index}.item_remarks`} render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold text-slate-700">Petugas</FormLabel>
                            <FormControl><Input placeholder="Nama petugas..." className="h-10" list="fuel-history-officers" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div> : <div className="md:col-span-3">
                        <FormField control={form.control} name={`items.${index}.item_remarks`} render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold text-slate-700">Petugas</FormLabel>
                            <FormControl><Input placeholder="Nama Petugas..." className="h-10" list="fuel-history-officers" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>}
                      <div className="md:col-span-2">
                        <FormField control={form.control} name={`items.${index}.fuel_type`} render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold text-slate-700">Jenis BBM / Oli</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <FormControl><SelectTrigger className="h-10"><SelectValue placeholder="Pilih jenis" /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="Pertamax">Pertamax</SelectItem>
                                <SelectItem value="Dexlite">Dexlite</SelectItem>
                                {!isLaporanBbm && <SelectItem value="Oli">Oli</SelectItem>}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 md:col-span-4">
                        {form.watch(`items.${index}.fuel_type`) === 'Pertamax' && <div className="col-span-2 grid grid-cols-2 gap-2">
                            <FormField control={form.control} name={`items.${index}.pertamax_rp`} render={({ field }) => (
                              <FormItem><FormLabel className="text-[10px]">Rupiah (Rp)</FormLabel><FormControl><Input type="text" inputMode="numeric" className="h-9" {...field} value={formatRupiahInput(field.value)} onChange={(e) => { const amount = parseRupiahInput(e.target.value); field.onChange(amount); calculateLiter(index, amount, 'Pertamax'); }} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name={`items.${index}.pertamax_liter`} render={({ field }) => (
                              <FormItem><FormLabel className="flex items-center gap-1 text-[10px]">Liter <Calculator size={10} className="text-blue-500" /></FormLabel><FormControl><Input type="number" step="0.01" className="h-9 bg-blue-100 font-bold" {...field} readOnly /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>}
                        {form.watch(`items.${index}.fuel_type`) === 'Dexlite' && <div className="col-span-2 grid grid-cols-2 gap-2">
                            <FormField control={form.control} name={`items.${index}.dexlite_rp`} render={({ field }) => (
                              <FormItem><FormLabel className="text-[10px]">Rupiah (Rp)</FormLabel><FormControl><Input type="text" inputMode="numeric" className="h-9" {...field} value={formatRupiahInput(field.value)} onChange={(e) => { const amount = parseRupiahInput(e.target.value); field.onChange(amount); calculateLiter(index, amount, 'Dexlite'); }} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name={`items.${index}.dexlite_liter`} render={({ field }) => (
                              <FormItem><FormLabel className="flex items-center gap-1 text-[10px]">Liter <Calculator size={10} className="text-green-500" /></FormLabel><FormControl><Input type="number" step="0.01" className="h-9 bg-green-100 font-bold" {...field} readOnly /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>}
                        {!isLaporanBbm && form.watch(`items.${index}.fuel_type`) === 'Oli' && <div className="col-span-1">
                          <FormField control={form.control} name={`items.${index}.oli_liter`} render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px]">Liter</FormLabel><FormControl><Input type="number" step="0.01" className="h-9 font-bold" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                        </div>}
                      </div>
                    </div>
                    {isMultiToolTeam && isLastInLocationGroup && <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full rounded-xl border-dashed border-orange-300 bg-orange-50/40 font-semibold text-orange-700 shadow-none hover:bg-orange-50"
                      onClick={() => handleAddPohonTool(index)}
                    >
                      <Plus className="mr-2 h-4 w-4" /> Tambah Kendaraan / Alat di Lokasi Ini
                    </Button>}
                    </>
                  )}

                  {isLastInLocationGroup && (
                    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 text-xs font-bold uppercase tracking-[0.12em] text-green-700"><MapPin size={15} /> Lokasi Kerja Item Ini</div>
                      <FormField control={form.control} name={`items.${locationOwnerIndex}.location.street`} render={({ field }) => (
                        <FormItem><FormLabel className="text-xs font-semibold text-slate-600">{normalizedTeam === 'tim siram' ? 'Lokasi Kerja' : 'Nama Jalan'}</FormLabel><FormControl><Input className="h-10 bg-white" list="fuel-history-streets" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name={`items.${locationOwnerIndex}.location.subDistrict`} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs font-semibold text-slate-600">Kecamatan (Opsional)</FormLabel><Select onValueChange={(val) => { field.onChange(val); form.setValue(`items.${locationOwnerIndex}.location.village`, ""); }} value={field.value}><FormControl><SelectTrigger className="h-10 bg-white"><SelectValue placeholder="Pilih Kecamatan" /></SelectTrigger></FormControl><SelectContent><SelectItem value=" ">Abaikan / Kosong</SelectItem>{Object.keys(medanDistricts).map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></FormItem>
                        )} />
                        <FormField control={form.control} name={`items.${locationOwnerIndex}.location.village`} render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold text-slate-600">Kelurahan (Opsional)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} disabled={!subDistrict || subDistrict === " "}>
                              <FormControl><SelectTrigger className="h-10 bg-white"><SelectValue placeholder="Pilih Kelurahan" /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value=" ">Abaikan / Kosong</SelectItem>
                                {subDistrict && subDistrict !== " " && medanDistricts[subDistrict]?.map(v => (
                                  <SelectItem key={v} value={v}>{v}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                      </div>
                      <FormField control={form.control} name={`items.${locationOwnerIndex}.activity_detail`} render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-slate-600">Detail Kegiatan</FormLabel>
                          <FormControl><Input className="h-10 bg-white" placeholder="Jelaskan detail kegiatan..." {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 w-full rounded-xl border-dashed border-blue-200 bg-blue-50/30 font-semibold text-blue-700 shadow-none hover:bg-blue-50"
                        onClick={() => handleAddWorkLocation(locationOwnerIndex)}
                      >
                        <Plus className="mr-2 h-4 w-4" /> {normalizedTeam === 'tim siram' ? 'Tambah Lokasi Kendaraan yang sama' : 'Tambah Lokasi Kerja (Pemakaian BBM Sama)'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          <Button 
            type="button" 
            variant="outline" 
            className="h-14 w-full rounded-2xl border-dashed border-blue-200 bg-blue-50/30 font-bold text-blue-700 shadow-none hover:bg-blue-50"
            onClick={handleAddClick}
          >
            <Plus className="h-5 w-5 mr-2" /> {normalizedTeam === 'tim siram' ? 'Tambah Kendaraan / Lokasi Baru' : isMultiToolTeam ? 'Tambah Lokasi Baru' : 'Tambah Pemakaian atau Lokasi Baru'}
          </Button>
        </div>

        <Card>
          <CardHeader className="py-3"><CardTitle className="text-sm flex items-center gap-2"><MessageSquare size={16} className="text-slate-400" /> Keterangan Tambahan (Umum)</CardTitle></CardHeader>
          <CardContent>
            <FormField control={form.control} name="remarks" render={({ field }) => (
              <FormItem><FormControl><Input placeholder="Catatan tambahan untuk seluruh laporan..." {...field} /></FormControl></FormItem>
            )} />
          </CardContent>
        </Card>
      </form>

      <Dialog open={showTypePrompt} onOpenChange={setShowTypePrompt}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600">
              <HelpCircle className="h-5 w-5" /> Tipe Pemakaian Baru
            </DialogTitle>
            <DialogDescription className="pt-2">
              Apakah pemakaian baru ini memerlukan penginputan <strong>{isLaporanBbm ? 'BBM' : 'BBM / Oli'}</strong> lagi?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 flex flex-col gap-3">
            <Button onClick={() => handleTypeSelection(true)} className="h-12 justify-start px-6 bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200">
              <Fuel className="mr-3 h-5 w-5" /> Ya, Perlu Input {isLaporanBbm ? 'BBM' : 'BBM / Oli'}
            </Button>
            <Button onClick={() => handleTypeSelection(false)} variant="outline" className="h-12 justify-start px-6 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200">
              <MapPinned className="mr-3 h-5 w-5" /> Tidak, Hanya Tambah Lokasi
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowTypePrompt(false)}>Batal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </Form>
  );
};

export default FuelReportForm;
