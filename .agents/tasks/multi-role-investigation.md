# Investigasi Multi-Role Refactor
**Tanggal:** 2026-10-08  
**Scope:** `c:\Users\dlhup\dyad-apps\laporan\artifacts\laporan-kerja\src` + edge functions + migrations

---

## RINGKASAN EKSEKUTIF

Sistem saat ini menggunakan **single-role** (`profile.role: UserRole` — satu string).  
Tujuan refactor: **multi-role** (`profile.roles: UserRole[]` — array of strings).

**Dampak utama:** Ada **7 lapisan** yang harus diubah secara terkoordinasi:
1. Database schema (`profiles.role` → `profiles.roles`)  
2. TypeScript types (`Profile`, `AuthContext`)  
3. Access-control functions di `access-control.ts` (semua predicate `role ===`)  
4. ACL engine di `acl.ts` (permission lookup per role)  
5. Route guards di `App.tsx` (8 route guard components)  
6. UI management di `UserManagement.tsx` (form + tabel)  
7. Edge Function `create-user/index.ts` (validasi + insert)  
8. Audit log `auditLogService.ts` (kolom `role` → array/string)

---

## BAGIAN 1 — TEMUAN PER FILE

### 1. `src/constants/access-control.ts`

**Status:** ⚠️ PERLU DIUBAH SIGNIFIKAN

Ini adalah pusat logika role. Semua predicate function menerima `role: string | null | undefined` (single string) dan membandingkan dengan `=== USER_ROLES.xxx`.

**Lokasi kritis:**

| Baris | Kode | Masalah |
|-------|------|---------|
| 82 | `isKnownRole(role)` | memeriksa satu string — perlu `isKnownRoles(roles[])` |
| 85 | `roleRequiresRegion(role)` | cek satu role — perlu semua roles di-check |
| 87 | `roleRequiresTeam(role)` | `role === USER_ROLES.USER` |
| 89–90 | `isSuperAdminAccess(role)` | `role === USER_ROLES.ADMIN` |
| 92–93 | `isPimpinanAccess(role)` | `role === USER_ROLES.PIMPINAN` |
| 95–96 | `isGlobalWorkPlanAdmin(role)` | OR dari dua role |
| 98–99 | `isCategoryScopedWorkPlanAdmin(role)` | `role === USER_ROLES.ADMIN_RENCANA_KERJA` |
| 101–104 | `isAdminRencanaKerjaAccess(role)` | OR dari tiga role |
| 106–110 | `isAdminBbmAccess(role)` | OR dari empat role |
| 112–113 | `isAdminBbmPusatAccess(role)` | single role check |
| 115–116 | `isLaporanBbmAdmin(role)` | single role check |
| 118–119 | `isGlobalFuelAdmin(role)` | OR dari dua role |
| 121–122 | `isSpjOliAdmin(role)` | single role check |
| 124–125 | `isNotaDinasAdmin(role)` | single role check |
| 127–133 | `canAccessAllSpjOliRegions(role)` | 3 role checks |
| 135–136 | `isAdminWilayahAccess(role)` | OR dari dua role |
| 139–143 | `canManageReportEntries(role)` | OR dari 4 role checks |
| 146–150 | `canManageWorkPlans(role)` | OR dari 4 role checks |
| 152–157 | `canAccessFuelArea(role)` | multi-role check |
| 159–160 | `canPrintAdminRecap(role)` | single role check |
| 162–168 | `canPrintReportRecapByRole(role)` | single role check + array.includes |
| 170–204 | `getRoleLandingPath(role)` | if-chain per single role |
| 186–204 | `getLoginDestination(role)` | if-chain per single role |
| 207 | `getRoleLabel(role)` | finds first match — multi-role perlu list label |
| 212–243 | `getRoleBadgeClass(role)` | switch case single role |

**Pola perubahan:** Semua `role === X` perlu jadi `roles.includes(X)` atau `roles.some(r => r === X)`. Fungsi yang mengembalikan navigasi path/label perlu strategi prioritas untuk multiple roles.

---

### 2. `src/constants/permissions.ts`

