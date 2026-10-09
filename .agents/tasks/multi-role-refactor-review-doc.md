# Multi-Role Refactor: single `role` → `roles[]` dengan 11 permission keys

Refactor ini mengubah sistem otorisasi dari satu string role per user menjadi array permission keys. Kolom `role` lama di DB dipertahankan untuk backward compat; kolom `roles text[]` baru ditambahkan dan diisi ulang melalui migrasi data. Sebelas permission key atomik (`administrator`, `pimpinan`, `laporan_kerja`, `rencana_kerja`, `rekap_lembur`, `bbm`, `bbm_pusat`, `laporan_bbm`, `spj_oli`, `nota_dinas`, `pengguna_tim`) menggantikan empat "combined role" lama (`admin_wilayah_bbm`, `admin_rencana_kerja_bbm`, dll). Semua lapisan — TypeScript types, ACL engine, route guards, UI form, Edge Function, dan DB functions — telah diperbarui.

Watch for: (1) `current_access_role()` (singular) masih aktif di DB dan dipakai oleh `has_record_access()` dan trigger `assign_region_from_profile()` dalam `20261008_cleanup_rls_dead_code.sql` — migrasi multi-role menimpa ulang kedua fungsi ini, tapi kedua migrasi memiliki timestamp sama sehingga urutan eksekusi menjadi non-deterministic; (2) inline quick-edit role dropdown di tabel UserManagement.tsx menulis `roles: [role]` (single-element array) sehingga menghapus multi-role state user yang sudah punya lebih dari satu key; (3) `admin_spj_bbm` dan `admin_spj_oli` keduanya dipetakan ke `spj_oli` — satu key tidak cukup untuk membedakan scope akses kedua role lama tersebut.

**Verdict**: NEEDS_CHANGES

---

## High-level view

Migrasi SQL multi-role menulis ulang `has_record_access()` dan `assign_region_from_profile()` dengan semantik array. Masalahnya adalah `20261008_cleanup_rls_dead_code.sql` juga menulis ulang kedua fungsi yang sama dengan semantik `current_access_role()` lama, dan kedua file memiliki prefix tanggal yang identik (`20261008_`). Supabase menjalankan migrasi berdasarkan urutan abjad nama file; `cleanup_rls_dead_code` mendahului `multi_role_refactor`, artinya migrasi multi-role yang benar selalu menang — tetapi ketergantungan urutan ini tidak terdokumentasi dan rapuh terhadap rename file.

`hasPermission()` di `acl.ts` sudah benar: ia loop semua `ctx.roles` dengan OR semantics, dengan fallback ke `ctx.role` tunggal untuk user lama. `AuthorizeRoute` dan semua guard di `App.tsx` menggunakan `profile.roles` sebagai jalur utama, dengan fallback ke `profile.role` — backward compat terjaga.

Dua masalah UI di UserManagement perlu perhatian. Quick-edit dropdown di baris tabel memanggil `handleUpdateProfile` dengan `roles: [role]` — satu elemen — yang menghapus array multi-role user yang ada. Ini hanya berdampak ketika admin mengubah role via dropdown cepat, bukan melalui dialog edit lengkap, tetapi efeknya merusak data multi-role tanpa peringatan. Selain itu, form `handleCreateUser` mengirim `role: newUser.role` ke Edge Function sebagai field utama, di mana nilai ini masih berasal dari legacy `ACCESS_OPTIONS` dropdown — jika checkbox multi-role yang diisi tetapi legacy dropdown dibiarkan pada nilai default, `role` yang tersimpan di DB bisa tidak konsisten dengan `roles[]`.

SQL migration memetakan `admin_spj_bbm` dan `admin_spj_oli` ke `spj_oli` yang sama. Satu key `spj_oli` tidak bisa merepresentasikan perbedaan akses antara keduanya: `admin_spj_bbm` di legacy memberikan akses SPJ Oli ke semua wilayah tanpa kondisi region, sementara `admin_spj_oli` memberikan akses ke semua wilayah hanya jika tidak ada region (atau region sendiri). `ROLE_PERMISSIONS['spj_oli']` memakai kondisi `!ctx.regionId || ctx.regionId === ctx.resourceRegionId` — identik dengan `ADMIN_SPJ_OLI` — sehingga user yang sebelumnya `admin_spj_bbm` kehilangan perbedaan semantik akses mereka setelah migrasi.

---

<details>
<summary>Issues (4)</summary>

1. **Urutan migrasi non-deterministic** — `20261008_cleanup_rls_dead_code.sql` dan `20261008_multi_role_refactor.sql` memiliki prefix tanggal identik. Urutan alfabetik (`cleanup` < `multi`) saat ini menguntungkan (multi_role_refactor menang), tapi rename salah satu file akan membalik urutan dan membuat DB kembali ke semantik single-role. Rename salah satu file dengan suffix yang lebih tinggi (misalnya `20261008_zz_multi_role_refactor.sql`) atau tambahkan komentar eksplisit yang mendokumentasikan ketergantungan.

