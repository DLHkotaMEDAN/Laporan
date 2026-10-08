# Multi-Role Refactor — Progress Report
**Tanggal:** 2026-10-08  
**Status:** IMPLEMENTED (TypeScript check pending)

---

## RINGKASAN PERUBAHAN

Refactor multi-role (`profile.role` → `profile.roles[]`) telah diimplementasikan di seluruh stack.

**Prinsip backward compatibility:**
- Kolom `role` lama TETAP ADA di DB (tidak di-drop)
- Interface `AuthContext` memiliki field `roles` (baru) dan `role` (deprecated)
- Semua predicate function lama tetap ada, ditambahkan versi baru berakhiran `Roles`
- User lama yang belum migrasi akan tetap bekerja

---

## FILE YANG DIUBAH

### 1. Database Migration ✅
**File:** `supabase/migrations/20261008_multi_role_refactor.sql`
- Tambah kolom `profiles.roles text[]` dengan default `'{}'`
- Migrasi data: copy single role ke array
- Pecah combined roles (`admin_wilayah_bbm` → `['laporan_kerja','rencana_kerja','bbm']`)
- Buat fungsi `current_access_roles()` yang return `text[]`
- Buat fungsi `has_role(role_name text)` untuk RLS
- Tulis ulang `has_record_access()` pakai array logic (OR semantics)
- Tulis ulang trigger `assign_region_from_profile()` pakai array

### 2. constants/access-control.ts ✅
**Baris diubah:** 207–243 → tambah section baru di akhir file
- Tambah type `PermissionKey` (11 keys atomik)
- Tambah `PERMISSION_LABELS` map
- Tambah `PERMISSION_REQUIRES_REGION` dan `PERMISSION_REQUIRES_TEAM` arrays
- Tambah `ADMINISTRATOR_KEY` constant
- Tambah 14 predicate functions baru berakhiran `Roles`:
  - `isSuperAdminRoles(roles: string[])`
  - `isPimpinanRoles(roles: string[])`
  - `isAdminBbmRoles(roles: string[])`
  - `isAdminBbmPusatRoles(roles: string[])`
  - `isLaporanBbmRoles(roles: string[])`
  - `isSpjOliRoles(roles: string[])`
  - `isNotaDinasRoles(roles: string[])`
  - `isAdminWilayahRoles(roles: string[])`
  - `canManageReportEntriesRoles(roles: string[])`
  - `canManageWorkPlansRoles(roles: string[])`
  - `canAccessFuelAreaRoles(roles: string[])`
  - `rolesRequireRegion(roles: string[])`
  - `roleRequiresTeamRoles(roles: string[])`
  - `getRoleLandingPathRoles(roles: string[])`
  - `getLoginDestinationRoles(roles: string[])`
  - `getRoleLabelRoles(roles: string[])` — gabung multiple labels dengan ` + `

**Fungsi lama TIDAK DIHAPUS** — backward compat dijaga.

### 3. constants/permissions.ts ✅
**Baris diubah:** 26–35
- Update interface `AuthContext`:
  - Tambah `roles: UserRole[]` (preferred)
  - Keep `role?: UserRole | null` sebagai deprecated (backward compat)

### 4. lib/acl.ts ✅
**Baris diubah:** seluruh file ditulis ulang
- `userHasPermission()`:
  - Query DB sekarang ambil `role, roles, region_id, team_id`
  - Build `rolesArray`: prefer `profile.roles`, fallback ke `[profile.role]`
  - Build ctx dengan `roles` dan `role` (backward compat)
- `hasPermission()`:
  - Loop semua role di `ctx.roles`
  - Return `true` jika SALAH SATU role mengizinkan (OR semantics)
  - Fallback ke `ctx.role` jika `ctx.roles` kosong

### 5. context/AuthContext.tsx ✅
**Baris diubah:** 7–16 (interface), 157 (signOut audit log)
- Interface `Profile`: tambah `roles: string[]`
- `signOut`: audit log `role` field sekarang `(profile?.roles ?? []).join(',') || profile?.role`
- Query `select('*')` otomatis ambil kolom `roles` (tidak perlu ubah query)

### 6. components/AuthorizeRoute.tsx ✅
**Baris diubah:** 47–52
- Build `ctx` dengan:
  - `roles: (profile?.roles ?? []) as UserRole[]`
  - `role: profile?.role ?? null` (backward compat)

