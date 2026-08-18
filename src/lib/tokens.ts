import type { WorkingPreset } from './types';

/** Rough token estimate: ~4 chars/token + small per-message overhead. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function presetTokenStats(wp: WorkingPreset) {
  const enabled = new Set(wp.order.filter((e) => e.enabled).map((e) => e.identifier));
  let enabledTokens = 0;
  let totalTokens = 0;
  for (const p of wp.prompts) {
    if (p.marker || !p.content) continue;
    const t = estimateTokens(p.content) + 8;
    totalTokens += t;
    if (enabled.has(p.identifier)) enabledTokens += t;
  }
  return { enabledTokens, totalTokens };
}
