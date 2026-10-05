# Bugfix Requirements Document

## Introduction

Dokumen ini merangkum 16 bug yang ditemukan dari review komprehensif codebase aplikasi Laporan Kerja DLH Kota Medan (React + TypeScript + Supabase, multi-role ACL 15+ peran). Bug mencakup: duplikasi Supabase client, route guard yang rapuh terhadap race condition profil, double fetch yang tidak perlu, stale closure di filter data, dan inkonsistensi update data di layanan. Setiap bug dikelompokkan berdasarkan area dampak.

---

## Bug Analysis

---

### BUG 1 — Import Supabase client tidak konsisten di AuthorizeRoute

### Current Behavior (Defect)

1.1 WHEN `AuthorizeRoute.tsx` diimpor dan digunakan, THEN sistem mengimpor Supabase client dari `@/integrations/supabase/client` sedangkan semua file lain (100+ file) mengimpor dari `@/lib/supabase`
1.2 WHEN dua modul berbeda mengimpor Supabase dari path yang berbeda, THEN sistem berpotensi membuat dua instance Supabase client yang terpisah di runtime, menyebabkan sesi auth tidak terbagi atau cache query terpisah

### Expected Behavior (Correct)

2.1 WHEN `AuthorizeRoute.tsx` mengimpor Supabase client, THEN sistem SHALL menggunakan import path yang sama dengan seluruh codebase (`@/lib/supabase`)
2.2 WHEN seluruh file mengimpor Supabase client, THEN sistem SHALL menjamin hanya ada satu instance Supabase client tunggal di seluruh runtime aplikasi

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `AuthorizeRoute` melakukan pengecekan row-level permission, THEN sistem SHALL CONTINUE TO memuat `region_id` dan `team_id` dari resource yang dicek
3.2 WHEN session auth sudah ada, THEN sistem SHALL CONTINUE TO mengevaluasi `hasPermission()` dan mengembalikan hasil yang sama

---

### BUG 2 — Posisi RouteScrollReset dan ActivityTracker berisiko jika urutan render berubah

### Current Behavior (Defect)

2.1 WHEN `BrowserRouter` dirender, THEN `ActivityTracker` dipasang di dalam `BrowserRouter` tetapi bergantung pada `useAuth()` yang disediakan oleh `AuthProvider` yang ada di lapisan luar
2.2 WHEN urutan render di `App.tsx` berubah atau `AuthProvider` dipindahkan, THEN sistem berpotensi melempar error karena `useAuth()` dipanggil di luar konteksnya

### Expected Behavior (Correct)

2.1 WHEN `App.tsx` dikonfigurasi, THEN sistem SHALL memastikan `ActivityTracker` dan `RouteScrollReset` berada dalam lingkup komponen yang menjamin ketersediaan konteks `AuthProvider` dan `BrowserRouter` sebelum render
2.2 WHEN `useAuth()` dan `useLocation()` dipanggil di dalam `ActivityTracker`, THEN sistem SHALL menjamin kedua konteks tersedia pada saat komponen pertama kali dirender

### Unchanged Behavior (Regression Prevention)

3.1 WHEN user berpindah halaman, THEN sistem SHALL CONTINUE TO melakukan scroll ke atas via `RouteScrollReset`
3.2 WHEN user berinteraksi dengan elemen UI bertandai (button, link), THEN sistem SHALL CONTINUE TO mencatat audit log via `ActivityTracker`

---

### BUG 3 — ProtectedRoute tidak memblokir role LAPORAN mengakses `/create` dan `/edit/:id`

### Current Behavior (Defect)

3.1 WHEN user dengan role `laporan` mengakses URL `/create` atau `/edit/:id` secara langsung, THEN sistem mengizinkan akses karena `ProtectedRoute` hanya memeriksa keberadaan sesi, bukan peran
3.2 WHEN `canManageReports` bernilai false untuk role `laporan`, THEN sistem menyembunyikan tombol UI di `Index.tsx` tetapi tidak memblokir akses route secara langsung

### Expected Behavior (Correct)

3.1 WHEN user dengan role `laporan` mencoba mengakses `/create` atau `/edit/:id`, THEN sistem SHALL menolak akses dan mengarahkan ke halaman yang sesuai dengan perannya
3.2 WHEN pengecekan akses route dilakukan, THEN sistem SHALL konsisten dengan logika `canManageReportEntries()` yang digunakan pada lapisan UI

