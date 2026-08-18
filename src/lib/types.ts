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
}

export interface LintFinding {
  level: 'error' | 'warn' | 'info';
  message: string;
  identifier?: string;
}

export interface ProviderConfig {
  kind: 'openai' | 'anthropic';
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface PlannedModule {
  name: string;
  brief: string;
  role: Role;
  placement: 'relative' | 'in_chat';
  depth: number;
  order: number;
  enabled: boolean;
  category: string;
  content?: string;
}
