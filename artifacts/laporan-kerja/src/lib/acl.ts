// src/lib/acl.ts
import { supabase } from '@/integrations/supabase/client';
import { ROLE_PERMISSIONS, Resource, Action } from '@/constants/permissions';
import type { AuthContext } from '@/constants/permissions';
import type { UserRole } from '@/constants/access-control';

/**
 * Check if the current user (from Supabase session) has permission for a resource/action.
 * This function fetches the user's profile to get roles, region_id, team_id, etc.
 */
export async function userHasPermission(
  resource: Resource,
  action: Action,
  // Optional: IDs of the specific resource being checked (for row-level conditions)
  opts: {
    resourceId?: string; // primary key of the resource row
    resourceRegionId?: string;
    resourceTeamId?: string;
  } = {}
): Promise<boolean> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return false;

    // Fetch profile to get roles (array), region_id, team_id
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role, roles, region_id, team_id')
      .eq('id', session.user.id)
      .single();

    if (error || !profile) return false;

    // Build roles array: prefer new `roles` column, fall back to legacy `role`
    const rolesArray: UserRole[] = (profile.roles && profile.roles.length > 0)
      ? profile.roles as UserRole[]
      : (profile.role ? [profile.role as UserRole] : []);

    const ctx: AuthContext = {
      roles: rolesArray,
      role: profile.role as UserRole | null,
      id: session.user.id,
      regionId: profile.region_id ?? null,
      teamId: profile.team_id ?? null,
      email: session.user.email ?? null,
      resourceId: opts.resourceId ?? null,
      resourceRegionId: opts.resourceRegionId ?? null,
      resourceTeamId: opts.resourceTeamId ?? null,
    };

    return hasPermission(ctx, resource, action);
  } catch (err) {
    console.error('Error checking permission:', err);
    return false;
  }
}

/**
 * Pure function that evaluates permission based on a given context (used by RLS or UI without DB call).
 * OR semantics: access is granted if ANY role in ctx.roles grants it.
 */
export function hasPermission(ctx: AuthContext, resource: Resource, action: Action): boolean {
  // Prefer roles array; fall back to legacy role for backward compat
  const rolesToCheck: UserRole[] = (ctx.roles && ctx.roles.length > 0)
    ? ctx.roles
    : (ctx.role ? [ctx.role] : []);

  if (rolesToCheck.length === 0) return false;

  for (const role of rolesToCheck) {
    const perms = ROLE_PERMISSIONS[role] ?? [];
    const match = perms.find(p => p.resource === resource && p.action === action);
    if (match && (!match.condition || match.condition(ctx))) return true;
  }

  return false;
}
