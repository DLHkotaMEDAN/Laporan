import { logger } from '@/lib/logger';

/**
 * Mengambil semua baris dari Supabase dengan paginasi otomatis.
 * Berhenti ketika halaman terakhir mengembalikan data kurang dari pageSize,
 * atau ketika batas maksimum halaman tercapai (cegah loop tak henti).
 *
 * Fungsi ini adalah satu-satunya implementasi canonical — semua service
 * harus mengimport dari sini, bukan mendefinisikan ulang secara lokal.
 *
 * @param buildQuery  Fungsi yang mengembalikan Supabase query builder
 * @param pageSize    Jumlah baris per halaman (default 1000)
 * @param maxPages    Batas maksimum halaman — cegah loop tak henti (default 10 = 10.000 baris)
 * @param maxRows     Batas maksimum total baris (default 5000) - berhenti lebih cepat untuk performa
 */
export const fetchAllPages = async <T>(
  buildQuery: () => any,
  pageSize = 1000,
  maxPages = 10,
  maxRows = 5000,
): Promise<T[]> => {
  const rows: T[] = [];

  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await buildQuery().range(from, to);

    if (error) throw error;

    const batch = (data || []) as T[];
    rows.push(...batch);

    // Berhenti jika halaman terakhir (data kurang dari pageSize)
    if (batch.length < pageSize) break;

    // Berhenti jika sudah mencapai maxRows (untuk performa)
    if (rows.length >= maxRows) {
      logger.warn(
        `[fetchAllPages] Data dibatasi ke ${maxRows} baris untuk performa. ` +
        `Pertimbangkan untuk menambah filter tanggal/wilayah lebih spesifik.`
      );
      break;
    }
  }

  // Kalau loop selesai karena maxPages tercapai (bukan karena data habis),
  // kemungkinan ada data yang terpotong — catat di console agar developer tahu.
  if (rows.length >= maxPages * pageSize) {
    logger.warn(
      `[fetchAllPages] Data mungkin terpotong: tercapai batas ${maxPages} halaman ` +
      `(${rows.length} baris). Pertimbangkan untuk menambah filter tanggal/wilayah.`
    );
  }

  return rows;
};
