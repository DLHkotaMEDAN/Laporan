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
  Plus, Trash2, MessageSquare, HelpCircle, MapPinned, Check, Calculator, Lock, Unlock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { showSuccess, showError } from '@/utils/toast';
import { FuelReport, FuelReportType, FuelType } from '@/types/fuelReport';
import { fuelService } from '@/services/fuelService';
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
  vehicle_operator: z.string().min(1, "Wajib diisi"),
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
    street: z.string().min(1, "Jalan wajib diisi"),
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
      requires_fuel: true,
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

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  });

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const reports = await fuelService.getAllReports(false, isRegionalFuelAdmin ? profile?.region_id || "__unassigned__" : null, reportType);
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
    setShowTypePrompt(true);
  };

  const handleTypeSelection = (requiresFuel: boolean) => {
    setShowTypePrompt(false);
    performAppend(false, requiresFuel);
  };

  const performAppend = (isSameLocation: boolean, requiresFuel: boolean) => {
    const lastItem = form.getValues(`items.${fields.length - 1}`);
    const lastLocation = lastItem.location;
    const lastVehicle = lastItem.vehicle_operator;

    append({
      vehicle_operator: requiresFuel ? "" : lastVehicle || "-",
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
    });
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
      if (isLaporanBbm && !values.no_spj.trim()) {
        showError("No. SPJ wajib diisi untuk Laporan BBM.");
        return;
      }
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

      const finalData = {
        date: values.date,
        region: values.region,
        team: values.team,
        region_id: selectedRegionId,
        team_id: selectedTeamId,
        report_type: reportType,
        no_spj: values.no_spj.trim(),
        price_pertamax: values.price_pertamax,
        price_dexlite: values.price_dexlite,
        items: values.items.flatMap(item => {
          const base = {
            vehicle_operator: item.vehicle_operator || "-",
            no_pol: item.no_pol?.trim() || "",
            recipient_name: item.recipient_name?.trim() || "",
            item_remarks: item.item_remarks || "",
            activity_detail: item.activity_detail || "",
            is_location_same: item.is_location_same,
            requires_fuel: item.requires_fuel,
            location: item.location,
          };
          if (!item.requires_fuel) {
            return [{ ...base, fuel_type: 'Pertamax' as FuelType, amount_rp: 0, amount_liter: 0, amount: 0 }];
          }
          const entries = [
            { fuel_type: 'Pertamax' as FuelType, amount_rp: item.pertamax_rp || 0, amount_liter: item.pertamax_liter || 0 },
            { fuel_type: 'Dexlite' as FuelType, amount_rp: item.dexlite_rp || 0, amount_liter: item.dexlite_liter || 0 },
            { fuel_type: 'Oli' as FuelType, amount_rp: 0, amount_liter: item.oli_liter || 0 },
          ];
          return entries
            .filter(entry => (!isLaporanBbm || entry.fuel_type !== 'Oli') && (entry.amount_rp > 0 || entry.amount_liter > 0))
            .map(entry => ({ ...base, ...entry, amount: entry.fuel_type === 'Oli' ? entry.amount_liter : entry.amount_rp }));
        }),
        remarks: values.remarks,
      };

      if (isEditing && initialData) {
        await fuelService.updateReport(initialData.id, finalData);
        showSuccess("Laporan BBM diperbarui");
      } else {
        await fuelService.createReport(finalData);
        showSuccess("Laporan BBM disimpan");
      }
      await clearDraft();
      navigate(isLaporanBbm ? '/laporan-bbm' : '/fuel-reports');
    } catch (error: any) {
      showError(`Gagal simpan: ${error.message || "Terjadi kesalahan database"}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  const watchedItems = form.watch('items');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-4xl mx-auto pb-20">
        {/* DataLists for Autocomplete */}
        <datalist id="fuel-history-vehicles">{Array.from(history.vehicles).map(v => <option key={v} value={v} />)}</datalist>
        <datalist id="fuel-history-no-polisi">{Array.from(history.noPolisi).map(v => <option key={v} value={v} />)}</datalist>
        <datalist id="fuel-history-streets">{Array.from(history.streets).map(v => <option key={v} value={v} />)}</datalist>
        <datalist id="fuel-history-officers">{Array.from(history.officerNames).map(v => <option key={v} value={v} />)}</datalist>

        <div className="flex items-center justify-between mb-6">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
          </Button>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-primary">
              {isEditing ? (isLaporanBbm ? "Edit Laporan BBM" : "Edit Laporan BBM & Oli") : (isLaporanBbm ? "Input Laporan BBM" : "Input Laporan BBM & Oli")}
            </h1>
            <p className="text-[10px] text-slate-500">{lastSavedAt ? "Draft tersimpan" : "Draft akan tersimpan otomatis"}</p>
          </div>
          <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Simpan...</> : <><Save className="h-4 w-4 mr-2" /> Simpan</>}
          </Button>
        </div>

        <Card className="border-t-4 border-t-blue-600">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Info className="h-5 w-5 text-blue-500" /> {isLaporanBbm ? 'Informasi Wilayah, Tim & SPJ' : 'Informasi Wilayah & Tim'}</CardTitle></CardHeader>
          <CardContent className="space-y-6">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-dashed">
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
          <h2 className="text-xl font-bold flex items-center gap-2"><Fuel className="text-orange-600" /> Detail Pemakaian & Lokasi</h2>

          {fields.map((field, index) => {
            const scopeNumber = watchedItems
              .slice(0, index + 1)
              .filter(item => item.requires_fuel !== false).length || 1;
            const isLocationSame = form.watch(`items.${index}.is_location_same`);
            const requiresFuel = form.watch(`items.${index}.requires_fuel`);
            const subDistrict = form.watch(`items.${index}.location.subDistrict`);
            
            return (
              <Card key={field.id} className={cn(
                "border-l-4 relative overflow-hidden shadow-sm",
                requiresFuel ? "border-l-orange-500" : "border-l-blue-400 bg-blue-50/10 -mt-3 rounded-t-none"
              )}>
                <CardContent className="pt-6 space-y-6">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={requiresFuel ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-blue-50 text-blue-700 border-blue-200"}>
                        {requiresFuel ? `Pemakaian BBM #${scopeNumber}` : `Lokasi Tambahan Pemakaian BBM #${scopeNumber}`}
                      </Badge>
                      {isLocationSame && <Badge className="bg-green-100 text-green-700 border-green-200"><Check size={10} className="mr-1" /> Lokasi Sama</Badge>}
                    </div>
                    {fields.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600" onClick={() => remove(index)}><Trash2 size={18} /></Button>
                    )}
                  </div>
                  
                  {requiresFuel && (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      <div className={cn(isLaporanBbm ? "md:col-span-2" : "md:col-span-3")}>
                        <FormField control={form.control} name={`items.${index}.vehicle_operator`} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs font-bold">Kendaraan / Alat</FormLabel><FormControl><Input placeholder="Nama kendaraan atau alat" list="fuel-history-vehicles" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                      {isLaporanBbm && <div className="md:col-span-2">
                        <FormField control={form.control} name={`items.${index}.no_pol`} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs font-bold">No. Polisi</FormLabel><FormControl><Input placeholder="Contoh: BK 1234 AB" className="uppercase" list="fuel-history-no-polisi" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>}
                      <div className={cn("grid grid-cols-1 gap-2", isLaporanBbm ? "sm:grid-cols-2 md:col-span-6" : "sm:grid-cols-3 md:col-span-7")}>
                        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-2 space-y-2">
                          <p className="text-xs font-bold text-blue-700">PERTAMAX</p>
                          <FormField control={form.control} name={`items.${index}.pertamax_rp`} render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px]">Rupiah (Rp)</FormLabel><FormControl><Input type="text" inputMode="numeric" className="h-9" {...field} value={formatRupiahInput(field.value)} onChange={(e) => { const amount = parseRupiahInput(e.target.value); field.onChange(amount); calculateLiter(index, amount, 'Pertamax'); }} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name={`items.${index}.pertamax_liter`} render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] flex items-center gap-1">Liter <Calculator size={10} className="text-blue-500" /></FormLabel><FormControl><Input type="number" step="0.01" className="h-9 font-bold bg-blue-100" {...field} readOnly /></FormControl><FormMessage /></FormItem>
                          )} />
                        </div>
                        <div className="rounded-lg border border-green-200 bg-green-50/50 p-2 space-y-2">
                          <p className="text-xs font-bold text-green-700">DEXLITE</p>
                          <FormField control={form.control} name={`items.${index}.dexlite_rp`} render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px]">Rupiah (Rp)</FormLabel><FormControl><Input type="text" inputMode="numeric" className="h-9" {...field} value={formatRupiahInput(field.value)} onChange={(e) => { const amount = parseRupiahInput(e.target.value); field.onChange(amount); calculateLiter(index, amount, 'Dexlite'); }} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name={`items.${index}.dexlite_liter`} render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] flex items-center gap-1">Liter <Calculator size={10} className="text-green-500" /></FormLabel><FormControl><Input type="number" step="0.01" className="h-9 font-bold bg-green-100" {...field} readOnly /></FormControl><FormMessage /></FormItem>
                          )} />
                        </div>
                        {!isLaporanBbm && <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-2 space-y-2">
                          <p className="text-xs font-bold text-amber-700">OLI</p>
                          <div className="h-9 text-[10px] text-slate-500 flex items-center">Input jumlah oli</div>
                          <FormField control={form.control} name={`items.${index}.oli_liter`} render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px]">Liter</FormLabel><FormControl><Input type="number" step="0.01" className="h-9 font-bold" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                        </div>}
                      </div>
                      {isLaporanBbm && <div className="space-y-3 md:col-span-2">
                        <FormField control={form.control} name={`items.${index}.recipient_name`} render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-bold">Nama Penerima</FormLabel>
                            <FormControl><Input placeholder="Nama penerima..." className="h-10" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name={`items.${index}.item_remarks`} render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-bold">Petugas</FormLabel>
                            <FormControl><Input placeholder="Nama petugas..." className="h-10" list="fuel-history-officers" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>}
                      {!isLaporanBbm && <div className="md:col-span-2">
                        <FormField control={form.control} name={`items.${index}.item_remarks`} render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-bold">Petugas</FormLabel>
                            <FormControl><Input placeholder="Nama Petugas..." className="h-10" list="fuel-history-officers" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>}
                    </div>
                  )}

                  {!isLocationSame ? (
                    <div className="pt-4 border-t border-slate-100 space-y-4">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase text-green-600 tracking-wider"><MapPin size={14} /> Lokasi Kerja Item Ini</div>
                      <FormField control={form.control} name={`items.${index}.location.street`} render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] uppercase text-slate-500">Nama Jalan</FormLabel><FormControl><Input className="h-9" list="fuel-history-streets" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name={`items.${index}.location.subDistrict`} render={({ field }) => (
                          <FormItem><FormLabel className="text-[10px] uppercase text-slate-500">Kecamatan (Opsional)</FormLabel><Select onValueChange={(val) => { field.onChange(val); form.setValue(`items.${index}.location.village`, ""); }} value={field.value}><FormControl><SelectTrigger className="h-9"><SelectValue placeholder="Pilih Kecamatan" /></SelectTrigger></FormControl><SelectContent><SelectItem value=" ">Abaikan / Kosong</SelectItem>{Object.keys(medanDistricts).map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></FormItem>
                        )} />
                        <FormField control={form.control} name={`items.${index}.location.village`} render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] uppercase text-slate-500">Kelurahan (Opsional)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} disabled={!subDistrict || subDistrict === " "}>
                              <FormControl><SelectTrigger className="h-9"><SelectValue placeholder="Pilih Kelurahan" /></SelectTrigger></FormControl>
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
                      <FormField control={form.control} name={`items.${index}.activity_detail`} render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] uppercase text-slate-500">Detail Kegiatan</FormLabel>
                          <FormControl><Input className="h-9" placeholder="Jelaskan detail kegiatan..." {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  ) : (
                    <div className="pt-4 border-t border-dashed border-slate-200 flex items-center justify-between bg-slate-50/50 p-3 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-slate-500 italic"><MapPin size={14} className="text-slate-400" /> Lokasi disamakan dengan pemakaian sebelumnya</div>
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px] text-blue-600" onClick={() => form.setValue(`items.${index}.is_location_same`, false)}>Ubah Lokasi</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          <Button 
            type="button" 
            variant="outline" 
            className="w-full border-dashed py-8 bg-white text-blue-600 font-bold border-blue-200 hover:bg-blue-50" 
            onClick={handleAddClick}
          >
            <Plus className="h-5 w-5 mr-2" /> Tambah Pemakaian atau Lokasi baru
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
