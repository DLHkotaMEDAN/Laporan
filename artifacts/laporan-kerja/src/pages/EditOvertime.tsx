import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import OvertimeForm from '@/components/OvertimeForm';
import { overtimeService } from '@/services/overtimeService';
import { OvertimeRecord } from '@/types/overtime';
import { showError } from '@/utils/toast';
const EditOvertime = () => { const { id } = useParams(); const navigate = useNavigate(); const [record, setRecord] = useState<OvertimeRecord>(); useEffect(() => { if (id) overtimeService.getById(id).then(setRecord).catch(() => { showError('Data lembur tidak ditemukan.'); navigate('/overtime'); }); }, [id]); return <div className="min-h-screen bg-slate-50 p-4 md:p-8">{record ? <OvertimeForm initialData={record} /> : <p className="p-20 text-center">Memuat data...</p>}</div>; };
export default EditOvertime;
