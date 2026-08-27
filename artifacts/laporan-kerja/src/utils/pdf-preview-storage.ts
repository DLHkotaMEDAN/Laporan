const databaseName = "laporan-kerja-pdf-preview";
const storeName = "documents";

export type StoredPdfPreview = { fileName: string; pdf: Blob };

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(databaseName, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(storeName);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export const savePdfPreview = async (value: StoredPdfPreview) => {
  const key = crypto.randomUUID();
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(storeName, "readwrite").objectStore(storeName).put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  database.close();
  return key;
};

export const readPdfPreview = async (key: string) => {
  const database = await openDatabase();
  const value = await new Promise<StoredPdfPreview | undefined>((resolve, reject) => {
    const request = database.transaction(storeName).objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result as StoredPdfPreview | undefined);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return value;
};
