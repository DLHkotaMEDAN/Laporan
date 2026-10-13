import { Activity, Clock3, Leaf, MapPin, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type OverviewStats = {
  totalReports: number;
  totalWorkPlans: number;
  reportsToday: number;
  plansToday: number;
};

type IndexOverviewProps = {
  isExecutive: boolean;
  loginScopeLabel: string;
  stats: OverviewStats;
  logoMedanUrl: string;
  logoDlhUrl: string;
  heroImageUrl: string;
};

export function IndexOverview({
  isExecutive,
  loginScopeLabel,
  stats,
  logoMedanUrl,
  logoDlhUrl,
  heroImageUrl,
}: IndexOverviewProps) {
  if (!isExecutive) {
    return (
      <section className="mb-8 rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-2 ring-1 ring-emerald-100">
              <img src={logoMedanUrl} alt="Logo Kota Medan" className="h-11 w-11 object-contain" />
              <img src={logoDlhUrl} alt="Logo DLH Kota Medan" className="h-11 w-11 object-contain" />
            </div>
            <div>
              <Badge variant="outline" className="mb-2 bg-emerald-50 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                {loginScopeLabel}
              </Badge>
              <h2 className="text-xl font-black tracking-tight text-slate-950 md:text-2xl">Sistem Laporan</h2>
              <p className="mt-1 text-sm font-semibold text-slate-600">Dinas Lingkungan Hidup Kota Medan</p>
            </div>
          </div>
          <Badge variant="outline" className="w-fit bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
            Berdasarkan Login
          </Badge>
        </div>
      </section>
    );
  }

  return (
    <section className="relative mb-8 overflow-hidden rounded-[28px] bg-slate-950 text-white shadow-2xl shadow-emerald-950/20">
      <img
        src={heroImageUrl}
        alt="Pemerintah Kota Medan Dinas Lingkungan Hidup"
        className="absolute inset-0 h-full w-full object-cover opacity-55"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-emerald-950/35" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950/70 to-transparent" />
      <div className="relative grid gap-8 p-6 md:grid-cols-[1.35fr_0.65fr] md:p-8 lg:p-10">
        <div className="flex min-h-[320px] flex-col justify-between gap-8">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="border border-white/20 bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-white backdrop-blur">
              <Leaf className="mr-2 h-3.5 w-3.5" /> Pemerintah Kota Medan
            </Badge>
            <Badge className="border border-emerald-300/30 bg-emerald-400/20 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-emerald-50 backdrop-blur">
              <ShieldCheck className="mr-2 h-3.5 w-3.5" /> Wilayah Operasional
            </Badge>
          </div>

          <div className="max-w-3xl">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-2xl bg-white/95 p-2 shadow-xl shadow-black/20">
                <img src={logoMedanUrl} alt="Logo Kota Medan" className="h-12 w-12 object-contain" />
                <img src={logoDlhUrl} alt="Logo Dinas Lingkungan Hidup Kota Medan" className="h-12 w-12 object-contain" />
              </div>
              <div className="hidden h-12 w-px bg-white/30 sm:block" />
              <div className="hidden text-sm font-semibold leading-tight text-white/80 sm:block">
                Sistem pelaporan dan rekap kegiatan lapangan
              </div>
            </div>
            <h2 className="text-3xl font-black leading-tight tracking-tight md:text-5xl">
              Dinas Lingkungan Hidup Kota Medan
            </h2>
            <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-slate-100 md:text-base">
              Portal kerja internal untuk laporan harian, rencana kerja, rekap operasional, BBM, dan SPJ BBM dengan tampilan data yang cepat dibaca.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/15 bg-white/12 p-4 backdrop-blur">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100">Laporan</p>
              <p className="mt-1 text-2xl font-black">{stats.totalReports}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/12 p-4 backdrop-blur">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100">Rencana Kerja</p>
              <p className="mt-1 text-2xl font-black">{stats.totalWorkPlans}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/12 p-4 backdrop-blur">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100">Hari Ini</p>
              <p className="mt-1 text-2xl font-black">{stats.reportsToday + stats.plansToday}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-4 rounded-3xl border border-white/15 bg-white/14 p-5 backdrop-blur-xl">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-emerald-100">Status Sistem</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-2xl bg-white/12 p-3">
                <span className="flex items-center gap-2 text-sm font-bold"><Activity className="h-4 w-4 text-emerald-200" /> Sinkronisasi</span>
                <Badge className="bg-emerald-400 text-emerald-950">Aktif</Badge>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-white/12 p-3">
                <span className="flex items-center gap-2 text-sm font-bold"><Clock3 className="h-4 w-4 text-amber-200" /> Data Hari Ini</span>
                <span className="text-sm font-black">{stats.reportsToday + stats.plansToday}</span>
              </div>
              <div className="flex items-start gap-3 rounded-2xl bg-white/12 p-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky-200" />
                <p className="text-xs font-medium leading-5 text-white/85">
                  Jl. Pinang Baris No. 114 Medan Sunggal, Medan, Sumatera Utara - 20127
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
