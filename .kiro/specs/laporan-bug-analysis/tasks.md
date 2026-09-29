# Implementation Plan

## Perbaikan 10 Bug – Laporan Kerja (Laporan Bug Analysis)

> **Urutan wajib:** Tugas 1 (exploration test) → Tugas 2 (preservation test) → Tugas 3–7 (implementasi fix per file) → Tugas 8 (checkpoint)
>
> Test di Tugas 1 **harus GAGAL** pada kode yang belum diperbaiki — kegagalan ini membuktikan bug ada.
> Test di Tugas 2 **harus LULUS** pada kode yang belum diperbaiki — kelulusan ini mengkonfirmasi baseline yang wajib dipertahankan.

---

- [ ] 1. Tulis bug condition exploration tests (SEBELUM mengimplementasi fix)
  - **Property 1: Bug Condition** - 10 Bug Manifestations Across 5 Files
  - **CRITICAL**: Tulis semua test ini SEBELUM menyentuh kode produksi manapun
  - **GOAL**: Kumpulkan counterexample yang membuktikan setiap bug nyata ada di kode saat ini
  - **Scoped PBT Approach**: Scope setiap property ke kasus deterministik yang konkret agar selalu reproducible
  - **EXPECTED OUTCOME**: Semua test di bawah GAGAL pada kode unfixed — kegagalan = bukti bug

  **Bug 1 — Race Condition di AuthContext (AuthContext.tsx)**
  - Buat test yang mensimulasikan `getSession()` dan `onAuthStateChange` keduanya resolve hampir bersamaan dengan `userId` yang sama
  - Spy `setLoading` — rekam semua nilai yang di-pass (`true`/`false`) secara berurutan
  - Assertion: setelah kedua resolve selesai, nilai terakhir `setLoading` adalah `false` DAN `loading` state = `false`
  - Run pada kode unfixed → **EXPECTED FAILURE**: loading stuck di `true` karena pemanggilan kedua return dini tanpa reset
  - Counterexample yang didokumentasikan: `"setLoading(false) tidak pernah dipanggil dari invokasi kedua fetchProfile('uid-A')"`
  - _Requirements: 1.1, 1.2_

  **Bug 2 — ProtectedRoute Null Reference (App.tsx)**
  - Render komponen `ProtectedRoute` dengan context: `session` ada (tidak null), `profile = null`, `loading = false`
  - Pastikan kondisi yang memeriksa `isAdminBbmAccess` atau `isLaporanBbmAdmin` terpenuhi (sesuai kode aktual)
  - Assertion: komponen tidak melempar `TypeError` — render berjalan tanpa crash
  - Run pada kode unfixed → **EXPECTED FAILURE**: `TypeError: Cannot read properties of null (reading 'role')`
  - Counterexample yang didokumentasikan: `"profile = null, session ada → getRoleLandingPath(profile.role) → crash"`
  - _Requirements: 1.3_

  **Bug 3 — NonFuelSpecialistRoute tanpa Session Check (App.tsx)**
  - Render komponen `NonFuelSpecialistRoute` dengan context: `session = null`, `profile = null`, `loading = false`
  - Sediakan children dummy `<div data-testid="protected-content" />`
  - Assertion: output render adalah `<Navigate to="/login" />`, BUKAN children
  - Run pada kode unfixed → **EXPECTED FAILURE**: children dirender (atau tidak ada redirect)
  - Counterexample yang didokumentasikan: `"user tanpa session masuk ke children NonFuelSpecialistRoute"`
  - _Requirements: 1.4_

  **Bug 4 — Double Data Fetch di FuelReportList (FuelReportList.tsx)**
  - Mock fungsi `getAllReports` dengan spy
  - Render `FuelReportList` dengan `allActiveReports = []` (belum ada data)
  - Simulasikan perubahan filter (misalnya ganti bulan dari "Semua" ke "Januari")
  - Hitung berapa kali `getAllReports` dipanggil saat filter berubah
  - Assertion: jumlah panggilan `getAllReports` ≤ 1 per perubahan filter (untuk kondisi `allActiveReports` sudah ada)
  - Untuk kasus `allActiveReports.length > 0`: ubah filter lagi → `getAllReports` tidak dipanggil sama sekali
  - Run pada kode unfixed → **EXPECTED FAILURE**: `getAllReports` dipanggil 2 kali per filter change
  - Counterexample yang didokumentasikan: `"getAllReports dipanggil 2× saat filter berubah dari 'Semua' ke bulan tertentu"`
  - _Requirements: 1.5, 1.6_

  **Bug 5 — `loadRecordCounts` Stale Closure di Index.tsx (Index.tsx)**
  - Mock `getDatabaseRecordCount` dengan spy
  - Render komponen `Index` dengan profil valid
  - Simulasikan `loadData()` mengisi state `reports` dengan array non-kosong (misalnya 50 items) secara async
  - Tunggu sampai `loadRecordCounts` selesai dijalankan
  - Assertion: `getDatabaseRecordCount('reports', ...)` TIDAK dipanggil jika `reports.length > 0`
  - Run pada kode unfixed → **EXPECTED FAILURE**: `getDatabaseRecordCount` tetap dipanggil meski `reports` sudah terisi
  - Counterexample yang didokumentasikan: `"loadRecordCounts membaca reports.length = 0 (stale closure) meskipun 50 item sudah di state"`
  - _Requirements: 1.7_

  **Bug 6 — Filter Bulan tanpa Tahun Menggunakan Tahun Hardcoded (FuelReportList.tsx)**
  - Mock atau spy fungsi `getReportsByDateRange` (atau fungsi fetching yang dipanggil oleh `loadReports`)
  - Set kondisi filter: `appliedMonth = '1'` (Januari), `appliedYear = 'semua'`
  - Panggil `loadReports` dengan kondisi tersebut
  - Assertion: parameter `startDate` yang diteruskan ke query TIDAK mengandung `new Date().getFullYear()` — tidak ada batasan tahun dalam rentang tanggal
  - Run pada kode unfixed → **EXPECTED FAILURE**: `startDate = "2025-01-01"` (tahun berjalan hardcoded)
  - Counterexample yang didokumentasikan: `"filter Januari + Semua Tahun → query hanya ambil Januari 2025, bukan semua tahun"`
  - _Requirements: 1.8_

  **Bug 7 — Email Hardcoded di Access Control (access-control.ts)**
  - Baca source file `src/constants/access-control.ts` (atau bundle output) secara programatik
  - Cari keberadaan string literal email seperti `"admin@gmail.com"`, `"pimpinan@gmail.com"`, `"sakinah@gmail.com"`, `"admin.laporan@gmail.com"` di dalam source
  - Assertion: tidak ada email literal sebagai hard-coded string dalam kondisi logika `isSuperAdminAccess`, `isPimpinanAccess`, `isAdminHarianAccess`
  - Tambahan: test `isSuperAdminAccess('user', 'admin@gmail.com')` → harus return `false` (email tidak boleh menjadi bypass)
  - Run pada kode unfixed → **EXPECTED FAILURE**: email ditemukan di source, dan `isSuperAdminAccess('user', 'admin@gmail.com')` returns `true`
  - Counterexample yang didokumentasikan: `"mendaftar akun Supabase dengan admin@gmail.com → isSuperAdminAccess = true tanpa role 'admin' di DB"`
  - _Requirements: 1.9, 1.10_

  **Bug 8 — `getRoleLandingPath` Menyebabkan Infinite Redirect (access-control.ts + App.tsx)**
  - Panggil `getRoleLandingPath('admin_rencana_kerja_bbm')` secara langsung
  - Assertion: hasil TIDAK sama dengan `'/'`
  - Tambahan: render `ProtectedRoute` dengan role `'admin_rencana_kerja_bbm'` — hitung jumlah redirect yang terjadi
  - Assertion: redirect loop tidak terjadi (render count tidak terus bertambah)
  - Run pada kode unfixed → **EXPECTED FAILURE**: `getRoleLandingPath('admin_rencana_kerja_bbm')` returns `'/'` → infinite redirect
  - Counterexample yang didokumentasikan: `"admin_rencana_kerja_bbm login → ProtectedRoute redirect ke '/' → ProtectedRoute lagi → loop"`
  - _Requirements: 1.11_

  **Bug 9 — `canAccessFuelArea` Mengizinkan `admin_spj_oli` (access-control.ts + App.tsx)**
  - Render `FuelReportRoute` dengan context: `profile.role = 'admin_spj_oli'`, `session` ada
  - Sediakan children dummy `<div data-testid="fuel-report-list" />`
  - Assertion: output render adalah `<Navigate to="/?tab=spj_oli" />`, BUKAN children
  - Run pada kode unfixed → **EXPECTED FAILURE**: children dirender (user masuk ke `FuelReportList`)
  - Counterexample yang didokumentasikan: `"admin_spj_oli akses /fuel-reports → FuelReportRoute lolos → FuelReportList dirender → flash + error di dalam komponen"`
  - _Requirements: 1.12_

  **Bug 10 — `getDatabaseRecordCount` Tanpa Timeout (Index.tsx)**
  - Mock `supabase.from(...).select(...)` untuk mensimulasikan query yang tidak pernah resolve (atau resolve setelah 30 detik)
  - Panggil `getDatabaseRecordCount` dengan mock yang lambat tersebut
  - Set timeout expectation di test: function harus throw/reject dalam waktu ≤ 10 detik
  - Assertion: fungsi melempar error (abort/timeout) dalam batas waktu yang wajar, tidak menunggu selamanya
  - Run pada kode unfixed → **EXPECTED FAILURE**: fungsi menunggu tanpa batas waktu, test timeout
  - Counterexample yang didokumentasikan: `"getDatabaseRecordCount pada query lambat: tidak ada abort setelah 8 detik, halaman Index tidak responsif"`
  - _Requirements: 1.13_

