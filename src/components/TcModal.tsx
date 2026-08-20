import { useRef, useState } from 'react';
import { useForge } from '../store';
import {
  TC_FIELDS,
  TC_KIND_LABEL,
  detectTcKind,
  type TcKind,
  type TcTemplate,
} from '../lib/tcTemplates';

const KINDS: TcKind[] = ['instruct', 'context', 'sysprompt'];

export default function TcModal() {
  const tcOpen = useForge((s) => s.tcOpen);
  const setTcOpen = useForge((s) => s.setTcOpen);
  const tc = useForge((s) => s.tc);
  const setTcTemplate = useForge((s) => s.setTcTemplate);
  const updateTcField = useForge((s) => s.updateTcField);
  const [active, setActive] = useState<TcKind>('instruct');
  const fileRef = useRef<HTMLInputElement>(null);

  if (!tcOpen) return null;

  const tpl = tc[active];

  const onImport = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text()) as TcTemplate;
      const kind = detectTcKind(raw);
      if (!kind) throw new Error('not an instruct/context/sysprompt template');
      setTcTemplate(kind, raw);
      setActive(kind);
    } catch (e) {
      alert(`Template import failed: ${e}`);
    }
  };

  const onExport = () => {
    if (!tpl) return;
    const blob = new Blob([JSON.stringify(tpl, null, 4)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${String(tpl.name ?? active).replace(/[\\/:*?"<>|]/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setTcOpen(false)}>
      <div
        className="flex max-h-[85vh] w-[40rem] flex-col rounded-lg border border-zinc-800 bg-zinc-950 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 text-lg font-semibold">🧩 Text Completion templates</div>
        <div className="mb-3 text-xs text-zinc-500">
          For local/textgen backends: instruct sequences, context template, system prompt.
          Import ST template JSONs, edit, export back.
        </div>

        <div className="mb-3 flex items-center gap-1">
          {KINDS.map((k) => (
            <button
              key={k}
              onClick={() => setActive(k)}
              className={`rounded px-3 py-1 text-sm ${
                active === k ? 'bg-violet-900 text-zinc-100' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {TC_KIND_LABEL[k]}
              {tc[k] ? ' ●' : ''}
            </button>
          ))}
          <div className="ml-auto flex gap-1">
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700"
              title="Import an ST template .json (kind auto-detected)"
            >
              Import
            </button>
            {tpl && (
              <>
                <button onClick={onExport} className="rounded bg-emerald-900 px-2 py-1 text-xs hover:bg-emerald-800">
                  Export
                </button>
                <button
                  onClick={() => confirm(`Clear the ${TC_KIND_LABEL[active]}?`) && setTcTemplate(active, null)}
                  className="rounded bg-zinc-800 px-2 py-1 text-xs text-red-400 hover:bg-red-950"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        </div>

        {!tpl ? (
          <div className="rounded bg-zinc-900 p-6 text-sm text-zinc-500">
            No {TC_KIND_LABEL[active].toLowerCase()} loaded — Import one (ST ships ChatML,
            Llama-3, Mistral, etc. under Advanced Formatting), edit it here, export it back.
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-400">name</span>
              <input
                value={String(tpl.name ?? '')}
                onChange={(e) => updateTcField(active, 'name', e.target.value)}
                className="w-full rounded bg-zinc-900 px-2 py-1 font-mono text-xs"
              />
            </label>
            {TC_FIELDS[active].map((group) => (
              <div key={group.group}>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {group.group}
                </div>
                <div className="space-y-2">
                  {group.fields.map((f) => {
                    const v = tpl[f.key];
                    if (f.type === 'boolean') {
                      return (
                        <label key={f.key} className="mr-4 inline-flex items-center gap-1.5 text-xs text-zinc-400">
                          <input
                            type="checkbox"
                            checked={!!v}
                            onChange={() => updateTcField(active, f.key, !v)}
                            className="accent-violet-600"
                          />
                          {f.key}
                        </label>
                      );
                    }
                    if (f.type === 'number') {
                      return (
                        <label key={f.key} className="mr-4 inline-flex items-center gap-1.5 text-xs text-zinc-400">
                          {f.key}
                          <input
                            type="number"
                            value={Number(v ?? 0)}
                            onChange={(e) => {
                              if (e.target.value === '') return;
                              const n = Number(e.target.value);
                              if (Number.isFinite(n)) updateTcField(active, f.key, n);
                            }}
                            className="w-16 rounded bg-zinc-900 px-1.5 py-0.5"
                          />
                        </label>
                      );
                    }
                    const long = f.type === 'text' && (String(v ?? '').includes('\n') || f.key === 'story_string' || f.key === 'content' || f.key === 'post_history');
                    return (
                      <label key={f.key} className="block text-xs">
                        <span className="mb-0.5 block text-zinc-500">{f.key}</span>
                        {long ? (
                          <textarea
                            value={String(v ?? '')}
                            onChange={(e) => updateTcField(active, f.key, e.target.value)}
                            spellCheck={false}
                            className="h-24 w-full resize-y rounded bg-zinc-900 p-2 font-mono text-xs"
                          />
                        ) : (
                          <input
                            value={String(v ?? '')}
                            onChange={(e) => updateTcField(active, f.key, e.target.value)}
                            spellCheck={false}
                            className="w-full rounded bg-zinc-900 px-2 py-1 font-mono text-xs"
                          />
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex justify-end">
          <button onClick={() => setTcOpen(false)} className="rounded bg-violet-700 px-4 py-1.5 text-sm hover:bg-violet-600">
            Done
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(f);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