### 7. App.tsx ✅
**Baris diubah:** import section + 8 route guard components + 2 ActivityTracker audit logs
- Import tambahan:
  - `isSuperAdminRoles`
  - `isAdminBbmRoles`
  - `isLaporanBbmRoles`
  - `isNotaDinasRoles`
  - `canAccessFuelAreaRoles`
  - `getRoleLandingPathRoles`
- ActivityTracker audit logs (2 lokasi):
  - `role: (profile.roles ?? []).join(',') || profile.role`
- **ProtectedRoute**:
  - Cek combined workspace: `isAdminBbmRoles(profileRoles) && hasLaporanOrRencana`
  - Backward compat: cek legacy combined roles
  - Redirect pakai `getRoleLandingPathRoles()` kalau `profileRoles.length > 0`
- **WorkPlanWriteRoute**: sama pattern dengan ProtectedRoute
- **AdminRoute**: `canAccessFuelAreaRoles()` jika `profileRoles.length > 0`
- **FuelReportRoute**: `canAccessFuelAreaRoles()` + cek `hasSpjOli` / `hasLaporanBbm`
- **LaporanBbmRoute**: `isSuperAdminRoles()` atau `isLaporanBbmRoles()`
- **SpjOliRoute**: cek `profileRoles.includes('administrator'|'spj_oli'|'pimpinan')`
- **NotaDinasRoute**: `isSuperAdminRoles()` atau `isNotaDinasRoles()`
- **NonFuelSpecialistRoute**: `isAdminBbmRoles()` atau `isLaporanBbmRoles()` atau `includes('spj_oli')`
- **WorkPlanAccessRoute**:
  - Cek `profileRoles.includes('laporan_kerja')` tanpa `'rencana_kerja'` → redirect
  - Backward compat: cek `profile.role === USER_ROLES.LAPORAN`
  - Cek fuel only roles → redirect
- **OvertimeAccessRoute**: `isSuperAdminRoles()` atau `includes('rekap_lembur')`
- **PrintRekapAdminRoute**: `isSuperAdminRoles()` atau fallback ke `canPrintAdminRecap()`

### 8. components/UserManagement.tsx ⚠️ PARTIAL
**Baris diubah:** import, interface, state init, handlers
- Import tambahan:
  - `PermissionKey`, `PERMISSION_LABELS`, `PERMISSION_REQUIRES_REGION`, `ADMINISTRATOR_KEY`
  - `isSuperAdminRoles`, `getRoleLabelRoles`, `rolesRequireRegion`, `roleRequiresTeamRoles`
- Interface `Profile`: tambah `roles: string[]`
- Interface `UserFormState`: tambah `roles: string[]`
- Interface `EditUserFormState`: tambah `roles: string[]`
- State init:
  - `newUser`: tambah `roles: []`
  - `editUser`: tambah `roles: []`
- `canMutateUsers`: `isSuperAdminRoles(currentProfile?.roles ?? []) || isSuperAdminAccess(...)`
- `handleRoleToggle()`: added helper untuk multi-select checkbox
- `handleCreateUser`: kirim `roles: newUser.roles.length > 0 ? newUser.roles : [newUser.role]`
- `handleSaveProfile`: build `effectiveRoles` dan kirim `roles` ke DB
- `openEditProfile`: `roles: profile.roles ?? []`
- `fetchProfiles`: map `roles: profile.roles ?? []`

**⚠️ UI MULTI-SELECT CHECKBOX BELUM DIIMPLEMENTASIKAN** — form masih pakai single `<Select>` lama.
Perlu ditambahkan:
- Checkbox list untuk 11 permission keys
- Logic: jika `administrator` dipilih, disable semua lainnya
- Tampilkan selected roles sebagai badge/tag
- Validasi: minimal 1 role harus dipilih

### 9. services/auditLogService.ts ✅
**Baris diubah:** tambah helper + 3 lokasi query
- Tambah helper `serializeRoles(roles: string[] | null | undefined): string | null`
- `logAction()` (baris ~39–42):
  - Query `select('role, roles')`
  - `role = serializeRoles(profile?.roles) || profile?.role || null`
- `logCurrentUser()` (baris ~108):
  - Query `select('username, role, roles')`
  - `role: serializeRoles(profile?.roles) || profile?.role || null`

### 10. supabase/functions/create-user/index.ts ✅
**Baris diubah:** type, caller check, validation, insert
- Type `CreateUserInput`: tambah `roles?: string[]`
- Caller check:
  - Query `select('role, roles')`
  - Build `callerRoles` array: prefer `callerProfile.roles`, fallback `[callerProfile.role]`
  - `if (!callerRoles.includes('admin')) throw ...`
