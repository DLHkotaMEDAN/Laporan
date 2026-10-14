/**
 * Supabase Auth middleware for Express
 * Verifies Supabase session token for protected routes
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
    roles?: string[];
    is_active?: boolean;
  };
}

export async function requireAuth(req: AuthRequest, res: any, next: any) {
  try {
    const authHeader = req.headers.get('authorization');

    if (!authHeader) {
      return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    // Extract token from "Bearer <token>" format
    const token = authHeader.replace('Bearer ', '');

    // Verify session with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
      return res.status(401).json({ message: 'Invalid token', error: error.message });
    }

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Fetch user profile from database
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, roles, is_active')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return res.status(401).json({ message: 'Profile not found' });
    }

    // Check if account is active
    if (profile.is_active === false) {
      return res.status(403).json({ message: 'Account is inactive' });
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email || '',
      role: profile.role,
      roles: profile.roles,
      is_active: profile.is_active,
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
