import { useMemo, useRef, useState } from 'react';
import { useActivePreset, useForge } from '../store';
import { MARKER_NAMES } from '../lib/stDefaults';
import { isSectionHeader } from '../lib/groups';

export default function Outline() {
  const preset = useActivePreset();
  const { selectedId, select, toggle, moveTo } = useForge();
  const [filter, setFilter] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const dragId = useRef<string | null>(null);

  const byId = useMemo(
    () => new Map(preset.prompts.map((p) => [p.identifier, p])),
    [preset.prompts],
  );

  // Assign each row its owning section header (null = before any header).
  const { rows, headers } = useMemo(() => {
    let current: string | null = null;
    const headers: { id: string; count: number }[] = [];
    const rows = preset.order.map((e) => {
      const p = byId.get(e.identifier);
      const header = isSectionHeader(p);
      if (header) {
        current = e.identifier;
        headers.push({ id: e.identifier, count: 0 });
      } else if (current) {
        headers[headers.length - 1].count++;
      }
      return { entry: e, section: header ? null : current, isHeader: header };
    });
    return { rows, headers };
  }, [preset.order, byId]);

  const q = filter.trim().toLowerCase();
  const visible = rows.filter(({ entry, section, isHeader }) => {
    if (q) {
      const p = byId.get(entry.identifier);
      const name = p?.name ?? MARKER_NAMES[entry.identifier] ?? entry.identifier;
      return name.toLowerCase().includes(q);
    }
    if (isHeader) return true;
    return !section || !collapsed.has(section);
  });

  const toggleSection = (id: string) =>
    setCollapsed((c) => {
      const next = new Set(c);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allCollapsed = headers.length > 0 && headers.every((h) => collapsed.has(h.id));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-zinc-800 p-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter modules…  (Ctrl+K to jump)"
          className="w-full rounded bg-zinc-900 px-2 py-1 text-sm outline-none ring-violet-600 placeholder:text-zinc-600 focus:ring-1"
        />
        {headers.length > 0 && (
          <button
            onClick={() =>
              setCollapsed(allCollapsed ? new Set() : new Set(headers.map((h) => h.id)))
            }
            className="shrink-0 rounded bg-zinc-800 px-1.5 py-1 text-xs hover:bg-zinc-700"
            title={allCollapsed ? 'Expand all sections' : 'Collapse all sections'}
          >
            {allCollapsed ? '⊞' : '⊟'}
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-1">
        {visible.map(({ entry: e, isHeader }) => {
          const p = byId.get(e.identifier);
          const isMarker = !!p?.marker;
          const isCore = !!p?.system_prompt && !isMarker;
          const inChat = p?.injection_position === 1;
          const name = p?.name ?? MARKER_NAMES[e.identifier] ?? e.identifier;
          const missing = !p;
          const headerMeta = isHeader ? headers.find((h) => h.id === e.identifier) : null;
          return (
            <div
              key={e.identifier}
              draggable
              onDragStart={(ev) => {
                // Firefox refuses to start a drag unless data is set.
                ev.dataTransfer.setData('text/plain', e.identifier);
                ev.dataTransfer.effectAllowed = 'move';
                dragId.current = e.identifier;
              }}
              onDragEnd={() => (dragId.current = null)}
              onDragOver={(ev) => ev.preventDefault()}
              onDrop={(ev) => {
                ev.preventDefault();
                if (dragId.current) moveTo(dragId.current, e.identifier);
                dragId.current = null;
              }}
              onClick={() => select(e.identifier)}
              className={`group mb-0.5 flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm ${
                selectedId === e.identifier
                  ? 'bg-violet-950/60 ring-1 ring-violet-700'
                  : 'hover:bg-zinc-900'
              } ${missing ? 'opacity-40' : ''} ${isHeader ? 'mt-1 bg-zinc-900/70' : ''}`}
              title={e.identifier}
            >
              {isHeader ? (
                <button
                  onClick={(ev) => {
                    ev.stopPropagation();
                    toggleSection(e.identifier);
                  }}
                  className="w-6 shrink-0 text-left text-zinc-400 hover:text-zinc-200"
                  aria-label={collapsed.has(e.identifier) ? 'expand section' : 'collapse section'}
                >
                  {collapsed.has(e.identifier) ? '▸' : '▾'}
                </button>
              ) : (
                <button
                  onClick={(ev) => {
                    ev.stopPropagation();
                    toggle(e.identifier);
                  }}
                  className={`h-3.5 w-6 shrink-0 rounded-full transition-colors ${
                    e.enabled ? 'bg-violet-600' : 'bg-zinc-700'
                  }`}
                  aria-label={e.enabled ? 'disable' : 'enable'}
                >
                  <span
                    className={`block h-3 w-3 rounded-full bg-zinc-200 transition-transform ${
                      e.enabled ? 'translate-x-2.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              )}
              <span
                className={`truncate ${isMarker ? 'italic text-zinc-500' : ''} ${
                  isCore ? 'text-amber-200/90' : ''
                } ${isHeader ? 'font-semibold text-zinc-400' : ''}`}
              >
                {name}
              </span>
              <span className="ml-auto flex shrink-0 gap-1 text-[10px] text-zinc-500">
                {isHeader && collapsed.has(e.identifier) && headerMeta && (
                  <span className="rounded bg-zinc-800 px-1">{headerMeta.count}</span>
                )}
                {inChat && (
                  <span className="rounded bg-sky-950 px-1 text-sky-300">
                    @{p?.injection_depth ?? 4}
                  </span>
                )}
                {isMarker && <span className="rounded bg-zinc-800 px-1">marker</span>}
              </span>
            </div>
          );
        })}
        <div
          className="h-8"
          onDragOver={(ev) => ev.preventDefault()}
          onDrop={(ev) => {
            ev.preventDefault();
            if (dragId.current) moveTo(dragId.current, null);
            dragId.current = null;
          }}
        />
      </div>
    </div>
  );
}
