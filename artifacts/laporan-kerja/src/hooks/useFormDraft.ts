import { useCallback, useEffect, useRef, useState } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

const DATABASE_NAME = "dlh-form-drafts";
const STORE_NAME = "drafts";
const EXPIRY_MS = 14 * 24 * 60 * 60 * 1000;

type StoredDraft<T> = {
  savedAt: number;
  values: T;
  view?: DraftViewState;
};

type DraftViewState = {
  selector?: string;
  selectionStart?: number | null;
  selectionEnd?: number | null;
  scrollX: number;
  scrollY: number;
};

const getActiveSelector = (element: Element | null) => {
  if (!(element instanceof HTMLElement)) return undefined;
  if (element.id) return `#${CSS.escape(element.id)}`;
  const name = element.getAttribute("name");
  if (name) return `[name="${CSS.escape(name)}"]`;
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) return `[aria-label="${CSS.escape(ariaLabel)}"]`;
  const path: string[] = [];
  let current: Element | null = element;
  while (current && current !== document.body) {
    const parent = current.parentElement;
    if (!parent) break;
    const siblingIndex = Array.from(parent.children).indexOf(current) + 1;
    path.unshift(`${current.tagName.toLowerCase()}:nth-child(${siblingIndex})`);
    current = parent;
  }
  return path.length ? `body > ${path.join(" > ")}` : undefined;
};

const captureViewState = (): DraftViewState => {
  const activeElement = document.activeElement;
  const selectionElement = activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement
    ? activeElement
    : null;
  return {
    selector: getActiveSelector(activeElement),
    selectionStart: selectionElement?.selectionStart ?? null,
    selectionEnd: selectionElement?.selectionEnd ?? null,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
  };
};

const restoreViewState = (state?: DraftViewState) => {
  if (!state) return;
  const restore = () => {
    window.scrollTo(state.scrollX, state.scrollY);
    if (!state.selector) return;
    const element = document.querySelector(state.selector);
    if (!(element instanceof HTMLElement)) return;
    element.focus({ preventScroll: true });
    if (
      (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) &&
      state.selectionStart !== null && state.selectionStart !== undefined &&
      state.selectionEnd !== null && state.selectionEnd !== undefined
    ) {
      element.setSelectionRange(state.selectionStart, state.selectionEnd);
    }
    window.scrollTo(state.scrollX, state.scrollY);
  };

  // Form arrays and conditional fields may need one extra render before the
  // saved field exists in the DOM.
  window.requestAnimationFrame(() => {
    restore();
    window.requestAnimationFrame(restore);
  });
};

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = window.indexedDB.open(DATABASE_NAME, 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) {
      request.result.createObjectStore(STORE_NAME);
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const readDraft = async <T,>(key: string) => {
  const database = await openDatabase();
  return new Promise<StoredDraft<T> | undefined>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result as StoredDraft<T> | undefined);
    request.onerror = () => reject(request.error);
  }).finally(() => database.close());
};

const writeDraft = async <T,>(key: string, draft: StoredDraft<T>) => {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(draft, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }).finally(() => database.close());
};

const deleteDraft = async (key: string) => {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }).finally(() => database.close());
};

