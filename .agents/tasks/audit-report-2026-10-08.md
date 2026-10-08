# LAPORAN AUDIT KODE PROFESIONAL
## Sistem Laporan Kerja — Dinas Lingkungan Hidup Kota Medan
**Tanggal Audit:** 8 Oktober 2026  
**Auditor:** AI Code Auditor (Deep Review)  
**Scope:** Seluruh source code — `artifacts/laporan-kerja` (React/Vite/TypeScript) + `artifacts/api-server` (Express/Node/TypeScript)

---

## RINGKASAN EKSEKUTIF

Sistem ini adalah aplikasi web internal berbasis React + Supabase untuk pengelolaan laporan kerja harian, BBM, rencana kerja, lembur, SPJ Oli, dan Nota Dinas di Dinas Lingkungan Hidup Kota Medan. Arsitektur sudah cukup matang dengan RLS Supabase, RBAC berlapis, audit log, soft-delete, dan form draft persistence. Namun ditemukan **satu temuan CRITICAL** dan beberapa temuan HIGH yang perlu segera ditangani.

### Scorecard

| Dimensi | Skor | Catatan |
|---|---|---|
| **Security** | **52/100** | .env dengan kredensial nyata ter-commit ke repo; CORS terbuka di API server |
| **Code Quality** | **72/100** | Duplikasi logika RLS; beberapa komponen sangat besar; `any` types |
| **Performance** | **75/100** | fetchAllPages baik; masih ada potensi N+1 di audit log; bukan masalah kritis |
| **Architecture** | **78/100** | Pemisahan concerns cukup baik; permission matrix ganda perlu sync manual |

---

## TEMUAN LENGKAP (Diurutkan dari Severity Tertinggi)

---

### [CRIT-001] ✅ DITUTUP — TIDAK TERBUKTI
**File:** `artifacts/laporan-kerja/.env`  
**Kategori:** Exposed Secrets / Hardcoded Credentials  
**Status:** Diverifikasi 8 Oktober 2026 — **file .env TIDAK ter-commit ke Git**

**Hasil Verifikasi:**  
```
$ git ls-files artifacts/laporan-kerja/.env
(output kosong — file tidak ditrack)

$ git ls-files --error-unmatch artifacts/laporan-kerja/.env
error: pathspec did not match any file(s) known to git

$ git ls-files | grep env
artifacts/laporan-kerja/.env.example   ← hanya .example yang ter-track
artifacts/laporan-kerja/src/vite-env.d.ts
```

File `.env` berisi credentials nyata **ada di working directory** (dibuat lokal saat development) tapi tidak pernah di-`git add`. `.gitignore` di root sudah mencakup `.env` dan `.env.*.local` — proteksi sudah berjalan dengan benar.

**Tidak diperlukan tindakan lebih lanjut.**  
Praktik yang sudah benar: `.env.example` sebagai template ter-commit, `.env` asli terlindungi oleh `.gitignore`.

---

### [HIGH-001] 🟠 HIGH — KEAMANAN
**File:** `artifacts/api-server/src/app.ts`, baris ~15  
**Kategori:** CORS Misconfiguration  

**Deskripsi:**  
Express API server menggunakan `cors()` tanpa konfigurasi:

```typescript
app.use(cors());
```

Ini mengizinkan **semua origin** untuk membuat request ke API server, termasuk endpoint `/api/render-pdf` yang menerima HTML mentah dan merender-nya via browser headless (Playwright).

**Dampak:**  
- Situs web jahat dapat mengirim HTML arbitrary ke `/api/render-pdf` dan menggunakannya sebagai layanan PDF rendering gratis atau untuk SSRF (Server-Side Request Forgery) jika browser Playwright mengakses resource intranet.
- Jika API server terekspos publik (bukan hanya localhost), ini adalah attack surface nyata.

**Rekomendasi:**  
```typescript
app.use(cors({
  origin: [
    'https://laporanbulanan.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
  ],
  methods: ['POST', 'GET'],
}));
```
Perhatikan bahwa Edge Function `create-user/index.ts` sudah melakukan CORS allowlist dengan benar — samakan pola ini di API server.

---