---

- [ ] 2. Tulis preservation property tests (SEBELUM mengimplementasi fix)
  - **Property 2: Preservation** - Perilaku Normal Tidak Berubah
  - **IMPORTANT**: Ikuti observation-first methodology — jalankan terlebih dahulu pada kode unfixed untuk mencatat baseline sebelum menulis assertions
  - **EXPECTED OUTCOME**: Semua test di bawah LULUS pada kode unfixed — kelulusan = baseline terverifikasi

  **Observasi Baseline (jalankan pada kode unfixed, catat hasilnya):**
  - Observe: Login dengan kredensial valid (non-concurrent) → profile dimuat, loading = false, dashboard tampil
  - Observe: User tanpa session akses `/` → redirect ke `/login`
  - Observe: User logout → session dihapus, redirect ke `/login`
  - Observe: `admin_bbm` akses `/` → `ProtectedRoute` redirect ke `/fuel-reports`
  - Observe: Role `admin` akses `/` → masuk ke halaman Index (tidak diredirect)
  - Observe: `admin_spj_oli` akses `/spj-oli` via `SpjOliRoute` → akses diberikan
  - Observe: Role tanpa akses BBM akses `/fuel-reports` → redirect ke path yang sesuai
  - Observe: Filter bulan=Januari, tahun=2024 di FuelReportList → data Januari 2024 tampil
  - Observe: Filter tahun=2024 saja (tanpa bulan) → semua data 2024 tampil
  - Observe: Filter tanggal spesifik → data tanggal tersebut saja tampil
  - Observe: Duplikat data di FuelReportList → badge "Ganda" tampil pada baris yang relevan
  - Observe: Tab badge di Index → menampilkan jumlah record yang akurat saat query berhasil
  - Observe: User dengan `profile.role = 'admin'` di tabel profiles → akses super admin diberikan
  - Observe: `getRoleLandingPath('admin_laporan_bbm')` → returns `'/laporan-bbm'`
  - Observe: `getRoleLandingPath('admin_spj_bbm')` → returns `'/?tab=spj_oli'`
  - Observe: `canAccessFuelArea('admin_bbm', undefined)` → returns `true`
  - Observe: `isSuperAdminAccess('admin', undefined)` → returns `true`

  **Property-Based Tests yang harus LULUS pada kode unfixed:**

  - PBT 2a – Login Sukses Non-Concurrent:
    - For any valid login (non-concurrent `getSession` tanpa `INITIAL_SESSION` bersamaan): setelah login selesai, `loading = false` dan `profile` terisi
    - Test dengan skenario sequential (bukan concurrent) — memverifikasi path normal tidak terganggu

  - PBT 2b – User Tanpa Session Selalu Diredirect ke Login:
    - For any route yang membutuhkan autentikasi (`ProtectedRoute`, `AdminRoute`, dll): jika `session = null`, render menghasilkan `<Navigate to="/login" />`
    - Test dengan: `ProtectedRoute`, `AdminRoute`, `FuelReportRoute` — semua harus redirect saat no-session

  - PBT 2c – Route Guard Role BBM Valid Tetap Bekerja:
    - For roles `['admin_bbm', 'admin_bbm_pusat', 'admin_laporan_bbm', 'admin_spj_bbm']`: `ProtectedRoute` meredirect ke path yang sesuai (bukan `'/'`)
    - Verifikasi `getRoleLandingPath` mengembalikan nilai yang benar untuk masing-masing role tersebut

  - PBT 2d – Role Non-BBM Valid Masuk ke Index:
    - For roles `['admin', 'user', 'laporan']`: `ProtectedRoute` TIDAK meredirect — komponen children dirender
    - Test dengan profil masing-masing role

  - PBT 2e – Filter FuelReportList Tetap Akurat untuk Kombinasi Filter Lengkap:
    - For any (bulan, tahun) di mana keduanya dipilih (bukan 'semua'): query menggunakan rentang tanggal yang tepat sesuai keduanya
    - For any tahun saja (bulan = 'semua'): query mencakup seluruh tahun tersebut
    - For any tanggal spesifik: query hanya untuk tanggal tersebut

  - PBT 2f – Deteksi Duplikat Tetap Berfungsi:
    - For any set laporan di mana ada dua laporan dengan `getFuelReportDuplicateKey` identik dalam satu periode yang di-load: keduanya mendapat badge "Ganda"
    - Test dengan data mock yang memiliki duplikat yang jelas dalam period aktif

  - PBT 2g – Tab Badge Index Tampil Akurat saat Query Berhasil:
    - For any kondisi di mana `getDatabaseRecordCount` berhasil (sebelum timeout ditambahkan): badge counter menampilkan angka yang dikembalikan fungsi
    - Mock query yang cepat (<1 detik) → badge tampil dengan nilai yang benar

  - PBT 2h – `getRoleLandingPath` Tetap Akurat untuk Role Existing:
    - For each role in `['admin_laporan_bbm', 'admin_spj_bbm', 'admin_bbm_pusat', 'admin_bbm', 'admin_nota_dinas', 'admin_rencana_kerja', 'admin_spj_oli']`: `getRoleLandingPath(role)` mengembalikan path yang sama seperti sebelum fix
    - Catat nilai-nilai ini sebagai snapshot

  - PBT 2i – `canAccessFuelArea` Tetap Benar untuk Role yang Valid:
    - For roles yang memang boleh akses fuel area: `canAccessFuelArea(role)` returns `true`
    - Termasuk: `admin`, `pimpinan` (via email atau role), `admin_bbm`, `admin_bbm_pusat`, `admin_laporan_bbm`, `admin_spj_bbm`

  - PBT 2j – `isSuperAdminAccess` dengan Role Admin Tetap Benar:
    - `isSuperAdminAccess('admin', undefined)` → returns `true`
    - `isSuperAdminAccess(null, undefined)` → returns `false`
    - `isSuperAdminAccess('user', undefined)` → returns `false`

  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14, 3.15_

