"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { UserRole } from '@/constants/access-control';

interface Profile {
  id: string;
  role: UserRole;
  category: string | null;
  username: string | null;
  region_id?: string | null;
  team_id?: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    setLoading(true);

    // Kegagalan jaringan singkat saat login sebelumnya membuat profil tetap
    // null sampai halaman di-refresh. Coba kembali sekali sebelum melanjutkan.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (error?.code === 'PGRST116') {
          const { data: newData, error: createError } = await supabase
            .from('profiles')
            .insert([{ id: userId, role: 'user', updated_at: new Date().toISOString() }])
            .select()
            .single();

          if (createError) throw createError;
          setProfile(newData);
          setLoading(false);
          return;
        }

        if (error) throw error;

        setProfile(data);
        setLoading(false);
        return;
      } catch (error) {
        if (attempt === 1) {
          console.error("Error fetching profile:", error);
          break;
        }
        await new Promise<void>((resolve) => window.setTimeout(resolve, 300));
      }
    }

    setProfile(null);
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
