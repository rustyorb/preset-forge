export type Role = 'system' | 'user' | 'assistant';

/** One entry in the preset's `prompts` array. Unknown fields are preserved. */
export interface PromptEntry {
  identifier: string;
  name: string;
  system_prompt?: boolean;
  marker?: boolean;
  enabled?: boolean;
  role?: Role | '';
  content?: string;
  /** 0 = RELATIVE (placed by order, depth ignored), 1 = ABSOLUTE/In-Chat (placed at depth) */
  injection_position?: 0 | 1;
  injection_depth?: number;
  injection_order?: number;
  forbid_overrides?: boolean;
  [k: string]: unknown;
}

export interface OrderEntry {
  identifier: string;
  enabled: boolean;
}

/** Internal working model: flat params + prompt library + single canonical order. */
export interface WorkingPreset {
  name: string;
  /** every top-level key except prompts / prompt_order */
  params: Record<string, unknown>;
  prompts: PromptEntry[];
  order: OrderEntry[];
  /** per-character (non-dummy) prompt_order entries, preserved verbatim */
  extraOrders: { character_id: number; order: OrderEntry[] }[];
  /** false = sampler-only source; export omits prompts/prompt_order unless edited */
  hadPrompts: boolean;
  /** import provenance surfaced by lint */
  importNotes: { wasWrapped: boolean; hadFlatOrder: boolean };
}

export interface LintFinding {
  level: 'error' | 'warn' | 'info';
  message: string;
  identifier?: string;
}

export type ProviderService = 'lmstudio' | 'openrouter' | 'openai' | 'anthropic' | 'custom';

export interface ProviderConfig {
  /** which prebuilt service this is; drives defaults + UI */
  service: ProviderService;
  /** wire protocol: OpenAI-compatible vs Anthropic */
  kind: 'openai' | 'anthropic';
  baseUrl: string;
  apiKey: string;
  model: string;
}

export const PROVIDER_SERVICES: Record<
  ProviderService,
  { label: string; kind: 'openai' | 'anthropic'; baseUrl: string; needsKey: boolean }
> = {
  lmstudio: { label: 'LM Studio (local)', kind: 'openai', baseUrl: 'http://localhost:1234/v1', needsKey: false },
  openrouter: { label: 'OpenRouter', kind: 'openai', baseUrl: 'https://openrouter.ai/api/v1', needsKey: true },
  openai: { label: 'OpenAI', kind: 'openai', baseUrl: 'https://api.openai.com/v1', needsKey: true },
  anthropic: { label: 'Anthropic', kind: 'anthropic', baseUrl: 'https://api.anthropic.com', needsKey: true },
  custom: { label: 'Custom (OpenAI-compatible)', kind: 'openai', baseUrl: '', needsKey: false },
};

export interface PlannedModule {
  name: string;
  brief: string;
  role: Role;
  placement: 'relative' | 'in_chat';
  depth: number;
  order: number;
  enabled: boolean;
  category: string;
}
