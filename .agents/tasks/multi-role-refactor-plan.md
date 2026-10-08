# Implementation Plan — Multi-Role Refactor
**Dibuat:** 2026-10-08  
**Berdasarkan:** `multi-role-investigation.md`  
**Scope:** Refactor `profile.role: string` → `profile.roles: UserRole[]` di seluruh stack

---

## PRINSIP KEAMANAN PERUBAHAN

- Kolom `role` lama di DB **tidak di-drop** sampai langkah 10 — berfungsi sebagai fallback selama transisi.
- Setiap langkah harus meninggalkan codebase dalam **kondisi build yang berjalan** (tidak ada TypeScript error yang tersisa di lapisan yang sudah diubah).
- Urutan ketat: **DB → Types → ACL → Guards → UI → Edge Fn → Audit → RLS** — tidak boleh dibalik karena setiap lapisan bergantung pada lapisan sebelumnya.

---

## LANGKAH-LANGKAH IMPLEMENTASI

### Langkah 1 — Migrasi Database: Tambah kolom `roles` & fungsi RLS baru

**Apa yang dilakukan:**  
Buat file migrasi SQL baru yang menambahkan kolom `profiles.roles text[]`, memigrasi data lama (termasuk memecah combined roles), dan membuat fungsi `current_access_roles()`. Kolom `role` lama tetap ada (backward compat).

**File yang dibuat/diubah:**
- **BUAT BARU:** `supabase/migrations/YYYYMMDD_add_roles_array.sql`

**Isi kunci migrasi:**
```sql
-- 1. Tambah kolom roles sebagai array
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS roles text[] DEFAULT '{}';

-- 2. Migrasi data: salin single role ke array untuk semua role biasa
UPDATE profiles
SET roles = ARRAY[role]
WHERE role IS NOT NULL
  AND role NOT IN ('admin_wilayah_bbm', 'admin_rencana_kerja_bbm');

-- 3. Pecah combined roles menjadi array dua role atomik
UPDATE profiles SET roles = ARRAY['admin_wilayah', 'admin_bbm']
  WHERE role = 'admin_wilayah_bbm';
UPDATE profiles SET roles = ARRAY['admin_rencana_kerja', 'admin_bbm']
  WHERE role = 'admin_rencana_kerja_bbm';

-- 4. Set NOT NULL setelah data terisi
ALTER TABLE profiles ALTER COLUMN roles SET NOT NULL;
ALTER TABLE profiles ALTER COLUMN roles SET DEFAULT '{}';

-- 5. Buat fungsi DB baru untuk RLS (pengganti current_access_role())
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

**Risiko backward-compat:**  
- `role` lama tetap ada — query lama yang melakukan `.select('role')` masih bekerja.  
- Fungsi `current_access_role()` lama tidak di-drop di langkah ini — RLS policy lama masih valid.

**Verifikasi:** Jalankan `supabase db push` atau terapkan migrasi di dashboard. Cek dengan `SELECT id, role, roles FROM profiles LIMIT 5` — kolom `roles` harus terisi array.

---

### Langkah 2 — TypeScript Types: `Profile` dan `AuthContext`

**Apa yang dilakukan:**  
Ubah interface `Profile` di `AuthContext.tsx` dari `role: UserRole` menjadi `roles: UserRole[]`. Ubah interface `AuthContext` di `permissions.ts` dari `role: UserRole | null` menjadi `roles: UserRole[]`. Setelah langkah ini TypeScript akan melaporkan error di semua tempat yang masih memakai `.role` — ini disengaja sebagai panduan kerja untuk langkah berikutnya.

**File yang diubah:**
- `src/context/AuthContext.tsx` — baris 8: `role: UserRole` → `roles: UserRole[]`
- `src/constants/permissions.ts` — baris 29: `role: UserRole | null` → `roles: UserRole[]`

**Baris kunci `AuthContext.tsx`:**
```ts
// SEBELUM (baris 7–16):
interface Profile {
  id: string;
  role: UserRole;
  ...
}

