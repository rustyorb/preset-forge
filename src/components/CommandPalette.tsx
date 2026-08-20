import { useEffect, useMemo, useRef, useState } from 'react';
import { useActivePreset, useForge } from '../store';
import { MARKER_NAMES } from '../lib/stDefaults';

/** Ctrl/Cmd+K: fuzzy-jump to any module. */
export default function CommandPalette() {
  const preset = useActivePreset();
  const select = useForge((s) => s.select);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        setQuery('');
        setCursor(0);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const enabled = useMemo(
    () => new Set(preset.order.filter((e) => e.enabled).map((e) => e.identifier)),
    [preset.order],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = preset.order
      .map((e) => {
        const p = preset.prompts.find((x) => x.identifier === e.identifier);
        return { identifier: e.identifier, name: p?.name ?? MARKER_NAMES[e.identifier] ?? e.identifier };
      });
    if (!q) return rows.slice(0, 12);
    // substring first, then in-order character subsequence
    const sub = rows.filter((r) => r.name.toLowerCase().includes(q));
    const isSubseq = (needle: string, hay: string) => {
      let i = 0;
      for (const ch of hay) if (ch === needle[i]) i++;
      return i >= needle.length;
    };
    const fuzzy = rows.filter(
      (r) => !r.name.toLowerCase().includes(q) && isSubseq(q, r.name.toLowerCase()),
    );
    return [...sub, ...fuzzy].slice(0, 12);
  }, [query, preset]);

  if (!open) return null;

  const pick = (identifier: string) => {
    select(identifier);
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-24" onClick={() => setOpen(false)}>
      <div className="w-[30rem] overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setCursor((c) => Math.min(c + 1, matches.length - 1));
            if (e.key === 'ArrowUp') setCursor((c) => Math.max(c - 1, 0));
            if (e.key === 'Enter' && matches[cursor]) pick(matches[cursor].identifier);
          }}
          placeholder="Jump to module…"
          className="w-full border-b border-zinc-800 bg-transparent px-4 py-3 text-sm outline-none"
        />
        <div className="max-h-72 overflow-y-auto p-1">
          {matches.map((m, i) => (
            <div
              key={m.identifier}
              onClick={() => pick(m.identifier)}
              onMouseEnter={() => setCursor(i)}
              className={`flex cursor-pointer items-center gap-2 rounded px-3 py-1.5 text-sm ${
                i === cursor ? 'bg-violet-950/70' : ''
              }`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${enabled.has(m.identifier) ? 'bg-violet-500' : 'bg-zinc-700'}`} />
              <span className="truncate">{m.name}</span>
              <span className="ml-auto truncate text-[10px] text-zinc-600">{m.identifier}</span>
            </div>
          ))}
          {matches.length === 0 && <div className="px-3 py-4 text-sm text-zinc-600">No matches</div>}
        </div>
      </div>
    </div>
  );
}
