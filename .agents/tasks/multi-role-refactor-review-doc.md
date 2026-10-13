# Multi-Role Refactor — Semantic Review

Sistem diubah dari single-role (`profile.role: string`) menjadi multi-role (`profile.roles: string[]`) dengan 11 permission keys atomik. Pendekatan yang diambil adalah dual-path: kode lama yang menggunakan `profile.role` tetap berjalan sebagai fallback, sementara path baru menggunakan `profile.roles` dengan OR semantics. Migrasi SQL memetakan semua combined roles lama ke array atomik dan mengganti `current_access_role()` dengan `current_access_roles()` beserta `has_record_access()` yang ditulis ulang.

Watch for: (1) **Scope regresi `rencana_kerja`** — permission key baru `rencana_kerja` di-map ke permission per-region, tapi legacy `ADMIN_RENCANA_KERJA` bersifat global; user yang di-migrasi dari `admin_rencana_kerja` akan kehilangan akses global secara diam-diam. (2) **Halaman-halaman `src/pages/` tidak disentuh** — `FuelReportList`, `SpjOli`, `SpjOliRecap`, `DailyRecap`, `WeeklyRecap`, dan lainnya masih menggunakan `profile?.role` (single-string) untuk logika filter data, bukan hanya route guard. (3) **Form pembuatan akun baru mengirim `role` legacy yang bisa tidak sinkron** dengan `roles[]` yang diklik user.

**Verdict**: NEEDS_CHANGES

---

## High-level view

Lapisan core (acl.ts, permissions.ts, AuthContext, AuthorizeRoute) sudah benar: `hasPermission()` melakukan loop semua roles dengan OR semantics dan fallback ke `role` tunggal. Migrasi SQL memiliki ketergantungan yang benar (prefix `zzz`), memetakan semua legacy roles ke array, dan menyediakan `current_access_roles()` + `has_record_access()` baru.

Route guards di `App.tsx` sudah dual-path: jika `profile.roles.length > 0` gunakan predicate baru, kalau tidak fallback ke predicate lama. Pola ini aman selama periode transisi tapi menyisakan dua jalur logika yang harus dijaga sinkron secara manual selamanya.

Ada regresi semantik yang confirmed antara permission key `rencana_kerja` (baru) dan role `ADMIN_RENCANA_KERJA` (lama). Key baru sengaja di-scope ke region, sementara role lama bersifat global. User yang di-migrasi dari `admin_rencana_kerja` tidak punya `region_id` di profil — mereka akan kehilangan akses ke semua work_plans setelah migrasi berjalan, tanpa peringatan di SQL.

Halaman-halaman di `src/pages/` (FuelReportList, SpjOli, SpjOliRecap, DailyRecap, WeeklyRecap, MonthlyRecap, WorkPlanDailyRecap, dll) tidak disentuh dan masih menggunakan `profile?.role` (single-string) untuk logika filter data. Yang lebih kritis: `canAccess()` di `SpjOli.tsx` dan `SpjOliRecap.tsx` hardcode string legacy `['admin_spj_bbm', 'admin_spj_oli', 'pimpinan']` — user dengan `profile.role = 'administrator'` (new key) yang sudah melewati `SpjOliRoute` guard akan mendapat halaman kosong karena `canAccess` return false di baris 261.

UI UserManagement memiliki dua picker role berdampingan: Select dropdown (legacy) dan checkbox multi-select. Tidak ada sinkronisasi visual antara keduanya. Selain itu, validasi `disabled` pada tombol submit mengecek `newUser.role` (dropdown), bukan `newUser.roles` (checkbox) — button bisa aktif padahal region belum diisi. Dan optimistic update di tabel menggunakan `newUser.role` (dropdown awal) bukan `effectiveRoles[0]`, sehingga tabel menampilkan role salah sampai `fetchProfiles()` selesai.

---

<details>
<summary>Issues (5)</summary>

