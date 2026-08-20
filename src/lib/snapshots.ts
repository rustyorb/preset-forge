import type { WorkingPreset } from './types';

/**
 * Preset snapshots: a small per-preset ring buffer in its own localStorage key
 * (kept out of the zustand store so 300KB copies don't ride every autosave).
 */

export interface Snapshot {
  label: string;
  at: string; // ISO timestamp
  preset: WorkingPreset;
}

const KEY = 'preset-forge-snapshots';
const MAX_PER_PRESET = 5;

type SnapshotMap = Record<string, Snapshot[]>;

function loadAll(): SnapshotMap {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as SnapshotMap;
  } catch {
    return {};
  }
}

function saveAll(map: SnapshotMap): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
    return true;
  } catch (e) {
    console.warn('PresetForge: snapshot save failed (quota?)', e);
    return false;
  }
}

export function loadSnapshots(presetId: string): Snapshot[] {
  return loadAll()[presetId] ?? [];
}

export function pushSnapshot(presetId: string, preset: WorkingPreset, label: string): boolean {
  const map = loadAll();
  const list = map[presetId] ?? [];
  list.unshift({ label, at: new Date().toISOString(), preset: structuredClone(preset) });
  map[presetId] = list.slice(0, MAX_PER_PRESET);
  if (saveAll(map)) return true;
  // Quota fallback: drop oldest snapshots app-wide and retry once.
  for (const k of Object.keys(map)) map[k] = map[k].slice(0, 1);
  return saveAll(map);
}

export function deleteSnapshot(presetId: string, index: number): void {
  const map = loadAll();
  map[presetId] = (map[presetId] ?? []).filter((_, i) => i !== index);
  if (!map[presetId].length) delete map[presetId];
  saveAll(map);
}

/** Structural diff between two presets, for the snapshot view. */
export interface PresetDiff {
  added: string[];
  removed: string[];
  contentChanged: string[];
  toggled: { name: string; enabled: boolean }[];
  paramChanges: { key: string; from: unknown; to: unknown }[];
  orderMoved: boolean;
}

export function diffPresets(from: WorkingPreset, to: WorkingPreset): PresetDiff {
  const fromById = new Map(from.prompts.map((p) => [p.identifier, p]));
  const toById = new Map(to.prompts.map((p) => [p.identifier, p]));
  const nameOf = (id: string) => toById.get(id)?.name ?? fromById.get(id)?.name ?? id;

  const added = to.prompts.filter((p) => !fromById.has(p.identifier)).map((p) => p.name);
  const removed = from.prompts.filter((p) => !toById.has(p.identifier)).map((p) => p.name);
  const contentChanged = to.prompts
    .filter((p) => {
      const old = fromById.get(p.identifier);
      return (
        old &&
        (old.content !== p.content ||
          old.name !== p.name ||
          old.role !== p.role ||
          old.injection_position !== p.injection_position ||
          old.injection_depth !== p.injection_depth)
      );
    })
    .map((p) => p.name);

  const fromEnabled = new Map(from.order.map((e) => [e.identifier, e.enabled]));
  const toggled = to.order
    .filter((e) => fromEnabled.has(e.identifier) && fromEnabled.get(e.identifier) !== e.enabled)
    .map((e) => ({ name: nameOf(e.identifier), enabled: e.enabled }));

  const paramChanges: PresetDiff['paramChanges'] = [];
  const keys = new Set([...Object.keys(from.params), ...Object.keys(to.params)]);
  for (const key of keys) {
    if (key === 'extensions') continue; // too noisy; regex tab owns it
    if (JSON.stringify(from.params[key]) !== JSON.stringify(to.params[key])) {
      paramChanges.push({ key, from: from.params[key], to: to.params[key] });
    }
  }

  const sharedFrom = from.order.map((e) => e.identifier).filter((id) => toById.has(id) || fromById.has(id));
  const sharedTo = to.order.map((e) => e.identifier).filter((id) => fromById.has(id));
  const orderMoved =
    JSON.stringify(sharedFrom.filter((id) => sharedTo.includes(id))) !==
    JSON.stringify(sharedTo.filter((id) => sharedFrom.includes(id)));

  return { added, removed, contentChanged, toggled, paramChanges, orderMoved };
}
