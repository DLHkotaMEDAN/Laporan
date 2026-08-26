import { useCallback, useEffect, useRef, useState } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

const DATABASE_NAME = "dlh-form-drafts";
const STORE_NAME = "drafts";
const EXPIRY_MS = 14 * 24 * 60 * 60 * 1000;

type StoredDraft<T> = {
  savedAt: number;
  values: T;
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

/** Menyimpan isian form di perangkat, termasuk saat browser menjadi tidak aktif. */
export function useFormDraft<T extends FieldValues>(form: UseFormReturn<T>, key?: string) {
  const [isReady, setIsReady] = useState(!key);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const readyRef = useRef(!key);
  const savingRef = useRef(false);
  const shouldPersistRef = useRef(Boolean(key));

  const save = useCallback(async () => {
    if (!key || !readyRef.current || !shouldPersistRef.current || savingRef.current) return;
    savingRef.current = true;
    const savedAt = Date.now();
    try {
      await writeDraft(key, { savedAt, values: form.getValues() });
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
      window.setTimeout(() => { void save(); }, 350);
    });
    const saveImmediately = () => { void save(); };
    document.addEventListener("visibilitychange", saveImmediately);
    window.addEventListener("pagehide", saveImmediately);
    return () => {
      subscription.unsubscribe();
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
