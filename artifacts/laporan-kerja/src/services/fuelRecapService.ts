import { FuelReport, FuelReportType } from '@/types/fuelReport';
import { fuelService } from '@/services/fuelService';
import { fuelPusatService } from '@/services/fuelPusatService';
import { laporanBbmService } from '@/services/laporanBbmService';

/** Membaca sumber data rekap sesuai tab yang sedang dicetak. */
export const fuelRecapService = {
  getReportsByDateRange(startDate: string, endDate: string, regionId?: string | null, reportType: FuelReportType = 'admin_bbm'): Promise<FuelReport[]> {
    return reportType === 'laporan_bbm'
      ? laporanBbmService.getReportsByDateRange(startDate, endDate, regionId)
      : reportType === 'admin_bbm_pusat'
        ? fuelPusatService.getReportsByDateRange(startDate, endDate, regionId)
        : fuelService.getReportsByDateRange(startDate, endDate, regionId, reportType);
  },
};
