# Laporan Bug Analysis – Bugfix Design

## Overview

Dokumen ini merancang solusi teknis untuk **10 bug dan kelemahan keamanan** yang ditemukan pada aplikasi **Sistem Laporan Kerja – Dinas Lingkungan Hidup Kota Medan** (React + TypeScript + Supabase). Bug dikelompokkan menjadi empat area:

- **Area A – Auth & State** (Bug 1, 2): Race condition AuthContext dan null reference di ProtectedRoute
- **Area B – Route Guard** (Bug 3, 8, 9): Celah redirect, infinite loop, dan guard yang tidak tepat
- **Area C – Data Fetching & Filtering** (Bug 4, 5, 6, 10): Double fetch, stale closure, bulan hardcoded, dan timeout
- **Area D – Keamanan Akses** (Bug 7): Email hardcoded di source code

Strategi perbaikan: perubahan bedah minimal yang terisolasi — tidak ada refactor besar-besaran. Setiap fix diverifikasi melalui pendekatan dua fase: pertama eksplorasi bug pada kode unfixed, kemudian fix checking dan preservation checking.

---

## Glossary

- **Bug_Condition (C)**: Kondisi input/state yang memicu bug — ketika fungsi menerima input yang seharusnya ditangani dengan benar tetapi menghasilkan perilaku salah.
- **Property (P)**: Perilaku yang diharapkan untuk semua input dalam C — apa yang seharusnya terjadi setelah fix.
- **Preservation (¬C)**: Input/state di luar kondisi bug — perilaku ini harus tetap identik sebelum dan sesudah fix.
- **F**: Fungsi/komponen original (sebelum diperbaiki).
- **F'**: Fungsi/komponen setelah diperbaiki.
- **fetchProfile**: Fungsi di `AuthContext.tsx` yang mengambil profil user dari tabel `profiles` Supabase.
- **fetchingProfileRef**: `useRef<string | null>` di `AuthContext.tsx` yang melindungi `fetchProfile` dari pemanggilan ganda.
- **reqIdRef**: `useRef` counter di `FuelReportList.tsx` untuk membatalkan respons request yang sudah stale.
- **duplicateSource**: Variabel dalam `loadReports` yang menampung seluruh data aktif untuk perbandingan duplikat.
- **SYSTEM_EMAILS**: Konstanta di `access-control.ts` berisi daftar email akun privileged yang saat ini hardcoded.
- **getRoleLandingPath**: Fungsi di `access-control.ts` yang mengembalikan path landing berdasarkan role user.
- **canAccessFuelArea**: Fungsi di `access-control.ts` yang menentukan apakah role boleh mengakses area BBM.
- **isBugCondition(input)**: Fungsi pseudocode yang menentukan apakah input termasuk kondisi bug.

---

## Bug Details

### Bug Condition

Sepuluh kondisi bug didefinisikan secara formal berikut ini.

---

#### Bug 1 – Race Condition di AuthContext (Loading Stuck)

Bug terjadi ketika `getSession()` dan `onAuthStateChange` keduanya memanggil `fetchProfile` untuk userId yang sama secara bersamaan. Pemanggilan kedua menemukan `fetchingProfileRef.current === userId` dan return dini — tanpa pernah memanggil `setLoading(false)`.

```
FUNCTION isBugCondition_Bug1(X)
  INPUT: X = { event: AuthEvent, userId: string, timing: 'concurrent' | 'sequential' }
  OUTPUT: boolean

  RETURN X.event IN ['getSession', 'INITIAL_SESSION']
         AND X.timing = 'concurrent'
         AND fetchingProfileRef.current = X.userId saat pemanggilan kedua masuk
END FUNCTION
```

**Contoh nyata:**
- `getSession()` resolve → memanggil `fetchProfile('uid-A')` → set `fetchingProfileRef = 'uid-A'`, `loading = true`
- `onAuthStateChange` event `INITIAL_SESSION` → memanggil `fetchProfile('uid-A')` → guard deteksi `fetchingProfileRef = 'uid-A'` → return dini
- `fetchProfile` pertama selesai → set `fetchingProfileRef = null`, `loading = false` ✓ (berhasil)
- **TETAPI**: Jika `fetchingProfileRef` sudah di-reset ke `null` sebelum pemanggilan pertama menyelesaikan `setLoading(false)`, maka pemanggilan kedua lolos guard → dua instance berjalan → salah satu tidak memanggil `setLoading(false)` → loading stuck

Selain itu, di jalur `catch` pada percobaan terakhir (attempt === 1), kode melakukan `break` lalu langsung ke `setProfile(null)` dan `setLoading(false)`. Namun `fetchingProfileRef.current` tidak di-reset, membuat pemanggilan berikutnya selalu terpental meski yang lama sudah gagal.

---

#### Bug 2 – ProtectedRoute Null Reference Error pada `profile.role`

Bug terjadi ketika session ada tetapi `profile` belum ter-fetch (masih `null`). Blok kondisi memeriksa `profile?.role` dengan optional chaining, tetapi langsung mengakses `profile.role` di dalam `getRoleLandingPath(profile.role)` tanpa optional chaining.

```
FUNCTION isBugCondition_Bug2(X)
  INPUT: X = { session: Session | null, profile: Profile | null }
  OUTPUT: boolean

  RETURN X.session IS NOT null
         AND X.profile IS null
         AND isAdminBbmAccess(X.profile?.role) OR isLaporanBbmAdmin(X.profile?.role) returns true
         AND getRoleLandingPath(profile.role) dipanggil saat profile = null
END FUNCTION
```

