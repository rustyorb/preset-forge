import { useMemo, useRef } from 'react';
import { useActivePreset, useForge } from '../store';
import { exportPreset } from '../lib/preset';
import { presetTokenStats } from '../lib/tokens';
import { lintPreset } from '../lib/lint';
import { exportKitToFolder } from '../lib/kit';

export default function Toolbar() {
  const preset = useActivePreset();
  const presets = useForge((s) => s.presets);
  const activeId = useForge((s) => s.activeId);
  const {
    importRaw,
    newPresetSlot,
    duplicatePreset,
    deletePreset,
    switchPreset,
    setName,
    setWizardOpen,
    setSettingsOpen,
    setParam,
    upsertReadme,
  } = useForge();
  const fileRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => presetTokenStats(preset), [preset]);
  const errs = useMemo(
    () => lintPreset(preset).filter((f) => f.level === 'error').length,
    [preset],
  );

  const onImport = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text());
      // Imports open a NEW workspace slot; nothing existing is overwritten.
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
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(preset.name || 'preset').replace(/[\\/:*?"<>|]/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const temp = Number(preset.params.temperature ?? 1);

  return (
    <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-950 px-3 py-2">
      <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-lg font-bold text-transparent">
        PresetForge
      </span>

      <select
        value={activeId}
        onChange={(e) => switchPreset(e.target.value)}
        className="max-w-44 rounded bg-zinc-900 px-2 py-1 text-sm"
        title="Switch preset"
      >
        {Object.entries(presets).map(([id, p]) => (
          <option key={id} value={id}>
            {p.name}
          </option>
        ))}
      </select>
      <input
        value={preset.name}
        onChange={(e) => setName(e.target.value)}
        className="w-40 rounded bg-zinc-900 px-2 py-1 text-sm outline-none ring-violet-600 focus:ring-1"
        placeholder="Preset name"
        title="Rename this preset"
      />
      <div className="flex gap-1 text-xs">
        <button onClick={newPresetSlot} className="rounded bg-zinc-800 px-2 py-1 hover:bg-zinc-700" title="New preset">
          +
        </button>
        <button onClick={duplicatePreset} className="rounded bg-zinc-800 px-2 py-1 hover:bg-zinc-700" title="Duplicate this preset">
          ⧉
        </button>
        <button
          onClick={() =>
            confirm(`Delete preset "${preset.name}"? This cannot be undone.`) && deletePreset()
          }
          className="rounded bg-zinc-800 px-2 py-1 text-red-400 hover:bg-red-950"
          title="Delete this preset"
        >
          🗑
        </button>
      </div>

      <label className="ml-2 flex items-center gap-1 text-xs text-zinc-400" title="temperature">
        temp
        <input
          type="number"
          step={0.05}
          min={0}
          max={2}
          value={temp}
          onChange={(e) => {
            if (e.target.value === '') return;
            const n = Number(e.target.value);
            if (Number.isFinite(n)) setParam('temperature', n);
          }}
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
          title="Import a preset into a new slot"
        >
          Import
        </button>
        <button
          onClick={async () => {
            const url = window.prompt('URL of a preset .json (e.g. a GitHub raw link):');
            if (!url) return;
            try {
              const res = await window.fetch(url);
              if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
              const raw = await res.json();
              const name = decodeURIComponent(
                url.split('/').pop()?.replace(/\.json$/i, '') ?? 'from-url',
              );
              importRaw(raw, name);
            } catch (e) {
              alert(`URL import failed: ${e}\n(Some hosts block browser fetches - download the file and use Import instead.)`);
            }
          }}
          className="rounded bg-zinc-800 px-2 py-1 text-sm hover:bg-zinc-700"
          title="Import a preset from a URL (GitHub raw links work)"
        >
          🌐
        </button>
        <button
          onClick={upsertReadme}
          className="rounded bg-zinc-800 px-2 py-1 text-sm hover:bg-zinc-700"
          title="Generate/update a 📖 README module documenting this preset's toggles"
        >
          📖
        </button>
        <button
          onClick={onExport}
          className="rounded bg-emerald-800 px-3 py-1 text-sm hover:bg-emerald-700"
        >
          Export
        </button>
        <button
          onClick={async () => {
            if (errs > 0 && !confirm(`${errs} lint error(s) — export the kit anyway?`)) return;
            try {
              const n = await exportKitToFolder(preset);
              alert(`Kit written: ${n} files (preset + README.md + MODULE_GUIDE.md + regex/)`);
            } catch (e) {
              if (!String(e).includes('AbortError')) alert(`Kit export failed: ${e}`);
            }
          }}
          className="rounded bg-emerald-900 px-2 py-1 text-sm hover:bg-emerald-800"
          title="Export a distribution kit folder: preset.json + README.md + MODULE_GUIDE.md + standalone regex scripts"
        >
          🧰
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
