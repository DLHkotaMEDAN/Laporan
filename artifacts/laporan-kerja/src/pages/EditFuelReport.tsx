import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import FuelReportForm from '@/components/FuelReportForm';
import { FuelReport, FuelReportType } from '@/types/fuelReport';
import { fuelService } from '@/services/fuelService';
import { fuelPusatService } from '@/services/fuelPusatService';
import { showError } from '@/utils/toast';

const EditFuelReport = ({ reportType = 'admin_bbm' }: { reportType?: FuelReportType }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<FuelReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadReport(id);
  }, [id, reportType]);

  const loadReport = async (reportId: string) => {
    try {
      setLoading(true);
      const data = reportType === 'admin_bbm_pusat'
        ? await fuelPusatService.getReportById(reportId)
        : await fuelService.getReportById(reportId);
      if (data.report_type !== reportType) throw new Error('Laporan tidak ditemukan');
      setReport(data);
    } catch (error) {
      showError("Laporan tidak ditemukan");
      navigate(reportType === 'admin_bbm_pusat' ? '/fuel-reports-pusat' : '/fuel-reports');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-20 text-center">Memuat data...</div>;
  if (!report) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <FuelReportForm initialData={report} isEditing={true} reportType={reportType} />
    </div>
  );
};

export default EditFuelReport;