**Contoh nyata:**
- User dengan role `admin_bbm` login; sesi ada, tapi `profile` belum dimuat
- `isAdminBbmAccess(undefined)` → false (tidak melempar error, aman)
- Kondisi lain seperti `isLaporanBbmAdmin(profile?.role)` → false
- Kemudian kode mencapai blok `return <Navigate to={getRoleLandingPath(profile.role)} />` — `profile` adalah `null` → **TypeError: Cannot read properties of null (reading 'role')**

---

#### Bug 3 – NonFuelSpecialistRoute Tidak Ada Redirect ke Login

Bug terjadi ketika user yang belum login mengakses route yang dilindungi `NonFuelSpecialistRoute`. Guard ini tidak memeriksa session sama sekali.

```
FUNCTION isBugCondition_Bug3(X)
  INPUT: X = { session: Session | null, role: UserRole | null }
  OUTPUT: boolean

  RETURN X.session IS null
END FUNCTION
```

**Contoh nyata:**
- User belum login membuka `/report/some-id` yang dilindungi `NonFuelSpecialistRoute`
- `loading` selesai, `session = null`, `profile = null`
- Kode hanya mengecek role — tidak mengecek session → user masuk ke komponen `ReportDetail` tanpa autentikasi → RLS Supabase menolak query → error tak terduga tampil di halaman

---

#### Bug 4 – Double Data Fetch di FuelReportList

Bug terjadi setiap kali filter berubah. `loadReports` selalu memanggil `getAllReports()` dua kali: sekali untuk data terfilter dan sekali lagi untuk `duplicateSource` — bahkan ketika `allActiveReports` sudah tersedia dari sebelumnya.

```
FUNCTION isBugCondition_Bug4(X)
  INPUT: X = { filterChanged: boolean, allActiveReportsLoaded: boolean }
  OUTPUT: boolean

  RETURN X.filterChanged = true
END FUNCTION
```

**Contoh nyata — filter "Semua" aktif:**
- `getAllReports()` → 1000 baris (untuk data)
- `getAllReports()` → 1000 baris lagi (untuk duplicateSource) — **identik, tidak perlu**

**Contoh nyata — filter bulan berubah:**
- `getReportsByDateRange(...)` → 50 baris (data terfilter)
- `getAllReports()` → 1000 baris (duplicateSource) — dibutuhkan sekali, tapi dipanggil lagi meski `allActiveReports` sudah ada

---

#### Bug 5 – Index.tsx `loadRecordCounts` Stale Closure

Bug terjadi karena `loadRecordCounts` di-definisikan di dalam komponen `Index` sebagai fungsi biasa (bukan `useCallback`), sehingga ia menangkap nilai `reports` dan `workPlans` dari closure saat `useEffect` pertama kali didaftarkan — bukan nilai terbaru.

```
FUNCTION isBugCondition_Bug5(X)
  INPUT: X = { reportsLoadedInState: boolean, closureReportsLength: number }
  OUTPUT: boolean

  RETURN X.closureReportsLength = 0
         AND X.reportsLoadedInState = true
         AND loadRecordCounts dipanggil dari useEffect yang bergantung pada [profile, isLoggedIn, ...]
         AND useEffect berjalan SEBELUM loadData() selesai memuat data ke state
END FUNCTION
```

**Contoh nyata:**
- `useEffect` pertama berjalan: `loadRecordCounts()` dipanggil → `reports.length` = 0 (stale closure) → kondisi `reports.length > 0 ? ... : getDatabaseRecordCount(...)` selalu menggunakan fallback DB query
- Padahal `loadData()` berjalan bersamaan dan akan segera mengisi `reports` state
- Akibat: selalu terjadi DB query untuk hitung record meski data laporan sudah akan dimuat

---

#### Bug 6 – FuelReportList Filter Bulan tanpa Tahun Menggunakan Tahun Hardcoded

Bug terjadi ketika user memilih bulan tetapi membiarkan tahun pada "Semua Tahun". Sistem menggunakan `new Date().getFullYear()` sebagai default — inkonsisten dengan label "Semua Tahun" di UI.

```
FUNCTION isBugCondition_Bug6(X)
  INPUT: X = { selectedMonth: string, selectedYear: 'semua' | string }
  OUTPUT: boolean

  RETURN X.selectedMonth != 'semua'
         AND X.selectedYear = 'semua'
END FUNCTION
```

**Contoh nyata:**
- User memilih "Januari", tahun tetap "Semua Tahun"
- Kode mengeksekusi: `const y = new Date().getFullYear()` → startDate = `2025-01-01`, endDate = `2025-01-31`
- Data Januari 2024 dan tahun sebelumnya tidak dimuat
- Label filter menampilkan "Semua Bulan / Semua Tahun" tetapi data dibatasi ke tahun berjalan

---

#### Bug 7 – Email Hardcoded di Access Control (Kelemahan Keamanan)

Bug berupa kelemahan keamanan di mana `SYSTEM_EMAILS` terdefinisi sebagai string literal di source code. Email ini ter-bundle ke JavaScript publik dan dapat dieksploitasi untuk bypass pengecekan akses berbasis role.

```
FUNCTION isBugCondition_Bug7(X)
  INPUT: X = { userEmail: string, userRole: UserRole }
  OUTPUT: boolean

  RETURN X.userEmail IN SYSTEM_EMAILS.superAdmin
         OR X.userEmail IN SYSTEM_EMAILS.pimpinan
         OR X.userEmail IN SYSTEM_EMAILS.adminHarian
         AND X.userRole DOES NOT MATCH expected role untuk email tersebut
END FUNCTION
```