/** Menyimpan isian form hanya di perangkat, termasuk saat browser menjadi tidak aktif. */
// RHF's resolver output can be narrower than its FieldValues constraint for
// deeply nested Zod schemas. The hook only reads/resets values, so accepting
// the form instance at runtime avoids coupling draft persistence to resolver
// variance while preserving the stored value type.
export function useFormDraft<T extends FieldValues>(form: UseFormReturn<any>, key?: string) {
  const [isReady, setIsReady] = useState(!key);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const readyRef = useRef(!key);
  const savingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const shouldPersistRef = useRef(Boolean(key));
  const saveTimerRef = useRef<number | null>(null);

  const save = useCallback(async () => {
    if (!key || !readyRef.current || !shouldPersistRef.current) return;
    if (savingRef.current) {
      pendingSaveRef.current = true;
      return;
    }
    savingRef.current = true;
    pendingSaveRef.current = false;
    const savedAt = Date.now();
    try {
      await writeDraft(key, { savedAt, values: form.getValues(), view: captureViewState() });
      if (!shouldPersistRef.current) {
        await deleteDraft(key);
        return;
      }
      setLastSavedAt(savedAt);
    } catch (error) {
      // Draf bersifat pelindung tambahan; form tetap dapat digunakan jika penyimpanan perangkat tidak tersedia.
      console.warn("Tidak dapat menyimpan draf formulir", error);
    } finally {
      savingRef.current = false;
      if (pendingSaveRef.current && shouldPersistRef.current) {
        void save();
      }
    }
  }, [form, key]);

  useEffect(() => {
    let active = true;
    readyRef.current = !key;
    shouldPersistRef.current = Boolean(key);
    setIsReady(!key);
    setRestoredAt(null);

    if (!key) return;

    void (async () => {
      try {
        const draft = await readDraft<T>(key);
        if (!active) return;
        if (draft && Date.now() - draft.savedAt <= EXPIRY_MS) {
          form.reset(draft.values);
          setRestoredAt(draft.savedAt);
          setLastSavedAt(draft.savedAt);
          restoreViewState(draft.view);
        } else if (draft) {
          await deleteDraft(key);
        }
      } catch (error) {
        console.warn("Tidak dapat memuat draf formulir", error);
      } finally {
        if (active) {
          readyRef.current = true;
          setIsReady(true);
        }
      }
    })();

    return () => { active = false; };
  }, [form, key]);

  useEffect(() => {
    if (!key) return;
    const subscription = form.watch(() => {
      if (!readyRef.current) return;
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => { void save(); }, 350);
    });
    const saveImmediately = () => { void save(); };
    document.addEventListener("visibilitychange", saveImmediately);
    window.addEventListener("pagehide", saveImmediately);
    return () => {
      subscription.unsubscribe();
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      document.removeEventListener("visibilitychange", saveImmediately);
      window.removeEventListener("pagehide", saveImmediately);
      void save();
    };
  }, [form, key, save]);

  const clearDraft = useCallback(async () => {
    if (!key) return;
    shouldPersistRef.current = false;
    try {
      await deleteDraft(key);
      setLastSavedAt(null);
    } catch (error) {
      console.warn("Tidak dapat menghapus draf formulir", error);
    }
  }, [key]);

  return { clearDraft, isReady, lastSavedAt, restoredAt };
}

/** Versi draf untuk form yang memakai useState biasa, bukan react-hook-form. */
export function useValueDraft<T>(values: T, restore: (values: T) => void, key?: string) {
  const [isReady, setIsReady] = useState(!key);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const valuesRef = useRef(values);
  const restoreRef = useRef(restore);
  const readyRef = useRef(!key);
  const shouldPersistRef = useRef(Boolean(key));
  const savingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

  valuesRef.current = values;
  restoreRef.current = restore;

  const save = useCallback(async () => {
    if (!key || !readyRef.current || !shouldPersistRef.current) return;
    if (savingRef.current) {
      pendingSaveRef.current = true;
      return;
    }
    savingRef.current = true;
    pendingSaveRef.current = false;
    const savedAt = Date.now();
    try {
      await writeDraft(key, { savedAt, values: valuesRef.current, view: captureViewState() });
      setLastSavedAt(savedAt);
    } catch (error) {
      console.warn("Tidak dapat menyimpan draf formulir", error);
    } finally {
      savingRef.current = false;
      if (pendingSaveRef.current && shouldPersistRef.current) void save();
    }
  }, [key]);

  useEffect(() => {
    let active = true;
    readyRef.current = !key;
    shouldPersistRef.current = Boolean(key);
    setIsReady(!key);
    setRestoredAt(null);
    if (!key) return;

    void (async () => {
      try {
        const draft = await readDraft<T>(key);
        if (!active || !draft) return;
        if (Date.now() - draft.savedAt <= EXPIRY_MS) {
          restoreRef.current(draft.values);
          setRestoredAt(draft.savedAt);
          setLastSavedAt(draft.savedAt);
          restoreViewState(draft.view);
        } else {
          await deleteDraft(key);
        }
      } catch (error) {
        console.warn("Tidak dapat memuat draf formulir", error);
      } finally {
        if (active) {
          readyRef.current = true;
          setIsReady(true);
        }
      }
    })();
    return () => { active = false; };
  }, [key]);

  useEffect(() => {
    if (!key || !readyRef.current) return;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => { void save(); }, 350);
    return () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    };
  }, [key, save, values]);

  useEffect(() => {
    if (!key) return;
    const saveImmediately = () => { void save(); };
    document.addEventListener("visibilitychange", saveImmediately);
    window.addEventListener("pagehide", saveImmediately);
    return () => {
      document.removeEventListener("visibilitychange", saveImmediately);
      window.removeEventListener("pagehide", saveImmediately);
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      void save();
    };
  }, [key, save]);

  const clearDraft = useCallback(async () => {
    if (!key) return;
    shouldPersistRef.current = false;
    try {
      await deleteDraft(key);
      setLastSavedAt(null);
    } catch (error) {
      console.warn("Tidak dapat menghapus draf formulir", error);
    }
  }, [key]);

  return { clearDraft, isReady, lastSavedAt, restoredAt };
}
