/**
 * Simple auth middleware for Express
 * Verifies session presence and basic validation
 * Full Supabase verification happens at database level via RLS
 */

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export async function requireAuth(req: AuthRequest, res: any, next: any) {
  try {
    const authHeader = req.headers['authorization'] as string | undefined;

    if (!authHeader) {
      return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    // Basic token validation - check if it's in proper format
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Invalid token format' });
    }

    const token = authHeader.replace('Bearer ', '');

    // Check if token is non-empty and reasonable length
    if (!token || token.length < 10) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Note: Full user verification happens at database level via RLS policies
    // This middleware just ensures a token is present and formatted correctly
    // The actual user authentication and is_active check happens in the database

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
