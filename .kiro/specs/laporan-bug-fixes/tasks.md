# Implementation Plan

- [ ] 1. Write bug condition exploration tests
  - **Property 1: Bug Condition** - Multi-Bug Exploration
  - **CRITICAL**: Tulis semua test ini SEBELUM mengimplementasi fix — test harus GAGAL di kode yang belum diperbaiki
  - **DO NOT attempt to fix the test or the code when it fails**
  - **GOAL**: Konfirmasi setiap bug benar-benar ada dengan menghasilkan counterexample konkret

  **BUG 1 — Import path Supabase di AuthorizeRoute:**
  - Baca `AuthorizeRoute.tsx` dan verifikasi import path-nya adalah `@/integrations/supabase/client`
  - Tulis test yang memeriksa bahwa instance supabase yang digunakan di `AuthorizeRoute` adalah objek yang sama (`===`) dengan instance dari `@/lib/supabase`
  - Run test pada kode unfixed — **EXPECTED OUTCOME**: GAGAL (dua instance berbeda)
  - Dokumentasi counterexample: `supabaseFromAuthorizeRoute !== supabaseFromLib`

  **BUG 4 — Double fetch di FuelReportTab:**
  - Tulis test yang me-mount `FuelReportTab` dengan `allActiveReports` sudah terisi
  - Spy/mock `getAllReports` dari service layer
  - Ubah salah satu filter (misal: `selectedMonth`) setelah initial load selesai
  - Assert bahwa `getAllReports` dipanggil **tepat 1 kali** (hanya saat mount), bukan 2 kali
  - Run test pada kode unfixed — **EXPECTED OUTCOME**: GAGAL (getAllReports dipanggil 2x per filter change)
  - Dokumentasi counterexample: `getAllReports call count = 2 after 1 filter change`

  **BUG 5 — Stale closure di buildDateFilter:**
  - Tulis test unit untuk `buildDateFilter` yang dipanggil dengan nilai berbeda dari state saat ini
  - Verifikasi bahwa ketika `selectedMonth` dan `selectedYear` diubah hampir bersamaan, nilai yang diteruskan ke service selalu konsisten
  - Scoped PBT: generate pasangan `(month, year)` dan verifikasi output `buildDateFilter` selalu deterministik berdasarkan input, bukan closure state
  - Run test pada kode unfixed — **EXPECTED OUTCOME**: GAGAL (closure membaca state yang salah)

  **BUG 6-11 — Route guard redirect prematur (semua 6 route guard):**
  - Untuk setiap route guard: `NotaDinasRoute`, `SpjOliRoute`, `LaporanBbmRoute`, `OvertimeAccessRoute`, `PrintRekapAdminRoute`, `AdminRoute`
  - Render komponen dengan state: `loading = false`, `session = { user: { id: '123' } }` (ada), `profile = null`
  - Assert bahwa komponen merender **loading spinner** (bukan `<Navigate>`)
  - Run test pada kode unfixed — **EXPECTED OUTCOME**: GAGAL untuk semua 6 (langsung redirect ke '/')
  - Dokumentasi counterexample: `profile=null with session renders <Navigate> instead of spinner`

  **BUG 12 — update() tidak menyertakan region_id: null:**
  - Tulis test yang memanggil `notaDinasService.update()` dengan form berisi wilayah yang tidak ada di tabel regions
  - Spy pada `supabase.from('nota_dinas_records').update()`
  - Assert bahwa payload yang diteruskan ke `.update()` **selalu** memiliki key `region_id` (termasuk `region_id: null`)
  - Run test pada kode unfixed — **EXPECTED OUTCOME**: GAGAL (region_id tidak ada di payload)
  - Dokumentasi counterexample: `payload = { form, updated_at }` — tidak ada `region_id`

  - _Requirements: 1.1, 1.2, 4.1, 4.2, 5.1, 5.2, 6.1, 7.1, 8.1, 9.1, 10.1, 11.1, 12.1, 12.2_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Behavioral Preservation Across All Bug Fixes
  - **IMPORTANT**: Ikuti observation-first methodology — jalankan di kode unfixed dulu, catat output, baru tulis assertion
  - **EXPECTED OUTCOME**: Semua test ini PASS pada kode unfixed (baseline)

  **BUG 1 — AuthorizeRoute tetap melakukan row-level permission check:**
  - Observe: `AuthorizeRoute` dengan `resource="work_plans"` memanggil `supabase.from('work_plans').select('region_id, team_id')`
  - Tulis property test: untuk semua resource prop yang valid, `hasPermission()` mengembalikan nilai boolean yang konsisten sebelum dan sesudah fix
  - Verify: test PASS pada unfixed code

  **BUG 4 — FuelReportTab tetap memuat allActiveReports saat mount:**
  - Observe: saat komponen pertama mount, `getAllReports` dipanggil untuk isi `allActiveReports`
  - Tulis property test: pada initial mount, `allActiveReports` terisi dan deteksi duplikat berfungsi
  - Tulis property test: setelah operasi hapus, `allActiveReports` berkurang 1 entry (local update)
  - Verify: kedua test PASS pada unfixed code

  **BUG 5 — Filter tanggal/bulan/tahun tetap memicu loadData:**
  - Observe: perubahan `selectedDate`, `selectedMonth`, `selectedYear`, atau `selectedCategory` selalu memicu `loadData()`
  - Tulis property test: untuk semua kombinasi perubahan filter, `loadData` selalu dipanggil tepat 1 kali per perubahan
  - Tulis property test: perubahan `region` atau `searchQuery` TIDAK memicu server fetch (hanya client-side filter)
  - Verify: test PASS pada unfixed code

  **BUG 6-11 — Route guard tetap memblokir user yang tidak berhak setelah profile tersedia:**
  - Observe: setelah profil dimuat, route guard mengevaluasi izin dengan benar
  - Tulis property test: untuk semua kombinasi `{profile: non-null, session: non-null}`, hasil izin konsisten dengan logika role yang ada
  - Tulis property test: user tanpa sesi (`session = null`) selalu diarahkan ke `/login`
  - Verify: test PASS pada unfixed code

  **BUG 12 — notaDinasService.create() tidak terpengaruh:**
  - Observe: `notaDinasService.create()` menyertakan `region_id` dengan nilai yang benar saat wilayah valid
  - Tulis test: panggil `create()` dengan wilayah valid, verifikasi `region_id` ada di payload
  - Verify: test PASS pada unfixed code

  - _Requirements: 1.3.1, 1.3.2, 4.3.1, 4.3.2, 5.3.1, 5.3.2, 6.3.1, 6.3.2, 7.3.1, 7.3.2, 8.3.1, 9.3.1, 9.3.2, 10.3.1, 10.3.2, 11.3.1, 11.3.2, 12.3.1, 12.3.2_