**Status:** ⚠️ PERLU DIUBAH — ACL engine

**Interface `AuthContext` (baris 26–35):**
```ts
export interface AuthContext {
  role: UserRole | null;   // ← HARUS JADI roles: UserRole[]
  ...
}
```

**`ROLE_PERMISSIONS` (baris 43–235):**  
Map `Partial<Record<UserRole, Permission[]>>` — ini sudah bagus sebagai lookup table per role, **tidak perlu diubah strukturnya**. Yang perlu diubah adalah cara ACL engine menggunakannya (lihat `acl.ts`).

---

### 3. `src/context/AuthContext.tsx`

**Status:** ⚠️ PERLU DIUBAH — definisi Profile + signOut log

**Baris 7–16 — interface `Profile`:**
```ts
interface Profile {
  id: string;
  role: UserRole;          // ← HARUS JADI roles: UserRole[]
  category: string | null;
  ...
}
```

**Baris 157 — `signOut` mengirim `profile.role` ke audit log:**
```ts
role: profile?.role,       // ← perlu dikirim sebagai string (join atau primary role)
```

**Baris 53 — query DB:**
```ts
.select('*')               // ← akan ambil kolom `roles` otomatis jika DB sudah dimigrasi
```
Tidak ada `.select('role')` eksplisit, jadi cukup migrasi DB + update interface.

---

### 4. `src/components/AuthorizeRoute.tsx`

**Status:** ⚠️ PERLU DIUBAH — baris 47

**Baris 47:**
```ts
const ctx: AuthContext = {
  role: profile?.role ?? null,   // ← HARUS JADI roles: profile?.roles ?? []
  ...
};
```

---

### 5. `src/lib/acl.ts`

**Status:** ⚠️ PERLU DIUBAH SIGNIFIKAN — jantung permission check

**`userHasPermission()` (baris 34–37):**
```ts
const ctx: AuthContext = {
  role: profile.role as UserRole | null,   // ← JADI roles: (profile.roles ?? []) as UserRole[]
  ...
};
```

**`hasPermission()` (baris 60–67) — LOGIKA KRITIS:**
```ts
export function hasPermission(ctx: AuthContext, resource: Resource, action: Action): boolean {
  if (!ctx.role) return false;                         // ← cek array kosong
  const perms = ROLE_PERMISSIONS[ctx.role] ?? [];      // ← HARUS loop semua roles
  const match = perms.find(p => p.resource === resource && p.action === action);
  if (!match) return false;
  if (!match.condition) return true;
  return match.condition(ctx);
}
```

**Setelah refactor harus menjadi:**
```ts
export function hasPermission(ctx: AuthContext, resource: Resource, action: Action): boolean {
  if (!ctx.roles || ctx.roles.length === 0) return false;
  // Cek semua role user — granted jika SALAH SATU role mengizinkan
  for (const role of ctx.roles) {
    const perms = ROLE_PERMISSIONS[role] ?? [];
    const match = perms.find(p => p.resource === resource && p.action === action);
    if (match && (!match.condition || match.condition(ctx))) return true;
  }
  return false;
}
```

---

### 6. `src/App.tsx`

**Status:** ⚠️ PERLU DIUBAH — 8 route guard components

Semua guard mengakses `profile.role` (single string). Setelah refactor harus pakai helper functions yang sudah di-update.

| Baris | Guard | Akses `profile.role` |
|-------|-------|---------------------|
| 175–176 | `ProtectedRoute` | `profile.role === USER_ROLES.ADMIN_WILAYAH_BBM` (×2) |
| 181, 199, 205 | `ProtectedRoute` | `profile.role === USER_ROLES.ADMIN_SPJ_BBM` |
| 237–238 | `FuelReportRoute` | `profile.role === USER_ROLES.ADMIN_SPJ_BBM/OLI` |
| 268–271 | `SpjOliRoute` | `profile?.role === USER_ROLES.ADMIN/SPJ_BBM/SPJ_OLI/PIMPINAN` |
| 295 | `FuelReportRoute` | `profile.role === USER_ROLES.ADMIN_SPJ_BBM/OLI` |
| 310 | `WorkPlanAccessRoute` | `profile.role === USER_ROLES.LAPORAN` |
| 321–322 | `WorkPlanAccessRoute` | `profile.role === USER_ROLES.ADMIN_SPJ_BBM/OLI` |
| 337–338 | `OvertimeAccessRoute` | `profile?.role === USER_ROLES.ADMIN_REKAP_LEMBUR` |
| 349 | `PrintRekapAdminRoute` | `profile?.role` via `canPrintAdminRecap()` |
| 95–97 | `ActivityTracker` | `role: profile.role` ke audit log |
| 140 | `ActivityTracker` | `role: profile.role` ke audit log |

