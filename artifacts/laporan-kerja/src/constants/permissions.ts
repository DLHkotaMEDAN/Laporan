// src/constants/permissions.ts
import { USER_ROLES } from '@/constants/access-control';
import type { UserRole } from '@/constants/access-control';

export type Resource =
  | 'reports'
  | 'work_plans'
  | 'fuel_reports'
  | 'fuel_reports_pusat'
  | 'fuel_prices'
  | 'fuel_prices_pusat'
  | 'spj_oli'
  | 'nota_dinas'
  | 'audit_logs'
  | 'profiles'
  | 'settings'
  | 'regions'
  | 'teams';

export type Action = 'create' | 'read' | 'update' | 'delete' | 'export' | 'print';

export interface Permission {
  resource: Resource;
  action: Action;
  condition?: (ctx: AuthContext) => boolean;
}

export interface AuthContext {
  role: UserRole | null;
  id?: string | null;
  regionId: string | null;
  teamId: string | null;
  email: string | null;
  resourceId?: string | null;
  resourceRegionId?: string | null;
  resourceTeamId?: string | null;
}

/**
 * Matriks izin per role.
 * Role yang tidak terdaftar di sini akan selalu ditolak oleh hasPermission().
 */
export const ROLE_PERMISSIONS: Partial<Record<UserRole, Permission[]>> = {

  // ── Super Admin ──────────────────────────────────────────────────────────
  [USER_ROLES.ADMIN]: [
    { resource: 'reports',           action: 'create' },
    { resource: 'reports',           action: 'read' },
    { resource: 'reports',           action: 'update' },
    { resource: 'reports',           action: 'delete' },
    { resource: 'work_plans',        action: 'create' },
    { resource: 'work_plans',        action: 'read' },
    { resource: 'work_plans',        action: 'update' },
    { resource: 'work_plans',        action: 'delete' },
    { resource: 'fuel_reports',      action: 'create' },
    { resource: 'fuel_reports',      action: 'read' },
    { resource: 'fuel_reports',      action: 'update' },
    { resource: 'fuel_reports',      action: 'delete' },
    { resource: 'fuel_reports_pusat', action: 'create' },
    { resource: 'fuel_reports_pusat', action: 'read' },
    { resource: 'fuel_reports_pusat', action: 'update' },
    { resource: 'fuel_reports_pusat', action: 'delete' },
    { resource: 'fuel_prices_pusat', action: 'read' },
    { resource: 'fuel_prices_pusat', action: 'update' },
    { resource: 'spj_oli',           action: 'create' },
    { resource: 'spj_oli',           action: 'read' },
    { resource: 'spj_oli',           action: 'update' },
    { resource: 'spj_oli',           action: 'delete' },
    { resource: 'nota_dinas',        action: 'create' },
    { resource: 'nota_dinas',        action: 'read' },
    { resource: 'nota_dinas',        action: 'update' },
    { resource: 'nota_dinas',        action: 'print' },
    { resource: 'audit_logs',        action: 'read' },
    { resource: 'profiles',          action: 'read' },
    { resource: 'profiles',          action: 'update' },
    { resource: 'settings',          action: 'read' },
    { resource: 'settings',          action: 'update' },
    { resource: 'regions',           action: 'read' },
    { resource: 'teams',             action: 'read' },
  ],

  // ── Pimpinan — baca saja ─────────────────────────────────────────────────
  [USER_ROLES.PIMPINAN]: [
    { resource: 'reports',      action: 'read' },
    { resource: 'work_plans',   action: 'read' },
    { resource: 'fuel_reports', action: 'read' },
    { resource: 'audit_logs',   action: 'read' },
  ],

  // ── Admin Nota Dinas ─────────────────────────────────────────────────────
  [USER_ROLES.ADMIN_NOTA_DINAS]: [
    { resource: 'nota_dinas', action: 'create' },
    { resource: 'nota_dinas', action: 'read' },
    { resource: 'nota_dinas', action: 'update' },
    { resource: 'nota_dinas', action: 'print' },
  ],

  // ── Admin Wilayah — laporan & rencana kerja dalam wilayah sendiri ─────────
  [USER_ROLES.ADMIN_WILAYAH]: [
    { resource: 'reports',    action: 'create' },
    { resource: 'reports',    action: 'read',   condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'reports',    action: 'update', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'reports',    action: 'delete', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'work_plans', action: 'create' },
    { resource: 'work_plans', action: 'read',   condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'work_plans', action: 'update', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'work_plans', action: 'delete', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'profiles',   action: 'read' },
    { resource: 'profiles',   action: 'update', condition: ctx => ctx.regionId === ctx.resourceRegionId },
  ],

  // ── Admin Wilayah + BBM — laporan, rencana kerja, dan BBM dalam wilayah ──
  [USER_ROLES.ADMIN_WILAYAH_BBM]: [
    { resource: 'reports',       action: 'create' },
    { resource: 'reports',       action: 'read',   condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'reports',       action: 'update', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'reports',       action: 'delete', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'work_plans',    action: 'create' },
    { resource: 'work_plans',    action: 'read',   condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'work_plans',    action: 'update', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'work_plans',    action: 'delete', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'fuel_reports',  action: 'create' },
    { resource: 'fuel_reports',  action: 'read',   condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'fuel_reports',  action: 'update', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'fuel_reports',  action: 'delete', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'profiles',      action: 'read' },
  ],

  // ── Laporan — hanya input & baca laporan dalam wilayah sendiri ───────────
  [USER_ROLES.LAPORAN]: [
    { resource: 'reports', action: 'create' },
    { resource: 'reports', action: 'read',   condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'reports', action: 'update', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'reports', action: 'delete', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'reports', action: 'print' },
  ],

  // ── Admin Rencana Kerja — semua wilayah ──────────────────────────────────
  [USER_ROLES.ADMIN_RENCANA_KERJA]: [
    { resource: 'work_plans', action: 'create' },
    { resource: 'work_plans', action: 'read' },
    { resource: 'work_plans', action: 'update' },
    { resource: 'work_plans', action: 'delete' },
    { resource: 'profiles',   action: 'read' },
  ],

  // ── Admin Rencana Kerja + BBM — rencana kerja & BBM dalam wilayah ────────
  [USER_ROLES.ADMIN_RENCANA_KERJA_BBM]: [
    { resource: 'work_plans',   action: 'create' },
    { resource: 'work_plans',   action: 'read',   condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'work_plans',   action: 'update', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'work_plans',   action: 'delete', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'fuel_reports', action: 'create' },
    { resource: 'fuel_reports', action: 'read',   condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'fuel_reports', action: 'update', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'fuel_reports', action: 'delete', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'profiles',     action: 'read' },
  ],

  // ── Admin BBM — BBM dalam wilayah sendiri ────────────────────────────────
  [USER_ROLES.ADMIN_BBM]: [
    { resource: 'fuel_reports', action: 'create' },
    { resource: 'fuel_reports', action: 'read' },
    { resource: 'fuel_reports', action: 'update' },
    { resource: 'fuel_reports', action: 'delete' },
    { resource: 'fuel_prices',  action: 'read' },
    { resource: 'fuel_prices',  action: 'update' },
    { resource: 'profiles',     action: 'read' },
  ],

  // ── Admin BBM Pusat — semua wilayah ──────────────────────────────────────
  [USER_ROLES.ADMIN_BBM_PUSAT]: [
    { resource: 'fuel_reports_pusat', action: 'create' },
    { resource: 'fuel_reports_pusat', action: 'read' },
    { resource: 'fuel_reports_pusat', action: 'update' },
    { resource: 'fuel_reports_pusat', action: 'delete' },
    { resource: 'fuel_prices_pusat',  action: 'read' },
    { resource: 'fuel_prices_pusat',  action: 'update' },
    { resource: 'profiles',           action: 'read' },
  ],

  // ── Admin Laporan BBM — per wilayah ──────────────────────────────────────
  [USER_ROLES.ADMIN_LAPORAN_BBM]: [
    // create tidak perlu condition — resourceRegionId selalu null saat record belum ada.
    // Scoping ke wilayah dilakukan di form melalui profile.region_id.
    { resource: 'fuel_reports', action: 'create' },
    { resource: 'fuel_reports', action: 'read',   condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'fuel_reports', action: 'update', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'fuel_reports', action: 'delete', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'fuel_prices',  action: 'read' },
    { resource: 'profiles',     action: 'read' },
  ],

  // ── Admin SPJ BBM — SPJ Oli semua wilayah ────────────────────────────────
  [USER_ROLES.ADMIN_SPJ_BBM]: [
    { resource: 'spj_oli', action: 'create' },
    { resource: 'spj_oli', action: 'read',   condition: ctx => !ctx.regionId || ctx.regionId === ctx.resourceRegionId },
    { resource: 'spj_oli', action: 'update', condition: ctx => !ctx.regionId || ctx.regionId === ctx.resourceRegionId },
    { resource: 'spj_oli', action: 'delete', condition: ctx => !ctx.regionId || ctx.regionId === ctx.resourceRegionId },
    { resource: 'spj_oli', action: 'export' },
    { resource: 'spj_oli', action: 'print' },
    { resource: 'profiles', action: 'read' },
  ],

  // ── Admin SPJ Oli — per wilayah atau semua jika tanpa region ─────────────
  [USER_ROLES.ADMIN_SPJ_OLI]: [
    { resource: 'spj_oli', action: 'create' },
    { resource: 'spj_oli', action: 'read',   condition: ctx => !ctx.regionId || ctx.regionId === ctx.resourceRegionId },
    { resource: 'spj_oli', action: 'update', condition: ctx => !ctx.regionId || ctx.regionId === ctx.resourceRegionId },
    { resource: 'spj_oli', action: 'delete', condition: ctx => !ctx.regionId || ctx.regionId === ctx.resourceRegionId },
    { resource: 'spj_oli', action: 'export' },
    { resource: 'spj_oli', action: 'print' },
    { resource: 'profiles', action: 'read' },
  ],

  // ── Rekap Lembur ─────────────────────────────────────────────────────────
  [USER_ROLES.ADMIN_REKAP_LEMBUR]: [
    { resource: 'profiles', action: 'read' },
  ],

  // ── Pengguna Tim — laporan & rencana kerja tim sendiri ───────────────────
  [USER_ROLES.USER]: [
    { resource: 'reports',    action: 'create' },
    { resource: 'reports',    action: 'read',   condition: ctx => ctx.teamId === ctx.resourceTeamId },
    { resource: 'reports',    action: 'update', condition: ctx => ctx.teamId === ctx.resourceTeamId },
    { resource: 'reports',    action: 'delete', condition: ctx => ctx.teamId === ctx.resourceTeamId },
    { resource: 'work_plans', action: 'create' },
    { resource: 'work_plans', action: 'read',   condition: ctx => ctx.teamId === ctx.resourceTeamId },
    { resource: 'work_plans', action: 'update', condition: ctx => ctx.teamId === ctx.resourceTeamId },
    { resource: 'work_plans', action: 'delete', condition: ctx => ctx.teamId === ctx.resourceTeamId },
    { resource: 'profiles',   action: 'read' },
    { resource: 'profiles',   action: 'update', condition: ctx => ctx.id === ctx.resourceId },
  ],
};
