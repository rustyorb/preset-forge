import { useRef } from 'react';
import { useForge } from '../store';
import { exportPreset } from '../lib/preset';
import { presetTokenStats } from '../lib/tokens';
import { lintPreset } from '../lib/lint';

export default function Toolbar() {
  const { preset, importRaw, reset, setName, setWizardOpen, setSettingsOpen, setParam } =
    useForge();
  const fileRef = useRef<HTMLInputElement>(null);

  const stats = presetTokenStats(preset);
  const errs = lintPreset(preset).filter((f) => f.level === 'error').length;

  const onImport = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text());
      importRaw(raw, file.name.replace(/\.json$/i, ''));
    } catch (e) {
      alert(`Import failed: ${e}`);
    }
  };

  const onExport = () => {
    if (errs > 0 && !confirm(`${errs} lint error(s) — export anyway?`)) return;
    const blob = new Blob([JSON.stringify(exportPreset(preset), null, 4)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${preset.name || 'preset'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const temp = Number(preset.params.temperature ?? 1);

  return (
    <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-950 px-3 py-2">
      <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-lg font-bold text-transparent">
        PresetForge
      </span>

      <input
        value={preset.name}
        onChange={(e) => setName(e.target.value)}
        className="w-52 rounded bg-zinc-900 px-2 py-1 text-sm outline-none ring-violet-600 focus:ring-1"
        placeholder="Preset name"
      />

      <label className="ml-2 flex items-center gap-1 text-xs text-zinc-400" title="temperature">
        temp
        <input
          type="number"
          step={0.05}
          min={0}
          max={2}
          value={temp}
          onChange={(e) => setParam('temperature', Number(e.target.value))}
          className="w-16 rounded bg-zinc-900 px-1.5 py-1"
        />
      </label>

      <div className="ml-auto flex items-center gap-2">
        <span
          className="text-xs text-zinc-500"
          title="rough token estimate of enabled prompt content"
        >
          ~{stats.enabledTokens} tok enabled / {stats.totalTokens} total
        </span>
        <button
          onClick={() => setWizardOpen(true)}
          className="rounded bg-violet-700 px-3 py-1 text-sm font-medium hover:bg-violet-600"
        >
          ✨ Wizard
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="rounded bg-zinc-800 px-3 py-1 text-sm hover:bg-zinc-700"
        >
          Import
        </button>
        <button
          onClick={onExport}
          className="rounded bg-emerald-800 px-3 py-1 text-sm hover:bg-emerald-700"
        >
          Export
        </button>
        <button
          onClick={() => confirm('Start a fresh preset? Unexported changes are lost.') && reset()}
          className="rounded bg-zinc-800 px-3 py-1 text-sm hover:bg-zinc-700"
          title="New preset"
        >
          New
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="rounded bg-zinc-800 px-3 py-1 text-sm hover:bg-zinc-700"
          title="LLM provider settings"
        >
          ⚙
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
  );
}
