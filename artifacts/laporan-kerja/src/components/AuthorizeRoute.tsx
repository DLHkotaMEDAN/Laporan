// src/components/AuthorizeRoute.tsx
import { Navigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/acl';
import type { AuthContext, Action, Resource } from '@/constants/permissions';
import { supabase } from '@/integrations/supabase/client';

type AuthorizeRouteProps = {
  children: React.ReactNode;
  resource: Resource; // matches table name in DB, e.g. 'reports'
  action: Action;
  // If checking a specific record, provide its ID to fetch region/team for row‑level rules
  resourceId?: string;
};

export const AuthorizeRoute = ({
  children,
  resource,
  action,
  resourceId,
}: AuthorizeRouteProps) => {
  const { session, profile, loading: authLoading } = useAuth();
  const [authorizing, setAuthorizing] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [denyReason, setDenyReason] = useState<string | null>(null);
  const { id: paramsId } = useParams<{ id: string }>();

  // Determine which ID to use: explicit prop > route param > none
  const effectiveId = resourceId ?? paramsId ?? undefined;

  useEffect(() => {
    let cancelled = false;
    const checkPermission = async () => {
      if (!session?.user) {
        setAuthorizing(false);
        setAuthorized(false);
        setDenyReason('No session');
        return;
      }
      // Build context from profile (roles array, region_id, team_id, email)
      const ctx: AuthContext = {
        roles: (profile?.roles ?? []) as import('@/constants/access-control').UserRole[],
        role: profile?.role ?? null,
        id: session.user.id,
        regionId: profile?.region_id ?? null,
        teamId: profile?.team_id ?? null,
        email: session.user.email ?? null,
        resourceId: effectiveId ?? null,
        resourceRegionId: null,
        resourceTeamId: null,
      };

      // If we need to evaluate row‑level conditions, fetch the resource row
      if (effectiveId) {
        try {
          const { data, error } = await supabase
            .from(resource)
            .select('region_id, team_id')
            .eq('id', effectiveId)
            .single();

          if (!error && data) {
            ctx.resourceRegionId = data.region_id ?? null;
            ctx.resourceTeamId = data.team_id ?? null;
          }
        } catch (e) {
          // If fetch fails, we keep nulls; condition may still work or deny
          console.warn(`Could not fetch ${resource}[${effectiveId}] for auth check`, e);
        }
      }

      const allowed = hasPermission(ctx, resource, action);

      if (!cancelled) {
        setAuthorizing(false);
        if (allowed) {
          setAuthorized(true);
          setDenyReason(null);
        } else {
          setAuthorized(false);
          setDenyReason('Insufficient permissions');
        }
      }
    };

    if (!authLoading) {
      checkPermission();
    }
  }, [session, profile, authLoading, resource, action, resourceId, paramsId]);

  if (authorizing) {
    return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
  }

  if (!authorized) {
    // Optionally redirect to a fallback page or show a message
    // For now, we redirect to home; you could also render an AccessDenied component.
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