### Unchanged Behavior (Regression Prevention)

3.1 WHEN user dengan role yang memiliki hak kelola laporan (admin, user, admin_wilayah, dll.) mengakses `/create` atau `/edit/:id`, THEN sistem SHALL CONTINUE TO mengizinkan akses
3.2 WHEN `ProtectedRoute` memblokir pengguna tanpa sesi, THEN sistem SHALL CONTINUE TO mengarahkan ke `/login`

---

### BUG 4 — FuelReportTab melakukan double fetch `getAllReports` setiap `loadReports` dipanggil

### Current Behavior (Defect)

4.1 WHEN filter tanggal, bulan, atau tahun diubah di `FuelReportTab`, THEN sistem memanggil dua request Supabase besar secara berurutan: satu untuk data terfilter dan satu lagi untuk seluruh data aktif (`getAllReports`) guna deteksi duplikat
4.2 WHEN user mengubah filter berulang kali secara cepat, THEN sistem mengirimkan banyak pasangan request besar ke Supabase yang tidak dibatalkan dengan benar oleh mekanisme `reqIdRef`

### Expected Behavior (Correct)

4.1 WHEN filter diubah dan data aktif keseluruhan sudah tersedia, THEN sistem SHALL menggunakan data yang sudah ada tanpa melakukan fetch ulang `getAllReports`
4.2 WHEN `allActiveReports` sudah dimuat, THEN sistem SHALL ONLY melakukan satu fetch Supabase per perubahan filter (untuk data terfilter saja), bukan dua

### Unchanged Behavior (Regression Prevention)

3.1 WHEN komponen `FuelReportTab` pertama kali dimuat, THEN sistem SHALL CONTINUE TO memuat data terfilter dan seluruh data aktif untuk deteksi duplikat
3.2 WHEN laporan dihapus, THEN sistem SHALL CONTINUE TO memperbarui `allActiveReports` lokal agar deteksi duplikat tetap akurat

---

### BUG 5 — Index.tsx: stale closure di `useEffect` filter data

### Current Behavior (Defect)

5.1 WHEN `useEffect` untuk filter (`[selectedDate, selectedMonth, selectedYear, selectedCategory]`) terpicu, THEN `loadData()` yang dipanggil menggunakan fungsi `buildDateFilter()` yang membaca nilai state secara langsung, berpotensi membaca nilai yang belum disinkronkan di React 18 concurrent mode
5.2 WHEN dua state filter diubah hampir bersamaan (misalnya month dan year sekaligus), THEN `buildDateFilter()` bisa membaca campuran nilai lama dan baru karena tidak semua state sudah settle

### Expected Behavior (Correct)

5.1 WHEN `loadData()` dipanggil dari useEffect filter, THEN sistem SHALL membangun date filter dari nilai yang secara eksplisit diteruskan sebagai parameter atau ditangkap melalui `useCallback` dengan dependency yang tepat, bukan dari closure yang membaca state secara implisit
5.2 WHEN filter diubah, THEN sistem SHALL menjamin filter yang dibangun dan dikirimkan ke service selalu konsisten dengan nilai state terbaru pada saat fetch dimulai

### Unchanged Behavior (Regression Prevention)

3.1 WHEN filter tanggal, bulan, atau tahun diubah, THEN sistem SHALL CONTINUE TO memuat ulang data laporan dan rencana kerja sesuai filter baru
3.2 WHEN filter region atau searchQuery diubah, THEN sistem SHALL CONTINUE TO memfilter data client-side tanpa fetch ulang ke server

---

### BUG 6 — NotaDinasRoute tidak memiliki guard `profile` null

### Current Behavior (Defect)

6.1 WHEN `NotaDinasRoute` dievaluasi dan sesi auth sudah selesai (`loading = false`) tetapi profil pengguna belum selesai dimuat dari database, THEN `profile?.role` bernilai `undefined` sehingga `isAllowed` menjadi false
6.2 WHEN `isAllowed` false karena profil belum ada, THEN sistem langsung melakukan redirect ke `getRoleLandingPath(undefined)` = `'/'` sebelum profil selesai dimuat, menyebabkan user yang berhak terpental keluar

### Expected Behavior (Correct)

6.1 WHEN `NotaDinasRoute` dievaluasi dan profil belum tersedia, THEN sistem SHALL menampilkan loading spinner dan menunggu hingga profil selesai dimuat sebelum mengevaluasi izin akses
6.2 WHEN profil sudah tersedia, THEN sistem SHALL mengevaluasi `isSuperAdminAccess` dan `isNotaDinasAdmin` untuk menentukan izin akses