// SESUDAH:
interface Profile {
  id: string;
  roles: UserRole[];
  ...
}
```

**Baris kunci `permissions.ts`:**
```ts
// SEBELUM (baris 27–29):
export interface AuthContext {
  role: UserRole | null;
  ...
}

// SESUDAH:
export interface AuthContext {
  roles: UserRole[];
  ...
}
```

**Risiko backward-compat:**  
Perubahan ini **sengaja memecah** semua akses `profile.role` dan `ctx.role` agar TypeScript menunjukkan semua lokasi yang perlu diupdate. Jangan commit langkah ini tanpa segera melanjutkan ke langkah 3–9.

**Verifikasi:** `npm run build` (atau `pnpm build`) akan gagal dengan error TypeScript — ini **expected** dan berarti semua lokasi teridentifikasi.

---

### Langkah 3 — ACL Engine: `acl.ts` — loop semua roles

**Apa yang dilakukan:**  
Update `acl.ts` untuk membaca `ctx.roles[]` (bukan `ctx.role`) dan mengiterasi semua role. Akses diberikan jika **salah satu** role mengizinkan (OR logic). Update juga bagian yang membangun `AuthContext` dari `profile`.

**File yang diubah:**
- `src/lib/acl.ts` — baris 34–37 (build ctx) dan baris 60–67 (`hasPermission`)

**Baris kunci:**
```ts
// Baris 34–37 — build ctx (SESUDAH):
const ctx: AuthContext = {
  roles: (profile.roles ?? []) as UserRole[],
  id: session.user.id,
  regionId: profile.region_id ?? null,
  teamId: profile.team_id ?? null,
  email: session.user.email ?? null,
  resourceId: opts.resourceId ?? null,
  resourceRegionId: opts.resourceRegionId ?? null,
  resourceTeamId: opts.resourceTeamId ?? null,
};

// hasPermission() — SESUDAH (baris 60–67):
export function hasPermission(ctx: AuthContext, resource: Resource, action: Action): boolean {
  if (!ctx.roles || ctx.roles.length === 0) return false;
  for (const role of ctx.roles) {
    const perms = ROLE_PERMISSIONS[role] ?? [];
    const match = perms.find(p => p.resource === resource && p.action === action);
    if (match && (!match.condition || match.condition(ctx))) return true;
  }
  return false;
}
```

**Risiko backward-compat:**  
`ROLE_PERMISSIONS` (map `UserRole → Permission[]`) tidak perlu diubah strukturnya — ini sudah per-role dan tinggal diloop.

**Verifikasi:** `pnpm build` — error di `acl.ts` harus hilang.

---

### Langkah 4 — Predicate Functions: `access-control.ts`

**Apa yang dilakukan:**  
Ubah **semua** predicate function di `access-control.ts` — signature dari `role: string | null | undefined` menjadi `roles: UserRole[]`, dan semua `role === X` menjadi `roles.includes(X)`. Tambah helper baru `rolesRequireRegion()`. Untuk `getRoleLandingPath()` dan `getLoginDestination()` gunakan **strategi prioritas**: periksa role dalam urutan spesifisitas (admin → pimpinan → bbm-pusat → dst), ambil destinasi role pertama yang cocok.

**File yang diubah:**
- `src/constants/access-control.ts` — semua function dari baris 82 sampai akhir file

**Contoh pola perubahan (berlaku untuk semua predicate):**
```ts
// SEBELUM:
export const isSuperAdminAccess = (role: string | null | undefined, email?: string | null) =>
  role === USER_ROLES.ADMIN;

// SESUDAH:
export const isSuperAdminAccess = (roles: UserRole[], email?: string | null) =>
  roles.includes(USER_ROLES.ADMIN);

