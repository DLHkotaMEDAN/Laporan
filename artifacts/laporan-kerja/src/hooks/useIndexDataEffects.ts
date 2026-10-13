import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { useNavigate } from "react-router-dom";
import type { getIndexAccess } from "@/components/index/indexAccess";

type IndexAccess = ReturnType<typeof getIndexAccess>;
type Navigate = ReturnType<typeof useNavigate>;

type UseIndexDataEffectsOptions = {
  authLoading: boolean;
  isLoggedIn: boolean;
  profile: { category?: string | null } | null;
  access: IndexAccess;
  navigate: Navigate;
  loadRecordCounts: () => Promise<unknown>;
  loadData: (date?: string, month?: string, year?: string, category?: string) => Promise<unknown> | void;
  selectedDate: string;
  selectedMonth: string;
  selectedYear: string;
  selectedCategory: string;
  selectedRegion: string;
  categories: string[];
  setLoading: Dispatch<SetStateAction<boolean>>;
  setSelectedRegion: Dispatch<SetStateAction<string>>;
  setSelectedCategory: Dispatch<SetStateAction<string>>;
};

export const useIndexDataEffects = ({
  authLoading,
  isLoggedIn,
  profile,
  access,
  navigate,
  loadRecordCounts,
  loadData,
  selectedDate,
  selectedMonth,
  selectedYear,
  selectedCategory,
  selectedRegion,
  categories,
  setLoading,
  setSelectedRegion,
  setSelectedCategory,
}: UseIndexDataEffectsOptions) => {
  const {
    isAdminBbm,
    isAdminBbmPusat,
    isAdminLaporanBbm,
    isAdminSpj,
    isAdminSpjOli,
    isNotaDinasOnly,
    accountRegionId,
    isUserRestricted,
  } = access;

  useEffect(() => {
    if (authLoading || !isLoggedIn) return;
    void loadRecordCounts();
    // Admin SPJ Oli hanya memerlukan data SPJ Oli; akses tabel lain tetap mengikuti RLS.
    if (isAdminSpj || isAdminSpjOli || isAdminLaporanBbm || isNotaDinasOnly) {
      setLoading(false);
      return;
    }
    loadData();
    if (accountRegionId && selectedRegion !== accountRegionId) {
      setSelectedRegion(accountRegionId);
    }
    if (isUserRestricted && profile?.category) {
      setSelectedCategory(profile.category);
    }
  }, [profile, isLoggedIn, isAdminBbm, isAdminBbmPusat, isAdminLaporanBbm, isAdminSpj, isAdminSpjOli, authLoading, navigate, accountRegionId]);

  // Kirim filter eksplisit agar tidak membaca stale closure saat React memproses state bersamaan.
  useEffect(() => {
    if (authLoading || !isLoggedIn) return;
    if (isAdminSpj || isAdminSpjOli || isAdminLaporanBbm || isNotaDinasOnly) return;
    void loadData(selectedDate, selectedMonth, selectedYear, selectedCategory);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedMonth, selectedYear, selectedCategory]);

  useEffect(() => {
    if (selectedCategory !== "semua" && !categories.includes(selectedCategory)) {
      setSelectedCategory(isUserRestricted ? (profile?.category || "semua") : "semua");
    }
  }, [categories, isUserRestricted, profile?.category, selectedCategory]);
};
