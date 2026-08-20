import { useEffect, useRef, useState } from 'react';
import { useForge } from '../store';
import { listModels } from '../lib/providers';
import { PROVIDER_SERVICES, type ProviderService } from '../lib/types';

type FetchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; models: string[] }
  | { kind: 'error'; message: string };

export default function SettingsModal() {
  const provider = useForge((s) => s.provider);
  const setProvider = useForge((s) => s.setProvider);
  const settingsOpen = useForge((s) => s.settingsOpen);
  const setSettingsOpen = useForge((s) => s.setSettingsOpen);
  const [fetch, setFetch] = useState<FetchState>({ kind: 'idle' });
  const runId = useRef(0);

  const set = (patch: Partial<typeof provider>) => setProvider({ ...provider, ...patch });

  // Auto-fetch models whenever the modal is open and connection details settle.
  // The fetched list doubles as the connection test.
  useEffect(() => {
    if (!settingsOpen) return;
    if (!provider.baseUrl) {
      setFetch({ kind: 'idle' });
      return;
    }
    const id = ++runId.current;
    setFetch({ kind: 'loading' });
    const timer = window.setTimeout(async () => {
      try {
        const models = await listModels(provider);
        if (runId.current === id) setFetch({ kind: 'ok', models });
      } catch (e) {
        if (runId.current === id) {
          setFetch({ kind: 'error', message: String(e instanceof Error ? e.message : e) });
        }
      }
    }, 500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen, provider.kind, provider.baseUrl, provider.apiKey]);

  if (!settingsOpen) return null;

  const models = fetch.kind === 'ok' ? fetch.models : [];
  const showSelect = models.length > 0;

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
          <span className="mb-1 block text-zinc-400">Service</span>
          <select
            value={provider.service}
            onChange={(e) => {
              const service = e.target.value as ProviderService;
              const svc = PROVIDER_SERVICES[service];
              // Prebuilt URL per service. Keep a custom localhost port when
              // re-picking LM Studio (e.g. port 1235), keep any URL for custom.
              const keepUrl =
                service === 'custom' ||
                (service === 'lmstudio' && /^https?:\/\/(localhost|127\.0\.0\.1):\d+/.test(provider.baseUrl));
              set({
                service,
                kind: svc.kind,
                baseUrl: keepUrl && provider.baseUrl ? provider.baseUrl : svc.baseUrl,
              });
            }}
            className="w-full rounded bg-zinc-900 px-2 py-1.5"
          >
            {Object.entries(PROVIDER_SERVICES).map(([id, svc]) => (
              <option key={id} value={id}>
                {svc.label}
              </option>
            ))}
          </select>
        </label>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-zinc-400">Base URL</span>
          <input
            value={provider.baseUrl}
            onChange={(e) => set({ baseUrl: e.target.value })}
            className="w-full rounded bg-zinc-900 px-2 py-1.5 font-mono text-xs"
            placeholder={PROVIDER_SERVICES[provider.service]?.baseUrl || 'https://my-proxy/v1'}
          />
        </label>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-zinc-400">API key (stored in this browser only)</span>
          <input
            type="password"
            autoComplete="off"
            value={provider.apiKey}
            onChange={(e) => set({ apiKey: e.target.value })}
            className="w-full rounded bg-zinc-900 px-2 py-1.5 font-mono text-xs"
          />
        </label>

        <div className="mb-3 text-xs">
          {fetch.kind === 'loading' && <span className="text-zinc-500">⟳ contacting server…</span>}
          {fetch.kind === 'ok' && (
            <span className="text-emerald-400">✓ connected — {models.length} models</span>
          )}
          {fetch.kind === 'error' && (
            <span className="text-red-400" title={fetch.message}>
              ✗ not connected: {fetch.message.slice(0, 80)}
            </span>
          )}
        </div>

        <label className="mb-4 block text-sm">
          <span className="mb-1 flex items-center gap-2 text-zinc-400">
            Model
            <button
              onClick={() => set({ baseUrl: provider.baseUrl })}
              className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] hover:bg-zinc-700"
              title="Re-fetch the model list"
            >
              ↻ refresh
            </button>
          </span>
          {showSelect ? (
            <select
              value={provider.model}
              onChange={(e) => set({ model: e.target.value })}
              className="w-full rounded bg-zinc-900 px-2 py-1.5 font-mono text-xs"
            >
              {!models.includes(provider.model) && (
                <option value={provider.model}>
                  {provider.model ? `${provider.model} (not on server)` : '— pick a model —'}
                </option>
              )}
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={provider.model}
              onChange={(e) => set({ model: e.target.value })}
              className="w-full rounded bg-zinc-900 px-2 py-1.5 font-mono text-xs"
              placeholder="server unreachable — type a model id manually"
            />
          )}
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
