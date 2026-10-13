import React from 'react';
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Check } from 'lucide-react';
import {
  PERMISSION_LABELS,
  PermissionKey,
  ADMINISTRATOR_KEY,
} from '@/constants/access-control';

interface RolesDropdownProps {
  selectedRoles: string[];
  onChange: (roles: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

const RolesDropdown = ({
  selectedRoles,
  onChange,
  disabled = false,
  placeholder = 'Pilih hak akses...'
}: RolesDropdownProps) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  // Tutup dropdown jika klik di luar
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (key: string) => {
    if (disabled) return;
    if (key === ADMINISTRATOR_KEY) {
      // Administrator eksklusif — pilih ini hapus semua lain, uncheck ini hapus semua
      onChange(selectedRoles.includes(ADMINISTRATOR_KEY) ? [] : [ADMINISTRATOR_KEY]);
    } else {
      if (selectedRoles.includes(ADMINISTRATOR_KEY)) return; // administrator aktif, tidak bisa tambah lain
      onChange(
        selectedRoles.includes(key)
          ? selectedRoles.filter(r => r !== key)
          : [...selectedRoles, key]
      );
    }
  };

  const displayText = selectedRoles.length === 0
    ? placeholder
    : selectedRoles.map(r => PERMISSION_LABELS[r as PermissionKey] ?? r).join(', ');

  return (
    <div ref={ref} className="relative w-full">
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(prev => !prev)}
        className={cn(
          "flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm",
          "min-h-[36px] text-left transition-colors",
          open && "ring-1 ring-ring",
          disabled && "cursor-not-allowed opacity-50",
          selectedRoles.length === 0 && "text-muted-foreground"
        )}
      >
        <span className="flex flex-wrap gap-1 pr-2 leading-snug">
          {selectedRoles.length === 0 ? (
            <span>{placeholder}</span>
          ) : (
            selectedRoles.map(r => (
              <Badge key={r} variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-800 border-blue-300">
                {PERMISSION_LABELS[r as PermissionKey] ?? r}
              </Badge>
            ))
          )}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {/* Dropdown list */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-input bg-white shadow-md">
          <div className="max-h-64 overflow-y-auto p-1">
            {(Object.keys(PERMISSION_LABELS) as PermissionKey[]).map(key => {
              const isChecked = selectedRoles.includes(key);
              const isDisabledItem = key !== ADMINISTRATOR_KEY && selectedRoles.includes(ADMINISTRATOR_KEY);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={isDisabledItem}
                  onClick={() => toggle(key)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left transition-colors",
                    "hover:bg-slate-100 focus:outline-none",
                    isDisabledItem && "cursor-not-allowed opacity-40",
                    isChecked && "text-blue-700 font-medium"
                  )}
                >
                  {/* Ceklist box */}
                  <span className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    isChecked ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-white"
                  )}>
                    {isChecked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                  </span>
                  {PERMISSION_LABELS[key]}
                </button>
              );
            })}
          </div>
          {selectedRoles.length > 0 && (
            <div className="border-t px-2 py-1.5">
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-slate-500 hover:text-red-600 transition-colors"
              >
                Hapus semua pilihan
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RolesDropdown;