1. **Regresi scope `rencana_kerja`** — User yang di-migrasi dari `admin_rencana_kerja` (global) ke key baru `rencana_kerja` akan kehilangan akses ke work_plans di luar region mereka secara diam-diam. Migrasi SQL harus menambahkan peringatan atau menggunakan key terpisah `rencana_kerja_global` untuk eks-`ADMIN_RENCANA_KERJA`, ATAU `ROLE_PERMISSIONS_EXTENDED['rencana_kerja']` harus tanpa condition (global), dengan scoping diserahkan ke form saat assign region.

2. **Halaman `src/pages/` masih single-role untuk logika filter data** — `FuelReportList` (baris 157–167), `SpjOli` (baris 89–91, 130), `SpjOliRecap` (baris 43, 171), `DailyRecap`, `WeeklyRecap`, `MonthlyRecap`, `FuelDailyRecap`, `FuelWeeklyRecap`, `FuelMonthlyRecap`, `FuelYearlyRecap`, `WorkPlanDailyRecap` semua menggunakan `profile?.role` (single-string) untuk menentukan region filter, `isAdmin` flag, dan tampilan kolom. User multi-role dengan `roles = ['laporan_kerja', 'rencana_kerja']` akan menjalani logika filter berdasarkan `profile.role = 'laporan_kerja'` (roles[0]) saja — tidak ada bug akses, tapi behavior bisa mengejutkan jika `roles[0]` bukan role yang paling relevan untuk halaman tersebut.

3. **`canAccess()` di SpjOli.tsx dan SpjOliRecap.tsx masih hardcode string lama** — `SpjOli.tsx` baris 25 mendefinisikan `const canAccess = (role) => ['admin_spj_bbm', 'admin_spj_oli', 'pimpinan'].includes(role)`. User dengan `roles = ['administrator']` atau `roles = ['spj_oli']` dan `profile.role = 'administrator'` akan melewati `SpjOliRoute` guard dengan benar, tapi jika fungsi `canAccess` dalam halaman ikut diperiksa (baris 130, 261), akses bisa ditolak untuk `administrator` yang masuk via new-key path. Sama di `SpjOliRecap.tsx` baris 23.

4. **Form pembuatan akun: dua picker role bisa tampak tidak sinkron** — UI menampilkan Select dropdown (legacy) dan checkbox multi-select berdampingan. Tidak ada mekanisme yang memaksa keduanya konsisten secara visual — admin bisa melihat dropdown menunjukkan "Admin Wilayah" sementara checkbox menunjukkan `laporan_kerja + rencana_kerja`, padahal keduanya secara fungsional setara. Ini membingungkan secara UX. Pertimbangkan menyembunyikan dropdown legacy atau membuatnya read-only (reflect roles[0]) ketika roles[] terisi.

5. **`handleCreateUser` di UserManagement.tsx mengirim `role: newUser.role` dan `roles: newUser.roles` yang mungkin tidak mencerminkan roles[0]** — Jika user hanya mengisi dropdown (tidak menyentuh checkbox), `newUser.roles` akan kosong dan Edge Function akan fallback ke `[input.role]`. Ini benar. Tapi jika user mengisi checkbox, `newUser.role` (dropdown) masih memegang nilai awal `USER_ROLES.ADMIN_WILAYAH` — Edge Function mengabaikannya karena `roles[]` ada, tapi lokal state setelah submit akan di-reset ke `role: USER_ROLES.ADMIN_WILAYAH` tanpa mencerminkan pilihan checkbox. Efek samping: `setProfiles()` optimistic update di baris ~240 menggunakan `role: newUser.role` (bukan `effectiveRoles[0]`), sehingga tabel langsung menampilkan role yang salah sampai `fetchProfiles()` selesai.

</details>

---

<details>
<summary>Details</summary>

## Regresi scope `rencana_kerja` vs `ADMIN_RENCANA_KERJA`

