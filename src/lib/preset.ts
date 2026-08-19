import type { OrderEntry, PromptEntry, WorkingPreset } from './types';
import { DEFAULT_ORDER, DUMMY_IDS, defaultPrompts } from './stDefaults';

/** Parse a raw SillyTavern preset JSON object into the working model. */
export function normalizePreset(raw: unknown, name: string): WorkingPreset {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Preset must be a JSON object');
  }
  let obj = raw as Record<string, unknown>;

  // Unwrap the community-guide {"version","type","data"} hallucination so the
  // user can still salvage such files. Lint re-detects it via the note below.
  let wasWrapped = false;
  if (
    !('prompts' in obj) &&
    typeof obj.data === 'object' &&
    obj.data !== null &&
    !Array.isArray(obj.data) &&
    ('version' in obj || 'type' in obj)
  ) {
    obj = obj.data as Record<string, unknown>;
    wasWrapped = true;
  }

  const hadPrompts = Array.isArray(obj.prompts);
  const prompts: PromptEntry[] = hadPrompts
    ? (obj.prompts as PromptEntry[]).filter((p) => p && typeof p === 'object')
    : [];

  let order: OrderEntry[] = [];
  const extraOrders: { character_id: number; order: OrderEntry[] }[] = [];
  let hadFlatOrder = false;
  const po = obj.prompt_order;
  if (Array.isArray(po) && po.length) {
    if (po.every((e) => e && typeof e === 'object' && 'identifier' in e && !('character_id' in e))) {
      // Flat list (broken guide format) - salvage it as the order.
      order = cloneOrder(po as OrderEntry[]);
      hadFlatOrder = true;
    } else {
      const entries = po as { character_id?: number; order?: OrderEntry[] }[];
      const pick =
        entries.find((e) => e.character_id === 100001) ??
        entries.find((e) => e.character_id === 100000) ??
        entries[0];
      order = cloneOrder(pick?.order ?? []);
      // Preserve per-character (non-dummy) entries verbatim for export.
      for (const e of entries) {
        if (e !== pick && typeof e.character_id === 'number' && !DUMMY_IDS.includes(e.character_id)) {
          extraOrders.push({ character_id: e.character_id, order: cloneOrder(e.order ?? []) });
        }
      }
    }
  }
  // Only fabricate defaults when the source actually had a prompt system.
  if (!order.length && hadPrompts) order = structuredClone(DEFAULT_ORDER);

  const params: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k !== 'prompts' && k !== 'prompt_order') params[k] = v;
  }

  return {
    name,
    params,
    prompts,
    order,
    extraOrders,
    hadPrompts,
    importNotes: {
      wasWrapped,
      hadFlatOrder,
    },
  };
}

function cloneOrder(entries: OrderEntry[]): OrderEntry[] {
  const seen = new Set<string>();
  const out: OrderEntry[] = [];
  for (const e of entries) {
    if (!e || typeof e.identifier !== 'string' || seen.has(e.identifier)) continue;
    seen.add(e.identifier);
    out.push({ identifier: e.identifier, enabled: !!e.enabled });
  }
  return out;
}

/** Serialize the working model back to an importable flat preset. */
export function exportPreset(wp: WorkingPreset): Record<string, unknown> {
  const out: Record<string, unknown> = { ...wp.params };

  // Sampler-only presets stay sampler-only unless the user added modules.
  if (wp.hadPrompts || wp.prompts.length > 0 || wp.order.length > 0) {
    const enabledById = new Map(wp.order.map((e) => [e.identifier, e.enabled]));
    out.prompts = wp.prompts.map((p) => {
      const copy = { ...p };
      // order[].enabled is authoritative; keep the informational flag in sync.
      if (!p.marker && copy.enabled !== undefined && enabledById.has(p.identifier)) {
        copy.enabled = enabledById.get(p.identifier);
      }
      return copy;
    });
    out.prompt_order = [
      ...DUMMY_IDS.map((id) => ({
        character_id: id,
        order: wp.order.map((e) => ({ identifier: e.identifier, enabled: e.enabled })),
      })),
      ...(wp.extraOrders ?? []).map((e) => ({
        character_id: e.character_id,
        order: e.order.map((o) => ({ ...o })),
      })),
    ];
  }
  return out;
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
    extraOrders: [],
    hadPrompts: true,
    importNotes: { wasWrapped: false, hadFlatOrder: false },
  };
}

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  // crypto.randomUUID needs a secure context; LAN-over-HTTP serving does not have one.
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(16).slice(2, 10);
  return `${base || 'module'}-${suffix}`;
}
