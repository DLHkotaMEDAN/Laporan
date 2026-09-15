"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Lock, User, Eye, EyeOff } from 'lucide-react';
import { showError } from '@/utils/toast';
import { getRoleLandingPath } from '@/constants/access-control';

const Login = () => {
  const { session, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (session && profile && !authLoading) {
      navigate(getRoleLandingPath(profile.role), { replace: true });
    }
  }, [session, profile, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      showError("Username dan Password wajib diisi");
      return;
    }

    setLoading(true);
    try {
      // Menangani input username agar otomatis menjadi email gmail jika tidak ada @
      const email = username.includes('@') ? username : `${username}@gmail.com`;
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
    } catch (error: any) {
      console.error("Login error:", error);
      showError(error.message === "Invalid login credentials" 
        ? "Username atau Password salah" 
        : "Gagal masuk ke sistem. Pastikan akun sudah terdaftar.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-blue-600">
        <CardHeader className="text-center space-y-2 pb-6">
          <div className="space-y-1">
            <CardTitle className="text-xl md:text-2xl font-bold leading-tight">
              SISTEM LAPORAN
            </CardTitle>
            <p className="text-sm md:text-base font-semibold text-blue-700">
              Dinas Lingkungan Hidup Kota Medan
            </p>
          </div>
          <p className="text-slate-500 text-xs mt-2">Silakan masuk untuk mengelola laporan</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Ketik username Anda"
                  className="pl-10"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Kata Sandi</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Ketik kata sandi"
                  className="pl-10 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="mt-2 block w-full" style={{ width: '100%' }}>
              <Button
                type="submit"
                style={{ width: '100%', minWidth: '100%', display: 'inline-flex' }}
                className="h-11 w-full min-w-full shrink-0 items-center justify-center whitespace-nowrap bg-blue-600 font-bold hover:bg-blue-700"
                disabled={loading}
              >
                <span className="inline-flex w-full items-center justify-center whitespace-nowrap">
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" /> Memproses...</>
                  ) : (
                    "Masuk"
                  )}
                </span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