---

- [ ] 3. Fix Bug 1 & 2 – `AuthContext.tsx`

  - [ ] 3.1 Bug 1 – Perbaiki race condition dengan `finally` block dan reset ref yang konsisten
    - File: `artifacts/laporan-kerja/src/context/AuthContext.tsx`
    - Baca seluruh implementasi `fetchProfile` terlebih dahulu sebelum mengubah apapun
    - Pindahkan `setLoading(false)` dan reset `fetchingProfileRef.current = null` ke dalam blok `finally` sehingga selalu dipanggil
    - Pastikan di semua jalur `catch` / `break` loop: `fetchingProfileRef.current` di-reset ke `null` sebelum `break` dieksekusi — jangan biarkan ref "dirty"
    - Tambahkan pengecekan ulang setelah setiap `await`: `if (fetchingProfileRef.current !== userId) return;` untuk mendeteksi apakah invokasi ini masih relevan
    - Pseudocode target:
      ```typescript
      async function fetchProfile(userId: string) {
        if (fetchingProfileRef.current === userId) return;
        fetchingProfileRef.current = userId;
        setLoading(true);
        try {
          // ... await fetch logic
          // after each await: if (fetchingProfileRef.current !== userId) return;
        } catch (error) {
          setProfile(null);
        } finally {
          if (fetchingProfileRef.current === userId) {
            fetchingProfileRef.current = null;
          }
          setLoading(false);
        }
      }
      ```
    - Verifikasi: logika `onAuthStateChange`, `getSession`, `refreshProfile`, `signOut` tidak berubah
    - _Bug_Condition: isBugCondition_Bug1(X) — X.timing = 'concurrent' AND fetchingProfileRef.current = X.userId saat pemanggilan kedua masuk_
    - _Expected_Behavior: setLoading(false) selalu dipanggil sekali; tidak ada loading stuck_
    - _Preservation: login sequential normal tetap memuat profil dan dashboard sesuai role (Requirements 3.1–3.3)_
    - _Requirements: 1.1, 1.2_

  - [ ] 3.2 Bug 2 – Perbaiki null reference `profile.role` di `ProtectedRoute`
    - File: `artifacts/laporan-kerja/src/context/AuthContext.tsx` (jika `ProtectedRoute` ada di sini) atau `artifacts/laporan-kerja/src/App.tsx`
    - Baca blok `ProtectedRoute` terlebih dahulu untuk menemukan semua akses `profile.role` tanpa optional chaining
    - Ganti semua `profile.role` di dalam blok kondisi redirect dengan `profile?.role`
    - Pastikan `getRoleLandingPath(profile.role)` diganti menjadi `getRoleLandingPath(profile?.role)`
    - Tambahkan guard: jika `session` ada tetapi `profile` masih `null` dan `loading` sudah `false`, tampilkan spinner/loading indicator alih-alih memproses redirect
    - _Bug_Condition: isBugCondition_Bug2(X) — X.session != null AND X.profile = null AND blok redirect dieksekusi_
    - _Expected_Behavior: tidak ada TypeError; komponen menunggu profile atau menampilkan loading_
    - _Preservation: ProtectedRoute tetap meredirect role BBM ke path yang benar saat profile sudah tersedia (Requirements 3.4, 3.5)_
    - _Requirements: 1.3_

  - [ ] 3.3 Verifikasi exploration tests Bug 1 & 2 sekarang lulus
    - **Property 1: Expected Behavior** - AuthContext Race Condition & Null Reference
    - **IMPORTANT**: Re-run SAME tests dari Tugas 1 (Bug 1 dan Bug 2) — jangan tulis test baru
    - Test loading tidak stuck setelah concurrent fetchProfile → **EXPECTED: LULUS**
    - Test ProtectedRoute tidak crash dengan profile = null → **EXPECTED: LULUS**
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 3.4 Verifikasi preservation tests tetap lulus setelah fix Bug 1 & 2
    - **Property 2: Preservation** - Auth & State
    - **IMPORTANT**: Re-run SAME tests dari Tugas 2 (PBT 2a, 2b, 2c, 2d)
    - Login sequential normal tetap berhasil → **EXPECTED: LULUS**
    - User tanpa session tetap diredirect → **EXPECTED: LULUS**
    - Route guard role BBM tetap bekerja → **EXPECTED: LULUS**