**Contoh nyata:**
- Pihak luar melihat bundle JS → menemukan `admin@gmail.com` di `SYSTEM_EMAILS.superAdmin`
- Mendaftar akun baru Supabase dengan email `admin@gmail.com`
- `isSuperAdminAccess(role, email)` → `SYSTEM_EMAILS.superAdmin.includes(email)` → **true** → akses super admin diberikan tanpa melalui assignment role di tabel `profiles`

---

#### Bug 8 – `getRoleLandingPath` Tidak Menangani `admin_rencana_kerja_bbm` dan `admin_wilayah_bbm` (Infinite Redirect)

Bug terjadi ketika `ProtectedRoute` meredirect role BBM ke `getRoleLandingPath()`, tetapi fungsi tersebut mengembalikan `'/'` untuk dua role yang memicu kondisi redirect di `ProtectedRoute` — menghasilkan infinite redirect loop.

```
FUNCTION isBugCondition_Bug8(X)
  INPUT: X = { role: UserRole }
  OUTPUT: boolean

  RETURN X.role IN ['admin_rencana_kerja_bbm', 'admin_wilayah_bbm']
         AND isAdminBbmAccess(X.role) = true
         AND isAdminRencanaKerjaAccess(X.role) = true
         AND getRoleLandingPath(X.role) = '/'
END FUNCTION
```

**Contoh nyata:**
- User `admin_rencana_kerja_bbm` login → `ProtectedRoute` cek: `isAdminBbmAccess('admin_rencana_kerja_bbm')` → true → redirect ke `getRoleLandingPath('admin_rencana_kerja_bbm')` → returns `'/'`
- User di-redirect ke `/` → `ProtectedRoute` memeriksa lagi → kondisi masih true → redirect ke `/` lagi → **infinite loop**
- Browser menampilkan halaman kosong atau error "too many redirects"

---

#### Bug 9 – `canAccessFuelArea` Mengizinkan `admin_spj_oli` Masuk ke `/fuel-reports`

Bug terjadi karena `canAccessFuelArea` menyertakan `isSpjOliAdmin(role)`, sehingga `FuelReportRoute` mengizinkan role `admin_spj_oli` melewati route guard dan masuk ke komponen `FuelReportList`.

```
FUNCTION isBugCondition_Bug9(X)
  INPUT: X = { role: UserRole, path: string }
  OUTPUT: boolean

  RETURN X.role = 'admin_spj_oli'
         AND X.path IN ['/fuel-reports', '/fuel-reports/create', '/fuel-reports-pusat', ...]
         AND canAccessFuelArea(X.role) = true
         AND isSpjOliAdmin(X.role) = true
END FUNCTION
```

**Contoh nyata:**
- User `admin_spj_oli` mengakses `/fuel-reports`
- `FuelReportRoute` cek: `canAccessFuelArea('admin_spj_oli')` → **true** (karena `isSpjOliAdmin` termasuk) → user masuk ke `FuelReportList`
- Di dalam `FuelReportList`, pengecekan internal `isAllowed` gagal → `showError("Akses ditolak...")` → user melihat flash loading kemudian pesan error
- Route guard seharusnya menolak di level router, bukan di dalam komponen

---

#### Bug 10 – `getDatabaseRecordCount` Berpotensi Timeout

Bug berupa degradasi performa di mana query `{ count: 'exact', head: true }` tanpa batas waktu eksplisit dapat menyebabkan full table scan pada tabel besar, memblokir render halaman Index.

```
FUNCTION isBugCondition_Bug10(X)
  INPUT: X = { tableSize: 'large', networkLatency: 'high' | 'normal' }
  OUTPUT: boolean

  RETURN X.tableSize = 'large'
         AND query count:exact TANPA AbortController atau timeout eksplisit
         AND Promise.all menunggu semua job termasuk yang slow
END FUNCTION
```

**Contoh nyata:**
- Tabel `fuel_reports` memiliki ratusan ribu baris tanpa composite index optimal
- `getDatabaseRecordCount('fuel_reports', ...)` menunggu 30+ detik
- Tab counter di Index tampil kosong sampai query selesai — halaman terasa tidak responsif

---

### Examples (Ringkasan Bug Manifestation)

| Bug | Kondisi Pemicu | Perilaku Aktual (Salah) | Perilaku Diharapkan |
|-----|---------------|------------------------|---------------------|
| 1 | Login pertama (concurrent getSession + INITIAL_SESSION) | Halaman stuck "Memuat..." selamanya | Dashboard muncul normal |
| 2 | Session ada, profile masih null, cek role di ProtectedRoute | TypeError: Cannot read properties of null | Menunggu profile, tidak crash |
| 3 | User belum login akses route NonFuelSpecialistRoute | Masuk ke komponen, error Supabase RLS | Redirect ke `/login` |
| 4 | Filter berubah di FuelReportList | 2 round-trip Supabase setiap filter change | Maksimal 1 fetch tambahan saat allActiveReports belum ada |
| 5 | Index mount, loadRecordCounts dipanggil sebelum loadData selesai | Selalu query DB untuk hitung record | Gunakan reports.length jika sudah tersedia |
| 6 | Pilih bulan "Januari", tahun "Semua Tahun" | Hanya tampilkan Januari tahun ini | Tampilkan Januari semua tahun |
| 7 | Daftar akun Supabase dengan `admin@gmail.com` | Dapat akses super admin tanpa role di DB | Akses ditolak, hanya role DB yang valid |
| 8 | Login sebagai `admin_rencana_kerja_bbm` | Infinite redirect loop ke `/` | Redirect ke path yang sesuai |
| 9 | `admin_spj_oli` akses `/fuel-reports` | Flash loading + pesan error di dalam komponen | Redirect langsung di route guard |
| 10 | Tabel besar, query count:exact | Halaman Index lambat/timeout | Timeout eksplisit, fallback null per-tab |

