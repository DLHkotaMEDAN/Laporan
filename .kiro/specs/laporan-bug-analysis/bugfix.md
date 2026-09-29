# Bugfix Requirements Document

## Introduction

Dokumen ini mencakup analisis bug dan kelemahan keamanan yang ditemukan pada aplikasi **Laporan Kerja** — aplikasi web React + TypeScript dengan backend Supabase yang digunakan oleh Dinas Lingkungan Hidup Kota Medan. Terdapat 10 bug/kelemahan yang dikelompokkan dalam empat kategori: bug autentikasi/auth state, bug route guard, bug performa/data fetching, dan kelemahan keamanan akses kontrol.

---

## Bug Analysis

### Current Behavior (Defect)

**[BUG 1] Race Condition di AuthContext — Halaman Stuck "Memuat..."**

1.1 WHEN `supabase.auth.getSession()` dan `onAuthStateChange` keduanya dipanggil hampir bersamaan dengan `userId` yang sama, THEN `fetchingProfileRef.current === userId` pada pemanggilan kedua menyebabkan fungsi return dini, namun `loading` yang di-set `true` oleh pemanggilan pertama tidak pernah di-reset ke `false` jika `fetchingProfileRef.current` sudah diubah kembali ke `null` saat callback selesai — mengakibatkan halaman stuck di state "Memuat..." selamanya.

1.2 WHEN pemanggilan `fetchProfile` pertama selesai dan meng-set `fetchingProfileRef.current = null`, kemudian pemanggilan kedua yang sudah keluar lebih awal tidak pernah memanggil `setLoading(false)`, THEN `loading` state tetap bernilai `true` meski data profil sudah berhasil dimuat.

**[BUG 2] ProtectedRoute — Null Reference Error pada `profile.role`**

1.3 WHEN `session` ada (tidak null) tetapi `profile` masih `null` karena fetch profil belum selesai, THEN `getRoleLandingPath(profile.role)` melempar `TypeError: Cannot read properties of null (reading 'role')` karena `profile` diakses tanpa optional chaining meski sudah dicek `profile?.role` pada kondisi `if`.

**[BUG 3] NonFuelSpecialistRoute — Tidak Ada Redirect ke Login**

1.4 WHEN user yang belum login (tidak punya session) mengakses route yang dilindungi `NonFuelSpecialistRoute`, THEN sistem tidak melakukan redirect ke `/login` karena `NonFuelSpecialistRoute` tidak memeriksa `session` sama sekali — user tanpa session melewati guard dan melihat konten yang dilindungi atau error tak terduga.

**[BUG 4] Double Data Fetch di FuelReportList**

1.5 WHEN user mengubah filter (tanggal, bulan, atau tahun) di halaman `FuelReportList`, THEN fungsi `loadReports` selalu memanggil `getAllReports()` dua kali secara berurutan: sekali untuk mengambil data terfilter dan sekali lagi khusus untuk deteksi duplikat (`duplicateSource`), mengakibatkan 2 round-trip ke Supabase setiap kali filter berubah.

1.6 WHEN filter menampilkan data "Semua" (tidak ada filter aktif), THEN `getAllReports()` dipanggil dua kali dengan parameter identik, memuat data yang persis sama dua kali tanpa alasan yang valid.

**[BUG 5] Index.tsx — `loadRecordCounts` Selalu Query DB saat Pertama Dipanggil**

1.7 WHEN `loadRecordCounts()` dipanggil di dalam `useEffect` pertama saat `profile` tersedia, THEN kondisi `reports.length > 0` selalu bernilai `false` karena `reports` state belum terisi data (data baru dimuat setelah `useEffect` ini berjalan), sehingga selalu memanggil `getDatabaseRecordCount()` ke database meskipun data laporan sudah akan segera dimuat.

**[BUG 6] FuelReportList — Filter Bulan tanpa Tahun Menggunakan Tahun Hardcoded**

1.8 WHEN user memilih filter bulan (misalnya "Januari") tetapi membiarkan filter tahun tetap "Semua Tahun", THEN sistem menggunakan `new Date().getFullYear()` (tahun saat ini) secara hardcoded untuk membentuk rentang tanggal query, bukan menampilkan data untuk bulan tersebut di semua tahun — perilaku ini tidak konsisten dengan label "Semua Tahun" yang masih ditampilkan di UI.

