import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PromptEntry, ProviderConfig, WorkingPreset } from './lib/types';
import { newPreset, normalizePreset, slugify } from './lib/preset';

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
  move: (id: string, delta: number) => void;
  moveTo: (id: string, beforeId: string | null) => void;
  addModule: (partial?: Partial<PromptEntry>) => string;
  removeModule: (id: string) => void;
  setProvider: (p: ProviderConfig) => void;
  setWizardOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
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
        set((s) => ({
          preset: {
            ...s.preset,
            prompts: s.preset.prompts.map((p) =>
              p.identifier === id ? { ...p, ...patch } : p,
            ),
          },
        })),

      toggle: (id) =>
        set((s) => ({
          preset: {
            ...s.preset,
            order: s.preset.order.map((e) =>
              e.identifier === id ? { ...e, enabled: !e.enabled } : e,
            ),
          },
        })),

      move: (id, delta) =>
        set((s) => {
          const order = [...s.preset.order];
          const i = order.findIndex((e) => e.identifier === id);
          const j = i + delta;
          if (i === -1 || j < 0 || j >= order.length) return s;
          [order[i], order[j]] = [order[j], order[i]];
          return { preset: { ...s.preset, order } };
        }),

      moveTo: (id, beforeId) =>
        set((s) => {
          if (id === beforeId) return s;
          const order = [...s.preset.order];
          const i = order.findIndex((e) => e.identifier === id);
          if (i === -1) return s;
          const [entry] = order.splice(i, 1);
          const j = beforeId === null ? order.length : order.findIndex((e) => e.identifier === beforeId);
          if (j === -1) return s;
          order.splice(j, 0, entry);
          return { preset: { ...s.preset, order } };
        }),

      addModule: (partial = {}) => {
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
        set((s) => {
          const order = [...s.preset.order];
          const sel = s.selectedId;
          const selIdx = sel ? order.findIndex((e) => e.identifier === sel) : -1;
          const insertAt =
            selIdx !== -1 ? selIdx + 1 : order.findIndex((e) => e.identifier === 'main') + 1;
          order.splice(insertAt, 0, { identifier: id, enabled: !!entry.enabled });
          return {
            preset: { ...s.preset, prompts: [...s.preset.prompts, entry], order },
            selectedId: id,
          };
        });
        return id;
      },

      removeModule: (id) => {
        const p = get().preset.prompts.find((x) => x.identifier === id);
        if (p?.system_prompt || p?.marker) return; // protect built-ins
        set((s) => ({
          preset: {
            ...s.preset,
            prompts: s.preset.prompts.filter((x) => x.identifier !== id),
            order: s.preset.order.filter((e) => e.identifier !== id),
          },
          selectedId: s.selectedId === id ? null : s.selectedId,
        }));
      },

      setProvider: (provider) => set({ provider }),
      setWizardOpen: (wizardOpen) => set({ wizardOpen }),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
    }),
    {
      name: 'preset-forge',
      partialize: (s) => ({ preset: s.preset, provider: s.provider }),
    },
  ),
);
