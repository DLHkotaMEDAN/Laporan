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
  Plus, Trash2, Calculator, FileText, Users, Lock, Unlock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { showSuccess, showError } from '@/utils/toast';
import { fuelSpjService } from '@/services/fuelSpjService';
import { fuelPriceService } from '@/services/fuelPriceService';
import { medanDistricts } from '@/data/medan-districts';
import { useAuth } from '@/context/AuthContext';
import { Badge } from "@/components/ui/badge";
import { FuelType } from '@/types/fuelReport';
import { cn } from "@/lib/utils";
import { useRegionFilterOptions } from '@/hooks/useRegionFilterOptions';

const pusatTeams = ['Tim Babat', 'Dumb Truck', 'Mobil Crane', 'Pickup', 'Mobil Tangga', 'Mobil Tangga 30M', 'Beco Loader'];

const locationSchema = z.object({
  street: z.string().min(1, "Wajib diisi"),
  subDistrict: z.string().optional().default(""),
  village: z.string().optional().default(""),
  fuel_type: z.string().min(1, "Jenis wajib"),
  amount_rp: z.coerce.number().min(0),
  amount_liter: z.coerce.number().min(0),
  remarks: z.string().optional().default(""),
});

const entrySchema = z.object({
  spj_no: z.string().min(1, "No. SPJ Wajib diisi"),
  vehicle_operator: z.string().min(1, "Kendaraan wajib diisi"),
  receiver_name: z.string().min(1, "Penerima wajib diisi"),
  locations: z.array(locationSchema).min(1),
});

const formSchema = z.object({
  date: z.string().min(1, "Tanggal wajib diisi"),
  region: z.string().min(1, "Wilayah wajib dipilih"),
  team: z.string().min(1, "Tim wajib dipilih"),
  price_pertamax: z.coerce.number().min(1, "Harga wajib diisi"),
  price_dexlite: z.coerce.number().min(1, "Harga wajib diisi"),
  entries: z.array(entrySchema).min(1),
  remarks: z.string().optional().default(""),
});