### [HIGH-002] 🟠 HIGH — KEAMANAN
**File:** `artifacts/api-server/src/routes/pdf.ts`, baris ~15–50  
**Kategori:** Missing Authentication + Potential SSRF/Abuse  

**Deskripsi:**  
Endpoint `POST /api/render-pdf` tidak melakukan **autentikasi apapun**. Siapa saja yang bisa mencapai server ini dapat mengirim HTML arbitrary dan mendapatkan PDF.

```typescript
router.post("/render-pdf", async (req, res) => {
  const { documentHtml, fileName } = req.body ?? {};
  // Tidak ada cek sesi/token
```

`validatePdfPayload` hanya memeriksa ukuran dan keberadaan class CSS `.recap-print-area` — sangat mudah di-bypass.

**Dampak:**  
- Penyalahgunaan server untuk rendering PDF arbitrary (CPU abuse).
- Playwright yang dipakai mengaktifkan JavaScript (`// JavaScript diaktifkan agar Playwright bisa menerapkan style cetak`), artinya HTML yang dikirim bisa berisi `<script>` yang dieksekusi di konteks browser server.

**Catatan positif:** `validatePdfPayload` di `pdf-core.ts` membatasi ukuran hingga 10MB dan mengecek keberadaan string `recap-print-area` — ini merupakan defense-in-depth yang baik, tapi tidak cukup sebagai pengganti auth.

**Rekomendasi:**  
Tambahkan middleware validasi token Supabase sebelum endpoint PDF:
```typescript
import { createClient } from '@supabase/supabase-js';
// Di middleware: cek Authorization header, verifikasi dengan supabase.auth.getUser()
```
Atau gunakan shared secret `INTERNAL_PDF_KEY` di environment variable yang dicocokkan antara frontend dan API server.

---

### [HIGH-003] 🟠 HIGH — KEAMANAN  
**File:** `artifacts/laporan-kerja/supabase/migrations/20260811_harden_rls_policies.sql`  
**Kategori:** RLS Gap / Stale Policy Functions  

**Deskripsi:**  
Fungsi RLS `has_record_access()` di database masih memuat role-role lama yang sudah **tidak ada di aplikasi**:

```sql
when public.current_access_role() = 'admin_harian' then ...
when public.current_access_role() in (
  'admin_laporan_mingguan',
  'admin_laporan_bulanan',
  ...
)
```

Sementara aplikasi sudah menggunakan role-role baru seperti `admin_wilayah`, `admin_bbm`, `admin_spj_oli`, dll. Fungsi `has_fuel_access()` hanya mendukung `admin` dan `pimpinan` dan `admin_bbm` — role baru seperti `admin_bbm_pusat`, `admin_laporan_bbm`, `admin_wilayah_bbm`, `admin_rencana_kerja_bbm` **tidak terdaftar** di fungsi RLS ini.

**Dampak:**  
- User dengan role baru mungkin tidak mendapat akses sesuai yang diharapkan karena fungsi RLS jatuh ke `else false`.
- Bergantung pada migrasi-migrasi berikutnya (ada 40+ migrasi) yang mungkin sudah memperbaiki ini, tapi file yang dibaca adalah "harden" migration dan masih mengandung role lama.
- **Defense gap**: permission di frontend (permissions.ts) dan RLS di database bisa tidak sinkron.

**Rekomendasi:**  
- Audit dan sinkronkan fungsi `has_record_access()`, `has_fuel_access()` di database dengan daftar role terkini di `src/constants/access-control.ts`.
- Pertimbangkan membuat migration tersendiri yang hanya memperbarui fungsi-fungsi ini setiap kali role baru ditambahkan.

---

### [HIGH-004] 🟠 HIGH — BUG / LOGIC ERROR
**File:** `artifacts/laporan-kerja/src/context/AuthContext.tsx`, baris ~47  
**Kategori:** Missing cleanup di useEffect / Race Condition  

**Deskripsi:**  
`fetchProfile` memiliki guard `fetchingProfileRef` untuk mencegah concurrent invocations, tetapi terdapat jendela waktu kecil antara `setLoading(true)` dan pengecekan ref:

```typescript
const fetchProfile = async (userId: string) => {
  if (fetchingProfileRef.current === userId) return; // (1) guard
  fetchingProfileRef.current = userId;               // (2) set ownership
  setLoading(true);
  // ... async gap ...
```

