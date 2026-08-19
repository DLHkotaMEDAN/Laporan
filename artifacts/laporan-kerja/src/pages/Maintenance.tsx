"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, Trash2, RefreshCw, ShieldAlert, 
  Loader2, Database, Users, History,
  FileText, ClipboardList,
  RotateCcw, HardDrive, TrendingUp, BarChart3, Eye, Info, X,
  Zap, Activity, Globe, Cpu, Eraser
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { showSuccess, showError } from '@/utils/toast';
import { useAuth } from '@/context/AuthContext';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import UserManagement from '@/components/UserManagement';
import { auditLogService } from '@/services/auditLogService';
import { reportService } from '@/services/reportService';
import { workPlanService } from '@/services/workPlanService';
import { format, isSameDay, isSameMonth, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import ImageUpload from '@/components/ImageUpload';
import {
  getStoredLandingPhotoUrl,
  removeLandingPhoto,
  uploadLandingPhoto,
  type LandingPhotoSlot,
} from '@/services/landingPhotoService';

const landingProfiles: { slot: LandingPhotoSlot; label: string; fallback: string }[] = [
  { slot: 'mayor', label: 'Foto Wali Kota Medan', fallback: 'https://upload.wikimedia.org/wikipedia/commons/9/97/WALIKOTA_MEDAN_-_RICO_WAAS.jpg' },
  { slot: 'deputyMayor', label: 'Foto Wakil Wali Kota Medan', fallback: 'https://dkp3.medan.go.id/storage/pimpinan/QEGV6dunjCjNh3hYJu3TMKDj2YjbHbnk9ptAbxRt.png' },
  { slot: 'environmentHead', label: 'Foto Kepala DLH Kota Medan', fallback: 'https://portal.medan.go.id/images/eselon/melvi-marlabayana-st-1_1756351561.jpg' },
];

const landingHeroProfile: { slot: LandingPhotoSlot; label: string; fallback: string } = {
  slot: 'hero',
  label: 'Foto Latar Halaman Depan',
  fallback: 'https://dlh.medan.go.id/web/resources/img/cover/780X520.jpg',
};

const defaultLandingPhotos = (): Record<LandingPhotoSlot, string> => ({
  hero: landingHeroProfile.fallback,
  mayor: landingProfiles[0].fallback,
  deputyMayor: landingProfiles[1].fallback,
  environmentHead: landingProfiles[2].fallback,
});

const Maintenance = () => {
  const navigate = useNavigate();
  const { profile, session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [orphanedFiles, setOrphanedFiles] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [deletedReports, setDeletedReports] = useState<any[]>([]);
  const [deletedWorkPlans, setDeletedWorkPlans] = useState<any[]>([]);
  
  const [stats, setStats] = useState({ 
    totalStorageCount: 0, 
    totalStorageSize: 0, 
    usedInDb: 0, 
    orphaned: 0,
    dbRecordCount: 0,
    reportsToday: 0,
    reportsThisMonth: 0,
    photosToday: 0,
    photosThisMonth: 0,
    totalUsers: 0,
    dbSizeEstimate: 0 
  });
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("");
  const [landingPhotoDrafts, setLandingPhotoDrafts] = useState<Record<LandingPhotoSlot, string>>(defaultLandingPhotos);
  const [landingPhotoSaving, setLandingPhotoSaving] = useState<LandingPhotoSlot | null>(null);

  const STORAGE_LIMIT = 1024 * 1024 * 1024; 
  const DB_LIMIT = 500 * 1024 * 1024; 
  const AUTH_LIMIT = 50000;

  const isAdmin = profile?.role === 'admin' || session?.user?.email === 'admin@gmail.com';

  const loadLandingPhotos = useCallback(async () => {
    const stored = await Promise.all([landingHeroProfile, ...landingProfiles].map(async (profile) => ({
      slot: profile.slot,
      url: await getStoredLandingPhotoUrl(profile.slot),
    })));
    setLandingPhotoDrafts((current) => {
      const next = { ...current };
      stored.forEach(({ slot, url }) => { if (url) next[slot] = url; });
      return next;
    });
  }, []);

  const handleSaveLandingPhoto = async (slot: LandingPhotoSlot) => {
    const currentPhoto = landingPhotoDrafts[slot];
    const profileInfo = [landingHeroProfile, ...landingProfiles].find((profile) => profile.slot === slot)!;
    setLandingPhotoSaving(slot);
    try {
      if (!currentPhoto) {
        await removeLandingPhoto(slot);
        setLandingPhotoDrafts((current) => ({ ...current, [slot]: profileInfo.fallback }));
        showSuccess(`${profileInfo.label} dikembalikan ke foto cadangan.`);
      } else if (currentPhoto.startsWith('data:image/')) {
        const publicUrl = await uploadLandingPhoto(slot, currentPhoto);
        setLandingPhotoDrafts((current) => ({ ...current, [slot]: publicUrl }));
        showSuccess(`${profileInfo.label} berhasil diperbarui.`);
      }
    } catch (error: any) {
      showError(`Gagal menyimpan foto: ${error.message || 'izin ditolak'}`);
    } finally {
      setLandingPhotoSaving(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const analyzeSystem = useCallback(async () => {
    setAnalyzing(true);
    try {
      const now = new Date();
      const { data: reports, error: dbError } = await supabase
        .from('reports')
        .select('tasks, date, category');
      
      if (dbError) throw dbError;

      const usedFileNames = new Set<string>();
      let reportsToday = 0;
      let reportsThisMonth = 0;
      let photosToday = 0;
      let photosThisMonth = 0;
      let totalChars = 0;

      reports?.forEach(report => {
        const reportDate = parseISO(report.date);
        if (isSameDay(reportDate, now)) reportsToday++;
        if (isSameMonth(reportDate, now)) reportsThisMonth++;
        totalChars += JSON.stringify(report).length;

        report.tasks?.forEach((task: any) => {
          let taskPhotoCount = 0;
          ['zero', 'fifty', 'hundred'].forEach(key => {
            const url = task.photos?.[key];
            if (url && url.includes('report-photos/')) {
              taskPhotoCount++;
              const fileName = url.split('report-photos/').pop();
              if (fileName) usedFileNames.add(fileName);
            }
          });
          if (isSameDay(reportDate, now)) photosToday += taskPhotoCount;
          if (isSameMonth(reportDate, now)) photosThisMonth += taskPhotoCount;
        });
      });

      const { data: storageFiles, error: storageError } = await supabase.storage.from('report-photos').list('', { limit: 5000 });
      if (storageError) throw storageError;

      let totalStorageSize = 0;
      storageFiles?.forEach(file => { totalStorageSize += file.metadata?.size || 0; });
      const orphaned = storageFiles?.filter(file => !usedFileNames.has(file.name)) || [];
      const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });

      setOrphanedFiles(orphaned);
      setStats(prev => ({
        ...prev,
        totalStorageCount: storageFiles?.length || 0,
        totalStorageSize,
        usedInDb: usedFileNames.size,
        orphaned: orphaned.length,
        dbRecordCount: reports?.length || 0,
        reportsToday,
        reportsThisMonth,
        photosToday,
        photosThisMonth,
        totalUsers: userCount || 0,
        dbSizeEstimate: totalChars * 2
      }));

    } catch (error: any) {
      showError("Gagal menganalisis sistem: " + error.message);
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const handleCleanupLogs = async () => {
    setLoading(true);
    try {
      await auditLogService.deleteOldLogs();
      showSuccess("Log aktivitas yang lebih dari seminggu telah dihapus");
      const logsData = await auditLogService.getLogs();
      setLogs(logsData);
    } catch (e: any) {
      showError("Gagal membersihkan log: " + (e.message || "Izin ditolak"));
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllLogs = async () => {
    if (!confirm("Hapus seluruh riwayat aktivitas? Tindakan ini tidak dapat dibatalkan.")) return;
    setLoading(true);
    try {
      await auditLogService.deleteAllLogs();
      showSuccess("Seluruh riwayat aktivitas telah dibersihkan");
      setLogs([]);
    } catch (e: any) {
      showError("Gagal membersihkan database: " + (e.message || "Izin ditolak"));
      const logsData = await auditLogService.getLogs();
      setLogs(logsData);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [logsData, delReports, delPlans] = await Promise.all([
        auditLogService.getLogs(),
        reportService.getAllReports('semua', true),
        workPlanService.getAllWorkPlans('semua', true)
      ]);
      setLogs(logsData);
      setDeletedReports(delReports);
      setDeletedWorkPlans(delPlans);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin && session) {
      showError("Akses ditolak.");
      navigate('/');
    } else if (isAdmin) {
      fetchData();
      analyzeSystem();
      loadLandingPhotos();
    }
  }, [isAdmin, session, fetchData, analyzeSystem, loadLandingPhotos, navigate]);

  const handleRestore = async (type: 'REPORT' | 'WORK_PLAN', id: string) => {
    try {
      if (type === 'REPORT') await reportService.restoreReport(id);
      else await workPlanService.restoreWorkPlan(id);
      showSuccess("Data berhasil dipulihkan");
      fetchData();
    } catch (e) {
      showError("Gagal memulihkan data");
    }
  };

  const handlePermanentDelete = async (type: 'REPORT' | 'WORK_PLAN', id: string) => {
    if (!confirm("Hapus permanen? Data tidak bisa dikembalikan lagi.")) return;
    try {
      if (type === 'REPORT') await reportService.hardDeleteReport(id);
      else await workPlanService.hardDeleteWorkPlan(id);
      showSuccess("Data dihapus permanen");
      fetchData();
    } catch (e) {
      showError("Gagal menghapus permanen");
    }
  };

  const handlePreview = (fileName: string) => {
    const { data } = supabase.storage.from('report-photos').getPublicUrl(fileName);
    setPreviewUrl(data.publicUrl);
    setPreviewName(fileName);
  };

  const cleanStorage = async () => {
    if (orphanedFiles.length === 0) return;
    if (!confirm(`Hapus ${orphanedFiles.length} file sampah? Tindakan ini tidak dapat dibatalkan.`)) return;
    setLoading(true);
    try {
      const fileNamesToDelete = orphanedFiles.map(f => f.name);
      const { error } = await supabase.storage.from('report-photos').remove(fileNamesToDelete);
      if (error) throw error;
      showSuccess(`${fileNamesToDelete.length} file berhasil dibersihkan.`);
      await analyzeSystem();
    } catch (error: any) {
      showError("Gagal membersihkan: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) return null;

  const storageUsagePercent = (stats.totalStorageSize / STORAGE_LIMIT) * 100;
  const dbUsagePercent = (stats.dbSizeEstimate / DB_LIMIT) * 100;
  const authUsagePercent = (stats.totalUsers / AUTH_LIMIT) * 100;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/')}><ArrowLeft className="mr-2 h-4 w-4" /> Kembali</Button>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Database className="text-blue-600" /> Pemeliharaan Sistem</h1>
          <div className="flex gap-2">
            <Button onClick={() => { fetchData(); analyzeSystem(); }} disabled={loading || analyzing} variant="outline" className="bg-white border-blue-200 text-blue-600">
              {loading || analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />} Refresh Analisis
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-white border-l-4 border-l-blue-600 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-2"><HardDrive size={14} /> File Storage</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xl font-black text-slate-900">{formatSize(stats.totalStorageSize)}</p>
              <Progress value={storageUsagePercent} className="h-1.5 mt-2" />
              <p className="text-[9px] text-slate-400 mt-1">Limit: 1 GB</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-l-4 border-l-purple-600 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-2"><Database size={14} /> Database</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xl font-black text-slate-900">{formatSize(stats.dbSizeEstimate)}</p>
              <Progress value={dbUsagePercent} className="h-1.5 mt-2" />
              <p className="text-[9px] text-slate-400 mt-1">Limit: 500 MB (Estimasi)</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-l-4 border-l-green-600 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-2"><Users size={14} /> Auth Users</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xl font-black text-slate-900">{stats.totalUsers}</p>
              <Progress value={authUsagePercent} className="h-1.5 mt-2" />
              <p className="text-[9px] text-slate-400 mt-1">Limit: 50.000 MAU</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-l-4 border-l-amber-500 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-2"><Globe size={14} /> Bandwidth</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xl font-black text-slate-900">Aktif</p>
              <div className="flex items-center gap-1 mt-2">
                <Activity size={12} className="text-green-500 animate-pulse" />
                <span className="text-[9px] font-bold text-green-600">SISTEM NORMAL</span>
              </div>
              <p className="text-[9px] text-slate-400 mt-1">Limit: 2 GB / Bulan</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="storage" className="w-full">
          <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
            <TabsList className="inline-flex w-full lg:grid lg:grid-cols-5 mb-8 h-12 bg-white border shadow-sm p-1 min-w-max">
              <TabsTrigger value="storage" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white flex items-center gap-2 px-6"><HardDrive size={16} /> Storage & File</TabsTrigger>
              <TabsTrigger value="landing" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white flex items-center gap-2 px-6"><Globe size={16} /> Halaman Depan</TabsTrigger>
              <TabsTrigger value="users" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white flex items-center gap-2 px-6"><Users size={16} /> Pengguna</TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white flex items-center gap-2 px-6"><History size={16} /> Riwayat</TabsTrigger>
              <TabsTrigger value="trash" className="data-[state=active]:bg-red-600 data-[state=active]:text-white flex items-center gap-2 px-6"><Trash2 size={16} /> Tempat Sampah</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="storage" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-white shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-700"><TrendingUp size={16} /> Aktivitas Hari Ini</CardTitle></CardHeader>
                <CardContent><div className="grid grid-cols-2 gap-4"><div><p className="text-[10px] font-bold uppercase text-slate-400">Laporan Baru</p><p className="text-2xl font-black text-slate-900">{stats.reportsToday}</p></div><div><p className="text-[10px] font-bold uppercase text-slate-400">Foto Diunggah</p><p className="text-2xl font-black text-slate-900">{stats.photosToday}</p></div></div></CardContent>
              </Card>
              <Card className="bg-white shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2 text-purple-700"><BarChart3 size={16} /> Aktivitas Bulan Ini</CardTitle></CardHeader>
                <CardContent><div className="grid grid-cols-2 gap-4"><div><p className="text-[10px] font-bold uppercase text-slate-400">Total Laporan</p><p className="text-2xl font-black text-slate-900">{stats.reportsThisMonth}</p></div><div><p className="text-[10px] font-bold uppercase text-slate-400">Total Foto</p><p className="text-2xl font-black text-slate-900">{stats.photosThisMonth}</p></div></div></CardContent>
              </Card>
              <Card className="bg-white shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2 text-orange-700"><Cpu size={16} /> Edge Functions</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center text-xs"><span className="text-slate-500">Status:</span><Badge className="bg-green-100 text-green-700 text-[9px]">OPERASIONAL</Badge></div>
                  <div className="flex justify-between items-center text-xs mt-2"><span className="text-slate-500">Limit:</span><span className="font-bold">500k / bln</span></div>
                  <p className="text-[8px] text-slate-400 mt-2 italic">* Digunakan untuk fitur Google Drive</p>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-md border-t-4 border-t-blue-600">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><ShieldAlert className="text-amber-500" /> Analisis Keamanan Storage</CardTitle>
                <p className="text-xs text-slate-500">Sistem membandingkan file di Storage dengan data di Database. File yang tidak memiliki referensi di database dianggap sebagai file sampah.</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-wrap gap-3">
                  <Button onClick={analyzeSystem} disabled={analyzing || loading} className="bg-blue-600">{analyzing ? "Menganalisis..." : "Mulai Analisis Ulang"}</Button>
                  {orphanedFiles.length > 0 && <Button onClick={cleanStorage} disabled={loading} variant="destructive">Hapus {orphanedFiles.length} File Sampah</Button>}
                </div>

                {orphanedFiles.length > 0 ? (
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start gap-3 text-amber-800 text-xs">
                      <Info className="h-4 w-4 mt-0.5 shrink-0" />
                      <p>Ditemukan <strong>{orphanedFiles.length} file sampah</strong>. File ini biasanya berasal dari foto yang diganti saat edit laporan atau laporan yang dihapus permanen.</p>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto border rounded-lg divide-y bg-slate-50">
                      {orphanedFiles.map((file, i) => (
                        <div 
                          key={i} 
                          className="p-3 flex items-center justify-between text-xs hover:bg-blue-50 cursor-pointer transition-colors group"
                          onClick={() => handlePreview(file.name)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 bg-slate-200 rounded flex items-center justify-center text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-500">
                              <Eye size={14} />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-700">{file.name}</span>
                              <span className="text-[10px] text-slate-400">Klik untuk preview</span>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px]">{formatSize(file.metadata?.size || 0)}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : !analyzing && (
                  <div className="py-10 text-center border-2 border-dashed rounded-xl">
                    <Zap className="mx-auto h-8 w-8 text-green-500 mb-2" />
                    <p className="text-sm font-bold text-slate-600">Storage Bersih!</p>
                    <p className="text-xs text-slate-400">Tidak ditemukan file sampah di sistem.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="landing">
            <Card className="border-t-4 border-t-emerald-600 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><Globe className="text-emerald-600" /> Foto Pimpinan Halaman Depan</CardTitle>
                <p className="text-xs leading-relaxed text-slate-500">Foto di sini tersimpan aman pada Storage internal. Klik foto untuk mengganti, lalu tekan Simpan Perubahan. Menghapus foto dan menyimpan akan memakai foto cadangan.</p>
              </CardHeader>
              <CardContent>
                <div className="mb-6 max-w-2xl rounded-2xl border bg-slate-50 p-3">
                  <ImageUpload label={landingHeroProfile.label} value={landingPhotoDrafts.hero} onChange={(value) => setLandingPhotoDrafts((current) => ({ ...current, hero: value }))} disabled={landingPhotoSaving === 'hero'} aspectClassName="aspect-[16/7]" />
                  <Button className="mt-3 w-full bg-emerald-600 hover:bg-emerald-700" disabled={landingPhotoSaving === 'hero' || landingPhotoDrafts.hero.startsWith('http')} onClick={() => handleSaveLandingPhoto('hero')}>
                    {landingPhotoSaving === 'hero' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</> : 'Simpan Foto Latar'}
                  </Button>
                  <p className="mt-2 text-center text-[11px] text-slate-500">Saran: gunakan foto horizontal dengan rasio 16:7 dan tanpa teks agar judul beranda tetap rapi.</p>
                </div>
                <div className="grid gap-6 sm:grid-cols-3">
                  {landingProfiles.map((profileInfo) => {
                    const isSavingPhoto = landingPhotoSaving === profileInfo.slot;
                    const canSave = !landingPhotoDrafts[profileInfo.slot].startsWith('http');
                    return (
                      <div key={profileInfo.slot} className="space-y-3 rounded-2xl border bg-slate-50 p-3">
                        <ImageUpload label={profileInfo.label} value={landingPhotoDrafts[profileInfo.slot]} onChange={(value) => setLandingPhotoDrafts((current) => ({ ...current, [profileInfo.slot]: value }))} disabled={isSavingPhoto} />
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={isSavingPhoto || !canSave} onClick={() => handleSaveLandingPhoto(profileInfo.slot)}>
                          {isSavingPhoto ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</> : 'Simpan Perubahan'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users"><Card className="shadow-md border-t-4 border-t-blue-600"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Users className="text-blue-600" /> Manajemen Pengguna</CardTitle></CardHeader><CardContent><UserManagement /></CardContent></Card></TabsContent>

          <TabsContent value="history">
            <Card className="shadow-md border-t-4 border-t-blue-600">
              <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle className="text-lg flex items-center gap-2"><History className="text-blue-600" /> Riwayat Aktivitas Pengguna</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleCleanupLogs} 
                    disabled={loading}
                    className="text-amber-600 border-amber-200 hover:bg-amber-50"
                  >
                    <Eraser className="h-4 w-4 mr-2" /> Bersihkan Log {'>'} 7 Hari
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={handleClearAllLogs} 
                    disabled={loading}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Bersihkan Semua Log
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Waktu</th>
                        <th className="px-4 py-3">Pengguna</th>
                        <th className="px-4 py-3">Aksi</th>
                        <th className="px-4 py-3">Entitas</th>
                        <th className="px-4 py-3">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {logs.length > 0 ? logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 text-[11px] text-slate-500 whitespace-nowrap">{format(new Date(log.created_at), 'dd MMM, HH:mm', { locale: localeId })}</td>
                          <td className="px-4 py-3 font-medium">{log.username || "System"}</td>
                          <td className="px-4 py-3">
                            <Badge className={cn(
                              "text-[9px] font-bold",
                              log.action === 'DELETE' ? "bg-red-100 text-red-700" : 
                              log.action === 'UPDATE' ? "bg-amber-100 text-amber-700" : 
                              "bg-green-100 text-green-700"
                            )}>
                              {log.action}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600">
                              {log.entity_type === 'REPORT' ? <FileText size={12} className="text-blue-500" /> : <ClipboardList size={12} className="text-green-500" />}
                              {log.entity_type}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[11px] text-slate-600 italic">{log.details?.title || log.details?.description || "-"}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400 italic">Belum ada riwayat aktivitas</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trash">
            <div className="space-y-6">
              <Card className="shadow-md border-t-4 border-t-red-600">
                <CardHeader><CardTitle className="text-lg flex items-center gap-2 text-red-700"><FileText size={20} /> Laporan Terhapus</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Tanggal Laporan</th>
                          <th className="px-4 py-3">Uraian</th>
                          <th className="px-4 py-3">Kategori</th>
                          <th className="px-4 py-3 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {deletedReports.length > 0 ? deletedReports.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3">{r.date}</td>
                            <td className="px-4 py-3 font-medium">{r.description}</td>
                            <td className="px-4 py-3"><Badge variant="outline">{r.category}</Badge></td>
                            <td className="px-4 py-3 text-right space-x-2">
                              <Button size="sm" variant="outline" className="text-green-600 border-green-200" onClick={() => handleRestore('REPORT', r.id)}><RotateCcw size={14} className="mr-1" /> Pulihkan</Button>
                              <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handlePermanentDelete('REPORT', r.id)}><Trash2 size={14} /></Button>
                            </td>
                          </tr>
                        )) : (
                          <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400 italic">Tempat sampah laporan kosong</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-md border-t-4 border-t-red-600">
                <CardHeader><CardTitle className="text-lg flex items-center gap-2 text-red-700"><ClipboardList size={20} /> Rencana Kerja Terhapus</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Tanggal Rencana</th>
                          <th className="px-4 py-3">Kategori</th>
                          <th className="px-4 py-3">Jumlah Lokasi</th>
                          <th className="px-4 py-3 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {deletedWorkPlans.length > 0 ? deletedWorkPlans.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3">{p.date}</td>
                            <td className="px-4 py-3 font-medium">{p.category}</td>
                            <td className="px-4 py-3">{p.items?.length || 0} Lokasi</td>
                            <td className="px-4 py-3 text-right space-x-2">
                              <Button size="sm" variant="outline" className="text-green-600 border-green-200" onClick={() => handleRestore('WORK_PLAN', p.id)}><RotateCcw size={14} className="mr-1" /> Pulihkan</Button>
                              <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handlePermanentDelete('WORK_PLAN', p.id)}><Trash2 size={14} /></Button>
                            </td>
                          </tr>
                        )) : (
                          <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400 italic">Tempat sampah rencana kerja kosong</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-black/95 border-none">
          <DialogHeader className="p-4 bg-white/10 backdrop-blur text-white flex flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-sm font-medium truncate pr-4">{previewName}</DialogTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => setPreviewUrl(null)}>
              <X size={18} />
            </Button>
          </DialogHeader>
          <div className="aspect-square w-full flex items-center justify-center p-4">
            {previewUrl && (
              <img 
                src={previewUrl} 
                alt="Preview" 
                className="max-w-full max-h-full object-contain shadow-2xl rounded-sm"
              />
            )}
          </div>
          <div className="p-4 bg-white/10 backdrop-blur text-center">
            <p className="text-[10px] text-white/60 uppercase font-bold tracking-widest">Verifikasi File Sampah</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Maintenance;
