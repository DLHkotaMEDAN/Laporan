import DashboardStats from "@/components/dashboard/DashboardStats";
import { IndexOverview } from "@/components/index/IndexOverview";

type IndexSummaryStats = {
  totalReports: number;
  totalWorkPlans: number;
  reportsToday: number;
  plansToday: number;
};

type IndexSummarySectionProps = {
  isExecutive: boolean;
  loginScopeLabel: string;
  username?: string | null;
  stats: IndexSummaryStats;
  logoMedanUrl: string;
  logoDlhUrl: string;
  heroImageUrl: string;
};

export const IndexSummarySection = ({
  isExecutive,
  loginScopeLabel,
  username,
  stats,
  logoMedanUrl,
  logoDlhUrl,
  heroImageUrl,
}: IndexSummarySectionProps) => (
  <>
    <IndexOverview
      isExecutive={isExecutive}
      loginScopeLabel={loginScopeLabel}
      stats={stats}
      logoMedanUrl={logoMedanUrl}
      logoDlhUrl={logoDlhUrl}
      heroImageUrl={heroImageUrl}
    />
    <div className="sr-only">
      <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
        Halo, {username || "Selamat Datang"}! 👋
      </h2>
      <p className="text-slate-500 text-sm md:text-base mt-1 font-medium">
        Pantau dan kelola laporan kegiatan harian Dinas Lingkungan Hidup dengan mudah.
      </p>
    </div>
    {isExecutive && <DashboardStats {...stats} />}
  </>
);
