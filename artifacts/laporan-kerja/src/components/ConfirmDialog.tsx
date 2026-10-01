import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, LogOut, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ConfirmDialogVariant = 'danger' | 'warning' | 'logout';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}

const variantConfig: Record<ConfirmDialogVariant, {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  confirmClass: string;
}> = {
  danger: {
    icon: <Trash2 className="h-5 w-5" />,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    confirmClass: 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500 text-white',
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5" />,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    confirmClass: 'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500 text-white',
  },
  logout: {
    icon: <LogOut className="h-5 w-5" />,
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
    confirmClass: 'bg-slate-700 hover:bg-slate-800 focus-visible:ring-slate-500 text-white',
  },
};

export const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  variant = 'danger',
  loading = false,
  onConfirm,
}: ConfirmDialogProps) => {
  const config = variantConfig[variant];

  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={loading ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[400px] gap-0 p-0 overflow-hidden">
        <div className="p-6 pb-4">
          <DialogHeader className="gap-3">
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
                config.iconBg,
              )}>
                <span className={config.iconColor}>{config.icon}</span>
              </div>
              {/* Text */}
              <div className="space-y-1 pt-0.5">
                <DialogTitle className="text-base font-bold text-slate-900 leading-snug">
                  {title}
                </DialogTitle>
                <DialogDescription className="text-sm text-slate-500 leading-relaxed">
                  {description}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Divider */}
        <div className="h-px bg-slate-100" />

        {/* Footer */}
        <DialogFooter className="flex flex-row items-center justify-end gap-2 bg-slate-50/80 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="h-9 min-w-[80px] border-slate-200 text-slate-700 hover:bg-slate-100"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={cn('h-9 min-w-[120px] font-semibold shadow-sm', config.confirmClass)}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Memproses...
              </>
            ) : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmDialog;
