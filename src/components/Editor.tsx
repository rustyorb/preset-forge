import { useEffect, useRef, useState } from 'react';
import { useActivePreset, useForge } from '../store';
import { estimateTokens } from '../lib/tokens';
import { refineContent } from '../lib/gen';
import { DEFAULT_IDENTIFIERS } from '../lib/stDefaults';
import type { Role } from '../lib/types';

/** Commit a numeric input only when it parses; ignore empty/NaN mid-edit states. */
function numericHandler(commit: (n: number) => void) {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value === '') return;
    const n = Number(e.target.value);
    if (Number.isFinite(n)) commit(n);
  };
}

export default function Editor() {
  const preset = useActivePreset();
  const { selectedId, updatePrompt, removeModule, provider, jumpTo, setJumpTo, saveToLibrary } =
    useForge();
  const [refineText, setRefineText] = useState('');
  const [proposed, setProposed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const p = preset.prompts.find((x) => x.identifier === selectedId);

  // Vars-tab jump: focus the content box and select the referenced macro text.
  useEffect(() => {
    if (!jumpTo || jumpTo.identifier !== selectedId || !p) return;
    const el = contentRef.current;
    const content = p.content ?? '';
    const at = content.indexOf(jumpTo.needle);
    setJumpTo(null);
    if (!el || at === -1) return;
    el.focus();
    el.setSelectionRange(at, at + jumpTo.needle.length);
    // Rough scroll: put the selection's line near the middle of the box.
    const line = content.slice(0, at).split('\n').length;
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    el.scrollTop = Math.max(0, line * lineHeight - el.clientHeight / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTo, selectedId]);
  if (!p) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-600">
        Select a module — or use the Wizard to generate a preset.
      </div>
    );
  }
  if (p.marker) {
    return (
      <div className="p-6 text-sm text-zinc-500">
        <div className="mb-1 text-lg text-zinc-300">{p.name}</div>
        <p>
          This is a <b>marker</b>: SillyTavern fills it with live data (character card,
          chat history, world info). It has no editable content.
        </p>
      </div>
    );
  }

  const inChat = p.injection_position === 1;
  const isCore = DEFAULT_IDENTIFIERS.has(p.identifier);

  const runRefine = async () => {
    if (!refineText.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      setProposed(await refineContent(provider, p.name, p.content ?? '', refineText));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <input
          value={p.name}
          onChange={(e) => updatePrompt(p.identifier, { name: e.target.value })}
          className="flex-1 rounded bg-zinc-900 px-3 py-1.5 text-lg outline-none ring-violet-600 focus:ring-1"
        />
        <button
          onClick={() => saveToLibrary(p.identifier)}
          className="rounded px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800"
          title="Save a copy of this module to the shared library (📦 in the outline header)"
        >
          ☆ Save
        </button>
        {!isCore && (
          <button
            onClick={() => removeModule(p.identifier)}
            className="rounded px-2 py-1 text-sm text-red-400 hover:bg-red-950"
            title="Delete module"
          >
            Delete
          </button>
        )}
      </div>
      <div className="text-xs text-zinc-600">
        id: {p.identifier}
        {isCore && ' · built-in slot'}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          Role
          <select
            value={p.role || 'system'}
            onChange={(e) => updatePrompt(p.identifier, { role: e.target.value as Role })}
            className="rounded bg-zinc-900 px-2 py-1"
          >
            <option value="system">system</option>
            <option value="user">user</option>
            <option value="assistant">assistant</option>
          </select>
        </label>

        <label className="flex items-center gap-2">
          Position
          <select
            value={inChat ? '1' : '0'}
            onChange={(e) =>
              updatePrompt(p.identifier, { injection_position: e.target.value === '1' ? 1 : 0 })
            }
            className="rounded bg-zinc-900 px-2 py-1"
          >
            <option value="0">Relative (by order)</option>
            <option value="1">In-Chat (at depth)</option>
          </select>
        </label>

        {inChat && (
          <>
            <label className="flex items-center gap-2" title="0 = after the last message (strongest)">
              Depth
              <input
                type="number"
                min={0}
                value={p.injection_depth ?? 4}
                onChange={numericHandler((n) =>
                  updatePrompt(p.identifier, { injection_depth: Math.max(0, Math.floor(n)) }),
                )}
                className="w-16 rounded bg-zinc-900 px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-2" title="tie-breaker at same depth; lower = earlier">
              Order
              <input
                type="number"
                value={p.injection_order ?? 100}
                onChange={numericHandler((n) =>
                  updatePrompt(p.identifier, { injection_order: Math.floor(n) }),
                )}
                className="w-20 rounded bg-zinc-900 px-2 py-1"
              />
            </label>
          </>
        )}
        <span className="ml-auto text-xs text-zinc-500">
          ~{estimateTokens(p.content ?? '')} tokens
        </span>
      </div>

      <textarea
        ref={contentRef}
        value={p.content ?? ''}
        onChange={(e) => updatePrompt(p.identifier, { content: e.target.value })}
        spellCheck={false}
        placeholder="Module content…  ({{char}}, {{user}}, {{setvar::x::v}}, {{getvar::x}})"
        className="min-h-64 flex-1 resize-none rounded bg-zinc-900 p-3 font-mono text-sm leading-relaxed outline-none ring-violet-600 focus:ring-1"
      />

      <div className="rounded border border-zinc-800 bg-zinc-900/50 p-2">
        <div className="mb-1 text-xs font-semibold text-zinc-400">✨ Refine with AI</div>
        <div className="flex gap-2">
          <input
            value={refineText}
            onChange={(e) => setRefineText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runRefine()}
            placeholder='e.g. "make it half as long and more forceful"'
            className="flex-1 rounded bg-zinc-950 px-2 py-1 text-sm outline-none ring-violet-600 focus:ring-1"
          />
          <button
            onClick={runRefine}
            disabled={busy}
            className="rounded bg-violet-700 px-3 py-1 text-sm hover:bg-violet-600 disabled:opacity-50"
          >
            {busy ? '…' : 'Refine'}
          </button>
        </div>
        {error && <div className="mt-1 text-xs text-red-400">{error}</div>}
        {proposed !== null && (
          <div className="mt-2">
            <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded bg-zinc-950 p-2 font-mono text-xs text-emerald-200">
              {proposed}
            </div>
            <div className="mt-1 flex gap-2">
              <button
                onClick={() => {
                  updatePrompt(p.identifier, { content: proposed });
                  setProposed(null);
                  setRefineText('');
                }}
                className="rounded bg-emerald-800 px-3 py-1 text-xs hover:bg-emerald-700"
              >
                Accept
              </button>
              <button
                onClick={() => setProposed(null)}
                className="rounded bg-zinc-800 px-3 py-1 text-xs hover:bg-zinc-700"
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
