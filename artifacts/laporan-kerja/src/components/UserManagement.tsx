"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { auditLogService } from '@/services/auditLogService';
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
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { 
  User, Shield, Tag, Trash2, Search, Loader2, AlertCircle, RefreshCw, Clock, Mail, KeyRound, Pencil, Eye, Power, PowerOff
} from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from "@/lib/utils";
import { useAuth } from '@/context/AuthContext';
import { useValueDraft } from '@/hooks/useFormDraft';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import {
  ACCESS_OPTIONS,
  USER_ROLES,
  UserRole,
  getRoleBadgeClass,
  roleRequiresRegion,
  roleRequiresTeam,
  isGlobalFuelAdmin,
  isCategoryScopedWorkPlanAdmin,
  isSpjOliAdmin,
  roleCanSelectRegion,
} from '@/constants/access-control';

const toggleWorkPlanCategory = (selected: string[], category: string) => (
  selected.includes(category)
    ? selected.filter((item) => item !== category)
    : [...selected, category]
);

interface Profile {
  id: string;
  username: string | null;
  email?: string | null;
  role: UserRole;
  category: string | null;
  work_plan_categories: string[] | null;
  region_id: string | null;
  team_id: string | null;
  is_active: boolean;
  updated_at: string;
}

interface Region {
  id: string;
  name: string;
}

interface Team {
  id: string;
  region_id: string;
  name: string;
}

interface UserFormState {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  regionId: string;
  teamId: string;
  workPlanCategories: string[];
}

interface EditUserFormState {
  username: string;
  role: UserRole;
  regionId: string;
  teamId: string;
  workPlanCategories: string[];
}

/**
 * Supabase wraps every non-2xx Edge Function response in a generic
 * FunctionsHttpError. The function still sends a useful `{ error: string }`
 * body, so read it before showing the toast to the administrator.
 */
const getEdgeFunctionErrorMessage = async (error: unknown) => {
  const functionError = error as Error & { context?: unknown };
  const response = functionError?.context;

  if (response instanceof Response) {
    const payload = await response.clone().json().catch(() => null) as { error?: unknown; message?: unknown } | null;
    if (typeof payload?.error === 'string') return payload.error;
    if (typeof payload?.message === 'string') return payload.message;
  }

  return error instanceof Error ? error.message : 'Terjadi kesalahan saat menghubungi layanan akun.';
};