---

- [ ] 4. Fix Bug 3, 8, 9 – `App.tsx`

  - [ ] 4.1 Bug 3 – Tambahkan session check ke `NonFuelSpecialistRoute`
    - File: `artifacts/laporan-kerja/src/App.tsx`
    - Baca implementasi `NonFuelSpecialistRoute` terlebih dahulu
    - Bandingkan dengan `ProtectedRoute` atau `AdminRoute` yang sudah memeriksa session
    - Tambahkan guard di awal komponen `NonFuelSpecialistRoute`, setelah loading check:
      ```typescript
      if (!session) return <Navigate to="/login" replace />;
      ```
    - Pastikan guard session ditempatkan SEBELUM pengecekan role apapun
    - Verifikasi guard tidak duplikat dengan guard yang mungkin sudah ada
    - _Bug_Condition: isBugCondition_Bug3(X) — X.session = null AND NonFuelSpecialistRoute tidak memeriksa session_
    - _Expected_Behavior: <Navigate to="/login" /> dirender untuk semua user tanpa session_
    - _Preservation: user dengan session yang valid dan role yang benar tetap bisa akses (Requirements 3.2)_
    - _Requirements: 1.4_

  - [ ] 4.2 Bug 8 – Tambahkan case `admin_rencana_kerja_bbm` dan `admin_wilayah_bbm` ke `getRoleLandingPath`
    - File: `artifacts/laporan-kerja/src/constants/access-control.ts`
    - Baca implementasi `getRoleLandingPath` dan `USER_ROLES` konstanta terlebih dahulu
    - Periksa nilai string yang tepat untuk `admin_rencana_kerja_bbm` dan `admin_wilayah_bbm` di `USER_ROLES`
    - Tambahkan case untuk keduanya dengan path yang tidak memicu redirect di `ProtectedRoute`:
      ```typescript
      if (role === USER_ROLES.ADMIN_RENCANA_KERJA_BBM) return '/fuel-reports';
      if (role === USER_ROLES.ADMIN_WILAYAH_BBM) return '/fuel-reports';
      ```
    - Verifikasi path `/fuel-reports` tidak memicu kondisi redirect loop di `ProtectedRoute` untuk kedua role ini
    - Verifikasi semua role lain yang sudah ada (seperti `admin_laporan_bbm`, `admin_spj_bbm`, dll.) masih mengembalikan path yang sama — tidak ada regresi
    - _Bug_Condition: isBugCondition_Bug8(X) — X.role IN ['admin_rencana_kerja_bbm', 'admin_wilayah_bbm'] AND getRoleLandingPath returns '/'_
    - _Expected_Behavior: getRoleLandingPath returns path valid yang tidak memicu ProtectedRoute redirect lagi_
    - _Preservation: getRoleLandingPath untuk semua role existing tetap mengembalikan path yang sama (Requirements 3.4, 3.15)_
    - _Requirements: 1.11_

  - [ ] 4.3 Bug 9 – Hapus `isSpjOliAdmin` dari `canAccessFuelArea` dan tambahkan redirect eksplisit di `FuelReportRoute`
    - File: `artifacts/laporan-kerja/src/constants/access-control.ts` dan `artifacts/laporan-kerja/src/App.tsx`
    - **Perubahan 1 — access-control.ts**: Baca `canAccessFuelArea` → hapus `|| isSpjOliAdmin(role)` dari kondisi
    - **Perubahan 2 — App.tsx**: Baca `FuelReportRoute` → tambahkan guard eksplisit setelah session/loading check:
      ```typescript
      if (isSpjOliAdmin(profile?.role)) {
        return <Navigate to="/?tab=spj_oli" replace />;
      }
      ```
    - Pastikan guard `isSpjOliAdmin` ditempatkan sebelum pengecekan `canAccessFuelArea`
    - Verifikasi `admin_spj_oli` masih bisa akses `/spj-oli` via `SpjOliRoute` (tidak terganggu)
    - Verifikasi `canAccessFuelArea` masih returns `true` untuk: `admin_bbm`, `admin_bbm_pusat`, `admin_laporan_bbm`, `admin_spj_bbm`
    - _Bug_Condition: isBugCondition_Bug9(X) — X.role = 'admin_spj_oli' AND canAccessFuelArea returns true_
    - _Expected_Behavior: FuelReportRoute redirect ke /?tab=spj_oli sebelum FuelReportList dirender_
    - _Preservation: admin_spj_oli tetap bisa akses /spj-oli; role BBM yang valid tetap bisa akses /fuel-reports (Requirements 3.6, 3.7)_
    - _Requirements: 1.12_

  - [ ] 4.4 Verifikasi exploration tests Bug 3, 8, 9 sekarang lulus
    - **Property 1: Expected Behavior** - Route Guard Fixes
    - **IMPORTANT**: Re-run SAME tests dari Tugas 1 (Bug 3, 8, 9) — jangan tulis test baru
    - Test NonFuelSpecialistRoute redirect ke login → **EXPECTED: LULUS**
    - Test getRoleLandingPath('admin_rencana_kerja_bbm') ≠ '/' → **EXPECTED: LULUS**
    - Test FuelReportRoute redirect admin_spj_oli → **EXPECTED: LULUS**
    - _Requirements: 1.4, 1.11, 1.12_

  - [ ] 4.5 Verifikasi preservation tests tetap lulus setelah fix Bug 3, 8, 9
    - **Property 2: Preservation** - Route Guard Group
    - **IMPORTANT**: Re-run SAME tests dari Tugas 2 (PBT 2b, 2c, 2d, 2h, 2i)
    - User tanpa session tetap diredirect dari semua route → **EXPECTED: LULUS**
    - Route guard role BBM valid tetap bekerja → **EXPECTED: LULUS**
    - admin_spj_oli masih akses /spj-oli → **EXPECTED: LULUS**
    - getRoleLandingPath snapshot untuk role existing tidak berubah → **EXPECTED: LULUS**
    - canAccessFuelArea tetap true untuk role BBM yang valid → **EXPECTED: LULUS**