Migrasi SQL memetakan `admin_rencana_kerja` → `roles = ARRAY['rencana_kerja']`. Di `ROLE_PERMISSIONS_EXTENDED`, key `rencana_kerja` sengaja diberi permission dengan condition `ctx.regionId === ctx.resourceRegionId` (region-scoped), berbeda dari `ROLE_PERMISSIONS[USER_ROLES.ADMIN_RENCANA_KERJA]` yang tanpa condition (global semua wilayah).

Komentar di kode mengakui ini: *"ADMIN_RENCANA_KERJA (legacy) gives global access; the new 'rencana_kerja' key intentionally restricts to the user's region."* Alasannya adalah agar `admin_wilayah` yang di-split ke `[laporan_kerja, rencana_kerja]` tidak otomatis mendapat akses global work_plans.

Masalahnya: user yang sebelumnya punya `admin_rencana_kerja` (global) setelah migrasi mendapat `rencana_kerja` (regional). Mereka **tidak punya region** di profil karena `admin_rencana_kerja` tidak butuh region. Sehingga condition `ctx.regionId === ctx.resourceRegionId` akan selalu `null === <uuid>` → false → akses ditolak untuk semua record. User ini secara efektif kehilangan semua akses write ke work_plans setelah migrasi berjalan.

Ini adalah **confirmed regression** berdasarkan SQL migration baris:
```sql
UPDATE profiles SET roles = ARRAY['rencana_kerja'] WHERE role = 'admin_rencana_kerja' AND ...
```
dan permission definition di `permissions.ts`:
```ts
ROLE_PERMISSIONS_EXTENDED['rencana_kerja'] = [
  { resource: 'work_plans', action: 'read', condition: ctx => ctx.regionId === ctx.resourceRegionId },
  ...
]
```

User `admin_rencana_kerja` yang tidak punya `region_id` akan mendapat `ctx.regionId = null`, sehingga `null === <uuid>` → false.

## Halaman `src/pages/` masih single-role untuk filter data

Scope refactor ini hanya menyentuh lapisan core (auth, ACL, route guards) dan `UserManagement`. Halaman-halaman operasional tidak diubah. Ini adalah keputusan yang bisa dipahami sebagai langkah bertahap, **tetapi** dampaknya perlu dipahami:

Setelah migrasi, `profile.role` berisi `effectiveRoles[0]` (dari Edge Function) atau `roles[0]` jika diset via dialog Edit. Untuk user yang punya satu role, ini tidak bermasalah. Untuk user multi-role:

- `FuelReportList.tsx` baris 157–167: `isAdminBbm = isAdminBbmAccess(profile?.role)` — jika `profile.role = 'laporan_kerja'` (karena itu roles[0]) tapi user juga punya `bbm`, maka `isAdminBbm` akan false dan `fuelRegionId` akan dihitung salah.
- `SpjOli.tsx` baris 25: `canAccess` hardcode mengecek string legacy `['admin_spj_bbm', 'admin_spj_oli', 'pimpinan']`. User dengan `roles = ['administrator']` dan `profile.role = 'administrator'` akan **lolos `SpjOliRoute` guard** (yang sudah multi-role) tapi jika `canAccess(profile?.role)` juga diperiksa di dalam halaman, `administrator` tidak ada di list → `canAccess` returns false → `if (!canAccess(...)) return null` (baris 261) → halaman kosong.

Konfirmasi: `SpjOli.tsx` baris 261 memanggil `if (!canAccess(profile?.role, session?.user?.email)) return null` — ini akan blank-render untuk user `administrator` yang sudah di-migrasi ke key baru jika `profile.role` berisi `'administrator'` (bukan `'admin'`).

## Dual-path route guards dan risiko divergensi jangka panjang

Setiap route guard di `App.tsx` memiliki pola `profileRoles.length > 0 ? newPredicate(profileRoles) : oldPredicate(profile.role)`. Risikonya adalah kedua path bisa divergen jika salah satunya diupdate tanpa update yang lain — tidak ada mekanisme (test, lint, type) yang memaksa mereka tetap sinkron.

