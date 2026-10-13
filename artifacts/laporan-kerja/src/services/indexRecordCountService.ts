import { supabase } from "@/lib/supabase";

type RecordCountOptions = {
  regionId?: string | null;
  reportType?: string;
  softDeleted?: boolean;
};

export const getDatabaseRecordCount = async (
  table: string,
  options: RecordCountOptions = {},
) => {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  if (options.regionId) query = query.eq("region_id", options.regionId);
  if (options.reportType) query = query.eq("report_type", options.reportType);
  // Default: filter hanya data aktif (non-deleted).
  // Hanya tampilkan data terhapus jika softDeleted === true secara eksplisit.
  if (options.softDeleted !== true) query = query.is("deleted_at", null);

  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
};
