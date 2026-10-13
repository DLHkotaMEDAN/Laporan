import { useEffect } from "react";
import { writeIndexViewState, type MainTab } from "@/components/index/indexConfig";

type UseIndexViewStatePersistenceOptions = {
  activeTab: MainTab;
  searchQuery: string;
  selectedRegion: string;
  selectedDate: string;
  selectedMonth: string;
  selectedYear: string;
  selectedCategory: string;
};

export const useIndexViewStatePersistence = ({
  activeTab,
  searchQuery,
  selectedRegion,
  selectedDate,
  selectedMonth,
  selectedYear,
  selectedCategory,
}: UseIndexViewStatePersistenceOptions) => {
  useEffect(() => {
    writeIndexViewState({
      activeTab,
      searchQuery,
      selectedRegion,
      selectedDate,
      selectedMonth,
      selectedYear,
      selectedCategory,
      scrollY: window.scrollY,
    });
  }, [activeTab, searchQuery, selectedRegion, selectedDate, selectedMonth, selectedYear, selectedCategory]);
};
