import { useForge } from './store';
import Toolbar from './components/Toolbar';
import Outline from './components/Outline';
import Editor from './components/Editor';
import Preview from './components/Preview';
import SettingsModal from './components/SettingsModal';
import WizardModal from './components/WizardModal';

export default function App() {
  const addModule = useForge((s) => s.addModule);

  return (
    <div className="flex h-screen flex-col">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-72 shrink-0 flex-col border-r border-zinc-800">
          <div className="flex items-center justify-between border-b border-zinc-800 px-2 py-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Modules
            </span>
            <button
              onClick={() => addModule()}
              className="rounded bg-zinc-800 px-2 py-0.5 text-xs hover:bg-zinc-700"
              title="Add module below selection"
            >
              + Add
            </button>
          </div>
          <Outline />
        </aside>
        <main className="min-w-0 flex-1">
          <Editor />
        </main>
        <aside className="w-96 shrink-0 border-l border-zinc-800">
          <Preview />
        </aside>
      </div>
      <SettingsModal />
      <WizardModal />
    </div>
  );
}
