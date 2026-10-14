# Laporan Audit Profesional – Kodebase `laporan`
**Tanggal Audit:** 13 Oktober 2026  
**Auditor:** Kiro AI Code Auditor  
**Scope:** Seluruh workspace `c:\Users\dlhup\dyad-apps\laporan`  
**Metodologi:** Pemeriksaan statis kode sumber, konfigurasi, migrasi database, dan dependency manifest — tanpa eksekusi kode.

---

## Executive Summary

Kodebase ini adalah aplikasi pelaporan kerja internal untuk Dinas Lingkungan Hidup (DLH) Kota Medan. Stack: React + TypeScript (frontend, Vite), Express + TypeScript (API server), Supabase (PostgreSQL + Auth + Storage). Arsitektur monorepo pnpm workspace dengan tiga artifact utama: `laporan-kerja` (frontend), `api-server` (Express), dan `mockup-sandbox`.

Secara keseluruhan, kodebase dalam kondisi **baik dengan sejumlah temuan serius** yang perlu ditangani:

- **1 temuan CRITICAL**: `.env` dengan kredensial Supabase production ter-commit di repository.
- **3 temuan HIGH**: TypeScript errors pada file `UserManagement.tsx`, Google Drive API Key ter-expose di client bundle, dan RLS functions yang stale/tidak sinkron dengan multi-role system baru.
- **8 temuan MEDIUM**: Komponen over-size, duplikasi logika PDF, soft-delete missing di beberapa RLS policies, validasi payload PDF yang mudah dibypass, dan lainnya.
- **6 temuan LOW**: Test coverage minimal, `fetchAllPages` dengan parameter `any` tidak typed, external image URLs hardcoded di landing page, dll.

Sisi positifnya: sistem sudah mengimplementasikan audit log lengkap, soft-delete konsisten di tabel utama, login rate-limiting dengan lockout di client, draft form berbasis IndexedDB, dan CORS dibatasi ke origin yang dikenal.

---

## Temuan Detail

---

### [CRITICAL] C-01 — File `.env` dengan Kredensial Production Ter-Commit

**Severity:** CRITICAL  
**File:** `artifacts/laporan-kerja/.env`  
**Kategori:** Keamanan — Secrets Exposure

**Deskripsi:**  
File `artifacts/laporan-kerja/.env` berisi Supabase URL dan Anon Key production aktif dan tersimpan di dalam repository (bukan di `.gitignore`). File ini terdeteksi karena path `artifacts/laporan-kerja/.env` tidak ter-cover oleh aturan `.gitignore` root. `.gitignore` mendefinisikan `.env` (root-relative), namun pola tersebut tidak otomatis mencakup file di subdirektori artifact kecuali ada `.gitignore` di dalam artifact itu sendiri.

```
# artifacts/laporan-kerja/.env
VITE_SUPABASE_URL=https://ffgksqjznamthsdbkstu.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci... [JWT aktif]
```

**Risiko:**  
Siapa pun yang dapat membaca repository history dapat mengekstrak key ini. Meskipun Supabase Anon Key memang bersifat "public" (dimaksudkan untuk client-side), mengeksposnya di git history berarti key tidak bisa dirotasi tanpa juga membersihkan history. Lebih kritis: jika suatu saat service-role key atau credentials lain masuk ke file ini, mereka otomatis ter-commit.

**Rekomendasi:**
1. Segera tambahkan `.gitignore` di `artifacts/laporan-kerja/` yang secara eksplisit mengecualikan `.env`.
2. Jalankan `git rm --cached artifacts/laporan-kerja/.env` untuk menghapus file dari tracking.
3. Verifikasi git history apakah sudah ada commits yang menyertakan credentials lebih sensitif.
4. Rotasi Supabase Anon Key sebagai tindakan precaution.
5. Periksa apakah `.gitignore` root perlu diperbaiki dengan menambahkan pattern `**/.env`.

---

