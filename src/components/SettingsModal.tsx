import { useForge } from '../store';

export default function SettingsModal() {
  const { provider, setProvider, settingsOpen, setSettingsOpen } = useForge();
  if (!settingsOpen) return null;

  const set = (patch: Partial<typeof provider>) => setProvider({ ...provider, ...patch });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={() => setSettingsOpen(false)}
    >
      <div
        className="w-[28rem] rounded-lg border border-zinc-800 bg-zinc-950 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 text-lg font-semibold">LLM Provider</div>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-zinc-400">Kind</span>
          <select
            value={provider.kind}
            onChange={(e) => {
              const kind = e.target.value as typeof provider.kind;
              set({
                kind,
                baseUrl:
                  kind === 'anthropic'
                    ? 'https://api.anthropic.com'
                    : provider.baseUrl.includes('anthropic')
                      ? 'http://localhost:1234/v1'
                      : provider.baseUrl,
              });
            }}
            className="w-full rounded bg-zinc-900 px-2 py-1.5"
          >
            <option value="openai">OpenAI-compatible (LM Studio, OpenRouter, …)</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </label>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-zinc-400">Base URL</span>
          <input
            value={provider.baseUrl}
            onChange={(e) => set({ baseUrl: e.target.value })}
            className="w-full rounded bg-zinc-900 px-2 py-1.5 font-mono text-xs"
            placeholder="http://localhost:1234/v1"
          />
        </label>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-zinc-400">API key (stored in this browser only)</span>
          <input
            type="password"
            value={provider.apiKey}
            onChange={(e) => set({ apiKey: e.target.value })}
            className="w-full rounded bg-zinc-900 px-2 py-1.5 font-mono text-xs"
          />
        </label>

        <label className="mb-4 block text-sm">
          <span className="mb-1 block text-zinc-400">Model</span>
          <input
            value={provider.model}
            onChange={(e) => set({ model: e.target.value })}
            className="w-full rounded bg-zinc-900 px-2 py-1.5 font-mono text-xs"
            placeholder="e.g. claude-sonnet-4-5 / local-model"
          />
        </label>

        <div className="flex justify-end">
          <button
            onClick={() => setSettingsOpen(false)}
            className="rounded bg-violet-700 px-4 py-1.5 text-sm hover:bg-violet-600"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
