import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  USER_ROLES,
  canAccessFuelArea,
  canPrintAdminRecap,
  getRoleLandingPath,
  isSuperAdminAccess,
  isAdminBbmAccess,
  isLaporanBbmAdmin,
  isAdminRencanaKerjaAccess,
  isNotaDinasAdmin,
  isSuperAdminRoles,
  isAdminBbmRoles,
  isLaporanBbmRoles,
  isNotaDinasRoles,
  canAccessFuelAreaRoles,
  getRoleLandingPathRoles,
} from "@/constants/access-control";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading } = useAuth();
  
  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
  if (!session) return <Navigate to="/login" />;

  // Jika session sudah ada tapi profile belum selesai dimuat dari DB,
  // tampilkan spinner daripada memproses redirect dengan profile = null.
  // Kondisi ini terjadi pada jendela waktu singkat antara setSession dan setProfile.
  if (!profile) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;

  const profileRoles = profile.roles ?? [];

  // admin_wilayah_bbm dan admin_rencana_kerja_bbm (dimigrasi ke array multi-role)
  // boleh membuat/edit laporan harian (combined workspace).
  // User yang punya bbm + (laporan_kerja atau rencana_kerja) TIDAK di-redirect.
  const hasLaporanOrRencana = profileRoles.includes('laporan_kerja') || profileRoles.includes('rencana_kerja');
  const isCombinedRkBbm = isAdminBbmRoles(profileRoles) && hasLaporanOrRencana;

  // Backward compat: also check legacy combined role strings
  const isCombinedRkBbmLegacy = profile.role === USER_ROLES.ADMIN_WILAYAH_BBM
    || profile.role === USER_ROLES.ADMIN_RENCANA_KERJA_BBM;

  const combinedExempt = isCombinedRkBbm || isCombinedRkBbmLegacy;

  if (
    (!combinedExempt && (isAdminBbmRoles(profileRoles) || isAdminBbmAccess(profile.role)))
    || isLaporanBbmRoles(profileRoles) || isLaporanBbmAdmin(profile.role)
    || profileRoles.includes('spj_oli') || profile.role === USER_ROLES.ADMIN_SPJ_BBM
    || (!combinedExempt && (profileRoles.includes('rencana_kerja') || isAdminRencanaKerjaAccess(profile.role)))
  ) {
    const landingPath = profileRoles.length > 0
      ? getRoleLandingPathRoles(profileRoles)
      : getRoleLandingPath(profile.role);
    return <Navigate to={landingPath} />;
  }
  
  return <>{children}</>;
};

const WorkPlanWriteRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
  if (!session) return <Navigate to="/login" />;
  if (!profile) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;

  const profileRoles = profile.roles ?? [];

  // admin_wilayah_bbm dan admin_rencana_kerja_bbm (atau multi-role equivalent)
  // boleh membuat/edit rencana kerja (combined workspace), dikecualikan dari redirect.
  const hasRencanaKerja = profileRoles.includes('rencana_kerja');
  const isCombinedRkBbm = isAdminBbmRoles(profileRoles) && hasRencanaKerja;
  const isCombinedRkBbmLegacy = profile.role === USER_ROLES.ADMIN_WILAYAH_BBM
    || profile.role === USER_ROLES.ADMIN_RENCANA_KERJA_BBM;
  const combinedExempt = isCombinedRkBbm || isCombinedRkBbmLegacy;

  if (
    (!combinedExempt && (isAdminBbmRoles(profileRoles) || isAdminBbmAccess(profile.role)))
    || isLaporanBbmRoles(profileRoles) || isLaporanBbmAdmin(profile.role)
    || profileRoles.includes('spj_oli') || profile.role === USER_ROLES.ADMIN_SPJ_BBM
  ) {
    const landingPath = profileRoles.length > 0
      ? getRoleLandingPathRoles(profileRoles)
      : getRoleLandingPath(profile.role);
    return <Navigate to={landingPath} replace />;
  }

  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading } = useAuth();
  
  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
  if (!session) return <Navigate to="/login" />;
  if (!profile) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
  
  const profileRoles = profile.roles ?? [];
  const isAllowed = (profileRoles.length > 0
    ? canAccessFuelAreaRoles(profileRoles) && !isLaporanBbmRoles(profileRoles)
    : canAccessFuelArea(profile?.role, session.user.email) && !isLaporanBbmAdmin(profile?.role));
                    
  if (!isAllowed) return <Navigate to="/" />;
  
  return <>{children}</>;
};

const FuelReportRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;

  const profileRoles = profile.roles ?? [];
  const hasSpjOli = profileRoles.includes('spj_oli');
  const hasLaporanBbm = isLaporanBbmRoles(profileRoles) || isLaporanBbmAdmin(profile.role);
  const canFuel = profileRoles.length > 0
    ? canAccessFuelAreaRoles(profileRoles)
    : canAccessFuelArea(profile.role, session.user.email);

  if (!canFuel || hasSpjOli || profile.role === USER_ROLES.ADMIN_SPJ_OLI || hasLaporanBbm) {
    const landingPath = profileRoles.length > 0
      ? getRoleLandingPathRoles(profileRoles)
      : getRoleLandingPath(profile.role);
    return <Navigate to={landingPath} replace />;
  }

  return <>{children}</>;
};

const LaporanBbmRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;

  const profileRoles = profile.roles ?? [];
  const isAllowed = profileRoles.length > 0
    ? (isSuperAdminRoles(profileRoles) || isLaporanBbmRoles(profileRoles))
    : (isSuperAdminAccess(profile?.role, session.user.email) || isLaporanBbmAdmin(profile?.role));
  if (!isAllowed) {
    const landingPath = profileRoles.length > 0
      ? getRoleLandingPathRoles(profileRoles)
      : getRoleLandingPath(profile?.role);
    return <Navigate to={landingPath} replace />;
  }

  return <>{children}</>;
};

const SpjOliRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;

  const profileRoles = profile.roles ?? [];
  const isAllowed = profileRoles.length > 0
    ? (profileRoles.includes('administrator') || profileRoles.includes('spj_oli') || profileRoles.includes('pimpinan'))
    : (profile?.role === USER_ROLES.ADMIN
      || profile?.role === USER_ROLES.ADMIN_SPJ_BBM
      || profile?.role === USER_ROLES.ADMIN_SPJ_OLI
      || profile?.role === USER_ROLES.PIMPINAN);
  if (!isAllowed) {
    const landingPath = profileRoles.length > 0
      ? getRoleLandingPathRoles(profileRoles)
      : getRoleLandingPath(profile?.role);
    return <Navigate to={landingPath} replace />;
  }

  return <>{children}</>;
};

const NotaDinasRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;

  const profileRoles = profile.roles ?? [];
  const isAllowed = profileRoles.length > 0
    ? (isSuperAdminRoles(profileRoles) || isNotaDinasRoles(profileRoles))
    : (isSuperAdminAccess(profile?.role, session.user.email) || isNotaDinasAdmin(profile?.role));
  const landingPath = profileRoles.length > 0
    ? getRoleLandingPathRoles(profileRoles)
    : getRoleLandingPath(profile?.role);
  return isAllowed ? <>{children}</> : <Navigate to={landingPath} replace />;
};

const NonFuelSpecialistRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;

  const profileRoles = profile.roles ?? [];
  const isFuelOnly = profileRoles.length > 0
    ? (isAdminBbmRoles(profileRoles) || isLaporanBbmRoles(profileRoles) || profileRoles.includes('spj_oli'))
    : (isAdminBbmAccess(profile.role) || isLaporanBbmAdmin(profile.role)
       || profile.role === USER_ROLES.ADMIN_SPJ_BBM || profile.role === USER_ROLES.ADMIN_SPJ_OLI);

  if (isFuelOnly) {
    const landingPath = profileRoles.length > 0
      ? getRoleLandingPathRoles(profileRoles)
      : getRoleLandingPath(profile.role);
    return <Navigate to={landingPath} replace />;
  }

  return <>{children}</>;
};

const WorkPlanAccessRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;

  const profileRoles = profile.roles ?? [];

  // laporan_kerja (lama: LAPORAN) tidak punya akses rencana kerja
  if (profileRoles.includes('laporan_kerja') && !profileRoles.includes('rencana_kerja')) {
    return <Navigate to="/" replace />;
  }
  // Backward compat: legacy LAPORAN role
  if (profileRoles.length === 0 && profile.role === USER_ROLES.LAPORAN) {
    return <Navigate to="/" replace />;
  }

  // Admin rencana kerja (semua varian) boleh akses langsung
  if (profileRoles.includes('rencana_kerja') || isAdminRencanaKerjaAccess(profile.role)) {
    return <>{children}</>;
  }

  // Fuel specialists tidak punya akses rencana kerja — redirect ke landing mereka.
  const isFuelOnly = profileRoles.length > 0
    ? (isAdminBbmRoles(profileRoles) || isLaporanBbmRoles(profileRoles) || profileRoles.includes('spj_oli'))
    : (isAdminBbmAccess(profile.role) || isLaporanBbmAdmin(profile.role)
       || profile.role === USER_ROLES.ADMIN_SPJ_BBM || profile.role === USER_ROLES.ADMIN_SPJ_OLI);

  if (isFuelOnly) {
    const landingPath = profileRoles.length > 0
      ? getRoleLandingPathRoles(profileRoles)
      : getRoleLandingPath(profile.role);
    return <Navigate to={landingPath} replace />;
  }

  return <>{children}</>;
};

const OvertimeAccessRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;

  const profileRoles = profile.roles ?? [];
  const isAllowed = profileRoles.length > 0
    ? (isSuperAdminRoles(profileRoles) || profileRoles.includes('rekap_lembur'))
    : (isSuperAdminAccess(profile?.role, session?.user?.email) || profile?.role === USER_ROLES.ADMIN_REKAP_LEMBUR);
  return isAllowed ? <>{children}</> : <Navigate to="/" replace />;
};

const PrintRekapAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;

  const profileRoles = profile.roles ?? [];
  const isAllowed = profileRoles.length > 0
    ? isSuperAdminRoles(profileRoles)
    : canPrintAdminRecap(profile?.role, session.user.email);
  if (!isAllowed) return <Navigate to="/" replace />;

  return <>{children}</>;
};

export {
  ProtectedRoute,
  WorkPlanWriteRoute,
  AdminRoute,
  FuelReportRoute,
  LaporanBbmRoute,
  SpjOliRoute,
  NotaDinasRoute,
  NonFuelSpecialistRoute,
  WorkPlanAccessRoute,
  OvertimeAccessRoute,
  PrintRekapAdminRoute,
};