- [ ] 3. Fix AuthorizeRoute.tsx — BUG 1: Import path Supabase tidak konsisten

  - [ ] 3.1 Ubah import path Supabase di AuthorizeRoute.tsx
    - Buka `src/components/AuthorizeRoute.tsx`
    - Cari baris: `import { supabase } from '@/integrations/supabase/client';`
    - Ganti dengan: `import { supabase } from '@/lib/supabase';`
    - Tidak ada perubahan logika lain — hanya satu baris yang berubah
    - _Bug_Condition: isBugCondition(file) where file === 'AuthorizeRoute.tsx' AND importPath === '@/integrations/supabase/client'_
    - _Expected_Behavior: seluruh file menggunakan '@/lib/supabase', hanya satu Supabase instance di runtime_
    - _Preservation: row-level permission check (region_id, team_id) tetap berfungsi identik_
    - _Requirements: 1.2.1, 1.2.2_

  - [ ] 3.2 Verify bug condition exploration test (BUG 1) sekarang PASS
    - **Property 1: Expected Behavior** - Single Supabase Instance
    - **IMPORTANT**: Re-run SAME test dari task 1 — JANGAN tulis test baru
    - Run test yang memeriksa `supabaseFromAuthorizeRoute === supabaseFromLib`
    - **EXPECTED OUTCOME**: Test PASS (bug 1 terperbaiki)
    - _Requirements: 1.2.1, 1.2.2_

  - [ ] 3.3 Verify preservation tests (BUG 1) masih PASS
    - **Property 2: Preservation** - AuthorizeRoute Row-Level Check
    - Re-run SAME preservation tests dari task 2
    - Konfirmasi `hasPermission()` masih mengembalikan hasil yang sama
    - **EXPECTED OUTCOME**: Test PASS (tidak ada regresi)