const FuelSpjReportForm = ({ initialData, isEditing = false }: { initialData?: any; isEditing?: boolean }) => {
  const navigate = useNavigate();
  const { profile, session } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Autocomplete States
  const [history, setHistory] = useState({
    vehicles: new Set<string>(),
    receivers: new Set<string>(),
    streets: new Set<string>(),
    spjNumbers: new Set<string>()
  });

  const canEditPrice = profile?.role === 'admin' || profile?.role === 'admin_bbm' || profile?.role === 'admin_spj_bbm' || session?.user?.email === 'admin@gmail.com';
  const isSpjBbmAdmin = profile?.role === 'admin_spj_bbm';

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData ? {
      ...initialData,
      price_pertamax: initialData.price_pertamax || 13500,
      price_dexlite: initialData.price_dexlite || 14500,
    } : {
      date: new Date().toISOString().split('T')[0],
      region: "",
      team: "",
      price_pertamax: 13500,
      price_dexlite: 14500,
      entries: [{ 
        spj_no: "", 
        vehicle_operator: "", 
        receiver_name: "",
        locations: [{ street: "", subDistrict: "", village: "", fuel_type: "Pertamax", amount_rp: 0, amount_liter: 0, remarks: "" }]
      }],
      remarks: "",
    },
  });

  const { fields: entryFields, append: appendEntry, remove: removeEntry } = useFieldArray({
    control: form.control,
    name: "entries"
  });

  const selectedRegion = form.watch("region");
  const { regions, teams: allTeams } = useRegionFilterOptions(true, 'semua');
  const selectedRegionId = regions.find(region => region.name === selectedRegion)?.id ?? null;
  const teams = allTeams.filter(team => team.region_id === selectedRegionId);
  const availableTeamNames = teams.length > 0 ? teams.map(team => team.name) : selectedRegion === 'Pusat' ? pusatTeams : [];
  const selectedTeamId = teams.find(team => team.name === form.getValues('team'))?.id ?? null;

  useEffect(() => {
    if (!isEditing && isSpjBbmAdmin) {
      form.setValue('region', 'Pusat');
      form.setValue('team', 'Tim Babat');
    }
  }, [form, isEditing, isSpjBbmAdmin]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const reports = await fuelSpjService.getAllReports();
        const vehicles = new Set<string>();
        const receivers = new Set<string>();
        const streets = new Set<string>();
        const spjNumbers = new Set<string>();
        
        reports.forEach(report => {
          report.entries.forEach(entry => {
            if (entry.vehicle_operator) vehicles.add(entry.vehicle_operator);
            if (entry.receiver_name) receivers.add(entry.receiver_name);
            if (entry.spj_no) spjNumbers.add(entry.spj_no.toLowerCase().trim());
            entry.locations.forEach(loc => {
              if (loc.street) streets.add(loc.street);
            });
          });
        });
        
        setHistory({ vehicles, receivers, streets, spjNumbers });
      } catch (e) { console.error(e); }
    };

    fetchHistory();
    if (!isEditing) fetchPrices();
  }, [isEditing]);

  const fetchPrices = async () => {
    try {
      const data = await fuelPriceService.getPrices();
      const p = data.find(x => x.type === 'Pertamax')?.price || 13500;
      const d = data.find(x => x.type === 'Dexlite')?.price || 14500;
      form.setValue("price_pertamax", p);
      form.setValue("price_dexlite", d);
    } catch (e) { console.error(e); }
  };

  const calculateLiter = (index: number, locIndex: number, rp: number, type: string) => {
    if (type === 'Oli') return;
    const price = type === 'Pertamax' ? form.getValues("price_pertamax") : form.getValues("price_dexlite");
    if (price > 0) {
      const liter = parseFloat((rp / price).toFixed(2));
      form.setValue(`entries.${index}.locations.${locIndex}.amount_liter`, liter);
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const currentSpjNumbers = values.entries.map(e => e.spj_no.toLowerCase().trim());
    const hasInternalDuplicate = currentSpjNumbers.some((no, idx) => currentSpjNumbers.indexOf(no) !== idx);
    if (hasInternalDuplicate) {
      showError("Nomor SPJ sudah Ada (Duplikat di dalam form)");
      return;
    }

    if (!isEditing) {
      const duplicateInDb = currentSpjNumbers.find(no => history.spjNumbers.has(no));
      if (duplicateInDb) {
        showError(`Nomor SPJ sudah Ada di database: ${duplicateInDb.toUpperCase()}`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const finalData = { 
        ...values, 
        region_id: selectedRegionId,
        team_id: selectedTeamId,
        price_pertamax: values.price_pertamax, 
        price_dexlite: values.price_dexlite,
        entries: values.entries.map(entry => ({
          ...entry,
          locations: entry.locations.map(loc => ({
            ...loc,
            fuel_type: loc.fuel_type as FuelType,
            subDistrict: loc.subDistrict === " " ? "" : loc.subDistrict,
            village: loc.village === " " ? "" : loc.village
          }))
        }))
      };

      if (isEditing && initialData) {
        await fuelSpjService.updateReport(initialData.id, finalData);
        showSuccess("Laporan SPJ diperbarui");
      } else {
        await fuelSpjService.createReport(finalData);
        showSuccess("Laporan SPJ disimpan");
      }
      navigate('/fuel-reports/spj');
    } catch (error: any) {
      showError("Gagal simpan: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-5xl mx-auto pb-20">
        {/* DataLists for Autocomplete */}
        <datalist id="spj-vehicle-list">{Array.from(history.vehicles).map(v => <option key={v} value={v} />)}</datalist>
        <datalist id="spj-receiver-list">{Array.from(history.receivers).map(r => <option key={r} value={r} />)}</datalist>
        <datalist id="spj-street-list">{Array.from(history.streets).map(s => <option key={s} value={s} />)}</datalist>

        <div className="flex items-center justify-between mb-6">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" /> Kembali</Button>
          <h1 className="text-2xl font-bold text-blue-700">{isEditing ? "Edit SPJ BBM" : "Input SPJ BBM Baru"}</h1>
          <Button type="submit" disabled={isSubmitting} className="bg-blue-600">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Simpan
          </Button>
        </div>

        <Card className="border-t-4 border-t-blue-600">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Info className="h-5 w-5 text-blue-500" /> Informasi Dasar</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem><FormLabel>Tanggal</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="region" render={({ field }) => (
                <FormItem><FormLabel>Wilayah</FormLabel>
                  {isSpjBbmAdmin && !isEditing ? (
                    <FormControl><Input {...field} readOnly className="bg-slate-100 text-slate-600" /></FormControl>
                  ) : (
                    <Select onValueChange={(val) => { field.onChange(val); form.setValue("team", ""); }} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Pilih Wilayah" /></SelectTrigger></FormControl>
                      <SelectContent>{regions.map(region => <SelectItem key={region.id} value={region.name}>{region.name}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </FormItem>
              )} />

              <FormField control={form.control} name="team" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2"><Users size={14} /> Tim / Operator</FormLabel>
                  {isSpjBbmAdmin && !isEditing ? (
                    <FormControl><Input {...field} readOnly className="bg-slate-100 text-slate-600" /></FormControl>
                  ) : (
                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedRegion}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Pilih Tim" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {availableTeamNames.map(teamName => <SelectItem key={teamName} value={teamName}>{teamName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              )} />
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
                        type="number" 
                        className={cn("font-bold", !canEditPrice && "bg-slate-100 cursor-not-allowed")} 
                        {...field} 
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
                        type="number" 
                        className={cn("font-bold", !canEditPrice && "bg-slate-100 cursor-not-allowed")} 
                        {...field} 
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

        <div className="space-y-6">
          {entryFields.map((entry, index) => (
            <Card key={entry.id} className="border-l-4 border-l-blue-500 shadow-md">
              <CardHeader className="bg-slate-50/50 py-3 flex flex-row items-center justify-between">
                <Badge className="bg-blue-600">Kendaraan #{index + 1}</Badge>
                {entryFields.length > 1 && <Button type="button" variant="ghost" size="icon" className="text-red-500" onClick={() => removeEntry(index)}><Trash2 size={18} /></Button>}
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name={`entries.${index}.spj_no`} render={({ field }) => (
                    <FormItem><FormLabel className="text-red-600 font-bold">No. SPJ (Wajib)</FormLabel><FormControl><Input placeholder="Contoh: 001/SPJ/..." {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name={`entries.${index}.vehicle_operator`} render={({ field }) => (
                    <FormItem><FormLabel>Kendaraan / Alat</FormLabel><FormControl><Input placeholder="Nama Alat (Plat)" list="spj-vehicle-list" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name={`entries.${index}.receiver_name`} render={({ field }) => (
                    <FormItem><FormLabel>Penerima / Operator</FormLabel><FormControl><Input placeholder="Nama Personil" list="spj-receiver-list" {...field} /></FormControl></FormItem>
                  )} />
                </div>

                <div className="pt-4 border-t space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2"><MapPin size={14} className="text-red-500" /> Lokasi Kerja & Pemakaian BBM</h4>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => {
                      const current = form.getValues(`entries.${index}.locations`);
                      form.setValue(`entries.${index}.locations`, [...current, { street: "", subDistrict: "", village: "", fuel_type: "Pertamax", amount_rp: 0, amount_liter: 0, remarks: "" }]);
                    }}><Plus size={12} className="mr-1" /> Tambah Lokasi</Button>
                  </div>

                  {form.watch(`entries.${index}.locations`)?.map((_, locIdx) => (
                    <div key={locIdx} className="p-4 bg-slate-50 rounded-lg border space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        <div className="md:col-span-8">
                          <FormField control={form.control} name={`entries.${index}.locations.${locIdx}.street`} render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] uppercase">Nama Jalan</FormLabel><FormControl><Input className="h-8 text-xs" {...field} list="spj-street-list" /></FormControl></FormItem>
                          )} />
                        </div>
                        <div className="md:col-span-2">
                          <FormField control={form.control} name={`entries.${index}.locations.${locIdx}.subDistrict`} render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] uppercase">Kecamatan</FormLabel>
                              <Select onValueChange={(v) => { field.onChange(v); form.setValue(`entries.${index}.locations.${locIdx}.village`, ""); }} value={field.value}>
                                <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pilih..." /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value=" ">Abaikan</SelectItem>
                                  {Object.keys(medanDistricts).map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                        </div>
                        <div className="md:col-span-2">
                          <FormField control={form.control} name={`entries.${index}.locations.${locIdx}.village`} render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] uppercase">Kelurahan</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value} disabled={!form.watch(`entries.${index}.locations.${locIdx}.subDistrict`) || form.watch(`entries.${index}.locations.${locIdx}.subDistrict`) === " "}>
                                <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pilih..." /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value=" ">Abaikan</SelectItem>
                                  {form.watch(`entries.${index}.locations.${locIdx}.subDistrict`) && form.watch(`entries.${index}.locations.${locIdx}.subDistrict`) !== " " && medanDistricts[form.watch(`entries.${index}.locations.${locIdx}.subDistrict`)!]?.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        <div className="md:col-span-2">
                          <FormField control={form.control} name={`entries.${index}.locations.${locIdx}.fuel_type`} render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] uppercase">Jenis</FormLabel>
                              <Select onValueChange={(v) => { field.onChange(v); calculateLiter(index, locIdx, form.getValues(`entries.${index}.locations.${locIdx}.amount_rp`), v); }} value={field.value}>
                                <FormControl><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent><SelectItem value="Pertamax">Pertamax</SelectItem><SelectItem value="Dexlite">Dexlite</SelectItem><SelectItem value="Oli">Oli</SelectItem></SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                        </div>
                        <div className="md:col-span-3">
                          <FormField control={form.control} name={`entries.${index}.locations.${locIdx}.amount_rp`} render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] uppercase">Rupiah (Rp)</FormLabel>
                              <FormControl><Input type="number" className="h-9 text-xs" {...field} onChange={(e) => { field.onChange(e); calculateLiter(index, locIdx, Number(e.target.value), form.getValues(`entries.${index}.locations.${locIdx}.fuel_type`)); }} /></FormControl>
                            </FormItem>
                          )} />
                        </div>
                        <div className="md:col-span-1">
                          <FormField control={form.control} name={`entries.${index}.locations.${locIdx}.amount_liter`} render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] uppercase flex items-center gap-1">Ltr <Calculator size={10} className="text-blue-500" /></FormLabel>
                              <FormControl><Input type="number" step="0.01" className="h-9 text-xs bg-blue-50 font-bold px-1 text-center" {...field} readOnly={form.watch(`entries.${index}.locations.${locIdx}.fuel_type`) !== 'Oli'} /></FormControl>
                            </FormItem>
                          )} />
                        </div>
                        <div className="md:col-span-5">
                          <FormField control={form.control} name={`entries.${index}.locations.${locIdx}.remarks`} render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] uppercase">Keterangan</FormLabel><FormControl><Input className="h-9 text-xs" {...field} /></FormControl></FormItem>
                          )} />
                        </div>
                        <div className="md:col-span-1 flex justify-end">
                          {form.watch(`entries.${index}.locations`).length > 1 && (
                            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-400" onClick={() => {
                              const current = form.getValues(`entries.${index}.locations`);
                              form.setValue(`entries.${index}.locations`, current.filter((_, i) => i !== locIdx));
                            }}><Trash2 size={14} /></Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          <Button type="button" variant="outline" className="w-full border-dashed py-8 text-blue-600 font-bold bg-white hover:bg-blue-50" onClick={() => appendEntry({ spj_no: "", vehicle_operator: "", receiver_name: "", locations: [{ street: "", subDistrict: "", village: "", fuel_type: "Pertamax", amount_rp: 0, amount_liter: 0, remarks: "" }] })}>
            <Plus className="mr-2 h-5 w-5" /> Tambah Kendaraan / SPJ Baru
          </Button>
        </div>

        <Card>
          <CardHeader className="py-3"><CardTitle className="text-sm flex items-center gap-2"><FileText size={16} className="text-slate-400" /> Catatan Umum Laporan</CardTitle></CardHeader>
          <CardContent><FormField control={form.control} name="remarks" render={({ field }) => (<FormItem><FormControl><Input placeholder="Ketik catatan tambahan..." {...field} /></FormControl></FormItem>)} /></CardContent>
        </Card>
      </form>
    </Form>
  );
};

export default FuelSpjReportForm;