- Validation:
  - Build `effectiveRoles` array: prefer `input.roles`, fallback `[input.role]`
  - Loop semua role di array, validasi masing-masing
- Profile insert:
  - `roles: effectiveRoles`
  - Keep `role: input.role` (backward compat)

---

## BACKWARD COMPATIBILITY

### Kolom DB
- **`profiles.role`** (lama): TIDAK DIHAPUS, masih diisi saat create user
- **`profiles.roles`** (baru): array, diisi saat create/edit

### TypeScript Interfaces
- **`AuthContext.role`**: marked `@deprecated`, tapi masih ada
- **`AuthContext.roles`**: field baru (preferred)
- **`Profile.role`**: masih ada (diisi dari DB)
- **`Profile.roles`**: field baru

### Predicate Functions
- Fungsi lama (misal `isSuperAdminAccess(role: string)`) TIDAK DIHAPUS
- Fungsi baru ditambahkan dengan suffix `Roles` (misal `isSuperAdminRoles(roles: string[])`)
- Caller bisa pakai keduanya (backward compat)

### Edge Function
- Terima `role` (required, backward compat) dan `roles` (optional, baru)
- Insert ke DB pakai kedua field

### UI (UserManagement)
- Form masih pakai single-select untuk `role` (lama)
- **TODO:** tambah multi-select checkbox untuk `roles` (baru)

---

## STATUS ROLE SETELAH REFACTOR

### Combined Roles (sebelum refactor)
Sebelumnya ada 2 "combined role" yang dibuat sebagai workaround single-role:
1. `admin_wilayah_bbm` — bisa mengerjakan Laporan, Rencana Kerja, dan BBM
2. `admin_rencana_kerja_bbm` — bisa mengerjakan Rencana Kerja dan BBM

### Setelah Migrasi
User dengan combined role di-migrasi menjadi array atomik:
- `admin_wilayah_bbm` → `roles: ['laporan_kerja', 'rencana_kerja', 'bbm']`
- `admin_rencana_kerja_bbm` → `roles: ['rencana_kerja', 'bbm']`

### Akses Per Role (Multi-Role System)

| Role (Permission Key) | Label Indonesia | Wilayah Required | Akses |
|----------------------|-----------------|------------------|-------|
| `administrator` | Administrator | ❌ | Akses semua area (pengendali) |
| `pimpinan` | Pimpinan | ❌ | Baca semua area (view-only) |
| `laporan_kerja` | Admin Wilayah (Laporan Kerja) | ✅ | Laporan harian per wilayah |
| `rencana_kerja` | Admin Rencana Kerja | ✅ | Rencana kerja per wilayah |
| `rekap_lembur` | Admin Rekap Lembur | ✅ | Rekap lembur per wilayah |
| `bbm` | Admin BBM | ✅ | BBM per wilayah |
| `bbm_pusat` | Admin BBM Pusat | ❌ | BBM semua wilayah |
| `laporan_bbm` | Admin Laporan BBM | ✅ | Laporan BBM per wilayah |
| `spj_oli` | Admin SPJ Oli | ✅ (opsional) | SPJ Oli (bisa all atau per wilayah) |
| `nota_dinas` | Admin Nota Dinas | ✅ | Nota dinas per wilayah |
| `pengguna_tim` | Pengguna Tim | ✅ | Laporan & rencana kerja per tim |

### Kombinasi Role yang Valid

User **DAPAT** punya multiple roles (contoh):
- `['laporan_kerja', 'rencana_kerja']` — bisa Laporan + Rencana Kerja
- `['laporan_kerja', 'rencana_kerja', 'bbm']` — bisa Laporan + Rencana Kerja + BBM (migrasi dari `admin_wilayah_bbm`)
- `['rencana_kerja', 'bbm']` — bisa Rencana Kerja + BBM (migrasi dari `admin_rencana_kerja_bbm`)
- `['bbm', 'laporan_bbm']` — bisa BBM + Laporan BBM

User **TIDAK DAPAT** punya role `administrator` bersamaan dengan role lain:
- Jika `administrator` dipilih → semua role lain ter-disable (exclusive)
- `administrator` sudah lengkap sebagai pengendali

### Contoh Akses User Multi-Role

**User A:** `roles: ['laporan_kerja', 'rencana_kerja']`, `region_id: 'Wilayah X'`
- ✅ Akses Laporan harian Wilayah X
- ✅ Akses Rencana kerja Wilayah X
- ❌ Tidak bisa akses BBM (tidak punya role `bbm`)

