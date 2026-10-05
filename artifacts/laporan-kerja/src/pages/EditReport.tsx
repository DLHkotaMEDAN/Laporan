import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReportForm from '@/components/ReportForm';
import { Report } from '@/types/report';
import { showError } from '@/utils/toast';
import { reportService } from '@/services/reportService';

const EditReport = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadReport(id);
  }, [id]);

  const loadReport = async (reportId: string) => {
    try {
      setLoading(true);
      const data = await reportService.getReportById(reportId);
      setReport(data);
    } catch (error) {
      showError("Laporan tidak ditemukan di database");
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-20 text-center">Memuat data...</div>;
  if (!report) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <ReportForm initialData={report} isEditing={true} />
      </div>
    </div>
  );
};

export default EditReport;