Di antara (1) dan (2), apabila `onAuthStateChange` memanggil `fetchProfile` dua kali bersamaan (bisa terjadi pada sesi restore + SIGNED_IN event bersamaan), kedua invokasi bisa melewati guard sebelum salah satunya meng-set ref.

Selain itu, ketika `signOut()` dipanggil saat fetch sedang berjalan:

```typescript
const signOut = async () => {
  fetchingProfileRef.current = null; // reset ref
  // ...
  await supabase.auth.signOut(); // ini trigger onAuthStateChange
};
```

`onAuthStateChange` akan memanggil `setProfile(null)` dan `setLoading(false)`, tapi invokasi `fetchProfile` yang masih berjalan di background juga akan mencoba memanggil `setLoading(false)` di cleanup-nya — duplikat setState yang tidak berbahaya tapi menunjukkan logika yang rapuh.

**Dampak:** Kemungkinan kecil tapi ada: loading state bisa terjebak `true` atau profil null-state tidak ter-set dengan benar, menyebabkan aplikasi tersangkut di layar "Memuat...".

**Rekomendasi:**  
Gunakan `AbortController` atau `useRef` flag `cancelled` yang diset di cleanup function useEffect, bukan ref yang dishare antar calls. Pattern yang lebih aman:
```typescript
useEffect(() => {
  let cancelled = false;
  const run = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (cancelled) return;
    // ...
  };
  run();
  return () => { cancelled = true; };
}, []);
```

---

### [HIGH-005] 🟠 HIGH — KEAMANAN
**File:** `artifacts/laporan-kerja/src/components/AuthorizeRoute.tsx`, baris ~50–75  
**Kategori:** Client-side-only Authorization (Authorization bypass risk)  

**Deskripsi:**  
`AuthorizeRoute` melakukan **client-side permission check** menggunakan `hasPermission()` yang merupakan fungsi pure JavaScript. Authorization ini tidak divalidasi ulang di server (RLS).

```typescript
const allowed = hasPermission(ctx, resource, action);
if (!cancelled) {
  setAuthorizing(false);
  if (allowed) { setAuthorized(true); }
  // ...
}
```

Jika user berhasil memanipulasi state `profile` di browser (atau memanggil Supabase API langsung tanpa melalui frontend), permission check di sini tidak relevan.

**Catatan penting:** Proteksi nyata ada di RLS database (Supabase). Temuan ini bukan berarti ada direct bypass, tapi **architecture-nya bergantung pada RLS yang benar** (lihat HIGH-003 tentang RLS gap).

**Dampak:** Jika RLS ada celah (HIGH-003), client-side auth tidak memberikan perlindungan tambahan yang berarti.

**Rekomendasi:**  
- Pastikan RLS database sudah benar-benar ketat (HIGH-003 harus diperbaiki terlebih dahulu).
- Client-side routing guard seperti ini dianggap UX improvement bukan security layer — dokumentasikan ini dengan jelas.
- Pertimbangkan menambah server-side validation di Edge Functions untuk operasi sensitif (create/delete user, dll).

---

### [HIGH-006] 🟠 HIGH — BUG
**File:** `artifacts/laporan-kerja/src/pages/FuelReportList.tsx`, baris ~200  
**Kategori:** `useEffect` dependency yang tidak lengkap / Potential stale data  

**Deskripsi:**  
Di `FuelReportList.tsx`, `loadReports` didefinisikan sebagai fungsi biasa (bukan `useCallback`) tapi dipanggil dari dalam `useEffect`:

```typescript
useEffect(() => {
  if (!profile || !session) return;
  if (!isAllowed) return;
  loadReports(appliedDate, appliedMonth, appliedYear);
}, [profile, session, isAllowed, appliedDate, appliedMonth, appliedYear, fuelRegionId, reportType]);
```

`loadReports` sendiri **tidak ada di dependency array** padahal merupakan fungsi yang dibuat ulang setiap render dan mengandalkan closure atas `fuelRegionId`, `reportType`, dll. Ini dapat menyebabkan closure stale jika `fuelRegionId` berubah.