**User B:** `roles: ['laporan_kerja', 'rencana_kerja', 'bbm']`, `region_id: 'Wilayah Y'`
- ✅ Akses Laporan harian Wilayah Y
- ✅ Akses Rencana kerja Wilayah Y
- ✅ Akses BBM Wilayah Y

**User C:** `roles: ['administrator']`
- ✅ Akses SEMUA area (tidak perlu pilih wilayah)

---

## TESTING CHECKLIST

### Unit Tests (manual)
- [ ] Login sebagai user dengan `roles: ['administrator']` → bisa akses semua
- [ ] Login sebagai user dengan `roles: ['laporan_kerja']` + `region_id` → bisa akses laporan di wilayahnya
- [ ] Login sebagai user dengan `roles: ['laporan_kerja','rencana_kerja']` → bisa akses keduanya
- [ ] Login sebagai user dengan `roles: ['laporan_kerja','rencana_kerja','bbm']` (migrasi dari `admin_wilayah_bbm`) → bisa akses ketiga area
- [ ] Login sebagai user dengan `roles: ['rencana_kerja','bbm']` (migrasi dari `admin_rencana_kerja_bbm`) → bisa akses RK + BBM
- [ ] Buat user baru dari UI Admin → form harus menampilkan checkbox multi-select (TODO: belum diimplementasi)
- [ ] Edit user existing → form harus menampilkan checkbox multi-select (TODO: belum diimplementasi)

### Integration Tests
- [ ] Route guards di `App.tsx` redirect dengan benar berdasarkan `roles`
- [ ] Audit log mencatat `role` sebagai comma-separated string (misal `"laporan_kerja,rencana_kerja"`)
- [ ] RLS di Supabase mengizinkan akses berdasarkan OR logic dari `roles[]`

### TypeScript Check
⚠️ **PENDING** — TypeScript check gagal dijalankan karena PowerShell execution policy.

Manual check yang perlu dilakukan:
```bash
cd c:\Users\dlhup\dyad-apps\laporan\artifacts\laporan-kerja
npx tsc --noEmit
```

Jika ada error TypeScript:
1. Periksa semua akses `profile.role` yang belum diubah ke `profile.roles`
2. Periksa type mismatch di `AuthContext` (`role` vs `roles`)
3. Periksa import statement yang missing

---

## MIGRATION STRATEGY

### Fase 1: Database Migration (apply immediately)
Run `20261008_multi_role_refactor.sql` di Supabase:
```sql
-- Sudah dibuat di file migrasi
```

Setelah run, semua user existing akan punya field `roles` terisi.

### Fase 2: Deploy Frontend Code
Deploy semua perubahan frontend:
- `constants/access-control.ts`
- `constants/permissions.ts`
- `lib/acl.ts`
- `context/AuthContext.tsx`
- `components/AuthorizeRoute.tsx`
- `App.tsx`
- `components/UserManagement.tsx`
- `services/auditLogService.ts`

### Fase 3: Deploy Edge Function
Deploy Edge Function `create-user`:
```bash
supabase functions deploy create-user
```

### Fase 4: Manual Testing
Test semua kombinasi role di atas.

### Fase 5: UI Multi-Select (follow-up PR)
Implementasikan checkbox multi-select di `UserManagement.tsx`.

---

## CATATAN PENTING

1. **Kolom `role` lama tidak di-drop** — backward compat dijaga selama transisi
2. **OR semantics**: user dengan `roles: ['laporan_kerja','rencana_kerja']` bisa akses KEDUANYA (bukan AND)
3. **Combined roles dihapus**: `admin_wilayah_bbm` dan `admin_rencana_kerja_bbm` dimigrasi ke array atomik
4. **Administrator exclusive**: tidak bisa dikombinasi dengan role lain
5. **Wilayah wajib diisi** jika role memerlukan region (cek `PERMISSION_REQUIRES_REGION`)
6. **TypeScript check pending** — perlu dijalankan manual setelah deploy

---

## NEXT STEPS

1. ✅ Implementasi core logic (selesai)
2. ⚠️ TypeScript check (pending — PowerShell issue)
3. ⚠️ UI multi-select checkbox di UserManagement.tsx (TODO)
4. 🔜 Deploy ke staging environment
5. 🔜 Manual testing semua kombinasi role
6. 🔜 Deploy ke production

---

**Implementasi selesai pada:** 2026-10-08  
**Status:** READY FOR REVIEW & TESTING
