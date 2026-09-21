"use client";

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import FuelReportForm from '@/components/FuelReportForm';
import { laporanBbmService } from '@/services/laporanBbmService';
import { FuelReport } from '@/types/fuelReport';
import { showError } from '@/utils/toast';

const EditLaporanBbm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<FuelReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    void laporanBbmService.getReportById(id)
      .then((data) => {
        if (data.report_type !== 'laporan_bbm') throw new Error('not-found');
        setReport(data);
      })
      .catch(() => {
        showError('Laporan BBM tidak ditemukan');
        navigate('/laporan-bbm');
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) return <div className="p-20 text-center">Memuat data...</div>;
  if (!report) return null;

  return <div className="min-h-screen bg-slate-50 p-4 md:p-8"><FuelReportForm initialData={report} isEditing reportType="laporan_bbm" /></div>;
};

export default EditLaporanBbm;