Fungsi `loadReports` juga langsung dipanggil dalam beberapa event handler tanpa proteksi dari race condition (misalnya pengguna mengubah filter cepat-cepat). Ada `reqIdRef` tapi tidak di-use secara konsisten di semua code path.

**Dampak:** Data lama bisa muncul sesaat ketika filter diganti cepat, terutama pada koneksi lambat.

**Rekomendasi:**  
Wrap `loadReports` dengan `useCallback` dan masukkan ke dependency array, atau gunakan `useQuery` dari TanStack Query (sudah diinstall) untuk data fetching yang lebih terstruktur.

---

### [MED-001] 🟡 MEDIUM — KEAMANAN
**File:** `artifacts/laporan-kerja/supabase/functions/create-user/index.ts`, baris ~17  
**Kategori:** CORS Allowlist tidak mencakup semua origin yang valid  

**Deskripsi:**  
```typescript
const ALLOWED_ORIGINS = [
  'https://laporanbulanan.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];
```

Jika domain production Vercel berubah atau ada subdomain baru (custom domain), Edge Function akan menolak request dan fallback ke `ALLOWED_ORIGINS[0]`. Tidak ada mekanisme konfigurasi dinamis via environment variable.

**Dampak:** Fungsi ini bisa tiba-tiba berhenti bekerja jika domain berubah, memerlukan re-deploy manual.

**Rekomendasi:**  
```typescript
const getAllowedOrigins = () => {
  const env = Deno.env.get('ALLOWED_ORIGINS');
  if (env) return env.split(',').map(o => o.trim());
  return ['https://laporanbulanan.vercel.app', 'http://localhost:5173'];
};
```

---

### [MED-002] 🟡 MEDIUM — KEAMANAN
**File:** `artifacts/laporan-kerja/src/services/storageService.ts`, baris ~13  
**Kategori:** Insufficient Path Traversal Protection  

**Deskripsi:**  
`sanitizeFileName` membuang path separator dan karakter tidak aman, **tapi** mengizinkan karakter `.`:

```typescript
return basename.replace(/[^a-zA-Z0-9_\-\.]/g, '_').slice(0, 100);
```

Nama file seperti `...` atau `..hidden` masih bisa lolos. Meskipun Supabase Storage memiliki perlindungan di sisi server, defense-in-depth di sisi client lebih baik.

Lebih kritis: URL yang di-extract dari `publicUrl` untuk keperluan delete tidak divalidasi. Jika URL dari database sudah dimanipulasi (misalnya melalui XSS), path traversal bisa terjadi saat delete.

**Dampak:** Potensi delete file di luar bucket yang diharapkan jika URL sudah termodifikasi.

**Rekomendasi:**  
```typescript
// Validasi bahwa URL berasal dari domain Supabase yang dikenal
if (!url.startsWith(supabaseUrl)) {
  console.warn('[storage] URL tidak valid untuk delete:', url);
  return;
}
```

---

### [MED-003] 🟡 MEDIUM — BUG / LOGIC
**File:** `artifacts/laporan-kerja/src/services/auditLogService.ts`, baris ~50  
**Kategori:** `details` parameter bertipe `any`  

**Deskripsi:**  
Parameter `details` di `logAction` diberi tipe `any`:

```typescript
async logAction(params: {
  // ...
  details: any;  // ← tidak aman
```

Ini memungkinkan pengiriman data sensitif ke `audit_logs` tanpa disadari — misalnya seluruh objek profile atau session JWT.

**Dampak:** Potensi data leakage ke tabel audit_logs jika pemanggil tidak hati-hati.

**Rekomendasi:**  
```typescript
details: Record<string, string | number | boolean | null | undefined>;
```

---

### [MED-004] 🟡 MEDIUM — KEAMANAN
**File:** `artifacts/laporan-kerja/src/pages/Login.tsx`, baris ~130  
**Kategori:** Client-side Rate Limiting via sessionStorage (Bypassable)  

**Deskripsi:**  
Rate limiting login menggunakan `sessionStorage`:

```typescript
const STORAGE_KEY_FAIL_COUNT = 'dlh:login:failCount';
const STORAGE_KEY_LOCKED_UNTIL = 'dlh:login:lockedUntil';
```