`isCombinedRkBbmLegacy` di `ProtectedRoute` dan `WorkPlanWriteRoute` sudah redundant setelah migrasi SQL — user tersebut akan punya `roles = ['laporan_kerja','rencana_kerja','bbm']` sehingga `isCombinedRkBbm` (new-path) sudah true. Tapi tidak berbahaya selama `profile.role` lama masih ada.

## Trigger `assign_region_from_profile` dan eks-`admin_rencana_kerja`

`rencana_kerja` ada di daftar region-requiring roles dalam trigger, artinya jika user eks-`admin_rencana_kerja` (tanpa region di profil) membuat record baru, trigger tidak akan mengisi `region_id` otomatis karena `user_region_id` null. Record akan tersimpan tanpa region — ini adalah side effect dari regresi scope yang sama seperti di `hasPermission()`.

## UserManagement: form pembuatan akun — dua masalah

Dua masalah tetap ada:

Pertama, validasi submit button di baris akhir form:
```tsx
disabled={... || (roleRequiresRegion(newUser.role) && !newUser.regionId) || ...}
```
Ini mengecek `newUser.role` (legacy dropdown), bukan `newUser.roles` (checkbox). Jika user mengisi roles[] via checkbox dengan key yang butuh region tapi tidak menyentuh dropdown, button submit tidak akan disabled meski region belum diisi — validasi sebenarnya dilakukan di Edge Function, jadi tidak akan crash, tapi UX button disable tidak bekerja.

Kedua, optimistic update di `handleCreateUser`:
```ts
role: newUser.role,   // ← ini adalah nilai dropdown, bukan effectiveRoles[0]
roles: newUser.roles.length > 0 ? newUser.roles : [newUser.role],
```
Jika roles[] diisi via checkbox, `newUser.role` masih menunjuk nilai dropdown awal. Tabel akan menampilkan role salah sampai `fetchProfiles()` selesai (beberapa ratus ms).

## Test coverage

Tidak ada file test yang ditemukan di scope refactor ini. Perubahan kritis seperti `hasPermission()` OR semantics, mapping `ROLE_PERMISSIONS_EXTENDED`, dan migrasi SQL tidak memiliki unit test yang dapat diverifikasi.

</details>

---

<details>
<summary>File map</summary>

| File | Perubahan |
|------|-----------|
| `supabase/migrations/20261008_zzz_multi_role_refactor.sql` | Tambah kolom `roles text[]`, migrasi data semua legacy roles, fungsi `current_access_roles()`, `has_role()`, tulis ulang `has_record_access()` dan `assign_region_from_profile()` |
| `src/constants/access-control.ts` | Tambah 11 `PermissionKey`, `PERMISSION_LABELS`, predicate functions versi `*Roles(roles[])`, `canAccessAllSpjOliRoles()` |
| `src/constants/permissions.ts` | `AuthContext.roles: UserRole[]` (primary), `role` jadi deprecated optional; `ROLE_PERMISSIONS_EXTENDED` memetakan 11 new keys ke permission arrays |
| `src/lib/acl.ts` | `hasPermission()` loop semua roles, OR semantics; fallback ke legacy `ctx.role` |
| `src/context/AuthContext.tsx` | `Profile.roles: string[]` ditambahkan; `signOut` serialize roles ke string untuk audit log |
| `src/components/AuthorizeRoute.tsx` | `ctx.roles` dari `profile.roles`, `role` sebagai backward compat |
| `src/App.tsx` | Semua route guards dual-path: new-key predicates jika `profile.roles.length > 0`, fallback legacy |
| `src/components/UserManagement.tsx` | Multi-select checkbox UI, `handleRoleToggle`, form state `roles: string[]`, `handleSaveProfile` dual-validation |
| `supabase/functions/create-user/index.ts` | Terima `roles[]`, validasi per-key, derive `legacyRole = effectiveRoles[0]`, caller check pakai array |
| `src/services/auditLogService.ts` | `serializeRoles()` helper, query `roles` dari DB, fallback ke `role` |

</details>
