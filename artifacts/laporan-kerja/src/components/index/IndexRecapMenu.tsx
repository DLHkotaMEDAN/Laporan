import { CalendarDays, ChevronDown, FileText, Printer, Table } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  activeTab: string;
  canPrintAnyReportRecap: boolean;
  canPrintDailyRecap: boolean;
  canPrintWeeklyRecap: boolean;
  canPrintMonthlyRecap: boolean;
  canFilterWorkPlanRegions: boolean;
  isAdmin: boolean;
  selectedRegion: string;
  onNavigate: (path: string) => void;
  onOpenDailyReportRecap: () => void;
};

export function IndexRecapMenu({
  activeTab,
  canPrintAnyReportRecap,
  canPrintDailyRecap,
  canPrintWeeklyRecap,
  canPrintMonthlyRecap,
  canFilterWorkPlanRegions,
  isAdmin,
  selectedRegion,
  onNavigate,
  onOpenDailyReportRecap,
}: Props) {
  if (activeTab === "reports" && !canPrintAnyReportRecap) return null;

  return (
    <div className="flex w-full items-center justify-end border-t border-slate-200/80 pt-3 xl:w-auto xl:shrink-0 xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button aria-label="Cetak rekap" title="Cetak rekap" variant="outline" size="sm" className="h-10 w-10 justify-center rounded-xl border-slate-200 bg-white p-0 text-slate-700 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md sm:w-auto sm:px-4">
            <Printer className="h-4 w-4 text-blue-600 sm:mr-2" /> <span className="hidden sm:inline">Cetak Rekap</span> <ChevronDown className="hidden h-3 w-3 opacity-50 sm:ml-2 sm:inline" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {activeTab === "reports" && (
            <>
              {isAdmin && <DropdownMenuItem onClick={() => onNavigate("/print-rekap?category=semua")} className="py-3 cursor-pointer"><Printer className="mr-3 h-4 w-4 text-blue-600" /> Cetak Harian Laporan</DropdownMenuItem>}
              {canPrintDailyRecap && <DropdownMenuItem onSelect={onOpenDailyReportRecap} className="py-3 cursor-pointer"><Table className="mr-3 h-4 w-4 text-green-600" /> Rekap Harian Laporan</DropdownMenuItem>}
              {canPrintWeeklyRecap && <DropdownMenuItem onClick={() => onNavigate(`/weekly-rekap?categories=semua&date=${new Date().toISOString().split("T")[0]}`)} className="py-3 cursor-pointer"><CalendarDays className="mr-3 h-4 w-4 text-purple-600" /> Rekap Mingguan Laporan</DropdownMenuItem>}
              {canPrintMonthlyRecap && <DropdownMenuItem onClick={() => onNavigate("/monthly-rekap")} className="py-3 cursor-pointer"><FileText className="mr-3 h-4 w-4 text-orange-600" /> Rekap Bulanan Laporan</DropdownMenuItem>}
            </>
          )}
          {activeTab === "workplans" && (
            <>
              <DropdownMenuItem onClick={() => onNavigate(`/work-plans/daily-rekap${canFilterWorkPlanRegions && selectedRegion !== "semua" ? `?region=${selectedRegion}` : ""}`)} className="py-3 cursor-pointer"><Printer className="mr-3 h-4 w-4 text-blue-600" /> Rekap Harian Rencana</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onNavigate(`/work-plans/weekly-rekap${canFilterWorkPlanRegions && selectedRegion !== "semua" ? `?region=${selectedRegion}` : ""}`)} className="py-3 cursor-pointer"><Table className="mr-3 h-4 w-4 text-green-600" /> Rekap Mingguan Rencana</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onNavigate(`/work-plans/monthly-rekap${canFilterWorkPlanRegions && selectedRegion !== "semua" ? `?region=${selectedRegion}` : ""}`)} className="py-3 cursor-pointer"><FileText className="mr-3 h-4 w-4 text-purple-600" /> Rekap Bulanan Rencana</DropdownMenuItem>
            </>
          )}
          {activeTab === "overtime" && (
            <>
              <DropdownMenuItem onClick={() => onNavigate("/overtime/daily-rekap")} className="py-3 cursor-pointer"><CalendarDays className="mr-3 h-4 w-4 text-blue-600" /> Rekap Harian Lembur</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onNavigate("/overtime/weekly-rekap")} className="py-3 cursor-pointer"><Table className="mr-3 h-4 w-4 text-green-600" /> Rekap Mingguan Lembur</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onNavigate("/overtime/monthly-rekap")} className="py-3 cursor-pointer"><FileText className="mr-3 h-4 w-4 text-orange-600" /> Rekap Bulanan Lembur</DropdownMenuItem>
            </>
          )}
          {(activeTab === "fuel_reports" || activeTab === "fuel_reports_pusat" || activeTab === "laporan_bbm") && (
            <FuelRecapItems activeTab={activeTab} onNavigate={onNavigate} />
          )}
          {activeTab === "spj_oli" && (
            <>
              <DropdownMenuItem onClick={() => onNavigate("/spj-oli/daily-rekap")} className="py-3 cursor-pointer"><CalendarDays className="mr-3 h-4 w-4 text-blue-600" /> Rekap Harian SPJ Oli</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onNavigate("/spj-oli/weekly-rekap")} className="py-3 cursor-pointer"><Table className="mr-3 h-4 w-4 text-green-600" /> Rekap Mingguan SPJ Oli</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onNavigate("/spj-oli/monthly-rekap")} className="py-3 cursor-pointer"><FileText className="mr-3 h-4 w-4 text-orange-600" /> Rekap Bulanan SPJ Oli</DropdownMenuItem>
            </>
          )}
          {activeTab === "nota_dinas" && (
            <>
              <DropdownMenuItem onClick={() => onNavigate("/nota-dinas/daily-rekap")} className="py-3 cursor-pointer"><CalendarDays className="mr-3 h-4 w-4 text-blue-600" /> Rekap Harian Nota Dinas</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onNavigate("/nota-dinas/weekly-rekap")} className="py-3 cursor-pointer"><Table className="mr-3 h-4 w-4 text-green-600" /> Rekap Mingguan Nota Dinas</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onNavigate("/nota-dinas/monthly-rekap")} className="py-3 cursor-pointer"><FileText className="mr-3 h-4 w-4 text-orange-600" /> Rekap Bulanan Nota Dinas</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function FuelRecapItems({ activeTab, onNavigate }: Pick<Props, "activeTab" | "onNavigate">) {
  const reportType = activeTab === "fuel_reports_pusat"
    ? "admin_bbm_pusat"
    : activeTab === "laporan_bbm"
      ? "laporan_bbm"
      : undefined;
  const basePath = "/fuel-reports";
  const query = reportType ? `?reportType=${reportType}` : "";

  return (
    <>
      <DropdownMenuItem onClick={() => onNavigate(`${basePath}/daily-rekap${query}`)} className="py-3 cursor-pointer"><CalendarDays className="mr-3 h-4 w-4 text-blue-600" /> Rekap Harian {activeTab === "fuel_reports" ? "BBM" : activeTab === "fuel_reports_pusat" ? "Admin BBM Pusat" : "Laporan BBM"}</DropdownMenuItem>
      <DropdownMenuItem onClick={() => onNavigate(`${basePath}/weekly-rekap${query}`)} className="py-3 cursor-pointer"><Table className="mr-3 h-4 w-4 text-green-600" /> Rekap Mingguan {activeTab === "fuel_reports" ? "BBM" : activeTab === "fuel_reports_pusat" ? "Admin BBM Pusat" : "Laporan BBM"}</DropdownMenuItem>
      <DropdownMenuItem onClick={() => onNavigate(`${basePath}/monthly-rekap${query}`)} className="py-3 cursor-pointer"><FileText className="mr-3 h-4 w-4 text-orange-600" /> Rekap Bulanan {activeTab === "fuel_reports" ? "BBM" : activeTab === "fuel_reports_pusat" ? "Admin BBM Pusat" : "Laporan BBM"}</DropdownMenuItem>
      <DropdownMenuItem onClick={() => onNavigate(`${basePath}/yearly-rekap${query}`)} className="py-3 cursor-pointer"><CalendarDays className="mr-3 h-4 w-4 text-red-600" /> Rekap Tahunan {activeTab === "fuel_reports" ? "BBM" : activeTab === "fuel_reports_pusat" ? "Admin BBM Pusat" : "Laporan BBM"}</DropdownMenuItem>
    </>
  );
}
