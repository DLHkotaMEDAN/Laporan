// src/constants/permissions.ts
import { USER_ROLES } from '@/constants/access-control';
import type { UserRole } from '@/constants/access-control';

export type Resource =
  | 'reports'
  | 'work_plans'
  | 'fuel_reports'
  | 'fuel_spj_reports'
  | 'fuel_prices'
  | 'spj_bbm'
  | 'spj_oli'
  | 'audit_logs'
  | 'profiles'
  | 'settings'
  | 'regions'
  | 'teams';

export type Action = 'create' | 'read' | 'update' | 'delete' | 'export' | 'print';

export interface Permission {
  resource: Resource;
  action: Action;
  // Optional condition function that receives context and returns boolean
  condition?: (ctx: AuthContext) => boolean;
}

export interface AuthContext {
  role: UserRole | null;
  id?: string | null;
  regionId: string | null;
  teamId: string | null;
  email: string | null;
  // For checking a specific resource, these can be filled in by the caller
  resourceId?: string | null;
  resourceRegionId?: string | null;
  resourceTeamId?: string | null;
}

/**
 * Default permission matrix.
 * Add or modify permissions here to change access control without touching code.
 */
// Roles without an explicit entry remain denied by hasPermission().
// Keeping this partial prevents accidentally granting access when a new role is added.
export const ROLE_PERMISSIONS: Partial<Record<UserRole, Permission[]>> = {
  // Super admin – full access to everything
  [USER_ROLES.ADMIN]: [
    { resource: 'reports', action: 'create' },
    { resource: 'reports', action: 'read' },
    { resource: 'reports', action: 'update' },
    { resource: 'reports', action: 'delete' },
    { resource: 'work_plans', action: 'create' },
    { resource: 'work_plans', action: 'read' },
    { resource: 'work_plans', action: 'update' },
    { resource: 'work_plans', action: 'delete' },
    { resource: 'fuel_reports', action: 'create' },
    { resource: 'fuel_reports', action: 'read' },
    { resource: 'fuel_reports', action: 'update' },
    { resource: 'fuel_reports', action: 'delete' },
    { resource: 'fuel_spj_reports', action: 'create' },
    { resource: 'fuel_spj_reports', action: 'read' },
    { resource: 'fuel_spj_reports', action: 'update' },
    { resource: 'fuel_spj_reports', action: 'delete' },
    { resource: 'spj_oli', action: 'create' },
    { resource: 'spj_oli', action: 'read' },
    { resource: 'spj_oli', action: 'update' },
    { resource: 'spj_oli', action: 'delete' },
    { resource: 'audit_logs', action: 'read' },
    { resource: 'profiles', action: 'read' },
    { resource: 'profiles', action: 'update' },
    { resource: 'settings', action: 'read' },
    { resource: 'settings', action: 'update' },
    { resource: 'regions', action: 'read' },
    { resource: 'teams', action: 'read' },
  ],

  // Admin Wilayah – can manage reports, work plans, fuel, etc. only within own region
  [USER_ROLES.ADMIN_WILAYAH]: [
    { resource: 'reports', action: 'create' },
    { resource: 'reports', action: 'read', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'reports', action: 'update', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'reports', action: 'delete', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'work_plans', action: 'create' },
    { resource: 'work_plans', action: 'read', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'work_plans', action: 'update', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'work_plans', action: 'delete', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'fuel_reports', action: 'create' },
    { resource: 'fuel_reports', action: 'read', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'fuel_reports', action: 'update', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'fuel_reports', action: 'delete', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'fuel_spj_reports', action: 'read', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'profiles', action: 'read' },
    { resource: 'profiles', action: 'update', condition: ctx => ctx.regionId === ctx.resourceRegionId },
  ],

  // Admin Wilayah + BBM – all three modules within the assigned region.
  [USER_ROLES.ADMIN_WILAYAH_BBM]: [
    { resource: 'reports', action: 'create' },
    { resource: 'reports', action: 'read', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'reports', action: 'update', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'reports', action: 'delete', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'work_plans', action: 'create' },
    { resource: 'work_plans', action: 'read', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'work_plans', action: 'update', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'work_plans', action: 'delete', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'fuel_reports', action: 'create' },
    { resource: 'fuel_reports', action: 'read', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'fuel_reports', action: 'update', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'fuel_reports', action: 'delete', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'profiles', action: 'read' },
  ],

  // Petugas Laporan – hanya mengelola laporan harian dalam wilayah yang ditetapkan.
  [USER_ROLES.LAPORAN]: [
    { resource: 'reports', action: 'create' },
    { resource: 'reports', action: 'read', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'reports', action: 'update', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'reports', action: 'delete', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'reports', action: 'print' },
  ],

  // Admin Spesialis BBM – only fuel reports and fuel prices
  [USER_ROLES.ADMIN_BBM]: [
    { resource: 'fuel_reports', action: 'create' },
    { resource: 'fuel_reports', action: 'read' },
    { resource: 'fuel_reports', action: 'update' },
    { resource: 'fuel_reports', action: 'delete' },
    { resource: 'fuel_prices', action: 'read' },
    { resource: 'fuel_prices', action: 'update' },
    { resource: 'profiles', action: 'read' },
  ],

  // Admin Spesialis SPJ BBM – only fuel SPJ reports
  [USER_ROLES.ADMIN_SPJ_BBM]: [
    { resource: 'fuel_spj_reports', action: 'create' },
    { resource: 'fuel_spj_reports', action: 'read' },
    { resource: 'fuel_spj_reports', action: 'update' },
    { resource: 'fuel_spj_reports', action: 'delete' },
    { resource: 'spj_bbm', action: 'read' },
    { resource: 'spj_bbm', action: 'update' },
    { resource: 'profiles', action: 'read' },
  ],

  // Admin Rencana Kerja – manage work plans only
  [USER_ROLES.ADMIN_RENCANA_KERJA]: [
    { resource: 'work_plans', action: 'create' },
    { resource: 'work_plans', action: 'read' },
    { resource: 'work_plans', action: 'update' },
    { resource: 'work_plans', action: 'delete' },
    { resource: 'profiles', action: 'read' },
  ],

  // Admin SPJ Oli – akses global bila wilayah kosong, atau hanya wilayah yang ditetapkan.
  [USER_ROLES.ADMIN_SPJ_OLI]: [
    { resource: 'spj_oli', action: 'create' },
    { resource: 'spj_oli', action: 'read', condition: ctx => !ctx.regionId || ctx.regionId === ctx.resourceRegionId },
    { resource: 'spj_oli', action: 'update', condition: ctx => !ctx.regionId || ctx.regionId === ctx.resourceRegionId },
    { resource: 'spj_oli', action: 'delete', condition: ctx => !ctx.regionId || ctx.regionId === ctx.resourceRegionId },
    { resource: 'spj_oli', action: 'export' },
    { resource: 'spj_oli', action: 'print' },
    { resource: 'profiles', action: 'read' },
  ],

  // Admin laporan dan rencana kerja dikelola dalam wilayah yang ditetapkan.
  [USER_ROLES.ADMIN_LAPORAN_HARIAN_RENCANA_KERJA]: [
    { resource: 'reports', action: 'create' },
    { resource: 'reports', action: 'read', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'reports', action: 'update', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'reports', action: 'delete', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'work_plans', action: 'create' },
    { resource: 'work_plans', action: 'read', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'work_plans', action: 'update', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'work_plans', action: 'delete', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'profiles', action: 'read' },
  ],

  // Admin Rencana Kerja + BBM – work plans and fuel reports within the assigned region.
  [USER_ROLES.ADMIN_RENCANA_KERJA_BBM]: [
    { resource: 'work_plans', action: 'create' },
    { resource: 'work_plans', action: 'read', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'work_plans', action: 'update', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'work_plans', action: 'delete', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'fuel_reports', action: 'create' },
    { resource: 'fuel_reports', action: 'read', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'fuel_reports', action: 'update', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'fuel_reports', action: 'delete', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'profiles', action: 'read' },
  ],

  // Rekap laporan mingguan/bulanan bersifat baca saja; rencana kerja dapat dikelola.
  [USER_ROLES.ADMIN_LAPORAN_MINGGUAN_RENCANA_KERJA]: [
    { resource: 'reports', action: 'read', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'work_plans', action: 'create' },
    { resource: 'work_plans', action: 'read', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'work_plans', action: 'update', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'work_plans', action: 'delete', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'profiles', action: 'read' },
  ],

  [USER_ROLES.ADMIN_LAPORAN_BULANAN_RENCANA_KERJA]: [
    { resource: 'reports', action: 'read', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'work_plans', action: 'create' },
    { resource: 'work_plans', action: 'read', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'work_plans', action: 'update', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'work_plans', action: 'delete', condition: ctx => ctx.regionId === ctx.resourceRegionId },
    { resource: 'profiles', action: 'read' },
  ],

  // Regular user – can create/view own reports and work plans (by team)
  [USER_ROLES.USER]: [
    { resource: 'reports', action: 'create' },
    { resource: 'reports', action: 'read', condition: ctx => ctx.teamId === ctx.resourceTeamId },
    { resource: 'reports', action: 'update', condition: ctx => ctx.teamId === ctx.resourceTeamId },
    { resource: 'reports', action: 'delete', condition: ctx => ctx.teamId === ctx.resourceTeamId },
    { resource: 'work_plans', action: 'create' },
    { resource: 'work_plans', action: 'read', condition: ctx => ctx.teamId === ctx.resourceTeamId },
    { resource: 'work_plans', action: 'update', condition: ctx => ctx.teamId === ctx.resourceTeamId },
    { resource: 'work_plans', action: 'delete', condition: ctx => ctx.teamId === ctx.resourceTeamId },
    { resource: 'profiles', action: 'read' },
    { resource: 'profiles', action: 'update', condition: ctx => ctx.id === ctx.resourceId }, // self
  ],

  // Pimpinan – read-only access to all reports and recaps
  [USER_ROLES.PIMPINAN]: [
    { resource: 'reports', action: 'read' },
    { resource: 'work_plans', action: 'read' },
    { resource: 'fuel_reports', action: 'read' },
    { resource: 'fuel_spj_reports', action: 'read' },
    { resource: 'audit_logs', action: 'read' },
  ],
};
