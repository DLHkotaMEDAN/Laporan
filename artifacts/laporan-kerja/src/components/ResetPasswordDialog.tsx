import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KeyRound, Eye, EyeOff, Loader2, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/lib/supabase';

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  username: string;
}

const getStrength = (password: string): { score: number; label: string; color: string } => {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: 'Sangat Lemah', color: 'bg-red-500' };
  if (score === 2) return { score, label: 'Lemah', color: 'bg-orange-500' };
  if (score === 3) return { score, label: 'Cukup', color: 'bg-amber-500' };
  if (score === 4) return { score, label: 'Kuat', color: 'bg-emerald-500' };
  return { score, label: 'Sangat Kuat', color: 'bg-emerald-600' };
};

export const ResetPasswordDialog = ({
  open,
  onOpenChange,
  userId,
  username,
}: ResetPasswordDialogProps) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setLoading(false);
    }
  }, [open]);

  const strength = getStrength(password);
  const isMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  const isMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const isValid = password.length >= 8 && isMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { action: 'reset-password', userId, password },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      showSuccess(`Password ${username} berhasil diubah.`);
      onOpenChange(false);
    } catch (err: any) {
      showError('Gagal mengubah password: ' + (err?.message || 'Terjadi kesalahan.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={loading ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[440px] gap-0 p-0 overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4">
          <DialogHeader className="gap-3">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100">
                <KeyRound className="h-5 w-5 text-blue-600" />
              </div>
              <div className="space-y-1 pt-0.5">
                <DialogTitle className="text-base font-bold text-slate-900">
                  Reset Password
                </DialogTitle>
                <DialogDescription className="text-sm text-slate-500">
                  Atur password baru untuk akun{' '}
                  <span className="font-semibold text-slate-700">{username}</span>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="h-px bg-slate-100" />

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Password baru */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">
              Password Baru
            </label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimal 8 karakter"
                autoComplete="new-password"
                disabled={loading}
                className="pr-10"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Strength bar */}
            {password.length > 0 && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div
                      key={i}
                      className={cn(
                        'h-1 flex-1 rounded-full transition-all duration-300',
                        i <= strength.score ? strength.color : 'bg-slate-200',
                      )}
                    />
                  ))}
                </div>
                <p className={cn(
                  'text-xs font-medium',
                  strength.score <= 2 ? 'text-red-500' :
                  strength.score === 3 ? 'text-amber-500' : 'text-emerald-600',
                )}>
                  {strength.label}
                </p>
              </div>
            )}
          </div>

          {/* Konfirmasi password */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">
              Konfirmasi Password
            </label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Ketik ulang password baru"
                autoComplete="new-password"
                disabled={loading}
                className={cn(
                  'pr-10',
                  isMatch && 'border-emerald-400 focus-visible:ring-emerald-400',
                  isMismatch && 'border-red-400 focus-visible:ring-red-400',
                )}
                required
              />
              {/* Match indicator */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isMatch && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                {isMismatch && <XCircle className="h-4 w-4 text-red-500" />}
              </div>
            </div>
            {isMismatch && (
              <p className="text-xs text-red-500">Password tidak cocok</p>
            )}
          </div>

          {/* Tips keamanan */}
          {password.length > 0 && strength.score <= 2 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <ShieldCheck className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <p className="text-xs text-amber-700">
                Gunakan kombinasi huruf besar, angka, dan simbol untuk password yang lebih kuat.
              </p>
            </div>
          )}

          <div className="h-px bg-slate-100" />

          <DialogFooter className="gap-2 pt-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="h-9 border-slate-200 text-slate-700"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={!isValid || loading}
              className="h-9 min-w-[140px] bg-blue-600 hover:bg-blue-700 font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Simpan Password
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ResetPasswordDialog;
