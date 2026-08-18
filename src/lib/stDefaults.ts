import type { OrderEntry, PromptEntry } from './types';

/**
 * Canonical SillyTavern 1.18.0 identifiers, verified against
 * PromptManager.js chatCompletionDefaultPrompts (release branch).
 */

export const MARKER_IDENTIFIERS = [
  'worldInfoBefore',
  'personaDescription',
  'charDescription',
  'charPersonality',
  'scenario',
  'worldInfoAfter',
  'dialogueExamples',
  'chatHistory',
] as const;

export const MARKER_NAMES: Record<string, string> = {
  worldInfoBefore: 'World Info (before)',
  personaDescription: 'Persona Description',
  charDescription: 'Char Description',
  charPersonality: 'Char Personality',
  scenario: 'Scenario',
  worldInfoAfter: 'World Info (after)',
  dialogueExamples: 'Chat Examples',
  chatHistory: 'Chat History',
};

export const CORE_SLOT_NAMES: Record<string, string> = {
  main: 'Main Prompt',
  nsfw: 'Auxiliary Prompt',
  jailbreak: 'Post-History Instructions',
  enhanceDefinitions: 'Enhance Definitions',
};

export const DEFAULT_IDENTIFIERS = new Set([
  ...Object.keys(CORE_SLOT_NAMES),
  ...MARKER_IDENTIFIERS,
]);

/** Chat Completion prompt_order dummy character ids. CC reads 100001. */
export const DUMMY_IDS = [100000, 100001];

export const DEFAULT_ORDER: OrderEntry[] = [
  { identifier: 'main', enabled: true },
  { identifier: 'worldInfoBefore', enabled: true },
  { identifier: 'personaDescription', enabled: true },
  { identifier: 'charDescription', enabled: true },
  { identifier: 'charPersonality', enabled: true },
  { identifier: 'scenario', enabled: true },
  { identifier: 'enhanceDefinitions', enabled: false },
  { identifier: 'nsfw', enabled: true },
  { identifier: 'worldInfoAfter', enabled: true },
  { identifier: 'dialogueExamples', enabled: true },
  { identifier: 'chatHistory', enabled: true },
  { identifier: 'jailbreak', enabled: true },
];

export function defaultPrompts(): PromptEntry[] {
  const prompts: PromptEntry[] = [
    {
      identifier: 'main',
      name: 'Main Prompt',
      system_prompt: true,
      role: 'system',
      content:
        "Write {{char}}'s next reply in a fictional chat between {{charIfNotGroup}} and {{user}}.",
      marker: false,
    },
    {
      identifier: 'nsfw',
      name: 'Auxiliary Prompt',
      system_prompt: true,
      role: 'system',
      content: '',
      marker: false,
    },
    {
      identifier: 'jailbreak',
      name: 'Post-History Instructions',
      system_prompt: true,
      role: 'system',
      content: '',
      marker: false,
    },
    {
      identifier: 'enhanceDefinitions',
      name: 'Enhance Definitions',
      system_prompt: true,
      role: 'system',
      content:
        "If you have more knowledge of {{char}}, add to the character's lore and personality to enhance them but keep the Character Sheet's definitions absolute.",
      marker: false,
    },
  ];
  for (const id of MARKER_IDENTIFIERS) {
    prompts.push({
      identifier: id,
      name: MARKER_NAMES[id],
      system_prompt: true,
      marker: true,
    });
  }
  return prompts;
}

export const DEPRECATED_KEYS: Record<string, string> = {
  claude_use_sysprompt: 'use_sysprompt',
  use_makersuite_sysprompt: 'use_sysprompt',
  names_in_completion: 'names_behavior',
};

/** Keys a built preset should never carry (model/connection/proxy). */
export const UNSAFE_EXPORT_KEYS = [
  'reverse_proxy',
  'proxy_password',
  'custom_url',
  'custom_include_headers',
  'custom_include_body',
  'custom_exclude_body',
];
