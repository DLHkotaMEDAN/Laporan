/**
 * Supabase Auth utility for Vercel functions
 * Verifies Supabase session token
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const createAuthenticatedClient = (token: string) =>
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role?: string;
  roles?: string[];
  is_active?: boolean;
}

// SupabaseAuthClient's public type is inconsistent across the package
// versions resolved by Vercel's function builder, although getUser is part of
// the supported runtime API. Keep the compatibility boundary local and typed.
type AuthClientWithGetUser = typeof supabase.auth & {
  getUser: (jwt?: string) => Promise<{
    data: { user: { id: string; email: string } | null };
    error: unknown;
  }>;
};

export async function verifySession(token: string): Promise<AuthenticatedUser | null> {
  try {
    const authenticatedClient = createAuthenticatedClient(token);
    const authClient = authenticatedClient.auth as AuthClientWithGetUser;
    const { data: { user }, error } = await authClient.getUser(token);

    if (error || !user) {
      return null;
    }

    // Fetch user profile from database
    const { data: profile, error: profileError } = await authenticatedClient
      .from('profiles')
      .select('id, role, roles, is_active')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile lookup failed during PDF authentication:', profileError?.message ?? 'profile not found');
      return null;
    }

    // Check if account is active
    if (profile.is_active === false) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      role: profile.role,
      roles: profile.roles,
      is_active: profile.is_active,
    };
  } catch (error) {
    console.error('Session verification error:', error);
    return null;
  }
}