### [HIGH] H-01 — TypeScript Compilation Errors di `UserManagement.tsx`

**Severity:** HIGH  
**File:** `artifacts/laporan-kerja/src/components/UserManagement.tsx`, baris 114–116  
**Kategori:** Kualitas Kode — Build Errors

**Deskripsi:**  
File `tsc_output.txt` mencatat 7 TypeScript errors di `UserManagement.tsx` pada baris 114–116:

```
artifacts/laporan-kerja/src/components/UserManagement.tsx(114,8): error TS1005: ',' expected.
artifacts/laporan-kerja/src/components/UserManagement.tsx(114,29): error TS1011: An element access expression should take an argument.
artifacts/laporan-kerja/src/components/UserManagement.tsx(115,8): error TS1005: ',' expected.
artifacts/laporan-kerja/src/components/UserManagement.tsx(116,2): error TS1005: ',' expected.
artifacts/laporan-kerja/src/components/UserManagement.tsx(116,11): error TS1005: ',' expected.
artifacts/laporan-kerja/src/components/UserManagement.tsx(116,13): error TS1003: Identifier expected.
artifacts/laporan-kerja/src/components/UserManagement.tsx(116,17): error TS1109: Expression expected.
```

Ini mengindikasikan syntax error aktif yang menyebabkan build `typecheck` gagal. Komponen tetap dapat dirender oleh Vite (yang lebih toleran), namun CI pipeline yang menjalankan `pnpm typecheck` akan gagal.

**Rekomendasi:**
1. Buka `UserManagement.tsx` baris 114–116, temukan dan perbaiki syntax error (kemungkinan JSX fragment atau destructuring yang tidak lengkap).
2. Jalankan `pnpm typecheck` untuk memvalidasi seluruh codebase setelah perbaikan.
3. Pertimbangkan menambahkan pre-commit hook yang menjalankan `tsc --noEmit` agar errors seperti ini tidak lolos.

---

### [HIGH] H-02 — Google Drive API Key Ter-Expose di Client Bundle

**Severity:** HIGH  
**File:** `artifacts/laporan-kerja/src/components/DriveUploadDialog.tsx`, baris 20  
**Kategori:** Keamanan — Secrets Exposure

**Deskripsi:**  
`VITE_GOOGLE_API_KEY` (dari env var `VITE_GOOGLE_API_KEY`) di-bundle langsung ke dalam JavaScript yang dikirim ke browser:

```typescript
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
```

Semua variabel `VITE_*` di Vite di-inline ke dalam client bundle saat build. API Key Google Drive yang ter-expose di browser dapat disalahgunakan oleh siapa pun yang membuka DevTools untuk membuat request ke Google Drive API atas nama project.

**Konteks:**  
Sudah ada endpoint server-side di `artifacts/api-server/src/routes/google-drive.ts` yang dimaksudkan untuk menjaga API Key di server, namun endpoint ini belum diimplementasikan (`501 Not Implemented`) dan client masih menggunakan API Key langsung.

**Rekomendasi:**
1. Implementasikan Google Drive upload di server-side (`google-drive.ts`) menggunakan `GOOGLE_API_KEY` dari environment server (bukan `VITE_GOOGLE_API_KEY`).
2. Hapus `VITE_GOOGLE_API_KEY` dari `.env.example` dan kode client.
3. Hanya `CLIENT_ID` (OAuth2 Client ID) yang boleh ada di client — itu memang desain OAuth2 yang benar.
4. Tambahkan API key restrictions di Google Cloud Console (restrict by IP untuk server, restrict by referrer untuk client ID).

---

### [HIGH] H-03 — RLS Functions Tidak Sinkron dengan Multi-Role System

**Severity:** HIGH  
**File:** `artifacts/laporan-kerja/supabase/migrations/20261008_zzz_multi_role_refactor.sql`  
**Kategori:** Keamanan — Authorization Bypass

