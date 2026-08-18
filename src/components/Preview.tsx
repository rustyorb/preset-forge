import { useMemo, useState } from 'react';
import { useForge } from '../store';
import { assemblePreview } from '../lib/assemble';
import { lintPreset } from '../lib/lint';
import { analyzeVariables } from '../lib/macros';

const ROLE_STYLE: Record<string, string> = {
  system: 'border-violet-800/60',
  user: 'border-sky-800/60',
  assistant: 'border-emerald-800/60',
};
const SOURCE_BADGE: Record<string, string> = {
  prompt: 'bg-violet-950 text-violet-300',
  marker: 'bg-zinc-800 text-zinc-400',
  chat: 'bg-zinc-900 text-zinc-500',
  injection: 'bg-sky-950 text-sky-300',
};

export default function Preview() {
  const { preset, select } = useForge();
  const [tab, setTab] = useState<'context' | 'lint' | 'vars'>('context');

  const blocks = useMemo(() => assemblePreview(preset), [preset]);
  const findings = useMemo(() => lintPreset(preset), [preset]);
  const vars = useMemo(() => analyzeVariables(preset), [preset]);
  const errs = findings.filter((f) => f.level === 'error').length;
  const warns = findings.filter((f) => f.level === 'warn').length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-zinc-800 text-sm">
        {(
          [
            ['context', 'Context'],
            ['lint', `Lint ${errs ? `✕${errs}` : warns ? `⚠${warns}` : '✓'}`],
            ['vars', `Vars (${vars.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-2 ${
              tab === key
                ? 'border-b-2 border-violet-600 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'
            } ${key === 'lint' && errs ? 'text-red-400' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'context' && (
        <div className="flex-1 overflow-y-auto p-2">
          <div className="mb-2 text-[11px] leading-snug text-zinc-600">
            Structural preview with a sample scene: where each enabled prompt actually
            lands. In-Chat prompts appear <i>inside</i> the chat at their depth.
          </div>
          {blocks.map((b, i) => (
            <div
              key={i}
              onClick={() => b.identifier && select(b.identifier)}
              className={`mb-1.5 rounded border-l-2 bg-zinc-900/60 p-2 ${
                ROLE_STYLE[b.role] ?? ''
              } ${b.identifier ? 'cursor-pointer hover:bg-zinc-900' : ''} ${
                b.source === 'injection' ? 'ring-1 ring-sky-900' : ''
              }`}
            >
              <div className="mb-1 flex items-center gap-1.5 text-[10px]">
                <span className={`rounded px-1 py-px ${SOURCE_BADGE[b.source]}`}>{b.source}</span>
                <span className="text-zinc-500">{b.role}</span>
                <span className="ml-auto truncate text-zinc-600">{b.label}</span>
              </div>
              <div className="line-clamp-4 whitespace-pre-wrap text-xs text-zinc-300">
                {b.content}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'lint' && (
        <div className="flex-1 overflow-y-auto p-2">
          {findings.length === 0 && (
            <div className="p-4 text-sm text-emerald-400">✓ No problems found</div>
          )}
          {findings.map((f, i) => (
            <div
              key={i}
              onClick={() => f.identifier && select(f.identifier)}
              className={`mb-1 rounded p-2 text-xs ${
                f.identifier ? 'cursor-pointer' : ''
              } ${
                f.level === 'error'
                  ? 'bg-red-950/50 text-red-300'
                  : f.level === 'warn'
                    ? 'bg-amber-950/40 text-amber-300'
                    : 'bg-zinc-900 text-zinc-500'
              }`}
            >
              <b className="mr-1 uppercase">{f.level}</b>
              {f.message}
            </div>
          ))}
        </div>
      )}

      {tab === 'vars' && (
        <div className="flex-1 overflow-y-auto p-2">
          {vars.length === 0 && (
            <div className="p-4 text-sm text-zinc-600">
              No {'{{setvar}}'} / {'{{getvar}}'} usage in this preset.
            </div>
          )}
          {vars.map((v) => (
            <div key={v.name} className="mb-2 rounded bg-zinc-900 p-2 text-xs">
              <div className="mb-1 font-mono text-violet-300">{v.name}</div>
              <div className={v.definedIn.length ? 'text-zinc-500' : 'text-red-400'}>
                set in: {v.definedIn.length ? v.definedIn.join(', ') : '— nowhere (dangling!)'}
              </div>
              <div className="text-zinc-500">read in: {v.usedIn.join(', ') || '—'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
