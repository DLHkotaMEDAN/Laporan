# Multi-Role Refactor — Progress Report (Iterasi 4)
**Tanggal:** 2026-10-08  
**Status:** Review findings dari iterasi 3 diperbaiki — 3 dari 4 temuan ditutup, 1 diterima dengan catatan

---

## Temuan Review (dari multi-role-refactor-review.json)

### Finding 1 ✅ FIXED
**Urutan migrasi non-deterministic**  
`20261008_multi_role_refactor.sql` diganti nama menjadi `20261008_zzz_multi_role_refactor.sql`.  
Urutan alfabetis kini eksplisit: `cleanup_rls_dead_code` < `zzz_multi_role_refactor`.  
File juga mendapat komentar header yang mendokumentasikan ketergantungan ini.

### Finding 2 ✅ FIXED  
**Quick-edit role dropdown menghapus multi-role state**  
Di tabel `UserManagement.tsx`, `onValueChange` handler quick-edit sebelumnya mengirim `roles: [role]`
(single-element array) sehingga menimpa multi-role state user yang punya lebih dari satu permission key.  
Fix: `roles: [role]` dihapus dari `handleUpdateProfile` di quick-edit. Handler kini hanya memperbarui
kolom `role` (legacy). Untuk mengubah `roles[]`, admin harus menggunakan dialog Edit lengkap (tombol Pencil).

### Finding 3 — DITERIMA dengan catatan
**`admin_spj_bbm` dan `admin_spj_oli` dilebur ke satu key `spj_oli`**  
Ini adalah keputusan produk yang disadari: kedua role lama dipetakan ke `spj_oli` di migrasi SQL.  
Backward compat terjaga selama `profile.role` masih ada di DB — `canAccessAllSpjOliRegions(profile.role)`
masih membaca kolom lama dan membedakan eks-`admin_spj_bbm` (akses global tanpa syarat) dari `spj_oli`
(global hanya jika tanpa region). Setelah pemilik produk memutuskan untuk mem-DROP kolom `role` lama,
`canAccessAllSpjOliRoles(roles[])` perlu ditambahkan dengan semantik yang sama.

### Finding 4 ✅ FIXED
**`handleCreateUser` mengirim legacy `role` yang bisa tidak konsisten dengan `roles[]`**  
Edge Function `create-user/index.ts` sebelumnya menyimpan `role: input.role` langsung dari form,
yang bisa berbeda dari `roles[]` yang diisi via checkbox multi-role.  
Fix: Edge Function kini menurunkan nilai `role` dari `effectiveRoles[0]` (bukan dari `input.role`),
sehingga `profile.role` selalu konsisten dengan `profile.roles[0]` terlepas dari state form.

---

## File Yang Diubah (Iterasi 4)

| File | Perubahan |
|------|-----------|
| `supabase/migrations/20261008_zzz_multi_role_refactor.sql` | Renamed dari `20261008_multi_role_refactor.sql`. Header komentar ketergantungan ditambahkan. |
| `src/components/UserManagement.tsx` | Hapus `roles: [role]` dari quick-edit dropdown handler di tabel. |
| `supabase/functions/create-user/index.ts` | Derive `legacyRole = effectiveRoles[0]` dan gunakan sebagai nilai kolom `role` di upsert profiles. |

---

## Hasil TypeScript Check

```
Exit code: 0 — tidak ada error TypeScript
```

Dijalankan dengan: `node tsc --noEmit` dari root `artifacts/laporan-kerja`

---

## Backward Compat Yang Dijaga

- Kolom `role` lama di DB **tidak di-drop** — semua guard di `App.tsx` masih punya fallback ke `profile.role`
- `USER_ROLES.ADMIN_WILAYAH_BBM` dan `ADMIN_RENCANA_KERJA_BBM` tetap ada di TypeScript constants
- `current_access_role()` (singular) belum di-drop — RLS policy lama yang mungkin masih ada di Supabase tidak akan break
- `canAccessAllSpjOliRegions(profile.role)` masih bekerja untuk eks-`admin_spj_bbm` via backward compat path

---

## Catatan Untuk Iterasi Berikutnya

- Finding 3 (spj_bbm vs spj_oli) perlu diputuskan: tambah key `spj_bbm` terpisah ATAU biarkan backward compat via `profile.role`
- Setelah semua user dipastikan punya `roles[]` terisi, kolom `role` lama bisa di-DROP
- `canAccessAllSpjOliRoles(roles[])` perlu ditambahkan sebelum DROP kolom `role`
