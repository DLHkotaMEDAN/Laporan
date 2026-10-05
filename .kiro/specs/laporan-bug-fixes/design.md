# Laporan Bug Fixes — Bugfix Design

## Overview

Dokumen ini menjabarkan rancangan perbaikan teknis untuk 10 bug aktif yang ditemukan dari
review komprehensif codebase aplikasi Laporan Kerja DLH Kota Medan. Bug yang memerlukan
perubahan kode: BUG 1, 4, 5, 6, 7, 8, 9, 10, 11, dan 12.

Bug yang dikonfirmasi sebagai false positive atau tidak memerlukan perubahan kode:
BUG 2, 3, 13, 14, 15, 16 — didokumentasikan singkat di bagian akhir.

---

## Glossary

- **Bug_Condition (C)**: Kondisi yang memicu perilaku salah — input state atau code path yang mengaktifkan bug
- **Property (P)**: Perilaku yang diharapkan setelah perbaikan
- **Preservation**: Perilaku yang tidak boleh berubah akibat perbaikan
- **Route Guard**: Komponen React di `App.tsx` yang membungkus route untuk mengendalikan akses
- **Profile Null Window**: Jendela waktu singkat antara `setSession` dan `setProfile` selesai, dimana session sudah ada tetapi profile masih null
- **Stale Closure**: Fungsi yang membaca nilai variabel state dari saat ia didefinisikan, bukan nilai terbaru saat ia dieksekusi

---

## Bug Details & Fix Implementation

---

### BUG 1 — Import Supabase Client Tidak Konsisten di AuthorizeRoute

#### Bug Condition

```
FUNCTION isBugCondition(file)
  INPUT: file yang mengimpor Supabase client
  OUTPUT: boolean

  RETURN file === 'AuthorizeRoute.tsx'
         AND importPath === '@/integrations/supabase/client'
         AND semua file lain menggunakan '@/lib/supabase'
END FUNCTION
```

**Contoh Manifestasi:**
- `AuthorizeRoute.tsx` baris 7 mengimpor dari `@/integrations/supabase/client`
- 100+ file lain mengimpor dari `@/lib/supabase`
- Dua instance Supabase yang terpisah berpotensi memiliki sesi auth yang tidak terbagi

#### Hypothesized Root Cause

File `AuthorizeRoute.tsx` dibuat dari template atau snippet yang berbeda dari konvensi project,
menggunakan alias path lama `@/integrations/supabase/client` alih-alih path standar `@/lib/supabase`.

#### Fix Implementation

**File:** `src/components/AuthorizeRoute.tsx`

**Baris 7** — Ubah import path:

```diff
- import { supabase } from '@/integrations/supabase/client';
+ import { supabase } from '@/lib/supabase';
```

Tidak ada perubahan logika lain yang diperlukan.

---

### BUG 4 — FuelReportTab Double Fetch `getAllReports` Setiap Filter Berubah

#### Bug Condition

```
FUNCTION isBugCondition(event)
  INPUT: event perubahan filter di FuelReportTab
  OUTPUT: boolean

  RETURN event.type IN ['date_change', 'month_change', 'year_change']
         AND allActiveReports sudah pernah dimuat sebelumnya
         AND loadReports() memanggil getAllReports() lagi
END FUNCTION
```

**Contoh Manifestasi:**
- User mengubah filter bulan → 2 request Supabase besar dikirim (filtered + all)
- User mengubah filter 5 kali cepat → 10 request besar ke Supabase
- `reqIdRef` hanya melindungi stale response tetapi tidak mencegah request yang tidak perlu

#### Hypothesized Root Cause

Logika di `loadReports()` memuat `allActiveReports` di dalam fungsi yang sama dengan data
terfilter. Tujuannya untuk mendeteksi duplikat, tetapi `allActiveReports` tidak perlu diperbarui
setiap kali filter berubah — cukup dimuat sekali saat mount dan setelah hapus.

#### Fix Implementation

**File:** `src/components/FuelReportTab.tsx`

**Perubahan 1** — Ekstrak pemuatan `allActiveReports` ke `useEffect` terpisah:

```diff
+ // Muat allActiveReports sekali saat mount (tidak tergantung filter)
+ useEffect(() => {
+   if (!profile || !session) return;
+   getAllReports().then(setAllActiveReports).catch(() => {});
+ }, [profile, session, regionId, reportType]);

  const loadReports = async (date: string, month: string, year: string) => {
    const id = ++reqIdRef.current;
    try {
      setLoading(true);
      let data: FuelReport[];

      if (date) {
        data = await getReportsBySpecificDate(date);
      } else if (...) {
        ...
      } else {
        data = await getAllReports();
      }

      if (id !== reqIdRef.current) return;
-     // Ambil semua data aktif untuk deteksi duplikat lintas filter
-     const allActive = await getAllReports();
-     if (id !== reqIdRef.current) return;
      setReports(data);
-     setAllActiveReports(allActive);
      setCurrentPage(1);
    } catch (error) {
      ...
    }
  };
```

