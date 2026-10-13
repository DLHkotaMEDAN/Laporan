import { CalendarDays, FilterX, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { RegionOption } from "@/hooks/useRegionFilterOptions";
import { cn } from "@/lib/utils";

const months = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

type Props = {
  visible: boolean;
  searchQuery: string;
  selectedRegion: string;
  selectedCategory: string;
  selectedDate: string;
  selectedMonth: string;
  categories: string[];
  regions: RegionOption[];
  canFilterWorkPlanRegions: boolean;
  isUserRestricted: boolean;
  onSearchChange: (value: string) => void;
  onRegionChange: (regionId: string) => void;
  onCategoryChange: (category: string) => void;
  onDateChange: (date: string) => void;
  onMonthChange: (month: string) => void;
  onReset: () => void;
};

export function IndexFilters({
  visible,
  searchQuery,
  selectedRegion,
  selectedCategory,
  selectedDate,
  selectedMonth,
  categories,
  regions,
  canFilterWorkPlanRegions,
  isUserRestricted,
  onSearchChange,
  onRegionChange,
  onCategoryChange,
  onDateChange,
  onMonthChange,
  onReset,
}: Props) {
  if (!visible) return null;

  return (
    <div className="min-w-0 rounded-2xl border bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:p-5">
      <div className="grid min-w-0 grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-12">
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
          <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Pencarian Cepat</label>
          <div className="relative min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Cari uraian kegiatan atau lokasi..."
              className="pl-10 bg-slate-50 border-slate-200 h-11 rounded-xl focus-visible:ring-blue-500"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>
        </div>
        {canFilterWorkPlanRegions && (
          <div className="space-y-1.5 lg:col-span-2">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Wilayah</label>
            <Select value={selectedRegion} onValueChange={onRegionChange}>
              <SelectTrigger className="bg-slate-50 border-slate-200 h-11 rounded-xl font-medium">
                <SelectValue placeholder="Pilih Wilayah" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua Wilayah</SelectItem>
                {regions.map((region) => <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5 lg:col-span-3">
          <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Kategori Tim</label>
          <Select value={selectedCategory} onValueChange={onCategoryChange} disabled={isUserRestricted}>
            <SelectTrigger className="bg-slate-50 border-slate-200 h-11 rounded-xl font-medium">
              <SelectValue placeholder="Pilih Kategori" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => <SelectItem key={category} value={category} className="font-medium">{category === "semua" ? "Semua Kategori" : category}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 lg:col-span-2">
          <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Tanggal</label>
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input type="date" className="pl-10 bg-slate-50 border-slate-200 h-11 rounded-xl" value={selectedDate} onChange={(event) => onDateChange(event.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5 lg:col-span-2">
          <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Bulan</label>
          <Select value={selectedMonth} onValueChange={onMonthChange} disabled={!!selectedDate}>
            <SelectTrigger className={cn("bg-slate-50 border-slate-200 h-11 rounded-xl font-medium", selectedDate && "opacity-50")}>
              <SelectValue placeholder="Pilih Bulan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua Bulan</SelectItem>
              {months.map((month, index) => <SelectItem key={index + 1} value={(index + 1).toString()}>{month}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end sm:col-span-2 lg:col-span-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button aria-label="Reset filter" title="Reset filter" variant="ghost" size="icon" onClick={onReset} className="h-10 w-10 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-xl border border-dashed border-slate-200 sm:h-11 sm:w-11">
                  <FilterX className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Reset Filter</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
