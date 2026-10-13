import { useEffect, useRef } from "react";
import { readIndexViewState, writeIndexViewState } from "@/components/index/indexConfig";

export function useIndexScrollPersistence(loading: boolean, savedScrollY: number | undefined) {
  const hasRestoredScrollRef = useRef(false);

  useEffect(() => {
    const saveScrollPosition = () => {
      writeIndexViewState({
        ...readIndexViewState(),
        scrollY: window.scrollY,
      });
    };

    window.addEventListener("pagehide", saveScrollPosition);
    window.addEventListener("blur", saveScrollPosition);
    document.addEventListener("visibilitychange", saveScrollPosition);

    return () => {
      saveScrollPosition();
      window.removeEventListener("pagehide", saveScrollPosition);
      window.removeEventListener("blur", saveScrollPosition);
      document.removeEventListener("visibilitychange", saveScrollPosition);
    };
  }, []);

  useEffect(() => {
    if (hasRestoredScrollRef.current || loading || typeof savedScrollY !== "number") return;

    hasRestoredScrollRef.current = true;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: savedScrollY });
    });
  }, [loading, savedScrollY]);
}