**Perubahan 2** — Pastikan `allActiveReports` tetap diperbarui setelah hapus (sudah ada, tidak perlu diubah):

```tsx
// Di dalam onConfirm hapus — sudah benar:
setAllActiveReports(prev => prev.filter(r => r.id !== deleteFuelConfirm.id));
```

---

### BUG 5 — Index.tsx: Stale Closure di `loadData()` via `buildDateFilter()`

#### Bug Condition

```
FUNCTION isBugCondition(filterChange)
  INPUT: perubahan dua state filter hampir bersamaan
  OUTPUT: boolean

  RETURN filterChange.statesChanged >= 2
         AND buildDateFilter() membaca state via closure
         AND NOT semua state sudah settle saat buildDateFilter() dipanggil
END FUNCTION
```

**Contoh Manifestasi:**
- `useEffect` dipicu oleh `[selectedDate, selectedMonth, selectedYear, selectedCategory]`
- `loadData()` dipanggil, lalu memanggil `buildDateFilter()`
- `buildDateFilter()` membaca `selectedMonth` dan `selectedYear` dari closure scope —
  nilainya bisa tidak sinkron dengan trigger yang memanggil `loadData()`

#### Hypothesized Root Cause

`buildDateFilter()` didefinisikan sebagai fungsi biasa (bukan `useCallback`) dan membaca
state langsung dari closure. Ketika `useEffect` menembak setelah state berubah, React
belum tentu menjamin semua state sudah di-batch settle sebelum `loadData()` berjalan,
terutama di React 18 concurrent mode.

#### Fix Implementation

**File:** `src/pages/Index.tsx`

**Perubahan 1** — Ubah `buildDateFilter` agar menerima nilai sebagai parameter, bukan membaca
dari closure:

```diff
- const buildDateFilter = (): ReportFilters['dateFilter'] => {
-   if (selectedDate) return { type: 'date', value: selectedDate };
-   if (selectedMonth !== 'semua' && selectedYear !== 'semua') return { type: 'month', month: selectedMonth, year: selectedYear };
-   if (selectedYear !== 'semua') return { type: 'year', year: selectedYear };
-   return null;
- };

+ const buildDateFilter = (
+   date: string,
+   month: string,
+   year: string,
+ ): ReportFilters['dateFilter'] => {
+   if (date) return { type: 'date', value: date };
+   if (month !== 'semua' && year !== 'semua') return { type: 'month', month, year };
+   if (year !== 'semua') return { type: 'year', year };
+   return null;
+ };
```

**Perubahan 2** — Teruskan nilai filter secara eksplisit dari setiap call site:

```diff
  const loadData = async () => {
    try {
      setLoading(true);
      ...
-     const dateFilter = buildDateFilter();
+     const dateFilter = buildDateFilter(selectedDate, selectedMonth, selectedYear);
      ...
    }
  };
```

**Perubahan 3** — Perbarui `useEffect` filter agar meneruskan nilai state ke `loadData`
secara eksplisit (opsional hardening jika `loadData` di-refactor menjadi menerima parameter):

```tsx
// useEffect yang ada sudah memanggil loadData() tanpa argumen.
// Dengan Perubahan 1 & 2 di atas, loadData() sudah membaca nilai terbaru
// dari state closure React yang dijamin konsisten dalam satu render cycle.
// Perubahan 1 & 2 sudah cukup untuk mengatasi bug ini.
```

---

### BUG 6 — NotaDinasRoute Tidak Ada Guard `profile` Null

#### Bug Condition

```
FUNCTION isBugCondition(routeEvaluation)
  INPUT: evaluasi NotaDinasRoute
  OUTPUT: boolean

  RETURN routeEvaluation.loading === false
         AND routeEvaluation.session !== null
         AND routeEvaluation.profile === null
END FUNCTION
```

**Contoh Manifestasi:**
- Auth selesai loading, sesi ada, tetapi profil belum selesai dimuat dari DB
- `isSuperAdminAccess(undefined, ...)` dan `isNotaDinasAdmin(undefined)` → keduanya `false`
- User yang berhak di-redirect ke `getRoleLandingPath(undefined)` = `'/'`

