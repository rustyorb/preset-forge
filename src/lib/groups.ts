import type { PromptEntry, WorkingPreset } from './types';
import { DEFAULT_IDENTIFIERS } from './stDefaults';

/**
 * A module acts as a section header when it follows a divider convention:
 * contentless non-core module (Chimera style), an "=== Banner ===" name
 * (NemoEngine style), or a name led by box-drawing characters.
 */
export function isSectionHeader(p: Partial<PromptEntry> | undefined): boolean {
  if (!p || p.marker || !p.identifier || DEFAULT_IDENTIFIERS.has(p.identifier)) return false;
  const name = p.name ?? '';
  if (/^\s*={2,}.*={2,}\s*$/.test(name)) return true;
  if (/^[━─═▬]{2,}/.test(name)) return true;
  return !(p.content ?? '').trim();
}

/**
 * Mutual-exclusion groups by naming convention: modules named
 * "🔗 <Group>: <Variant>" are exclusive within <Group> (case-insensitive).
 * e.g. "🔗 POV: First Person" / "🔗 POV: Third Person".
 */
export function parseGroupKey(name: string | undefined): string | null {
  if (!name) return null;
  const m = name.match(/^🔗\s*(.+?)\s*[:：]/u);
  return m ? m[1].trim().toLowerCase() : null;
}

/** identifiers of other modules in the same exclusion group */
export function groupSiblings(wp: WorkingPreset, identifier: string): string[] {
  const self = wp.prompts.find((p) => p.identifier === identifier);
  const key = parseGroupKey(self?.name);
  if (!key) return [];
  return wp.prompts
    .filter((p) => p.identifier !== identifier && parseGroupKey(p.name) === key)
    .map((p) => p.identifier);
}

/** groups with 2+ enabled members: { key, enabledNames } */
export function conflictingGroups(wp: WorkingPreset): { key: string; names: string[] }[] {
  const enabled = new Set(wp.order.filter((e) => e.enabled).map((e) => e.identifier));
  const byKey = new Map<string, string[]>();
  for (const p of wp.prompts) {
    const key = parseGroupKey(p.name);
    if (key && enabled.has(p.identifier)) {
      byKey.set(key, [...(byKey.get(key) ?? []), p.name]);
    }
  }
  return [...byKey.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([key, names]) => ({ key, names }));
}
