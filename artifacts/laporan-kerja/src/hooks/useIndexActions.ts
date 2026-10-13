import type { Dispatch, MouseEvent, SetStateAction } from "react";
import { reportService } from "@/services/reportService";
import { workPlanService } from "@/services/workPlanService";
import { showError, showSuccess } from "@/utils/toast";
import type { IndexConfirmDialogState } from "@/components/index/IndexDialogs";
import type { Report } from "@/types/report";
import type { WorkPlan } from "@/types/workPlan";

type Options = {
  canManageReports: boolean;
  canManageWorkPlans: boolean;
  reports: Report[];
  workPlans: WorkPlan[];
  setReports: Dispatch<SetStateAction<Report[]>>;
  setWorkPlans: Dispatch<SetStateAction<WorkPlan[]>>;
  setConfirmDialog: Dispatch<SetStateAction<IndexConfirmDialogState>>;
  signOut: () => Promise<void>;
};

export function useIndexActions({
  canManageReports,
  canManageWorkPlans,
  reports,
  workPlans,
  setReports,
  setWorkPlans,
  setConfirmDialog,
  signOut,
}: Options) {
  const handleLogout = () => {
    setConfirmDialog({
      open: true,
      title: "Keluar dari Sistem",
      description: "Anda akan keluar dari sistem. Pastikan semua data sudah tersimpan sebelum keluar.",
      variant: "logout",
      confirmLabel: "Ya, Keluar",
      loading: false,
      onConfirm: async () => {
        try {
          await signOut();
          showSuccess("Berhasil keluar");
        } catch (error) {
          showError("Gagal keluar");
        }
      },
    });
  };

  const handleDeleteReport = (event: MouseEvent, report: Report) => {
    event.stopPropagation();
    if (!canManageReports) return;
    setConfirmDialog({
      open: true,
      title: "Pindahkan ke Tempat Sampah",
      description: `Laporan "${report.description}" akan dipindahkan ke tempat sampah. Anda dapat memulihkannya nanti.`,
      variant: "warning",
      confirmLabel: "Pindahkan",
      loading: false,
      onConfirm: async () => {
        try {
          await reportService.deleteReport(report.id);
          setReports(reports.filter((item) => item.id !== report.id));
          showSuccess("Laporan dipindahkan ke tempat sampah");
          setConfirmDialog((previous) => ({ ...previous, open: false }));
        } catch (error) {
          showError("Gagal menghapus");
        }
      },
    });
  };

  const handleToggleWorkPlanVisibility = async (event: MouseEvent, plan: WorkPlan) => {
    event.stopPropagation();
    if (!canManageWorkPlans) return;

    const newVisibility = plan.is_visible === false;
    try {
      await workPlanService.updateWorkPlan(plan.id, { is_visible: newVisibility });
      setWorkPlans((current) => current.map((item) => item.id === plan.id ? { ...item, is_visible: newVisibility } : item));
      showSuccess(newVisibility ? "Rencana akan muncul di rekap" : "Rencana disembunyikan dari rekap");
    } catch (error) {
      showError("Gagal mengubah status visibilitas");
    }
  };

  const handleDeleteWorkPlan = (event: MouseEvent, plan: WorkPlan) => {
    event.stopPropagation();
    if (!canManageWorkPlans) return;
    setConfirmDialog({
      open: true,
      title: "Pindahkan ke Tempat Sampah",
      description: `Rencana kerja "${plan.items[0]?.description}" akan dipindahkan ke tempat sampah. Anda dapat memulihkannya nanti.`,
      variant: "warning",
      confirmLabel: "Pindahkan",
      loading: false,
      onConfirm: async () => {
        try {
          await workPlanService.deleteWorkPlan(plan.id);
          setWorkPlans(workPlans.filter((item) => item.id !== plan.id));
          showSuccess("Rencana kerja dipindahkan ke tempat sampah");
          setConfirmDialog((previous) => ({ ...previous, open: false }));
        } catch (error) {
          showError("Gagal menghapus data");
        }
      },
    });
  };

  return { handleLogout, handleDeleteReport, handleToggleWorkPlanVisibility, handleDeleteWorkPlan };
}