**[BUG 7] Kelemahan Keamanan — Email Hardcoded di Access Control**

1.9 WHEN pihak luar mengetahui email yang tercantum di `SYSTEM_EMAILS` (`admin@gmail.com`, `pimpinan@gmail.com`, `sakinah@gmail.com`, `admin.laporan@gmail.com`), THEN mereka dapat mendaftar akun baru dengan salah satu email tersebut dan mendapatkan hak akses admin/pimpinan/admin-harian tanpa melalui proses pemberian role yang sah, karena `isSuperAdminAccess`, `isPimpinanAccess`, dan `isAdminHarianAccess` mengizinkan bypass berdasarkan email saja.

1.10 WHEN kode di `OvertimeAccessRoute` memeriksa akses dengan `session.user.email === 'admin@gmail.com'`, THEN email hardcoded langsung di dalam komponen route menjadi attack surface tambahan yang terpisah dari sistem role resmi.

**[BUG 8] `getRoleLandingPath` Tidak Menangani `admin_rencana_kerja_bbm` dan `admin_wilayah_bbm`**

1.11 WHEN user dengan role `admin_rencana_kerja_bbm` atau `admin_wilayah_bbm` login dan diarahkan oleh `ProtectedRoute` (karena `isAdminBbmAccess` dan `isAdminRencanaKerjaAccess` mengembalikan `true` untuk kedua role tersebut), THEN `getRoleLandingPath(profile.role)` mengembalikan `'/'` sebagai fallback — redirect ke `'/'` kembali memicu `ProtectedRoute` yang kembali meredirect ke `'/'`, menyebabkan infinite redirect loop.

**[BUG 9] `canAccessFuelArea` Mengizinkan `admin_spj_oli` Masuk ke `/fuel-reports`**

1.12 WHEN user dengan role `admin_spj_oli` mengakses route `/fuel-reports` yang dilindungi `FuelReportRoute`, THEN `canAccessFuelArea` mengembalikan `true` (karena `isSpjOliAdmin` termasuk di dalamnya) sehingga guard lolos, dan user sempat melihat halaman loading `FuelReportList` sebelum akhirnya mendapat pesan "Akses ditolak" dari pengecekan internal komponen — route guard tidak mencegah akses di level yang benar.

**[BUG 10] `getDatabaseRecordCount` Berpotensi Timeout di Tabel Besar**

1.13 WHEN `getDatabaseRecordCount` dipanggil pada tabel yang memiliki jumlah baris sangat besar, THEN query `{ count: 'exact', head: true }` tanpa index yang optimal dapat menyebabkan full table scan di sisi database, berpotensi mengakibatkan timeout atau degradasi performa yang signifikan saat halaman Index pertama kali dimuat.

---

### Expected Behavior (Correct)

**[BUG 1] Race Condition di AuthContext**

2.1 WHEN `getSession()` dan `onAuthStateChange` keduanya memanggil `fetchProfile` dengan `userId` yang sama secara bersamaan, THEN pemanggilan kedua SHALL ditolak dan `loading` state SHALL selalu di-reset ke `false` setelah pemanggilan pertama selesai — tidak ada state "Memuat..." yang permanen.

2.2 WHEN `fetchProfile` selesai (sukses atau gagal), THEN `setLoading(false)` SHALL selalu dipanggil tanpa pengecualian, termasuk pada jalur error yang sekarang menggunakan `break` tanpa reset loading.

**[BUG 2] ProtectedRoute — Null Reference Error**

2.3 WHEN `session` ada tetapi `profile` masih `null` dan kondisi redirect role terpenuhi, THEN sistem SHALL menggunakan optional chaining secara konsisten (`profile?.role`) pada semua titik akses property `profile` di dalam blok redirect, sehingga tidak terjadi `TypeError`.

**[BUG 3] NonFuelSpecialistRoute — Tidak Ada Redirect ke Login**

2.4 WHEN user yang tidak memiliki session (belum login) mengakses route yang dilindungi `NonFuelSpecialistRoute`, THEN sistem SHALL melakukan redirect ke `/login` sebelum melakukan pemeriksaan role apapun.

**[BUG 4] Double Data Fetch di FuelReportList**