- [ ] 4. Fix FuelReportTab.tsx — BUG 4: Double fetch getAllReports setiap filter berubah

  - [ ] 4.1 Ekstrak pemuatan allActiveReports ke useEffect terpisah
    - Buka `src/components/FuelReportTab.tsx`
    - Tambahkan `useEffect` baru yang hanya berjalan saat mount (dan ketika `profile`, `session`, `regionId`, atau `reportType` berubah):
      ```tsx
      useEffect(() => {
        if (!profile || !session) return;
        getAllReports().then(setAllActiveReports).catch(() => {});
      }, [profile, session, regionId, reportType]);
      ```
    - _Bug_Condition: isBugCondition(event) where event.type IN ['date_change', 'month_change', 'year_change'] AND allActiveReports sudah dimuat_
    - _Expected_Behavior: hanya 1 Supabase request per filter change (bukan 2)_
    - _Requirements: 4.2.1, 4.2.2_

  - [ ] 4.2 Hapus pemuatan allActiveReports dari dalam loadReports()
    - Dalam fungsi `loadReports()`, hapus dua baris berikut:
      ```tsx
      // HAPUS ini:
      const allActive = await getAllReports();
      if (id !== reqIdRef.current) return;
      // HAPUS ini:
      setAllActiveReports(allActive);
      ```
    - Pastikan `setReports(data)` dan `setCurrentPage(1)` tetap ada
    - _Bug_Condition: pemanggilan getAllReports() di dalam loadReports() saat allActiveReports sudah ada_
    - _Preservation: setAllActiveReports dipanggil setelah hapus masih ada via local update_
    - _Requirements: 4.2.1, 4.2.2_

  - [ ] 4.3 Verify bug condition exploration test (BUG 4) sekarang PASS
    - **Property 1: Expected Behavior** - Single Fetch Per Filter Change
    - Re-run SAME test dari task 1 untuk BUG 4
    - Assert `getAllReports` dipanggil 1x saat mount, 0x saat filter berubah
    - **EXPECTED OUTCOME**: Test PASS

  - [ ] 4.4 Verify preservation tests (BUG 4) masih PASS
    - **Property 2: Preservation** - allActiveReports Loaded on Mount & Updated on Delete
    - Re-run SAME preservation tests dari task 2 untuk BUG 4
    - **EXPECTED OUTCOME**: Test PASS (tidak ada regresi pada deteksi duplikat)

- [ ] 5. Fix Index.tsx — BUG 5: Stale closure di buildDateFilter

  - [ ] 5.1 Refactor buildDateFilter agar menerima parameter eksplisit
    - Buka `src/pages/Index.tsx`
    - Cari fungsi `buildDateFilter` (atau yang setara)
    - Ubah signature dari tanpa parameter menjadi menerima `(date: string, month: string, year: string)`:
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
    - _Bug_Condition: isBugCondition(filterChange) where statesChanged >= 2 AND buildDateFilter() membaca state via closure_
    - _Expected_Behavior: buildDateFilter selalu menggunakan nilai yang secara eksplisit diteruskan_
    - _Requirements: 5.2.1, 5.2.2_

  - [ ] 5.2 Update semua call site buildDateFilter untuk meneruskan nilai eksplisit
    - Cari semua tempat di `Index.tsx` yang memanggil `buildDateFilter()`
    - Perbarui setiap pemanggilan menjadi `buildDateFilter(selectedDate, selectedMonth, selectedYear)`
    - Pastikan nilai yang diteruskan adalah nilai state yang berlaku saat `loadData()` dipanggil
    - _Preservation: perubahan filter tetap memicu loadData dan server fetch_
    - _Requirements: 5.2.1, 5.2.2_

  - [ ] 5.3 Verify bug condition exploration test (BUG 5) sekarang PASS
    - **Property 1: Expected Behavior** - Deterministic Date Filter
    - Re-run SAME test dari task 1 untuk BUG 5
    - **EXPECTED OUTCOME**: Test PASS

  - [ ] 5.4 Verify preservation tests (BUG 5) masih PASS
    - **Property 2: Preservation** - Filter Changes Trigger loadData
    - Re-run SAME preservation tests dari task 2 untuk BUG 5
    - **EXPECTED OUTCOME**: Test PASS

