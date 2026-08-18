import type { OrderEntry, PromptEntry, WorkingPreset } from './types';
import { DEFAULT_ORDER, DUMMY_IDS, defaultPrompts } from './stDefaults';

/** Parse a raw SillyTavern preset JSON object into the working model. */
export function normalizePreset(raw: unknown, name: string): WorkingPreset {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Preset must be a JSON object');
  }
  let obj = raw as Record<string, unknown>;

  // Unwrap the community-guide {"version","type","data"} hallucination so the
  // user can still salvage such files (lint reports it separately).
  if (!('prompts' in obj) && typeof obj.data === 'object' && obj.data !== null && ('version' in obj || 'type' in obj)) {
    obj = obj.data as Record<string, unknown>;
  }

  const prompts: PromptEntry[] = Array.isArray(obj.prompts)
    ? (obj.prompts as PromptEntry[]).filter((p) => p && typeof p === 'object')
    : [];

  let order: OrderEntry[] = [];
  const po = obj.prompt_order;
  if (Array.isArray(po) && po.length) {
    if (po.every((e) => e && typeof e === 'object' && 'identifier' in e && !('character_id' in e))) {
      // Flat list (broken guide format) - salvage it as the order.
      order = (po as OrderEntry[]).map((e) => ({ identifier: e.identifier, enabled: !!e.enabled }));
    } else {
      const entries = po as { character_id?: number; order?: OrderEntry[] }[];
      const pick =
        entries.find((e) => e.character_id === 100001) ??
        entries.find((e) => e.character_id === 100000) ??
        entries[0];
      order = (pick?.order ?? []).map((e) => ({ identifier: e.identifier, enabled: !!e.enabled }));
    }
  }
  if (!order.length) order = structuredClone(DEFAULT_ORDER);

  const params: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k !== 'prompts' && k !== 'prompt_order') params[k] = v;
  }

  return { name, params, prompts, order };
}

/** Serialize the working model back to an importable flat preset. */
export function exportPreset(wp: WorkingPreset): Record<string, unknown> {
  const order = wp.order.map((e) => ({ identifier: e.identifier, enabled: e.enabled }));
  return {
    ...wp.params,
    prompts: wp.prompts.map((p) => ({ ...p })),
    prompt_order: DUMMY_IDS.map((id) => ({
      character_id: id,
      order: order.map((e) => ({ ...e })),
    })),
  };
}

export function newPreset(name = 'New Preset'): WorkingPreset {
  return {
    name,
    params: {
      temperature: 0.85,
      top_p: 0.95,
      openai_max_context: 32768,
      openai_max_tokens: 2048,
    },
    prompts: defaultPrompts(),
    order: structuredClone(DEFAULT_ORDER),
  };
}

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'module'}-${crypto.randomUUID().slice(0, 8)}`;
}