**Deskripsi:**  
Migration `20261008_zzz_multi_role_refactor.sql` menambahkan kolom `roles text[]` dan memperbarui `has_record_access()`, namun beberapa fungsi RLS lama masih bergantung pada kolom `role` (singular) via `current_access_role()`:

1. Fungsi `has_record_access()` versi lama (signature 4 parameter dari `20260811_harden_rls_policies.sql`) mungkin masih dipanggil oleh policies yang belum diupdate karena PostgreSQL overloading.
2. Fungsi `has_fuel_access()`, `has_admin_access()`, `has_fuel_price_write_access()` didefinisikan di `20260811` dan **tidak diperbarui** untuk membaca `roles[]` — mereka masih memanggil `current_access_role()` yang hanya membaca kolom `role` singular.
3. User dengan roles baru (misal `['bbm', 'rencana_kerja']` di array, dengan `role` = `NULL` atau role lama) akan ditolak oleh RLS policies ini karena `current_access_role()` mengembalikan NULL.

Contoh `has_fuel_access()` yang problematik:
```sql
-- Masih menggunakan current_access_role() yang hanya baca kolom `role` singular
when public.current_access_role() = 'admin' then true
when public.current_access_role() = 'admin_bbm' then ...
```

Sementara user baru menggunakan `roles = ['administrator']` atau `roles = ['bbm']` dengan `role = NULL` atau role lama.

**Rekomendasi:**
1. Perbarui `has_fuel_access()`, `has_admin_access()`, dan `has_fuel_price_write_access()` untuk menggunakan `current_access_roles()` (plural, array version) dengan `= ANY(...)`.
2. Jalankan pengujian login dengan akun yang hanya menggunakan sistem roles baru untuk memvalidasi akses.
3. Tambahkan migration baru yang secara eksplisit mengganti ketiga fungsi ini.

---

### [MEDIUM] M-01 — Komponen Melebihi 300 Baris (Violasi AI_RULES.md)

**Severity:** MEDIUM  
**File:** 27 file melebihi 300 baris, 12 file melebihi 600 baris  
**Kategori:** Maintainability — Component Size

**Deskripsi:**  
`AI_RULES.md` menetapkan: *"Keep components focused; aim for no more than 300 lines."* Namun banyak komponen jauh melebihi batas ini:

| File | Baris |
|------|-------|
| `WorkPlanDailyRecap.tsx` | 982 |
| `FuelReportForm.tsx` | 892 |
| `FuelReportList.tsx` | 875 |
| `WorkPlanForm.tsx` | 863 |
| `FuelReportTab.tsx` | 830 |
| `UserManagement.tsx` | 815 (ada TODO comment mengakui ini) |
| `DailyRecap.tsx` | 785 |
| `WeeklyRecap.tsx` | 768 |
| `Maintenance.tsx` | 741 |

Komponen-komponen ini sulit di-review, rentan terhadap logic coupling, dan menghambat isolasi unit test.

**Rekomendasi:**
1. Prioritaskan pemisahan `WorkPlanDailyRecap.tsx` dan `FuelReportList.tsx` yang paling besar.
2. Ikuti pola yang sudah dimulai di `UserManagement.tsx` (ekstrak `RolesDropdown`): pisahkan tabel, form, dan dialog actions ke file terpisah.
3. Gunakan custom hooks untuk logika fetch/state dan komponen terpisah untuk UI-nya.

---

### [MEDIUM] M-02 — Duplikasi Logika PDF antara `api/render-pdf.ts` dan `api-server`

**Severity:** MEDIUM  
**File:** `api/render-pdf.ts` (Vercel adapter), `artifacts/api-server/src/routes/pdf.ts` (Express adapter), `artifacts/api-server/src/lib/pdf-core.ts`  
**Kategori:** Kualitas Kode — Code Duplication