---

## Expected Behavior

### Preservation Requirements

**Perilaku yang WAJIB dipertahankan setelah semua fix diterapkan:**

1. Login dengan kredensial valid tetap memuat profil dan menampilkan dashboard sesuai role
2. User tanpa session tetap diredirect ke `/login` dari semua route yang membutuhkan autentikasi
3. User logout tetap menghapus session dan diredirect ke `/login`
4. Role `admin_bbm`, `admin_bbm_pusat`, `admin_laporan_bbm`, `admin_spj_bbm` tetap diredirect dari `ProtectedRoute` ke path landing yang sesuai
5. Role non-BBM (`admin`, `user`, `laporan`) tetap masuk ke halaman Index tanpa redirect
6. Role `admin_spj_oli` tetap punya akses ke `/spj-oli` via `SpjOliRoute`
7. Role yang tidak punya akses BBM tetap diredirect saat mengakses `/fuel-reports`
8. Filter bulan + tahun bersamaan di FuelReportList tetap menampilkan data dalam rentang yang benar
9. Filter tahun saja (tanpa bulan) tetap menampilkan semua data dalam tahun yang dipilih
10. Filter tanggal spesifik tetap menampilkan data untuk tanggal tersebut saja
11. Deteksi duplikat dan badge "Ganda" tetap berfungsi untuk laporan dalam satu periode
12. Tab badge di halaman Index tetap menampilkan jumlah record yang akurat saat berhasil dimuat
13. User dengan `profile.role = 'admin'` di tabel profiles tetap mendapat akses super admin

**Scope:**
Semua input yang TIDAK memenuhi kondisi bug di atas harus menghasilkan perilaku yang identik dengan sebelum fix. Perubahan harus bersifat bedah minimal.

---

## Hypothesized Root Cause

### Bug 1 – Race Condition AuthContext

`AuthContext` mendaftarkan `onAuthStateChange` listener dan sekaligus memanggil `getSession()` secara terpisah. Supabase v2 mengeluarkan event `INITIAL_SESSION` hampir bersamaan saat `getSession()` resolve untuk sesi yang sudah ada. Akibatnya, dua path eksekusi memanggil `fetchProfile(userId)` hampir bersamaan.

Guard `fetchingProfileRef.current === userId` sudah ada, tetapi ada celah: jika `fetchProfile` pertama selesai dan me-reset `fetchingProfileRef = null` sebelum pemanggilan kedua masuk (race window), pemanggilan kedua lolos guard dan memulai fetch baru. Selain itu, jika `fetchProfile` pertama gagal pada attempt terakhir, kode melakukan `break` → `fetchingProfileRef = null` → `setLoading(false)` — tetapi ada window di mana `fetchingProfileRef` sudah `null` tapi `loading` belum di-set `false`.

### Bug 2 – ProtectedRoute Null Reference

Di dalam `ProtectedRoute`, pengecekan kondisi menggunakan `profile?.role` dengan optional chaining, tetapi redirect menggunakan `getRoleLandingPath(profile.role)` tanpa optional chaining. Saat `profile` masih `null` (fetch belum selesai meski `loading` sudah `false`), akses `profile.role` melempar `TypeError`.

### Bug 3 – NonFuelSpecialistRoute Session Check

`NonFuelSpecialistRoute` hanya mengecek role user untuk menentukan apakah harus redirect, tetapi tidak pernah memeriksa apakah `session` ada. Komponen `ProtectedRoute`, `AdminRoute`, dan guard lain semuanya memeriksa `if (!session) return <Navigate to="/login" />` — `NonFuelSpecialistRoute` adalah satu-satunya yang melewatkan pemeriksaan ini.

### Bug 4 – Double Fetch FuelReportList

Di dalam `loadReports`, dua `await` dipanggil secara berurutan:
1. `await getReportsBySpecificDate(...)` atau `await getAllReports()` untuk data terfilter
2. `await getAllReports()` tanpa kondisi untuk `duplicateSource`

Panggilan kedua ini tidak ada guard "skip jika `allActiveReports` sudah ada". Setiap perubahan filter selalu memanggil keduanya.

### Bug 5 – Stale Closure Index.tsx

`loadRecordCounts` didefinisikan sebagai fungsi biasa di dalam komponen `Index`. Saat didaftarkan ke `useEffect` dengan dependency `[profile, isLoggedIn, ...]`, fungsi ini menangkap nilai `reports` dan `workPlans` dari saat render pertama (keduanya `[]`). `useEffect` berjalan setelah render, tapi `loadData()` yang mengisi state juga berjalan asinkron — sehingga ketika `loadRecordCounts` membaca `reports.length`, nilainya masih 0.

### Bug 6 – Tahun Hardcoded FuelReportList

Blok kondisi `else if (month !== "semua")` (bulan dipilih tanpa tahun) menggunakan `new Date().getFullYear()` sebagai default tahun. Ini adalah keputusan desain yang tidak konsisten dengan opsi "Semua Tahun" di UI. Seharusnya jika tahun adalah "semua", query tidak dibatasi tahun.

### Bug 7 – Email Hardcoded Access Control

