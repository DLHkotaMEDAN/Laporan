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

export interface AuthenticatedUser {
  id: string;
  email: string;
  role?: string;
  roles?: string[];
  is_active?: boolean;
}

export async function verifySession(token: string): Promise<AuthenticatedUser | null> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    // Fetch user profile from database
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, roles, is_active')
      .eq('id', user.id)
      .single();

    if (!profile) {
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