2. **Quick-edit role dropdown menghapus multi-role state** — `handleUpdateProfile(profile.id, { role, roles: [role], ... })` di tabel UserManagement menulis ulang `roles` menjadi array satu elemen. User yang punya `['laporan_kerja','rencana_kerja']` akan kehilangan `rencana_kerja` jika admin menyentuh dropdown ini. Hapus quick-edit dropdown dari tabel atau ubah agar hanya menulis `role` (legacy field) tanpa menyentuh `roles`.

3. **`admin_spj_bbm` dan `admin_spj_oli` dilebur ke satu key** — SQL migration memetakan keduanya ke `spj_oli`, tetapi `admin_spj_bbm` legacy memberi akses tanpa kondisi region sementara `admin_spj_oli` bersifat global hanya jika tidak ada region. Setelah migrasi, semua user `admin_spj_bbm` akan mendapat kondisi `!ctx.regionId || ctx.regionId === ctx.resourceRegionId` — berbeda dengan akses global penuh mereka sebelumnya. Pertimbangkan dua key terpisah (`spj_bbm` dan `spj_oli`) atau buat kondisi di `ROLE_PERMISSIONS['spj_oli']` yang mengabaikan region jika user adalah eks-`admin_spj_bbm`.

4. **`handleCreateUser` tetap mengirim legacy `role` sebagai primary field** — Form create user mengirim `role: newUser.role` yang berasal dari dropdown `ACCESS_OPTIONS` lama, bersamaan dengan `roles: newUser.roles`. Jika admin mengisi checkbox multi-role tetapi lupa mengatur dropdown legacy, DB akan menyimpan `role` yang tidak konsisten dengan `roles[]`. Edge Function menyimpan keduanya (`role: input.role, roles: effectiveRoles`), sehingga `profile.role` di profil bisa berlainan dengan `profile.roles`. Pertimbangkan untuk menurunkan `role` dari `roles[0]` di sisi Edge Function, atau hapus field `role` dari form dan gunakan hanya `roles[]`.

</details>

<details>
<summary>Details</summary>

### Migrasi SQL dan urutan eksekusi

`20261008_cleanup_rls_dead_code.sql` dan `20261008_multi_role_refactor.sql` keduanya menulis ulang `has_record_access()` dan `assign_region_from_profile()`. Yang pertama menggunakan semantik `current_access_role()` lama; yang kedua menggunakan semantik `ANY(user_roles)` baru. Supabase CLI mengurutkan secara alfabetis: `cleanup_rls_dead_code` < `multi_role_refactor`, jadi saat ini urutan benar dan multi_role_refactor menang. Ini kebetulan benar, bukan desain eksplisit. Rename salah satu file bisa membalik urutan dan membuat DB kembali ke semantik single-role tanpa ada error kompilasi atau test yang gagal.

### Peleburan `admin_spj_bbm` dan `admin_spj_oli`

`ROLE_PERMISSIONS[USER_ROLES.ADMIN_SPJ_BBM]` dan `[USER_ROLES.ADMIN_SPJ_OLI]` memiliki kondisi identik (`!ctx.regionId || ctx.regionId === ctx.resourceRegionId`) sehingga secara teknis ekuivalen di level ACL. Tapi `canAccessAllSpjOliRegions()` membedakan keduanya:

```ts
export const canAccessAllSpjOliRegions = (role, regionId) =>
  role === USER_ROLES.ADMIN
  || role === USER_ROLES.ADMIN_SPJ_BBM  // <- selalu true, tanpa cek regionId
  || (isSpjOliAdmin(role) && !regionId);  // <- hanya jika tidak ada region
```

Setelah migrasi, eks-`admin_spj_bbm` punya `roles: ['spj_oli']`. Pemanggil yang masih memakai `canAccessAllSpjOliRegions(profile.role)` akan membaca `profile.role` lama — backward compat terjaga untuk sekarang. Tetapi tidak ada fungsi `canAccessAllSpjOliRoles(roles[])` padanan, sehingga saat kode baru mencoba memeriksa kondisi ini lewat roles array, ia tidak memiliki cara membedakan eks-`admin_spj_bbm` (akses global tanpa syarat) dari `spj_oli` (global hanya jika tanpa region). — confirmed dari membaca `access-control.ts`.

### Quick-edit role dropdown dan multi-role data loss

Di `UserManagement.tsx`, tabel profil menampilkan sebuah `<Select>` untuk quick-edit role per baris. Handler `onValueChange`-nya memanggil:

```ts
void handleUpdateProfile(profile.id, {
  role,
  roles: [role],  // <- single-element array
  region_id: roleCanSelectRegion(role) ? profile.region_id : null,
  ...
});
```