const UserManagement = () => {
  const { profile: currentProfile, session } = useAuth();
  const canMutateUsers = currentProfile?.is_active !== false && (currentProfile?.role === 'admin' || session?.user?.email === 'admin@gmail.com');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState<UserFormState>({ username: '', email: '', password: '', role: USER_ROLES.ADMIN_WILAYAH, regionId: '', teamId: '', workPlanCategories: [] });
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editUser, setEditUser] = useState<EditUserFormState>({ username: '', role: USER_ROLES.USER, regionId: '', teamId: '', workPlanCategories: [] });
  const [viewingProfile, setViewingProfile] = useState<Profile | null>(null);
  const [accountDetails, setAccountDetails] = useState<{ email?: string; createdAt?: string; lastSignInAt?: string | null; emailConfirmedAt?: string | null } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const newUserDraftKey = session?.user?.id ? `user-management:${session.user.id}:new` : undefined;
  const { clearDraft: clearNewUserDraft, lastSavedAt: newUserLastSavedAt, restoredAt: newUserRestoredAt } = useValueDraft(newUser, setNewUser, newUserDraftKey);
  const editUserDraftKey = session?.user?.id && editingProfile
    ? `user-management:${session.user.id}:edit:${editingProfile.id}`
    : undefined;
  const { clearDraft: clearEditUserDraft, lastSavedAt: editUserLastSavedAt, restoredAt: editUserRestoredAt } = useValueDraft(editUser, setEditUser, editUserDraftKey);
  const workPlanCategories = Array.from(new Set(teams.map((team) => team.name))).sort((first, second) => first.localeCompare(second));

  useEffect(() => {
    if (newUserRestoredAt || editUserRestoredAt) showSuccess('Draft data pengguna sebelumnya dipulihkan.');
  }, [newUserRestoredAt, editUserRestoredAt]);

  useEffect(() => {
    fetchProfiles();
    fetchRegions();
    fetchTeams();
  }, []);

  const fetchRegions = async () => {
    const { data, error } = await supabase.from('regions').select('id, name').eq('is_active', true).order('sort_order');
    if (error) {
      showError('Gagal memuat wilayah: ' + error.message);
      return;
    }
    setRegions(data || []);
  };

  const fetchTeams = async () => {
    const { data, error } = await supabase.from('teams').select('id, region_id, name').eq('is_active', true).order('name');
    if (error) {
      showError('Gagal memuat tim: ' + error.message);
      return;
    }
    setTeams(data || []);
  };

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canMutateUsers) { showError('Akun nonaktif hanya dapat melihat data.'); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          username: newUser.username,
          email: newUser.email,
          password: newUser.password,
          role: newUser.role,
          regionId: roleCanSelectRegion(newUser.role) ? newUser.regionId || null : null,
          teamId: roleRequiresTeam(newUser.role) ? newUser.teamId : null,
          workPlanCategories: isCategoryScopedWorkPlanAdmin(newUser.role) ? newUser.workPlanCategories : [],
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      void auditLogService.logCurrentUser({ action: 'CREATE', entityType: 'PROFILE', entityId: data.id, details: { username: newUser.username.trim(), email: data.email || newUser.email.trim().toLowerCase(), role: newUser.role } });
      showSuccess('Akun aktif berhasil dibuat tanpa konfirmasi email');
      await clearNewUserDraft();
      setProfiles(currentProfiles => [
        {
          id: data.id,
          username: newUser.username.trim(),
          email: data.email || newUser.email.trim().toLowerCase(),
          role: newUser.role,
          category: null,
          work_plan_categories: isCategoryScopedWorkPlanAdmin(newUser.role) ? newUser.workPlanCategories : [],
          region_id: roleCanSelectRegion(newUser.role) ? newUser.regionId || null : null,
          team_id: roleRequiresTeam(newUser.role) ? newUser.teamId || null : null,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        ...currentProfiles.filter(profile => profile.id !== data.id),
      ]);
      setNewUser({ username: '', email: '', password: '', role: USER_ROLES.ADMIN_WILAYAH, regionId: '', teamId: '', workPlanCategories: [] });
      await fetchProfiles();
    } catch (error: unknown) {
      showError('Gagal membuat akun: ' + await getEdgeFunctionErrorMessage(error));
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
      const { data: accountData, error: accountError } = await supabase.functions.invoke('create-user', {
        body: { action: 'list-user-emails' },
      });
      let accounts: { id: string; email?: string }[] = accountData?.users || [];

      // Fallback for an already-deployed function that predates list-user-emails.
      // It keeps the table usable and still obtains the email through the existing
      // per-account admin endpoint until the function is redeployed.
      if (accountError || accountData?.error) {
        const accountDetails = await Promise.all((data || []).map(async profile => {
          const { data: detail } = await supabase.functions.invoke('create-user', {
            body: { action: 'get-user-details', userId: profile.id },
          });
          return detail?.id && detail?.email ? { id: detail.id, email: detail.email } : null;
        }));
        accounts = accountDetails.filter((account): account is { id: string; email: string } => account !== null);
      }

      const emailsByUserId = new Map<string, string>(
        accounts
          .filter((account): account is { id: string; email: string } => Boolean(account.id && account.email))
          .map(account => [account.id, account.email]),
      );
      setProfiles((data || []).map(profile => ({ ...profile, email: emailsByUserId.get(profile.id) || null })));
    } catch (error: any) {
      showError("Gagal memuat daftar pengguna: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (id: string, updates: Partial<Profile>) => {
    if (!canMutateUsers) { showError('Akun nonaktif tidak dapat mengubah data pengguna.'); return; }
    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      void auditLogService.logCurrentUser({ action: 'UPDATE', entityType: 'PROFILE', entityId: id, details: { fields: Object.keys(updates) } });
      
      setProfiles(profiles.map(p => p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p));
      showSuccess("Profil berhasil diperbarui");
    } catch (error: any) {
      showError("Gagal memperbarui profil: " + error.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteProfile = async (id: string, username: string) => {
    if (!canMutateUsers) { showError('Akun nonaktif tidak dapat menghapus pengguna.'); return; }
    if (!confirm(`Hapus profil "${username}"? Pengguna ini tidak akan bisa mengakses fitur khusus role lagi.`)) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      void auditLogService.logCurrentUser({ action: 'DELETE', entityType: 'PROFILE', entityId: id, details: { username } });
      
      setProfiles(profiles.filter(p => p.id !== id));
      showSuccess("Profil dihapus");
    } catch (error: any) {
      showError("Gagal menghapus profil: " + error.message);
    }
  };

  const handleToggleActive = async (profile: Profile) => {
    if (!canMutateUsers) { showError('Akun nonaktif tidak dapat mengubah status pengguna.'); return; }
    const nextIsActive = profile.is_active === false;
    const actionLabel = nextIsActive ? 'mengaktifkan' : 'menonaktifkan';
    if (!confirm(`Yakin ingin ${actionLabel} akun "${profile.username || 'Pengguna'}"?`)) return;

    setUpdatingId(profile.id);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { action: 'set-user-active', userId: profile.id, isActive: nextIsActive },
      });
      if (error || data?.error) {
        // Fallback untuk Edge Function yang belum dideploy ulang.
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ is_active: nextIsActive, updated_at: new Date().toISOString() })
          .eq('id', profile.id);
        if (profileError) throw new Error(profileError.message || data?.error || error?.message);
      }

      setProfiles(currentProfiles => currentProfiles.map(item => item.id === profile.id
        ? { ...item, is_active: nextIsActive, updated_at: new Date().toISOString() }
        : item));
      showSuccess(nextIsActive ? 'Akun berhasil diaktifkan.' : 'Akun berhasil dinonaktifkan.');
      void auditLogService.logCurrentUser({ action: 'UPDATE', entityType: 'PROFILE', entityId: profile.id, details: { username: profile.username, field: 'is_active', value: nextIsActive } });
    } catch (error: any) {
      const message = error?.message || 'Kolom status akun belum tersedia di database.';
      showError('Gagal mengubah status akun: ' + message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleResetPassword = async (profile: Profile) => {
    if (!canMutateUsers) { showError('Akun nonaktif tidak dapat mengubah password.'); return; }
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
      void auditLogService.logCurrentUser({ action: 'UPDATE', entityType: 'PROFILE', entityId: profile.id, details: { username: profile.username, field: 'password' } });
      showSuccess(`Password ${profile.username || 'pengguna'} berhasil diubah.`);
      await fetchProfiles();
    } catch (error: any) {
      showError('Gagal mengubah password: ' + error.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const openEditProfile = (profile: Profile) => {
    setEditingProfile(profile);
    setEditUser({
      username: profile.username || '',
      role: profile.role,
      regionId: profile.region_id || '',
      teamId: profile.team_id || '',
      workPlanCategories: profile.work_plan_categories || [],
    });
  };

  const handleSaveProfile = async () => {
    if (!canMutateUsers) { showError('Akun nonaktif tidak dapat mengubah data pengguna.'); return; }
    if (!editingProfile) return;
    const requiresRegion = roleRequiresRegion(editUser.role);
    const canSelectRegion = roleCanSelectRegion(editUser.role);
    if (!editUser.username.trim()) {
      showError('Nama pengguna wajib diisi.');
      return;
    }
    if (requiresRegion && !editUser.regionId) {
      showError('Akun berbasis wilayah wajib memilih wilayah.');
      return;
    }
    if (roleRequiresTeam(editUser.role) && !editUser.teamId) {
      showError('Pengguna tim wajib memilih tim.');
      return;
    }
    if (isCategoryScopedWorkPlanAdmin(editUser.role) && editUser.workPlanCategories.length === 0) {
      showError('Pilih minimal satu kategori untuk Admin Rencana Kerja.');
      return;
    }

    const updates = {
      username: editUser.username.trim(),
      role: editUser.role,
      region_id: canSelectRegion ? editUser.regionId || null : null,
      team_id: roleRequiresTeam(editUser.role) ? editUser.teamId : null,
      work_plan_categories: isCategoryScopedWorkPlanAdmin(editUser.role) ? editUser.workPlanCategories : [],
    };

    setUpdatingId(editingProfile.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', editingProfile.id);
      if (error) throw error;
      void auditLogService.logCurrentUser({ action: 'UPDATE', entityType: 'PROFILE', entityId: editingProfile.id, details: { username: updates.username, role: updates.role, fields: Object.keys(updates) } });

      setProfiles(currentProfiles => currentProfiles.map(profile =>
        profile.id === editingProfile.id
          ? { ...profile, ...updates, updated_at: new Date().toISOString() }
          : profile,
      ));
      await clearEditUserDraft();
      setEditingProfile(null);
      showSuccess('Data pengguna berhasil diperbarui.');
    } catch (error: any) {
      showError('Gagal memperbarui pengguna: ' + error.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleViewDetails = async (profile: Profile) => {
    setViewingProfile(profile);
    setAccountDetails(null);
    setLoadingDetails(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { action: 'get-user-details', userId: profile.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAccountDetails(data);
    } catch (error: any) {
      showError('Gagal memuat detail akun: ' + error.message);
    } finally {
      setLoadingDetails(false);
    }
  };

  const filteredProfiles = profiles.filter(p =>
    (p.username?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
    (p.email?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
    (p.role?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );

  const getRegionName = (regionId?: string | null) =>
    regions.find(region => region.id === regionId)?.name || 'Belum pilih wilayah';

  if (loading && profiles.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      <p className="text-slate-500 font-medium">Memuat data pengguna...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreateUser} className={cn("rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3", !canMutateUsers && "opacity-60")}>
        <div>
          <h3 className="font-bold text-blue-950">Buat Akun Baru <span className="ml-2 text-[10px] font-normal text-blue-700">{newUserLastSavedAt ? 'Draft tersimpan' : 'Draft akan tersimpan otomatis'}</span></h3>
          <p className="text-xs text-blue-700">Akun langsung aktif dan tidak memerlukan konfirmasi email.</p>
        </div>
        <div className={cn("grid items-end gap-3", roleRequiresTeam(newUser.role) ? "md:grid-cols-6" : "md:grid-cols-5")}>
          <div className="min-w-0 space-y-1.5">
            <label htmlFor="new-user-username" className="text-xs font-semibold text-blue-900">Nama pengguna</label>
            <Input id="new-user-username" required disabled={!canMutateUsers} placeholder="Masukkan nama pengguna" value={newUser.username} onChange={event => setNewUser({ ...newUser, username: event.target.value })} />
          </div>
          <div className="min-w-0 space-y-1.5">
            <label htmlFor="new-user-email" className="text-xs font-semibold text-blue-900">Email</label>
            <Input id="new-user-email" required disabled={!canMutateUsers} type="email" placeholder="nama@contoh.com" value={newUser.email} onChange={event => setNewUser({ ...newUser, email: event.target.value })} />
          </div>
          <div className="min-w-0 space-y-1.5">
            <label htmlFor="new-user-password" className="text-xs font-semibold text-blue-900">Password</label>
            <Input id="new-user-password" required disabled={!canMutateUsers} minLength={8} type="password" placeholder="Minimal 8 karakter" value={newUser.password} onChange={event => setNewUser({ ...newUser, password: event.target.value })} />
          </div>
          <div className="min-w-0 space-y-1.5">
            <label className="text-xs font-semibold text-blue-900">Hak akses</label>
            <Select value={newUser.role} onValueChange={role => setNewUser({
              ...newUser,
              role: role as UserRole,
              regionId: roleCanSelectRegion(role) ? newUser.regionId : '',
              teamId: '',
              workPlanCategories: isCategoryScopedWorkPlanAdmin(role) ? newUser.workPlanCategories : [],
            })} disabled={!canMutateUsers}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{ACCESS_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-1.5">
            <label className="text-xs font-semibold text-blue-900">Cakupan wilayah</label>
            <Select value={isGlobalFuelAdmin(newUser.role) ? 'all' : newUser.regionId || (isSpjOliAdmin(newUser.role) ? 'all' : '')} onValueChange={regionId => setNewUser({ ...newUser, regionId: regionId === 'all' ? '' : regionId, teamId: '' })} disabled={!canMutateUsers || isGlobalFuelAdmin(newUser.role) || !roleCanSelectRegion(newUser.role)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Pilih wilayah" /></SelectTrigger>
              <SelectContent>
                {(isGlobalFuelAdmin(newUser.role) || isSpjOliAdmin(newUser.role)) && <SelectItem value="all">Semua Wilayah</SelectItem>}
                {regions.map(region => <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isCategoryScopedWorkPlanAdmin(newUser.role) && (
            <div className="min-w-0 space-y-2 md:col-span-2">
              <label className="text-xs font-semibold text-blue-900">Kategori rencana kerja yang dapat dikerjakan</label>
              <div className="grid grid-cols-2 gap-2 rounded-md border border-blue-200 bg-white p-3 sm:grid-cols-3">
                {workPlanCategories.map((category) => <label key={category} className="flex cursor-pointer items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={newUser.workPlanCategories.includes(category)} onChange={() => setNewUser({ ...newUser, workPlanCategories: toggleWorkPlanCategory(newUser.workPlanCategories, category) })} disabled={!canMutateUsers} />{category}</label>)}
              </div>
              <p className="text-[11px] text-blue-700">Pilih satu atau lebih kategori. Akun ini tetap dapat mengakses semua wilayah.</p>
            </div>
          )}
          {roleRequiresTeam(newUser.role) && (
            <div className="min-w-0 space-y-1.5">
              <label className="text-xs font-semibold text-blue-900">Tim</label>
              <Select value={newUser.teamId} onValueChange={teamId => setNewUser({ ...newUser, teamId })} disabled={!canMutateUsers || !newUser.regionId}>
                <SelectTrigger className="w-full"><SelectValue placeholder={newUser.regionId ? "Pilih tim" : "Pilih wilayah dahulu"} /></SelectTrigger>
                <SelectContent>{teams.filter(team => team.region_id === newUser.regionId).length > 0 ? teams.filter(team => team.region_id === newUser.regionId).map(team => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>) : <SelectItem value="no-team" disabled>Belum ada tim aktif untuk wilayah ini</SelectItem>}</SelectContent>
              </Select>
            </div>
          )}
        </div>
        <Button type="submit" disabled={!canMutateUsers || creating || (roleRequiresRegion(newUser.role) && !newUser.regionId) || (roleRequiresTeam(newUser.role) && !newUser.teamId) || (isCategoryScopedWorkPlanAdmin(newUser.role) && newUser.workPlanCategories.length === 0)}>{creating ? 'Membuat akun...' : 'Buat Akun Aktif'}</Button>
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
                <TableHead className="w-[260px]">Username / Email</TableHead>
                <TableHead className="w-[220px]">Hak Akses</TableHead>
                <TableHead className="w-[240px]">Wilayah / Kategori</TableHead>
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
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-[150px] font-bold">{profile.username || "Tanpa Nama"}</span>
                            <Badge variant="outline" className={cn("px-1.5 py-0 text-[9px]", profile.is_active === false ? "border-slate-300 bg-slate-100 text-slate-500" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>
                              {profile.is_active === false ? 'Nonaktif' : 'Aktif'}
                            </Badge>
                          </div>
                          <span title={profile.email || 'Email tidak tersedia'} className="max-w-[220px] truncate text-[10px] text-slate-500 flex items-center gap-1"><Mail size={10} className="shrink-0" /> {profile.email || 'Email tidak tersedia'}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={profile.role} 
                        onValueChange={(val) => {
                          const role = val as UserRole;
                          void handleUpdateProfile(profile.id, {
                            role,
                            region_id: roleCanSelectRegion(role) ? profile.region_id : null,
                            team_id: roleRequiresTeam(role) ? profile.team_id : null,
                            work_plan_categories: isCategoryScopedWorkPlanAdmin(role)
                              ? (profile.work_plan_categories?.length ? profile.work_plan_categories : workPlanCategories)
                              : [],
                          });
                        }}
                        disabled={!canMutateUsers || updatingId === profile.id}
                      >
                        <SelectTrigger className={cn(
                          "h-9 text-[10px] font-bold uppercase",
                          getRoleBadgeClass(profile.role)
                        )}>
                          <div className="flex items-center gap-2">
                            <Shield size={12} />
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {ACCESS_OPTIONS.map(option => <SelectItem key={option.value} value={option.value} className="text-xs font-bold">{option.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {roleRequiresTeam(profile.role) ? (
                        <Select
                          value={profile.team_id || "none"}
                          onValueChange={(teamId) => {
                            const team = teams.find(item => item.id === teamId);
                            if (team) void handleUpdateProfile(profile.id, { team_id: team.id, region_id: team.region_id });
                          }}
                          disabled={!canMutateUsers || updatingId === profile.id}
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
                            {teams.filter(team => !profile.region_id || team.region_id === profile.region_id).map(team => <SelectItem key={team.id} value={team.id} className="text-xs">{team.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : isCategoryScopedWorkPlanAdmin(profile.role) ? (
                        <span className="block text-xs text-blue-700">Semua Wilayah · {(profile.work_plan_categories || []).join(', ') || 'Kategori belum dipilih'}</span>
                      ) : isGlobalFuelAdmin(profile.role) ? (
                        <span className="text-xs font-medium text-orange-600">Semua Wilayah</span>
                      ) : isSpjOliAdmin(profile.role) ? (
                        <Select
                          value={profile.region_id || "all"}
                          onValueChange={(regionId) => void handleUpdateProfile(profile.id, { region_id: regionId === 'all' ? null : regionId, team_id: null })}
                          disabled={!canMutateUsers || updatingId === profile.id}
                        >
                          <SelectTrigger className="h-9 text-xs"><div className="flex items-center gap-2"><Tag size={12} /><SelectValue /></div></SelectTrigger>
                          <SelectContent><SelectItem value="all">Semua Wilayah</SelectItem>{regions.map(region => <SelectItem key={region.id} value={region.id} className="text-xs">{region.name}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : roleRequiresRegion(profile.role) ? (
                        <Select
                          value={profile.region_id || "none"}
                          onValueChange={(regionId) => void handleUpdateProfile(profile.id, { region_id: regionId, team_id: null })}
                          disabled={!canMutateUsers || updatingId === profile.id}
                        >
                          <SelectTrigger className={cn("h-9 text-xs", !profile.region_id && "text-slate-400 italic")}>
                            <div className="flex items-center gap-2">
                              <Tag size={12} />
                              <SelectValue placeholder="Pilih Wilayah" />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" disabled>Pilih Wilayah</SelectItem>
                            {regions.map(region => <SelectItem key={region.id} value={region.id} className="text-xs">{region.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs italic text-slate-400">{getRegionName(profile.region_id)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <Clock size={12} />
                        {profile.updated_at ? format(new Date(profile.updated_at), 'dd MMM yyyy, HH:mm', { locale: localeId }) : '-'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-800 hover:bg-slate-100" title="Lihat detail akun" onClick={() => handleViewDetails(profile)}>
                        <Eye size={17} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(profile.is_active === false ? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" : "text-amber-500 hover:text-amber-700 hover:bg-amber-50")}
                        disabled={!canMutateUsers || updatingId === profile.id}
                        title={profile.is_active === false ? "Aktifkan akun" : "Nonaktifkan akun"}
                        onClick={() => void handleToggleActive(profile)}
                      >
                        {profile.is_active === false ? <Power size={17} /> : <PowerOff size={17} />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                        disabled={!canMutateUsers || updatingId === profile.id}
                        title="Edit pengguna"
                        onClick={() => openEditProfile(profile)}
                      >
                        <Pencil size={17} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                        disabled={!canMutateUsers || updatingId === profile.id}
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

      <Dialog open={!!editingProfile} onOpenChange={open => !open && setEditingProfile(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Pengguna <span className="ml-2 text-[10px] font-normal text-slate-500">{editUserLastSavedAt ? 'Draft tersimpan' : 'Draft akan tersimpan otomatis'}</span></DialogTitle>
            <DialogDescription>Perbarui nama, hak akses, kategori, dan wilayah akun.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nama pengguna</label>
              <Input value={editUser.username} onChange={event => setEditUser({ ...editUser, username: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Hak akses</label>
              <Select value={editUser.role} onValueChange={role => setEditUser({
                ...editUser,
                role: role as UserRole,
                regionId: roleCanSelectRegion(role) ? editUser.regionId : '',
                teamId: roleRequiresTeam(role) ? editUser.teamId : '',
                workPlanCategories: isCategoryScopedWorkPlanAdmin(role) ? editUser.workPlanCategories : [],
              })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ACCESS_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {isGlobalFuelAdmin(editUser.role) ? (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Wilayah</label>
                <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm font-medium text-orange-600">Semua Wilayah</div>
              </div>
            ) : isSpjOliAdmin(editUser.role) ? (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Cakupan Wilayah SPJ Oli</label>
                <Select value={editUser.regionId || 'all'} onValueChange={regionId => setEditUser({ ...editUser, regionId: regionId === 'all' ? '' : regionId, teamId: '' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Semua Wilayah</SelectItem>{regions.map(region => <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : roleRequiresRegion(editUser.role) && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Wilayah</label>
                <Select value={editUser.regionId} onValueChange={regionId => setEditUser({ ...editUser, regionId, teamId: '' })}>
                  <SelectTrigger><SelectValue placeholder="Pilih wilayah" /></SelectTrigger>
                  <SelectContent>{regions.map(region => <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {isCategoryScopedWorkPlanAdmin(editUser.role) && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Kategori rencana kerja yang dapat dikerjakan</label>
                <div className="grid grid-cols-2 gap-2 rounded-md border bg-slate-50 p-3 sm:grid-cols-3">
                  {workPlanCategories.map((category) => <label key={category} className="flex cursor-pointer items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={editUser.workPlanCategories.includes(category)} onChange={() => setEditUser({ ...editUser, workPlanCategories: toggleWorkPlanCategory(editUser.workPlanCategories, category) })} />{category}</label>)}
                </div>
                <p className="text-xs text-slate-500">Pilih satu atau lebih kategori. Wilayah tetap bersifat global.</p>
              </div>
            )}
            {roleRequiresTeam(editUser.role) && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Kategori tim</label>
                <Select value={editUser.teamId} onValueChange={teamId => setEditUser({ ...editUser, teamId })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {teams.filter(team => team.region_id === editUser.regionId).map(team => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditingProfile(null)}>Batal</Button>
            <Button type="button" onClick={handleSaveProfile} disabled={!!updatingId}>Simpan Perubahan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingProfile} onOpenChange={open => !open && setViewingProfile(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detail Akun</DialogTitle>
            <DialogDescription>Informasi akun hanya terlihat oleh Super Admin.</DialogDescription>
          </DialogHeader>
          {loadingDetails ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
            <dl className="space-y-3 text-sm">
              <div><dt className="text-slate-500">Nama pengguna</dt><dd className="font-medium">{viewingProfile?.username || 'Tanpa Nama'}</dd></div>
              <div><dt className="text-slate-500">Email</dt><dd className="font-medium">{accountDetails?.email || '-'}</dd></div>
              <div><dt className="text-slate-500">ID pengguna</dt><dd className="break-all font-mono text-xs">{viewingProfile?.id}</dd></div>
              <div><dt className="text-slate-500">Dibuat</dt><dd>{accountDetails?.createdAt ? format(new Date(accountDetails.createdAt), 'dd MMM yyyy, HH:mm', { locale: localeId }) : '-'}</dd></div>
              <div><dt className="text-slate-500">Login terakhir</dt><dd>{accountDetails?.lastSignInAt ? format(new Date(accountDetails.lastSignInAt), 'dd MMM yyyy, HH:mm', { locale: localeId }) : '-'}</dd></div>
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
