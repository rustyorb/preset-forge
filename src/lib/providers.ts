import type { ProviderConfig } from './types';

/** One-shot chat call. Returns assistant text; throws when the response has none. */
export async function llmChat(cfg: ProviderConfig, system: string, user: string): Promise<string> {
  if (cfg.kind === 'anthropic') {
    // Tolerate base URLs pasted with a trailing /v1 (docs habit).
    const base = cfg.baseUrl.replace(/\/$/, '').replace(/\/v1$/, '');
    const res = await fetch(`${base}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 4096,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const text = (data.content ?? [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('');
    if (!text.trim()) throw new Error('Model returned no text content');
    return text;
  }

  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.8,
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error(
      'Model returned no message content (reasoning-only models put output in reasoning_content - pick a standard chat model)',
    );
  }
  return text;
}

/**
 * Fetch the provider's model list (LM Studio, OpenRouter, Anthropic, any
 * OpenAI-compatible server). Doubles as the connection test: models arriving
 * proves the base URL + key are right.
 */
export async function listModels(cfg: ProviderConfig): Promise<string[]> {
  let url: string;
  let headers: Record<string, string>;
  if (cfg.kind === 'anthropic') {
    const base = cfg.baseUrl.replace(/\/$/, '').replace(/\/v1$/, '');
    url = `${base}/v1/models?limit=100`;
    headers = {
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
  } else {
    url = `${cfg.baseUrl.replace(/\/$/, '')}/models`;
    headers = cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {};
  }
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const list = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : [];
  const ids = list
    .map((m: { id?: string; name?: string }) => m.id ?? m.name ?? '')
    .filter((s: string) => s.length > 0);
  if (!ids.length) throw new Error('Server responded but listed no models');
  return ids.sort();
}

/** Extract the first parseable JSON object/array from possibly-chatty LLM output. */
export function extractJson<T>(text: string): T {
  const candidates: string[] = [];
  const trimmed = text.trim();
  candidates.push(trimmed);
  for (const m of trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)) {
    candidates.push(m[1].trim());
  }
  for (const c of candidates) {
    try {
      return JSON.parse(c) as T;
    } catch {
      /* keep scanning */
    }
  }
  // Balanced scan: try each opening brace/bracket, match its close, parse the span.
  for (let start = 0; start < trimmed.length; start++) {
    const open = trimmed[start];
    if (open !== '{' && open !== '[') continue;
    const close = open === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    for (let i = start; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (inString) {
        if (ch === '\\') i++;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(trimmed.slice(start, i + 1)) as T;
          } catch {
            break; // balanced but unparseable - try the next opening char
          }
        }
      }
    }
  }
  throw new Error('No parseable JSON found in model output');
}