**Catatan kritis:** Guard `ProtectedRoute` dan `WorkPlanWriteRoute` menggunakan logika `isCombinedRkBbm` yang mengecek dua role "combined" (`admin_wilayah_bbm`, `admin_rencana_kerja_bbm`). Dengan multi-role, kombinasi ini tidak lagi perlu role khusus — user cukup punya `[admin_wilayah, admin_bbm]`. Logika guard ini perlu di-rethink total.

---

### 7. `src/components/UserManagement.tsx`

**Status:** ⚠️ PERLU DIUBAH BESAR — UI form + tabel

**Interface lokal `Profile` (baris 51):**
```ts
role: UserRole;   // ← JADI roles: UserRole[]
```

**Interface `UserFormState` (baris 75) dan `EditUserFormState` (baris 83):**
```ts
role: UserRole;   // ← JADI roles: UserRole[]
```

**State inisialisasi (baris 151, 153):**
```ts
role: USER_ROLES.ADMIN_WILAYAH   // ← JADI roles: [USER_ROLES.ADMIN_WILAYAH]
role: USER_ROLES.USER            // ← JADI roles: [USER_ROLES.USER]
```

**Form "Buat Akun" (baris ~501):** `<Select value={newUser.role}>` → perlu diganti dengan **multi-select checkbox** (sesuai permintaan user di request asli: dropdown dengan ceklist multiple).

**Tabel role inline edit (baris ~601):** `<Select value={profile.role}>` → perlu multi-select.

**`handleSaveProfile` (baris ~394–418):** semua validasi menggunakan `editUser.role` single value.

**`handleCreateUser` (baris ~209–235):** mengirim `role: newUser.role` ke Edge Function.

**`openEditProfile` (baris ~380):** `role: profile.role` → `roles: profile.roles`.

**`canMutateUsers` (baris ~118):**
```ts
isSuperAdminAccess(currentProfile?.role, ...)  // ← perlu pakai roles[]
```

---

### 8. `src/services/auditLogService.ts`

**Status:** ⚠️ PERLU DIUBAH MINOR

Kolom `role` di tabel `audit_logs` adalah `string | null`. Ini **tidak perlu diubah di DB** — cukup serialize array jadi string saat logging (misal: `roles.join(',')` atau ambil primary role).

**Lokasi yang perlu diubah:**

| Baris | Kode | Perubahan |
|-------|------|-----------|
| 39–42 | `select('role')` lalu `role = profile?.role` | query `roles`, serialize ke string |
| 108 | `select('username, role')` lalu `role: profile?.role` | query `roles`, serialize |
| 118 | `role: profile?.role` | serialize array |

**Rekomendasi:** tambahkan helper `serializeRoles(roles: UserRole[]): string` → `roles.join(',')`.

---

### 9. `supabase/functions/create-user/index.ts`

**Status:** ⚠️ PERLU DIUBAH — validasi + insert

**Baris ~100–115 — validasi input:**
```ts
type CreateUserInput = {
  role: string;            // ← JADI roles: string[]
  ...
};
if (!validRoles.has(input.role)) ...   // ← JADI: cek setiap role di array
```

**Baris ~115 — logika derived values:**
```ts
const assignedRegionId = input.role === USER_ROLES.ADMIN_RENCANA_KERJA ? null : input.regionId;
```
Perlu logika: region required jika SALAH SATU role di `roles[]` ada di `regionRequiredRoles`.