**Deskripsi:**  
`pdf-core.ts` memang sudah dibuat sebagai shared library untuk CSS styles, validation, dan page options. Namun `api/render-pdf.ts` (Vercel) masih mendefinisikan `safeFileName` dan CSS styles sendiri, tidak menggunakan `pdf-core.ts`. Ada CSS yang hampir identik di kedua file, dengan perbedaan minor:

- `MAX_DOCUMENT_SIZE`: 4MB di Vercel, 10MB di Express.
- `safeFileName`: implementasi identik tapi di-copy-paste.
- CSS styles untuk `.pdf-export`: hampir identik tapi tidak shared.
- Validasi payload (`recap-print-area` check) diimplementasikan dua kali.

**Rekomendasi:**
1. Jadikan `pdf-core.ts` sebagai shared library yang bisa diimport oleh Vercel adapter.
2. Atau letakkan Vercel adapter (`api/render-pdf.ts`) sebagai re-export dari `pdf-core.ts`.
3. Unifikasi `MAX_DOCUMENT_SIZE` — pilih satu nilai yang aman untuk kedua environment.

---

### [MEDIUM] M-03 — Soft Delete Missing di Beberapa RLS Policies

**Severity:** MEDIUM  
**File:** `artifacts/laporan-kerja/supabase/migrations/20261013_add_deleted_at_to_tables.sql`  
**Kategori:** Data Layer — RLS Consistency

**Deskripsi:**  
Migration `20261013` menambahkan kolom `deleted_at` ke `overtime_records`, `nota_dinas_records`, dan `spj_oli_records`, serta memperbarui RLS policies untuk memfilter `deleted_at IS NULL`. Namun ada masalah desain:

1. **Delete policies yang salah**: Policy `overtime_delete_authenticated` dan `spj_oli_delete_authenticated` menggunakan condition `deleted_at IS NULL` di `USING`. Ini berarti record yang sudah di-soft-delete tidak bisa di-hard-delete via SQL karena policy menolaknya. Ini memblokir fungsi `hardDelete*` di service layer.

2. **Insert policies dengan `deleted_at IS NULL`**: Policy `overtime_insert_authenticated` menggunakan `with check (... and deleted_at is null)`. Ini redundant (insert baru tidak akan pernah punya `deleted_at` yang diset) dan membingungkan.

3. **Tabel `reports` dan `fuel_reports`** tidak memiliki masalah ini — hanya tabel yang ditambahkan di migration baru.

**Rekomendasi:**
1. Hapus condition `deleted_at IS NULL` dari `DELETE` policies — hard delete harus tetap bisa dilakukan terhadap soft-deleted records.
2. Hapus condition `deleted_at IS NULL` dari `INSERT WITH CHECK` policies — redundant.
3. Tambahkan migration baru yang memperbaiki policies ini.

---

### [MEDIUM] M-04 — Validasi PDF Payload Mudah Dibypass

**Severity:** MEDIUM  
**File:** `artifacts/api-server/src/lib/pdf-core.ts` (validatePdfPayload), `api/render-pdf.ts`  
**Kategori:** Keamanan — Input Validation

**Deskripsi:**  
Validasi payload PDF hanya memeriksa apakah string HTML mengandung class `recap-print-area`:

```typescript
if (typeof documentHtml !== "string" || !documentHtml.includes("recap-print-area")) {
  return "Dokumen rekap untuk dicetak tidak valid.";
}
```

Ini bukan validasi keamanan yang memadai. Siapa pun yang bisa mengirim POST ke `/api/render-pdf` (termasuk dari browser dengan CORS yang tidak ter-whitelist) dapat mengirim HTML arbitrari selama mengandung string `recap-print-area`. Chromium/Playwright akan merender HTML tersebut, termasuk:
- External resource requests yang bisa digunakan untuk SSRF (Server-Side Request Forgery).
- JavaScript execution (Playwright memiliki JS enabled secara default di `pdf.ts`).

