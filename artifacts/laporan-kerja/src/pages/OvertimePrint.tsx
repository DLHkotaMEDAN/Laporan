"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { roleRequiresRegion } from '@/constants/access-control';
import { overtimeService } from '@/services/overtimeService';
import { OvertimeRecord } from '@/types/overtime';

type OvertimePeriod = 'daily' | 'weekly' | 'monthly';

const OvertimePrint = ({ period = 'daily' }: { period?: OvertimePeriod }) => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const regionId = !isAdmin && roleRequiresRegion(profile?.role) ? profile?.region_id || '__unassigned__' : null;
  const [records, setRecords] = useState<OvertimeRecord[]>([]);
  useEffect(() => { overtimeService.getAll(regionId).then(setRecords).catch(() => setRecords([])); }, [regionId]);
  const filteredRecords = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const weekStartValue = weekStart.toISOString().split('T')[0];
    const monthPrefix = today.slice(0, 7);
    return records.filter(record => {
      if (period === 'daily') return record.date === today;
      if (period === 'monthly') return record.date.startsWith(monthPrefix);
      return record.date >= weekStartValue && record.date <= today;
    });
  }, [period, records]);
  const periodLabel = period === 'daily' ? 'HARIAN' : period === 'weekly' ? 'MINGGUAN' : 'BULANAN';
  const regionTitle = [...new Set(filteredRecords.map(record => record.region?.name).filter(Boolean))].join(', ') || 'Semua Wilayah';
  const teamTitle = [...new Set(filteredRecords.map(record => record.team?.name).filter(Boolean))].join(', ') || 'Semua Tim';
  return <div className="p-4 md:p-8"><div className="mb-4 flex justify-end print:hidden"><Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Cetak</Button></div><h1 className="mb-1 text-center text-xl font-bold">REKAP LEMBUR {periodLabel}</h1><p className="text-center text-sm font-bold">Wilayah: {regionTitle}</p><p className="mb-5 text-center text-sm font-semibold">Tim: {teamTitle}</p><p className="mb-5 text-center text-sm">Dinas Lingkungan Hidup Kota Medan</p><table className="w-full border-collapse border-2 border-black text-sm"><thead><tr className="bg-slate-300">{['No', 'Nama', 'NIP', 'Jabatan', 'Lokasi Pekerjaan', 'Foto', 'Jam', 'Jumlah Kehadiran'].map(header => <th key={header} className="border-2 border-black p-2">{header}</th>)}</tr></thead><tbody>{filteredRecords.map((record, index) => <tr key={record.id}><td className="border-2 border-black p-2 text-center">{index + 1}</td><td className="border-2 border-black p-2">{record.name}</td><td className="border-2 border-black p-2">{record.nip}</td><td className="border-2 border-black p-2 text-center">{record.position}</td><td className="border-2 border-black p-2 text-center">{record.work_location}</td><td className="h-36 border-2 border-black p-1 text-center">{record.photo_url && <img src={record.photo_url} alt="Foto lembur" className="mx-auto h-32 w-full object-cover" />}</td><td className="border-2 border-black p-2 text-center whitespace-nowrap">{record.start_time} s/d {record.end_time}</td><td className="border-2 border-black p-2 text-center">{record.attendance_count}</td></tr>)}</tbody></table></div>;
};

export default OvertimePrint;