`sessionStorage` dapat dibersihkan atau dimanipulasi oleh pengguna/skrip browser dalam 2 detik (buka DevTools → Application → sessionStorage → Clear All).

**Dampak:** Proteksi brute force login dapat di-bypass dengan membersihkan sessionStorage, memungkinkan serangan brute force tanpa throttle.

**Catatan positif:** Supabase Auth sendiri memiliki built-in rate limiting di sisi server — ini adalah layer pertahanan tambahan bukan satu-satunya.

**Rekomendasi:**  
- Implementasikan server-side rate limiting di Edge Function atau percayakan sepenuhnya pada Supabase Auth built-in protection.
- Dokumentasikan bahwa rate limiting ini hanya berfungsi sebagai UX deterrent, bukan security control.

---

### [MED-005] 🟡 MEDIUM — BUG / ASYNC
**File:** `artifacts/laporan-kerja/src/services/auditLogService.ts`, baris ~20  
**Kategori:** Unhandled Promise / Fire-and-forget tanpa error propagation  

**Deskripsi:**  
Seluruh pemanggilan `auditLogService.logCurrentUser()` di services menggunakan `void`:

```typescript
void auditLogService.logCurrentUser({ action: 'CREATE', ... });
```

Ini berarti error dari audit log silently swallowed. Meskipun ini disengaja (audit log tidak boleh memblok operasi utama), `console.error` di dalam catch block merupakan satu-satunya cara mendeteksi masalah.

Lebih bermasalah: `logAction` memanggil `supabase.auth.getUser()` dan `supabase.from('profiles').select('role')` **setiap kali** dipanggil dari services yang tidak menyediakan `userId`:

```typescript
// Fallback: ambil dari DB jika data tidak disediakan
const { data: { user } } = await supabase.auth.getUser();
// ...
const { data: profile } = await supabase.from('profiles').select('username, role').eq('id', user.id)...
```

Ini menciptakan **N+1 pattern** — setiap CREATE/UPDATE/DELETE menghasilkan 2 query tambahan untuk audit log.

**Dampak:** Performance degradation pada operasi bulk; kegagalan DB saat audit bisa memperlambat UX (meskipun tidak memblok).

**Rekomendasi:**  
Propagasi `userId`, `username`, `userEmail`, `role` dari context ke semua service calls. Ini sudah sebagian dilakukan (parameter opsional ada), tapi tidak konsisten digunakan.

---

### [MED-006] 🟡 MEDIUM — ARSITEKTUR
**File:** `artifacts/laporan-kerja/src/constants/permissions.ts` vs `supabase/migrations/20260811_harden_rls_policies.sql`  
**Kategori:** Permission Matrix Ganda yang Harus Di-sync Manual  

**Deskripsi:**  
Ada **dua sumber kebenaran** untuk aturan akses:
1. `permissions.ts` + `acl.ts` — untuk client-side routing dan UI gating
2. SQL functions `has_record_access()`, `has_fuel_access()` — untuk database RLS

Keduanya mendefinisikan logika akses per role secara terpisah dan harus selalu sinkron. Saat ini sudah ada gap (HIGH-003): role-role baru di permissions.ts tidak sepenuhnya tercermin di SQL functions.

**Dampak:** Setiap penambahan role baru atau perubahan permission memerlukan update di dua tempat yang berbeda — berpotensi menjadi sumber bug yang sulit di-trace.

**Rekomendasi:**  
Pertimbangkan menggunakan custom claims atau JWT-based RLS yang memanfaatkan metadata user di Supabase Auth. Atau, buat "permission manifest" tunggal (JSON/YAML) yang di-generate menjadi keduanya (TypeScript dan SQL migration).

---

### [MED-007] 🟡 MEDIUM — KEAMANAN
**File:** `artifacts/laporan-kerja/src/components/UserManagement.tsx`, baris ~215  
**Kategori:** Password Dikirim ke Edge Function Tanpa Enkripsi Tambahan  

**Deskripsi:**  
Password user baru dikirim sebagai plaintext di body JSON ke Edge Function `create-user`:

```typescript
const { data, error } = await supabase.functions.invoke('create-user', {
  body: {
    // ...
    password: newUser.password,
  },
});
```

