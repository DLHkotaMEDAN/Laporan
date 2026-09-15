"use client";

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, ChevronDown, Edit, FileText, FilterX, Image, Loader2, PenTool, Plus, Printer, Share2, Table } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/context/AuthContext';
import { useRegionFilterOptions } from '@/hooks/useRegionFilterOptions';
import { supabase } from '@/lib/supabase';
import { spjOliService } from '@/services/spjOliService';
import { SpjOliRecord } from '@/types/spjOli';
import { showError } from '@/utils/toast';
import { openShareablePdfPreview } from '@/utils/pdf-preview';
import { exportSpjOliExcel } from '@/utils/spj-oli-excel';

export type SpjOliRecapPeriod = 'daily' | 'weekly' | 'monthly';
type LogoMode = 'with-logo' | 'without-logo';
type SignatureMode = 'with-signature' | 'without-signature';
type TableMode = 'complete' | 'compact';

const labels: Record<SpjOliRecapPeriod, string> = { daily: 'Harian', weekly: 'Mingguan', monthly: 'Bulanan' };
const canAccess = (role?: string) => ['admin', 'admin_spj_bbm', 'pimpinan'].includes(role || '');
const getLogoUrl = (fileName: string) => supabase.storage.from('assets').getPublicUrl(fileName).data.publicUrl;
const LOGO_MEDAN_URL = getLogoUrl('logo-medan.jpg');
const LOGO_DLH_URL = getLogoUrl('logo-dlh.jpg');

const formatDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', {
  day: '2-digit', month: '2-digit', year: 'numeric',
});

