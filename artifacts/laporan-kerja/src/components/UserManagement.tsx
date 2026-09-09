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
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { 
  User, Shield, Tag, Trash2, Search, Loader2, AlertCircle, RefreshCw, Clock, Mail, KeyRound, Pencil, Eye
} from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from "@/lib/utils";
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
} from '@/constants/access-control';

const categories = ["Taman Kota", "Taman Amplas", "Taman Area", "Tim Babat", "Tim Siram", "Tim Pohon"];

interface Profile {
  id: string;
  username: string | null;
  email?: string | null;
  role: UserRole;
  category: string | null;
  region_id: string | null;
  team_id: string | null;
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
}

interface EditUserFormState {
  username: string;
  role: UserRole;
  regionId: string;
  teamId: string;
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
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState<UserFormState>({ username: '', email: '', password: '', role: USER_ROLES.ADMIN_WILAYAH, regionId: '', teamId: '' });
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editUser, setEditUser] = useState<EditUserFormState>({ username: '', role: USER_ROLES.USER, regionId: '', teamId: '' });
  const [viewingProfile, setViewingProfile] = useState<Profile | null>(null);
  const [accountDetails, setAccountDetails] = useState<{ email?: string; createdAt?: string; lastSignInAt?: string | null; emailConfirmedAt?: string | null } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

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
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          username: newUser.username,
          email: newUser.email,
          password: newUser.password,
          role: newUser.role,
          regionId: roleRequiresRegion(newUser.role) ? newUser.regionId : null,
          teamId: roleRequiresTeam(newUser.role) ? newUser.teamId : null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      showSuccess('Akun aktif berhasil dibuat tanpa konfirmasi email');
      setProfiles(currentProfiles => [
        {
          id: data.id,
          username: newUser.username.trim(),
          email: data.email || newUser.email.trim().toLowerCase(),
          role: newUser.role,
          category: null,
          region_id: roleRequiresRegion(newUser.role) ? newUser.regionId || null : null,
          team_id: roleRequiresTeam(newUser.role) ? newUser.teamId || null : null,
          updated_at: new Date().toISOString(),
        },
        ...currentProfiles.filter(profile => profile.id !== data.id),
      ]);
      setNewUser({ username: '', email: '', password: '', role: USER_ROLES.ADMIN_WILAYAH, regionId: '', teamId: '' });
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

  const openEditProfile = (profile: Profile) => {
    setEditingProfile(profile);
    setEditUser({
      username: profile.username || '',
      role: profile.role,
      regionId: profile.region_id || '',
      teamId: profile.team_id || '',
    });
  };

  const handleSaveProfile = async () => {
    if (!editingProfile) return;
    const requiresRegion = roleRequiresRegion(editUser.role);
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

    const updates = {
      username: editUser.username.trim(),
      role: editUser.role,
      region_id: requiresRegion ? editUser.regionId : null,
      team_id: roleRequiresTeam(editUser.role) ? editUser.teamId : null,
    };

    setUpdatingId(editingProfile.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', editingProfile.id);
      if (error) throw error;

      setProfiles(currentProfiles => currentProfiles.map(profile =>
        profile.id === editingProfile.id
          ? { ...profile, ...updates, updated_at: new Date().toISOString() }
          : profile,
      ));
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
      <form onSubmit={handleCreateUser} className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
        <div>
          <h3 className="font-bold text-blue-950">Buat Akun Baru</h3>
          <p className="text-xs text-blue-700">Akun langsung aktif dan tidak memerlukan konfirmasi email.</p>
        </div>
        <div className={cn("grid gap-3", roleRequiresTeam(newUser.role) ? "md:grid-cols-6" : "md:grid-cols-5")}>
          <Input required placeholder="Nama pengguna" value={newUser.username} onChange={event => setNewUser({ ...newUser, username: event.target.value })} />
          <Input required type="email" placeholder="Email" value={newUser.email} onChange={event => setNewUser({ ...newUser, email: event.target.value })} />
          <Input required minLength={8} type="password" placeholder="Password minimal 8 karakter" value={newUser.password} onChange={event => setNewUser({ ...newUser, password: event.target.value })} />
          <Select value={newUser.role} onValueChange={role => setNewUser({
            ...newUser,
            role: role as UserRole,
            regionId: roleRequiresRegion(role) ? newUser.regionId : '',
            teamId: '',
          })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ACCESS_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={isGlobalFuelAdmin(newUser.role) ? 'all' : newUser.regionId} onValueChange={regionId => setNewUser({ ...newUser, regionId: regionId === 'all' ? '' : regionId, teamId: '' })} disabled={isGlobalFuelAdmin(newUser.role) || !roleRequiresRegion(newUser.role)}>
            <SelectTrigger><SelectValue placeholder="Pilih wilayah" /></SelectTrigger>
            <SelectContent>
              {isGlobalFuelAdmin(newUser.role) && <SelectItem value="all">Semua Wilayah</SelectItem>}
              {regions.map(region => <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {roleRequiresTeam(newUser.role) && (
            <Select value={newUser.teamId} onValueChange={teamId => setNewUser({ ...newUser, teamId })} disabled={!newUser.regionId}>
            <SelectTrigger><SelectValue placeholder={newUser.regionId ? "Pilih tim" : "Pilih wilayah dahulu"} /></SelectTrigger>
              <SelectContent>{teams.filter(team => team.region_id === newUser.regionId).length > 0 ? teams.filter(team => team.region_id === newUser.regionId).map(team => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>) : <SelectItem value="no-team" disabled>Belum ada tim aktif untuk wilayah ini</SelectItem>}</SelectContent>
            </Select>
          )}
        </div>
        <Button type="submit" disabled={creating || (roleRequiresRegion(newUser.role) && !newUser.regionId) || (roleRequiresTeam(newUser.role) && !newUser.teamId)}>{creating ? 'Membuat akun...' : 'Buat Akun Aktif'}</Button>
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
                          <span className="truncate max-w-[150px] font-bold">{profile.username || "Tanpa Nama"}</span>
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
                            region_id: roleRequiresRegion(role) ? profile.region_id : null,
                            team_id: roleRequiresTeam(role) ? profile.team_id : null,
                          });
                        }}
                        disabled={updatingId === profile.id}
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
                          disabled={updatingId === profile.id}
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
                      ) : isGlobalFuelAdmin(profile.role) ? (
                        <span className="text-xs font-medium text-orange-600">Semua Wilayah</span>
                      ) : roleRequiresRegion(profile.role) ? (
                        <Select
                          value={profile.region_id || "none"}
                          onValueChange={(regionId) => void handleUpdateProfile(profile.id, { region_id: regionId, team_id: null })}
                          disabled={updatingId === profile.id}
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
                        className="text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                        disabled={updatingId === profile.id}
                        title="Edit pengguna"
                        onClick={() => openEditProfile(profile)}
                      >
                        <Pencil size={17} />
                      </Button>
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

      <Dialog open={!!editingProfile} onOpenChange={open => !open && setEditingProfile(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Pengguna</DialogTitle>
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
                regionId: roleRequiresRegion(role) ? editUser.regionId : '',
                teamId: roleRequiresTeam(role) ? editUser.teamId : '',
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
            ) : roleRequiresRegion(editUser.role) && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Wilayah</label>
                <Select value={editUser.regionId} onValueChange={regionId => setEditUser({ ...editUser, regionId, teamId: '' })}>
                  <SelectTrigger><SelectValue placeholder="Pilih wilayah" /></SelectTrigger>
                  <SelectContent>{regions.map(region => <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>)}</SelectContent>
                </Select>
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