### Unchanged Behavior (Regression Prevention)

3.1 WHEN user belum login (sesi null), THEN sistem SHALL CONTINUE TO mengarahkan ke `/login`
3.2 WHEN profil sudah dimuat dan user tidak memiliki akses, THEN sistem SHALL CONTINUE TO mengarahkan ke `getRoleLandingPath(profile?.role)`

---

### BUG 7 — SpjOliRoute tidak memiliki guard `profile` null

### Current Behavior (Defect)

7.1 WHEN `SpjOliRoute` dievaluasi dan auth loading selesai tetapi profil belum tersedia, THEN `profile?.role` bernilai `undefined` sehingga pengecekan `profile?.role === USER_ROLES.ADMIN` dan seterusnya semua bernilai false
7.2 WHEN semua pengecekan role bernilai false karena profil null, THEN sistem langsung melakukan redirect prematur ke `getRoleLandingPath(undefined)` = `'/'`

### Expected Behavior (Correct)

7.1 WHEN `SpjOliRoute` dievaluasi dan profil belum tersedia, THEN sistem SHALL menampilkan loading spinner dan menunggu hingga profil selesai dimuat sebelum mengevaluasi izin akses

### Unchanged Behavior (Regression Prevention)

3.1 WHEN user belum login, THEN sistem SHALL CONTINUE TO mengarahkan ke `/login`
3.2 WHEN profil sudah dimuat dan role adalah salah satu dari `ADMIN`, `ADMIN_SPJ_BBM`, `ADMIN_SPJ_OLI`, atau `PIMPINAN`, THEN sistem SHALL CONTINUE TO mengizinkan akses

---

### BUG 8 — LaporanBbmRoute tidak memiliki guard `profile` null

### Current Behavior (Defect)

8.1 WHEN `LaporanBbmRoute` dievaluasi dan profil belum tersedia, THEN `isSuperAdminAccess(profile?.role, ...)` dan `isLaporanBbmAdmin(profile?.role)` keduanya bernilai false, menyebabkan redirect prematur
8.2 WHEN redirect terjadi sebelum profil dimuat, THEN user yang berhak mengakses Laporan BBM diarahkan ke halaman yang salah

### Expected Behavior (Correct)

8.1 WHEN `LaporanBbmRoute` dievaluasi dan profil belum tersedia, THEN sistem SHALL menampilkan loading spinner dan menunggu hingga profil selesai dimuat

### Unchanged Behavior (Regression Prevention)

3.1 WHEN user belum login, THEN sistem SHALL CONTINUE TO mengarahkan ke `/login`
3.2 WHEN profil sudah dimuat dan user adalah super admin atau admin laporan BBM, THEN sistem SHALL CONTINUE TO mengizinkan akses

---

### BUG 9 — OvertimeAccessRoute tidak memiliki guard `profile` null

### Current Behavior (Defect)

9.1 WHEN `OvertimeAccessRoute` dievaluasi dan profil belum tersedia, THEN `isSuperAdminAccess(profile?.role, ...)` dan `profile?.role === USER_ROLES.ADMIN_REKAP_LEMBUR` keduanya bernilai false, menyebabkan redirect prematur ke `'/'`

### Expected Behavior (Correct)

9.1 WHEN `OvertimeAccessRoute` dievaluasi dan profil belum tersedia, THEN sistem SHALL menampilkan loading spinner dan menunggu hingga profil selesai dimuat sebelum mengevaluasi izin

### Unchanged Behavior (Regression Prevention)

3.1 WHEN user belum login, THEN sistem SHALL CONTINUE TO mengarahkan ke `/login`
3.2 WHEN profil sudah dimuat dan user adalah super admin atau `admin_rekap_lembur`, THEN sistem SHALL CONTINUE TO mengizinkan akses ke halaman overtime

---

### BUG 10 — PrintRekapAdminRoute tidak memiliki guard `profile` null

### Current Behavior (Defect)

10.1 WHEN `PrintRekapAdminRoute` dievaluasi dan profil belum tersedia, THEN `canPrintAdminRecap(profile?.role, ...)` bernilai false, menyebabkan redirect prematur ke `'/'`

### Expected Behavior (Correct)