// SEBELUM:
export const isAdminBbmAccess = (role: string | null | undefined) =>
  role === USER_ROLES.ADMIN_BBM
  || role === USER_ROLES.ADMIN_BBM_PUSAT
  || role === USER_ROLES.ADMIN_RENCANA_KERJA_BBM
  || role === USER_ROLES.ADMIN_WILAYAH_BBM;

// SESUDAH:
export const isAdminBbmAccess = (roles: UserRole[]) =>
  roles.includes(USER_ROLES.ADMIN_BBM)
  || roles.includes(USER_ROLES.ADMIN_BBM_PUSAT);
  // Note: ADMIN_RENCANA_KERJA_BBM dan ADMIN_WILAYAH_BBM dihapus
  // karena user akan punya roles: ['admin_rencana_kerja','admin_bbm'] dst.
```

**Helper baru yang ditambahkan:**
```ts
export const rolesRequireRegion = (roles: UserRole[]) =>
  roles.some(r => (REGION_REQUIRED_ROLES as readonly string[]).includes(r));

// Helper untuk mendapatkan label semua role (dipakai UserManagement)
export const getRoleLabels = (roles: UserRole[]): string =>
  roles.map(r => getRoleLabel(r)).join(' + ');

// Helper untuk mendapatkan badge class dari role pertama yang dikenali
export const getPrimaryRoleBadgeClass = (roles: UserRole[]): string =>
  roles.length > 0 ? getRoleBadgeClass(roles[0]) : 'text-slate-600 border-slate-200 bg-slate-50';
```

**Strategi `getRoleLandingPath(roles)` dan `getLoginDestination(roles)`:**  
Periksa roles dengan urutan prioritas — jika `roles.includes(USER_ROLES.ADMIN)` → `/`, jika ada role BBM → halaman BBM, dst. Jika user punya multiple roles, tampilkan halaman Index (`/`) agar semua tab terlihat.

**Backward-compat: combined roles `admin_wilayah_bbm` dan `admin_rencana_kerja_bbm`**  
Setelah langkah 1 (migrasi DB) user dengan combined roles sudah punya `roles: ['admin_wilayah','admin_bbm']`, jadi pengecekan terhadap `USER_ROLES.ADMIN_WILAYAH_BBM` tidak lagi diperlukan di predicate functions. Konstanta tersebut tetap ada di `USER_ROLES` untuk backward compat TypeScript, tapi tidak digunakan di predicate.

**Verifikasi:** `pnpm build` — error di `access-control.ts` harus hilang.

---

### Langkah 5 — Route Guards: `App.tsx`

**Apa yang dilakukan:**  
Ganti semua akses `profile.role` di `App.tsx` dengan `profile.roles`. Update `ActivityTracker` audit log dari `role: profile.role` ke `role: profile.roles.join(',')`. Update semua inline guard yang memakai `profile.role === X` menjadi `profile.roles.includes(X)`. Hapus logika `isCombinedRkBbm` — tidak lagi diperlukan karena user sudah punya array roles atomik.

**File yang diubah:**
- `src/App.tsx` — baris 95, 140 (ActivityTracker), 175–176, 181, 199–200, 205, 237–238, 268–271, 295, 310, 321–322, 337–338, 349

**Pola perubahan kunci (8 route guards):**
```ts
// SEBELUM (baris 175–176):
const isCombinedRkBbm =
  profile.role === USER_ROLES.ADMIN_RENCANA_KERJA_BBM ||
  profile.role === USER_ROLES.ADMIN_WILAYAH_BBM;

// SESUDAH — hapus isCombinedRkBbm, periksa langsung:
// User yang punya [admin_rencana_kerja, admin_bbm] atau
// [admin_wilayah, admin_bbm] sudah tercakup oleh helper functions.

// SEBELUM (audit log baris 95):
role: profile.role,

// SESUDAH:
role: profile.roles.join(','),

// SEBELUM (baris 268–271):
profile?.role === USER_ROLES.ADMIN ||
profile?.role === USER_ROLES.ADMIN_SPJ_BBM || ...