Meskipun komunikasi menggunakan HTTPS (terenkripsi), password muncul di request body yang di-log oleh pino-http jika logging tidak dikonfigurasi untuk mengecualikannya.

**Dampak:** Password bisa muncul di server logs jika logging tidak diatur dengan benar.

**Rekomendasi:**  
- Pastikan body logging dinonaktifkan di pino-http (sudah dikonfigurasi hanya log method/url, bukan body — ini sudah benar di app.ts).
- Di Edge Function, pertimbangkan menerima password yang sudah di-hash sisi client, atau langsung menggunakan Supabase Admin API tanpa melalui intermediary.

---

### [LOW-001] 🔵 LOW — KUALITAS KODE
**File:** `artifacts/laporan-kerja/src/components/UserManagement.tsx`  
**Kategori:** God Component (>600 baris)  

**Deskripsi:**  
`UserManagement.tsx` memiliki lebih dari 600 baris kode dan menggabungkan: fetch data, create form, edit form, view detail dialog, toggle active, reset password, delete, search, dan tabel. Ini melanggar prinsip Single Responsibility.

**Dampak:** Sulit di-maintain, sulit di-test, mudah terjadi konflik merge.

**Rekomendasi:**  
Pisahkan ke sub-komponen: `CreateUserForm`, `EditUserDialog`, `UserDetailDialog`, `UserTable`.

---

### [LOW-002] 🔵 LOW — KUALITAS KODE
**File:** `artifacts/laporan-kerja/src/components/ReportForm.tsx`, `FuelReportForm.tsx`  
**Kategori:** God Components + Hardcoded Magic Strings  

**Deskripsi:**  
`ReportForm.tsx` dan `FuelReportForm.tsx` masing-masing memiliki ratusan baris. Terdapat hardcoded coordinator mappings di `ReportForm.tsx`:

```typescript
const coordinatorMapping: Record<string, string> = {
  "Taman Kota": "Mhd. Said",
  "Taman Area": "Ismail Siregar",
  // ...
};
```

Data ini seharusnya berasal dari database atau setidaknya dari file konfigurasi terpisah, bukan hardcoded di komponen.

**Dampak:** Perubahan nama koordinator memerlukan deployment ulang frontend.

**Rekomendasi:**  
Pindahkan mapping ini ke tabel database `teams` atau ke file konstanta terpisah `src/constants/coordinator-mapping.ts`.

---

### [LOW-003] 🔵 LOW — PERFORMA
**File:** `artifacts/laporan-kerja/src/utils/image-processor.ts`  
**Kategori:** Missing cleanup di Canvas  

**Deskripsi:**  
`compressImage` membuat Canvas element tapi tidak pernah menghapusnya. Browser biasanya membatasi jumlah canvas aktif:

```typescript
const canvas = document.createElement('canvas');
// ... gunakan canvas ...
const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
// canvas tidak pernah di-remove atau di-null-kan
```

**Dampak:** Pada formulir dengan banyak foto (laporan harian bisa 6+ foto), memory leak kecil bisa terjadi di browser lama.

**Rekomendasi:**  
```typescript
// Setelah selesai:
canvas.width = 0;
canvas.height = 0;
```

---

### [LOW-004] 🔵 LOW — KUALITAS KODE
**File:** `artifacts/laporan-kerja/src/services/fuelService.ts`, baris ~15  
**Kategori:** `any` type untuk Supabase query builder  

**Deskripsi:**  
Parameter `buildQuery` di `fetchFuelReports` bertipe `any`:

```typescript
const fetchFuelReports = async (
  buildQuery: (includeReportType: boolean) => any,
  reportType: FuelReportType | null,
) => {
```

Pattern `any` juga muncul di `fetchAllPages`:
```typescript
export const fetchAllPages = async <T>(
  buildQuery: () => any,
  // ...
```

**Dampak:** TypeScript tidak bisa mendeteksi error jika API Supabase berubah.

**Rekomendasi:**  
Gunakan tipe yang lebih spesifik dari `@supabase/supabase-js`:
```typescript
import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';
buildQuery: () => PostgrestFilterBuilder<any, any, any[]>
```

---

