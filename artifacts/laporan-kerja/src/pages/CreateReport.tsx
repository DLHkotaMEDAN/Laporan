"use client";

import React from 'react';
import ReportForm from '@/components/ReportForm';

const CreateReport = () => {
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <ReportForm />
      </div>
    </div>
  );
};

export default CreateReport;