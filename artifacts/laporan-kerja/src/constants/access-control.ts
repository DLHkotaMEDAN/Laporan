export const USER_ROLES = {
  ADMIN: 'admin',
  ADMIN_WILAYAH: 'admin_wilayah',
  ADMIN_WILAYAH_BBM: 'admin_wilayah_bbm',
  LAPORAN: 'laporan',
  ADMIN_RENCANA_KERJA: 'admin_rencana_kerja',
  ADMIN_RENCANA_KERJA_BBM: 'admin_rencana_kerja_bbm',
  ADMIN_REKAP_LEMBUR: 'admin_rekap_lembur',
  ADMIN_BBM: 'admin_bbm',
  ADMIN_BBM_PUSAT: 'admin_bbm_pusat',
  ADMIN_LAPORAN_BBM: 'admin_laporan_bbm',
  ADMIN_SPJ_BBM: 'admin_spj_bbm',
  ADMIN_SPJ_OLI: 'admin_spj_oli',
  ADMIN_NOTA_DINAS: 'admin_nota_dinas',
  PIMPINAN: 'pimpinan',
  USER: 'user',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const USER_ROLE_VALUES = Object.values(USER_ROLES) as readonly UserRole[];

export const ACCESS_OPTIONS: readonly { value: UserRole; label: string }[] = [
  { value: USER_ROLES.ADMIN,               label: 'Super Admin / Administrator' },
  { value: USER_ROLES.ADMIN_SPJ_OLI,       label: 'Admin SPJ Oli (Semua / Per Wilayah)' },
  { value: USER_ROLES.ADMIN_WILAYAH,       label: 'Admin Wilayah (Laporan & Rencana Kerja)' },
  { value: USER_ROLES.ADMIN_WILAYAH_BBM,   label: 'Admin Wilayah (Laporan & Rencana Kerja) + Admin BBM' },
  { value: USER_ROLES.LAPORAN,             label: 'Laporan' },
  { value: USER_ROLES.ADMIN_RENCANA_KERJA,     label: 'Admin Rencana Kerja (Semua Wilayah)' },
  { value: USER_ROLES.ADMIN_RENCANA_KERJA_BBM, label: 'Admin Rencana Kerja + Admin BBM' },
  { value: USER_ROLES.ADMIN_REKAP_LEMBUR,  label: 'Rekap Lembur' },
  { value: USER_ROLES.ADMIN_BBM,           label: 'Admin BBM' },
  { value: USER_ROLES.ADMIN_BBM_PUSAT,     label: 'Admin BBM Pusat (Semua Wilayah)' },
  { value: USER_ROLES.ADMIN_LAPORAN_BBM,   label: 'Admin Laporan BBM (Per Wilayah)' },
  { value: USER_ROLES.ADMIN_SPJ_BBM,       label: 'Admin SPJ BBM' },
  { value: USER_ROLES.ADMIN_NOTA_DINAS,    label: 'Admin Nota Dinas' },
  { value: USER_ROLES.PIMPINAN,            label: 'Pimpinan (Lihat Rekap)' },
  { value: USER_ROLES.USER,                label: 'Pengguna Tim' },
];

export type RecapPeriod = 'daily' | 'weekly' | 'monthly';

// Role-role yang wajib punya region_id yang terikat di profil.
const REGION_REQUIRED_ROLES = [
  USER_ROLES.ADMIN_WILAYAH,
  USER_ROLES.ADMIN_WILAYAH_BBM,
  USER_ROLES.LAPORAN,
  USER_ROLES.ADMIN_RENCANA_KERJA_BBM,
  USER_ROLES.ADMIN_LAPORAN_BBM,
  USER_ROLES.ADMIN_REKAP_LEMBUR,
  USER_ROLES.ADMIN_NOTA_DINAS,
  USER_ROLES.USER,
] as const satisfies readonly UserRole[];

// Role yang bisa mencetak rekap laporan per periode.
// Hanya role yang memang punya akses laporan harian (Wilayah, Laporan, User).
const REPORT_RECAP_ROLES_BY_PERIOD: Record<RecapPeriod, readonly UserRole[]> = {
  daily: [
    USER_ROLES.ADMIN,
    USER_ROLES.ADMIN_WILAYAH,
    USER_ROLES.ADMIN_WILAYAH_BBM,
    USER_ROLES.PIMPINAN,
    USER_ROLES.LAPORAN,
  ],
  weekly: [
    USER_ROLES.ADMIN,
    USER_ROLES.ADMIN_WILAYAH,
    USER_ROLES.ADMIN_WILAYAH_BBM,
    USER_ROLES.PIMPINAN,
    USER_ROLES.LAPORAN,
  ],
  monthly: [
    USER_ROLES.ADMIN,
    USER_ROLES.ADMIN_WILAYAH,
    USER_ROLES.ADMIN_WILAYAH_BBM,
    USER_ROLES.PIMPINAN,
    USER_ROLES.LAPORAN,
  ],
};

export const isKnownRole = (role: string | null | undefined): role is UserRole =>
  Boolean(role && (USER_ROLE_VALUES as readonly string[]).includes(role));

export const roleRequiresRegion = (role: string | null | undefined) =>
  Boolean(role && (REGION_REQUIRED_ROLES as readonly string[]).includes(role));

export const roleRequiresTeam = (role: string | null | undefined) => role === USER_ROLES.USER;

export const isSuperAdminAccess = (role: string | null | undefined, email?: string | null) =>
  role === USER_ROLES.ADMIN;

export const isPimpinanAccess = (role: string | null | undefined, email?: string | null) =>
  role === USER_ROLES.PIMPINAN;

export const isGlobalWorkPlanAdmin = (role: string | null | undefined, email?: string | null) =>
  isSuperAdminAccess(role, email) || role === USER_ROLES.ADMIN_RENCANA_KERJA;

export const isCategoryScopedWorkPlanAdmin = (role: string | null | undefined) =>
  role === USER_ROLES.ADMIN_RENCANA_KERJA;

export const isAdminRencanaKerjaAccess = (role: string | null | undefined) =>
  role === USER_ROLES.ADMIN_RENCANA_KERJA
  || role === USER_ROLES.ADMIN_RENCANA_KERJA_BBM
  || role === USER_ROLES.ADMIN_WILAYAH_BBM;

export const isAdminBbmAccess = (role: string | null | undefined) =>
  role === USER_ROLES.ADMIN_BBM
  || role === USER_ROLES.ADMIN_BBM_PUSAT
  || role === USER_ROLES.ADMIN_RENCANA_KERJA_BBM
  || role === USER_ROLES.ADMIN_WILAYAH_BBM;

export const isAdminBbmPusatAccess = (role: string | null | undefined) =>
  role === USER_ROLES.ADMIN_BBM_PUSAT;

export const isLaporanBbmAdmin = (role: string | null | undefined) =>
  role === USER_ROLES.ADMIN_LAPORAN_BBM;

export const isGlobalFuelAdmin = (role: string | null | undefined) =>
  role === USER_ROLES.ADMIN_BBM || role === USER_ROLES.ADMIN_BBM_PUSAT;

export const isSpjOliAdmin = (role: string | null | undefined) =>
  role === USER_ROLES.ADMIN_SPJ_OLI;

export const isNotaDinasAdmin = (role: string | null | undefined) =>
  role === USER_ROLES.ADMIN_NOTA_DINAS;

export const roleCanSelectRegion = (role: string | null | undefined) =>
  roleRequiresRegion(role) || isSpjOliAdmin(role);

export const canAccessAllSpjOliRegions = (role: string | null | undefined, regionId?: string | null) =>
  role === USER_ROLES.ADMIN
  || role === USER_ROLES.ADMIN_SPJ_BBM
  || (isSpjOliAdmin(role) && !regionId);

/** Multi-role variant: check if user with roles[] has global SPJ Oli access.
 * Legacy admin_spj_bbm → spj_oli gives global access regardless of region.
 * New 'spj_oli' key gives global access only if user has no region_id.
 * Backward compat: legacy profile.role is still checked via canAccessAllSpjOliRegions().
 */
export const canAccessAllSpjOliRoles = (roles: string[], regionId?: string | null): boolean =>
  roles.includes('administrator')
  || (roles.includes('spj_oli') && !regionId);

export const isAdminWilayahAccess = (role: string | null | undefined) =>
  role === USER_ROLES.ADMIN_WILAYAH || role === USER_ROLES.ADMIN_WILAYAH_BBM;

// Siapa yang boleh membuat/mengedit/menghapus entri laporan harian.
export const canManageReportEntries = (role: string | null | undefined, email?: string | null) =>
  isSuperAdminAccess(role, email)
  || isAdminWilayahAccess(role)
  || role === USER_ROLES.LAPORAN
  || role === USER_ROLES.USER;

// Siapa yang boleh membuat/mengedit/menghapus rencana kerja.
export const canManageWorkPlans = (role: string | null | undefined, email?: string | null) =>
  isSuperAdminAccess(role, email)
  || role === USER_ROLES.ADMIN_WILAYAH
  || isAdminRencanaKerjaAccess(role)
  || role === USER_ROLES.USER;

export const canAccessFuelArea = (role: string | null | undefined, email?: string | null) =>
  isSuperAdminAccess(role, email)
  || isPimpinanAccess(role, email)
  || isAdminBbmAccess(role)
  || isLaporanBbmAdmin(role)
  || role === USER_ROLES.ADMIN_SPJ_BBM;

export const canPrintAdminRecap = (role: string | null | undefined, email?: string | null) =>
  isSuperAdminAccess(role, email);

export const canPrintReportRecapByRole = (
  role: string | null | undefined,
  period: RecapPeriod,
  email?: string | null,
) =>
  isSuperAdminAccess(role, email)
  || (isKnownRole(role) && REPORT_RECAP_ROLES_BY_PERIOD[period].includes(role));

export const getRoleLandingPath = (role: string | null | undefined) => {
  if (role === USER_ROLES.ADMIN_BBM_PUSAT)         return '/?tab=fuel_reports_pusat';
  if (role === USER_ROLES.ADMIN_BBM)               return '/fuel-reports';
  if (role === USER_ROLES.ADMIN_RENCANA_KERJA_BBM) return '/fuel-reports';
  if (role === USER_ROLES.ADMIN_WILAYAH_BBM)       return '/fuel-reports';
  if (role === USER_ROLES.ADMIN_LAPORAN_BBM)       return '/laporan-bbm';
  if (role === USER_ROLES.ADMIN_SPJ_BBM)           return '/?tab=spj_oli';
  if (role === USER_ROLES.ADMIN_SPJ_OLI)           return '/?tab=spj_oli';
  if (role === USER_ROLES.ADMIN_NOTA_DINAS)        return '/?tab=nota_dinas';
  if (role === USER_ROLES.ADMIN_RENCANA_KERJA)     return '/work-plans/daily-rekap';
  return '/';
};

/**
 * Path tujuan setelah login berhasil.
 * Berbeda dengan getRoleLandingPath yang dipakai route guard saat menolak akses,
 * fungsi ini mengarahkan user ke halaman utama sesuai workspace-nya.
 * Role combined (admin_rencana_kerja_bbm, admin_wilayah_bbm) diarahkan ke Index
 * agar kedua tab (Rencana Kerja + Admin BBM) langsung terlihat.
 */
export const getLoginDestination = (role: string | null | undefined) => {
  // Role pure BBM — langsung ke halaman BBM mereka
  if (role === USER_ROLES.ADMIN_BBM_PUSAT)   return '/?tab=fuel_reports_pusat';
  if (role === USER_ROLES.ADMIN_BBM)         return '/fuel-reports';
  if (role === USER_ROLES.ADMIN_LAPORAN_BBM) return '/laporan-bbm';
  if (role === USER_ROLES.ADMIN_SPJ_BBM)     return '/?tab=spj_oli';
  if (role === USER_ROLES.ADMIN_SPJ_OLI)     return '/?tab=spj_oli';
  if (role === USER_ROLES.ADMIN_NOTA_DINAS)  return '/?tab=nota_dinas';
  if (role === USER_ROLES.ADMIN_RENCANA_KERJA) return '/work-plans/daily-rekap';

  // Role combined — ke Index agar semua tab langsung terlihat
  // admin_rencana_kerja_bbm → Index dengan tab workplans aktif
  if (role === USER_ROLES.ADMIN_RENCANA_KERJA_BBM) return '/?tab=workplans';
  // admin_wilayah_bbm → Index dengan tab reports aktif (punya laporan harian)
  if (role === USER_ROLES.ADMIN_WILAYAH_BBM) return '/';

  return '/';
};

export const getRoleLabel = (role: string | null | undefined) =>
  ACCESS_OPTIONS.find(option => option.value === role)?.label ?? role ?? '-';

export const getRoleBadgeClass = (role: string | null | undefined) => {
  switch (role) {
    case USER_ROLES.ADMIN:
      return 'text-red-600 border-red-200 bg-red-50';
    case USER_ROLES.PIMPINAN:
      return 'text-amber-600 border-amber-200 bg-amber-50';
    case USER_ROLES.LAPORAN:
      return 'text-sky-700 border-sky-200 bg-sky-50';
    case USER_ROLES.ADMIN_WILAYAH:
      return 'text-blue-700 border-blue-200 bg-blue-50';
    case USER_ROLES.ADMIN_WILAYAH_BBM:
      return 'text-violet-700 border-violet-200 bg-violet-50';
    case USER_ROLES.ADMIN_RENCANA_KERJA:
      return 'text-teal-700 border-teal-200 bg-teal-50';
    case USER_ROLES.ADMIN_RENCANA_KERJA_BBM:
      return 'text-emerald-700 border-emerald-200 bg-emerald-50';
    case USER_ROLES.ADMIN_BBM:
      return 'text-orange-600 border-orange-200 bg-orange-50';
    case USER_ROLES.ADMIN_BBM_PUSAT:
      return 'text-cyan-700 border-cyan-200 bg-cyan-50';
    case USER_ROLES.ADMIN_LAPORAN_BBM:
      return 'text-amber-700 border-amber-200 bg-amber-50';
    case USER_ROLES.ADMIN_SPJ_BBM:
      return 'text-blue-800 border-blue-300 bg-blue-100';
    case USER_ROLES.ADMIN_SPJ_OLI:
      return 'text-emerald-800 border-emerald-300 bg-emerald-100';
    case USER_ROLES.ADMIN_NOTA_DINAS:
      return 'text-indigo-700 border-indigo-200 bg-indigo-50';
    case USER_ROLES.ADMIN_REKAP_LEMBUR:
      return 'text-rose-600 border-rose-200 bg-rose-50';
    case USER_ROLES.USER:
      return 'text-slate-600 border-slate-200 bg-slate-50';
    default:
      return 'text-blue-600 border-blue-200 bg-blue-50';
  }
};

// ============================================================
// MULTI-ROLE SYSTEM — 11 permission keys
// ============================================================

export type PermissionKey =
  | 'administrator'
  | 'pimpinan'
  | 'laporan_kerja'
  | 'rencana_kerja'
  | 'rekap_lembur'
  | 'bbm'
  | 'bbm_pusat'
  | 'laporan_bbm'
  | 'spj_oli'
  | 'nota_dinas'
  | 'pengguna_tim';

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  administrator: 'Administrator',
  pimpinan: 'Pimpinan',
  laporan_kerja: 'Admin Wilayah (Laporan Kerja)',
  rencana_kerja: 'Admin Rencana Kerja',
  rekap_lembur: 'Admin Rekap Lembur',
  bbm: 'Admin BBM',
  bbm_pusat: 'Admin BBM Pusat',
  laporan_bbm: 'Admin Laporan BBM',
  spj_oli: 'Admin SPJ Oli',
  nota_dinas: 'Admin Nota Dinas',
  pengguna_tim: 'Pengguna Tim',
};

