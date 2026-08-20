import { memo, useCallback, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { useActivePreset, useForge } from '../store';
import { MARKER_NAMES } from '../lib/stDefaults';
import { isSectionHeader } from '../lib/groups';

interface RowProps {
  identifier: string;
  enabled: boolean;
  name: string;
  isMarker: boolean;
  isCore: boolean;
  inChat: boolean;
  depth: number;
  missing: boolean;
  isHeader: boolean;
  isCollapsed: boolean;
  headerCount: number;
  selected: boolean;
  dragId: MutableRefObject<string | null>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onMoveTo: (id: string, beforeId: string | null) => void;
  onToggleSection: (id: string) => void;
}

/** Memoized row: a toggle or keystroke elsewhere re-renders 0-1 rows, not 451. */
const Row = memo(function Row(p: RowProps) {
  return (
    <div
      draggable
      onDragStart={(ev) => {
        // Firefox refuses to start a drag unless data is set.
        ev.dataTransfer.setData('text/plain', p.identifier);
        ev.dataTransfer.effectAllowed = 'move';
        p.dragId.current = p.identifier;
      }}
      onDragEnd={() => (p.dragId.current = null)}
      onDragOver={(ev) => ev.preventDefault()}
      onDrop={(ev) => {
        ev.preventDefault();
        if (p.dragId.current) p.onMoveTo(p.dragId.current, p.identifier);
        p.dragId.current = null;
      }}
      onClick={() => p.onSelect(p.identifier)}
      className={`group mb-0.5 flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm ${
        p.selected ? 'bg-violet-950/60 ring-1 ring-violet-700' : 'hover:bg-zinc-900'
      } ${p.missing ? 'opacity-40' : ''} ${p.isHeader ? 'mt-1 bg-zinc-900/70' : ''}`}
      title={p.identifier}
    >
      {p.isHeader ? (
        <button
          onClick={(ev) => {
            ev.stopPropagation();
            p.onToggleSection(p.identifier);
          }}
          className="w-6 shrink-0 text-left text-zinc-400 hover:text-zinc-200"
          aria-label={p.isCollapsed ? 'expand section' : 'collapse section'}
        >
          {p.isCollapsed ? '▸' : '▾'}
        </button>
      ) : (
        <button
          onClick={(ev) => {
            ev.stopPropagation();
            p.onToggle(p.identifier);
          }}
          className={`h-3.5 w-6 shrink-0 rounded-full transition-colors ${
            p.enabled ? 'bg-violet-600' : 'bg-zinc-700'
          }`}
          aria-label={p.enabled ? 'disable' : 'enable'}
        >
          <span
            className={`block h-3 w-3 rounded-full bg-zinc-200 transition-transform ${
              p.enabled ? 'translate-x-2.5' : 'translate-x-0.5'
            }`}
          />
        </button>
      )}
      <span
        className={`truncate ${p.isMarker ? 'italic text-zinc-500' : ''} ${
          p.isCore ? 'text-amber-200/90' : ''
        } ${p.isHeader ? 'font-semibold text-zinc-400' : ''}`}
      >
        {p.name}
      </span>
      <span className="ml-auto flex shrink-0 gap-1 text-[10px] text-zinc-500">
        {p.isHeader && p.isCollapsed && <span className="rounded bg-zinc-800 px-1">{p.headerCount}</span>}
        {p.inChat && <span className="rounded bg-sky-950 px-1 text-sky-300">@{p.depth}</span>}
        {p.isMarker && <span className="rounded bg-zinc-800 px-1">marker</span>}
      </span>
    </div>
  );
});

export default function Outline() {
  const preset = useActivePreset();
  const selectedId = useForge((s) => s.selectedId);
  const select = useForge((s) => s.select);
  const toggle = useForge((s) => s.toggle);
  const moveTo = useForge((s) => s.moveTo);
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

  const toggleSection = useCallback(
    (id: string) =>
      setCollapsed((c) => {
        const next = new Set(c);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );

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
          const headerMeta = isHeader ? headers.find((h) => h.id === e.identifier) : null;
          return (
            <Row
              key={e.identifier}
              identifier={e.identifier}
              enabled={e.enabled}
              name={p?.name ?? MARKER_NAMES[e.identifier] ?? e.identifier}
              isMarker={!!p?.marker}
              isCore={!!p?.system_prompt && !p?.marker}
              inChat={p?.injection_position === 1}
              depth={p?.injection_depth ?? 4}
              missing={!p}
              isHeader={isHeader}
              isCollapsed={collapsed.has(e.identifier)}
              headerCount={headerMeta?.count ?? 0}
              selected={selectedId === e.identifier}
              dragId={dragId}
              onSelect={select}
              onToggle={toggle}
              onMoveTo={moveTo}
              onToggleSection={toggleSection}
            />
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
