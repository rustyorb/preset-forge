import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CardData } from './lib/cards';
import type { OrderEntry, PromptEntry, ProviderConfig, WorkingPreset } from './lib/types';
import { newPreset, normalizePreset, slugify } from './lib/preset';
import { DEFAULT_IDENTIFIERS } from './lib/stDefaults';
import { groupSiblings } from './lib/groups';
import { generateReadmeContent } from './lib/readme';
import { writeRegexScripts, type RegexScript } from './lib/regex';
import { pushSnapshot } from './lib/snapshots';
import type { TcKind, TcTemplate } from './lib/tcTemplates';

interface ForgeState {
  /** preset library: id -> preset; activeId always exists in the map */
  presets: Record<string, WorkingPreset>;
  activeId: string;
  selectedId: string | null;
  /** reusable module blocks, shared across all presets */
  library: PromptEntry[];
  provider: ProviderConfig;
  card: CardData | null;
  wizardOpen: boolean;
  settingsOpen: boolean;
  advisorOpen: boolean;
  /** one-shot "open this module and highlight this text" request (Vars tab jump) */
  jumpTo: { identifier: string; needle: string } | null;

  select: (id: string | null) => void;
  setJumpTo: (j: { identifier: string; needle: string } | null) => void;
  importRaw: (raw: unknown, name: string) => void;
  newPresetSlot: () => void;
  duplicatePreset: () => void;
  deletePreset: () => void;
  switchPreset: (id: string) => void;
  setName: (name: string) => void;
  setParam: (key: string, value: unknown) => void;
  updatePrompt: (id: string, patch: Partial<PromptEntry>) => void;
  toggle: (id: string) => void;
  setEnabled: (flags: Record<string, boolean>) => void;
  moveTo: (id: string, beforeId: string | null) => void;
  addModule: (partial?: Partial<PromptEntry>, afterId?: string) => string;
  removeModule: (id: string) => void;
  applyWizard: (
    params: Record<string, number>,
    main: string | undefined,
    modules: PromptEntry[],
  ) => void;
  renamePromptContent: (rewrite: (content: string) => string) => void;
  setRegexScripts: (scripts: RegexScript[]) => void;
  upsertReadme: () => void;
  saveToLibrary: (id: string) => void;
  insertFromLibrary: (index: number) => void;
  removeFromLibrary: (index: number) => void;
  takeSnapshot: (label: string) => void;
  restorePreset: (preset: WorkingPreset) => void;
  snapshotsOpen: boolean;
  setSnapshotsOpen: (open: boolean) => void;
  /** Text Completion template slots (instruct / context / sysprompt) */
  tc: Partial<Record<TcKind, TcTemplate>>;
  setTcTemplate: (kind: TcKind, tpl: TcTemplate | null) => void;
  updateTcField: (kind: TcKind, key: string, value: unknown) => void;
  tcOpen: boolean;
  setTcOpen: (open: boolean) => void;
  setCard: (card: CardData | null) => void;
  setProvider: (p: ProviderConfig) => void;
  setWizardOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setAdvisorOpen: (open: boolean) => void;
}

/** Selector for the active preset - the one components subscribe to. */
export const useActivePreset = (): WorkingPreset => useForge((s) => s.presets[s.activeId]);

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

function presetShapeFix(p: WorkingPreset): WorkingPreset {
  p.extraOrders ??= [];
  p.hadPrompts ??= true;
  p.importNotes ??= { wasWrapped: false, hadFlatOrder: false };
  return p;
}

// Debounce localStorage writes: multiple 100-300KB presets would otherwise be
// stringified synchronously on every keystroke.
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

const firstId = slugify('preset');

