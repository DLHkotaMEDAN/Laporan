import { useMemo, type Dispatch, type SetStateAction } from "react";
import type { NotaDinasCategory, NotaDinasRecord } from "@/types/notaDinas";
import type { NotaDinasSort, NotaDinasSortKey } from "@/components/nota-dinas/NotaDinasRecordTable";
import { getNotaDinasCategory } from "@/components/nota-dinas/notaDinasUtils";
import { compareNotaDinasSortValues, getNotaDinasNumberLabel } from "@/components/nota-dinas/notaDinasRecordUtils";

export const useNotaDinasSortedRecords = (
  records: NotaDinasRecord[],
  categoryFilter: NotaDinasCategory | "semua",
  sort: NotaDinasSort,
  setSort: Dispatch<SetStateAction<NotaDinasSort>>,
) => {
  const sortedRecords = useMemo(() => records
    .filter((record) => categoryFilter === "semua" || getNotaDinasCategory(record) === categoryFilter)
    .sort((left, right) => {
      if (!sort) return right.updatedAt.localeCompare(left.updatedAt);
      const getValue = (record: NotaDinasRecord): string | number => {
        switch (sort.key) {
          case "requestNumber": return getNotaDinasNumberLabel(record);
          case "continuationNumber": return getNotaDinasNumberLabel(record, true);
          case "date": return new Date(record.form.tanggal).getTime();
          case "subject": return record.form.hal || "";
          case "region": return record.form.wilayah || "";
          case "items": return record.form.items.length;
        }
      };
      const comparison = compareNotaDinasSortValues(getValue(left), getValue(right));
      return sort.direction === "asc" ? comparison : -comparison;
    }), [categoryFilter, records, sort]);

  const toggleSort = (key: NotaDinasSortKey) => setSort((current) => ({
    key,
    direction: current?.key === key && current.direction === "asc" ? "desc" : "asc",
  }));

  return { sortedRecords, toggleSort };
};