- [ ] 6. Fix App.tsx — BUG 6-11: 6 route guard tidak memiliki guard profile null

  - [ ] 6.1 Tambahkan guard profile null di NotaDinasRoute
    - Buka `src/App.tsx`
    - Cari komponen `NotaDinasRoute`
    - Setelah baris `if (!session) return <Navigate to="/login" replace />;`, tambahkan:
      ```tsx
      if (!profile) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
      ```
    - _Bug_Condition: isBugCondition(routeEvaluation) where loading===false AND session!==null AND profile===null_
    - _Expected_Behavior: tampilkan spinner, tunggu profil tersedia sebelum evaluasi izin_
    - _Preservation: user tanpa sesi tetap diarahkan ke /login; user tidak berhak tetap di-redirect_
    - _Requirements: 6.2.1, 6.2.2_

  - [ ] 6.2 Tambahkan guard profile null di SpjOliRoute
    - Dalam `src/App.tsx`, cari komponen `SpjOliRoute`
    - Setelah `if (!session) return <Navigate to="/login" replace />;`, tambahkan:
      ```tsx
      if (!profile) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
      ```
    - _Bug_Condition: sama dengan BUG 6 — profile null window_
    - _Requirements: 7.2.1_

  - [ ] 6.3 Tambahkan guard profile null di LaporanBbmRoute
    - Dalam `src/App.tsx`, cari komponen `LaporanBbmRoute`
    - Setelah `if (!session) return <Navigate to="/login" replace />;`, tambahkan:
      ```tsx
      if (!profile) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
      ```
    - _Requirements: 8.2.1_

  - [ ] 6.4 Tambahkan guard profile null di OvertimeAccessRoute
    - Dalam `src/App.tsx`, cari komponen `OvertimeAccessRoute`
    - Setelah `if (!session) return <Navigate to="/login" replace />;`, tambahkan:
      ```tsx
      if (!profile) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
      ```
    - _Requirements: 9.2.1_

  - [ ] 6.5 Tambahkan guard profile null di PrintRekapAdminRoute
    - Dalam `src/App.tsx`, cari komponen `PrintRekapAdminRoute`
    - Setelah `if (!session) return <Navigate to="/login" replace />;`, tambahkan:
      ```tsx
      if (!profile) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
      ```
    - _Requirements: 10.2.1_

  - [ ] 6.6 Tambahkan guard profile null di AdminRoute
    - Dalam `src/App.tsx`, cari komponen `AdminRoute`
    - Setelah `if (!session) return <Navigate to="/login" />;`, tambahkan:
      ```tsx
      if (!profile) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
      ```
    - _Requirements: 11.2.1_

  - [ ] 6.7 Verify bug condition exploration tests (BUG 6-11) sekarang PASS
    - **Property 1: Expected Behavior** - No Premature Redirect (All 6 Route Guards)
    - Re-run SAME tests dari task 1 untuk BUG 6-11 (render dengan `session != null, profile = null`)
    - **EXPECTED OUTCOME**: Semua 6 test PASS — spinner ditampilkan, bukan Navigate

  - [ ] 6.8 Verify preservation tests (BUG 6-11) masih PASS
    - **Property 2: Preservation** - Access Control Remains Correct After Profile Loads
    - Re-run SAME preservation tests dari task 2 untuk BUG 6-11
    - **EXPECTED OUTCOME**: Test PASS — redirect ke /login tetap berfungsi, evaluasi izin tetap benar

- [ ] 7. Fix notaDinasService.ts — BUG 12: update() tidak memperbarui region_id ke null

  - [ ] 7.1 Ganti conditional spread dengan assignment langsung untuk region_id
    - Buka `src/services/notaDinasService.ts`
    - Cari method `update()`, cari pola conditional spread untuk `region_id`:
      ```tsx
      ...(resolvedRegionId ? { region_id: resolvedRegionId } : {}),
      ```
    - Ganti dengan assignment langsung:
      ```tsx
      region_id: resolvedRegionId,
      ```
    - Pastikan `resolvedRegionId` bisa bernilai `null` — tidak perlu perubahan lain
    - _Bug_Condition: isBugCondition(updateCall) where resolveRegionId() === null AND region_id lama di DB bukan null_
    - _Expected_Behavior: payload UPDATE selalu menyertakan kolom region_id, termasuk nilai null_
    - _Preservation: create() tidak berubah; update() dengan wilayah valid tetap menyimpan region_id yang benar_
    - _Requirements: 12.2.1, 12.2.2_

  - [ ] 7.2 Verify bug condition exploration test (BUG 12) sekarang PASS
    - **Property 1: Expected Behavior** - region_id Always Included in Update Payload
    - Re-run SAME test dari task 1 untuk BUG 12
    - Assert payload selalu memiliki key `region_id` (termasuk `null`)
    - **EXPECTED OUTCOME**: Test PASS

  - [ ] 7.3 Verify preservation tests (BUG 12) masih PASS
    - **Property 2: Preservation** - create() Unaffected, Valid region_id Still Saved
    - Re-run SAME preservation tests dari task 2 untuk BUG 12
    - **EXPECTED OUTCOME**: Test PASS

- [ ] 8. Checkpoint — Pastikan semua test pass
  - Jalankan seluruh test suite: `npx vitest --run` (atau perintah test yang digunakan project)
  - Verifikasi semua 9 unit/property test dari task 1 PASS
  - Verifikasi semua preservation test dari task 2 PASS
  - Pastikan tidak ada TypeScript compile error (`npx tsc --noEmit`)
  - Jika ada test yang gagal atau compile error, investigasi dan perbaiki sebelum menandai selesai
  - Tanyakan kepada user jika ada ambiguitas yang memerlukan keputusan