`SYSTEM_EMAILS` berisi array string literal email yang ditambahkan ke fungsi akses seperti `isSuperAdminAccess`, `isPimpinanAccess`, dan `isAdminHarianAccess`. Fungsi-fungsi ini diekspose ke seluruh codebase. Webpack/Vite menyertakan semua konstanta string ke bundle JavaScript akhir yang dapat diinspeksi publik via browser DevTools. Siapapun yang mendaftarkan akun Supabase dengan salah satu email tersebut mendapat hak akses tanpa assignment role resmi.

### Bug 8 – getRoleLandingPath Tidak Lengkap

`isAdminBbmAccess` mengembalikan `true` untuk `admin_rencana_kerja_bbm` dan `admin_wilayah_bbm`. `ProtectedRoute` meredirect role-role ini ke `getRoleLandingPath(profile.role)`. Namun `getRoleLandingPath` tidak memiliki case untuk kedua role tersebut → returns fallback `'/'`. Di path `/`, `ProtectedRoute` berjalan lagi, kondisi masih true, redirect ke `/` lagi → infinite loop.

### Bug 9 – canAccessFuelArea Inklusif berlebih

`canAccessFuelArea` memasukkan `isSpjOliAdmin(role)` sehingga `admin_spj_oli` lolos `FuelReportRoute`. Namun di dalam `FuelReportList`, pengecekan `isAllowed` menggunakan logika berbeda yang tidak menyertakan `admin_spj_oli` → user sempat masuk komponen lalu mendapat error. `canAccessFuelArea` seharusnya tidak mencakup `admin_spj_oli` untuk route `/fuel-reports`.

### Bug 10 – getDatabaseRecordCount Tanpa Timeout

`getDatabaseRecordCount` menggunakan `{ count: 'exact', head: true }` yang meminta PostgreSQL menghitung seluruh baris yang cocok. Tanpa `AbortController` atau timeout eksplisit, query dapat berjalan sampai batas timeout database (biasanya 30 detik di Supabase free tier). Seluruh `Promise.all` di `loadRecordCounts` akan menunggu job yang paling lambat.

---

## Correctness Properties

Property 1: Bug Condition – AuthContext Loading State Selalu Reset

_For any_ pasangan panggilan `fetchProfile(userId)` yang terjadi bersamaan (concurrently) dengan `userId` yang sama, versi `fetchProfile` yang diperbaiki SHALL memastikan bahwa (a) hanya satu instance yang berjalan sampai selesai, dan (b) `setLoading(false)` SHALL selalu dipanggil tepat sekali setelah instance tersebut selesai, baik sukses maupun gagal.

**Validates: Requirements 2.1, 2.2**

---

Property 2: Bug Condition – ProtectedRoute Tidak Crash saat profile Null

_For any_ kondisi di mana `session` ada tetapi `profile` masih `null`, komponen `ProtectedRoute` yang diperbaiki SHALL TIDAK mengakses property `profile.role` secara langsung tanpa optional chaining, sehingga tidak terjadi `TypeError`.

**Validates: Requirements 2.3**

---

Property 3: Bug Condition – NonFuelSpecialistRoute Redirect ke Login

_For any_ request ke route yang dilindungi `NonFuelSpecialistRoute` di mana `session` adalah `null`, komponen yang diperbaiki SHALL mengembalikan `<Navigate to="/login" />` sebelum melakukan pengecekan role apapun.

**Validates: Requirements 2.4**

---

Property 4: Bug Condition – FuelReportList Tidak Double Fetch

_For any_ pemanggilan `loadReports` di mana `allActiveReports` sudah terisi (panjang > 0), versi `loadReports` yang diperbaiki SHALL TIDAK memanggil `getAllReports()` untuk `duplicateSource` — menggunakan data yang sudah ada di state.

_For any_ pemanggilan `loadReports` di mana `allActiveReports` kosong, `getAllReports()` boleh dipanggil sekali untuk mengisi `allActiveReports`.

**Validates: Requirements 2.5, 2.6**

---

Property 5: Bug Condition – loadRecordCounts Menggunakan Data Terbaru

_For any_ kondisi di mana `reports` state sudah terisi sebelum atau saat `loadRecordCounts` dievaluasi, versi yang diperbaiki SHALL membaca panjang array `reports` yang terbaru (bukan nilai closure stale dari render sebelumnya) untuk memutuskan apakah perlu query DB.

**Validates: Requirements 2.7**

---

Property 6: Bug Condition – Filter Bulan tanpa Tahun Query Semua Tahun

_For any_ kombinasi filter di mana `month !== 'semua'` DAN `year === 'semua'`, versi `loadReports` yang diperbaiki SHALL menampilkan data untuk bulan tersebut di **semua tahun yang tersedia**, bukan membatasi ke tahun berjalan.

**Validates: Requirements 2.8**

---

Property 7: Bug Condition – Akses Tidak Berdasarkan Email Hardcoded

_For any_ user yang memiliki email yang cocok dengan `SYSTEM_EMAILS` tetapi TIDAK memiliki role yang sesuai di tabel `profiles`, pengecekan akses yang diperbaiki SHALL TIDAK memberikan hak akses elevated. Akses hanya diberikan berdasarkan kolom `role` di tabel `profiles`.

**Validates: Requirements 2.9, 2.10**

---

Property 8: Bug Condition – getRoleLandingPath Mengembalikan Path Valid untuk Semua Role BBM

_For any_ role dalam set `['admin_rencana_kerja_bbm', 'admin_wilayah_bbm']`, `getRoleLandingPath` yang diperbaiki SHALL mengembalikan path yang TIDAK memicu kondisi redirect di `ProtectedRoute`, sehingga tidak terjadi infinite redirect loop.

**Validates: Requirements 2.11**

---

Property 9: Bug Condition – FuelReportRoute Menolak admin_spj_oli

