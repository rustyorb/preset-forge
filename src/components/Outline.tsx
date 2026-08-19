import { useMemo, useRef, useState } from 'react';
import { useActivePreset, useForge } from '../store';
import { MARKER_NAMES } from '../lib/stDefaults';

export default function Outline() {
  const preset = useActivePreset();
  const { selectedId, select, toggle, moveTo } = useForge();
  const [filter, setFilter] = useState('');
  const dragId = useRef<string | null>(null);

  const byId = useMemo(
    () => new Map(preset.prompts.map((p) => [p.identifier, p])),
    [preset.prompts],
  );

  const rows = preset.order.filter((e) => {
    if (!filter) return true;
    const p = byId.get(e.identifier);
    const name = p?.name ?? MARKER_NAMES[e.identifier] ?? e.identifier;
    return name.toLowerCase().includes(filter.toLowerCase());
  });

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 p-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter modules…"
          className="w-full rounded bg-zinc-900 px-2 py-1 text-sm outline-none ring-violet-600 placeholder:text-zinc-600 focus:ring-1"
        />
      </div>
      <div className="flex-1 overflow-y-auto p-1">
        {rows.map((e) => {
          const p = byId.get(e.identifier);
          const isMarker = !!p?.marker;
          const isCore = !!p?.system_prompt && !isMarker;
          const inChat = p?.injection_position === 1;
          const name = p?.name ?? MARKER_NAMES[e.identifier] ?? e.identifier;
          const missing = !p;
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
              } ${missing ? 'opacity-40' : ''}`}
              title={e.identifier}
            >
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
              <span
                className={`truncate ${isMarker ? 'italic text-zinc-500' : ''} ${
                  isCore ? 'text-amber-200/90' : ''
                }`}
              >
                {name}
              </span>
              <span className="ml-auto flex shrink-0 gap-1 text-[10px] text-zinc-500">
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