### [LOW-005] 🔵 LOW — KUALITAS KODE
**File:** `artifacts/laporan-kerja/src/components/ReportForm.tsx`, baris ~50  
**Kategori:** Hardcoded Vehicle → Coordinator Mapping  

**Deskripsi:**  
```typescript
const vehicleCoordinatorMapping: Record<string, string> = {
  "BK 8128 A": "M. Irwan Syahputra, SE",
  "BK 9031 J": "Aluddin Gultom",
  // ...
};
```

Nomor polisi kendaraan dan nama koordinator hardcoded di source code.

**Dampak:** Tidak fleksibel, setiap perubahan kendaraan memerlukan deployment ulang.

**Rekomendasi:** Simpan di tabel database `vehicles` atau `team_vehicles`.

---

### [LOW-006] 🔵 LOW — KONFIGURASI
**File:** `artifacts/laporan-kerja/vercel.json`  
**Kategori:** Missing Security Headers di Production  

**Deskripsi:**  
`vercel.json` hanya mengonfigurasi `Cache-Control` untuk `index.html` dan rewrite rule:

```json
{
  "headers": [
    {
      "source": "/index.html",
      "headers": [{ "key": "Cache-Control", "value": "no-store, max-age=0" }]
    }
  ]
}
```

Security headers seperti `X-Frame-Options`, `X-Content-Type-Options`, `Content-Security-Policy` tidak ada di `vercel.json` (meskipun sudah ada di dev server `vite.config.ts`). **Headers dari vite dev server tidak berlaku di production Vercel.**

**Dampak:** Di production, halaman rentan terhadap clickjacking (`X-Frame-Options` tidak set), MIME sniffing, dll.

**Rekomendasi:**  
Tambahkan ke `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" }
      ]
    }
  ]
}
```

---

### [LOW-007] 🔵 LOW — PERFORMA
**File:** `artifacts/laporan-kerja/src/lib/fetchAllPages.ts`  
**Kategori:** Supabase 1000-row cap (sudah diketahui, perlu konsistensi)  

**Deskripsi:**  
Seperti yang sudah didokumentasikan di `.agents/memory/supabase-row-limit.md`, Supabase PostgREST membatasi maksimal 1000 baris per request. `fetchAllPages` mengatasi ini dengan paginasi, tapi efektivitasnya bergantung pada **apakah caller menggunakan date filter**.

Di `reportService.getAllReports()` tanpa filter, `fetchAllPages` akan loop sampai 50 halaman (50.000 baris) — namun Supabase server-side cap akan memotong setiap halaman di 1000 baris. Akibatnya, halaman 2, 3, dst mungkin **tidak pernah berisi data** karena Supabase tidak mengembalikan `has_next_page` indicator.

**Dampak:** `getAllReports()` tanpa filter mungkin hanya mengembalikan 1000 baris terbaru meski ada lebih banyak data — **silent data loss** tanpa error.

**Rekomendasi:**  
- Selalu gunakan `getFilteredReports()` atau `getReportsByDateRange()` yang sudah ada.
- Tambahkan peringatan ke `getAllReports()` agar developer tahu batasan ini.
- Pertimbangkan menaikkan Supabase max-rows di project settings.

---

### [LOW-008] 🔵 LOW — KUALITAS KODE
**File:** `artifacts/laporan-kerja/src/components/ImageUpload.tsx`, baris ~58  
**Kategori:** Missing MIME type validation yang ketat  

**Deskripsi:**  
```typescript
const handleFile = async (file: File) => {
  if (disabled || !file.type.startsWith('image/')) return;
```

`file.type` bergantung pada deklarasi browser, bukan isi file yang sebenarnya. File berbahaya bisa diberi ekstensi `.jpg` dan MIME type `image/jpeg` sementara isinya adalah SVG dengan embedded XSS atau file executable.

**Dampak:** Rendah karena Supabase Storage akan menyimpannya dan browser yang membukanya tidak akan mengeksekusinya, tapi tetap merupakan best practice gap.

