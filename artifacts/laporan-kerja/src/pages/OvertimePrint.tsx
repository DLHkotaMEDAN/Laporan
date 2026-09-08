"use client";

import React, { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { roleRequiresRegion } from '@/constants/access-control';
import { overtimeService } from '@/services/overtimeService';
import { OvertimeRecord } from '@/types/overtime';

const OvertimePrint = () => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const regionId = !isAdmin && roleRequiresRegion(profile?.role) ? profile?.region_id || '__unassigned__' : null;
  const [records, setRecords] = useState<OvertimeRecord[]>([]);
  useEffect(() => { overtimeService.getAll(regionId).then(setRecords).catch(() => setRecords([])); }, [regionId]);
  return <div className="p-4 md:p-8"><div className="mb-4 flex justify-end print:hidden"><Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Cetak</Button></div><h1 className="mb-1 text-center text-xl font-bold">REKAP LEMBUR</h1><p className="mb-5 text-center text-sm">Dinas Lingkungan Hidup Kota Medan</p><table className="w-full border-collapse border-2 border-black text-sm"><thead><tr className="bg-slate-300">{['No', 'Tim', 'Nama', 'NIP', 'Jabatan', 'Lokasi Pekerjaan', 'Foto', 'Jam', 'Jumlah Kehadiran'].map(header => <th key={header} className="border-2 border-black p-2">{header}</th>)}</tr></thead><tbody>{records.map((record, index) => <tr key={record.id}><td className="border-2 border-black p-2 text-center">{index + 1}</td><td className="border-2 border-black p-2">{record.team?.name || '-'}</td><td className="border-2 border-black p-2">{record.name}</td><td className="border-2 border-black p-2">{record.nip}</td><td className="border-2 border-black p-2 text-center">{record.position}</td><td className="border-2 border-black p-2 text-center">{record.work_location}</td><td className="h-36 border-2 border-black p-1 text-center">{record.photo_url && <img src={record.photo_url} alt="Foto lembur" className="mx-auto h-32 w-full object-cover" />}</td><td className="border-2 border-black p-2 text-center whitespace-nowrap">{record.start_time} s/d {record.end_time}</td><td className="border-2 border-black p-2 text-center">{record.attendance_count}</td></tr>)}</tbody></table></div>;
};

export default OvertimePrint;