**Baris ~175 — insert profil:**
```ts
role: input.role,    // ← JADI roles: input.roles (array)
```

**Validasi otorisasi caller (baris ~97):**
```ts
if (callerProfile?.role !== 'admin') ...   // ← JADI: roles.includes('admin')
```

---

### 10. `supabase/migrations/20261008_cleanup_rls_dead_code.sql`

**Status:** ℹ️ PERLU MIGRASI BARU (file ini sendiri tidak perlu diubah)

File ini mendefinisikan `has_record_access()` yang memanggil `public.current_access_role()` — fungsi DB yang membaca kolom `role` dari profil user saat ini.

**`current_access_role()` (tidak terlihat di file ini, ada di migrasi sebelumnya):** Setelah refactor ke `roles[]`, fungsi ini perlu diganti dengan `current_access_roles()` yang mengembalikan `text[]`, ATAU RLS policy perlu di-rewrite menggunakan `ANY(current_access_roles())`.

**`has_record_access()` (baris 21–65):** Semua `public.current_access_role() = 'xxx'` perlu jadi `'xxx' = ANY(public.current_access_roles())`.

**`assign_region_from_profile()` trigger (baris 68–85):** `public.current_access_role() in (...)` perlu jadi logika array — misalnya cek apakah ada irisan antara `current_access_roles()` dan role yang region-required.

---

## BAGIAN 2 — HASIL GREP

### `profile\.role` dan `profile\?\.role` di `src/`

| File | Baris | Kode |
|------|-------|------|
| `App.tsx` | 95 | `role: profile.role` (ActivityTracker audit log VIEW) |
| `App.tsx` | 140 | `role: profile.role` (ActivityTracker audit log INTERACT) |
| `App.tsx` | 175 | `profile.role === USER_ROLES.ADMIN_WILAYAH_BBM` |
| `App.tsx` | 176 | `profile.role === USER_ROLES.ADMIN_RENCANA_KERJA_BBM` |
| `App.tsx` | 181 | `profile.role === USER_ROLES.ADMIN_SPJ_BBM` |
| `App.tsx` | 199 | `profile.role === USER_ROLES.ADMIN_WILAYAH_BBM` |
| `App.tsx` | 200 | `profile.role === USER_ROLES.ADMIN_RENCANA_KERJA_BBM` |
| `App.tsx` | 205 | `profile.role === USER_ROLES.ADMIN_SPJ_BBM` |
| `App.tsx` | 237 | `profile.role === USER_ROLES.ADMIN_SPJ_BBM` |
| `App.tsx` | 238 | `profile.role === USER_ROLES.ADMIN_SPJ_OLI` |
| `App.tsx` | 268 | `profile?.role === USER_ROLES.ADMIN` |
| `App.tsx` | 269 | `profile?.role === USER_ROLES.ADMIN_SPJ_BBM` |
| `App.tsx` | 270 | `profile?.role === USER_ROLES.ADMIN_SPJ_OLI` |
| `App.tsx` | 271 | `profile?.role === USER_ROLES.PIMPINAN` |
| `App.tsx` | 295 | `isAdminBbmAccess(profile.role)`, `isLaporanBbmAdmin(profile.role)`, `profile.role === ADMIN_SPJ_*` |
| `App.tsx` | 310 | `profile.role === USER_ROLES.LAPORAN` |
| `App.tsx` | 321–322 | `profile.role === USER_ROLES.ADMIN_SPJ_BBM/OLI` |
| `App.tsx` | 337–338 | `isSuperAdminAccess(profile?.role)`, `profile?.role === ADMIN_REKAP_LEMBUR` |
| `App.tsx` | 349 | `canPrintAdminRecap(profile?.role, ...)` |
| `AuthContext.tsx` | 157 | `role: profile?.role` (signOut audit log) |
| `AuthorizeRoute.tsx` | 47 | `role: profile?.role ?? null` |
| `lib/acl.ts` | 37 | `role: profile.role as UserRole \| null` |
| `lib/acl.ts` | 62–63 | `if (!ctx.role)` dan `ROLE_PERMISSIONS[ctx.role]` |
| `services/auditLogService.ts` | 42 | `role = profile?.role \|\| null` |
| `services/auditLogService.ts` | 118 | `role: profile?.role` |