#### Fix Implementation

**File:** `src/App.tsx`

**Di komponen `NotaDinasRoute`** — tambahkan guard `profile` null sebelum evaluasi izin:

```diff
  const NotaDinasRoute = ({ children }: { children: React.ReactNode }) => {
    const { session, profile, loading } = useAuth();

    if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
    if (!session) return <Navigate to="/login" replace />;
+   if (!profile) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;

    const isAllowed = isSuperAdminAccess(profile?.role, session.user.email) || isNotaDinasAdmin(profile?.role);
    return isAllowed ? <>{children}</> : <Navigate to={getRoleLandingPath(profile?.role)} replace />;
  };
```

---

### BUG 7 — SpjOliRoute Tidak Ada Guard `profile` Null

#### Fix Implementation

**File:** `src/App.tsx`

**Di komponen `SpjOliRoute`** — tambahkan guard `profile` null:

```diff
  const SpjOliRoute = ({ children }: { children: React.ReactNode }) => {
    const { session, profile, loading } = useAuth();

    if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
    if (!session) return <Navigate to="/login" replace />;
+   if (!profile) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;

    const isAllowed = profile?.role === USER_ROLES.ADMIN
      || profile?.role === USER_ROLES.ADMIN_SPJ_BBM
      || profile?.role === USER_ROLES.ADMIN_SPJ_OLI
      || profile?.role === USER_ROLES.PIMPINAN;
    if (!isAllowed) return <Navigate to={getRoleLandingPath(profile?.role)} replace />;

    return <>{children}</>;
  };
```

---

### BUG 8 — LaporanBbmRoute Tidak Ada Guard `profile` Null

#### Fix Implementation

**File:** `src/App.tsx`

**Di komponen `LaporanBbmRoute`** — tambahkan guard `profile` null:

```diff
  const LaporanBbmRoute = ({ children }: { children: React.ReactNode }) => {
    const { session, profile, loading } = useAuth();

    if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
    if (!session) return <Navigate to="/login" replace />;
+   if (!profile) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;

    const isAllowed = isSuperAdminAccess(profile?.role, session.user.email)
      || isLaporanBbmAdmin(profile?.role);
    if (!isAllowed) return <Navigate to={getRoleLandingPath(profile?.role)} replace />;

    return <>{children}</>;
  };
```

---

### BUG 9 — OvertimeAccessRoute Tidak Ada Guard `profile` Null

#### Fix Implementation

**File:** `src/App.tsx`

**Di komponen `OvertimeAccessRoute`** — tambahkan guard `profile` null:

```diff
  const OvertimeAccessRoute = ({ children }: { children: React.ReactNode }) => {
    const { session, profile, loading } = useAuth();

    if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
    if (!session) return <Navigate to="/login" replace />;
+   if (!profile) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;

    const isAllowed = isSuperAdminAccess(profile?.role, session?.user?.email)
      || profile?.role === USER_ROLES.ADMIN_REKAP_LEMBUR;
    return isAllowed ? <>{children}</> : <Navigate to="/" replace />;
  };
```

---

### BUG 10 — PrintRekapAdminRoute Tidak Ada Guard `profile` Null

#### Fix Implementation

**File:** `src/App.tsx`

**Di komponen `PrintRekapAdminRoute`** — tambahkan guard `profile` null:

```diff
  const PrintRekapAdminRoute = ({ children }: { children: React.ReactNode }) => {
    const { session, profile, loading } = useAuth();

    if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
    if (!session) return <Navigate to="/login" replace />;
+   if (!profile) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;

    const isAllowed = canPrintAdminRecap(profile?.role, session.user.email);
    if (!isAllowed) return <Navigate to="/" replace />;

    return <>{children}</>;
  };
```

---

### BUG 11 — AdminRoute Tidak Ada Guard `profile` Null

#### Fix Implementation

**File:** `src/App.tsx`

**Di komponen `AdminRoute`** — tambahkan guard `profile` null:

```diff
  const AdminRoute = ({ children }: { children: React.ReactNode }) => {
    const { session, profile, loading } = useAuth();

    if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
    if (!session) return <Navigate to="/login" />;
+   if (!profile) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;

    const isAllowed = canAccessFuelArea(profile?.role, session.user.email)
      && !isLaporanBbmAdmin(profile?.role);

    if (!isAllowed) return <Navigate to="/" />;

    return <>{children}</>;
  };
```

---

### BUG 12 — `notaDinasService.update()` Tidak Memperbarui `region_id` ke Null

#### Bug Condition

