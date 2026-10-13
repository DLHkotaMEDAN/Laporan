# Database Migration untuk Fix Supabase Errors

## Ringkasan

Migration ini dibuat untuk memperbaiki error Supabase yang muncul di browser:

### Error yang Diperbaiki:
1. **Storage 400** - Gambar dari bucket `assets/landing/` tidak bisa diakses
2. **API 404** - Tabel `overtime_records` tidak ditemukan
3. **API 400** - Tabel `nota_dinas_records` dan `spj_oli_records` gagal karena kolom `deleted_at` tidak ada

## Cara Paling Mudah: Via Supabase Dashboard (Recommended)

Karena Supabase CLI dan psql tidak terinstall, cara termudah adalah via Supabase Dashboard:

### Langkah 1: Buka Supabase Dashboard
1. Buka https://supabase.com/dashboard
2. Login ke akun Anda
3. Pilih project yang sedang Anda gunakan

### Langkah 2: Buka SQL Editor
1. Di sidebar kiri, klik **SQL Editor**
2. Klik **New Query** untuk membuat query baru

### Langkah 3: Copy dan Paste Migration Script
1. Buka file: `supabase/migrations/20261013_complete_fix.sql`
2. Copy seluruh isi file tersebut
3. Paste ke SQL Editor di Supabase Dashboard
4. Klik **Run** (tombol play di pojok kanan bawah)

### Langkah 4: Verifikasi Hasil
Jika berhasil, Anda akan melihat:
- `Success. No rows returned` untuk perintah yang tidak mengembalikan data
- Status ✅ di setiap baris yang dijalankan

## Cara Alternatif: File Terpisah

Jika Anda ingin menjalankan migration satu per satu:

### Opsi 1: Via Supabase Dashboard
1. Buka Supabase Dashboard
2. Pilih project Anda
3. Masuk ke SQL Editor
4. Jalankan ketiga migration file secara berurutan:
   - `20261013_create_assets_bucket.sql`
   - `20261013_ensure_assets_rls_policies.sql`
   - `20261013_add_deleted_at_to_tables.sql`

### Opsi 2: Via Supabase CLI (jika diinstall)
```bash
# Pastikan sudah login ke Supabase CLI
supabase login

# Link ke project (jika belum)
supabase link --project-ref <your-project-ref>

# Jalankan migration
supabase db push
```

### Opsi 3: Via psql (jika diinstall)
```bash
psql -h <your-host> -U postgres -d <your-database> -f supabase/migrations/20261013_create_assets_bucket.sql
psql -h <your-host> -U postgres -d <your-database> -f supabase/migrations/20261013_ensure_assets_rls_policies.sql
psql -h <your-host> -U postgres -d <your-database> -f supabase/migrations/20261013_add_deleted_at_to_tables.sql
```

## Upload Gambar Landing Page

Setelah migration selesai, Anda perlu upload gambar-gambar berikut ke bucket `assets/landing/`:

1. Buka Supabase Dashboard
2. Masuk ke Storage
3. Pilih bucket `assets`
4. Buat folder `landing`
5. Upload gambar:
   - `mayor.jpg`
   - `deputyMayor.jpg`
   - `hero.jpg`
   - `environmentHead.jpg`

## Verifikasi

Setelah migration selesai dan gambar diupload, refresh browser. Error yang muncul sebelumnya seharusnya sudah hilang.

### Checklist:
- [ ] Migration `20261013_create_assets_bucket.sql` berhasil
- [ ] Migration `20261013_ensure_assets_rls_policies.sql` berhasil
- [ ] Migration `20261013_add_deleted_at_to_tables.sql` berhasil
- [ ] Gambar landing page sudah diupload ke bucket `assets/landing/`
- [ ] Tidak ada error 400/404 di console browser
- [ ] Fitur Nota Dinas dan SPJ Oli bisa diakses
- [ ] Fitur Overtime bisa diakses

## Catatan Penting

- Migration ini menggunakan `if not exists` dan `on conflict` sehingga aman untuk dijalankan ulang
- RLS policies menggunakan `drop policy if exists` untuk menghindari conflict
- Jika tabel `overtime_records` belum ada, migration akan gagal - pastikan migration sebelumnya sudah dijalankan
- Pastikan semua migration sebelumnya sudah dijalankan sebelum menjalankan migration ini

## troubleshooting

### Error: column "deleted_at" of relation does not exist
Ini normal jika kolom sudah ada. Migration menggunakan `if not exists` untuk mengatasi ini.

### Error: bucket "assets" already exists
Ini normal jika bucket sudah dibuat. Migration menggunakan `on conflict` untuk mengatasi ini.

### Error: relation "overtime_records" does not exist
Pastikan migration `20260907_add_overtime_records.sql` sudah dijalankan sebelumnya.

### Error: function has_nota_dinas_region_access does not exist
Pastikan migration `20260918_add_nota_dinas_regional_access.sql` sudah dijalankan sebelumnya.

### Error: function has_spj_oli_record_access does not exist
Pastikan migration `20260916_add_spj_oli_regional_access.sql` sudah dijalankan sebelumnya.