---

- [ ] 5. Fix Bug 7, 8 (access-control) – `access-control.ts`

  - [ ] 5.1 Bug 7 – Hapus email bypass dari fungsi akses kontrol
    - File: `artifacts/laporan-kerja/src/constants/access-control.ts`
    - Baca seluruh file `access-control.ts` terlebih dahulu sebelum mengubah apapun
    - Identifikasi semua fungsi yang menggunakan `SYSTEM_EMAILS`: `isSuperAdminAccess`, `isPimpinanAccess`, `isAdminHarianAccess`
    - Ubah setiap fungsi agar hanya mengandalkan parameter `role`, hapus semua referensi ke `SYSTEM_EMAILS` dari kondisi logika:
      ```typescript
      // Sebelum:
      export const isSuperAdminAccess = (role, email) =>
        role === USER_ROLES.ADMIN || SYSTEM_EMAILS.superAdmin.includes(email ?? '');
      // Sesudah:
      export const isSuperAdminAccess = (role: string | null | undefined) =>
        role === USER_ROLES.ADMIN;
      ```
    - Lakukan hal yang sama untuk `isPimpinanAccess` dan `isAdminHarianAccess`
    - Hapus atau komentari konstanta `SYSTEM_EMAILS` agar tidak digunakan dalam kondisi logika (bisa dipertahankan sebagai dokumentasi)
    - Cari `OvertimeAccessRoute` di `App.tsx` — hapus kondisi `session.user.email === 'admin@gmail.com'` dan ganti dengan pengecekan role yang tepat
    - Update signature fungsi di semua pemanggil: hapus argumen `email` yang tidak lagi dibutuhkan (atau buat parameter opsional untuk backward compat sementara)
    - **PRASYARAT**: Pastikan akun-akun privileged sudah memiliki role yang sesuai di tabel `profiles` Supabase sebelum menerapkan perubahan ini ke production
    - _Bug_Condition: isBugCondition_Bug7(X) — X.userEmail IN SYSTEM_EMAILS AND X.userRole does not match expected role_
    - _Expected_Behavior: isSuperAdminAccess(role) hanya true jika role === USER_ROLES.ADMIN_
    - _Preservation: user dengan profile.role = 'admin' tetap mendapat akses super admin (Requirements 3.13, 3.14)_
    - _Requirements: 1.9, 1.10_

  - [ ] 5.2 Verifikasi exploration test Bug 7 sekarang lulus
    - **Property 1: Expected Behavior** - Email Hardcoded Access Control Fix
    - **IMPORTANT**: Re-run SAME test dari Tugas 1 (Bug 7) — jangan tulis test baru
    - Test isSuperAdminAccess('user', 'admin@gmail.com') returns false → **EXPECTED: LULUS**
    - Test tidak ada email literal di kondisi logika access-control → **EXPECTED: LULUS**
    - _Requirements: 1.9, 1.10_

  - [ ] 5.3 Verifikasi preservation tests tetap lulus setelah fix Bug 7
    - **Property 2: Preservation** - Access Control Group
    - **IMPORTANT**: Re-run SAME tests dari Tugas 2 (PBT 2i, 2j)
    - isSuperAdminAccess('admin', undefined) masih returns true → **EXPECTED: LULUS**
    - canAccessFuelArea untuk role BBM valid masih returns true → **EXPECTED: LULUS**

