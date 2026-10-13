import type { Dispatch, SetStateAction } from "react";
import { isMainTab, readIndexViewState, writeIndexViewState, type MainTab } from "@/components/index/indexConfig";

type UseIndexPageControlsOptions = {
  isUserRestricted: boolean;
  profileCategory?: string | null;
  setSelectedDate: Dispatch<SetStateAction<string>>;
  setSelectedMonth: Dispatch<SetStateAction<string>>;
  setSelectedYear: Dispatch<SetStateAction<string>>;
  setSelectedCategory: Dispatch<SetStateAction<string>>;
  setSelectedRegion: Dispatch<SetStateAction<string>>;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  setActiveTab: Dispatch<SetStateAction<MainTab>>;
};

export const useIndexPageControls = ({
  isUserRestricted,
  profileCategory,
  setSelectedDate,
  setSelectedMonth,
  setSelectedYear,
  setSelectedCategory,
  setSelectedRegion,
  setSearchQuery,
  setActiveTab,
}: UseIndexPageControlsOptions) => {
  const resetFilters = () => {
    setSelectedDate("");
    setSelectedMonth("semua");
    setSelectedYear("semua");
    setSelectedCategory(isUserRestricted ? (profileCategory || "semua") : "semua");
    setSelectedRegion("semua");
    setSearchQuery("");
  };

  const handleRegionChange = (regionId: string) => {
    setSelectedRegion(regionId);
    setSelectedCategory("semua");
  };

  const handleTabChange = (tab: string) => {
    if (!isMainTab(tab)) return;

    writeIndexViewState({
      ...readIndexViewState(),
      activeTab: tab,
      scrollY: window.scrollY,
    });
    setActiveTab(tab);
  };

  return { resetFilters, handleRegionChange, handleTabChange };
};
