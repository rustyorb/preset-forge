import { useMemo, useRef, useState } from 'react';
import { useActivePreset, useForge } from '../store';
import { assemblePreview, sceneFromCard } from '../lib/assemble';
import { parseCardFile } from '../lib/cards';
import { lintPreset } from '../lib/lint';
import {
  analyzeVariables,
  isValidVarName,
  makeGetvarRedirect,
  makeVarRenamer,
} from '../lib/macros';

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
  note: 'bg-amber-950 text-amber-300',
};

export default function Preview() {
  const preset = useActivePreset();
  const { select, setJumpTo, card, setCard, setAdvisorOpen, provider, renamePromptContent } =
    useForge();
  const [tab, setTab] = useState<'context' | 'lint' | 'vars'>('context');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameTo, setRenameTo] = useState('');
  const cardFileRef = useRef<HTMLInputElement>(null);

  const scene = useMemo(() => (card ? sceneFromCard(card) : undefined), [card]);
  const blocks = useMemo(() => assemblePreview(preset, scene), [preset, scene]);
  const findings = useMemo(() => lintPreset(preset), [preset]);
  const vars = useMemo(() => analyzeVariables(preset), [preset]);
  const errs = findings.filter((f) => f.level === 'error').length;
  const warns = findings.filter((f) => f.level === 'warn').length;
  const definedNames = vars.filter((v) => v.definedIn.length).map((v) => v.name);

  const jump = (identifier: string, needle: string) => {
    select(identifier);
    setJumpTo({ identifier, needle });
  };

  const commitRename = (oldName: string) => {
    const next = renameTo.trim();
    setRenaming(null);
    if (!next || next === oldName) return;
    if (!isValidVarName(next)) {
      alert(`"${next}" is not a valid variable name (no ':', '{', '}')`);
      return;
    }
    if (vars.some((v) => v.name === next)) {
      alert(`A variable named "${next}" already exists - pick another name.`);
      return;
    }
    renamePromptContent(makeVarRenamer(oldName, next));
  };

  const onLoadCard = async (file: File) => {
    try {
      setCard(await parseCardFile(file));
    } catch (e) {
      alert(`Card import failed: ${e}`);
    }
  };

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

      <div className="flex items-center gap-1.5 border-b border-zinc-800 px-2 py-1.5 text-xs">
        <span className="text-zinc-500">Scene:</span>
        <span className={card ? 'text-emerald-300' : 'text-zinc-400'}>
          {card ? card.name : 'Seraphina (sample)'}
        </span>
        <button
          onClick={() => cardFileRef.current?.click()}
          className="rounded bg-zinc-800 px-2 py-0.5 hover:bg-zinc-700"
          title="Load a character card (.json or .png) to preview against"
        >
          Load card
        </button>
        {card && (
          <button
            onClick={() => setCard(null)}
            className="rounded bg-zinc-800 px-1.5 py-0.5 hover:bg-zinc-700"
            title="Back to the sample scene"
          >
            ✕
          </button>
        )}
        <button
          onClick={() => setAdvisorOpen(true)}
          disabled={!card || !provider.model}
          title={
            !card
              ? 'Load a character card first'
              : !provider.model
                ? 'Configure a provider first (⚙)'
                : 'AI-recommend module toggles for this character'
          }
          className="ml-auto rounded bg-violet-700 px-2 py-0.5 font-medium hover:bg-violet-600 disabled:opacity-40"
        >
          🎯 Advisor
        </button>
        <input
          ref={cardFileRef}
          type="file"
          accept=".json,.png,application/json,image/png"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onLoadCard(f);
            e.target.value = '';
          }}
        />
      </div>

      {tab === 'context' && (
        <div className="flex-1 overflow-y-auto p-2">
          <div className="mb-2 text-[11px] leading-snug text-zinc-600">
            Structural preview: where each enabled prompt actually lands. In-Chat prompts
            appear <i>inside</i> the chat at their depth.
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
          {vars.map((v) => {
            const dangling = !v.definedIn.length && v.usedIn.length > 0;
            return (
              <div key={v.name} className="mb-2 rounded bg-zinc-900 p-2 text-xs">
                <div className="mb-1 flex items-center gap-2">
                  {renaming === v.name ? (
                    <>
                      <input
                        autoFocus
                        value={renameTo}
                        onChange={(e) => setRenameTo(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename(v.name);
                          if (e.key === 'Escape') setRenaming(null);
                        }}
                        className="w-40 rounded bg-zinc-950 px-1.5 py-0.5 font-mono text-violet-300 outline-none ring-1 ring-violet-600"
                      />
                      <button onClick={() => commitRename(v.name)} className="rounded bg-violet-700 px-2 py-0.5 hover:bg-violet-600">
                        OK
                      </button>
                      <button onClick={() => setRenaming(null)} className="rounded bg-zinc-800 px-2 py-0.5">
                        esc
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="font-mono text-violet-300">{v.name}</span>
                      <button
                        onClick={() => {
                          setRenaming(v.name);
                          setRenameTo(v.name);
                        }}
                        className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400 hover:bg-zinc-700"
                        title="Rename this variable across all modules (setvar + getvar)"
                      >
                        ✏ rename
                      </button>
                    </>
                  )}
                </div>
                <div className={v.definedIn.length ? 'text-zinc-500' : 'text-red-400'}>
                  set in:{' '}
                  {v.definedIn.length
                    ? v.definedIn.map((id) => (
                        <button
                          key={id}
                          onClick={() => jump(id, `setvar::${v.name}`)}
                          className="mr-1 rounded bg-zinc-800 px-1 py-px text-zinc-300 hover:bg-violet-950"
                          title="Jump to this setvar"
                        >
                          {id}
                        </button>
                      ))
                    : '— nowhere (dangling!)'}
                </div>
                <div className="mt-0.5 text-zinc-500">
                  read in:{' '}
                  {v.usedIn.length
                    ? v.usedIn.map((id) => (
                        <button
                          key={id}
                          onClick={() => jump(id, `getvar::${v.name}`)}
                          className="mr-1 rounded bg-zinc-800 px-1 py-px text-zinc-300 hover:bg-violet-950"
                          title="Jump to this getvar"
                        >
                          {id}
                        </button>
                      ))
                    : '—'}
                </div>
                {dangling && definedNames.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-amber-300">
                    quick fix — redirect reads to:
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          renamePromptContent(makeGetvarRedirect(v.name, e.target.value));
                        }
                      }}
                      className="rounded bg-zinc-950 px-1 py-0.5 text-zinc-300"
                    >
                      <option value="" disabled>
                        pick a defined var…
                      </option>
                      {definedNames.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