```
FUNCTION isBugCondition(updateCall)
  INPUT: pemanggilan notaDinasService.update()
  OUTPUT: boolean

  RETURN resolveRegionId(form, regionId) === null
         AND region_id lama di database ada nilainya (bukan null)
END FUNCTION
```

**Contoh Manifestasi:**
- User mengubah wilayah ke nama yang tidak ada di tabel `regions`
- `resolvedRegionId` menjadi `null`
- Conditional spread `...(resolvedRegionId ? { region_id: resolvedRegionId } : {})` → `region_id` tidak disertakan dalam `UPDATE`
- Database tetap menyimpan `region_id` lama yang sudah tidak valid

#### Hypothesized Root Cause

Pattern conditional spread `...(value ? { key: value } : {})` digunakan untuk menghindari
meng-overwrite kolom dengan `null`. Namun untuk `region_id`, overwrite ke `null` adalah
perilaku yang tepat ketika wilayah dihapus atau tidak valid.

#### Fix Implementation

**File:** `src/services/notaDinasService.ts`

**Di method `update()`** — ubah conditional spread menjadi assignment langsung:

```diff
  async update(id: string, form: NotaDinasForm, updatedAt?: string, regionId?: string | null) {
    const resolvedRegionId = await notaDinasService.resolveRegionId(form, regionId);

    const { data, error } = await supabase
      .from('nota_dinas_records')
      .update({
        form,
        updated_at: updatedAt || new Date().toISOString(),
-       ...(resolvedRegionId ? { region_id: resolvedRegionId } : {}),
+       region_id: resolvedRegionId,
      })
      .eq('id', id)
      .select('id, form, region_id, created_at, updated_at')
      .single();

    if (error) throw error;
    return toRecord(data as NotaDinasRow);
  },
```

---

## Correctness Properties

Property 1: Bug Condition — Supabase Client Tunggal

_For any_ file yang mengimpor Supabase client dalam codebase, termasuk `AuthorizeRoute.tsx`,
seluruh file SHALL menggunakan path `@/lib/supabase` sehingga hanya ada satu instance
Supabase client di runtime.

**Validates: Requirements BUG 1 — 2.1, 2.2**

Property 2: Preservation — AuthorizeRoute Tetap Berfungsi

_For any_ route yang menggunakan `AuthorizeRoute`, pengecekan row-level permission SHALL
tetap mengambil `region_id` dan `team_id` dari resource dan mengembalikan hasil `hasPermission()`
yang sama seperti sebelum perbaikan.

**Validates: Requirements BUG 1 — 3.1, 3.2**

Property 3: Bug Condition — Satu Fetch Per Perubahan Filter

_For any_ perubahan filter tanggal/bulan/tahun di `FuelReportTab` ketika `allActiveReports`
sudah dimuat, sistem SHALL hanya mengirim satu request Supabase (untuk data terfilter),
bukan dua.

**Validates: Requirements BUG 4 — 2.1, 2.2**

Property 4: Preservation — Deteksi Duplikat Tetap Akurat

_For any_ state `allActiveReports`, deteksi duplikat SHALL tetap akurat lintas filter dan
`allActiveReports` SHALL diperbarui setelah operasi hapus.

**Validates: Requirements BUG 4 — 3.1, 3.2**

Property 5: Bug Condition — Date Filter Konsisten

_For any_ perubahan filter di `Index.tsx`, `buildDateFilter()` SHALL selalu menggunakan nilai
state yang secara eksplisit diteruskan sebagai parameter, bukan membaca dari closure yang
berpotensi stale.

**Validates: Requirements BUG 5 — 2.1, 2.2**

Property 6: Bug Condition — Route Guard Tidak Redirect Prematur

_For any_ route guard komponen (NotaDinas, SpjOli, LaporanBbm, Overtime, PrintRekapAdmin,
Admin) yang dievaluasi ketika `session !== null` tetapi `profile === null`, sistem SHALL
menampilkan loading spinner dan TIDAK melakukan redirect sampai profil tersedia.

**Validates: Requirements BUG 6, 7, 8, 9, 10, 11 — masing-masing 2.1**

Property 7: Preservation — Route Guard Tetap Memblokir Akses Tidak Sah

_For any_ evaluasi route guard setelah `profile` tersedia, sistem SHALL tetap mengevaluasi
izin akses dengan benar dan redirect user yang tidak berhak.

**Validates: Requirements BUG 6, 7, 8, 9, 10, 11 — masing-masing 3.1, 3.2**

Property 8: Bug Condition — Update `region_id` Selalu Disertakan

