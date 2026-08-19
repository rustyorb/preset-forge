import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { OrderEntry, PromptEntry, ProviderConfig, WorkingPreset } from './lib/types';
import { newPreset, normalizePreset, slugify } from './lib/preset';
import { DEFAULT_IDENTIFIERS } from './lib/stDefaults';

interface ForgeState {
  preset: WorkingPreset;
  selectedId: string | null;
  provider: ProviderConfig;
  wizardOpen: boolean;
  settingsOpen: boolean;

  select: (id: string | null) => void;
  importRaw: (raw: unknown, name: string) => void;
  reset: () => void;
  setName: (name: string) => void;
  setParam: (key: string, value: unknown) => void;
  updatePrompt: (id: string, patch: Partial<PromptEntry>) => void;
  toggle: (id: string) => void;
  moveTo: (id: string, beforeId: string | null) => void;
  addModule: (partial?: Partial<PromptEntry>, afterId?: string) => string;
  removeModule: (id: string) => void;
  applyWizard: (
    params: Record<string, number>,
    main: string | undefined,
    modules: PromptEntry[],
  ) => void;
  setProvider: (p: ProviderConfig) => void;
  setWizardOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
}

/** Built-in slots are protected by identifier, not by the imported file's flags. */
const isProtected = (p: PromptEntry | undefined) =>
  !!p && (DEFAULT_IDENTIFIERS.has(p.identifier) || !!p.marker);

/** Insert new order entries after anchorId (after 'main' if present, else at the end). */
function insertIntoOrder(order: OrderEntry[], entries: OrderEntry[], anchorId?: string): OrderEntry[] {
  const next = [...order];
  const anchorIdx = anchorId ? next.findIndex((e) => e.identifier === anchorId) : -1;
  const mainIdx = next.findIndex((e) => e.identifier === 'main');
  const at = anchorIdx !== -1 ? anchorIdx + 1 : mainIdx !== -1 ? mainIdx + 1 : next.length;
  next.splice(at, 0, ...entries);
  return next;
}

// Debounce localStorage writes: a 90-module preset serializes to ~100-300KB and
// zustand persist would otherwise stringify it synchronously on every keystroke.
function debouncedStorage(delayMs: number): Storage {
  let timer: number | undefined;
  let pending: [string, string] | null = null;
  const flush = () => {
    if (!pending) return;
    try {
      localStorage.setItem(pending[0], pending[1]);
    } catch (e) {
      console.warn('PresetForge: autosave failed (localStorage quota?)', e);
    }
    pending = null;
  };
  window.addEventListener('beforeunload', flush);
  return {
    getItem: (k) => localStorage.getItem(k),
    removeItem: (k) => localStorage.removeItem(k),
    setItem: (k, v) => {
      pending = [k, v];
      clearTimeout(timer);
      timer = window.setTimeout(flush, delayMs);
    },
    clear: () => localStorage.clear(),
    key: (i) => localStorage.key(i),
    get length() {
      return localStorage.length;
    },
  };
}