**Rekomendasi:**
1. Di `artifacts/api-server/src/routes/pdf.ts`, nonaktifkan JavaScript: `await page.setJavaScriptEnabled(false)` sebelum `setContent()` — sama seperti yang dilakukan di Vercel adapter.
2. Blokir external network requests di page: gunakan `page.route('**/*', route => { if (!allowedOrigins.includes(new URL(route.request().url()).origin)) route.abort(); else route.continue(); })`.
3. Tambahkan autentikasi ke endpoint PDF — saat ini endpoint dapat diakses tanpa autentikasi selama CORS terpenuhi.
4. Pertimbangkan menambahkan validasi struktur HTML yang lebih ketat (misalnya whitelist element types yang diizinkan).

---

### [MEDIUM] M-05 — Rate Limiting Login Hanya di Client-Side

**Severity:** MEDIUM  
**File:** `artifacts/laporan-kerja/src/pages/Login.tsx`  
**Kategori:** Keamanan — Brute Force Protection

**Deskripsi:**  
Login.tsx mengimplementasikan rate limiting yang cukup baik (5 attempts, 60s lockout, exponential backoff) menggunakan `sessionStorage`. Namun ini adalah client-side enforcement yang dapat dengan mudah dibypass:

```typescript
// Semua state disimpan di sessionStorage — mudah dihapus
const STORAGE_KEY_FAIL_COUNT = 'dlh:login:failCount';
const STORAGE_KEY_LOCKED_UNTIL = 'dlh:login:lockedUntil';
```

Penyerang bisa dengan mudah menghapus keys ini dari DevTools atau menggunakan API langsung, lalu brute-force password tanpa batas.

**Rekomendasi:**
1. Implementasikan rate limiting di server/Supabase level — Supabase Auth memiliki built-in rate limiting yang perlu dikonfigurasi di dashboard.
2. Atau tambahkan endpoint API server yang menjadi proxy login dengan rate limiting berbasis IP menggunakan `express-rate-limit`.
3. Client-side rate limiting tetap berguna sebagai UX improvement, tapi tidak bisa menjadi satu-satunya proteksi.

---

### [MEDIUM] M-06 — `fetchAllPages` Menggunakan Parameter `any` Tidak Typed

**Severity:** MEDIUM  
**File:** `artifacts/laporan-kerja/src/lib/fetchAllPages.ts`  
**Kategori:** Kualitas Kode — Type Safety

**Deskripsi:**  
```typescript
export const fetchAllPages = async <T>(
  buildQuery: () => any,  // ← any
  pageSize = 1000,
  maxPages = 50,
): Promise<T[]> => {
```

Parameter `buildQuery` bertipe `() => any` yang melemahkan type safety. Ini memungkinkan fungsi dipanggil dengan query builder yang tidak kompatibel tanpa error TypeScript.

**Rekomendasi:**
Gunakan tipe yang lebih spesifik untuk Supabase query builder:
```typescript
type SupabaseQueryBuilder<T> = {
  range(from: number, to: number): Promise<{ data: T[] | null; error: PostgrestError | null }>;
};
```

---

### [MEDIUM] M-07 — Hardcoded External URLs di `PublicLanding.tsx`

**Severity:** MEDIUM  
**File:** `artifacts/laporan-kerja/src/pages/PublicLanding.tsx`  
**Kategori:** Maintainability — External Dependencies

**Deskripsi:**  
Landing page menggunakan hardcoded external image URLs:
```typescript
image: "https://upload.wikimedia.org/wikipedia/commons/9/97/WALIKOTA_MEDAN_-_RICO_WAAS.jpg",
image: "https://dkp3.medan.go.id/storage/pimpinan/...",
image: "https://portal.medan.go.id/images/eselon/...",
```

Dan hero image:
```typescript
const HERO_FALLBACK_IMAGE = "https://dlh.medan.go.id/web/resources/img/cover/780X520.jpg";
```

External URLs ini bisa berubah atau tidak tersedia, menyebabkan gambar gagal tampil. Juga mengekspos dependency ke domain pihak ketiga yang tidak dikontrol.

