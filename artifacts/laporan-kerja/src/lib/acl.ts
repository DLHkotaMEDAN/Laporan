// src/lib/acl.ts
import { supabase } from '@/integrations/supabase/client';
import { ROLE_PERMISSIONS, Resource, Action } from '@/constants/permissions';
import type { AuthContext } from '@/constants/permissions';
import type { UserRole } from '@/constants/access-control';

/**
 * Check if the current user (from Supabase session) has permission for a resource/action.
 * This function fetches the user's profile to get role, region_id, team_id, etc.
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

    // Fetch profile to get role, region_id, team_id
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role, region_id, team_id')
      .eq('id', session.user.id)
      .single();

    if (error || !profile) return false;

    const ctx: AuthContext = {
      role: profile.role as UserRole | null,
      id: session.user.id,
      regionId: profile.region_id ?? null,
      teamId: profile.team_id ?? null,
      email: session.user.email ?? null,
      resourceId: opts.resourceId ?? null,
      resourceRegionId: opts.resourceRegionId ?? null,
      resourceTeamId: opts.resourceTeamId ?? null,
    };

    // If we have a specific resource ID, we could fetch its region/team from DB if needed.
    // For simplicity, we expect callers to pass those IDs directly via opts.
    // If they didn't, we could optionally look them up here.

    return hasPermission(ctx, resource, action);
  } catch (err) {
    console.error('Error checking permission:', err);
    return false;
  }
}

/**
 * Pure function that evaluates permission based on a given context (used by RLS or UI without DB call).
 */
export function hasPermission(ctx: AuthContext, resource: Resource, action: Action): boolean {
  if (!ctx.role) return false;
  const perms = ROLE_PERMISSIONS[ctx.role] ?? [];
  const match = perms.find(p => p.resource === resource && p.action === action);
  if (!match) return false;
  if (!match.condition) return true;
  return match.condition(ctx);
}
