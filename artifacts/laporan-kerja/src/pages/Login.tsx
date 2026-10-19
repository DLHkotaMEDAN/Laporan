import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Lock, User, Eye, EyeOff, AlertTriangle, ShieldAlert } from 'lucide-react';
import { showError } from '@/utils/toast';
import { getRoleLandingPath, getLoginDestination, getLoginDestinationRoles } from '@/constants/access-control';
import { getErrorMessage } from '@/lib/logger';

// Email valid: harus ada karakter sebelum @, domain setelah @, dan TLD minimal 2 karakter
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Key untuk sessionStorage — berlaku selama tab browser aktif
const STORAGE_KEY_FAIL_COUNT = 'dlh:login:failCount';
const STORAGE_KEY_LOCKED_UNTIL = 'dlh:login:lockedUntil';

const readFailCount = (): number => {
  try { return parseInt(sessionStorage.getItem(STORAGE_KEY_FAIL_COUNT) ?? '0', 10) || 0; }
  catch { return 0; }
};

const readLockedUntil = (): number | null => {
  try {
    const v = sessionStorage.getItem(STORAGE_KEY_LOCKED_UNTIL);
    if (!v) return null;
    const n = parseInt(v, 10);
    // Buang nilai yang sudah kadaluarsa
    if (n <= Date.now()) {
      sessionStorage.removeItem(STORAGE_KEY_LOCKED_UNTIL);
      return null;
    }
    return n;
  } catch { return null; }
};

const writeRateLimit = (failCount: number, lockedUntil: number | null) => {
  try {
    sessionStorage.setItem(STORAGE_KEY_FAIL_COUNT, String(failCount));
    if (lockedUntil !== null) {
      sessionStorage.setItem(STORAGE_KEY_LOCKED_UNTIL, String(lockedUntil));
    } else {
      sessionStorage.removeItem(STORAGE_KEY_LOCKED_UNTIL);
    }
  } catch { /* sessionStorage tidak tersedia — fallback ke in-memory */ }
};

const clearRateLimit = () => {
  try {
    sessionStorage.removeItem(STORAGE_KEY_FAIL_COUNT);
    sessionStorage.removeItem(STORAGE_KEY_LOCKED_UNTIL);
  } catch { /* abaikan */ }
};

// Batas maksimum percobaan sebelum lockout sementara
const MAX_ATTEMPTS = 5;
// Durasi lockout dalam detik
const LOCKOUT_DURATION = 60;
// Jeda eksponensial per percobaan (detik): percobaan ke-2=2s, ke-3=5s, ke-4=10s, ke-5=20s
const BACKOFF_SECONDS = [0, 0, 2, 5, 10, 20];

const Login = () => {
  const { session, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // State rate limiting — diinisialisasi dari sessionStorage agar tetap berlaku saat refresh
  const [failCount, setFailCount] = useState<number>(() => readFailCount());
  const [lockedUntil, setLockedUntil] = useState<number | null>(() => readLockedUntil());
  const [countdown, setCountdown] = useState<number>(() => {
    const until = readLockedUntil();
    if (until !== null) {
      const remaining = Math.ceil((until - Date.now()) / 1000);
      return remaining > 0 ? remaining : 0;
    }
    return 0;
  });
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (session && profile && !authLoading) {
      // Prefer roles[] (multi-role); fall back to legacy single role
      const destination = (profile.roles && profile.roles.length > 0)
        ? getLoginDestinationRoles(profile.roles)
        : getLoginDestination(profile.role);
      navigate(destination, { replace: true });
    }
  }, [session, profile, authLoading, navigate]);

  // Countdown timer untuk lockout dan jeda eksponensial
  useEffect(() => {
    if (countdown <= 0) {
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [countdown]);

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;
  const isThrottled = countdown > 0;
  const isDisabled = loading || isLocked || isThrottled;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Cek lockout
    if (isLocked) return;
    // Cek jeda eksponensial
    if (isThrottled) return;

    if (!username.trim() || !password) {
      showError("Username dan Password wajib diisi");
      return;
    }

    setLoading(true);
    try {
      // Pertahankan fitur @gmail.com otomatis
      const email = EMAIL_REGEX.test(username.trim())
        ? username.trim()
        : `${username.trim()}@gmail.com`;

      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) throw error;

      // Login berhasil — reset counter dan hapus dari sessionStorage
      setFailCount(0);
      setLockedUntil(null);
      setCountdown(0);
      clearRateLimit();
    } catch (error: unknown) {
      const isInvalidCredential =
        getErrorMessage(error) === 'Invalid login credentials' ||
        getErrorMessage(error)?.toLowerCase().includes('invalid');

      const newFailCount = failCount + 1;
      setFailCount(newFailCount);

      if (newFailCount >= MAX_ATTEMPTS) {
        // Lockout sementara
        const until = Date.now() + LOCKOUT_DURATION * 1000;
        setLockedUntil(until);
        setCountdown(LOCKOUT_DURATION);
        writeRateLimit(newFailCount, until);
        showError(`Terlalu banyak percobaan gagal. Silakan coba lagi dalam ${LOCKOUT_DURATION} detik.`);
      } else {
        // Jeda eksponensial
        const backoff = BACKOFF_SECONDS[newFailCount] ?? 0;
        writeRateLimit(newFailCount, null);
        if (backoff > 0) {
          setCountdown(backoff);
          showError(
            isInvalidCredential
              ? `Username atau Password salah. Tunggu ${backoff} detik sebelum mencoba lagi.`
              : `Gagal masuk. Tunggu ${backoff} detik sebelum mencoba lagi.`
          );
        } else {
          showError(
            isInvalidCredential
              ? 'Username atau Password salah'
              : 'Gagal masuk ke sistem. Pastikan akun sudah terdaftar.'
          );
        }
      }

      setLoading(false);
    }
  };

  // Label tombol sesuai kondisi
  const getButtonLabel = () => {
    if (loading) return <><Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" /> Memproses...</>;
    if (isLocked) return <><ShieldAlert className="mr-2 h-4 w-4 shrink-0" /> Terkunci ({countdown}d)</>;
    if (isThrottled) return <><Loader2 className="mr-2 h-4 w-4 shrink-0" /> Tunggu {countdown} detik...</>;
    return 'Masuk';
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

            {/* Peringatan lockout */}
            {isLocked && (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <ShieldAlert className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-700">Akses Sementara Dikunci</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    Terlalu banyak percobaan gagal. Coba lagi dalam{' '}
                    <span className="font-bold">{countdown} detik</span>.
                  </p>
                </div>
              </div>
            )}

            {/* Peringatan jeda */}
            {!isLocked && isThrottled && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-700">Percobaan Gagal ({failCount}/{MAX_ATTEMPTS})</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Silakan tunggu <span className="font-bold">{countdown} detik</span> sebelum mencoba lagi.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="username"
                  data-testid="username"
                  type="text"
                  placeholder="Ketik username Anda"
                  className="pl-10"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isDisabled}
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Kata Sandi</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  data-testid="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Ketik kata sandi"
                  className="pl-10 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isDisabled}
                  autoComplete="current-password"
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
                className="h-11 w-full min-w-full shrink-0 items-center justify-center whitespace-nowrap bg-blue-600 font-bold hover:bg-blue-700 disabled:opacity-60"
                disabled={isDisabled}
              >
                <span className="inline-flex w-full items-center justify-center whitespace-nowrap">
                  {getButtonLabel()}
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
