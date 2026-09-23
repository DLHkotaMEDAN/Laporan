"use client";

import React from 'react';
import FuelReportForm from '@/components/FuelReportForm';
import { FuelReportType } from '@/types/fuelReport';

const CreateFuelReport = ({ reportType = 'admin_bbm' }: { reportType?: FuelReportType }) => {
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <FuelReportForm reportType={reportType} />
    </div>
  );
};

export default CreateFuelReport;