2.5 WHEN `loadReports` dipanggil untuk memuat data terfilter, THEN `getAllReports()` untuk kebutuhan deteksi duplikat SHALL dipanggil secara terpisah hanya ketika data `allActiveReports` belum tersedia atau secara eksplisit di-invalidate — bukan setiap kali filter berubah.

2.6 WHEN filter "Semua" aktif (tidak ada filter spesifik), THEN hasil dari `getAllReports()` yang sudah dimuat SHALL digunakan kembali sebagai `allActiveReports` tanpa fetch ulang.

**[BUG 5] Index.tsx — `loadRecordCounts` Closure Stale**

2.7 WHEN `loadRecordCounts` dipanggil dan data laporan sudah berhasil dimuat ke state `reports`, THEN `reports.length > 0` SHALL mengevaluasi dengan benar menggunakan nilai terkini — bukan nilai closure yang stale dari saat `useEffect` didaftarkan.

**[BUG 6] FuelReportList — Filter Bulan tanpa Tahun**

2.8 WHEN user memilih bulan tertentu tetapi filter tahun masih "Semua Tahun", THEN sistem SHALL menampilkan data untuk bulan tersebut di semua tahun yang tersedia (query tanpa batasan tahun), bukan membatasi ke tahun saat ini secara hardcoded.

**[BUG 7] Email Hardcoded di Access Control**

2.9 WHEN pengecekan akses dilakukan untuk role super admin, pimpinan, atau admin harian, THEN sistem SHALL mengandalkan kolom `role` pada tabel `profiles` di database sebagai sumber kebenaran tunggal — bukan perbandingan email string yang dapat dieksploitasi.

2.10 WHEN `SYSTEM_EMAILS` masih diperlukan untuk kompatibilitas mundur selama migrasi, THEN akun-akun tersebut SHALL memiliki role yang sesuai di tabel `profiles` sehingga pengecekan email menjadi redundan dan dapat dihapus secara bertahap.

**[BUG 8] `getRoleLandingPath` Role Tidak Lengkap**

2.11 WHEN user dengan role `admin_rencana_kerja_bbm` atau `admin_wilayah_bbm` diarahkan oleh route guard, THEN `getRoleLandingPath` SHALL mengembalikan path landing yang tepat untuk kedua role tersebut (misalnya path dashboard kombinasi BBM + Rencana Kerja) sehingga tidak terjadi infinite redirect loop.

**[BUG 9] `canAccessFuelArea` Termasuk `admin_spj_oli`**

2.12 WHEN user dengan role `admin_spj_oli` mengakses route `/fuel-reports`, THEN `FuelReportRoute` SHALL menolak akses di level route guard dan langsung meredirect ke path landing yang sesuai (`/?tab=spj_oli`) tanpa user sempat masuk ke komponen `FuelReportList`.

**[BUG 10] `getDatabaseRecordCount` Potensi Timeout**

2.13 WHEN `getDatabaseRecordCount` dipanggil untuk menghitung record, THEN query SHALL memiliki penanganan timeout yang eksplisit dan mekanisme graceful fallback sehingga kegagalan satu count tidak memblokir seluruh render halaman Index.

---

### Unchanged Behavior (Regression Prevention)

**Auth & Session**

3.1 WHEN user login dengan kredensial valid, THEN sistem SHALL CONTINUE TO memuat profil dan menampilkan dashboard yang sesuai tanpa perlu refresh halaman.

3.2 WHEN user mengakses halaman manapun tanpa session, THEN sistem SHALL CONTINUE TO meredirect ke `/login`.

3.3 WHEN user logout, THEN sistem SHALL CONTINUE TO menghapus session, mencatat audit log, dan meredirect ke `/login`.

**Route Guard**

3.4 WHEN user dengan role `admin_bbm`, `admin_bbm_pusat`, `admin_laporan_bbm`, atau `admin_spj_bbm` mengakses route `/` (Index), THEN sistem SHALL CONTINUE TO meredirect ke path landing yang sesuai via `ProtectedRoute`.

3.5 WHEN user dengan role non-BBM yang valid (misalnya `admin`, `user`, `laporan`) mengakses route `/`, THEN `ProtectedRoute` SHALL CONTINUE TO menampilkan halaman Index tanpa redirect.

3.6 WHEN user dengan role `admin_spj_oli` mengakses route `/spj-oli`, THEN `SpjOliRoute` SHALL CONTINUE TO mengizinkan akses.