// Permission keys yang memerlukan pengisian wilayah/region
export const PERMISSION_REQUIRES_REGION: PermissionKey[] = [
  'laporan_kerja',
  'rencana_kerja',
  'rekap_lembur',
  'bbm',
  'laporan_bbm',
  // 'spj_oli' intentionally excluded: region is optional for spj_oli.
  // Without region, spj_oli gets global access (consistent with
  // canAccessAllSpjOliRegions() and ROLE_PERMISSIONS[ADMIN_SPJ_OLI] condition).
  'nota_dinas',
  'pengguna_tim',
];

// Permission keys yang memerlukan pengisian tim/kategori
export const PERMISSION_REQUIRES_TEAM: PermissionKey[] = ['pengguna_tim'];

export const ADMINISTRATOR_KEY = 'administrator' as PermissionKey;

// --- Predicate functions versi baru (menerima roles: string[]) ---

export const isSuperAdminRoles = (roles: string[]): boolean =>
  roles.includes('administrator');

export const isPimpinanRoles = (roles: string[]): boolean =>
  roles.includes('pimpinan');

export const isAdminBbmRoles = (roles: string[]): boolean =>
  roles.includes('bbm') || roles.includes('bbm_pusat');

export const isAdminBbmPusatRoles = (roles: string[]): boolean =>
  roles.includes('bbm_pusat');