10.1 WHEN `PrintRekapAdminRoute` dievaluasi dan profil belum tersedia, THEN sistem SHALL menampilkan loading spinner dan menunggu hingga profil selesai dimuat

### Unchanged Behavior (Regression Prevention)

3.1 WHEN user belum login, THEN sistem SHALL CONTINUE TO mengarahkan ke `/login`
3.2 WHEN profil sudah dimuat dan user memiliki izin cetak rekap admin, THEN sistem SHALL CONTINUE TO mengizinkan akses

---

### BUG 11 — AdminRoute tidak memiliki guard `profile` null

### Current Behavior (Defect)

11.1 WHEN `AdminRoute` dievaluasi dan profil belum tersedia, THEN `canAccessFuelArea(profile?.role, ...)` bernilai false meskipun user sebenarnya berhak, menyebabkan redirect prematur ke `'/'`

### Expected Behavior (Correct)

11.1 WHEN `AdminRoute` dievaluasi dan profil belum tersedia, THEN sistem SHALL menampilkan loading spinner dan menunggu hingga profil selesai dimuat

### Unchanged Behavior (Regression Prevention)

3.1 WHEN user belum login, THEN sistem SHALL CONTINUE TO mengarahkan ke `/login`
3.2 WHEN profil sudah dimuat dan user memiliki akses fuel area dan bukan admin laporan BBM, THEN sistem SHALL CONTINUE TO mengizinkan akses ke halaman maintenance

---

### BUG 12 — notaDinasService.update() tidak memperbarui `region_id` ke null saat wilayah dihapus

### Current Behavior (Defect)

12.1 WHEN `notaDinasService.update()` dipanggil dengan form yang wilayahnya diubah ke nilai yang tidak ditemukan di tabel `regions`, THEN `resolvedRegionId` bernilai null dan sistem tidak menyertakan `region_id` dalam payload update
12.2 WHEN `region_id` lama di database tidak diperbarui, THEN data `nota_dinas_records` tetap memiliki `region_id` lama yang sudah tidak relevan meskipun wilayah di form sudah diubah

### Expected Behavior (Correct)

12.1 WHEN `notaDinasService.update()` dipanggil, THEN sistem SHALL selalu menyertakan `region_id` dalam payload update, termasuk nilai null jika wilayah tidak dapat di-resolve
12.2 WHEN wilayah di form dihapus atau diubah ke nilai yang tidak valid, THEN sistem SHALL memperbarui `region_id` di database sesuai nilai yang di-resolve (termasuk null jika tidak ditemukan)

### Unchanged Behavior (Regression Prevention)

3.1 WHEN wilayah di form valid dan ditemukan di tabel `regions`, THEN sistem SHALL CONTINUE TO menyimpan `region_id` yang benar ke database
3.2 WHEN `notaDinasService.create()` dipanggil, THEN sistem SHALL CONTINUE TO melakukan resolve region_id dari nama wilayah di form

---

### BUG 13 — AuthorizeRoute menggunakan nama resource yang perlu diverifikasi konsistensinya dengan tabel Supabase

### Current Behavior (Defect)

13.1 WHEN `AuthorizeRoute` digunakan dengan `resource="work_plans"`, THEN sistem melakukan query `supabase.from('work_plans').select('region_id, team_id')` untuk row-level permission check
13.2 WHEN nama tabel `work_plans` di Supabase tidak konsisten dengan nama yang dipakai di tempat lain (misalnya `loadRecordCounts` juga menggunakan `'work_plans'` yang konsisten), THEN keseluruhan perilaku perlu diverifikasi agar tidak ada query ke tabel yang salah

### Expected Behavior (Correct)

13.1 WHEN `AuthorizeRoute` melakukan query row-level, THEN sistem SHALL menjamin nama tabel yang digunakan sebagai `resource` prop konsisten dengan nama tabel aktual di Supabase
13.2 WHEN resource prop baru ditambahkan ke `AuthorizeRoute`, THEN sistem SHALL memvalidasi bahwa nama tersebut adalah nama tabel yang valid di Supabase sebelum digunakan

### Unchanged Behavior (Regression Prevention)

3.1 WHEN resource prop yang diberikan sudah valid dan tabel ada, THEN sistem SHALL CONTINUE TO melakukan pengecekan izin row-level berdasarkan `region_id` dan `team_id`

---

### BUG 14 — useValueDraft menyimpan state filter sementara sesi user berbeda belum di-clear sepenuhnya

