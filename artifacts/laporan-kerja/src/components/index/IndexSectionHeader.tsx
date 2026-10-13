import type { ElementType } from "react";
import { ClipboardList, Clock3, FileText, Fuel } from "lucide-react";
import { TabPageHeader } from "@/components/index/IndexShared";

type SectionHeaderConfig = {
  title: string;
  description: string;
  actionLabel: string;
  path: string;
  icon: ElementType;
  actionClassName: string;
  iconClassName: string;
  showAction?: boolean;
};

const sectionHeaders: Record<string, SectionHeaderConfig> = {
  reports: {
    title: "Laporan Harian",
    description: "Pencatatan realisasi pekerjaan lapangan.",
    actionLabel: "Input Laporan",
    path: "/create",
    icon: FileText,
    actionClassName: "bg-blue-600 hover:bg-blue-700",
    iconClassName: "bg-blue-50 text-blue-600",
  },
  workplans: {
    title: "Rencana Kerja",
    description: "Penyusunan agenda kerja tim dan lokasi.",
    actionLabel: "Input Rencana Kerja",
    path: "/work-plans/create",
    icon: ClipboardList,
    actionClassName: "bg-emerald-600 hover:bg-emerald-700",
    iconClassName: "bg-emerald-50 text-emerald-600",
  },
  overtime: {
    title: "Rekap Lembur",
    description: "Pencatatan kehadiran dan aktivitas lembur.",
    actionLabel: "Input Rekap Lembur",
    path: "/overtime/create",
    icon: Clock3,
    actionClassName: "bg-amber-600 hover:bg-amber-700",
    iconClassName: "bg-amber-50 text-amber-600",
  },
  fuel_reports: {
    title: "Admin BBM",
    description: "Pencatatan penggunaan bahan bakar minyak.",
    actionLabel: "Input BBM",
    path: "/fuel-reports/create",
    icon: Fuel,
    actionClassName: "bg-orange-600 hover:bg-orange-700",
    iconClassName: "bg-orange-50 text-orange-600",
  },
  fuel_reports_pusat: {
    title: "Admin BBM Pusat",
    description: "Pencatatan penggunaan BBM dan Oli untuk administrasi BBM Pusat.",
    actionLabel: "Input BBM Pusat",
    path: "/fuel-reports-pusat/create",
    icon: Fuel,
    actionClassName: "bg-cyan-600 hover:bg-cyan-700",
    iconClassName: "bg-cyan-50 text-cyan-600",
  },
  laporan_bbm: {
    title: "Laporan BBM",
    description: "Pencatatan BBM per wilayah dengan No. SPJ dan No. Polisi kendaraan atau alat.",
    actionLabel: "Input Laporan BBM",
    path: "/laporan-bbm/create",
    icon: Fuel,
    actionClassName: "bg-amber-700 hover:bg-amber-800",
    iconClassName: "bg-amber-50 text-amber-700",
  },
};

export function IndexSectionHeader({
  activeTab,
  canManageReports,
  canManageWorkPlans,
  onNavigate,
}: {
  activeTab: string;
  canManageReports: boolean;
  canManageWorkPlans: boolean;
  onNavigate: (path: string) => void;
}) {
  const config = sectionHeaders[activeTab];
  if (!config) return null;

  const showAction = activeTab === "reports"
    ? canManageReports
    : activeTab === "workplans"
      ? canManageWorkPlans
      : true;

  return (
    <TabPageHeader
      title={config.title}
      description={config.description}
      actionLabel={config.actionLabel}
      onAction={() => onNavigate(config.path)}
      showAction={showAction}
      actionIcon={config.icon}
      actionClassName={config.actionClassName}
      iconClassName={config.iconClassName}
    />
  );
}
