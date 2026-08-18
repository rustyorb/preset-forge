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
  params: Record<string, unknown>;
  main?: string;
  modules: PlannedModule[];
}

export async function generatePlan(cfg: ProviderConfig, description: string): Promise<WizardPlan> {
  const raw = await llmChat(cfg, PLAN_SYSTEM, description);
  const plan = extractJson<WizardPlan>(raw);
  if (!Array.isArray(plan.modules)) throw new Error('Plan has no modules array');
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
