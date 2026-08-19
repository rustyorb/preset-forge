import type { PlannedModule, ProviderConfig } from './types';
import { extractJson, llmChat } from './providers';

const PLAN_SYSTEM = `You are a SillyTavern preset architect. You design modular Chat Completion presets.

Design rules (follow exactly):
- Core modules (identity, narrative style, role separation) are enabled by default; everything optional (genres, stances, POV, mechanics) is disabled for the user to toggle. 10-15 enabled max.
- Most modules are placement "relative" (ordered blocks in the prompt stack). Use placement "in_chat" ONLY for recency-powered instructions (format enforcement, post-history reminders): depth 0-2, brief content, at most 1-3 such modules.
- Genres/stances are small (50-150 tokens of content); core modules are larger (300-800 tokens).
- Mutually exclusive groups (POV options, stances) get a "🔗 " name prefix.
- Categories order: System, Style, Features, Genres, POV, Utility.
- Sampler guidance: balanced RP temp 0.85 / top_p 0.95; creative 1.1-1.2; only suggest min_p/repetition_penalty if the user targets OpenRouter/local (Claude & OpenAI ignore them).

Respond with ONLY a JSON object:
{
  "params": {"temperature": 0.85, "top_p": 0.95, "openai_max_tokens": 2048, "openai_max_context": 32768},
  "main": "one-paragraph main prompt content",
  "modules": [
    {"name": "📜 System: Core Directive", "brief": "what this module does, 1-2 sentences",
     "role": "system", "placement": "relative", "depth": 4, "order": 100,
     "enabled": true, "category": "System"}
  ]
}`;

const CONTENT_SYSTEM = `You write the content of one SillyTavern preset module. Output ONLY the module content as plain text - no JSON, no markdown fences, no commentary. Use {{char}} / {{user}} macros where natural. Follow the token-size guidance you are given. Write instructions to the AI (imperative voice), not descriptions about them.`;

export interface WizardPlan {
  params: Record<string, number>;
  main?: string;
  modules: PlannedModule[];
}

/** Sampler keys the wizard may set; everything else the LLM returns is dropped. */
const PLAN_PARAM_WHITELIST = new Set([
  'temperature',
  'top_p',
  'top_k',
  'min_p',
  'repetition_penalty',
  'frequency_penalty',
  'presence_penalty',
  'openai_max_tokens',
  'openai_max_context',
]);

export async function generatePlan(cfg: ProviderConfig, description: string): Promise<WizardPlan> {
  const raw = await llmChat(cfg, PLAN_SYSTEM, description);
  const plan = extractJson<WizardPlan>(raw);
  if (!Array.isArray(plan.modules)) throw new Error('Plan has no modules array');
  const params: Record<string, number> = {};
  for (const [k, v] of Object.entries(plan.params ?? {})) {
    const n = Number(v);
    if (PLAN_PARAM_WHITELIST.has(k) && Number.isFinite(n)) params[k] = n;
  }
  plan.params = params;
  plan.main = typeof plan.main === 'string' && plan.main.trim() ? plan.main : undefined;
  plan.modules = plan.modules.map((m) => ({
    name: String(m.name ?? 'Module'),
    brief: String(m.brief ?? ''),
    role: (['system', 'user', 'assistant'] as const).includes(m.role) ? m.role : 'system',
    placement: m.placement === 'in_chat' ? 'in_chat' : 'relative',
    depth: Number.isFinite(m.depth) ? Math.max(0, Math.floor(m.depth)) : 4,
    order: Number.isFinite(m.order) ? Math.floor(m.order) : 100,
    enabled: !!m.enabled,
    category: String(m.category ?? 'Features'),
  }));
  return plan;
}

export async function generateModuleContent(
  cfg: ProviderConfig,
  presetDescription: string,
  module: PlannedModule,
): Promise<string> {
  const size =
    module.category === 'System' || module.category === 'Style'
      ? '300-800 tokens'
      : '50-150 tokens';
  const user = `Preset concept: ${presetDescription}

Module: ${module.name}
Purpose: ${module.brief}
Target size: ${size}
${module.placement === 'in_chat' ? 'This is injected near the end of the chat: keep it brief and imperative.' : ''}

Write the module content now.`;
  return (await llmChat(cfg, CONTENT_SYSTEM, user)).trim();
}

const ADVISOR_SYSTEM = `You are a SillyTavern preset advisor. Given a character card and the preset's module list, recommend which optional modules to enable or disable for THIS character - like a creative director making taste decisions. Consider tone, genre, themes, and mechanics implied by the card. Do not recommend changes to core system modules unless clearly wrong for the character.

Respond with ONLY a JSON array:
[{"identifier": "genre-romance-x1", "enabled": true, "reason": "card is a slow-burn romance lead"}]

Include ONLY modules whose state you would change or explicitly endorse; omit ones you have no opinion on. Use ONLY identifiers from the provided list.`;

export interface AdvisorRec {
  identifier: string;
  enabled: boolean;
  reason: string;
}

export async function adviseModules(
  cfg: ProviderConfig,
  card: { name: string; description: string; personality: string; scenario: string },
  modules: { identifier: string; name: string; enabled: boolean; snippet: string }[],
): Promise<AdvisorRec[]> {
  const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);
  const user = `CHARACTER CARD
Name: ${card.name}
Description: ${clip(card.description, 1500)}
Personality: ${clip(card.personality, 500)}
Scenario: ${clip(card.scenario, 500)}

PRESET MODULES (identifier | currently enabled | name | content snippet)
${modules
  .map((m) => `${m.identifier} | ${m.enabled ? 'ON' : 'off'} | ${m.name} | ${clip(m.snippet, 120)}`)
  .join('\n')}

Recommend module states for this character.`;
  const raw = await llmChat(cfg, ADVISOR_SYSTEM, user);
  const recs = extractJson<AdvisorRec[]>(raw);
  if (!Array.isArray(recs)) throw new Error('Advisor did not return a list');
  const known = new Set(modules.map((m) => m.identifier));
  return recs
    .filter((r) => r && known.has(r.identifier))
    .map((r) => ({
      identifier: r.identifier,
      enabled: !!r.enabled,
      reason: String(r.reason ?? ''),
    }));
}

export async function refineContent(
  cfg: ProviderConfig,
  moduleName: string,
  currentContent: string,
  instruction: string,
): Promise<string> {
  const user = `Module "${moduleName}" current content:
---
${currentContent}
---
Revision instruction: ${instruction}

Output the full revised module content only.`;
  return (await llmChat(cfg, CONTENT_SYSTEM, user)).trim();
}