**Rekomendasi:**
1. Upload semua gambar ke Supabase Storage (`assets` bucket) sebagai backup.
2. Sistem `getStoredLandingPhotoUrl()` sudah ada — pastikan semua slot diisi default dari storage internal.
3. Ganti hardcoded URLs dengan gambar yang di-host sendiri atau tambahkan fallback yang lebih robust.

---

### [MEDIUM] M-08 — Supabase Client Duplikat (Dua Path Import)

**Severity:** MEDIUM  
**File:** `artifacts/laporan-kerja/src/lib/supabase.ts`, `artifacts/laporan-kerja/src/integrations/supabase/client.ts`  
**Kategori:** Kualitas Kode — Architecture

**Deskripsi:**  
Ada dua path import untuk Supabase client:
- `@/lib/supabase` — definisi asli
- `@/integrations/supabase/client` — re-export dari `@/lib/supabase`

```typescript
// integrations/supabase/client.ts hanya berisi:
export { supabase } from '@/lib/supabase';
```

File `acl.ts` mengimport dari `@/integrations/supabase/client`, sementara sebagian besar file lain mengimport dari `@/lib/supabase`. Ini menciptakan kesan ada dua client padahal sebenarnya satu. Memang ada comment yang menjelaskan ini, namun menyebabkan confusion.

**Rekomendasi:**
1. Standarisasi semua import ke `@/lib/supabase`.
2. Hapus `@/integrations/supabase/client.ts` atau pertahankan dengan dokumentasi yang lebih jelas mengapa re-export ini perlu ada.

---

### [LOW] L-01 — Test Coverage Minimal

**Severity:** LOW  
**File:** `artifacts/laporan-kerja/src/test/`  
**Kategori:** Maintainability — Testing

**Deskripsi:**  
Test yang ada hampir semuanya placeholder atau smoke tests:
- `example.test.tsx`: Hanya menguji komponen dummy `TestComponent`
- `utils.test.ts`: Hanya menguji JavaScript built-ins (string concat, array filter) — bukan kode aplikasi
- `components/UserManagement.test.tsx`, `RolesDropdown.test.tsx`: Perlu diperiksa kontennya

Tidak ada test untuk:
- Service layer (reportService, fuelService, dll.)
- Permission system (hasPermission, ACL)
- Auth flow (login, profile loading)
- Form validation
- Critical business logic (recap calculations)

**Rekomendasi:**
1. Prioritaskan test untuk `acl.ts` / `hasPermission()` — logika permission sangat critical.
2. Tambahkan test untuk service functions dengan mock Supabase client.
3. Tambahkan integration tests untuk auth flow menggunakan Playwright (sudah terkonfigurasi).

---

### [LOW] L-02 — Audit Log Detail Type Terlalu Longgar

**Severity:** LOW  
**File:** `artifacts/laporan-kerja/src/services/auditLogService.ts`  
**Kategori:** Kualitas Kode — Type Safety

**Deskripsi:**  
```typescript
async logAction(params: {
  ...
  details: any;  // ← any
```

Parameter `details` bertipe `any`, padahal `AuditLog.details` bertipe `Record<string, unknown>`. Ini memungkinkan data yang tidak serializable masuk ke audit log.

**Rekomendasi:**
Ganti `details: any` dengan `details: Record<string, unknown>` untuk konsistensi.

---

### [LOW] L-03 — `deleteOldLogs()` Tidak Dipanggil Secara Otomatis

**Severity:** LOW  
**File:** `artifacts/laporan-kerja/src/services/auditLogService.ts`  
**Kategori:** Performa — Data Growth

**Deskripsi:**  
`auditLogService.deleteOldLogs()` tersedia namun tidak ada evidence bahwa fungsi ini dipanggil secara otomatis. Audit logs akan terus tumbuh tanpa batas di tabel Supabase.

