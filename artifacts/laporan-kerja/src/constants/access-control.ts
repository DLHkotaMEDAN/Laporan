export const USER_ROLES = {
  ADMIN: 'admin',
  ADMIN_WILAYAH: 'admin_wilayah',
  ADMIN_HARIAN: 'admin_harian',
  ADMIN_LAPORAN_MINGGUAN: 'admin_laporan_mingguan',
  ADMIN_LAPORAN_BULANAN: 'admin_laporan_bulanan',
  ADMIN_LAPORAN_MINGGUAN_BULANAN: 'admin_laporan_mingguan_bulanan',
  ADMIN_LAPORAN_HARIAN_MINGGUAN: 'admin_laporan_harian_mingguan',
  ADMIN_LAPORAN_HARIAN_BULANAN: 'admin_laporan_harian_bulanan',
  ADMIN_LAPORAN_HARIAN_RENCANA_KERJA: 'admin_laporan_harian_rencana_kerja',
  ADMIN_LAPORAN_MINGGUAN_RENCANA_KERJA: 'admin_laporan_mingguan_rencana_kerja',
  ADMIN_LAPORAN_BULANAN_RENCANA_KERJA: 'admin_laporan_bulanan_rencana_kerja',
  ADMIN_RENCANA_KERJA: 'admin_rencana_kerja',
  ADMIN_BBM: 'admin_bbm',
  ADMIN_SPJ_BBM: 'admin_spj_bbm',
  PIMPINAN: 'pimpinan',
  USER: 'user',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const USER_ROLE_VALUES = Object.values(USER_ROLES) as readonly UserRole[];

export const ACCESS_OPTIONS: readonly { value: UserRole; label: string }[] = [
  { value: USER_ROLES.ADMIN, label: 'Super Admin / Administrator' },
  { value: USER_ROLES.ADMIN_WILAYAH, label: 'Admin Wilayah (Laporan & Rencana Kerja)' },
  { value: USER_ROLES.ADMIN_HARIAN, label: 'Admin Laporan Harian' },
  { value: USER_ROLES.ADMIN_LAPORAN_MINGGUAN, label: 'Admin Laporan Mingguan' },
  { value: USER_ROLES.ADMIN_LAPORAN_BULANAN, label: 'Admin Laporan Bulanan' },
  { value: USER_ROLES.ADMIN_LAPORAN_MINGGUAN_BULANAN, label: 'Admin Laporan Mingguan dan Bulanan' },
  { value: USER_ROLES.ADMIN_LAPORAN_HARIAN_MINGGUAN, label: 'Admin Laporan Harian dan Mingguan' },
  { value: USER_ROLES.ADMIN_LAPORAN_HARIAN_BULANAN, label: 'Admin Laporan Harian dan Bulanan' },
  { value: USER_ROLES.ADMIN_LAPORAN_HARIAN_RENCANA_KERJA, label: 'Admin Laporan Harian dan Rencana Kerja' },
  { value: USER_ROLES.ADMIN_LAPORAN_MINGGUAN_RENCANA_KERJA, label: 'Admin Laporan Mingguan dan Rencana Kerja' },
  { value: USER_ROLES.ADMIN_LAPORAN_BULANAN_RENCANA_KERJA, label: 'Admin Laporan Bulanan dan Rencana Kerja' },
  { value: USER_ROLES.ADMIN_RENCANA_KERJA, label: 'Admin Rencana Kerja' },
  { value: USER_ROLES.ADMIN_BBM, label: 'Admin BBM' },
  { value: USER_ROLES.ADMIN_SPJ_BBM, label: 'Admin SPJ BBM' },
  { value: USER_ROLES.PIMPINAN, label: 'Pimpinan (Lihat Rekap)' },
  { value: USER_ROLES.USER, label: 'Pengguna Tim' },
];

export const SYSTEM_EMAILS = {
  superAdmin: ['admin@gmail.com'],
  pimpinan: ['pimpinan@gmail.com'],
  adminHarian: ['sakinah@gmail.com', 'admin.laporan@gmail.com'],
} as const;

export type RecapPeriod = 'daily' | 'weekly' | 'monthly';

const REGION_REQUIRED_ROLES = [
  USER_ROLES.ADMIN_WILAYAH,
  USER_ROLES.ADMIN_HARIAN,
  USER_ROLES.ADMIN_LAPORAN_HARIAN_RENCANA_KERJA,
  USER_ROLES.ADMIN_LAPORAN_MINGGUAN_RENCANA_KERJA,
  USER_ROLES.ADMIN_LAPORAN_BULANAN_RENCANA_KERJA,
  USER_ROLES.ADMIN_RENCANA_KERJA,
  USER_ROLES.USER,
] as const satisfies readonly UserRole[];

const REPORT_RECAP_ROLES_BY_PERIOD: Record<RecapPeriod, readonly UserRole[]> = {
  daily: [
    USER_ROLES.ADMIN,
    USER_ROLES.ADMIN_HARIAN,
    USER_ROLES.ADMIN_LAPORAN_HARIAN_MINGGUAN,
    USER_ROLES.ADMIN_LAPORAN_HARIAN_BULANAN,
    USER_ROLES.ADMIN_LAPORAN_HARIAN_RENCANA_KERJA,
  ],
  weekly: [
    USER_ROLES.ADMIN,
    USER_ROLES.ADMIN_LAPORAN_MINGGUAN,
    USER_ROLES.ADMIN_LAPORAN_MINGGUAN_BULANAN,
    USER_ROLES.ADMIN_LAPORAN_HARIAN_MINGGUAN,
    USER_ROLES.ADMIN_LAPORAN_MINGGUAN_RENCANA_KERJA,
  ],
  monthly: [
    USER_ROLES.ADMIN,
    USER_ROLES.ADMIN_LAPORAN_BULANAN,
    USER_ROLES.ADMIN_LAPORAN_MINGGUAN_BULANAN,
    USER_ROLES.ADMIN_LAPORAN_HARIAN_BULANAN,
    USER_ROLES.ADMIN_LAPORAN_BULANAN_RENCANA_KERJA,
  ],
};

export const isKnownRole = (role: string | null | undefined): role is UserRole =>
  Boolean(role && (USER_ROLE_VALUES as readonly string[]).includes(role));

export const roleRequiresRegion = (role: string | null | undefined) =>
  Boolean(role && (REGION_REQUIRED_ROLES as readonly string[]).includes(role));

export const roleRequiresTeam = (role: string | null | undefined) => role === USER_ROLES.USER;

export const isSuperAdminAccess = (role: string | null | undefined, email?: string | null) =>
  role === USER_ROLES.ADMIN || Boolean(email && (SYSTEM_EMAILS.superAdmin as readonly string[]).includes(email));

export const isPimpinanAccess = (role: string | null | undefined, email?: string | null) =>
  role === USER_ROLES.PIMPINAN || Boolean(email && (SYSTEM_EMAILS.pimpinan as readonly string[]).includes(email));

export const isAdminHarianAccess = (role: string | null | undefined, email?: string | null) =>
  role === USER_ROLES.ADMIN_HARIAN || Boolean(email && (SYSTEM_EMAILS.adminHarian as readonly string[]).includes(email));

export const canManageReportEntries = (role: string | null | undefined, email?: string | null) =>
  isSuperAdminAccess(role, email)
  || role === USER_ROLES.ADMIN_WILAYAH
  || isAdminHarianAccess(role, email)
  || role === USER_ROLES.ADMIN_LAPORAN_HARIAN_RENCANA_KERJA
  || role === USER_ROLES.USER;

export const canManageWorkPlans = (role: string | null | undefined, email?: string | null) =>
  isSuperAdminAccess(role, email)
  || role === USER_ROLES.ADMIN_WILAYAH
  || role === USER_ROLES.ADMIN_RENCANA_KERJA
  || role === USER_ROLES.ADMIN_LAPORAN_HARIAN_RENCANA_KERJA
  || role === USER_ROLES.ADMIN_LAPORAN_MINGGUAN_RENCANA_KERJA
  || role === USER_ROLES.ADMIN_LAPORAN_BULANAN_RENCANA_KERJA
  || role === USER_ROLES.USER;

export const canAccessFuelArea = (role: string | null | undefined, email?: string | null) =>
  isSuperAdminAccess(role, email)
  || isPimpinanAccess(role, email)
  || role === USER_ROLES.ADMIN_BBM
  || role === USER_ROLES.ADMIN_SPJ_BBM;

export const canPrintAdminRecap = (role: string | null | undefined, email?: string | null) =>
  isSuperAdminAccess(role, email);

export const canPrintReportRecapByRole = (role: string | null | undefined, period: RecapPeriod) =>
  isKnownRole(role) && REPORT_RECAP_ROLES_BY_PERIOD[period].includes(role);

export const getRoleLandingPath = (role: string | null | undefined) => {
  if (role === USER_ROLES.ADMIN_BBM) return '/fuel-reports';
  if (role === USER_ROLES.ADMIN_SPJ_BBM) return '/fuel-reports/spj';
  if (role === USER_ROLES.ADMIN_RENCANA_KERJA) return '/work-plans';
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
    case USER_ROLES.ADMIN_HARIAN:
      return 'text-purple-600 border-purple-200 bg-purple-50';
    case USER_ROLES.ADMIN_LAPORAN_MINGGUAN:
      return 'text-indigo-600 border-indigo-200 bg-indigo-50';
    case USER_ROLES.ADMIN_LAPORAN_BULANAN:
      return 'text-violet-600 border-violet-200 bg-violet-50';
    case USER_ROLES.ADMIN_LAPORAN_MINGGUAN_BULANAN:
      return 'text-pink-600 border-pink-200 bg-pink-50';
    case USER_ROLES.ADMIN_LAPORAN_HARIAN_MINGGUAN:
      return 'text-rose-600 border-rose-200 bg-rose-50';
    case USER_ROLES.ADMIN_LAPORAN_HARIAN_BULANAN:
      return 'text-fuchsia-600 border-fuchsia-200 bg-fuchsia-50';
    case USER_ROLES.ADMIN_LAPORAN_HARIAN_RENCANA_KERJA:
      return 'text-teal-700 border-teal-200 bg-teal-50';
    case USER_ROLES.ADMIN_LAPORAN_MINGGUAN_RENCANA_KERJA:
      return 'text-cyan-700 border-cyan-200 bg-cyan-50';
    case USER_ROLES.ADMIN_LAPORAN_BULANAN_RENCANA_KERJA:
      return 'text-emerald-700 border-emerald-200 bg-emerald-50';
    case USER_ROLES.ADMIN_BBM:
      return 'text-orange-600 border-orange-200 bg-orange-50';
    case USER_ROLES.ADMIN_SPJ_BBM:
      return 'text-blue-800 border-blue-300 bg-blue-100';
    default:
      return 'text-blue-600 border-blue-200 bg-blue-50';
  }
};