3.7 WHEN user dengan role yang tidak punya akses BBM mengakses `/fuel-reports`, THEN sistem SHALL CONTINUE TO meredirect ke path yang sesuai.

**Data Fetching**

3.8 WHEN user memilih filter bulan DAN tahun secara bersamaan di FuelReportList, THEN sistem SHALL CONTINUE TO menampilkan data dalam rentang bulan dan tahun yang dipilih dengan benar.

3.9 WHEN user memilih filter tahun saja (tanpa bulan) di FuelReportList, THEN sistem SHALL CONTINUE TO menampilkan semua data dalam tahun yang dipilih.

3.10 WHEN user memilih tanggal spesifik di FuelReportList, THEN sistem SHALL CONTINUE TO menampilkan data untuk tanggal tersebut saja.

3.11 WHEN data duplikat ada di FuelReportList, THEN sistem SHALL CONTINUE TO mendeteksi dan menampilkan indikator duplikat pada baris yang relevan.

3.12 WHEN `loadRecordCounts` berhasil memuat semua count, THEN tab badge di halaman Index SHALL CONTINUE TO menampilkan jumlah record yang akurat.

**Access Control**

3.13 WHEN user dengan role `admin` (super admin) mengakses semua fitur, THEN sistem SHALL CONTINUE TO memberikan akses penuh tanpa pembatasan.

3.14 WHEN user dengan role valid mengakses fitur sesuai hak aksesnya, THEN pengecekan role berbasis `profile.role` dari database SHALL CONTINUE TO berfungsi normal.

3.15 WHEN user dengan role `admin_rencana_kerja` mengakses `/work-plans`, THEN sistem SHALL CONTINUE TO mengizinkan akses tanpa redirect loop.

---

## Bug Condition Pseudocode

### Bug 1 — Race Condition AuthContext

```pascal
FUNCTION isBugCondition_Bug1(X)
  INPUT: X = { event: AuthEvent, userId: string, timing: 'concurrent' | 'sequential' }
  OUTPUT: boolean
  RETURN X.event IN ['getSession', 'INITIAL_SESSION'] AND X.timing = 'concurrent'
END FUNCTION

// Fix Checking
FOR ALL X WHERE isBugCondition_Bug1(X) DO
  result ← AuthProvider_fixed(X)
  ASSERT result.loading = false AFTER profile_fetch_completes
END FOR

// Preservation Checking
FOR ALL X WHERE NOT isBugCondition_Bug1(X) DO
  ASSERT AuthProvider(X) = AuthProvider_fixed(X)
END FOR
```

### Bug 3 — NonFuelSpecialistRoute tanpa Session Check

```pascal
FUNCTION isBugCondition_Bug3(X)
  INPUT: X = { session: Session | null, role: UserRole | null }
  OUTPUT: boolean
  RETURN X.session = null
END FUNCTION

FOR ALL X WHERE isBugCondition_Bug3(X) DO
  result ← NonFuelSpecialistRoute_fixed(X)
  ASSERT result = Redirect('/login')
END FOR
```

### Bug 4 — Double Fetch

```pascal
FUNCTION isBugCondition_Bug4(X)
  INPUT: X = { filterChanged: boolean, allActiveReportsLoaded: boolean }
  OUTPUT: boolean
  RETURN X.filterChanged = true
END FUNCTION

FOR ALL X WHERE isBugCondition_Bug4(X) DO
  fetchCount ← countSupabaseCalls(loadReports_fixed(X))
  ASSERT fetchCount <= 1 OR (fetchCount = 2 AND NOT X.allActiveReportsLoaded)
END FOR
```

### Bug 8 — Redirect Loop

```pascal
FUNCTION isBugCondition_Bug8(X)
  INPUT: X = { role: UserRole }
  OUTPUT: boolean
  RETURN X.role IN ['admin_rencana_kerja_bbm', 'admin_wilayah_bbm']
    AND isAdminBbmAccess(X.role) = true
    AND getRoleLandingPath(X.role) = '/'
END FUNCTION

FOR ALL X WHERE isBugCondition_Bug8(X) DO
  result ← getRoleLandingPath_fixed(X.role)
  ASSERT result != '/' OR ProtectedRoute_does_not_redirect_on_result(result)
END FOR
```