export const useForge = create<ForgeState>()(
  persist(
    (set, get) => ({
      preset: newPreset(),
      selectedId: 'main',
      provider: {
        kind: 'openai',
        baseUrl: 'http://localhost:1234/v1',
        apiKey: '',
        model: '',
      },
      wizardOpen: false,
      settingsOpen: false,

      select: (id) => set({ selectedId: id }),

      importRaw: (raw, name) =>
        set({ preset: normalizePreset(raw, name), selectedId: null }),

      reset: () => set({ preset: newPreset(), selectedId: 'main' }),

      setName: (name) => set((s) => ({ preset: { ...s.preset, name } })),

      setParam: (key, value) =>
        set((s) => ({
          preset: { ...s.preset, params: { ...s.preset.params, [key]: value } },
        })),

      updatePrompt: (id, patch) =>
        set((s) => {
          // First match only: duplicate identifiers exist in broken imports, and
          // the Editor displays the first - patching all copies destroys content.
          const idx = s.preset.prompts.findIndex((p) => p.identifier === id);
          if (idx === -1) return s;
          const prompts = [...s.preset.prompts];
          prompts[idx] = { ...prompts[idx], ...patch };
          return { preset: { ...s.preset, prompts } };
        }),

      toggle: (id) =>
        set((s) => ({
          preset: {
            ...s.preset,
            order: s.preset.order.map((e) =>
              e.identifier === id ? { ...e, enabled: !e.enabled } : e,
            ),
            // Keep the informational prompt-level flag in sync where it exists.
            prompts: s.preset.prompts.map((p) =>
              p.identifier === id && p.enabled !== undefined && !p.marker
                ? { ...p, enabled: !s.preset.order.find((e) => e.identifier === id)?.enabled }
                : p,
            ),
          },
        })),

      moveTo: (id, beforeId) =>
        set((s) => {
          if (id === beforeId) return s;
          const order = [...s.preset.order];
          const src = order.findIndex((e) => e.identifier === id);
          if (src === -1) return s;
          const dstOrig = beforeId === null ? order.length : order.findIndex((e) => e.identifier === beforeId);
          if (dstOrig === -1) return s;
          const [entry] = order.splice(src, 1);
          // Insert at the target's ORIGINAL index: after removal this lands the
          // entry after the hovered row when dragging down (so down-by-one works)
          // and before it when dragging up.
          order.splice(beforeId === null ? order.length : dstOrig, 0, entry);
          return { preset: { ...s.preset, order } };
        }),

      addModule: (partial = {}, afterId) => {
        const name = partial.name ?? 'New Module';
        const id = partial.identifier ?? slugify(name);
        const entry: PromptEntry = {
          identifier: id,
          name,
          system_prompt: false,
          marker: false,
          enabled: false,
          role: 'system',
          content: '',
          injection_position: 0,
          injection_depth: 4,
          injection_order: 100,
          forbid_overrides: false,
          ...partial,
        };
        set((s) => ({
          preset: {
            ...s.preset,
            prompts: [...s.preset.prompts, entry],
            order: insertIntoOrder(
              s.preset.order,
              [{ identifier: id, enabled: !!entry.enabled }],
              afterId ?? s.selectedId ?? undefined,
            ),
          },
          selectedId: id,
        }));
        return id;
      },

      removeModule: (id) => {
        const p = get().preset.prompts.find((x) => x.identifier === id);
        if (isProtected(p)) return;
        set((s) => ({
          preset: {
            ...s.preset,
            prompts: s.preset.prompts.filter((x) => x.identifier !== id),
            order: s.preset.order.filter((e) => e.identifier !== id),
          },
          selectedId: s.selectedId === id ? null : s.selectedId,
        }));
      },

      applyWizard: (params, main, modules) =>
        set((s) => {
          const prompts = [...s.preset.prompts];
          if (main !== undefined) {
            const mainIdx = prompts.findIndex((p) => p.identifier === 'main');
            if (mainIdx !== -1) {
              prompts[mainIdx] = { ...prompts[mainIdx], content: main };
            } else {
              prompts.unshift({
                identifier: 'main',
                name: 'Main Prompt',
                system_prompt: true,
                role: 'system',
                content: main,
                marker: false,
              });
            }
          }
          prompts.push(...modules);
          const order = insertIntoOrder(
            s.preset.order.some((e) => e.identifier === 'main')
              ? s.preset.order
              : [{ identifier: 'main', enabled: true }, ...s.preset.order],
            modules.map((m) => ({ identifier: m.identifier, enabled: !!m.enabled })),
            'main',
          );
          return {
            preset: {
              ...s.preset,
              params: { ...s.preset.params, ...params },
              prompts,
              order,
            },
            selectedId: null,
          };
        }),

      setProvider: (provider) => set({ provider }),
      setWizardOpen: (wizardOpen) => set({ wizardOpen }),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
    }),
    {
      name: 'preset-forge',
      version: 1,
      storage: createJSONStorage(() => debouncedStorage(400)),
      partialize: (s) => ({ preset: s.preset, provider: s.provider }),
      migrate: (persisted) => persisted,
      // Shape-normalize on EVERY rehydrate (not just version bumps): HMR or an
      // old tab can persist a preset missing newer fields under the current version.
      merge: (persisted, current) => {
        const p = persisted as { preset?: WorkingPreset; provider?: ProviderConfig } | undefined;
        const preset = p?.preset;
        if (preset) {
          preset.extraOrders ??= [];
          preset.hadPrompts ??= true;
          preset.importNotes ??= { wasWrapped: false, hadFlatOrder: false };
        }
        return { ...current, ...(p ?? {}) };
      },
    },
  ),
);
