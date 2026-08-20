import { useEffect, useState } from 'react';
import { useActivePreset, useForge } from '../store';
import { adviseModules, type AdvisorRec } from '../lib/gen';

type Phase = 'running' | 'result' | 'error';

export default function AdvisorModal() {
  const advisorOpen = useForge((s) => s.advisorOpen);
  const setAdvisorOpen = useForge((s) => s.setAdvisorOpen);
  const provider = useForge((s) => s.provider);
  const card = useForge((s) => s.card);
  const setEnabled = useForge((s) => s.setEnabled);
  const preset = useActivePreset();
  const [phase, setPhase] = useState<Phase>('running');
  const [recs, setRecs] = useState<AdvisorRec[]>([]);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');

  // Kick off one advisor run per open; ignore results if closed meanwhile.
  useEffect(() => {
    if (!advisorOpen || !card) return;
    let cancelled = false;
    setPhase('running');
    const enabled = new Map(preset.order.map((e) => [e.identifier, e.enabled]));
    (async () => {
      try {
        const modules = preset.prompts
          .filter((p) => !p.marker && enabled.has(p.identifier))
          .map((p) => ({
            identifier: p.identifier,
            name: p.name,
            enabled: !!enabled.get(p.identifier),
            snippet: p.content ?? '',
          }));
        const result = await adviseModules(provider, card, modules);
        if (cancelled) return;
        // Only show actual changes.
        const changes = result.filter((r) => enabled.get(r.identifier) !== r.enabled);
        setRecs(changes);
        setAccepted(Object.fromEntries(changes.map((r) => [r.identifier, true])));
        setPhase('result');
      } catch (e) {
        if (cancelled) return;
        setError(String(e));
        setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advisorOpen]);

  if (!advisorOpen || !card) return null;

  const close = () => {
    setAdvisorOpen(false);
    setRecs([]);
  };

  const apply = () => {
    const flags: Record<string, boolean> = {};
    for (const r of recs) {
      if (accepted[r.identifier]) flags[r.identifier] = r.enabled;
    }
    setEnabled(flags);
    close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={close}>
      <div
        className="flex max-h-[85vh] w-[36rem] flex-col rounded-lg border border-zinc-800 bg-zinc-950 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 text-lg font-semibold">🎯 Prompt Advisor</div>
        <div className="mb-3 text-xs text-zinc-500">
          Recommending module toggles in <b className="text-zinc-300">{preset.name}</b> for{' '}
          <b className="text-emerald-300">{card.name}</b>
        </div>

        {phase === 'running' && (
          <div className="py-8 text-center text-sm text-zinc-400">
            <div className="mb-2 animate-pulse text-2xl">🎯</div>
            Reading the card and the module list…
          </div>
        )}

        {phase === 'result' && (
          <>
            {recs.length === 0 ? (
              <div className="rounded bg-zinc-900 p-4 text-sm text-zinc-400">
                The advisor endorses the current toggles — no changes recommended.
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto rounded border border-zinc-800">
                {recs.map((r) => (
                  <label
                    key={r.identifier}
                    className="flex cursor-pointer items-start gap-2 border-b border-zinc-900 p-2 text-sm hover:bg-zinc-900/50"
                  >
                    <input
                      type="checkbox"
                      checked={!!accepted[r.identifier]}
                      onChange={() =>
                        setAccepted((a) => ({ ...a, [r.identifier]: !a[r.identifier] }))
                      }
                      className="mt-1 accent-violet-600"
                    />
                    <div className="min-w-0">
                      <div className="truncate">
                        <span
                          className={`mr-2 rounded px-1.5 py-px text-[10px] ${
                            r.enabled ? 'bg-emerald-950 text-emerald-300' : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {r.enabled ? 'ENABLE' : 'disable'}
                        </span>
                        {preset.prompts.find((p) => p.identifier === r.identifier)?.name ??
                          r.identifier}
                      </div>
                      <div className="text-xs text-zinc-500">{r.reason}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={close} className="rounded bg-zinc-800 px-4 py-1.5 text-sm">
                Close
              </button>
              {recs.length > 0 && (
                <button
                  onClick={apply}
                  className="rounded bg-violet-700 px-4 py-1.5 text-sm hover:bg-violet-600"
                >
                  Apply {Object.values(accepted).filter(Boolean).length} change(s)
                </button>
              )}
            </div>
          </>
        )}

        {phase === 'error' && (
          <>
            <div className="rounded bg-red-950/50 p-3 text-sm text-red-300">{error}</div>
            <div className="mt-3 flex justify-end">
              <button onClick={close} className="rounded bg-zinc-800 px-4 py-1.5 text-sm">
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
