import type { Dispatch, SetStateAction } from "react";
import { CalendarDays, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import TrashDialog from "@/components/TrashDialog";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import type { MainTab } from "@/components/index/indexConfig";

export type IndexConfirmDialogState = {
  open: boolean;
  title: string;
  description: string;
  variant: "danger" | "warning" | "logout";
  confirmLabel: string;
  loading: boolean;
  onConfirm: () => Promise<void>;
};

type Props = {
  isTrashOpen: boolean;
  onTrashOpenChange: (open: boolean) => void;
  onRefresh: () => Promise<void>;
  activeTab: MainTab;
  isChangePasswordOpen: boolean;
  onPasswordChangeOpen: (open: boolean) => void;
  confirmDialog: IndexConfirmDialogState;
  setConfirmDialog: Dispatch<SetStateAction<IndexConfirmDialogState>>;
  isDailyRecapDateOpen: boolean;
  onDailyRecapOpenChange: (open: boolean) => void;
  dailyRecapDate: string;
  onDailyRecapDateChange: (date: string) => void;
  onNavigate: (path: string) => void;
};

export function IndexDialogs({
  isTrashOpen,
  onTrashOpenChange,
  onRefresh,
  activeTab,
  isChangePasswordOpen,
  onPasswordChangeOpen,
  confirmDialog,
  setConfirmDialog,
  isDailyRecapDateOpen,
  onDailyRecapOpenChange,
  dailyRecapDate,
  onDailyRecapDateChange,
  onNavigate,
}: Props) {
  return (
    <>
      <TrashDialog
        isOpen={isTrashOpen}
        onClose={() => onTrashOpenChange(false)}
        onRefresh={onRefresh}
        fuelReportType={activeTab === "fuel_reports_pusat" ? "admin_bbm_pusat" : activeTab === "laporan_bbm" ? "laporan_bbm" : "admin_bbm"}
      />
      <ChangePasswordDialog open={isChangePasswordOpen} onOpenChange={onPasswordChangeOpen} />
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((previous) => ({ ...previous, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        confirmLabel={confirmDialog.confirmLabel}
        loading={confirmDialog.loading}
        onConfirm={confirmDialog.onConfirm}
      />
      <Dialog open={isDailyRecapDateOpen} onOpenChange={onDailyRecapOpenChange}>
        <DialogContent className="rounded-2xl p-5 sm:max-w-[460px] sm:p-6">
          <DialogHeader className="pr-8">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
              <CalendarDays className="h-5 w-5 text-green-600" /> Pilih Tanggal Rekap Harian
            </DialogTitle>
            <DialogDescription className="text-base leading-relaxed">Tentukan tanggal laporan yang ingin ditampilkan dan dicetak.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-3 sm:py-4">
            <label htmlFor="daily-recap-date" className="text-base font-semibold text-slate-700">Tanggal Laporan</label>
            <Input id="daily-recap-date" type="date" value={dailyRecapDate} onChange={(event) => onDailyRecapDateChange(event.target.value)} className="h-12 rounded-xl text-base" />
          </div>
          <DialogFooter className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3 sm:[&>[data-slot=button]]:w-full">
            <Button type="button" variant="outline" className="h-11 w-full rounded-xl" onClick={() => onDailyRecapOpenChange(false)}>Batal</Button>
            <Button
              type="button"
              disabled={!dailyRecapDate}
              className="h-11 w-full rounded-xl bg-green-600 font-bold shadow-sm hover:bg-green-700"
              onClick={() => {
                onDailyRecapOpenChange(false);
                onNavigate(`/daily-rekap?categories=semua&date=${dailyRecapDate}`);
              }}
            >
              <Printer className="mr-2 h-4 w-4" /> Buka Rekap Harian
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