### Current Behavior (Defect)

14.1 WHEN user A logout dan user B login di browser yang sama tanpa refresh halaman, THEN draft filter user A masih tampil sebentar di `FuelReportTab` sebelum dikembalikan ke nilai default user B, karena draft baru user B hanya disimpan saat state berubah
14.2 WHEN filter draft tersimpan berdasarkan `filterDraftKey` yang menggunakan `session?.user?.id`, THEN pergantian user memang menggunakan key berbeda, tetapi restore terjadi sebelum profil user baru selesai dimuat

### Expected Behavior (Correct)

14.1 WHEN user logout, THEN sistem SHALL menghapus atau menginvalidasi draft filter yang tersimpan di storage untuk user tersebut agar tidak tampil saat user berikutnya login
14.2 WHEN `filterDraftKey` berubah karena user berganti, THEN sistem SHALL tidak menampilkan draft lama dari key sebelumnya, bahkan secara sementara

### Unchanged Behavior (Regression Prevention)

3.1 WHEN user yang sama kembali ke tab `FuelReportTab` setelah berpindah tab lain, THEN sistem SHALL CONTINUE TO memulihkan filter terakhir yang digunakan user tersebut
3.2 WHEN `filterDraftKey` tidak tersedia (user belum login), THEN sistem SHALL CONTINUE TO menggunakan nilai default filter

---

### BUG 15 — Index.tsx: potensi typo pada nama variabel di `loadRecordCounts`

### Current Behavior (Defect)

15.1 WHEN `loadRecordCounts()` dievaluasi, THEN kondisi `if (isAdmin || isPimpinan || isAdminSpj || isAdminSpjOli)` menggunakan variabel `isAdminSpjOli` yang harus merujuk pada deklarasi `const isAdminSpjOli = profile?.role === 'admin_spj_oli'` di atas
15.2 WHEN nama variabel di kondisi tidak persis sama dengan deklarasinya (misalnya `isAdminSpjOl` bukan `isAdminSpjOli`), THEN TypeScript akan melempar compile error tetapi bug bisa tersembunyi jika ada variabel lain dengan nama serupa

### Expected Behavior (Correct)

15.1 WHEN `loadRecordCounts()` memeriksa apakah harus menghitung `spj_oli`, THEN sistem SHALL menggunakan variabel `isAdminSpjOli` yang konsisten dengan deklarasinya, memastikan tidak ada typo
15.2 WHEN semua kondisi role di `loadRecordCounts` dievaluasi, THEN sistem SHALL menjamin setiap nama variabel yang digunakan identik dengan deklarasi di scope yang sama

### Unchanged Behavior (Regression Prevention)

3.1 WHEN user adalah admin, pimpinan, admin_spj_bbm, atau admin_spj_oli, THEN sistem SHALL CONTINUE TO menghitung jumlah record `spj_oli_records` dan menampilkannya di badge tab
3.2 WHEN user tidak memiliki akses SPJ Oli, THEN sistem SHALL CONTINUE TO tidak menghitung record tersebut

---

### BUG 16 — FuelReportTab tidak re-fetch saat `reportType` prop berubah

### Current Behavior (Defect)

16.1 WHEN `reportType` prop pada `FuelReportTab` berubah (misalnya parent me-render ulang dengan reportType berbeda), THEN `useEffect` utama yang memanggil `loadReports` tidak terpicu karena `reportType` tidak ada dalam dependency array
16.2 WHEN komponen tidak re-fetch setelah `reportType` berubah, THEN data yang ditampilkan masih berasal dari `reportType` sebelumnya, menyebabkan ketidaksesuaian antara tipe laporan yang dipilih dan data yang ditampilkan

### Expected Behavior (Correct)

16.1 WHEN `reportType` prop berubah, THEN sistem SHALL memicu ulang `loadReports` untuk mengambil data sesuai `reportType` yang baru
16.2 WHEN dependency array di `useEffect` utama didefinisikan, THEN sistem SHALL menyertakan `reportType` sebagai salah satu dependency

### Unchanged Behavior (Regression Prevention)

3.1 WHEN filter tanggal, bulan, atau tahun berubah, THEN sistem SHALL CONTINUE TO memanggil `loadReports` dengan parameter filter yang sesuai
3.2 WHEN `regionId` prop berubah, THEN sistem SHALL CONTINUE TO memuat ulang data sesuai region baru