Ketika seorang user memiliki `roles: ['laporan_kerja', 'rencana_kerja']`, admin yang mengklik dropdown dan memilih role yang sama (tanpa sadar) akan menimpa `roles` menjadi `['laporan_kerja']`. `rencana_kerja` hilang dari database. Tidak ada konfirmasi dialog, tidak ada peringatan bahwa multi-role sedang dihapus.

Dialog edit lengkap (`openEditProfile` → `handleSaveProfile`) sudah benar: ia memakai `effectiveRoles = editUser.roles.length > 0 ? editUser.roles : [editUser.role]` dan menampilkan checkbox multi-role. Masalah hanya di quick-edit tabel.

### Konsistensi `role` vs `roles[]` di form create

Form buat akun di `UserManagement` memiliki dua input role: dropdown legacy (`newUser.role` via `ACCESS_OPTIONS`) dan checkbox multi-role (`newUser.roles`). Keduanya dikirim ke Edge Function sebagai `role: newUser.role` dan `roles: newUser.roles`. Edge Function memprioritaskan `roles` jika non-empty, dan menyimpan keduanya ke DB:

```ts
const { error: profileError } = await adminClient.from('profiles').upsert({
  role: input.role,      // <- dari dropdown legacy
  roles: effectiveRoles, // <- dari checkbox multi-role
  ...
});
```

Jika admin mengisi checkbox `['laporan_kerja', 'bbm']` tetapi dropdown legacy masih di `admin_wilayah` (nilai default), profil akan menyimpan `role: 'admin_wilayah'` dan `roles: ['laporan_kerja', 'bbm']`. Downstream code yang masih membaca `profile.role` sebagai fallback (seperti beberapa guard di `App.tsx`) akan mendapat role yang tidak konsisten dengan `roles[]`. Ini adalah likely concern — tergantung seberapa sering admin menggunakan kedua input secara bersamaan.

### Test coverage

Tidak ada test baru dalam refactor ini. Alur yang paling rentan terhadap regresi: (1) `hasPermission()` dengan kombinasi roles yang bertentangan kondisinya — satu role tidak punya condition (grant langsung), satu lainnya punya condition yang bisa deny; (2) migrasi data: tidak ada test yang memverifikasi bahwa semua legacy role di-migrate ke roles array yang benar sebelum constraint `NOT NULL DEFAULT '{}'` aktif; (3) quick-edit dropdown di tabel — tidak ada guard UI yang mencegah admin menimpa multi-role state tanpa sadar.

</details>

---

<details>
<summary>File map</summary>

| File | Perubahan |
|------|-----------|
| `supabase/migrations/20261008_multi_role_refactor.sql` | Tambah kolom `roles text[]`, migrasi data 14 legacy role, buat `current_access_roles()`, `has_role()`, tulis ulang `has_record_access()` dan `assign_region_from_profile()` dengan array semantics |
| `src/constants/access-control.ts` | Tambah `PermissionKey` type, `PERMISSION_LABELS`, `PERMISSION_REQUIRES_REGION`, dan semua predicate `-Roles()` variant yang menerima `string[]` |
| `src/constants/permissions.ts` | `AuthContext.roles` menjadi primary field; `role` deprecated. Tambah `ROLE_PERMISSIONS_EXTENDED` dengan mapping 11 permission keys ke entries yang ada. `rencana_kerja` diberi permissions region-scoped eksplisit |
| `src/lib/acl.ts` | `hasPermission()` loop `ctx.roles` dengan OR semantics; `userHasPermission()` baca kedua `role` dan `roles` kolom, prefer `roles` |
| `src/context/AuthContext.tsx` | `Profile` interface tambah `roles: string[]`; `signOut` audit log serialize `profile.roles` |
| `src/components/AuthorizeRoute.tsx` | Build `AuthContext` dari `profile.roles` (primary) dan `profile.role` (fallback) |
| `src/App.tsx` | Semua route guards beralih ke `profileRoles` + multi-role predicates dengan fallback ke legacy single-role; audit log pakai `profile.roles.join(',')` |
| `src/components/UserManagement.tsx` | Tambah multi-role checkbox UI, `handleRoleToggle`, interfaces include `roles: string[]`; `handleSaveProfile` pakai `rolesRequireRegion` |
| `supabase/functions/create-user/index.ts` | Terima `roles?: string[]`; validasi tiap key; `callerRoles.includes('administrator')` untuk auth check; simpan `roles: effectiveRoles` ke profil |
| `src/services/auditLogService.ts` | Tambah `serializeRoles()` helper; semua log calls serialize `roles[]` ke string CSV |

Full diff dapat dilihat di: `c:\Users\dlhup\dyad-apps\laporan\artifacts\laporan-kerja`

</details>