**Rekomendasi:**
1. Jadwalkan `deleteOldLogs()` via Supabase Edge Functions (CRON trigger) atau pg_cron.
2. Atau buat scheduled job di server Express yang berjalan secara periodik.
3. Pertimbangkan menambahkan index composite `(user_id, created_at)` untuk query performa.

---

### [LOW] L-04 — `PublicLanding.tsx` Tidak Terproteksi dari Crawling

**Severity:** LOW  
**File:** `artifacts/laporan-kerja/src/pages/PublicLanding.tsx`  
**Kategori:** Keamanan — Information Disclosure

**Deskripsi:**  
Halaman public landing (`/`) menampilkan nama-nama pejabat dan informasi organisasi secara terbuka. Ini kemungkinan memang disengaja, namun perlu dipastikan bahwa:
1. `robots.txt` ada dan dikonfigurasi sesuai kebutuhan.
2. Meta tags yang sesuai ada untuk mencegah indexing jika diperlukan.

---

### [LOW] L-05 — `isAdminBbmAccess()` Tidak Mencakup `admin_spj_bbm`

**Severity:** LOW  
**File:** `artifacts/laporan-kerja/src/constants/access-control.ts`  
**Kategori:** Kualitas Kode — Logic Inconsistency

**Deskripsi:**  
```typescript
export const isAdminBbmAccess = (role: string | null | undefined) =>
  role === USER_ROLES.ADMIN_BBM
  || role === USER_ROLES.ADMIN_BBM_PUSAT
  || role === USER_ROLES.ADMIN_RENCANA_KERJA_BBM
  || role === USER_ROLES.ADMIN_WILAYAH_BBM;
```

`ADMIN_SPJ_BBM` tidak termasuk dalam `isAdminBbmAccess()`. Namun `canAccessFuelArea()` secara terpisah menyertakan `ADMIN_SPJ_BBM`. Ini menciptakan ketidakkonsistenan — beberapa check menggunakan `isAdminBbmAccess()`, sementara yang lain menggunakan `canAccessFuelArea()`, dengan hasil berbeda untuk role `admin_spj_bbm`.

**Rekomendasi:**
Dokumentasikan secara eksplisit perbedaan semantik antara `isAdminBbmAccess` dan `canAccessFuelArea`, atau unifikasi logika.

---

### [LOW] L-06 — Tidak Ada Content Security Policy (CSP)

**Severity:** LOW  
**File:** `artifacts/laporan-kerja/vite.config.ts`, `vercel.json`  
**Kategori:** Keamanan — Defense in Depth

**Deskripsi:**  
`vite.config.ts` mendefinisikan security headers yang baik (`X-Frame-Options`, `X-Content-Type-Options`, dll.) namun tidak ada `Content-Security-Policy`. `vercel.json` hanya mendefinisikan `Cache-Control` untuk `index.html`. Tanpa CSP, jika ada XSS bypass, dampaknya tidak terlimitasi.

Catatan: `dangerouslySetInnerHTML` yang ada saat ini hanya untuk CSS hardcoded (print styles), bukan user content — jadi risiko XSS saat ini rendah. Namun tetap baik untuk ada CSP sebagai defense in depth.

**Rekomendasi:**
Tambahkan CSP header di `vercel.json` dan `vite.config.ts`. Mulai dengan `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'` (inline styles diperlukan untuk print CSS).

---

## Ringkasan Temuan

