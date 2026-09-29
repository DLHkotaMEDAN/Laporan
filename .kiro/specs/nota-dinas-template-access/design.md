# Nota Dinas Template Access Control Bugfix Design

## Overview

Dua bug akses ditemukan pada fitur Pengaturan Template Nota Dinas:

1. **`NotaDinasTemplateManagement` (di Maintenance)**: komponen tidak menggunakan `useAuth()`, sehingga tidak ada pemeriksaan hak akses sama sekali. Siapa pun dapat membuka tab "Template Nota" dan mengubah template wilayah mana pun — termasuk template global. Perbaikan: tambahkan guard super admin dan kunci `regionId` ke `null` (global), hapus dropdown pilihan wilayah.

2. **`NotaDinasTemplate.tsx` (halaman `/nota-dinas/template`)**: super admin dikunci ke `regionId = null` karena kondisi `isRegionalAdmin && !isSuperAdmin` selalu `false` untuk super admin, sehingga `regionId` di-assign dari blok yang tidak pernah terpenuhi. Perbaikan: tambahkan dropdown wilayah khusus untuk super admin (termasuk opsi "Default Global") agar mereka bisa memilih wilayah yang ingin diedit.

Keduanya berdampak pada keamanan dan kegunaan: komponen Maintenance terlalu permisif, halaman standalone terlalu restriktif untuk super admin.

---

## Glossary

- **Bug_Condition (C)**: Kondisi yang memicu bug — (a) pengguna non-super-admin mengakses `NotaDinasTemplateManagement` tanpa hambatan, atau (b) super admin membuka `/nota-dinas/template` dan tidak mendapatkan dropdown wilayah.
- **Property (P)**: Perilaku yang benar setelah perbaikan — guard akses aktif dan dropdown wilayah tersedia untuk super admin.
- **Preservation**: Perilaku yang tidak boleh berubah — `admin_nota_dinas` tetap terkunci ke wilayahnya sendiri, penolakan akses untuk peran lain tetap berjalan, operasi service layer tidak terpengaruh.
- **`isSuperAdminAccess(role, email)`**: Helper dari `@/constants/access-control` yang mengembalikan `true` jika role adalah `'admin'` atau email ada di daftar super admin.
- **`isNotaDinasAdmin(role)`**: Helper yang mengembalikan `true` jika role adalah `'admin_nota_dinas'`.
- **`regionId`**: UUID string untuk template per wilayah, atau `null` untuk template global.
- **`profile.region_id`**: ID wilayah yang terikat pada akun pengguna yang login.

---

## Bug Details

### Bug Condition

**Bug A — `NotaDinasTemplateManagement` tanpa guard akses:**
Komponen tidak memanggil `useAuth()`, sehingga tidak ada pemeriksaan peran. Dropdown wilayah memungkinkan siapa pun memilih dan mengubah template wilayah apa pun.

**Bug B — Super admin terkunci ke global di `/nota-dinas/template`:**
Variabel `regionId` dideklarasikan sebagai:
```
const regionId = isRegionalAdmin && !isSuperAdmin ? (profile?.region_id ?? null) : null;
```
Untuk super admin, `isRegionalAdmin` adalah `false` (kecuali jika mereka juga memegang peran `admin_nota_dinas`), sehingga ekspresi selalu menghasilkan `null`. Tidak ada jalur yang menyediakan dropdown wilayah untuk super admin.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input berupa { role, email, currentPage }
  OUTPUT: boolean

  // Bug A: akses tanpa guard di NotaDinasTemplateManagement
  IF currentPage = "Maintenance/nota-template"
    AND NOT isSuperAdminAccess(role, email)
    AND componentRendersWithoutAccessDenied
  THEN RETURN true

  // Bug B: super admin tidak mendapat dropdown wilayah
  IF currentPage = "/nota-dinas/template"
    AND isSuperAdminAccess(role, email)
    AND regionDropdownNotVisible
  THEN RETURN true

  RETURN false
