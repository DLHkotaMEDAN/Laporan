# Multi-Role Refactor — Progress Report (Iterasi 3)
**Tanggal:** 2026-10-08  
**Status:** Review findings dari iterasi 2 diperbaiki — semua 5 temuan ditutup

---

## File Yang Diubah (Iterasi 3)

| File | Perubahan |
|------|-----------|
| `src/components/OvertimeForm.tsx` | Import `getLoginDestinationRoles`, pakai multi-role fallback di post-save navigate |
| `src/components/ReportForm.tsx` | Import `getLoginDestinationRoles`, pakai multi-role fallback di post-save navigate |
| `src/components/FuelReportForm.tsx` | Import `getLoginDestinationRoles`, pakai multi-role fallback di post-save navigate |
| `src/components/WorkPlanForm.tsx` | Import `getLoginDestinationRoles`, pakai multi-role fallback di post-save navigate (2 lokasi: save + Batal) |
| `src/pages/SpjOli.tsx` | Import `getLoginDestinationRoles`, pakai multi-role fallback di post-save navigate |
| `src/components/UserManagement.tsx` | `handleSaveProfile`: `canSelectRegion` kini pakai `rolesRequireRegion(effectiveRoles)` (multi-role), bukan `roleCanSelectRegion(editUser.role)` (single-role) |
| `src/constants/access-control.ts` | `PERMISSION_REQUIRES_REGION`: hapus `spj_oli` — region opsional untuk spj_oli (konsisten dengan `canAccessAllSpjOliRegions`) |
| `src/constants/permissions.ts` | `ROLE_PERMISSIONS_EXTENDED['rencana_kerja']`: bukan alias ke `ADMIN_RENCANA_KERJA` lagi. Sekarang menggunakan permission dengan region condition (`ctx.regionId === ctx.resourceRegionId`) untuk mencegah privilege escalation work_plans bagi user `admin_wilayah` yang dimigrasi ke `['laporan_kerja','rencana_kerja']` |
| `supabase/functions/create-user/index.ts` | Fix `assignedRegionId` null override: hanya null jika `rencana_kerja`/`ADMIN_RENCANA_KERJA` adalah SATU-SATUNYA role yang region-relevant. Kombinasi `['rencana_kerja','laporan_kerja']` sekarang bisa dibuat dengan region. Hapus `spj_oli` dari `regionRequiredRoles` (konsisten dengan access-control.ts) |

---

## Summary Perubahan Per Temuan

### [1] Post-save navigation broken di 5 form komponen ✅ FIXED
**File:** `ReportForm.tsx`, `WorkPlanForm.tsx`, `FuelReportForm.tsx`, `OvertimeForm.tsx`, `SpjOli.tsx`  
**Perbaikan:** Semua navigate post-save kini memakai pola fallback:
```ts
navigate((profile?.roles && profile.roles.length > 0)
  ? getLoginDestinationRoles(profile.roles)
  : getLoginDestination(profile?.role))
```
Konsisten dengan `Login.tsx` yang sudah diperbaiki di iterasi 2. User baru dengan new permission keys (misalnya `laporan_kerja`) kini diarahkan ke halaman yang benar.

### [2] `handleSaveProfile` persistence region pakai single-role check ✅ FIXED
**File:** `UserManagement.tsx`  
**Perbaikan:** `canSelectRegion` kini dihitung dari multi-role check:
```ts
const canSelectRegion = rolesRequireRegion(effectiveRoles) || roleCanSelectRegion(editUser.role);
```
Sebelumnya: `roleCanSelectRegion(editUser.role)` — single-role. Asimetri antara validasi dan persistence dihilangkan.

### [3] `admin_wilayah` → privilege escalation work_plans ✅ FIXED
**File:** `src/constants/permissions.ts`  
**Perbaikan:** `ROLE_PERMISSIONS_EXTENDED['rencana_kerja']` bukan lagi alias ke `ADMIN_RENCANA_KERJA` (global, tanpa region condition). Kini mendefinisikan permission dengan condition `ctx.regionId === ctx.resourceRegionId`:
```ts
ROLE_PERMISSIONS_EXTENDED['rencana_kerja'] = [
  { resource: 'work_plans', action: 'create' },
  { resource: 'work_plans', action: 'read',   condition: ctx => ctx.regionId === ctx.resourceRegionId },
  { resource: 'work_plans', action: 'update', condition: ctx => ctx.regionId === ctx.resourceRegionId },
  { resource: 'work_plans', action: 'delete', condition: ctx => ctx.regionId === ctx.resourceRegionId },
  { resource: 'profiles',   action: 'read' },
];
```
User `admin_wilayah` yang dimigrasi ke `['laporan_kerja','rencana_kerja']` tetap hanya akses work_plans di wilayah mereka. User yang benar-benar `admin_rencana_kerja` (legacy role) tetap pakai `ROLE_PERMISSIONS[ADMIN_RENCANA_KERJA]` global.

### [4] Edge function `assignedRegionId` null override ✅ FIXED
**File:** `supabase/functions/create-user/index.ts`  
**Perbaikan:** Logic null assignment diubah — hanya null jika `rencana_kerja`/`ADMIN_RENCANA_KERJA` adalah satu-satunya role yang region-relevant:
```ts
const isOnlyRkGlobal =
  effectiveRoles.some(r => r === 'rencana_kerja' || r === USER_ROLES.ADMIN_RENCANA_KERJA) &&
  !effectiveRoles.some(r => regionRequiredRoles.has(r) && r !== 'rencana_kerja' && r !== USER_ROLES.ADMIN_RENCANA_KERJA);
const assignedRegionId = isOnlyRkGlobal ? null : input.regionId;
```
Kombinasi `['rencana_kerja','laporan_kerja']` sekarang bisa dibuat dengan region.

### [5] `spj_oli` region required vs opsional ✅ FIXED
**File:** `src/constants/access-control.ts`, `supabase/functions/create-user/index.ts`  
**Perbaikan:** `spj_oli` dihapus dari `PERMISSION_REQUIRES_REGION` dan dari `regionRequiredRoles` di edge function. Konsisten dengan:
- `canAccessAllSpjOliRegions()` yang memberi akses global jika tidak ada region
- `ROLE_PERMISSIONS[ADMIN_SPJ_OLI]` condition `!ctx.regionId || ctx.regionId === ctx.resourceRegionId`

---

## Hasil TypeScript Check

```
node [tsc path] --noEmit
(no output — zero errors)
```
**Status: CLEAN ✅**

---

## Backward Compat Yang Dijaga

- Kolom `role` lama di DB tidak di-drop
- Fungsi predicate lama (`getLoginDestination`, `roleCanSelectRegion`, dll) tetap ada
- `ROLE_PERMISSIONS` map untuk legacy roles tidak diubah
- `ADMIN_RENCANA_KERJA` legacy role tetap mendapat global work_plans access (melalui `ROLE_PERMISSIONS[USER_ROLES.ADMIN_RENCANA_KERJA]`)
- Hanya `rencana_kerja` (new permission key) yang diberi region-scoped access