### `ctx\.role` di `src/`

| File | Baris | Kode |
|------|-------|------|
| `lib/acl.ts` | 62 | `if (!ctx.role) return false` |
| `lib/acl.ts` | 63 | `const perms = ROLE_PERMISSIONS[ctx.role] ?? []` |
| `constants/permissions.ts` | 29 | `role: UserRole \| null` (definisi interface AuthContext) |

### `current_access_role` di migrations

| File | Baris | Kode |
|------|-------|------|
| `20261008_cleanup_rls_dead_code.sql` | 29,32,35,38,42,45,49,53 | `public.current_access_role() = 'xxx'` dalam `has_record_access()` |
| `20261008_cleanup_rls_dead_code.sql` | 72 | `public.current_access_role() in (...)` dalam trigger `assign_region_from_profile()` |

### `has_record_access` di migrations

| File | Keterangan |
|------|-----------|
| `20261008_cleanup_rls_dead_code.sql` | `has_record_access()` di-recreate baris 21–65, menggunakan 8 role checks |
| `20261008_cleanup_rls_dead_code.sql` | `has_fuel_access()` di-drop baris 89–100 (sudah tidak dipakai) |

---

## BAGIAN 3 — KOMPLIKASI KHUSUS: ROLE KOMBINASI

Saat ini ada **4 "combined role"** yang dibuat sebagai workaround single-role:

| Role saat ini | Sebenarnya kombinasi dari |
|---------------|--------------------------|
| `admin_wilayah_bbm` | `admin_wilayah` + `admin_bbm` |
| `admin_rencana_kerja_bbm` | `admin_rencana_kerja` + `admin_bbm` |
| *(implisit)* | `admin_wilayah` + `admin_rencana_kerja` |
| *(implisit)* | ... dan seterusnya |

Kode di `App.tsx` baris 175–176 dan 199–200 secara eksplisit memeriksa role-role ini sebagai `isCombinedRkBbm` untuk memberi pengecualian. Dengan multi-role, role `admin_wilayah_bbm` dan `admin_rencana_kerja_bbm` bisa **dihapus dari `USER_ROLES`** setelah semua user yang memakainya di-migrasi ke kombinasi `[admin_wilayah, admin_bbm]` dan `[admin_rencana_kerja, admin_bbm]`.

**Ini adalah penyederhanaan besar** — 4 role "gabungan" bisa diganti dengan kombinasi bebas dari role atomik.

---

## BAGIAN 4 — KEBIJAKAN REGION PADA MULTI-ROLE

`roleRequiresRegion()` saat ini cek satu role. Dengan multi-role, aturannya:

> **Region wajib diisi jika SALAH SATU role di array membutuhkan region.**

Contoh: user dengan `roles: ['admin_wilayah', 'admin_bbm']` — karena `admin_wilayah` butuh region, maka region wajib diisi meski `admin_bbm` tidak butuhnya.

Fungsi baru yang diperlukan:
```ts
export const rolesRequireRegion = (roles: UserRole[]) =>
  roles.some(r => REGION_REQUIRED_ROLES.includes(r));
```

---

## BAGIAN 5 — DAMPAK KE DB SCHEMA

Migrasi SQL yang dibutuhkan (bukan bagian dari file yang ada):

```sql
-- 1. Tambah kolom roles (array)
ALTER TABLE profiles ADD COLUMN roles text[] DEFAULT '{}';

-- 2. Migrasi data existing: salin role tunggal ke array
UPDATE profiles SET roles = ARRAY[role] WHERE role IS NOT NULL;

-- 3. Handle combined roles: pisah menjadi array dua role
UPDATE profiles SET roles = ARRAY['admin_wilayah', 'admin_bbm']
  WHERE role = 'admin_wilayah_bbm';
UPDATE profiles SET roles = ARRAY['admin_rencana_kerja', 'admin_bbm']
  WHERE role = 'admin_rencana_kerja_bbm';

-- 4. Tambah NOT NULL constraint
ALTER TABLE profiles ALTER COLUMN roles SET NOT NULL;

-- 5. Fungsi DB baru untuk RLS
CREATE OR REPLACE FUNCTION public.current_access_roles()
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT roles FROM profiles WHERE id = auth.uid()),
    '{}'::text[]
  );
$$;
```

