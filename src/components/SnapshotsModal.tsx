import { useMemo, useState } from 'react';
import { useActivePreset, useForge } from '../store';
import { deleteSnapshot, diffPresets, loadSnapshots } from '../lib/snapshots';

export default function SnapshotsModal() {
  const { snapshotsOpen, setSnapshotsOpen, activeId, takeSnapshot, restorePreset } = useForge();
  const preset = useActivePreset();
  const [refresh, setRefresh] = useState(0);
  const [diffIdx, setDiffIdx] = useState<number | null>(null);

  const snapshots = useMemo(
    () => (snapshotsOpen ? loadSnapshots(activeId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshotsOpen, activeId, refresh],
  );
  const diff = useMemo(
    () => (diffIdx !== null && snapshots[diffIdx] ? diffPresets(snapshots[diffIdx].preset, preset) : null),
    [diffIdx, snapshots, preset],
  );

  if (!snapshotsOpen) return null;

  const close = () => {
    setSnapshotsOpen(false);
    setDiffIdx(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={close}>
      <div
        className="flex max-h-[85vh] w-[36rem] flex-col rounded-lg border border-zinc-800 bg-zinc-950 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="text-lg font-semibold">🕒 Snapshots</span>
          <button
            onClick={() => {
              takeSnapshot('manual');
              setRefresh((r) => r + 1);
            }}
            className="rounded bg-violet-700 px-3 py-1 text-sm hover:bg-violet-600"
          >
            + Snapshot now
          </button>
        </div>
        <div className="mb-3 text-xs text-zinc-500">
          {preset.name} — auto-snapshotted before wizard runs and restores; last 5 kept.
        </div>

        {snapshots.length === 0 && (
          <div className="rounded bg-zinc-900 p-4 text-sm text-zinc-500">No snapshots yet.</div>
        )}

        <div className="flex-1 overflow-y-auto">
          {snapshots.map((snap, i) => (
            <div key={snap.at + i} className="mb-1.5 rounded bg-zinc-900 p-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-zinc-300">{snap.label}</span>
                <span className="text-xs text-zinc-600">{new Date(snap.at).toLocaleString()}</span>
                <span className="text-xs text-zinc-600">· {snap.preset.prompts.length} modules</span>
                <div className="ml-auto flex gap-1">
                  <button
                    onClick={() => setDiffIdx(diffIdx === i ? null : i)}
                    className={`rounded px-2 py-0.5 text-xs hover:bg-zinc-700 ${diffIdx === i ? 'bg-violet-900' : 'bg-zinc-800'}`}
                  >
                    diff
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Restore "${snap.label}"? Current state is snapshotted first.`)) {
                        restorePreset(snap.preset);
                        close();
                      }
                    }}
                    className="rounded bg-emerald-900 px-2 py-0.5 text-xs hover:bg-emerald-800"
                  >
                    restore
                  </button>
                  <button
                    onClick={() => {
                      deleteSnapshot(activeId, i);
                      setRefresh((r) => r + 1);
                      setDiffIdx(null);
                    }}
                    className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-red-400 hover:bg-red-950"
                  >
                    ×
                  </button>
                </div>
              </div>

              {diffIdx === i && diff && (
                <div className="mt-2 space-y-1 border-t border-zinc-800 pt-2 text-xs">
                  <div className="text-zinc-500">snapshot → current:</div>
                  {diff.added.length > 0 && (
                    <div className="text-emerald-300">+ added: {diff.added.join(', ')}</div>
                  )}
                  {diff.removed.length > 0 && (
                    <div className="text-red-300">− removed: {diff.removed.join(', ')}</div>
                  )}
                  {diff.contentChanged.length > 0 && (
                    <div className="text-amber-300">~ edited: {diff.contentChanged.join(', ')}</div>
                  )}
                  {diff.toggled.length > 0 && (
                    <div className="text-sky-300">
                      ⇄ toggled: {diff.toggled.map((t) => `${t.name} ${t.enabled ? 'on' : 'off'}`).join(', ')}
                    </div>
                  )}
                  {diff.paramChanges.length > 0 && (
                    <div className="text-violet-300">
                      ⚙ params: {diff.paramChanges.map((p) => `${p.key} ${p.from ?? '∅'}→${p.to ?? '∅'}`).join(', ')}
                    </div>
                  )}
                  {diff.orderMoved && <div className="text-zinc-400">↕ module order changed</div>}
                  {!diff.added.length &&
                    !diff.removed.length &&
                    !diff.contentChanged.length &&
                    !diff.toggled.length &&
                    !diff.paramChanges.length &&
                    !diff.orderMoved && <div className="text-zinc-500">identical</div>}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-3 flex justify-end">
          <button onClick={close} className="rounded bg-zinc-800 px-4 py-1.5 text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
