import { Cloud, Database, KeyRound, LogIn, LogOut, Trash2, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getRoleLabel, type UserRole } from "@/constants/access-control";

type Props = {
  logoMedanUrl: string;
  logoDlhUrl: string;
  isLoggedIn: boolean;
  isAdmin: boolean;
  username: string | null | undefined;
  email: string | undefined;
  role: UserRole | undefined;
  onNavigate: (path: string) => void;
  onOpenTrash: () => void;
  onOpenPasswordChange: () => void;
  onLogout: () => void;
};

export function IndexAppHeader({
  logoMedanUrl,
  logoDlhUrl,
  isLoggedIn,
  isAdmin,
  username,
  email,
  role,
  onNavigate,
  onOpenTrash,
  onOpenPasswordChange,
  onLogout,
}: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/70 bg-white/85 shadow-sm backdrop-blur-xl print:hidden">
      <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="flex shrink-0 items-center gap-1 rounded-2xl bg-white px-2 py-1 shadow-sm ring-1 ring-slate-200 sm:gap-2">
            <img src={logoMedanUrl} alt="Logo Kota Medan" className="h-8 w-8 object-contain sm:h-9 sm:w-9" />
            <img src={logoDlhUrl} alt="Logo DLH Kota Medan" className="h-8 w-8 object-contain sm:h-9 sm:w-9" />
          </div>
          <div className="flex min-w-0 flex-col">
            <h1 className="truncate text-xs font-black leading-tight tracking-tight text-slate-900 sm:text-sm md:text-lg">DLH KOTA MEDAN</h1>
            <Badge variant="outline" className="w-fit text-[8px] md:text-[10px] py-0 h-4 bg-emerald-50 text-emerald-700 border-emerald-200 font-bold">
              <Cloud className="h-2 w-2 mr-1" /> SISTEM OPERASIONAL
            </Badge>
          </div>
        </div>

        <div className="ml-2 flex shrink-0 items-center gap-2 md:gap-3">
          {isLoggedIn ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <p className="max-w-40 truncate text-[11px] font-black leading-none text-slate-900">{username || email || "Pengguna"}</p>
                <p className="max-w-40 truncate text-[9px] font-bold text-emerald-700 mt-1">Hak akses: {getRoleLabel(role)}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200">
                    <UserCircle className="h-6 w-6 text-slate-600" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="p-3 border-b bg-slate-50/50">
                    <p className="text-xs font-bold text-slate-900">{username || email}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{role?.toUpperCase()}</p>
                  </div>
                  {isAdmin && <DropdownMenuItem onClick={() => onNavigate("/maintenance")} className="cursor-pointer py-2.5"><Database className="mr-2 h-4 w-4 text-amber-600" /> Maintenance Sistem</DropdownMenuItem>}
                  <DropdownMenuItem onClick={onOpenTrash} className="cursor-pointer py-2.5"><Trash2 className="mr-2 h-4 w-4 text-red-500" /> Tempat Sampah</DropdownMenuItem>
                  <DropdownMenuItem onClick={onOpenPasswordChange} className="cursor-pointer py-2.5"><KeyRound className="mr-2 h-4 w-4 text-emerald-600" /> Ubah Password</DropdownMenuItem>
                  <div className="h-px bg-slate-100 my-1" />
                  <DropdownMenuItem onClick={onLogout} className="cursor-pointer py-2.5 text-red-600 font-bold"><LogOut className="mr-2 h-4 w-4" /> Keluar Sistem</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <Button onClick={() => onNavigate("/login")} size="sm" aria-label="Masuk" title="Masuk" className="h-10 w-10 shrink-0 rounded-full bg-emerald-700 p-0 font-bold shadow-md hover:bg-emerald-800 sm:h-9 sm:w-auto sm:rounded-md sm:px-4">
              <LogIn className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Masuk</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