const formatPeriod = (period: SpjOliRecapPeriod, date: string) => {
  const longDate = new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  if (period === 'monthly') return new Date(`${date.slice(0, 7)}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  return period === 'weekly' ? `Minggu tanggal ${longDate}` : longDate;
};

export default function SpjOliRecap({ period }: { period: SpjOliRecapPeriod }) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [records, setRecords] = useState<SpjOliRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState('semua');
  const [selectedTeam, setSelectedTeam] = useState('semua');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [logoMode, setLogoMode] = useState<LogoMode>('without-logo');
  const [signatureMode, setSignatureMode] = useState<SignatureMode>('without-signature');
  const [tableMode, setTableMode] = useState<TableMode>('complete');
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const { regions, teams } = useRegionFilterOptions(true, selectedRegion);

  useEffect(() => {
    spjOliService.getAll()
      .then(setRecords)
      .catch(() => showError('Gagal memuat rekap SPJ Oli'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsCompactViewport(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const filtered = useMemo(() => records.filter((record) => {
    if (selectedRegion !== 'semua' && record.region_id !== selectedRegion) return false;
    if (selectedTeam !== 'semua' && record.team_id !== selectedTeam) return false;
    if (period === 'daily') return record.date === selectedDate;
    if (period === 'monthly') return record.date.slice(0, 7) === selectedDate.slice(0, 7);

    const current = new Date(`${record.date}T00:00:00`);
    const start = new Date(`${selectedDate}T00:00:00`);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return current >= start && current <= end;
  }), [records, selectedRegion, selectedTeam, selectedDate, period]);

  const regionName = (id: string) => regions.find((region) => region.id === id)?.name || '-';
  const teamName = (id: string) => teams.find((team) => team.id === id)?.name || '-';
  const showRegionColumn = profile?.role === 'admin' || profile?.role === 'admin_spj_bbm';
  const columnCount = showRegionColumn ? 11 : 10;
  // Total selalu 100% supaya kolom terakhir (Keterangan) tidak keluar dari
  // batas A3 saat browser membuka dialog cetak.
  const columnWidths = showRegionColumn
    ? ['3%', '8%', '9%', '10%', '9%', '13%', '13%', '8%', '6%', '11%', '10%']
    : ['3%', '9%', '10%', '10%', '15%', '15%', '9%', '6%', '12%', '11%'];
  const periodLabel = formatPeriod(period, selectedDate);
  const editRecords = filtered.slice(0, 50);

  const reset = () => {
    setSelectedRegion('semua');
    setSelectedTeam('semua');
    setSelectedDate(new Date().toISOString().slice(0, 10));
  };
  // Saat dipilih dari dropdown, beri Radix satu siklus render untuk menutup
  // menu terlebih dahulu sebelum browser mengambil isi halaman untuk dicetak.
  const handlePrint = () => window.setTimeout(() => window.print(), 0);
  const handlePdf = async () => {
    try {
      await openShareablePdfPreview({ fileName: `Rekap_SPJ_Oli_${period}` });
    } catch (error: any) {
      showError(error.message || 'Gagal membuat PDF');
    }
  };
  const handleExcel = async () => {
    try {
      await exportSpjOliExcel(filtered, `REKAP SPJ OLI ${labels[period]}`, periodLabel, regionName, teamName, showRegionColumn);
    } catch {
      showError('Gagal membuat file Excel');
    }
  };

  if (!canAccess(profile?.role)) return null;

  const recapMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="h-10 bg-blue-600 px-4 shadow-md hover:bg-blue-700">
          <FileText className="mr-2 h-4 w-4" /> Menu Rekap <ChevronDown className="ml-2 h-4 w-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] max-w-80">
        {isCompactViewport ? (
          <>
            <DropdownMenuItem onClick={() => setLogoMode(logoMode === 'with-logo' ? 'without-logo' : 'with-logo')}><Image className="mr-2 h-4 w-4 text-blue-600" /> Logo: {logoMode === 'with-logo' ? 'Dengan Logo' : 'Tanpa Logo'}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSignatureMode(signatureMode === 'with-signature' ? 'without-signature' : 'with-signature')}><PenTool className="mr-2 h-4 w-4 text-amber-600" /> Tanda Tangan: {signatureMode === 'with-signature' ? 'Ada' : 'Tanpa'}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTableMode(tableMode === 'complete' ? 'compact' : 'complete')}><Table className="mr-2 h-4 w-4 text-emerald-600" /> Mode Tabel: {tableMode === 'complete' ? 'Lengkap' : 'Ringkas'}</DropdownMenuItem>
            {editRecords.map((record) => <DropdownMenuItem key={record.id} onClick={() => navigate(`/spj-oli/edit/${record.id}`)} className="whitespace-normal"><Edit className="mr-2 h-4 w-4 text-blue-600" /> Edit: {record.spj_number} - {record.oil_name}</DropdownMenuItem>)}
          </>
        ) : (
          <>
            <DropdownMenuSub><DropdownMenuSubTrigger><Image className="mr-2 h-4 w-4 text-blue-600" /> Logo: {logoMode === 'with-logo' ? 'Dengan Logo' : 'Tanpa Logo'}</DropdownMenuSubTrigger><DropdownMenuSubContent><DropdownMenuItem onClick={() => setLogoMode('with-logo')}>Dengan Logo</DropdownMenuItem><DropdownMenuItem onClick={() => setLogoMode('without-logo')}>Tanpa Logo</DropdownMenuItem></DropdownMenuSubContent></DropdownMenuSub>
            <DropdownMenuSub><DropdownMenuSubTrigger><PenTool className="mr-2 h-4 w-4 text-amber-600" /> Tanda Tangan: {signatureMode === 'with-signature' ? 'Ada' : 'Tanpa'}</DropdownMenuSubTrigger><DropdownMenuSubContent><DropdownMenuItem onClick={() => setSignatureMode('with-signature')}>Ada Tanda Tangan</DropdownMenuItem><DropdownMenuItem onClick={() => setSignatureMode('without-signature')}>Tanpa Tanda Tangan</DropdownMenuItem></DropdownMenuSubContent></DropdownMenuSub>
            <DropdownMenuSub><DropdownMenuSubTrigger><Table className="mr-2 h-4 w-4 text-emerald-600" /> Mode Tabel: {tableMode === 'complete' ? 'Lengkap' : 'Ringkas'}</DropdownMenuSubTrigger><DropdownMenuSubContent><DropdownMenuItem onClick={() => setTableMode('complete')}>Tabel Lengkap</DropdownMenuItem><DropdownMenuItem onClick={() => setTableMode('compact')}>Tabel Ringkas</DropdownMenuItem></DropdownMenuSubContent></DropdownMenuSub>
            {editRecords.length > 0 && <DropdownMenuSub><DropdownMenuSubTrigger><Edit className="mr-2 h-4 w-4 text-blue-600" /> Edit Data</DropdownMenuSubTrigger><DropdownMenuSubContent className="w-80">{editRecords.map((record) => <DropdownMenuItem key={record.id} onClick={() => navigate(`/spj-oli/edit/${record.id}`)}>{record.spj_number} - {record.oil_name}</DropdownMenuItem>)}</DropdownMenuSubContent></DropdownMenuSub>}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handlePrint}><Printer className="mr-2 h-4 w-4 text-blue-600" /> Cetak Halaman Ini</DropdownMenuItem>
        <DropdownMenuItem onClick={handlePdf}><Share2 className="mr-2 h-4 w-4 text-indigo-600" /> Simpan PDF untuk Dibagikan</DropdownMenuItem>
        <DropdownMenuItem onClick={handleExcel}><Table className="mr-2 h-4 w-4 text-green-600" /> Simpan ke Excel</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/spj-oli/daily-rekap')}><CalendarDays className="mr-2 h-4 w-4 text-blue-500" /> Rekap Harian</DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/spj-oli/weekly-rekap')}><Table className="mr-2 h-4 w-4 text-green-600" /> Rekap Mingguan</DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/spj-oli/monthly-rekap')}><FileText className="mr-2 h-4 w-4 text-orange-600" /> Rekap Bulanan</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/spj-oli/create')} className="text-blue-700"><Plus className="mr-2 h-4 w-4" /> Tambah Baru</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <main className="spj-oli-a3-print min-h-screen bg-slate-50 p-4 md:p-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-[1400px] space-y-4">
        <header className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm xl:flex-row xl:items-center xl:justify-between print:hidden">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => navigate('/')}><ArrowLeft className="h-4 w-4" /></Button>
            <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-600">SPJ Oli</p><h1 className="text-xl font-black md:text-2xl">Rekap {labels[period]}</h1><p className="text-sm text-slate-500">Rekap penggunaan oli berdasarkan periode, wilayah, dan tim.</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {recapMenu}
            <Button variant="outline" onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Cetak</Button>
            <Button onClick={() => navigate('/spj-oli/create')} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="mr-2 h-4 w-4" /> Input SPJ Oli</Button>
          </div>
        </header>

        <section className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm md:grid-cols-4 print:hidden">
          <div><label className="mb-1 block text-xs font-bold text-slate-500">{period === 'monthly' ? 'Bulan Acuan' : period === 'weekly' ? 'Tanggal Minggu' : 'Tanggal'}</label><Input type={period === 'monthly' ? 'month' : 'date'} value={period === 'monthly' ? selectedDate.slice(0, 7) : selectedDate} onChange={(event) => setSelectedDate(period === 'monthly' ? `${event.target.value}-01` : event.target.value)} /></div>
          <div><label className="mb-1 block text-xs font-bold text-slate-500">Wilayah</label><Select value={selectedRegion} onValueChange={(value) => { setSelectedRegion(value); setSelectedTeam('semua'); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="semua">Semua Wilayah</SelectItem>{regions.map((region) => <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>)}</SelectContent></Select></div>
          <div><label className="mb-1 block text-xs font-bold text-slate-500">Tim</label><Select value={selectedTeam} onValueChange={setSelectedTeam}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="semua">Semua Tim</SelectItem>{teams.map((team) => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="flex items-end"><Button variant="outline" onClick={reset} className="w-full"><FilterX className="mr-2 h-4 w-4" /> Reset Filter</Button></div>
        </section>

        <section className="print-area recap-print-area mx-auto min-h-[297mm] w-full max-w-[420mm] overflow-hidden rounded-2xl border bg-white p-8 shadow-lg print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <div className="mb-4 flex items-center justify-center gap-8 border-b-4 border-double border-black pb-3">
            {logoMode === 'with-logo' && <img src={LOGO_MEDAN_URL} className="h-20 w-20 object-contain" alt="Logo Medan" />}
            <div className="text-center"><h1 className="text-xl font-bold uppercase">Pemerintah Kota Medan</h1><h2 className="text-2xl font-black uppercase">Dinas Lingkungan Hidup</h2><p className="text-xs italic">Jl. Pinang Baris, Lalang Kec. Medan Sunggal, Kota Medan, Sumatera Utara</p></div>
            {logoMode === 'with-logo' && <img src={LOGO_DLH_URL} className="h-20 w-20 object-contain" alt="Logo DLH" />}
          </div>
          <div className="mb-5 text-center"><h3 className="text-xl font-bold uppercase underline">REKAP SPJ OLI {labels[period].toUpperCase()}{showRegionColumn ? (selectedRegion !== 'semua' ? ` — ${regionName(selectedRegion).toUpperCase()}` : ' — SEMUA WILAYAH') : ''}</h3><p className="text-lg font-bold">{periodLabel}</p></div>

          <div className="recap-table-scroll overflow-x-auto print:overflow-visible">
            <table className={`w-full min-w-[1200px] table-fixed border-collapse border-2 border-black ${tableMode === 'compact' ? 'text-[8px] leading-[1.25]' : 'text-[10px] leading-[1.35]'} print:w-full print:min-w-0`}>
              <colgroup>
                {columnWidths.map((width, index) => <col key={index} style={{ width }} />)}
              </colgroup>
              <thead><tr className="bg-slate-100">
                <th className="border-2 border-black p-1">No</th>
                <th className="border-2 border-black p-1">Tanggal</th>
                <th className="border-2 border-black p-1">No. SPJ</th>
                {showRegionColumn && <th className="border-2 border-black p-1">Wilayah</th>}
                <th className="border-2 border-black p-1">Tim</th>
                <th className="border-2 border-black p-1 leading-tight">Alat Operasional/<br />Kendaraan</th>
                <th className="border-2 border-black p-1 leading-tight">Nama Operator/<br />Supir/Penerima</th>
                <th className="border-2 border-black p-1">Jenis Oli</th>
                <th className="border-2 border-black p-1">Jumlah</th>
                <th className="border-2 border-black p-1">Lokasi</th>
                <th className="border-2 border-black p-1">Keterangan</th>
              </tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={columnCount} className="border-2 border-black p-12 text-center"><Loader2 className="mx-auto animate-spin" /></td></tr> : filtered.length ? filtered.map((record, index) => (
                  <tr key={record.id} className="align-top break-inside-avoid odd:bg-white even:bg-slate-50 print:bg-white">
                    <td className="break-words border-2 border-black p-1 text-center">{index + 1}</td>
                    <td className="break-words border-2 border-black p-1 text-center">{formatDate(record.date)}</td>
                    <td className="break-words border-2 border-black p-1 font-semibold">{record.spj_number}</td>
                    {showRegionColumn && <td className="break-words border-2 border-black p-1">{regionName(record.region_id)}</td>}
                    <td className="break-words border-2 border-black p-1">{teamName(record.team_id)}</td>
                    <td className="break-words border-2 border-black p-1">{record.vehicle_name || '-'}</td>
                    <td className="break-words border-2 border-black p-1">{record.operator_name || record.receiver_name || '-'}</td>
                    <td className="break-words border-2 border-black p-1">{record.oil_name}</td>
                    <td className="break-words border-2 border-black p-1 text-right">{record.quantity} {record.unit}</td>
                    <td className="break-words border-2 border-black p-1">{record.location || '-'}</td>
                    <td className="break-words border-2 border-black p-1">{record.remarks || '-'}</td>
                  </tr>
                )) : <tr><td colSpan={columnCount} className="border-2 border-black p-12 text-center">Tidak ada data untuk periode ini.</td></tr>}
              </tbody>
            </table>
          </div>
          {signatureMode === 'with-signature' && <div className="mt-12 grid grid-cols-3 gap-4 text-center text-[11px]"><div className="min-h-[150px]">Mengetahui,<br /><br /><br /><b>Kepala Bidang</b></div><div className="min-h-[150px]">Diketahui,<br /><br /><br /><b>Ketua Tim</b></div><div className="min-h-[150px]">Medan, {new Date().toLocaleDateString('id-ID')}<br /><br /><br /><b>Penanggung Jawab</b></div></div>}
          <div className="border-t bg-slate-50 px-4 py-3 text-xs text-slate-500 print:hidden"><b>{filtered.length}</b> data SPJ Oli ditampilkan.</div>
        </section>
      </div>
    </main>
  );
}
