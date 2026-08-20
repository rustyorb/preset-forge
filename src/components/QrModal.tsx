import { useState } from 'react';
import { useActivePreset, useForge } from '../store';
import { generateQuickReplies } from '../lib/gen';
import { addQr, lintQrMessage, newQrSet, type QuickReplySet } from '../lib/quickReplies';

export default function QrModal() {
  const qrOpen = useForge((s) => s.qrOpen);
  const setQrOpen = useForge((s) => s.setQrOpen);
  const qrSets = useForge((s) => s.qrSets);
  const setQrSets = useForge((s) => s.setQrSets);
  const provider = useForge((s) => s.provider);
  const preset = useActivePreset();
  const [activeIdx, setActiveIdx] = useState(0);
  const [genText, setGenText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!qrOpen) return null;

  const set = qrSets[activeIdx] as QuickReplySet | undefined;

  const updateSet = (next: QuickReplySet) =>
    setQrSets(qrSets.map((s, i) => (i === activeIdx ? next : s)));

  const updateQr = (id: number, patch: Partial<QuickReplySet['qrList'][number]>) => {
    if (!set) return;
    updateSet({ ...set, qrList: set.qrList.map((q) => (q.id === id ? { ...q, ...patch } : q)) });
  };

  const runGenerate = async () => {
    if (!genText.trim() || busy || !set) return;
    setBusy(true);
    setError('');
    try {
      const drafts = await generateQuickReplies(provider, genText, preset.name);
      let next = set;
      for (const d of drafts) next = addQr(next, d);
      updateSet(next);
      setGenText('');
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const onExport = () => {
    if (!set) return;
    const blob = new Blob([JSON.stringify(set, null, 4)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${set.name.replace(/[\\/:*?"<>|]/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setQrOpen(false)}>
      <div
        className="flex max-h-[85vh] w-[42rem] flex-col rounded-lg border border-zinc-800 bg-zinc-950 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 text-lg font-semibold">⚡ Quick Replies</div>
        <div className="mb-3 text-xs text-zinc-500">
          Button macros + STScript automations that ship with your preset kit. Import into
          ST via Extensions → Quick Replies.
        </div>

        <div className="mb-3 flex items-center gap-1">
          {qrSets.map((s, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`max-w-40 truncate rounded px-3 py-1 text-sm ${
                i === activeIdx ? 'bg-violet-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {s.name}
            </button>
          ))}
          <button
            onClick={() => {
              setQrSets([...qrSets, newQrSet(`${preset.name} QRs`)]);
              setActiveIdx(qrSets.length);
            }}
            className="rounded bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700"
            title="New Quick Reply set"
          >
            + Set
          </button>
          {set && (
            <div className="ml-auto flex gap-1">
              <button onClick={onExport} className="rounded bg-emerald-900 px-2 py-1 text-xs hover:bg-emerald-800">
                Export
              </button>
              <button
                onClick={() => {
                  if (!confirm(`Delete set "${set.name}"?`)) return;
                  setQrSets(qrSets.filter((_, i) => i !== activeIdx));
                  setActiveIdx(0);
                }}
                className="rounded bg-zinc-800 px-2 py-1 text-xs text-red-400 hover:bg-red-950"
              >
                Delete set
              </button>
            </div>
          )}
        </div>

        {set && (
          <>
            <div className="mb-3 flex gap-2">
              <input
                value={set.name}
                onChange={(e) => updateSet({ ...set, name: e.target.value })}
                className="w-56 rounded bg-zinc-900 px-2 py-1 text-sm"
                title="Set name (becomes the filename)"
              />
              <button
                onClick={() => updateSet(addQr(set, { label: 'New QR', message: '' }))}
                className="rounded bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700"
              >
                + QR
              </button>
            </div>

            <div className="mb-3 rounded border border-zinc-800 bg-zinc-900/50 p-2">
              <div className="mb-1 text-xs font-semibold text-zinc-400">✨ Generate QRs</div>
              <div className="flex gap-2">
                <input
                  value={genText}
                  onChange={(e) => setGenText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runGenerate()}
                  placeholder='e.g. "a d20 skill-check button, a rewind-last-message button, and a scene-summary generator"'
                  className="flex-1 rounded bg-zinc-950 px-2 py-1 text-sm outline-none ring-violet-600 focus:ring-1"
                />
                <button
                  onClick={runGenerate}
                  disabled={busy || !provider.model}
                  title={provider.model ? '' : 'Configure a provider first (⚙)'}
                  className="rounded bg-violet-700 px-3 py-1 text-sm hover:bg-violet-600 disabled:opacity-50"
                >
                  {busy ? '…' : 'Generate'}
                </button>
              </div>
              {error && <div className="mt-1 text-xs text-red-400">{error}</div>}
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              {set.qrList.map((qr) => {
                const lint = lintQrMessage(qr.message);
                return (
                  <div key={qr.id} className="rounded bg-zinc-900 p-2">
                    <div className="mb-1 flex items-center gap-2">
                      <input
                        value={qr.label}
                        onChange={(e) => updateQr(qr.id, { label: e.target.value })}
                        className="w-40 rounded bg-zinc-950 px-2 py-1 text-sm"
                        title="Button label"
                      />
                      <input
                        value={qr.title}
                        onChange={(e) => updateQr(qr.id, { title: e.target.value })}
                        placeholder="tooltip (optional)"
                        className="flex-1 rounded bg-zinc-950 px-2 py-1 text-xs text-zinc-400"
                      />
                      <button
                        onClick={() =>
                          updateSet({ ...set, qrList: set.qrList.filter((q) => q.id !== qr.id) })
                        }
                        className="rounded px-1.5 py-0.5 text-xs text-red-400 hover:bg-red-950"
                      >
                        ×
                      </button>
                    </div>
                    <textarea
                      value={qr.message}
                      onChange={(e) => updateQr(qr.id, { message: e.target.value })}
                      spellCheck={false}
                      placeholder="Plain text, or STScript starting with /"
                      className="h-16 w-full resize-y rounded bg-zinc-950 p-2 font-mono text-xs"
                    />
                    {lint && <div className="mt-0.5 text-xs text-amber-400">⚠ {lint}</div>}
                  </div>
                );
              })}
              {set.qrList.length === 0 && (
                <div className="p-4 text-sm text-zinc-600">
                  Empty set — describe what you want above and Generate, or + QR to write one by hand.
                </div>
              )}
            </div>
          </>
        )}

        {!set && qrSets.length === 0 && (
          <div className="rounded bg-zinc-900 p-6 text-sm text-zinc-500">
            No Quick Reply sets yet — hit "+ Set" to start one for {preset.name}.
          </div>
        )}

        <div className="mt-3 flex justify-end">
          <button onClick={() => setQrOpen(false)} className="rounded bg-violet-700 px-4 py-1.5 text-sm hover:bg-violet-600">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