END FUNCTION
```

### Examples

- **Bug A, Contoh 1**: Pengguna dengan peran `admin_nota_dinas` membuka tab "Template Nota" di Maintenance → komponen tampil penuh, termasuk dropdown wilayah → dapat mengubah template wilayah lain *(salah; seharusnya ditolak atau tidak terlihat)*.
- **Bug A, Contoh 2**: Pengguna dengan peran `user` atau `laporan` membuka tab "Template Nota" → komponen tampil dan berfungsi penuh *(salah; seharusnya ditolak)*.
- **Bug B, Contoh 1**: Super admin membuka `/nota-dinas/template` → hanya melihat template global, tidak ada cara memilih wilayah tertentu → tidak bisa mengedit template per wilayah *(salah; seharusnya ada dropdown wilayah)*.
- **Edge case**: Super admin membuka `/nota-dinas/template` dan memilih "Default Global" dari dropdown → `regionId = null` → perilaku sama seperti sebelumnya *(harus tetap berjalan benar setelah perbaikan)*.

---

## Expected Behavior

### Preservation Requirements

**Perilaku yang tidak boleh berubah:**
- Pengguna dengan peran `admin_nota_dinas` yang membuka `/nota-dinas/template` tetap terkunci ke wilayah mereka sendiri (`profile.region_id`) tanpa dropdown pilihan wilayah.
- Pengguna yang bukan super admin dan bukan `admin_nota_dinas` yang mengakses `/nota-dinas/template` tetap mendapat halaman "Akses ditolak".
- Super admin yang membuka tab "Template Nota" di Maintenance (setelah perbaikan) tetap bisa membuat, mengedit, dan menghapus template global (`regionId = null`).
- `notaDinasTemplateService.save()`, `.deleteTemplate()`, `.setDefault()`, dan `.getTemplatesByKategori()` tidak diubah — layer service tetap identik.
- Pengguna `admin_nota_dinas` di `/nota-dinas/template` hanya bisa menyimpan/menghapus template dengan `regionId` yang sama dengan `profile.region_id` mereka.

**Scope:**
Semua input yang tidak melibatkan kondisi bug — yaitu operasi CRUD biasa oleh pengguna yang berwenang, klik tombol, navigasi antar kategori — harus sepenuhnya tidak terpengaruh oleh perbaikan ini.

---

## Hypothesized Root Cause

Berdasarkan analisis kode:

1. **Tidak ada `useAuth()` di `NotaDinasTemplateManagement`**: Komponen ini ditulis tanpa mengimpor `useAuth`, sehingga tidak ada variabel `profile`, `session`, atau `isSuperAdmin` yang bisa digunakan untuk guard. Akibatnya seluruh UI — termasuk dropdown wilayah — selalu dirender tanpa syarat.

2. **Logika `regionId` di `NotaDinasTemplate.tsx` tidak mencakup super admin**: Kondisi `isRegionalAdmin && !isSuperAdmin` dirancang untuk `admin_nota_dinas`, dan menghasilkan `null` untuk semua kasus lain (termasuk super admin). Tidak ada cabang `else if (isSuperAdmin)` yang menyediakan state `selectedRegionId` dan dropdown wilayah.

3. **Guard di Maintenance hanya memeriksa `isAdmin` di level halaman**: `Maintenance.tsx` sudah memiliki guard `if (!isAdmin) return null`, tetapi `NotaDinasTemplateManagement` yang dirender di dalam tab tidak punya guard sendiri — mengandalkan parent yang tidak selalu bisa diandalkan jika komponen digunakan ulang di tempat lain.

4. **Tidak ada prop untuk mode operasi**: `NotaDinasTemplateManagement` tidak menerima prop `regionId` yang dikunci dari luar — ia mengelola `selectedRegionId`-nya sendiri, membuka celah untuk memilih wilayah manapun.

---

## Correctness Properties

Property 1: Bug Condition A — Guard Akses di NotaDinasTemplateManagement

_For any_ pengguna yang membuka tab "Template Nota" di Maintenance dengan kondisi `isBugCondition` terpenuhi (bukan super admin), fungsi render komponen yang sudah diperbaiki SHALL menampilkan pesan akses ditolak atau tidak merender konten manajemen template, sehingga pengguna tidak dapat melihat atau mengubah template apa pun.

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition B — Dropdown Wilayah untuk Super Admin

_For any_ super admin yang membuka halaman `/nota-dinas/template` dengan kondisi `isBugCondition` terpenuhi (super admin tanpa dropdown wilayah), halaman yang sudah diperbaiki SHALL menampilkan dropdown pilihan wilayah (termasuk opsi "Default Global") sehingga super admin dapat memilih dan mengedit template untuk wilayah mana pun.

**Validates: Requirements 2.3**

Property 3: Preservation — Perilaku Non-Buggy Tidak Berubah

_For any_ input yang TIDAK memenuhi `isBugCondition` — yaitu `admin_nota_dinas` di `/nota-dinas/template`, penolakan akses untuk peran lain, dan operasi CRUD biasa — kode yang sudah diperbaiki SHALL menghasilkan perilaku yang identik dengan kode aslinya, mempertahankan semua fungsionalitas yang ada.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

---

## Fix Implementation

### Changes Required

Berdasarkan analisis root cause di atas:

---

**File**: `src/components/NotaDinasTemplateManagement.tsx`

**Perubahan Spesifik**:

1. **Tambahkan `useAuth` dan import access control**: Import `useAuth` dari `@/context/AuthContext` dan `isSuperAdminAccess` dari `@/constants/access-control`.

2. **Tambahkan guard akses**: Di dalam komponen, panggil `useAuth()` untuk mendapatkan `profile` dan `session`. Hitung `isSuperAdmin = isSuperAdminAccess(profile?.role, session?.user?.email)`. Jika `!isSuperAdmin`, render pesan akses ditolak (atau `null`).

3. **Hapus dropdown wilayah dan state terkait**: Hapus state `regions`, `selectedRegionId`, `useEffect` yang memuat daftar wilayah, dan elemen `<Select>` untuk wilayah. Komponen ini hanya untuk template global.

4. **Kunci `regionId` ke `null`**: Ganti semua referensi ke `selectedRegionId` dengan literal `null` pada panggilan service (`getTemplatesByKategori`, `save`, `handleCreateNew`).

---

**File**: `src/pages/NotaDinasTemplate.tsx`

**Perubahan Spesifik**:

1. **Tambahkan state `selectedRegionId` khusus super admin**: Tambahkan state `const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null)` dan state `const [regions, setRegions] = useState<{ id: string | null; name: string }[]>([])`.

2. **Muat daftar wilayah untuk super admin**: Tambahkan `useEffect` yang hanya berjalan jika `isSuperAdmin` untuk memuat daftar wilayah dari tabel `regions` dan menyusun opsi termasuk "Default Global (`null`)".

3. **Tampilkan dropdown wilayah untuk super admin**: Render elemen `<Select>` pilihan wilayah di bawah info wilayah, hanya jika `isSuperAdmin`.

4. **Perbaiki perhitungan `regionId` aktif**: Ubah logika menjadi:
   ```
   const effectiveRegionId = isSuperAdmin
     ? selectedRegionId           // super admin memilih dari dropdown
     : isRegionalAdmin
       ? (profile?.region_id ?? null)   // admin_nota_dinas dikunci ke wilayahnya
       : null;
   ```
   Gunakan `effectiveRegionId` sebagai pengganti `regionId` di seluruh komponen.

5. **Perbarui teks info wilayah**: Saat `isSuperAdmin && selectedRegionId !== null`, tampilkan nama wilayah yang dipilih. Saat `isSuperAdmin && selectedRegionId === null`, tampilkan "Template Default Global".

---

## Testing Strategy

### Validation Approach

Strategi pengujian mengikuti dua fase: pertama, konfirmasi bug pada kode yang belum diperbaiki dengan test eksploratif; kedua, verifikasi perbaikan dan pastikan tidak ada regresi melalui fix checking dan preservation checking.

---

### Exploratory Bug Condition Checking

**Goal**: Tampilkan counterexample yang membuktikan bug SEBELUM implementasi perbaikan. Konfirmasi atau bantah analisis root cause.

**Test Plan**: Render komponen dengan pengguna mock yang BUKAN super admin, lalu periksa apakah konten manajemen template tetap tampil. Render halaman dengan super admin mock, lalu periksa apakah dropdown wilayah tidak ada.

**Test Cases**:
1. **Akses tanpa auth di NotaDinasTemplateManagement**: Render komponen tanpa `AuthContext` (atau dengan user non-super-admin) → assert bahwa dropdown wilayah dan daftar template TETAP TERRENDER *(akan gagal di kode asli — ini membuktikan bug A)*.
2. **Super admin tanpa dropdown wilayah**: Render `NotaDinasTemplate` dengan super admin mock → assert bahwa elemen dropdown wilayah TIDAK ADA di DOM *(akan gagal di kode asli — ini membuktikan bug B)*.
3. **Non-admin membuka NotaDinasTemplateManagement**: Render dengan peran `laporan` → assert bahwa konten template TERRENDER *(akan gagal di kode asli — ini membuktikan bug A lebih lanjut)*.
4. **Super admin tidak bisa memilih wilayah**: Render `NotaDinasTemplate` dengan super admin → assert `effectiveRegionId` selalu `null` *(edge case — membuktikan super admin tidak bisa beralih ke wilayah tertentu)*.

**Expected Counterexamples**:
- `NotaDinasTemplateManagement` merender UI lengkap untuk semua pengguna tanpa pemeriksaan role.
- `NotaDinasTemplate` tidak memiliki elemen dropdown wilayah untuk super admin di DOM.

---

### Fix Checking

**Goal**: Verifikasi bahwa untuk semua input di mana kondisi bug terpenuhi, fungsi yang sudah diperbaiki menghasilkan perilaku yang benar.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := renderFixedComponent(input)

  IF input.currentPage = "Maintenance/nota-template"
    AND NOT isSuperAdminAccess(input.role, input.email)
  THEN
    ASSERT result CONTAINS accessDeniedMessage
    ASSERT result NOT CONTAINS regionDropdown
    ASSERT result NOT CONTAINS templateList

  IF input.currentPage = "/nota-dinas/template"
    AND isSuperAdminAccess(input.role, input.email)
  THEN
    ASSERT result CONTAINS regionDropdown
    ASSERT regionDropdown.options INCLUDES "Default Global"
    ASSERT regionDropdown.options INCLUDES all regions from DB
END FOR
```