**Rekomendasi:**  
Tambahkan validasi magic bytes di sisi client:
```typescript
// Cek header bytes: JPEG = FF D8 FF, PNG = 89 50 4E 47
const buffer = await file.slice(0, 4).arrayBuffer();
const header = Array.from(new Uint8Array(buffer)).map(b => b.toString(16)).join('');
if (!['ffd8ff', '89504e47'].some(magic => header.startsWith(magic))) {
  showError('File bukan gambar yang valid');
  return;
}
```

---

### [INFO-001] ℹ️ INFO — ARSITEKTUR POSITIF
**File:** `artifacts/laporan-kerja/src/hooks/useFormDraft.ts`  

Form draft persistence menggunakan IndexedDB dengan tab isolation, expiry 14 hari, dan cleanup saat signout — implementasi yang sangat baik dan thoughtful.

---

### [INFO-002] ℹ️ INFO — ARSITEKTUR POSITIF
**File:** `artifacts/laporan-kerja/src/context/AuthContext.tsx`  

Race condition guard menggunakan `fetchingProfileRef` dan 2-attempt retry untuk fetch profile — pattern yang baik.

---

### [INFO-003] ℹ️ INFO — ARSITEKTUR POSITIF
**File:** `artifacts/laporan-kerja/src/services/auditLogService.ts`  

Audit log yang komprehensif dengan fallback ke legacy schema — thoughtful backward compatibility.

---

### [INFO-004] ℹ️ INFO — DEPENDENCY
**File:** `artifacts/laporan-kerja/package.json`  

Package `puppeteer-core` versi `25.6.0` di-pin secara eksplisit — bagus. Namun perlu diperhatikan bahwa `@sparticuz/chromium` (`149.0.0`) ada di **kedua** `artifacts/laporan-kerja/package.json` (dependencies) DAN `root package.json` (dependencies) — ini adalah **duplikasi yang tidak perlu**. Di production Vercel, yang digunakan adalah `api/render-pdf.ts`, bukan api-server. Chromium hanya perlu ada di laporan-kerja.

---

### [INFO-005] ℹ️ INFO — KONFIGURASI
**File:** `artifacts/laporan-kerja/.replit-artifact/artifact.toml`  

Tidak dibaca karena file config Replit, tapi perlu dipastikan bahwa `.replit` tidak berisi secrets atau konfigurasi yang berbeda dengan production.

---

## RINGKASAN PRIORITAS PERBAIKAN

| Prioritas | ID | Deskripsi Singkat | Effort |
|---|---|---|---|
| ✅ DITUTUP | CRIT-001 | .env tidak ter-commit — tidak ada tindakan diperlukan | — |
| 🟠 PENTING | HIGH-001 | Batasi CORS di API server | Rendah |
| 🟠 PENTING | HIGH-002 | Tambah autentikasi ke endpoint `/api/render-pdf` | Sedang |
| 🟠 PENTING | HIGH-003 | Sinkronkan RLS SQL functions dengan role terbaru | Sedang |
| 🟠 PENTING | HIGH-006 | Perbaiki stale closure di FuelReportList useEffect | Rendah |
| 🟡 MEDIUM | LOW-006 | Tambah security headers ke vercel.json | Rendah |
| 🟡 MEDIUM | MED-001 | Buat CORS allowed origins configurable via env | Rendah |
| 🟡 MEDIUM | MED-005 | Kurangi N+1 di auditLogService | Sedang |
| 🔵 LOW | LOW-001,002 | Refactor God Components | Tinggi |

---

## KESIMPULAN

Kode secara keseluruhan ditulis dengan cukup baik dan mengikuti best practice modern (TypeScript, RLS Supabase, soft-delete, audit trail, form draft persistence, rate limiting). Tim pengembang jelas berpengalaman. Namun ada **satu masalah critical** (credential leak di Git) dan **dua masalah high** (CORS terbuka + missing auth di PDF endpoint) yang harus diperbaiki sebelum deployment selanjutnya ke production.

Masalah terbesar secara arsitektur adalah **dua sumber kebenaran untuk permission rules** (TypeScript + SQL) yang harus di-sync manual — ini adalah technical debt yang akan terus menghasilkan bug security jika tidak diatasi sistematis.

---

*Laporan ini dihasilkan dari pembacaan source code secara menyeluruh pada 8 Oktober 2026.*  
*Total file yang dibaca: 45+ source files.*
