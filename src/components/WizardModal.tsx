import { useState } from 'react';
import { useForge } from '../store';
import { generateModuleContent, generatePlan, type WizardPlan } from '../lib/gen';
import { slugify } from '../lib/preset';
import type { PlannedModule } from '../lib/types';

type Phase = 'describe' | 'planning' | 'plan' | 'generating' | 'error';

export default function WizardModal() {
  const { wizardOpen, setWizardOpen, provider, preset, setParam, updatePrompt, addModule, select } =
    useForge();
  const [phase, setPhase] = useState<Phase>('describe');
  const [description, setDescription] = useState('');
  const [plan, setPlan] = useState<WizardPlan | null>(null);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  if (!wizardOpen) return null;

  const close = () => {
    setWizardOpen(false);
    setPhase('describe');
    setPlan(null);
    setError('');
  };

  const runPlan = async () => {
    if (!description.trim()) return;
    setPhase('planning');
    try {
      setPlan(await generatePlan(provider, description));
      setPhase('plan');
    } catch (e) {
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
    setPhase('generating');
    try {
      for (const [k, v] of Object.entries(plan.params ?? {})) setParam(k, v);
      if (plan.main) updatePrompt('main', { content: plan.main });

      const mods: PlannedModule[] = plan.modules;
      for (let i = 0; i < mods.length; i++) {
        const m = mods[i];
        setProgress(`Generating ${i + 1}/${mods.length}: ${m.name}`);
        const content = await generateModuleContent(provider, description, m);
        addModule({
          identifier: slugify(m.name),
          name: m.name,
          role: m.role,
          content,
          enabled: m.enabled,
          injection_position: m.placement === 'in_chat' ? 1 : 0,
          injection_depth: m.depth,
          injection_order: m.order,
        });
      }
      select(null);
      close();
    } catch (e) {
      setError(String(e));
      setPhase('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={close}>
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
          </div>
        )}

        {phase === 'plan' && plan && (
          <>
            <p className="mb-2 text-sm text-zinc-400">
              Proposed modules — uncheck "on" to make one opt-in, then generate. Modules are
              added to <b>{preset.name}</b>.
            </p>
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
              <button onClick={() => setPhase('describe')} className="rounded bg-zinc-800 px-4 py-1.5 text-sm">
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