---

### Preservation Checking

**Goal**: Verifikasi bahwa untuk semua input di mana kondisi bug TIDAK terpenuhi, kode yang sudah diperbaiki menghasilkan hasil yang sama dengan kode aslinya.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT fixedComponent(input) = originalComponent(input)
END FOR
```

**Testing Approach**: Property-based testing direkomendasikan untuk preservation checking karena:
- Menghasilkan banyak kasus uji secara otomatis dari domain input yang luas.
- Menangkap edge case yang mungkin terlewat oleh unit test manual.
- Memberikan jaminan kuat bahwa perilaku tidak berubah untuk semua input non-buggy.

**Test Cases**:
1. **`admin_nota_dinas` tetap terkunci ke wilayahnya**: Render `NotaDinasTemplate` dengan peran `admin_nota_dinas` dan `profile.region_id = "uuid-xyz"` → assert dropdown wilayah tidak ada → assert `effectiveRegionId === "uuid-xyz"`.
2. **Penolakan akses tetap berjalan**: Render `NotaDinasTemplate` dengan peran `laporan` → assert komponen menampilkan "Akses ditolak" dan tidak merender form template.
3. **Super admin di Maintenance bisa kelola template global**: Render `NotaDinasTemplateManagement` dengan super admin → assert konten template global tampil → assert tidak ada dropdown wilayah.
4. **Operasi CRUD service tidak berubah**: Mock `notaDinasTemplateService.save()` → panggil `handleSave` → assert service dipanggil dengan parameter yang benar (khususnya `regionId` tidak berubah untuk `admin_nota_dinas`).

---

### Unit Tests

- Test render `NotaDinasTemplateManagement` dengan pengguna super admin → konten tampil, tanpa dropdown wilayah.
- Test render `NotaDinasTemplateManagement` dengan pengguna non-super-admin → "Akses ditolak" tampil, konten tidak tampil.
- Test render `NotaDinasTemplate` dengan super admin → dropdown wilayah tampil, berisi opsi "Default Global" dan daftar wilayah.
- Test render `NotaDinasTemplate` dengan `admin_nota_dinas` → dropdown wilayah tidak tampil, `effectiveRegionId` sesuai `profile.region_id`.
- Test render `NotaDinasTemplate` dengan peran tidak berwenang → "Akses ditolak" tampil.
- Test `effectiveRegionId` berubah saat super admin memilih wilayah dari dropdown.

### Property-Based Tests

- Generate berbagai kombinasi role dan email → verifikasi `isSuperAdminAccess` menentukan visibilitas guard dengan benar di `NotaDinasTemplateManagement`.
- Generate berbagai `selectedRegionId` (null, uuid acak) untuk super admin → verifikasi `effectiveRegionId` selalu mengikuti pilihan dropdown super admin.
- Generate input `profile.region_id` acak untuk `admin_nota_dinas` → verifikasi `effectiveRegionId` selalu menggunakan `profile.region_id`, tidak pernah `selectedRegionId`.
- Generate banyak skenario operasi CRUD → verifikasi `regionId` yang dikirim ke service selalu sesuai `effectiveRegionId` yang aktif, bukan nilai hardcoded.

### Integration Tests

- Test alur lengkap: super admin login → buka Maintenance → tab "Template Nota" → tampil tanpa dropdown wilayah → bisa buat template global.
- Test alur lengkap: non-super-admin login → buka Maintenance → tab "Template Nota" → melihat pesan akses ditolak, tidak bisa mengakses form.
- Test alur lengkap: super admin login → buka `/nota-dinas/template` → dropdown wilayah muncul → pilih wilayah tertentu → template wilayah itu termuat → bisa edit dan simpan.
- Test alur lengkap: `admin_nota_dinas` login → buka `/nota-dinas/template` → tidak ada dropdown wilayah → template wilayah sendiri termuat → tidak bisa mengakses wilayah lain.
- Test switching wilayah oleh super admin: pilih wilayah A → template wilayah A termuat → pilih "Default Global" → template global termuat → tidak ada regresi pada `editingTemplate`.
