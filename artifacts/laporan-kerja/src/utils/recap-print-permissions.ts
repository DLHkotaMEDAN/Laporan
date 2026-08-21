import { RecapPeriod, canPrintReportRecapByRole, getRoleLabel } from '@/constants/access-control';

export type { RecapPeriod };

export const canPrintReportRecap = (
  role: string | null | undefined,
  period: RecapPeriod,
  email?: string | null,
) => canPrintReportRecapByRole(role, period, email);

export const getRecapPrintDeniedMessage = (role: string | null | undefined, period: RecapPeriod) => {
  if (!role) return 'Anda harus login untuk mencetak rekap.';

  const labels: Record<RecapPeriod, string> = {
    daily: 'harian',
    weekly: 'mingguan',
    monthly: 'bulanan',
  };

  return `Hak akses "${getRoleLabel(role)}" tidak diizinkan untuk mencetak rekap ${labels[period]}. Hubungi admin untuk mendapatkan akses.`;
};
