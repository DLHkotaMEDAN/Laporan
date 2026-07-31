"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  User, Shield, Tag, Trash2, Search, Loader2, AlertCircle, RefreshCw, Clock, Mail, KeyRound
} from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from "@/lib/utils";
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

const accessOptions = [
  { value: 'admin', label: 'Super Admin / Administrator' },
  { value: 'admin_wilayah', label: 'Admin Wilayah (Laporan & Rencana Kerja)' },
  { value: 'admin_harian', label: 'Admin Laporan Harian' },
  { value: 'admin_rencana_kerja', label: 'Admin Rencana Kerja' },
  { value: 'admin_bbm', label: 'Admin BBM' },
  { value: 'admin_spj_bbm', label: 'Admin SPJ BBM' },
  { value: 'pimpinan', label: 'Pimpinan (Lihat Rekap)' },
  { value: 'user', label: 'Pengguna Tim' },
];

const categories = ["Taman Kota", "Taman Amplas", "Taman Area", "Tim Babat", "Tim Siram", "Tim Pohon"];

interface Profile {
  id: string;
  username: string | null;
  role: string;
  category: string | null;
  updated_at: string;
}

interface Region {
  id: string;
  name: string;
}

const UserManagement = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: 'admin_wilayah', regionId: '' });

  useEffect(() => {
    fetchProfiles();
    fetchRegions();
  }, []);

  const fetchRegions = async () => {
    const { data, error } = await supabase.from('regions').select('id, name').eq('is_active', true).order('sort_order');
    if (error) {
      showError('Gagal memuat wilayah: ' + error.message);
      return;
    }
    setRegions(data || []);
  };

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          username: newUser.username,
          email: newUser.email,
          password: newUser.password,
          role: newUser.role,
          regionId: ['admin_wilayah', 'admin_harian', 'admin_rencana_kerja'].includes(newUser.role) ? newUser.regionId : null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      showSuccess('Akun aktif berhasil dibuat tanpa konfirmasi email');
      setProfiles(currentProfiles => [
        {
          id: data.id,
          username: newUser.username.trim(),
          role: newUser.role,
          category: null,
          updated_at: new Date().toISOString(),
        },
        ...currentProfiles.filter(profile => profile.id !== data.id),
      ]);
      setNewUser({ username: '', email: '', password: '', role: 'admin_wilayah', regionId: '' });
      await fetchProfiles();
    } catch (error: any) {
      showError('Gagal membuat akun: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setProfiles(data || []);
    } catch (error: any) {
      showError("Gagal memuat daftar pengguna: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (id: string, updates: Partial<Profile>) => {
    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      
      setProfiles(profiles.map(p => p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p));
      showSuccess("Profil berhasil diperbarui");
    } catch (error: any) {
      showError("Gagal memperbarui profil: " + error.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteProfile = async (id: string, username: string) => {
    if (!confirm(`Hapus profil "${username}"? Pengguna ini tidak akan bisa mengakses fitur khusus role lagi.`)) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setProfiles(profiles.filter(p => p.id !== id));
      showSuccess("Profil dihapus");
    } catch (error: any) {
      showError("Gagal menghapus profil: " + error.message);
    }
  };

  const handleResetPassword = async (profile: Profile) => {
    const password = window.prompt(`Masukkan password baru untuk ${profile.username || 'pengguna'} (minimal 8 karakter):`);
    if (password === null) return;
    if (password.length < 8) {
      showError('Password minimal 8 karakter.');
      return;
    }

    setUpdatingId(profile.id);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { action: 'reset-password', userId: profile.id, password },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      showSuccess(`Password ${profile.username || 'pengguna'} berhasil diubah.`);
      await fetchProfiles();
    } catch (error: any) {
      showError('Gagal mengubah password: ' + error.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredProfiles = profiles.filter(p => 
    (p.username?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
    (p.role?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );

  if (loading && profiles.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      <p className="text-slate-500 font-medium">Memuat data pengguna...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreateUser} className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
        <div>
          <h3 className="font-bold text-blue-950">Buat Akun Baru</h3>
          <p className="text-xs text-blue-700">Akun langsung aktif dan tidak memerlukan konfirmasi email.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          <Input required placeholder="Nama pengguna" value={newUser.username} onChange={event => setNewUser({ ...newUser, username: event.target.value })} />
          <Input required type="email" placeholder="Email" value={newUser.email} onChange={event => setNewUser({ ...newUser, email: event.target.value })} />
          <Input required minLength={8} type="password" placeholder="Password minimal 8 karakter" value={newUser.password} onChange={event => setNewUser({ ...newUser, password: event.target.value })} />
          <Select value={newUser.role} onValueChange={role => setNewUser({ ...newUser, role })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{accessOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={newUser.regionId} onValueChange={regionId => setNewUser({ ...newUser, regionId })} disabled={!['admin_wilayah', 'admin_harian', 'admin_rencana_kerja'].includes(newUser.role)}>
            <SelectTrigger><SelectValue placeholder="Pilih wilayah" /></SelectTrigger>
            <SelectContent>{regions.map(region => <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={creating || (['admin_wilayah', 'admin_harian', 'admin_rencana_kerja'].includes(newUser.role) && !newUser.regionId)}>{creating ? 'Membuat akun...' : 'Buat Akun Aktif'}</Button>
      </form>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Cari username atau role..." 
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={fetchProfiles} 
            disabled={loading}
            className="shrink-0"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 h-9 px-4">
          Total: {profiles.length} Pengguna Terdaftar
        </Badge>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-[200px]">Username / Email</TableHead>
                <TableHead className="w-[220px]">Hak Akses</TableHead>
                <TableHead className="w-[220px]">Kategori (Khusus User)</TableHead>
                <TableHead className="w-[180px]">Update Terakhir</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProfiles.length > 0 ? (
                filteredProfiles.map((profile) => (
                  <TableRow key={profile.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                          <User size={16} />
                        </div>
                        <div className="flex flex-col">
                          <span className="truncate max-w-[150px] font-bold">{profile.username || "Tanpa Nama"}</span>
                          <span className="text-[9px] text-slate-400 flex items-center gap-1"><Mail size={10} /> {profile.id.substring(0, 8)}...</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={profile.role} 
                        onValueChange={(val) => handleUpdateProfile(profile.id, { role: val })}
                        disabled={updatingId === profile.id}
                      >
                        <SelectTrigger className={cn(
                          "h-9 text-[10px] font-bold uppercase",
                          profile.role === 'admin' ? "text-red-600 border-red-200 bg-red-50" :
                          profile.role === 'pimpinan' ? "text-amber-600 border-amber-200 bg-amber-50" :
                          profile.role === 'admin_harian' ? "text-purple-600 border-purple-200 bg-purple-50" :
                          profile.role === 'admin_bbm' ? "text-orange-600 border-orange-200 bg-orange-50" :
                          profile.role === 'admin_spj_bbm' ? "text-blue-800 border-blue-300 bg-blue-100" :
                          "text-blue-600 border-blue-200 bg-blue-50"
                        )}>
                          <div className="flex items-center gap-2">
                            <Shield size={12} />
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {accessOptions.map(option => <SelectItem key={option.value} value={option.value} className="text-xs font-bold">{option.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={profile.category || "none"} 
                        onValueChange={(val) => handleUpdateProfile(profile.id, { category: val === "none" ? null : val })}
                        disabled={updatingId === profile.id || profile.role !== 'user'}
                      >
                        <SelectTrigger className={cn(
                          "h-9 text-xs",
                          !profile.category && "text-slate-400 italic"
                        )}>
                          <div className="flex items-center gap-2">
                            <Tag size={12} />
                            <SelectValue placeholder="Pilih Kategori" />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Tanpa Kategori</SelectItem>
                          {categories.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <Clock size={12} />
                        {profile.updated_at ? format(new Date(profile.updated_at), 'dd MMM yyyy, HH:mm', { locale: localeId }) : '-'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                        disabled={updatingId === profile.id}
                        title="Ubah password"
                        onClick={() => handleResetPassword(profile)}
                      >
                        <KeyRound size={17} />
                      </Button>
                      <Button
                        variant="ghost" 
                        size="icon" 
                        className="text-red-400 hover:text-red-600 hover:bg-red-50"
                        disabled={updatingId === profile.id}
                        onClick={() => handleDeleteProfile(profile.id, profile.username || "User")}
                      >
                        <Trash2 size={18} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-slate-400 italic">
                    Tidak ada pengguna ditemukan.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
