import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { getIndexAccess } from "@/components/index/indexAccess";

type IndexAccess = ReturnType<typeof getIndexAccess>;

type UseIndexDataEffectsOptions = {
  authLoading: boolean;
  isLoggedIn: boolean;
  profile: { category?: string | null } | null;
  access: IndexAccess;
  loadRecordCounts: () => Promise<unknown>;
  loadData: (date?: string, month?: string, year?: string, category?: string) => Promise<boolean>;
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
  const lastLoadKeyRef = useRef<string | null>(null);
  const {
    isAdminLaporanBbm,
    isAdminSpj,
    isAdminSpjOli,
    isNotaDinasOnly,
    accountRegionId,
    isUserRestricted,
    isAdmin,
  } = access;

  useEffect(() => {
    if (authLoading || !isLoggedIn) return;
    void loadRecordCounts();
  }, [authLoading, isLoggedIn, loadRecordCounts]);

  useEffect(() => {
    if (authLoading || !isLoggedIn) return;
    // Super admin selalu default ke "semua wilayah"
    if (isAdmin && selectedRegion !== "semua") {
      setSelectedRegion("semua");
    } else if (accountRegionId && selectedRegion !== accountRegionId) {
      setSelectedRegion(accountRegionId);
    }
    if (isUserRestricted && profile?.category) {
      setSelectedCategory(profile.category);
    }
  }, [authLoading, isLoggedIn, isAdmin, accountRegionId, isUserRestricted, profile?.category, selectedRegion]);

  useEffect(() => {
    if (authLoading || !isLoggedIn) return;

    // These roles load their own data inside their tab components.
    if (isAdminSpj || isAdminSpjOli || isAdminLaporanBbm || isNotaDinasOnly) {
      setLoading(false);
      return;
    }

    // Wait until the persisted filters have been normalized for the logged-in
    // account. This prevents an initial request with stale region/category
    // filters followed by a second request after normalization.
    const regionNeedsNormalization =
      (isAdmin && selectedRegion !== "semua")
      || (Boolean(accountRegionId) && selectedRegion !== accountRegionId);
    const categoryNeedsNormalization =
      isUserRestricted && Boolean(profile?.category) && selectedCategory !== profile?.category;

    if (regionNeedsNormalization || categoryNeedsNormalization) return;

    const loadKey = [
      selectedDate,
      selectedMonth,
      selectedYear,
      selectedCategory,
      selectedRegion,
      accountRegionId ?? "",
      isAdmin,
      isUserRestricted,
      profile?.category ?? "",
    ].join("|");

    // Auth callbacks can update loading/profile state without changing the
    // actual filters. Do not issue the same dashboard request again.
    if (lastLoadKeyRef.current === loadKey) return;
    lastLoadKeyRef.current = loadKey;

    void loadData(selectedDate, selectedMonth, selectedYear, selectedCategory).then((succeeded) => {
      if (!succeeded && lastLoadKeyRef.current === loadKey) {
        lastLoadKeyRef.current = null;
      }
    });
  // loadData is intentionally omitted: it is recreated by the controller,
  // while the explicit filter/access dependencies below define this effect.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isLoggedIn, isAdminSpj, isAdminSpjOli, isAdminLaporanBbm, isNotaDinasOnly, isAdmin, accountRegionId, isUserRestricted, profile?.category, selectedRegion, selectedCategory, selectedDate, selectedMonth, selectedYear]);

  useEffect(() => {
    if (selectedCategory !== "semua" && !categories.includes(selectedCategory)) {
      setSelectedCategory(isUserRestricted ? (profile?.category || "semua") : "semua");
    }
  }, [categories, isUserRestricted, profile?.category, selectedCategory]);
};
