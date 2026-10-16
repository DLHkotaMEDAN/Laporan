import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { notaDinasService } from "@/services/notaDinasService";
import type { NotaDinasForm, NotaDinasRecord } from "@/types/notaDinas";
import { isNewerRecord, readRecords, removeSyncedLocalRecords } from "@/components/nota-dinas/notaDinasStorage";

type AccountRegion = { id: string; name: string; notaCode: string } | null;

type UseNotaDinasRecordsOptions = {
  accountRegion: AccountRegion;
  accountRegionReady: boolean;
  isRegionalNotaAdmin: boolean;
  applyAccountRegion: (form: NotaDinasForm) => NotaDinasForm;
};

export function useNotaDinasRecords({
  accountRegion,
  accountRegionReady,
  isRegionalNotaAdmin,
  applyAccountRegion,
}: UseNotaDinasRecordsOptions) {
  const [records, setRecords] = useState<NotaDinasRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState<string | null>(null);

  useEffect(() => {
    if (isRegionalNotaAdmin && !accountRegionReady) return;
    let cancelled = false;

    const loadRecords = async () => {
      setRecordsLoading(true);
      setRecordsError(null);

      try {
        const remoteRecords = await notaDinasService.getAll();
        const recordsById = new Map(remoteRecords.map((record) => [record.id, record]));
        const syncedLocalRecordIds = new Set<string>();
        let hasPendingLocalRecords = false;

        // Sinkronisasi legacy mempertahankan data lokal dan mengutamakan versi terbaru.
        for (const localRecord of readRecords()) {
          const remoteRecord = recordsById.get(localRecord.id);
          const localForm = applyAccountRegion(localRecord.form);
          try {
            if (!remoteRecord) {
              const createdRecord = await notaDinasService.create(
                localForm,
                localRecord.id,
                localRecord.createdAt,
                localRecord.updatedAt,
                accountRegion?.id,
              );
              recordsById.set(createdRecord.id, createdRecord);
            } else if (isNewerRecord(localRecord, remoteRecord)) {
              const updatedRecord = await notaDinasService.update(
                remoteRecord.id,
                localForm,
                localRecord.updatedAt,
                accountRegion?.id,
              );
              recordsById.set(updatedRecord.id, updatedRecord);
            }
            syncedLocalRecordIds.add(localRecord.id);
          } catch (migrationError) {
            hasPendingLocalRecords = true;
            logger.error("Gagal menyinkronkan Nota Dinas lokal:", migrationError);
          }
        }

        removeSyncedLocalRecords(syncedLocalRecordIds);
        if (!cancelled) {
          setRecords([...recordsById.values()]);
          if (hasPendingLocalRecords) {
            setRecordsError("Sebagian data lokal belum tersinkron. Periksa koneksi dan coba muat ulang.");
          }
        }
      } catch (error) {
        logger.error("Gagal memuat Nota Dinas dari Supabase:", error);
        if (!cancelled) {
          setRecords(readRecords());
          setRecordsError("Data Supabase belum dapat dimuat. Data lokal ditampilkan sementara.");
        }
      } finally {
        if (!cancelled) setRecordsLoading(false);
      }
    };

    void loadRecords();
    const channel = supabase
      .channel("nota-dinas-records-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "nota_dinas_records" }, () => void loadRecords())
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [accountRegion, accountRegionReady, isRegionalNotaAdmin, applyAccountRegion]);

  return { records, setRecords, recordsLoading, recordsError };
}