export const useForge = create<ForgeState>()(
  persist(
    (set, get) => {
      /** Immutable update of the active preset. */
      const patchActive = (fn: (p: WorkingPreset) => WorkingPreset) =>
        set((s) => ({
          presets: { ...s.presets, [s.activeId]: fn(s.presets[s.activeId]) },
        }));

      return {
        presets: { [firstId]: newPreset() },
        activeId: firstId,
        selectedId: 'main',
        library: [],
        provider: {
          service: 'lmstudio',
          kind: 'openai',
          baseUrl: 'http://localhost:1234/v1',
          apiKey: '',
          model: '',
        },
        card: null,
        wizardOpen: false,
        settingsOpen: false,
        advisorOpen: false,
        jumpTo: null,

        select: (id) => set({ selectedId: id }),
        setJumpTo: (jumpTo) => set({ jumpTo }),

        importRaw: (raw, name) => {
          const id = slugify(name || 'imported');
          set((s) => ({
            presets: { ...s.presets, [id]: normalizePreset(raw, name) },
            activeId: id,
            selectedId: null,
          }));
        },

        newPresetSlot: () => {
          const id = slugify('preset');
          set((s) => ({
            presets: { ...s.presets, [id]: newPreset() },
            activeId: id,
            selectedId: 'main',
          }));
        },

        duplicatePreset: () => {
          const s = get();
          const src = s.presets[s.activeId];
          const id = slugify(src.name);
          const copy = structuredClone(src);
          copy.name = `${src.name} copy`;
          set({
            presets: { ...s.presets, [id]: copy },
            activeId: id,
          });
        },

        deletePreset: () => {
          set((s) => {
            const presets = { ...s.presets };
            delete presets[s.activeId];
            let activeId = Object.keys(presets)[0];
            if (!activeId) {
              activeId = slugify('preset');
              presets[activeId] = newPreset();
            }
            return { presets, activeId, selectedId: null };
          });
        },

        switchPreset: (id) =>
          set((s) => (s.presets[id] ? { activeId: id, selectedId: null } : s)),

        setName: (name) => patchActive((p) => ({ ...p, name })),

        setParam: (key, value) =>
          patchActive((p) => ({ ...p, params: { ...p.params, [key]: value } })),

        updatePrompt: (id, patch) =>
          patchActive((p) => {
            // First match only: duplicate identifiers exist in broken imports, and
            // the Editor displays the first - patching all copies destroys content.
            const idx = p.prompts.findIndex((x) => x.identifier === id);
            if (idx === -1) return p;
            const prompts = [...p.prompts];
            prompts[idx] = { ...prompts[idx], ...patch };
            return { ...p, prompts };
          }),

        toggle: (id) =>
          patchActive((p) => {
            const turningOn = !p.order.find((e) => e.identifier === id)?.enabled;
            // 🔗 exclusion groups: enabling one member disables its siblings.
            const off = new Set(turningOn ? groupSiblings(p, id) : []);
            const flag = (ident: string, current: boolean) =>
              ident === id ? turningOn : off.has(ident) ? false : current;
            return {
              ...p,
              order: p.order.map((e) => ({ ...e, enabled: flag(e.identifier, e.enabled) })),
              // Keep the informational prompt-level flag in sync where it exists.
              prompts: p.prompts.map((x) =>
                x.enabled !== undefined && !x.marker
                  ? { ...x, enabled: flag(x.identifier, x.enabled) }
                  : x,
              ),
            };
          }),

        setEnabled: (flags) =>
          patchActive((p) => ({
            ...p,
            order: p.order.map((e) =>
              flags[e.identifier] === undefined ? e : { ...e, enabled: flags[e.identifier] },
            ),
            prompts: p.prompts.map((x) =>
              flags[x.identifier] === undefined || x.enabled === undefined || x.marker
                ? x
                : { ...x, enabled: flags[x.identifier] },
            ),
          })),

        moveTo: (id, beforeId) =>
          patchActive((p) => {
            if (id === beforeId) return p;
            const order = [...p.order];
            const src = order.findIndex((e) => e.identifier === id);
            if (src === -1) return p;
            const dstOrig =
              beforeId === null ? order.length : order.findIndex((e) => e.identifier === beforeId);
            if (dstOrig === -1) return p;
            const [entry] = order.splice(src, 1);
            // Insert at the target's ORIGINAL index: after removal this lands the
            // entry after the hovered row when dragging down (so down-by-one works)
            // and before it when dragging up.
            order.splice(beforeId === null ? order.length : dstOrig, 0, entry);
            return { ...p, order };
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
          const anchor = afterId ?? get().selectedId ?? undefined;
          patchActive((p) => ({
            ...p,
            prompts: [...p.prompts, entry],
            order: insertIntoOrder(p.order, [{ identifier: id, enabled: !!entry.enabled }], anchor),
          }));
          set({ selectedId: id });
          return id;
        },

        removeModule: (id) => {
          const s = get();
          const p = s.presets[s.activeId].prompts.find((x) => x.identifier === id);
          if (isProtected(p)) return;
          patchActive((wp) => ({
            ...wp,
            prompts: wp.prompts.filter((x) => x.identifier !== id),
            order: wp.order.filter((e) => e.identifier !== id),
          }));
          if (get().selectedId === id) set({ selectedId: null });
        },

        applyWizard: (params, main, modules) => {
          // Wizard mutations are the biggest single edits - auto-snapshot first.
          get().takeSnapshot('before wizard');
          patchActive((wp) => {
            const prompts = [...wp.prompts];
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
              wp.order.some((e) => e.identifier === 'main')
                ? wp.order
                : [{ identifier: 'main', enabled: true }, ...wp.order],
              modules.map((m) => ({ identifier: m.identifier, enabled: !!m.enabled })),
              'main',
            );
            return { ...wp, params: { ...wp.params, ...params }, prompts, order };
          });
          set({ selectedId: null });
        },

        renamePromptContent: (rewrite) =>
          patchActive((p) => ({
            ...p,
            prompts: p.prompts.map((x) =>
              typeof x.content === 'string' && x.content.includes('{{')
                ? { ...x, content: rewrite(x.content) }
                : x,
            ),
          })),

        setRegexScripts: (scripts) =>
          patchActive((p) => ({ ...p, params: writeRegexScripts(p.params, scripts) })),

        upsertReadme: () => {
          const s = get();
          const wp = s.presets[s.activeId];
          const content = generateReadmeContent(wp);
          if (wp.prompts.some((p) => p.identifier === 'forge-readme')) {
            get().updatePrompt('forge-readme', { content });
          } else {
            patchActive((p) => ({
              ...p,
              prompts: [
                ...p.prompts,
                {
                  identifier: 'forge-readme',
                  name: '📖 README',
                  system_prompt: false,
                  marker: false,
                  enabled: false,
                  role: 'system' as const,
                  content,
                  injection_position: 0 as const,
                  injection_depth: 4,
                  injection_order: 100,
                  forbid_overrides: false,
                },
              ],
              // README rides at the very top of the manager list, disabled.
              order: [{ identifier: 'forge-readme', enabled: false }, ...p.order],
            }));
          }
          set({ selectedId: 'forge-readme' });
        },

        saveToLibrary: (id) => {
          const s = get();
          const p = s.presets[s.activeId].prompts.find((x) => x.identifier === id);
          if (!p || p.marker) return;
          // Stored as a template; a fresh identifier is minted on insert.
          set({ library: [...s.library, structuredClone(p)] });
        },

        insertFromLibrary: (index) => {
          const entry = get().library[index];
          if (!entry) return;
          const copy: PromptEntry = { ...structuredClone(entry), identifier: slugify(entry.name) };
          get().addModule(copy);
        },

        removeFromLibrary: (index) =>
          set((s) => ({ library: s.library.filter((_, i) => i !== index) })),

        takeSnapshot: (label) => {
          const s = get();
          pushSnapshot(s.activeId, s.presets[s.activeId], label);
        },

        restorePreset: (preset) => {
          // Keep an escape hatch: snapshot the current state before replacing it.
          const s = get();
          pushSnapshot(s.activeId, s.presets[s.activeId], 'before restore');
          set({
            presets: { ...s.presets, [s.activeId]: structuredClone(preset) },
            selectedId: null,
          });
        },

        snapshotsOpen: false,
        setSnapshotsOpen: (snapshotsOpen) => set({ snapshotsOpen }),

        tc: {},
        setTcTemplate: (kind, tpl) =>
          set((s) => {
            const tc = { ...s.tc };
            if (tpl) tc[kind] = tpl;
            else delete tc[kind];
            return { tc };
          }),
        updateTcField: (kind, key, value) =>
          set((s) => {
            const cur = s.tc[kind];
            if (!cur) return s;
            return { tc: { ...s.tc, [kind]: { ...cur, [key]: value } } };
          }),
        tcOpen: false,
        setTcOpen: (tcOpen) => set({ tcOpen }),

        setCard: (card) => set({ card }),
        setProvider: (provider) => set({ provider }),
        setWizardOpen: (wizardOpen) => set({ wizardOpen }),
        setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
        setAdvisorOpen: (advisorOpen) => set({ advisorOpen }),
      };
    },
    {
      name: 'preset-forge',
      version: 2,
      storage: createJSONStorage(() => debouncedStorage(400)),
      partialize: (s) => ({
        presets: s.presets,
        activeId: s.activeId,
        provider: s.provider,
        card: s.card,
        library: s.library,
        tc: s.tc,
      }),
      migrate: (persisted) => persisted,
      // Shape-normalize on EVERY rehydrate (not just version bumps): HMR or an
      // old tab can persist data missing newer fields under the current version.
      merge: (persisted, current) => {
        const p = persisted as
          | {
              preset?: WorkingPreset; // v1 single-slot shape
              presets?: Record<string, WorkingPreset>;
              activeId?: string;
              provider?: ProviderConfig;
              card?: CardData | null;
            }
          | undefined;
        if (!p) return current;
        let presets = p.presets;
        let activeId = p.activeId;
        if (!presets || !Object.keys(presets).length) {
          const id = slugify(p.preset?.name ?? 'preset');
          presets = { [id]: p.preset ?? newPreset() };
          activeId = id;
        }
        for (const wp of Object.values(presets)) presetShapeFix(wp);
        if (!activeId || !presets[activeId]) activeId = Object.keys(presets)[0];
        const provider = p.provider ?? current.provider;
        if (!provider.service) {
          // Older stored configs predate service presets - infer from the URL.
          const u = provider.baseUrl ?? '';
          provider.service = u.includes('openrouter')
            ? 'openrouter'
            : u.includes('api.openai.com')
              ? 'openai'
              : provider.kind === 'anthropic'
                ? 'anthropic'
                : /localhost|127\.0\.0\.1/.test(u)
                  ? 'lmstudio'
                  : 'custom';
        }
        return {
          ...current,
          presets,
          activeId,
          provider,
          card: p.card ?? null,
          library: (p as { library?: PromptEntry[] }).library ?? [],
          tc: (p as { tc?: Partial<Record<TcKind, TcTemplate>> }).tc ?? {},
        };
      },
    },
  ),
);
