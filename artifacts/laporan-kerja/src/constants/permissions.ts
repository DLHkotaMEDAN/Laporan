// src/constants/permissions.ts
import { UserRole } from '@/constants/access-control';

export type Resource =
  | 'reports'
  | 'work_plans'
  | 'fuel_reports'
  | 'fuel_spj_reports'
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
  regionId: string | null;
  teamId: string | null;
  email: string | null;
  // For checking a specific resource, these can be filled in by the caller
  resourceRegionId?: string | null;
  resourceTeamId?: string | null;
}

/**
 * Default permission matrix.
 * Add or modify permissions here to change access control without touching code.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  // Super admin – full access to everything
  [UserRole.ADMIN]: [
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
    { resource: 'audit_logs', action: 'read' },
    { resource: 'profiles', action: 'read' },
    { resource: 'profiles', action: 'update' },
    { resource: 'settings', action: 'read' },
    { resource: 'settings', action: 'update' },
    { resource: 'regions', action: 'read' },
    { resource: 'teams', action: 'read' },
  ],

  // Admin Wilayah – can manage reports, work plans, fuel, etc. only within own region
  [UserRole.ADMIN_WILAYAH]: [
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

  // Admin Spesialis BBM – only fuel reports and fuel prices
  [UserRole.ADMIN_BBM]: [
    { resource: 'fuel_reports', action: 'create' },
    { resource: 'fuel_reports', action: 'read' },
    { resource: 'fuel_reports', action: 'update' },
    { resource: 'fuel_reports', action: 'delete' },
    { resource: 'fuel_prices', action: 'read' },
    { resource: 'fuel_prices', action: 'update' },
    { resource: 'profiles', action: 'read' },
  ],

  // Admin Spesialis SPJ BBM – only fuel SPJ reports
  [UserRole.ADMIN_SPJ_BBM]: [
    { resource: 'fuel_spj_reports', action: 'create' },
    { resource: 'fuel_spj_reports', action: 'read' },
    { resource: 'fuel_spj_reports', action: 'update' },
    { resource: 'fuel_spj_reports', action: 'delete' },
    { resource: 'spj_bbm', action: 'read' },
    { resource: 'spj_bbm', action: 'update' },
    { resource: 'profiles', action: 'read' },
  ],

  // Admin Rencana Kerja – manage work plans only
  [UserRole.ADMIN_RENCANA_KERJA]: [
    { resource: 'work_plans', action: 'create' },
    { resource: 'work_plans', action: 'read' },
    { resource: 'work_plans', action: 'update' },
    { resource: 'work_plans', action: 'delete' },
    { resource: 'profiles', action: 'read' },
  ],

  // Regular user – can create/view own reports and work plans (by team)
  [UserRole.USER]: [
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
  [UserRole.PIMPINAN]: [
    { resource: 'reports', action: 'read' },
    { resource: 'work_plans', action: 'read' },
    { resource: 'fuel_reports', action: 'read' },
    { resource: 'fuel_spj_reports', action: 'read' },
    { resource: 'audit_logs', action: 'read' },
  ],
};