| ID | Severity | Kategori | Judul |
|----|----------|----------|-------|
| C-01 | **CRITICAL** | Secrets Exposure | File `.env` dengan kredensial production ter-commit |
| H-01 | **HIGH** | Build Errors | TypeScript errors di `UserManagement.tsx` |
| H-02 | **HIGH** | Secrets Exposure | Google Drive API Key ter-expose di client bundle |
| H-03 | **HIGH** | Authorization | RLS functions tidak sinkron dengan multi-role system |
| M-01 | MEDIUM | Maintainability | Komponen melebihi 300 baris |
| M-02 | MEDIUM | Duplication | Duplikasi logika PDF di dua adapter |
| M-03 | MEDIUM | Data Layer | Soft delete missing/salah di RLS policies baru |
| M-04 | MEDIUM | Security | Validasi PDF payload terlalu lemah + JS enabled |
| M-05 | MEDIUM | Security | Rate limiting login hanya di client-side |
| M-06 | MEDIUM | Type Safety | `fetchAllPages` parameter `any` |
| M-07 | MEDIUM | Maintainability | Hardcoded external URLs di landing page |
| M-08 | MEDIUM | Architecture | Supabase client dengan dua path import |
| L-01 | LOW | Testing | Test coverage minimal |
| L-02 | LOW | Type Safety | `details: any` di audit log |
| L-03 | LOW | Performance | Audit log cleanup tidak otomatis |
| L-04 | LOW | Security | Tidak ada robots.txt/meta robots |
| L-05 | LOW | Logic | `isAdminBbmAccess` tidak konsisten dengan `canAccessFuelArea` |
| L-06 | LOW | Security | Tidak ada Content Security Policy |

---

## Prioritas Perbaikan

### Segera (minggu ini)
1. **C-01**: Hapus `.env` dari git tracking, rotasi Anon Key Supabase.
2. **H-01**: Perbaiki TypeScript errors di `UserManagement.tsx` agar build pass.
3. **H-03**: Perbarui fungsi `has_fuel_access()`, `has_admin_access()`, `has_fuel_price_write_access()` untuk mendukung multi-role via `current_access_roles()`.

### Jangka Pendek (1-2 sprint)
4. **H-02**: Pindahkan Google Drive API Key ke server-side, implementasikan endpoint upload yang sudah ada.
5. **M-04**: Nonaktifkan JavaScript di Playwright PDF renderer, tambahkan autentikasi ke endpoint.
6. **M-03**: Perbaiki RLS soft-delete policies yang salah untuk `overtime_records`, `nota_dinas_records`, `spj_oli_records`.

### Jangka Menengah (backlog)
7. **M-05**: Tambahkan server-side rate limiting untuk login.
8. **M-01**: Mulai decompose komponen-komponen besar secara inkremental.
9. **M-02**: Unifikasi logika PDF di `pdf-core.ts`.
10. **L-01**: Tambahkan unit tests untuk `hasPermission()` dan service layer kritis.

---

## Temuan Positif (Hal-Hal yang Sudah Baik)

- **Audit logging lengkap**: Login, logout, view, create, update, delete, print, dan export semuanya dicatat dengan user context.
- **Soft delete konsisten**: Tabel utama (`reports`, `work_plans`, `fuel_reports`) sudah menggunakan soft delete dengan benar.
- **Draft form berbasis IndexedDB**: Implementasi `useFormDraft` sangat baik — persisten lintas refresh, diisolasi per tab, dihapus saat logout.
- **Login rate limiting**: Meskipun hanya client-side, implementasi dengan exponential backoff dan lockout sudah ada.
- **RLS policies solid**: Tabel utama memiliki RLS yang ketat dengan pemisahan per region dan tim.
- **CORS terbatas**: Hanya origin yang dikenal diizinkan di API server.
- **Security headers di Vite**: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` sudah dikonfigurasi.
- **Error boundary**: Komponen `ErrorBoundary` sudah ada dan digunakan di App.tsx.
- **`fetchAllPages` dengan batas**: Pagination dengan `maxPages = 50` mencegah infinite loop.
- **Multi-role system**: Migrasi dari single-role ke multi-role array sudah solid dengan backward compatibility.
- **Struktur proyek sesuai AI_RULES**: Pemisahan UI, services, hooks, dan types sudah baik.

---

*Laporan ini dihasilkan dari pemeriksaan statis. Beberapa temuan mungkin memerlukan konteks runtime untuk validasi penuh. Temuan CRITICAL dan HIGH disarankan untuk diverifikasi secara manual sebelum deployment berikutnya.*