export const isLaporanBbmRoles = (roles: string[]): boolean =>
  roles.includes('laporan_bbm');

export const isSpjOliRoles = (roles: string[]): boolean =>
  roles.includes('spj_oli');

export const isNotaDinasRoles = (roles: string[]): boolean =>
  roles.includes('nota_dinas');

export const isAdminWilayahRoles = (roles: string[]): boolean =>
  roles.includes('laporan_kerja') || roles.includes('rencana_kerja');

export const canManageReportEntriesRoles = (roles: string[]): boolean =>
  roles.some(r => ['administrator', 'laporan_kerja', 'pengguna_tim'].includes(r));

export const canManageWorkPlansRoles = (roles: string[]): boolean =>
  roles.some(r => ['administrator', 'rencana_kerja', 'pengguna_tim'].includes(r));

export const canAccessFuelAreaRoles = (roles: string[]): boolean =>
  roles.some(r => ['administrator', 'pimpinan', 'bbm', 'bbm_pusat', 'laporan_bbm', 'spj_oli'].includes(r));

export const rolesRequireRegion = (roles: string[]): boolean =>
  roles.some(r => (PERMISSION_REQUIRES_REGION as string[]).includes(r));

export const roleRequiresTeamRoles = (roles: string[]): boolean =>
  roles.includes('pengguna_tim');

