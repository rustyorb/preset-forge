import { useEffect, useState } from 'react';
import { useActivePreset, useForge } from '../store';
import { exportPreset } from '../lib/preset';
import {
  getLinkedFolder,
  linkFolder,
  listPresetFiles,
  readPresetFile,
  unlinkFolder,
  writePresetFile,
} from '../lib/stLink';

export default function StLinkModal() {
  const stOpen = useForge((s) => s.stOpen);
  const setStOpen = useForge((s) => s.setStOpen);
  const importRaw = useForge((s) => s.importRaw);
  const preset = useActivePreset();
  const [linked, setLinked] = useState<boolean | null>(null);
  const [folderName, setFolderName] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!stOpen) return;
    (async () => {
      const handle = await getLinkedFolder();
      setLinked(!!handle);
      if (handle) {
        setFolderName(handle.name);
        setFiles(await listPresetFiles(handle));
      }
    })();
  }, [stOpen]);

  if (!stOpen) return null;

  const close = () => {
    setStOpen(false);
    setStatus('');
  };

  const doLink = async () => {
    try {
      const handle = await linkFolder();
      setLinked(true);
      setFolderName(handle.name);
      setFiles(await listPresetFiles(handle));
      setStatus('');
    } catch (e) {
      if (!String(e).includes('AbortError')) setStatus(String(e));
    }
  };

  const saveToSt = async () => {
    const handle = await getLinkedFolder();
    if (!handle) return setStatus('Folder link lost - relink.');
    const name = `${(preset.name || 'preset').replace(/[\\/:*?"<>|]/g, '_')}.json`;
    let result = await writePresetFile(handle, name, exportPreset(preset), false);
    if (result === 'exists') {
      if (!confirm(`"${name}" already exists in SillyTavern - overwrite it?`)) return;
      result = await writePresetFile(handle, name, exportPreset(preset), true);
    }
    setFiles(await listPresetFiles(handle));
    setStatus(`✓ saved ${name} — select it in ST's preset dropdown (restart ST or reload the page to see new files).`);
  };

  const openFromSt = async (name: string) => {
    const handle = await getLinkedFolder();
    if (!handle) return setStatus('Folder link lost - relink.');
    try {
      const raw = await readPresetFile(handle, name);
      importRaw(raw, name.replace(/\.json$/i, ''));
      close();
    } catch (e) {
      setStatus(`Open failed: ${e}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={close}>
      <div
        className="flex max-h-[85vh] w-[30rem] flex-col rounded-lg border border-zinc-800 bg-zinc-950 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 text-lg font-semibold">🔗 SillyTavern link</div>

        {linked === false && (
          <>
            <p className="mb-3 text-sm text-zinc-400">
              Pick your ST Chat Completion presets folder once —{' '}
              <code className="text-xs text-zinc-500">
                SillyTavern/data/default-user/OpenAI Settings
              </code>{' '}
              — then Save/Open work directly against it. No more export→import dance.
            </p>
            <button onClick={doLink} className="rounded bg-violet-700 px-4 py-2 text-sm hover:bg-violet-600">
              Pick ST presets folder…
            </button>
          </>
        )}

        {linked && (
          <>
            <div className="mb-3 flex items-center gap-2 text-xs text-zinc-500">
              linked: <code className="text-zinc-300">{folderName}</code>
              <button onClick={doLink} className="rounded bg-zinc-800 px-1.5 py-0.5 hover:bg-zinc-700">
                relink
              </button>
              <button
                onClick={async () => {
                  await unlinkFolder();
                  setLinked(false);
                  setFiles([]);
                }}
                className="rounded bg-zinc-800 px-1.5 py-0.5 text-red-400 hover:bg-red-950"
              >
                unlink
              </button>
            </div>

            <button
              onClick={saveToSt}
              className="mb-3 rounded bg-emerald-800 px-4 py-2 text-sm hover:bg-emerald-700"
            >
              💾 Save "{preset.name}" to SillyTavern
            </button>

            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Open from SillyTavern ({files.length})
            </div>
            <div className="flex-1 overflow-y-auto rounded border border-zinc-800">
              {files.map((f) => (
                <button
                  key={f}
                  onClick={() => openFromSt(f)}
                  className="block w-full truncate border-b border-zinc-900 px-3 py-1.5 text-left text-sm hover:bg-zinc-900"
                  title={`Open ${f} in a new workspace slot`}
                >
                  {f}
                </button>
              ))}
              {files.length === 0 && (
                <div className="p-3 text-sm text-zinc-600">No .json presets found in the folder.</div>
              )}
            </div>
          </>
        )}

        {status && <div className="mt-2 text-xs text-emerald-300">{status}</div>}

        <div className="mt-3 flex justify-end">
          <button onClick={close} className="rounded bg-zinc-800 px-4 py-1.5 text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
