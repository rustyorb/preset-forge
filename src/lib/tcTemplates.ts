/**
 * Text Completion template family: instruct templates, context templates,
 * system prompts. Field lists verified against SillyTavern 1.18 release
 * shipped content (default/content/presets/{instruct,context,sysprompt}).
 */

export type TcKind = 'instruct' | 'context' | 'sysprompt';

export type TcTemplate = Record<string, unknown> & { name?: string };

export interface TcField {
  key: string;
  type: 'string' | 'text' | 'boolean' | 'number';
  label?: string;
}

/** Editable fields per kind, grouped for the form. */
export const TC_FIELDS: Record<TcKind, { group: string; fields: TcField[] }[]> = {
  instruct: [
    {
      group: 'Sequences',
      fields: [
        { key: 'input_sequence', type: 'text' },
        { key: 'output_sequence', type: 'text' },
        { key: 'system_sequence', type: 'text' },
        { key: 'first_input_sequence', type: 'text' },
        { key: 'first_output_sequence', type: 'text' },
        { key: 'last_input_sequence', type: 'text' },
        { key: 'last_output_sequence', type: 'text' },
        { key: 'last_system_sequence', type: 'text' },
        { key: 'stop_sequence', type: 'text' },
      ],
    },
    {
      group: 'Suffixes & wrappers',
      fields: [
        { key: 'input_suffix', type: 'text' },
        { key: 'output_suffix', type: 'text' },
        { key: 'system_suffix', type: 'text' },
        { key: 'story_string_prefix', type: 'text' },
        { key: 'story_string_suffix', type: 'text' },
        { key: 'user_alignment_message', type: 'text' },
      ],
    },
    {
      group: 'Behavior',
      fields: [
        { key: 'wrap', type: 'boolean' },
        { key: 'macro', type: 'boolean' },
        { key: 'system_same_as_user', type: 'boolean' },
        { key: 'sequences_as_stop_strings', type: 'boolean' },
        { key: 'skip_examples', type: 'boolean' },
        { key: 'names_behavior', type: 'string' },
        { key: 'activation_regex', type: 'string' },
      ],
    },
  ],
  context: [
    {
      group: 'Template',
      fields: [
        { key: 'story_string', type: 'text' },
        { key: 'chat_start', type: 'text' },
        { key: 'example_separator', type: 'text' },
      ],
    },
    {
      group: 'Story string placement',
      fields: [
        { key: 'story_string_position', type: 'number' },
        { key: 'story_string_depth', type: 'number' },
        { key: 'story_string_role', type: 'number' },
      ],
    },
    {
      group: 'Behavior',
      fields: [
        { key: 'use_stop_strings', type: 'boolean' },
        { key: 'names_as_stop_strings', type: 'boolean' },
        { key: 'always_force_name2', type: 'boolean' },
        { key: 'trim_sentences', type: 'boolean' },
        { key: 'single_line', type: 'boolean' },
      ],
    },
  ],
  sysprompt: [
    {
      group: 'System prompt',
      fields: [
        { key: 'content', type: 'text' },
        { key: 'post_history', type: 'text' },
      ],
    },
  ],
};

/** Identify which template family a JSON file belongs to. */
export function detectTcKind(raw: unknown): TcKind | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if ('input_sequence' in obj || 'output_sequence' in obj) return 'instruct';
  if ('story_string' in obj || 'chat_start' in obj) return 'context';
  if ('content' in obj && 'name' in obj && !('prompts' in obj)) return 'sysprompt';
  return null;
}

export const TC_KIND_LABEL: Record<TcKind, string> = {
  instruct: 'Instruct template',
  context: 'Context template',
  sysprompt: 'System prompt',
};