// SESUDAH:
profile?.roles.includes(USER_ROLES.ADMIN) ||
profile?.roles.includes(USER_ROLES.ADMIN_SPJ_BBM) || ...
```

**Verifikasi:** `pnpm build` — error di `App.tsx` harus hilang.

---

### Langkah 6 — `AuthorizeRoute.tsx`: pass `roles` ke `AuthContext`

**Apa yang dilakukan:**  
Ganti satu baris di `AuthorizeRoute.tsx` baris 47: `role: profile?.role ?? null` menjadi `roles: profile?.roles ?? []`.

**File yang diubah:**
- `src/components/AuthorizeRoute.tsx` — baris 47

**Perubahan:**
```ts
// SEBELUM:
const ctx: AuthContext = {
  role: profile?.role ?? null,
  ...
};

// SESUDAH:
const ctx: AuthContext = {
  roles: profile?.roles ?? [],
  ...
};
```

**Verifikasi:** `pnpm build` — tidak ada error baru.

---

### Langkah 7 — `UserManagement.tsx`: multi-select checkbox UI + handlers

**Apa yang dilakukan:**  
Ini adalah langkah terbesar di sisi UI. Ubah interface lokal `Profile`, `UserFormState`, `EditUserFormState` dari `role: UserRole` ke `roles: UserRole[]`. Ganti semua `<Select value={...role}>` menjadi **checkbox multi-select** (sesuai permintaan user asli). Update semua handler (`handleCreateUser`, `handleSaveProfile`, `openEditProfile`). Update `canMutateUsers` pakai `isSuperAdminAccess(currentProfile?.roles ?? [], ...)`. Tampilkan label gabungan dengan `getRoleLabels(profile.roles)`.

**File yang diubah:**
- `src/components/UserManagement.tsx` — baris 51 (interface Profile), baris 75 (UserFormState), baris 83 (EditUserFormState), baris 118 (canMutateUsers), baris 151/153 (state init), baris ~209–235 (handleCreateUser), baris ~380 (openEditProfile), baris ~394–418 (handleSaveProfile), baris ~501 (form Buat Akun), baris ~601 (tabel inline edit)

**Aturan bisnis multi-select (wajib dijaga):**
- `USER_ROLES.ADMIN` jika dipilih → **disable semua pilihan lain** (admin sudah lengkap sebagai pengendali)
- `USER_ROLES.PIMPINAN` jika dipilih → disable semua pilihan lain
- Setidaknya **1 role harus dipilih** (validasi sebelum submit)
- Region wajib diisi jika `rolesRequireRegion(selectedRoles)` true

**Contoh komponen multi-select:**
```tsx
{/* Ganti <Select value={role}> dengan checkbox group */}
<div className="grid grid-cols-2 gap-2">
  {ACCESS_OPTIONS.map(option => (
    <label key={option.value} className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={formState.roles.includes(option.value as UserRole)}
        disabled={
          // Admin/Pimpinan jika dipilih → lock semua checkbox lain
          (formState.roles.includes(USER_ROLES.ADMIN) && option.value !== USER_ROLES.ADMIN) ||
          (formState.roles.includes(USER_ROLES.PIMPINAN) && option.value !== USER_ROLES.PIMPINAN)
        }
        onChange={() => {
          const newRoles = toggleRole(formState.roles, option.value as UserRole);
          setFormState(prev => ({ ...prev, roles: newRoles }));
        }}
      />
      <span>{option.label}</span>
    </label>
  ))}
