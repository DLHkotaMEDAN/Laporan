export type RecapPeriod = 'daily' | 'weekly' | 'monthly';

const rolesByPeriod: Record<RecapPeriod, readonly string[]> = {
  daily: [
    'admin',
    'admin_harian',
    'admin_laporan_harian_mingguan',
    'admin_laporan_harian_bulanan',
  ],
  weekly: [
    'admin',
    'admin_laporan_mingguan',
    'admin_laporan_mingguan_bulanan',
    'admin_laporan_harian_mingguan',
  ],
  monthly: [
    'admin',
    'admin_laporan_bulanan',
    'admin_laporan_mingguan_bulanan',
    'admin_laporan_harian_bulanan',
  ],
};

export const canPrintReportRecap = (role: string | null | undefined, period: RecapPeriod) =>
  Boolean(role && rolesByPeriod[period].includes(role));

export const getRecapPrintDeniedMessage = (role: string | null | undefined, period: RecapPeriod) => {
  if (!role) return 'Anda harus login untuk mencetak rekap.';

  const labels: Record<RecapPeriod, string> = {
    daily: 'harian',
    weekly: 'mingguan',
    monthly: 'bulanan',
  };

  return `Hak akses "${role}" tidak diizinkan untuk mencetak rekap ${labels[period]}. Hubungi admin untuk mendapatkan akses.`;
};