> **Catatan:** Kolom `role` lama bisa tetap ada sementara sebagai fallback selama transisi, lalu di-drop setelah semua lapisan sudah menggunakan `roles`.

---

## BAGIAN 6 — RINGKASAN FILE YANG HARUS DIUBAH

| File | Urgensi | Jenis Perubahan |
|------|---------|----------------|
| **DB migration (baru)** | HARUS PERTAMA | Tambah kolom `roles text[]`, migrasi data, fungsi `current_access_roles()` |
| `src/context/AuthContext.tsx` | KRITIS | `Profile.role` → `Profile.roles: UserRole[]` |
| `src/constants/permissions.ts` | KRITIS | `AuthContext.role` → `AuthContext.roles: UserRole[]` |
| `src/lib/acl.ts` | KRITIS | `hasPermission()` loop semua roles |
| `src/constants/access-control.ts` | KRITIS | Semua predicate functions: signature + implementasi |
| `src/App.tsx` | KRITIS | 8 route guards, semua akses `profile.role` |
| `src/components/AuthorizeRoute.tsx` | KRITIS | `ctx.role` → `ctx.roles` |
| `src/components/UserManagement.tsx` | KRITIS | Form multi-select, interfaces, handlers |
| `supabase/functions/create-user/index.ts` | KRITIS | Validasi `roles[]`, caller check, insert |
| `supabase/migrations/20261008_cleanup_rls_dead_code.sql` | PERLU MIGRASI BARU | `has_record_access()` pakai `current_access_roles()` |
| `src/services/auditLogService.ts` | MINOR | Serialize `roles[]` ke string untuk kolom `role` |

**File hooks yang TIDAK perlu diubah:**
- `src/hooks/useRegionName.ts` — tidak menyentuh role
- `src/hooks/useRegionFilterOptions.ts` — tidak menyentuh role
- `src/hooks/useFormDraft.ts` — tidak menyentuh role
- `src/hooks/useAvailableTeams.ts` — tidak menyentuh role

**File services yang TIDAK perlu diubah:**
- `src/services/reportService.ts`, `workPlanService.ts`, `fuelService.ts`, dll — tidak ada akses langsung ke `profile.role`; semua melalui Supabase RLS atau parameter yang dikirim dari komponen.

---

## BAGIAN 7 — REKOMENDASI URUTAN IMPLEMENTASI

1. **Tulis migrasi DB** — tambah `profiles.roles text[]`, migrasi data, tambah fungsi `current_access_roles()`. Kolom `role` lama tetap ada (backward compat).
2. **Update TypeScript types** — `Profile` di `AuthContext.tsx` dan `AuthContext` di `permissions.ts`. Ini akan membuat TypeScript error di semua tempat yang pakai `profile.role` sehingga mudah ditemukan.
3. **Update `acl.ts`** — `hasPermission()` loop array roles.
4. **Update semua predicate functions** di `access-control.ts` — ubah signature dari `role: string` menjadi `roles: UserRole[]`.
5. **Update route guards** di `App.tsx` — pakai helper baru.
6. **Update `AuthorizeRoute.tsx`** — pass `roles`.
7. **Update `UserManagement.tsx`** — multi-select UI + handlers.
8. **Update Edge Function** — validasi `roles[]`.
9. **Update `auditLogService.ts`** — serialize roles.
10. **Tulis migrasi baru** untuk `has_record_access()` menggunakan `current_access_roles()`.
11. **Drop kolom `role` lama** setelah semua lapisan sudah berjalan dengan `roles`.

---

*Laporan dibuat oleh investigasi otomatis — semua temuan diverifikasi dari kode sumber aktual.*
