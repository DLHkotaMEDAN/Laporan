import { useEffect, type Dispatch, type SetStateAction } from "react";
import { showSuccess } from "@/utils/toast";

type UseNotaDinasViewStateOptions = {
  isActive?: boolean;
  viewStorageKey?: string;
  setViewState: Dispatch<SetStateAction<"list" | "form">>;
  restoredAt: number | null;
};

export const useNotaDinasViewState = ({
  isActive,
  viewStorageKey,
  setViewState,
  restoredAt,
}: UseNotaDinasViewStateOptions) => {
  useEffect(() => {
    if (!isActive || !viewStorageKey || typeof window === "undefined") return;
    const savedView = window.localStorage.getItem(viewStorageKey);
    setViewState(savedView === "form" ? "form" : "list");
  }, [isActive, viewStorageKey, setViewState]);

  useEffect(() => {
    if (restoredAt) showSuccess("Draft Nota Dinas sebelumnya dipulihkan.");
  }, [restoredAt]);
};