_For any_ navigasi ke route `/fuel-reports` atau `/fuel-reports-pusat` oleh user dengan role `admin_spj_oli`, `FuelReportRoute` yang diperbaiki SHALL menolak akses dan meredirect ke path landing yang sesuai TANPA user sempat masuk ke komponen `FuelReportList`.

**Validates: Requirements 2.12**

---

Property 10: Bug Condition – getDatabaseRecordCount Memiliki Timeout Eksplisit

_For any_ pemanggilan `getDatabaseRecordCount` pada tabel berapapun ukurannya, fungsi yang diperbaiki SHALL menerapkan timeout eksplisit (misalnya 8 detik) menggunakan `AbortController`. Jika query melebihi batas waktu, fungsi SHALL throw error sehingga `Promise.all` dengan per-tab `try/catch` dapat menangkapnya dan mengembalikan `null` untuk tab tersebut — tanpa memblokir tab lain.

**Validates: Requirements 2.13**

---

Property 11: Preservation – Semua Fix Tidak Merusak Perilaku Normal

_For any_ input yang TIDAK memenuhi kondisi bug (¬C), semua fungsi yang diperbaiki SHALL menghasilkan perilaku yang identik dengan fungsi original. Ini mencakup: login sukses, navigasi antar route, filter data, deteksi duplikat, pengecekan akses role valid, dan semua operasi yang sudah berjalan benar.

**Validates: Requirements 3.1 – 3.15**

---

## Fix Implementation

### Bug 1 – AuthContext Race Condition

**File:** `src/context/AuthContext.tsx`

**Perubahan:**
1. **Reset `fetchingProfileRef` di semua jalur error**: Pastikan `fetchingProfileRef.current = null` selalu dipanggil sebelum `break` di blok catch
2. **Gunakan flag terpisah per-invokasi**: Tambahkan variabel lokal `const myUserId = userId` dan cek ulang setelah setiap `await` apakah `fetchingProfileRef.current` masih `myUserId` — jika sudah berubah, hentikan eksekusi
3. **Pastikan `setLoading(false)` di finally block**: Pindahkan `setLoading(false)` ke blok `finally` agar selalu dipanggil

```typescript
// Pseudocode Fix
async function fetchProfile(userId: string) {
  if (fetchingProfileRef.current === userId) return;
  fetchingProfileRef.current = userId;
  setLoading(true);
  
  try {
    // ... fetch logic
  } catch (error) {
    setProfile(null);
  } finally {
    fetchingProfileRef.current = null;  // reset sebelum setLoading
    setLoading(false);                   // selalu dipanggil
  }
}
```

---

### Bug 2 – ProtectedRoute Null Reference

**File:** `src/App.tsx` — komponen `ProtectedRoute`

**Perubahan:**
- Ganti semua `profile.role` dengan `profile?.role` di dalam blok kondisi redirect
- Tambahkan guard: jika `session` ada dan `profile` masih `null`, tampilkan loading indicator alih-alih memproses redirect

```typescript
// Sebelum
return <Navigate to={getRoleLandingPath(profile.role)} />;

// Sesudah
return <Navigate to={getRoleLandingPath(profile?.role)} />;
```

---

### Bug 3 – NonFuelSpecialistRoute Session Check

**File:** `src/App.tsx` — komponen `NonFuelSpecialistRoute`

**Perubahan:**
- Tambahkan pemeriksaan `session` di awal komponen, sebelum pemeriksaan role

```typescript
// Tambahkan setelah loading check:
if (!session) return <Navigate to="/login" replace />;
```

---

### Bug 4 – Double Fetch FuelReportList

**File:** `src/pages/FuelReportList.tsx`

**Perubahan:**
- Tambahkan ref `allActiveReportsLoadedRef` atau cek `allActiveReports.length > 0` sebelum memanggil `getAllReports()` untuk `duplicateSource`
- Ketika filter "Semua" aktif dan `allActiveReports` sudah ada, gunakan kembali data yang sudah ada tanpa fetch ulang

```typescript
// Di dalam loadReports, sebelum panggilan duplicateSource:
if (allActiveReports.length === 0) {
  const duplicateSource = await getAllReports();
  if (id !== reqIdRef.current) return;
  setAllActiveReports(duplicateSource);
}
// else: gunakan allActiveReports yang sudah ada di state
```

---

### Bug 5 – Stale Closure Index.tsx

**File:** `src/pages/Index.tsx`

**Perubahan:**
- Gunakan `useRef` untuk menyimpan referensi terbaru ke `reports` dan `workPlans`
- Atau: panggil `loadRecordCounts` dengan parameter yang diteruskan secara eksplisit, bukan via closure

```typescript
const reportsRef = useRef<Report[]>(reports);
useEffect(() => { reportsRef.current = reports; }, [reports]);

// Di dalam loadRecordCounts:
jobs.reports = reportsRef.current.length > 0
  ? Promise.resolve(reportsRef.current.length)
  : getDatabaseRecordCount('reports', ...);
```

---

### Bug 6 – Tahun Hardcoded FuelReportList

**File:** `src/pages/FuelReportList.tsx`

**Perubahan:**
- Hapus blok `else if (month !== "semua")` yang menggunakan `new Date().getFullYear()`
- Saat bulan dipilih tanpa tahun, gunakan `getAllReports()` dengan post-filter sisi klien, ATAU query range `YYYY-MM-01` sampai `YYYY-MM-DD` untuk semua tahun dengan query tanpa batasan tahun

