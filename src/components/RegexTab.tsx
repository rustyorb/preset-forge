import { useMemo, useState } from 'react';
import { useActivePreset, useForge } from '../store';
import {
  PLACEMENTS,
  newRegexScript,
  readRegexScripts,
  runRegexScript,
  validateRegexScript,
  type RegexScript,
} from '../lib/regex';

export default function RegexTab() {
  const preset = useActivePreset();
  const setRegexScripts = useForge((s) => s.setRegexScripts);
  const scripts = useMemo(() => readRegexScripts(preset), [preset]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [testText, setTestText] = useState(
    'She smiled — then frowned — and said, "Well— that was unexpected."',
  );

  const update = (id: string, patch: Partial<RegexScript>) =>
    setRegexScripts(scripts.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const remove = (id: string) => setRegexScripts(scripts.filter((s) => s.id !== id));
  const add = () => {
    const s = newRegexScript();
    setRegexScripts([...scripts, s]);
    setOpenId(s.id);
  };

  return (
    <div className="flex-1 overflow-y-auto p-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] leading-snug text-zinc-600">
          Regex scripts ship inside the preset (extensions.regex_scripts). ST asks the
          user to allow them on import.
        </span>
        <button
          onClick={add}
          className="ml-2 shrink-0 rounded bg-zinc-800 px-2 py-0.5 text-xs hover:bg-zinc-700"
        >
          + Add
        </button>
      </div>

      {scripts.length === 0 && (
        <div className="p-4 text-sm text-zinc-600">
          No regex scripts. The big preset engines bundle these for output cleanup —
          em-dash removal, format unification, dialogue styling.
        </div>
      )}

      {scripts.map((s) => {
        const err = validateRegexScript(s);
        const open = openId === s.id;
        let testOut: string | null = null;
        if (open && !err) {
          try {
            testOut = runRegexScript(s, testText);
          } catch (e) {
            testOut = `runtime error: ${e}`;
          }
        }
        return (
          <div key={s.id} className="mb-2 rounded bg-zinc-900 text-xs">
            <div
              onClick={() => setOpenId(open ? null : s.id)}
              className="flex cursor-pointer items-center gap-2 p-2"
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  s.disabled ? 'bg-zinc-600' : err ? 'bg-red-500' : 'bg-emerald-500'
                }`}
                title={s.disabled ? 'disabled' : err ? err : 'active'}
              />
              <span className="truncate">{s.scriptName}</span>
              <span className="ml-auto shrink-0 text-zinc-600">
                {s.placement
                  .map((p) => PLACEMENTS.find((x) => x.value === p)?.label ?? p)
                  .join(', ')}
              </span>
              <span className="text-zinc-600">{open ? '▾' : '▸'}</span>
            </div>

            {open && (
              <div className="space-y-2 border-t border-zinc-800 p-2">
                <input
                  value={s.scriptName}
                  onChange={(e) => update(s.id, { scriptName: e.target.value })}
                  className="w-full rounded bg-zinc-950 px-2 py-1 outline-none ring-violet-600 focus:ring-1"
                  placeholder="Script name"
                />
                <input
                  value={s.findRegex}
                  onChange={(e) => update(s.id, { findRegex: e.target.value })}
                  className="w-full rounded bg-zinc-950 px-2 py-1 font-mono outline-none ring-violet-600 focus:ring-1"
                  placeholder="/pattern/flags   e.g. /—/g"
                  spellCheck={false}
                />
                <input
                  value={s.replaceString}
                  onChange={(e) => update(s.id, { replaceString: e.target.value })}
                  className="w-full rounded bg-zinc-950 px-2 py-1 font-mono outline-none ring-violet-600 focus:ring-1"
                  placeholder="replacement   ({{match}} = whole match, $1 = group)"
                  spellCheck={false}
                />
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {PLACEMENTS.map((p) => (
                    <label key={p.value} className="flex items-center gap-1 text-zinc-400">
                      <input
                        type="checkbox"
                        checked={s.placement.includes(p.value)}
                        onChange={() =>
                          update(s.id, {
                            placement: s.placement.includes(p.value)
                              ? s.placement.filter((x) => x !== p.value)
                              : [...s.placement, p.value],
                          })
                        }
                        className="accent-violet-600"
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <label className="flex items-center gap-1 text-zinc-400">
                    <input
                      type="checkbox"
                      checked={!s.disabled}
                      onChange={() => update(s.id, { disabled: !s.disabled })}
                      className="accent-emerald-600"
                    />
                    enabled
                  </label>
                  <label className="flex items-center gap-1 text-zinc-400" title="only alter how text DISPLAYS, not what's sent/saved">
                    <input
                      type="checkbox"
                      checked={s.markdownOnly}
                      onChange={() => update(s.id, { markdownOnly: !s.markdownOnly })}
                      className="accent-violet-600"
                    />
                    display only
                  </label>
                  <label className="flex items-center gap-1 text-zinc-400" title="only alter what's sent in the prompt">
                    <input
                      type="checkbox"
                      checked={s.promptOnly}
                      onChange={() => update(s.id, { promptOnly: !s.promptOnly })}
                      className="accent-violet-600"
                    />
                    prompt only
                  </label>
                  <button
                    onClick={() => remove(s.id)}
                    className="ml-auto rounded px-2 py-0.5 text-red-400 hover:bg-red-950"
                  >
                    delete
                  </button>
                </div>

                {err ? (
                  <div className="rounded bg-red-950/50 px-2 py-1 text-red-300">{err}</div>
                ) : (
                  <div className="rounded border border-zinc-800 p-2">
                    <div className="mb-1 text-[10px] font-semibold uppercase text-zinc-500">
                      Live test
                    </div>
                    <textarea
                      value={testText}
                      onChange={(e) => setTestText(e.target.value)}
                      className="mb-1 h-12 w-full resize-none rounded bg-zinc-950 p-1.5 font-mono outline-none"
                      spellCheck={false}
                    />
                    <div className="whitespace-pre-wrap rounded bg-zinc-950 p-1.5 font-mono text-emerald-200">
                      {testOut}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
