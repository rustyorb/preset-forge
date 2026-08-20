/**
 * Direct link to SillyTavern's presets folder (File System Access API).
 * The user picks data/<user>/OpenAI Settings once; the handle persists in
 * IndexedDB so Save-to-ST / Open-from-ST work across sessions.
 */

const DB_NAME = 'preset-forge-fs';
const STORE = 'handles';
const KEY = 'st-openai-settings';

type DirHandle = FileSystemDirectoryHandle & {
  queryPermission?: (o: { mode: string }) => Promise<PermissionState>;
  requestPermission?: (o: { mode: string }) => Promise<PermissionState>;
  values?: () => AsyncIterable<{ kind: string; name: string }>;
};

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(): Promise<DirHandle | null> {
  const db = await idb();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
    tx.onsuccess = () => resolve((tx.result as DirHandle) ?? null);
    tx.onerror = () => resolve(null);
  });
}

async function idbSet(handle: DirHandle | null): Promise<void> {
  const db = await idb();
  return new Promise((resolve) => {
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
    const tx = handle ? store.put(handle, KEY) : store.delete(KEY);
    tx.onsuccess = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function ensurePermission(handle: DirHandle): Promise<boolean> {
  if ((await handle.queryPermission?.({ mode: 'readwrite' })) === 'granted') return true;
  return (await handle.requestPermission?.({ mode: 'readwrite' })) === 'granted';
}

/** Returns the linked folder handle, re-prompting for permission if needed. */
export async function getLinkedFolder(): Promise<DirHandle | null> {
  const handle = await idbGet();
  if (!handle) return null;
  return (await ensurePermission(handle)) ? handle : null;
}

export async function linkFolder(): Promise<DirHandle> {
  const picker = (
    window as unknown as {
      showDirectoryPicker?: (o?: { mode: string; id?: string }) => Promise<DirHandle>;
    }
  ).showDirectoryPicker;
  if (!picker) throw new Error('Folder linking needs a Chromium browser (File System Access API)');
  const handle = await picker({ mode: 'readwrite', id: 'st-presets' });
  await idbSet(handle);
  return handle;
}

export async function unlinkFolder(): Promise<void> {
  await idbSet(null);
}

export async function listPresetFiles(handle: DirHandle): Promise<string[]> {
  const names: string[] = [];
  if (!handle.values) return names;
  for await (const entry of handle.values()) {
    if (entry.kind === 'file' && entry.name.endsWith('.json')) names.push(entry.name);
  }
  return names.sort((a, b) => a.localeCompare(b));
}

export async function readPresetFile(handle: DirHandle, name: string): Promise<unknown> {
  const fh = await handle.getFileHandle(name);
  const file = await fh.getFile();
  return JSON.parse(await file.text());
}

/** Writes the preset; returns false if it existed and the caller must confirm. */
export async function writePresetFile(
  handle: DirHandle,
  name: string,
  json: unknown,
  overwrite: boolean,
): Promise<'written' | 'exists'> {
  if (!overwrite) {
    try {
      await handle.getFileHandle(name);
      return 'exists';
    } catch {
      /* not there - free to write */
    }
  }
  const fh = await handle.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(JSON.stringify(json, null, 4));
  await w.close();
  return 'written';
}