</div>
```

**Verifikasi:** `pnpm build` — tidak ada error baru. Buka halaman `/` tab Admin → form Buat Akun menampilkan checkbox.

---

### Langkah 8 — Edge Function `create-user/index.ts`

**Apa yang dilakukan:**  
Ubah `CreateUserInput.role: string` menjadi `roles: string[]`. Update validasi untuk mengecek setiap role di array (bukan satu string). Update logika `assignedRegionId` untuk menggunakan intersection dengan `regionRequiredRoles`. Update insert profil ke `roles: input.roles`. Update cek otorisasi caller dari `callerProfile?.role !== 'admin'` ke `!callerProfile?.roles?.includes('admin')`.

**File yang diubah:**
- `supabase/functions/create-user/index.ts` — baris ~22 (type), ~97 (caller check), ~100–115 (validasi), ~115 (derived regionId), ~175 (insert)

**Baris kunci:**
```ts
// Type (SESUDAH):
type CreateUserInput = {
  email: string;
  password: string;
  username: string;
  roles: string[];   // array, bukan single string
  regionId?: string | null;
  teamId?: string | null;
  workPlanCategories?: string[];
};

// Caller auth check (SESUDAH):
if (!callerProfile?.roles?.some((r: string) => r === 'admin')) {
  return errorResponse(403, 'Hanya admin yang boleh membuat user.');
}

// Validasi roles (SESUDAH):
if (!Array.isArray(input.roles) || input.roles.length === 0) {
  return errorResponse(400, 'Minimal satu role harus dipilih.');
}
for (const r of input.roles) {
  if (!validRoles.has(r as keyof typeof USER_ROLES)) {
    return errorResponse(400, `Role tidak valid: ${r}`);
  }
}

// Region logic (SESUDAH):
const needsRegion = input.roles.some(r => regionRequiredRoles.has(r as never));
const assignedRegionId = needsRegion ? (input.regionId ?? null) : null;

// Insert (SESUDAH):
roles: input.roles,
```

**Verifikasi:** Deploy edge function (`supabase functions deploy create-user`) lalu coba buat user baru dari UI — tidak ada error 400/403.

---

### Langkah 9 — `auditLogService.ts`: serialize `roles[]` ke string

**Apa yang dilakukan:**  
Tambah helper `serializeRoles()` dan ganti semua tempat yang query kolom `role` menjadi query `roles`, lalu serialize ke string untuk kolom `role` di tabel `audit_logs`. Tabel `audit_logs` tidak perlu diubah — kolom `role text` tetap ada.

**File yang diubah:**
- `src/services/auditLogService.ts` — baris 39–42, baris 108, baris 118

**Perubahan:**
```ts
// Tambah helper di atas file:
const serializeRoles = (roles: string[] | null | undefined): string | null =>
  roles && roles.length > 0 ? roles.join(',') : null;

// Baris 39–42 (SESUDAH):
const { data: profile } = await supabase
  .from('profiles')
  .select('roles')        // ← query kolom roles (array)
  .eq('id', user.id)
  .maybeSingle();
role = serializeRoles(profile?.roles) || null;