---

- [ ] 6. Fix Bug 4 & 6 – `FuelReportList.tsx`

  - [ ] 6.1 Bug 4 – Cegah double fetch `getAllReports` dengan guard `allActiveReports`
    - File: `artifacts/laporan-kerja/src/pages/FuelReportList.tsx`
    - Baca seluruh fungsi `loadReports` terlebih dahulu dan identifikasi kedua pemanggilan `getAllReports()`
    - Temukan state `allActiveReports` dan cara pengirimannya ke/dari `loadReports`
    - Tambahkan kondisi sebelum pemanggilan `getAllReports()` untuk `duplicateSource`:
      ```typescript
      // Hanya fetch allActiveReports jika belum ada
      if (allActiveReports.length === 0) {
        const freshAllReports = await getAllReports();
        if (id !== reqIdRef.current) return; // guard stale request
        setAllActiveReports(freshAllReports);
        // gunakan freshAllReports sebagai duplicateSource
      }
      // else: gunakan allActiveReports yang sudah ada di state
      ```
    - Untuk kasus filter "Semua" (tanpa filter spesifik): gunakan kembali `allActiveReports` yang sudah dimuat sebagai data tampilan — tidak perlu fetch ulang
    - Verifikasi `reqIdRef` guard sudah ada dan berfungsi setelah setiap `await`
    - _Bug_Condition: isBugCondition_Bug4(X) — X.filterChanged = true (trigger loadReports)_
    - _Expected_Behavior: getAllReports dipanggil maksimal 1× saat allActiveReports kosong; tidak dipanggil jika sudah terisi_
    - _Preservation: data terfilter tampil dengan benar; deteksi duplikat tetap berfungsi (Requirements 3.8–3.11)_
    - _Requirements: 1.5, 1.6_

  - [ ] 6.2 Bug 6 – Perbaiki filter bulan tanpa tahun agar query semua tahun
    - File: `artifacts/laporan-kerja/src/pages/FuelReportList.tsx`
    - Baca blok kondisi di `loadReports` yang menangani kasus `month !== 'semua'` dan `year === 'semua'`
    - Hapus penggunaan `new Date().getFullYear()` sebagai default tahun di blok tersebut
    - Ganti dengan pendekatan yang tidak membatasi tahun: ambil semua data via `getAllReports()` kemudian filter sisi klien berdasarkan bulan, ATAU gunakan query tanpa batasan tahun jika API mendukungnya
    - Pilih pendekatan yang paling konsisten dengan pola yang sudah ada di codebase
    - Verifikasi kasus bulan + tahun keduanya dipilih masih menghasilkan query yang benar (tidak terganggu)
    - Verifikasi kasus tahun saja tanpa bulan masih benar (tidak terganggu)
    - _Bug_Condition: isBugCondition_Bug6(X) — X.selectedMonth != 'semua' AND X.selectedYear = 'semua'_
    - _Expected_Behavior: query tidak membatasi ke tahun berjalan; data dari semua tahun untuk bulan tersebut ditampilkan_
    - _Preservation: filter bulan+tahun dan filter tahun saja tetap menampilkan data yang tepat (Requirements 3.8, 3.9)_
    - _Requirements: 1.8_

  - [ ] 6.3 Verifikasi exploration tests Bug 4 & 6 sekarang lulus
    - **Property 1: Expected Behavior** - FuelReportList Data Fetching Fixes
    - **IMPORTANT**: Re-run SAME tests dari Tugas 1 (Bug 4 dan Bug 6) — jangan tulis test baru
    - Test getAllReports dipanggil maksimal 1× per filter change → **EXPECTED: LULUS**
    - Test filter Januari + Semua Tahun tidak hardcode tahun → **EXPECTED: LULUS**
    - _Requirements: 1.5, 1.6, 1.8_

  - [ ] 6.4 Verifikasi preservation tests tetap lulus setelah fix Bug 4 & 6
    - **Property 2: Preservation** - FuelReportList Group
    - **IMPORTANT**: Re-run SAME tests dari Tugas 2 (PBT 2e, 2f)
    - Filter bulan+tahun tetap menampilkan data yang tepat → **EXPECTED: LULUS**
    - Filter tahun saja tetap benar → **EXPECTED: LULUS**
    - Deteksi duplikat tetap berfungsi → **EXPECTED: LULUS**