Pendekatan yang lebih bersih: ketika `month !== 'semua'` dan `year === 'semua'`, tampilkan semua data (via `getAllReports()`) dan filter sisi klien berdasarkan bulan. Ini konsisten dengan UX "Semua Tahun".

```typescript
// Di dalam loadReports:
// Hapus blok:
// } else if (month !== "semua") {
//   const y = new Date().getFullYear();  // <-- BUG: hardcoded tahun
//   ...
// }
// Ganti dengan: jika hanya month dipilih tanpa year, ambil semua data
} else {
  data = await getAllReports();
}
// Lalu filter sisi klien berdasarkan bulan jika month !== 'semua'
```

---

### Bug 7 – Email Hardcoded Access Control

**File:** `src/constants/access-control.ts`

**Perubahan:**
1. **Hapus email bypass** dari `isSuperAdminAccess`, `isPimpinanAccess`, dan `isAdminHarianAccess`:

```typescript
// Sebelum:
export const isSuperAdminAccess = (role, email) =>
  role === USER_ROLES.ADMIN || SYSTEM_EMAILS.superAdmin.includes(email ?? '');

// Sesudah:
export const isSuperAdminAccess = (role: string | null | undefined) =>
  role === USER_ROLES.ADMIN;
```

2. **Perbarui `SYSTEM_EMAILS`** agar hanya berisi komentar dokumentasi, bukan digunakan dalam kondisi logika
3. **Hapus `session.user.email === 'admin@gmail.com'`** dari `OvertimeAccessRoute` di `App.tsx`
4. **Pastikan akun-akun tersebut memiliki role yang sesuai** di tabel `profiles` sebelum fix diterapkan (prasyarat migrasi data)

---

### Bug 8 – getRoleLandingPath Role Tidak Lengkap

**File:** `src/constants/access-control.ts`

**Perubahan:**
- Tambahkan case untuk `admin_rencana_kerja_bbm` dan `admin_wilayah_bbm`

```typescript
export const getRoleLandingPath = (role: string | null | undefined) => {
  if (role === USER_ROLES.ADMIN_BBM_PUSAT) return '/?tab=fuel_reports_pusat';
  if (role === USER_ROLES.ADMIN_BBM) return '/fuel-reports';
  if (role === USER_ROLES.ADMIN_RENCANA_KERJA_BBM) return '/fuel-reports'; // fix: path valid
  if (role === USER_ROLES.ADMIN_WILAYAH_BBM) return '/fuel-reports';       // fix: path valid
  if (role === USER_ROLES.ADMIN_LAPORAN_BBM) return '/laporan-bbm';
  if (role === USER_ROLES.ADMIN_SPJ_BBM) return '/?tab=spj_oli';
  if (role === USER_ROLES.ADMIN_SPJ_OLI) return '/?tab=spj_oli';
  if (role === USER_ROLES.ADMIN_NOTA_DINAS) return '/?tab=nota_dinas';
  if (role === USER_ROLES.ADMIN_RENCANA_KERJA) return '/work-plans/daily-rekap';
  return '/';
};
```

---

### Bug 9 – canAccessFuelArea dan FuelReportRoute

**File:** `src/constants/access-control.ts` dan `src/App.tsx`

**Perubahan di `access-control.ts`:**
- Hapus `isSpjOliAdmin(role)` dari `canAccessFuelArea`

```typescript
export const canAccessFuelArea = (role, email) =>
  isSuperAdminAccess(role, email)
  || isPimpinanAccess(role, email)
  || isAdminBbmAccess(role)
  || isLaporanBbmAdmin(role)
  || role === USER_ROLES.ADMIN_SPJ_BBM;
  // isSpjOliAdmin dihapus: admin_spj_oli tidak punya akses fuel-reports
```

**Perubahan di `App.tsx` `FuelReportRoute`:**
- Tambahkan eksplisit: jika `isSpjOliAdmin`, redirect ke `/?tab=spj_oli`

```typescript
if (isSpjOliAdmin(profile?.role)) {
  return <Navigate to="/?tab=spj_oli" replace />;
}
```

---

### Bug 10 – getDatabaseRecordCount Timeout

**File:** `src/pages/Index.tsx`

**Perubahan:**
- Tambahkan `AbortController` dengan timeout 8 detik ke `getDatabaseRecordCount`
- Gunakan `signal` Supabase untuk membatalkan query

```typescript
const getDatabaseRecordCount = async (
  table: string,
  options: { ... } = {},
  timeoutMs = 8000,
) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    let query = supabase.from(table)
      .select('id', { count: 'exact', head: true })
      .abortSignal(controller.signal);
    // ... apply filters
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  } finally {
    window.clearTimeout(timeoutId);
  }
};
```

---

## Testing Strategy

### Validation Approach

Strategi pengujian mengikuti dua fase:
1. **Eksplorasi (Unfixed code)**: Tulis test yang membuktikan bug ada — test ini harus GAGAL pada kode yang belum diperbaiki
2. **Verifikasi (Fixed code)**: Jalankan test yang sama setelah fix — test harus LULUS

### Exploratory Bug Condition Checking

**Goal**: Konfirmasi bahwa setiap bug nyata ada sebelum fix diterapkan. Jika test lulus pada kode unfixed, berarti analisis root cause perlu direvisi.

