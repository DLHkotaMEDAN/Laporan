# Implementation Plan

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Akses Tanpa Guard & Super Admin Tanpa Dropdown Wilayah
  - **CRITICAL**: Test ini HARUS GAGAL pada kode yang belum diperbaiki — kegagalan membuktikan bug ada
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: Test ini mengenkode perilaku yang diharapkan — akan memvalidasi perbaikan saat lulus setelah implementasi
  - **GOAL**: Tampilkan counterexample yang membuktikan kedua bug ada
  - **Scoped PBT Approach**: Scope ke kasus konkret yang gagal untuk reproduksibilitas deterministik
  - **Bug A**: Render `NotaDinasTemplateManagement` tanpa AuthContext (atau dengan user non-super-admin) → assert bahwa dropdown wilayah dan daftar template TETAP TERRENDER (harus gagal — membuktikan tidak ada guard)
  - **Bug B**: Render `NotaDinasTemplate` dengan super admin mock → assert bahwa elemen dropdown wilayah ADA di DOM (harus gagal — membuktikan super admin tidak mendapat dropdown)
  - Test Bug A dengan peran `laporan`: render `NotaDinasTemplateManagement` → assert konten template terrender tanpa pesan "Akses ditolak"
  - Test Bug B dengan super admin: render `NotaDinasTemplate` → assert `effectiveRegionId` selalu `null` dan tidak ada `<Select>` untuk wilayah
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (ini benar — membuktikan bug ada)
  - Document counterexamples found:
    - Bug A: "`NotaDinasTemplateManagement` merender UI lengkap untuk semua pengguna tanpa pemeriksaan role"
    - Bug B: "`NotaDinasTemplate` tidak memiliki elemen dropdown wilayah untuk super admin di DOM"
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Perilaku Non-Buggy Tidak Berubah
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: `admin_nota_dinas` dengan `profile.region_id = "uuid-xyz"` → `regionId` yang digunakan ke service adalah `"uuid-xyz"`, tidak ada dropdown wilayah
  - Observe: user dengan peran `laporan` di `/nota-dinas/template` → halaman menampilkan "Akses ditolak", tidak ada form template
  - Observe: super admin di Maintenance tab "Template Nota" → konten template tampil penuh, bisa buat/edit/hapus
  - Write property-based tests:
    - For all `profile.region_id` (random UUIDs), `admin_nota_dinas` → `effectiveRegionId === profile.region_id`, tidak ada dropdown wilayah
    - For all role selain `admin` dan `admin_nota_dinas` → `/nota-dinas/template` menampilkan "Akses ditolak"
    - For all `notaDinasTemplateService.save()` calls dengan valid data → service dipanggil dengan `regionId` yang sesuai `effectiveRegionId` aktif
  - Verify tests PASS on UNFIXED code (baseline behavior confirmed)
  - **EXPECTED OUTCOME**: Tests PASS (mengkonfirmasi baseline perilaku yang harus dipertahankan)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. Fix akses kontrol `NotaDinasTemplateManagement` dan dropdown wilayah `NotaDinasTemplate`

  - [ ] 3.1 Perbaiki `NotaDinasTemplateManagement.tsx` — tambah guard super admin & hapus dropdown wilayah
    - Import `useAuth` dari `@/context/AuthContext`
    - Import `isSuperAdminAccess` dari `@/constants/access-control`
    - Panggil `useAuth()` di dalam komponen untuk mendapatkan `profile` dan `session`
    - Hitung `isSuperAdmin = isSuperAdminAccess(profile?.role, session?.user?.email)`
    - Jika `!isSuperAdmin`, render pesan akses ditolak (atau `null`) — jangan render form template
    - Hapus state `regions`, `selectedRegionId`, dan `useEffect` yang memuat daftar wilayah
    - Hapus elemen `<Select>` untuk dropdown pilihan wilayah beserta label-nya
    - Hapus type `RegionOption` jika tidak lagi dipakai
    - Ganti semua referensi `selectedRegionId` dengan literal `null` pada: `getTemplatesByKategori`, `save`, `handleCreateNew`
    - _Bug_Condition: isBugCondition(input) di mana currentPage = "Maintenance/nota-template" AND NOT isSuperAdminAccess(role, email)_
    - _Expected_Behavior: guard aktif → akses ditolak untuk non-super-admin; regionId dikunci ke null untuk super admin_
    - _Preservation: super admin tetap bisa mengelola template global; CRUD service tidak berubah_
    - _Requirements: 2.1, 2.2, 3.3, 3.4_

  - [ ] 3.2 Perbaiki `NotaDinasTemplate.tsx` — tambah dropdown wilayah untuk super admin & perbaiki `effectiveRegionId`
    - Tambahkan state `const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null)`
    - Tambahkan state `const [regions, setRegions] = useState<{ id: string | null; name: string }[]>([])`
    - Tambahkan `useEffect` yang hanya berjalan jika `isSuperAdmin`: muat daftar wilayah dari tabel `regions`, susun opsi dengan "Default Global" (`null`) sebagai pilihan pertama
    - Ubah logika `regionId` menjadi `effectiveRegionId`:
      ```
      const effectiveRegionId = isSuperAdmin
        ? selectedRegionId
        : isRegionalAdmin
          ? (profile?.region_id ?? null)
          : null;
      ```
    - Ganti semua referensi `regionId` di komponen dengan `effectiveRegionId`
    - Render `<Select>` dropdown pilihan wilayah di bawah blok info wilayah, hanya jika `isSuperAdmin`
    - Perbarui teks info wilayah: jika `isSuperAdmin && selectedRegionId !== null` tampilkan nama wilayah terpilih; jika `isSuperAdmin && selectedRegionId === null` tampilkan "Template Default Global"
    - Pastikan `loadTemplates` menggunakan `effectiveRegionId` (bukan `regionId` lama)
    - _Bug_Condition: isBugCondition(input) di mana currentPage = "/nota-dinas/template" AND isSuperAdminAccess(role, email) AND regionDropdownNotVisible_
    - _Expected_Behavior: dropdown wilayah tampil untuk super admin; effectiveRegionId mengikuti pilihan dropdown_
    - _Preservation: admin_nota_dinas tetap terkunci ke profile.region_id; penolakan akses untuk role lain tetap berjalan_
    - _Requirements: 2.3, 3.1, 3.2, 3.4, 3.5_

  - [ ] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Guard Akses & Dropdown Wilayah Super Admin
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - Test dari task 1 mengenkode perilaku yang diharapkan
    - Saat test ini lulus, mengkonfirmasi:
      - Bug A teratasi: `NotaDinasTemplateManagement` menolak akses untuk non-super-admin
      - Bug B teratasi: `NotaDinasTemplate` menampilkan dropdown wilayah untuk super admin
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (mengkonfirmasi bug diperbaiki)
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Perilaku Non-Buggy Tidak Berubah
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (mengkonfirmasi tidak ada regresi)
    - Konfirmasi semua skenario preservation masih berjalan benar setelah perbaikan:
      - `admin_nota_dinas` tetap terkunci ke `profile.region_id`
      - Penolakan akses untuk role tidak berwenang tetap aktif
      - Super admin di Maintenance tetap bisa kelola template global
      - Service layer tidak terpengaruh

- [ ] 4. Checkpoint — Pastikan semua test lulus
  - Jalankan semua test (exploration + preservation) dan pastikan semuanya lulus
  - Verifikasi secara manual di browser:
    - Login sebagai non-super-admin → buka Maintenance tab "Template Nota" → harus melihat pesan akses ditolak
    - Login sebagai super admin → buka Maintenance tab "Template Nota" → bisa kelola template global, tanpa dropdown wilayah
    - Login sebagai super admin → buka `/nota-dinas/template` → dropdown wilayah muncul, bisa pilih wilayah atau "Default Global"
    - Login sebagai `admin_nota_dinas` → buka `/nota-dinas/template` → tidak ada dropdown wilayah, terkunci ke wilayah sendiri
  - Tanya user jika ada pertanyaan yang muncul