---

- [ ] 7. Fix Bug 5 & 10 – `Index.tsx`

  - [ ] 7.1 Bug 5 – Perbaiki stale closure `loadRecordCounts` dengan `useRef`
    - File: `artifacts/laporan-kerja/src/pages/Index.tsx`
    - Baca implementasi `loadRecordCounts` dan `useEffect` yang memanggilnya terlebih dahulu
    - Identifikasi state `reports` dan `workPlans` yang dibaca di dalam `loadRecordCounts` via closure
    - Tambahkan `useRef` untuk menyimpan nilai terbaru:
      ```typescript
      const reportsRef = useRef<typeof reports>(reports);
      useEffect(() => { reportsRef.current = reports; }, [reports]);
      ```
    - Lakukan hal yang sama untuk `workPlans` jika juga terdampak stale closure
    - Di dalam `loadRecordCounts`, ganti `reports.length` dengan `reportsRef.current.length` (dan equivalen untuk `workPlans`)
    - Alternatif: teruskan `reports` sebagai parameter ke `loadRecordCounts` secara eksplisit daripada via closure
    - Verifikasi bahwa `loadRecordCounts` sekarang membaca nilai terbaru, bukan nilai saat `useEffect` didaftarkan
    - _Bug_Condition: isBugCondition_Bug5(X) — X.closureReportsLength = 0 AND X.reportsLoadedInState = true_
    - _Expected_Behavior: loadRecordCounts membaca reports.length terbaru; getDatabaseRecordCount tidak dipanggil jika reports sudah terisi_
    - _Preservation: tab badge tetap menampilkan count yang akurat saat query berhasil (Requirements 3.12)_
    - _Requirements: 1.7_

  - [ ] 7.2 Bug 10 – Tambahkan `AbortController` dengan timeout 8 detik ke `getDatabaseRecordCount`
    - File: `artifacts/laporan-kerja/src/pages/Index.tsx`
    - Baca implementasi `getDatabaseRecordCount` terlebih dahulu
    - Tambahkan `AbortController` dan timeout eksplisit:
      ```typescript
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 8000);
      try {
        let query = supabase
          .from(table)
          .select('id', { count: 'exact', head: true })
          .abortSignal(controller.signal);
        // ... terapkan filter tambahan jika ada
        const { count, error } = await query;
        if (error) throw error;
        return count ?? 0;
      } finally {
        window.clearTimeout(timeoutId);
      }
      ```
    - Verifikasi bahwa `loadRecordCounts` sudah menggunakan `try/catch` per-tab (masing-masing job dibungkus try/catch) sehingga timeout satu tab tidak memblokir tab lain
    - Jika belum, tambahkan per-tab `try/catch` di `loadRecordCounts`: jika satu `getDatabaseRecordCount` throw, tab tersebut mengembalikan `null` tapi tab lain tetap berjalan
    - Pastikan UI menangani `null` count dengan graceful (misalnya tidak tampilkan badge, atau tampilkan '—')
    - _Bug_Condition: isBugCondition_Bug10(X) — X.tableSize = 'large' AND query tanpa AbortController_
    - _Expected_Behavior: getDatabaseRecordCount throw abort error dalam ≤ 8 detik; per-tab catch memastikan tab lain tetap responsif_
    - _Preservation: tab badge tetap menampilkan count yang akurat saat query berhasil dalam batas waktu (Requirements 3.12)_
    - _Requirements: 1.13_

  - [ ] 7.3 Verifikasi exploration tests Bug 5 & 10 sekarang lulus
    - **Property 1: Expected Behavior** - Index.tsx Fixes
    - **IMPORTANT**: Re-run SAME tests dari Tugas 1 (Bug 5 dan Bug 10) — jangan tulis test baru
    - Test loadRecordCounts tidak query DB saat reports sudah terisi → **EXPECTED: LULUS**
    - Test getDatabaseRecordCount throw dalam ≤ 8 detik pada query lambat → **EXPECTED: LULUS**
    - _Requirements: 1.7, 1.13_

  - [ ] 7.4 Verifikasi preservation tests tetap lulus setelah fix Bug 5 & 10
    - **Property 2: Preservation** - Index.tsx Group
    - **IMPORTANT**: Re-run SAME tests dari Tugas 2 (PBT 2g)
    - Tab badge tetap menampilkan count yang akurat pada query cepat → **EXPECTED: LULUS**

