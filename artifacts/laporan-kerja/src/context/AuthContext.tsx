import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { UserRole } from '@/constants/access-control';
import { auditLogService } from '@/services/auditLogService';

interface Profile {
  id: string;
  role: UserRole;
  category: string | null;
  work_plan_categories?: string[] | null;
  username: string | null;
  region_id?: string | null;
  team_id?: string | null;
  is_active?: boolean;
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
  const loginAuditUsers = useRef(new Set<string>());
  const fetchingProfileRef = useRef<string | null>(null);

  const fetchProfile = async (userId: string) => {
    // Jika invokasi lain untuk userId yang sama sudah berjalan, abaikan.
    // Invokasi yang sedang berjalan bertanggung jawab me-reset loading.
    if (fetchingProfileRef.current === userId) return;

    // Invokasi ini mengambil alih kepemilikan. Tandai dengan ref sebelum
    // async pertama agar tidak ada invokasi lain yang memulai dengan userId ini.
    fetchingProfileRef.current = userId;
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

        // Setelah setiap await: periksa apakah invokasi ini masih relevan.
        // Bisa tidak relevan jika signOut meng-clear ref sementara fetch berjalan.
        if (fetchingProfileRef.current !== userId) return;

        if (error?.code === 'PGRST116') {
          const { data: newData, error: createError } = await supabase
            .from('profiles')
            .insert([{ id: userId, role: 'user', updated_at: new Date().toISOString() }])
            .select()
            .single();

          if (fetchingProfileRef.current !== userId) return;
          if (createError) throw createError;
          setProfile(newData);
          break; // keluar loop, lanjut ke cleanup di bawah
        }

        if (error) throw error;

        setProfile(data);
        break; // keluar loop, lanjut ke cleanup di bawah
      } catch (error) {
        if (attempt === 1) {
          console.error("Error fetching profile:", error);
          if (fetchingProfileRef.current === userId) {
            setProfile(null);
          }
        } else {
          // Tunggu sebentar sebelum retry — hanya jika masih relevan
          await new Promise<void>((resolve) => window.setTimeout(resolve, 300));
          if (fetchingProfileRef.current !== userId) return;
        }
      }
    }

    // Cleanup: hanya reset jika invokasi ini masih yang aktif.
    // Jika tidak (misal signOut sudah clear ref lebih dulu), biarkan saja.
    if (fetchingProfileRef.current === userId) {
      fetchingProfileRef.current = null;
      setLoading(false);
    }
  };

  useEffect(() => {
    const logLogin = (session: Session, source: 'password' | 'session_restore') => {
      if (loginAuditUsers.current.has(session.user.id)) return;
      loginAuditUsers.current.add(session.user.id);
      void auditLogService.logAction({
        action: 'LOGIN',
        entityType: 'AUTH',
        details: { method: source === 'password' ? 'password' : 'existing_session', source },
        userId: session.user.id,
        username: session.user.email,
        userEmail: session.user.email,
      });
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        logLogin(session, 'session_restore');
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        // Jalankan setelah callback auth selesai agar tidak mengunci event loop Auth.
        if (event === 'SIGNED_IN') {
          window.setTimeout(() => {
            logLogin(session, 'password');
          }, 0);
        } else if (event === 'INITIAL_SESSION') {
          logLogin(session, 'session_restore');
        }
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (user) {
      await auditLogService.logAction({
        action: 'LOGOUT',
        entityType: 'AUTH',
        details: { source: 'user_action' },
        userId: user.id,
        username: profile?.username || user.email,
        userEmail: user.email,
        role: profile?.role,
      });
      loginAuditUsers.current.delete(user.id);
    }
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
