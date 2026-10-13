import ConfirmDialog from "@/components/ConfirmDialog";
import type { NotaDinasRecord } from "@/types/notaDinas";

type NotaDinasDeleteConfirmDialogProps = {
  open: boolean;
  record: NotaDinasRecord | null;
  onOpenChange: (open: boolean) => void;
  getNumberLabel: (record: NotaDinasRecord) => string;
  onConfirm: () => Promise<void>;
};

export const NotaDinasDeleteConfirmDialog = ({
  open,
  record,
  onOpenChange,
  getNumberLabel,
  onConfirm,
}: NotaDinasDeleteConfirmDialogProps) => (
  <ConfirmDialog
    open={open}
    onOpenChange={onOpenChange}
    title="Hapus Nota Dinas"
    description={`${record ? (getNumberLabel(record) || record.form.hal || "Nota Dinas ini") : "Nota Dinas ini"} akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`}
    variant="danger"
    confirmLabel="Ya, Hapus"
    onConfirm={onConfirm}
  />
);