_For any_ pemanggilan `notaDinasService.update()`, payload UPDATE ke Supabase SHALL selalu
menyertakan kolom `region_id`, termasuk ketika nilainya `null`.

**Validates: Requirements BUG 12 — 2.1, 2.2**

Property 9: Preservation — Create Nota Dinas Tidak Terpengaruh

_For any_ pemanggilan `notaDinasService.create()`, perilaku resolve dan penyimpanan
`region_id` SHALL tetap tidak berubah.

**Validates: Requirements BUG 12 — 3.2**

---

## Testing Strategy

### Validation Approach

Strategi testing mengikuti dua fase: verifikasi bug ada di kode yang belum diperbaiki, lalu
verifikasi perbaikan bekerja dan tidak merusak perilaku yang ada.

### Exploratory Bug Condition Checking

**BUG 1:**
- Import `AuthorizeRoute.tsx` dan periksa instance Supabase yang digunakan untuk row-level check — konfirmasi berbeda dari instance di `AuthorizeRoute` (sebelum fix)

**BUG 4:**
- Mount `FuelReportTab`, ubah filter bulan, spy Supabase calls — seharusnya ada 2 calls ke `getAllReports` (sebelum fix)

**BUG 5:**
- Update `selectedMonth` dan `selectedYear` hampir bersamaan, tangkap nilai yang dikirim ke `reportService.getFilteredReports()` — konfirmasi inkonsistensi (sebelum fix)

**BUG 6-11:**
- Render masing-masing route guard dengan `session` ada tetapi `profile = null` (simulasi profile null window) — konfirmasi redirect prematur terjadi (sebelum fix)

**BUG 12:**
- Panggil `notaDinasService.update()` dengan wilayah yang tidak ada di tabel regions — inspect payload Supabase, konfirmasi `region_id` tidak disertakan (sebelum fix)

### Fix Checking

```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedFunction(input)
  ASSERT expectedBehavior(result)
END FOR
```

### Preservation Checking

```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalFunction(input) = fixedFunction(input)
END FOR
```

### Unit Tests

- BUG 1: Verifikasi `AuthorizeRoute` menggunakan instance Supabase yang sama dengan `reportService`
- BUG 4: Verifikasi hanya 1 Supabase call saat filter berubah setelah initial load
- BUG 5: Verifikasi `buildDateFilter(date, month, year)` mengembalikan filter yang benar untuk setiap kombinasi input
- BUG 6-11: Verifikasi setiap route guard merender spinner saat `profile = null` dan sesi ada
- BUG 12: Verifikasi payload `UPDATE` selalu menyertakan `region_id: null` ketika resolve gagal

### Property-Based Tests

- BUG 5: Generate kombinasi acak `(date, month, year)` dan verifikasi `buildDateFilter` selalu mengembalikan hasil deterministik
- BUG 6-11: Generate state acak `{loading, session, profile}` dan verifikasi route guard tidak pernah redirect saat `profile === null && session !== null`
- BUG 12: Generate form acak dengan `wilayah` yang tidak valid dan verifikasi `region_id` selalu ada di payload

### Integration Tests

- BUG 4: Load `FuelReportTab`, ubah filter 3 kali, verifikasi total Supabase calls = 3 (bukan 6)
- BUG 6-11: Simulasi login flow lengkap dengan delay profil buatan, verifikasi tidak ada redirect prematur
- BUG 12: Buat nota dinas dengan wilayah valid, ubah ke wilayah tidak valid, verifikasi `region_id` di DB menjadi null

---

## Bugs Tanpa Perubahan Kode

| Bug | Status | Alasan |
|-----|--------|--------|
| BUG 2 | False positive | Struktur `App.tsx` sudah benar — `AuthProvider` membungkus `BrowserRouter` yang membungkus `ActivityTracker` |
| BUG 3 | False positive | Role `LAPORAN` memang termasuk `canManageReportEntries()` dan berhak akses `/create` dan `/edit/:id` via `ProtectedRoute` |
| BUG 13 | Verified OK | `work_plans` dikonfirmasi konsisten di `AuthorizeRoute`, `getDatabaseRecordCount`, dan `workPlanService` |
| BUG 14 | Acceptable | `filterDraftKey` sudah menggunakan `session.user.id` — draft lama tidak akan pernah diterapkan ke user lain karena key berbeda |
| BUG 15 | Verified OK | `isAdminSpjOli` konsisten dideklarasikan dan digunakan di `Index.tsx` |
| BUG 16 | Verified OK | `reportType` sudah ada di dependency array `useEffect` di `FuelReportTab.tsx` |
