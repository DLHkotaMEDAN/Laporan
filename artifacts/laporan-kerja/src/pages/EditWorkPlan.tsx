"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import WorkPlanForm from '@/components/WorkPlanForm';
import { WorkPlan } from '@/types/workPlan';
import { workPlanService } from '@/services/workPlanService';
import { showError } from '@/utils/toast';

const EditWorkPlan = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<WorkPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadPlan(id);
  }, [id]);

  const loadPlan = async (planId: string) => {
    try {
      setLoading(true);
      const data = await workPlanService.getWorkPlanById(planId);
      setPlan(data);
    } catch (error) {
      showError("Rencana kerja tidak ditemukan");
      navigate('/work-plans');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-20 text-center">Memuat data...</div>;
  if (!plan) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <WorkPlanForm initialData={plan} isEditing={true} />
    </div>
  );
};

export default EditWorkPlan;