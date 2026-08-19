import { useRef, useState } from 'react';
import { useActivePreset, useForge } from '../store';
import { generateModuleContent, generatePlan, type WizardPlan } from '../lib/gen';
import { slugify } from '../lib/preset';
import type { PromptEntry } from '../lib/types';

type Phase = 'describe' | 'planning' | 'plan' | 'generating' | 'error';

export default function WizardModal() {
  const { wizardOpen, setWizardOpen, provider, applyWizard } = useForge();
  const preset = useActivePreset();
  const [phase, setPhase] = useState<Phase>('describe');
  const [description, setDescription] = useState('');
  const [plan, setPlan] = useState<WizardPlan | null>(null);
  const [applyMain, setApplyMain] = useState(true);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  // Monotonic run id: cancels/backdrop-closes invalidate in-flight async work.
  const runId = useRef(0);

  if (!wizardOpen) return null;

  const close = () => {
    runId.current++;
    setWizardOpen(false);
    setPhase('describe');
    setPlan(null);
    setError('');
  };

  const requestClose = () => {
    if (phase === 'generating' || phase === 'planning') return; // explicit Cancel only
    close();
  };

  const runPlan = async () => {
    if (!description.trim()) return;
    const id = ++runId.current;
    setPhase('planning');
    try {
      const result = await generatePlan(provider, description);
      if (runId.current !== id) return; // cancelled/superseded
      setPlan(result);
      setApplyMain(!!result.main);
      setPhase('plan');
    } catch (e) {
      if (runId.current !== id) return;
      setError(String(e));
      setPhase('error');
    }
  };

  const toggleModule = (i: number) =>
    setPlan((pl) =>
      pl
        ? {
            ...pl,
            modules: pl.modules.map((m, j) => (j === i ? { ...m, enabled: !m.enabled } : m)),
          }
        : pl,
    );

  const runGenerate = async () => {
    if (!plan) return;
    const id = ++runId.current;
    setPhase('generating');
    try {
      // Generate everything FIRST; commit to the store once, atomically.
      // A mid-loop failure or cancel leaves the preset completely untouched.
      const modules: PromptEntry[] = [];
      for (let i = 0; i < plan.modules.length; i++) {
        const m = plan.modules[i];
        setProgress(`Generating ${i + 1}/${plan.modules.length}: ${m.name}`);
        const content = await generateModuleContent(provider, description, m);
        if (runId.current !== id) return; // cancelled - discard everything
        modules.push({
          identifier: slugify(m.name),
          name: m.name,
          system_prompt: false,
          marker: false,
          enabled: m.enabled,
          role: m.role,
          content,
          injection_position: m.placement === 'in_chat' ? 1 : 0,
          injection_depth: m.depth,
          injection_order: m.order,
          forbid_overrides: false,
        });
      }
      applyWizard(plan.params, applyMain ? plan.main : undefined, modules);
      close();
    } catch (e) {
      if (runId.current !== id) return;
      setError(String(e));
      setPhase('error');
    }
  };

  const cancelRun = () => {
    runId.current++;
    setPhase(plan ? 'plan' : 'describe');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={requestClose}>
      <div
        className="flex max-h-[85vh] w-[38rem] flex-col rounded-lg border border-zinc-800 bg-zinc-950 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 text-lg font-semibold">✨ Preset Wizard</div>

        {phase === 'describe' && (
          <>
            <p className="mb-2 text-sm text-zinc-400">
              Describe the preset you want — use case, tone, features, how many toggles.
              The wizard plans modules first; you approve before anything is generated.
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder='e.g. "A fantasy adventure RP preset with a dice mechanic, 6 stackable genre toggles, 3 NPC stances, and strict no-writing-for-user rules. Balanced creativity."'
              className="min-h-36 resize-none rounded bg-zinc-900 p-3 text-sm outline-none ring-violet-600 focus:ring-1"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={close} className="rounded bg-zinc-800 px-4 py-1.5 text-sm">
                Cancel
              </button>
              <button
                onClick={runPlan}
                disabled={!provider.model}
                title={provider.model ? '' : 'Configure a provider first (⚙)'}
                className="rounded bg-violet-700 px-4 py-1.5 text-sm hover:bg-violet-600 disabled:opacity-40"
              >
                Plan modules
              </button>
            </div>
          </>
        )}

        {(phase === 'planning' || phase === 'generating') && (
          <div className="py-10 text-center text-sm text-zinc-400">
            <div className="mb-2 animate-pulse text-2xl">✨</div>
            {phase === 'planning' ? 'Asking the model for a module plan…' : progress}
            <div className="mt-4">
              <button onClick={cancelRun} className="rounded bg-zinc-800 px-4 py-1.5 text-sm hover:bg-zinc-700">
                Cancel
              </button>
            </div>
            {phase === 'generating' && (
              <div className="mt-2 text-xs text-zinc-600">
                Nothing is applied to your preset until every module is generated.
              </div>
            )}
          </div>
        )}

        {phase === 'plan' && plan && (
          <>
            <p className="mb-2 text-sm text-zinc-400">
              Proposed modules — uncheck "on" to make one opt-in, then generate. Modules are
              added to <b>{preset.name}</b>.
            </p>
            {plan.main && (
              <label className="mb-2 flex items-start gap-2 rounded border border-amber-900/50 bg-amber-950/30 p-2 text-xs text-amber-200">
                <input
                  type="checkbox"
                  checked={applyMain}
                  onChange={() => setApplyMain(!applyMain)}
                  className="mt-0.5 accent-amber-600"
                />
                <span>
                  <b>Replace Main Prompt</b> with: <i className="text-amber-300/80">{plan.main.slice(0, 160)}{plan.main.length > 160 ? '…' : ''}</i>
                </span>
              </label>
            )}
            <div className="flex-1 overflow-y-auto rounded border border-zinc-800">
              {plan.modules.map((m, i) => (
                <div key={i} className="flex items-start gap-2 border-b border-zinc-900 p-2 text-sm">
                  <input
                    type="checkbox"
                    checked={m.enabled}
                    onChange={() => toggleModule(i)}
                    title="enabled by default?"
                    className="mt-1 accent-violet-600"
                  />
                  <div className="min-w-0">
                    <div className="truncate">
                      {m.name}
                      <span className="ml-2 text-[10px] text-zinc-500">
                        {m.category} · {m.role}
                        {m.placement === 'in_chat' ? ` · in-chat @${m.depth}` : ''}
                      </span>
                    </div>
                    <div className="truncate text-xs text-zinc-500">{m.brief}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setPhase('describe')} className="rounded bg-zinc-800 px-4 py-1.5 text-sm">
                Back
              </button>
              <button
                onClick={runGenerate}
                className="rounded bg-violet-700 px-4 py-1.5 text-sm hover:bg-violet-600"
              >
                Generate {plan.modules.length} modules
              </button>
            </div>
          </>
        )}

        {phase === 'error' && (
          <>
            <div className="rounded bg-red-950/50 p-3 text-sm text-red-300">{error}</div>
            <div className="mt-3 flex justify-end">
              <button onClick={() => setPhase(plan ? 'plan' : 'describe')} className="rounded bg-zinc-800 px-4 py-1.5 text-sm">
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