// Baris 108 dan 118 (SESUDAH):
// Ganti: role: profile?.role
// Dengan: role: serializeRoles(profile?.roles)
```

**Verifikasi:** `pnpm build` — tidak ada error baru. Cek tabel `audit_logs` setelah login — kolom `role` berisi string seperti `"admin_wilayah,admin_bbm"`.

---

### Langkah 10 — Migrasi RLS: `has_record_access()` pakai `current_access_roles()`

**Apa yang dilakukan:**  
Buat file migrasi SQL baru yang me-rewrite `has_record_access()` untuk menggunakan `current_access_roles()` (array) sebagai ganti `current_access_role()` (single string). Setiap `public.current_access_role() = 'xxx'` diganti dengan `'xxx' = ANY(public.current_access_roles())`. Trigger `assign_region_from_profile()` juga diupdate. Setelah migrasi ini berjalan, `current_access_role()` lama bisa di-drop dan kolom `role` lama bisa di-drop.

**File yang dibuat:**
- **BUAT BARU:** `supabase/migrations/YYYYMMDD_rls_use_roles_array.sql`

**Isi kunci migrasi:**
```sql
-- Rewrite has_record_access() menggunakan array roles
CREATE OR REPLACE FUNCTION public.has_record_access(
  resource text,
  target_region text,
  target_team text,
  action text
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false

    -- Super Admin
    WHEN 'admin' = ANY(public.current_access_roles()) THEN true

    -- Pimpinan
    WHEN 'pimpinan' = ANY(public.current_access_roles())
      THEN action IN ('select', 'update')

    -- Admin Wilayah (termasuk user yang punya role ini sebagai salah satu dari array)
    WHEN 'admin_wilayah' = ANY(public.current_access_roles())
      THEN target_region = public.current_access_region()

    -- Admin Laporan (role: laporan)
    WHEN 'laporan' = ANY(public.current_access_roles())
      THEN resource = 'reports'
       AND target_region = public.current_access_region()

    -- Admin Rencana Kerja
    WHEN 'admin_rencana_kerja' = ANY(public.current_access_roles())
      THEN resource = 'work_plans'

    -- User tim
    WHEN 'user' = ANY(public.current_access_roles())
      THEN resource IN ('reports', 'work_plans')
       AND target_region = public.current_access_region()
       AND target_team = public.current_access_team()

    ELSE false
  END
$$;

-- Update trigger assign_region_from_profile
-- Ganti: public.current_access_role() IN (...)
-- Dengan: EXISTS (SELECT 1 FROM unnest(public.current_access_roles()) r WHERE r IN (...))

-- Drop kolom role lama (aman setelah semua lapisan pakai roles)
-- ALTER TABLE profiles DROP COLUMN role;
-- DROP FUNCTION IF EXISTS public.current_access_role();
-- (baris di atas dikomen dulu — uncomment setelah verifikasi penuh)
```

**Risiko backward-compat kritis:**  
Fungsi RLS ini berjalan **di server Supabase** — error di sini mengakibatkan semua akses data ditolak. Jalankan di environment staging dulu sebelum production. Perintah DROP dikomentari sampai tim yakin tidak ada klien lama.

**Verifikasi:** Terapkan migrasi, lalu login sebagai user dengan `roles: ['admin_wilayah']` dan verifikasi bisa baca/tulis laporan di wilayahnya. Login sebagai admin dan verifikasi bisa akses semua.

---

## RINGKASAN FILE YANG DIUBAH

| # | File | Jenis | Baris Kunci |
|---|------|-------|-------------|
| 1 | `supabase/migrations/YYYYMMDD_add_roles_array.sql` | BARU | Seluruh file |
| 2 | `src/context/AuthContext.tsx` | UBAH | 8, 157 |
| 3 | `src/constants/permissions.ts` | UBAH | 29 |
| 4 | `src/lib/acl.ts` | UBAH | 34–37, 60–67 |
| 5 | `src/constants/access-control.ts` | UBAH | 82–243 (semua predicate) |
| 6 | `src/App.tsx` | UBAH | 95, 140, 175–176, 181, 199–200, 205, 237–238, 268–271, 295, 310, 321–322, 337–338, 349 |
| 7 | `src/components/AuthorizeRoute.tsx` | UBAH | 47 |
| 8 | `src/components/UserManagement.tsx` | UBAH BESAR | 51, 75, 83, 118, 151/153, ~209–235, ~380, ~394–418, ~501, ~601 |
| 9 | `supabase/functions/create-user/index.ts` | UBAH | ~22, ~97, ~100–115, ~115, ~175 |
| 10 | `src/services/auditLogService.ts` | UBAH MINOR | 39–42, 108, 118 |
| 11 | `supabase/migrations/YYYYMMDD_rls_use_roles_array.sql` | BARU | Seluruh file |

---

## RISIKO BACKWARD-COMPAT YANG HARUS DIJAGA

### 1. Combined Roles (`admin_wilayah_bbm`, `admin_rencana_kerja_bbm`)
- **Risiko:** User lama dengan role string ini di DB akan punya `roles: []` kosong jika migrasi SQL gagal/dilewati.
- **Mitigasi:** Langkah 1 secara eksplisit menangani kedua role ini. Pastikan `UPDATE profiles SET roles = ARRAY[...]` dijalankan sebelum `ALTER COLUMN roles SET NOT NULL`.
- **Konstanta:** `USER_ROLES.ADMIN_WILAYAH_BBM` dan `USER_ROLES.ADMIN_RENCANA_KERJA_BBM` tetap ada di TypeScript untuk sementara agar tidak ada TypeScript error di kode lama yang mungkin masih referencing mereka — hapus di cleanup pass berikutnya.

### 2. Kolom `role` Lama di DB
- **Risiko:** Audit log query `select('role')` akan gagal jika kolom di-drop terlalu cepat.
- **Mitigasi:** Kolom `role` tidak di-drop sampai **semua** lapisan sudah diverifikasi menggunakan `roles`. Langkah 10 mengomen baris DROP — harus di-uncomment secara manual setelah verifikasi penuh.

### 3. Edge Function — Sinkronisasi `USER_ROLES`
- **Risiko:** Edge Function `create-user/index.ts` punya copy lokal `USER_ROLES` yang harus identik dengan `src/constants/access-control.ts`.
- **Mitigasi:** Update keduanya bersamaan di langkah 8. Jika `admin_wilayah_bbm` / `admin_rencana_kerja_bbm` dihapus dari `USER_ROLES` di frontend, hapus juga di Edge Function (atau biarkan ada tapi tidak bisa dipilih dari UI karena sudah tidak ada di `ACCESS_OPTIONS`).

### 4. RLS Policy di Langkah 10
- **Risiko:** Fungsi `has_record_access()` adalah security-critical — kesalahan rewrite menyebabkan data leak atau semua akses ditolak.
- **Mitigasi:** Jalankan di Supabase staging environment dulu. Tulis SQL test cases manual: `SELECT has_record_access('reports', 'region-uuid', null, 'select')` sebagai setiap jenis role sebelum push ke production.

### 5. `ROLE_PERMISSIONS` Map di `permissions.ts`
- **Risiko:** Map ini menggunakan `UserRole` sebagai key — jika combined roles dihapus dari `USER_ROLES` tapi masih ada sebagai key di `ROLE_PERMISSIONS`, TypeScript akan error.
- **Mitigasi:** Periksa `ROLE_PERMISSIONS` apakah ada entry untuk `admin_wilayah_bbm` / `admin_rencana_kerja_bbm`. Jika ada, hapus entry tersebut bersamaan dengan langkah 4.

### 6. Audit Log — Format `role` di `audit_logs`
- **Risiko:** Log lama menyimpan single role string (misal `"admin_wilayah"`). Log baru akan menyimpan `"admin_wilayah,admin_bbm"`. Jika ada query/filter yang mematch exact string, akan gagal.
- **Mitigasi:** Kolom `role` di `audit_logs` hanya untuk display/debug — tidak ada query filter kritis berdasarkan kolom ini. Format baru `join(',')` diterima.

---

## URUTAN COMMIT YANG DIREKOMENDASIKAN

```
commit 1: DB migration — add roles column, migrate data
commit 2: TypeScript types (AuthContext.tsx + permissions.ts)
commit 3: ACL engine (acl.ts)
commit 4: Access control predicates (access-control.ts)  
commit 5: Route guards (App.tsx) + AuthorizeRoute.tsx
commit 6: UserManagement.tsx — multi-select UI
commit 7: Edge Function (create-user/index.ts)
commit 8: Audit log serialize (auditLogService.ts)
commit 9: RLS migration — has_record_access() rewrite
```

Setiap commit harus dalam kondisi **build berhasil** kecuali commit 2 (TypeScript types) yang boleh meninggalkan error sementara — tapi commit 2 dan 3 sebaiknya digabung dalam satu commit karena commit 2 saja akan break build.
