"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import FuelReportForm from '@/components/FuelReportForm';
import { FuelReport } from '@/types/fuelReport';
import { fuelService } from '@/services/fuelService';
import { showError } from '@/utils/toast';

const EditFuelReport = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<FuelReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadReport(id);
  }, [id]);

  const loadReport = async (reportId: string) => {
    try {
      setLoading(true);
      const data = await fuelService.getReportById(reportId);
      setReport(data);
    } catch (error) {
      showError("Laporan tidak ditemukan");
      navigate('/fuel-reports');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-20 text-center">Memuat data...</div>;
  if (!report) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <FuelReportForm initialData={report} isEditing={true} />
    </div>
  );
};

export default EditFuelReport;