---

- [ ] 8. Checkpoint – Semua Test Lulus, Tidak Ada Regresi

  - Jalankan SELURUH exploration tests (dari Tugas 1 — semua 10 bug) — semua harus **LULUS**
  - Jalankan SELURUH preservation tests (dari Tugas 2) — semua harus **LULUS**
  - Pastikan tidak ada TypeScript compilation error (`tsc --noEmit` atau ekuivalen):
    - `artifacts/laporan-kerja/src/context/AuthContext.tsx`
    - `artifacts/laporan-kerja/src/App.tsx`
    - `artifacts/laporan-kerja/src/constants/access-control.ts`
    - `artifacts/laporan-kerja/src/pages/FuelReportList.tsx`
    - `artifacts/laporan-kerja/src/pages/Index.tsx`
  - Review singkat setiap file yang dimodifikasi untuk memastikan tidak ada perubahan yang tidak disengaja:
    - **AuthContext.tsx** — `finally` block + ref consistency untuk Bug 1; optional chaining untuk Bug 2
    - **App.tsx** — session check di `NonFuelSpecialistRoute` (Bug 3); optional chaining di `ProtectedRoute` (Bug 2); redirect di `FuelReportRoute` (Bug 9); email check di `OvertimeAccessRoute` (Bug 7)
    - **access-control.ts** — email bypass dihapus (Bug 7); case baru di `getRoleLandingPath` (Bug 8); `isSpjOliAdmin` dihapus dari `canAccessFuelArea` (Bug 9)
    - **FuelReportList.tsx** — guard `allActiveReports` di `loadReports` (Bug 4); hapus hardcoded `getFullYear()` (Bug 6)
    - **Index.tsx** — `useRef` untuk stale closure (Bug 5); `AbortController` + per-tab catch (Bug 10)
  - Tanyakan ke user jika ada ketidakjelasan atau keputusan implementasi yang memerlukan konfirmasi sebelum menutup.