export const getRoleLandingPathRoles = (roles: string[]): string => {
  // Semua path di sini menggunakan path yang ada di router App.tsx
  if (roles.includes('administrator')) return '/';
  if (roles.includes('pimpinan')) return '/';
  if (roles.includes('bbm_pusat')) return '/?tab=fuel_reports_pusat';
  if (roles.includes('laporan_bbm')) return '/laporan-bbm';
  if (roles.includes('spj_oli')) return '/?tab=spj_oli';
  // Kombinasi rencana_kerja + bbm → dashboard utama agar kedua tab terlihat
  if (roles.includes('rencana_kerja') && roles.includes('bbm')) return '/';
  // Kombinasi laporan_kerja + bbm → dashboard utama agar kedua tab terlihat
  if (roles.includes('laporan_kerja') && roles.includes('bbm')) return '/';
  // bbm murni (tanpa rencana/laporan kerja) → langsung ke halaman BBM
  if (roles.includes('bbm') && !roles.includes('rencana_kerja') && !roles.includes('laporan_kerja')) return '/fuel-reports';
  if (roles.includes('nota_dinas')) return '/?tab=nota_dinas';
  // rencana_kerja murni (tanpa laporan_kerja dan bbm) → langsung ke rencana kerja
  if (roles.includes('rencana_kerja') && !roles.includes('laporan_kerja')) return '/work-plans/daily-rekap';
  if (roles.includes('rekap_lembur')) return '/overtime';
  // laporan_kerja, combined, pengguna_tim → dashboard utama
  return '/';
};

export const getLoginDestinationRoles = (roles: string[]): string =>
  getRoleLandingPathRoles(roles);

export const getRoleLabelRoles = (roles: string[]): string => {
  if (roles.length === 0) return 'Tidak ada hak akses';
  return roles
    .map(r => PERMISSION_LABELS[r as PermissionKey] ?? r)
    .join(' + ');
};
