import type { Dispatch, SetStateAction } from "react";
import { showError, showSuccess } from "@/utils/toast";
import { logger } from "@/lib/logger";
import { notaDinasService } from "@/services/notaDinasService";
import type { NotaDinasRecord } from "@/types/notaDinas";
import { readRecords, RECORDS_KEY } from "@/components/nota-dinas/notaDinasStorage";

type DeleteConfirmState = { open: boolean; record: NotaDinasRecord | null };

type UseNotaDinasDeleteOptions = {
  deleteConfirm: DeleteConfirmState;
  activeRecordId: string | null;
  setActiveRecordId: Dispatch<SetStateAction<string | null>>;
  setRecords: Dispatch<SetStateAction<NotaDinasRecord[]>>;
  setView: (view: "list" | "form") => void;
  setDeleteConfirm: Dispatch<SetStateAction<DeleteConfirmState>>;
};

export const useNotaDinasDelete = ({
  deleteConfirm,
  activeRecordId,
  setActiveRecordId,
  setRecords,
  setView,
  setDeleteConfirm,
}: UseNotaDinasDeleteOptions) => {
  const requestDelete = (record: NotaDinasRecord) => setDeleteConfirm({ open: true, record });

  const confirmDelete = async () => {
    const record = deleteConfirm.record;
    if (!record) return;

    try {
      await notaDinasService.delete(record.id);
      setRecords((currentRecords) => currentRecords.filter((item) => item.id !== record.id));
      if (typeof window !== "undefined") {
        const localRecords = readRecords().filter((item) => item.id !== record.id);
        if (localRecords.length > 0) window.localStorage.setItem(RECORDS_KEY, JSON.stringify(localRecords));
        else window.localStorage.removeItem(RECORDS_KEY);
      }
      if (activeRecordId === record.id) {
        setActiveRecordId(null);
        setView("list");
      }
      showSuccess("Nota Dinas berhasil dihapus.");
      setDeleteConfirm({ open: false, record: null });
    } catch (error) {
      logger.error("Gagal menghapus Nota Dinas:", error);
      showError("Nota Dinas gagal dihapus. Periksa koneksi dan hak akses akun.");
    }
  };

  return { requestDelete, confirmDelete };
};