**Test Plan**:
1. **Bug 1 Exploration**: Simulasikan dua panggilan `fetchProfile('same-uid')` bersamaan → assert `loading` akhirnya `false`; jalankan pada unfixed code → harapkan timeout/stuck
2. **Bug 2 Exploration**: Render `ProtectedRoute` dengan `session` ada dan `profile = null` → harapkan TypeError pada unfixed code
3. **Bug 3 Exploration**: Render `NonFuelSpecialistRoute` dengan `session = null` → harapkan masuk ke children (bug) pada unfixed code
4. **Bug 4 Exploration**: Spy `getAllReports` di `loadReports`, ubah filter → hitung jumlah panggilan → harapkan 2+ pada unfixed code
5. **Bug 6 Exploration**: Set `appliedMonth = '1'`, `appliedYear = 'semua'` → intercept query → harapkan tahun hardcoded pada unfixed code
6. **Bug 8 Exploration**: Render `ProtectedRoute` dengan role `admin_rencana_kerja_bbm` → harapkan infinite redirect count

**Expected Counterexamples**:
- Bug 1: `setLoading` tidak dipanggil, komponen spinner tidak hilang
- Bug 2: `TypeError` di console saat rendering
- Bug 3: Children dirender untuk user tanpa session
- Bug 4: `getAllReports` dipanggil 2+ kali per filter change
- Bug 8: Redirect terjadi lebih dari 3 kali ke path yang sama

### Fix Checking

**Goal**: Verifikasi bahwa untuk semua input di mana kondisi bug terpenuhi, fungsi yang diperbaiki menghasilkan perilaku yang benar.

**Pseudocode umum:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedFunction(input)
  ASSERT expectedBehavior(result)
END FOR
```

**Test Cases per Bug:**

- **Bug 1**: `fetchProfile` dipanggil 2x bersamaan → `loading` akhirnya `false`, `setLoading` dipanggil tepat sekali
- **Bug 2**: `ProtectedRoute` dengan `profile = null`, `session` ada → tidak crash, render loading
- **Bug 3**: `NonFuelSpecialistRoute` dengan `session = null` → render `<Navigate to="/login" />`
- **Bug 4**: Filter berubah dengan `allActiveReports.length > 0` → `getAllReports` dipanggil tepat 1x
- **Bug 5**: `loadRecordCounts` dipanggil setelah `reportsRef.current` diisi → tidak memanggil `getDatabaseRecordCount('reports', ...)`
- **Bug 6**: Filter bulan=1, tahun=semua → query tidak membatasi ke `getFullYear()`
- **Bug 7**: Email `admin@gmail.com` dengan role `user` → `isSuperAdminAccess` returns `false`
- **Bug 8**: `getRoleLandingPath('admin_rencana_kerja_bbm')` → returns path yang tidak memicu redirect loop
- **Bug 9**: `FuelReportRoute` dengan role `admin_spj_oli` → redirect ke `/?tab=spj_oli` tanpa masuk `FuelReportList`
- **Bug 10**: `getDatabaseRecordCount` dengan mock query yang lambat (>8s) → throw abort error, ditangkap oleh `try/catch` per-tab

### Preservation Checking

**Goal**: Verifikasi bahwa untuk input di luar kondisi bug, fungsi yang diperbaiki menghasilkan hasil identik dengan fungsi original.

**Pseudocode umum:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalFunction(input) = fixedFunction(input)
END FOR
```

**Testing Approach**: Property-based testing direkomendasikan untuk preservation checking karena:
- Generate banyak skenario role/input secara otomatis
- Menangkap edge case yang mungkin terlewat oleh unit test manual
- Memberikan jaminan kuat bahwa perilaku tidak berubah untuk input normal

**Preservation Test Cases:**
1. Login sukses (non-concurrent) → profile dimuat, loading = false, sama dengan sebelumnya
2. Route guard role valid (`admin_bbm`, `admin`, `pimpinan`) → redirect behavior tidak berubah
3. Filter bulan + tahun keduanya dipilih → query range tetap benar
4. Filter tahun saja → query range seluruh tahun tetap benar
5. `isSuperAdminAccess('admin', undefined)` → masih returns `true`
6. `getRoleLandingPath('admin_laporan_bbm')` → masih returns `'/laporan-bbm'`
7. `canAccessFuelArea('admin_bbm', undefined)` → masih returns `true`
8. `getDatabaseRecordCount` dengan query cepat (<1s) → returns count normal

### Unit Tests

- Test `fetchProfile` deduplication logic secara terisolasi dengan mock Supabase
- Test `ProtectedRoute`, `NonFuelSpecialistRoute`, `FuelReportRoute` dengan berbagai kombinasi session/profile
- Test `getRoleLandingPath` untuk seluruh nilai `USER_ROLES`
- Test `isSuperAdminAccess`, `isPimpinanAccess` tanpa parameter email
- Test `loadReports` dengan mock: hitung jumlah panggilan `getAllReports`
- Test `getDatabaseRecordCount` dengan AbortController mock untuk timeout scenario

### Property-Based Tests

- Generate random `UserRole` → `getRoleLandingPath(role)` selalu mengembalikan string path yang valid (tidak menyebabkan infinite redirect)
- Generate random kombinasi `{month, year}` filter → `loadReports` selalu memanggil tepat satu Supabase endpoint
- Generate random `{email, role}` pairs → `isSuperAdminAccess(role, email)` hanya true jika `role === 'admin'`
- Generate random auth timing sequences → `fetchProfile` selalu menyelesaikan dengan `loading = false`

### Integration Tests

- Test full login flow: buka halaman → masuk dengan kredensial → tunggu dashboard → tidak ada stuck loading
- Test route navigation dengan role `admin_rencana_kerja_bbm`: login → navigasi ke `/` → tidak infinite redirect
- Test filter FuelReportList: pilih bulan tanpa tahun → data tampil dari semua tahun
- Test access denied: login sebagai `admin_spj_oli` → akses `/fuel-reports` → redirect ke `/?tab=spj_oli`
