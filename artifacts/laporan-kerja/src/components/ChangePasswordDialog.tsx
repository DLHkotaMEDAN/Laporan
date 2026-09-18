import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { showError, showSuccess } from "@/utils/toast";
import { auditLogService } from "@/services/auditLogService";

type ChangePasswordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const getAuthErrorMessage = (message: string) => {
  if (/invalid login credentials/i.test(message)) return "Password lama salah.";
  if (/same password/i.test(message)) return "Password baru harus berbeda dari password lama.";
  if (/password should be at least/i.test(message)) return "Password baru minimal 8 karakter.";
  return "Password gagal diubah. Silakan coba lagi.";
};

const ChangePasswordDialog = ({ open, onOpenChange }: ChangePasswordDialogProps) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswords(false);
      setIsSaving(false);
    }
  }, [open]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (newPassword.length < 8) {
      showError("Password baru minimal 8 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showError("Konfirmasi password baru tidak cocok.");
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        showError("Email akun tidak ditemukan. Silakan login kembali.");
        return;
      }

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (verifyError) {
        showError(getAuthErrorMessage(verifyError.message));
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        showError(getAuthErrorMessage(updateError.message));
        return;
      }

      await auditLogService.logCurrentUser({
        action: "UPDATE",
        entityType: "AUTH",
        details: { source: "user_action", action: "change_password" },
      });
      showSuccess("Password berhasil diubah.");
      onOpenChange(false);
    } catch (error) {
      console.error("Error changing password:", error);
      showError("Password gagal diubah. Silakan coba lagi.");
    } finally {
      setIsSaving(false);
    }
  };

  const inputType = showPasswords ? "text" : "password";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[430px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-700">
            <KeyRound className="h-5 w-5" /> Ubah Password
          </DialogTitle>
          <DialogDescription>
            Masukkan password lama untuk memverifikasi akun, kemudian buat password baru.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="current-password" className="text-sm font-semibold text-slate-700">Password Lama</label>
            <Input
              id="current-password"
              type={inputType}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="Masukkan password lama"
              required
              disabled={isSaving}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="new-password" className="text-sm font-semibold text-slate-700">Password Baru</label>
            <Input
              id="new-password"
              type={inputType}
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Minimal 8 karakter"
              minLength={8}
              required
              disabled={isSaving}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirm-password" className="text-sm font-semibold text-slate-700">Konfirmasi Password Baru</label>
            <Input
              id="confirm-password"
              type={inputType}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Ketik ulang password baru"
              minLength={8}
              required
              disabled={isSaving}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowPasswords((visible) => !visible)}
            className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
            disabled={isSaving}
          >
            {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showPasswords ? "Sembunyikan password" : "Tampilkan password"}
          </button>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>Batal</Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSaving ? "Menyimpan..." : "Simpan Password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePasswordDialog;
