import { useState } from 'react';
import { useForge } from './store';
import Toolbar from './components/Toolbar';
import Outline from './components/Outline';
import Editor from './components/Editor';
import Preview from './components/Preview';
import AdvisorModal from './components/AdvisorModal';
import SettingsModal from './components/SettingsModal';
import WizardModal from './components/WizardModal';

export default function App() {
  const addModule = useForge((s) => s.addModule);
  const selectedId = useForge((s) => s.selectedId);
  const library = useForge((s) => s.library);
  const insertFromLibrary = useForge((s) => s.insertFromLibrary);
  const removeFromLibrary = useForge((s) => s.removeFromLibrary);
  const [libOpen, setLibOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-72 shrink-0 flex-col border-r border-zinc-800">
          <div className="flex items-center justify-between border-b border-zinc-800 px-2 py-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Modules
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setLibOpen(!libOpen)}
                className={`rounded px-2 py-0.5 text-xs hover:bg-zinc-700 ${
                  libOpen ? 'bg-violet-900' : 'bg-zinc-800'
                }`}
                title="Module library: reusable blocks shared across presets (☆ Save in the editor adds here)"
              >
                📦 {library.length}
              </button>
              <button
                onClick={() => addModule()}
                className="rounded bg-zinc-800 px-2 py-0.5 text-xs hover:bg-zinc-700"
                title="Add module below selection"
              >
                + Add
              </button>
            </div>
          </div>
          {libOpen && (
            <div className="max-h-48 overflow-y-auto border-b border-zinc-800 bg-zinc-900/60 p-1">
              {library.length === 0 && (
                <div className="p-2 text-xs text-zinc-600">
                  Empty. Open a module and hit "☆ Save" to keep it as a reusable block.
                </div>
              )}
              {library.map((entry, i) => (
                <div key={i} className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-zinc-900">
                  <span className="truncate">{entry.name}</span>
                  <button
                    onClick={() => insertFromLibrary(i)}
                    className="ml-auto shrink-0 rounded bg-zinc-800 px-1.5 hover:bg-violet-900"
                    title="Insert into this preset"
                  >
                    +
                  </button>
                  <button
                    onClick={() => removeFromLibrary(i)}
                    className="shrink-0 rounded bg-zinc-800 px-1.5 text-red-400 hover:bg-red-950"
                    title="Remove from library"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <Outline />
        </aside>
        <main className="min-w-0 flex-1">
          {/* Keyed so refine drafts/proposals reset when the selection changes. */}
          <Editor key={selectedId ?? 'none'} />
        </main>
        <aside className="w-96 shrink-0 border-l border-zinc-800">
          <Preview />
        </aside>
      </div>
      <SettingsModal />
      <WizardModal />
      <AdvisorModal />
    </div>
  );
}
