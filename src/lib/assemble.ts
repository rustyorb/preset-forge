import type { CardData } from './cards';
import type { PromptEntry, Role, WorkingPreset } from './types';
import { MARKER_NAMES } from './stDefaults';

export interface AssembledBlock {
  role: Role;
  content: string;
  /** where this block came from */
  source: 'prompt' | 'marker' | 'chat' | 'injection' | 'note';
  label: string;
  identifier?: string;
  depth?: number;
}

export interface SceneData {
  char: string;
  user: string;
  description: string;
  personality: string;
  scenario: string;
  persona: string;
  chat: { role: Role; text: string }[];
}

export const DEFAULT_SCENE: SceneData = {
  char: 'Seraphina',
  user: 'You',
  description: 'Seraphina is a guardian spirit of the Whispering Woods, gentle but fiercely protective.',
  personality: 'Warm, watchful, playful when at ease; steel underneath.',
  scenario: 'A wounded traveler has stumbled into the grove at dusk.',
  persona: 'A wandering cartographer mapping the old forest roads.',
  chat: [
    { role: 'user', text: '*I limp into the clearing, clutching my arm.* Hello? Is anyone there?' },
    { role: 'assistant', text: '*Light gathers between the trees as Seraphina steps forward.* "Easy, traveler. You are safe here."' },
    { role: 'user', text: 'Thank you... I think I\'m lost. And this cut won\'t stop bleeding.' },
    { role: 'assistant', text: '*She kneels beside you, palms glowing softly.* "Let me see. The woods told me you were coming."' },
    { role: 'user', text: 'The woods... talk to you?' },
  ],
};

/** Build a preview scene from a real imported character card. */
export function sceneFromCard(card: CardData): SceneData {
  const chat: SceneData['chat'] = [];
  if (card.first_mes) chat.push({ role: 'assistant', text: card.first_mes });
  chat.push(
    { role: 'user', text: '*I take in the scene, then respond.* Tell me more.' },
    { role: 'assistant', text: `*${card.name} considers the question before answering.*` },
    { role: 'user', text: 'And what happens next?' },
  );
  return {
    char: card.name,
    user: 'You',
    description: card.description,
    personality: card.personality,
    scenario: card.scenario,
    persona: 'A curious visitor.',
    chat,
  };
}

function macroFiller(scene: SceneData): (text: string) => string {
  const values: Record<string, string> = {
    char: scene.char,
    user: scene.user,
    charIfNotGroup: scene.char,
    description: scene.description,
    personality: scene.personality,
    scenario: scene.scenario,
    persona: scene.persona,
  };
  return (text) =>
    text.replace(
      /\{\{(char|user|charIfNotGroup|description|personality|scenario|persona)\}\}/g,
      (_, k: string) => values[k],
    );
}

function markerContent(id: string, scene: SceneData): string | null {
  switch (id) {
    case 'charDescription': return scene.description || null;
    case 'charPersonality':
      return scene.personality ? `[${scene.char}'s personality: ${scene.personality}]` : null;
    case 'scenario':
      return scene.scenario ? `[Circumstances and context of the dialogue: ${scene.scenario}]` : null;
    case 'personaDescription': return `[${scene.user}'s persona: ${scene.persona}]`;
    case 'worldInfoBefore':
    case 'worldInfoAfter':
    case 'dialogueExamples':
      return null; // empty in the sample scene
    default: return null;
  }
}

/**
 * Structural simulation of ST's prompt assembly:
 * relative prompts in order (markers expanded with scene data), chat history
 * with In-Chat prompts spliced at injection_depth from the end (depth 0 = last).
 * Same-depth ordering matches openai.js populationInjectionPrompts, not the
 * (simplified) docs. Labeled a preview, not a byte-accurate clone.
 */
export function assemblePreview(wp: WorkingPreset, scene: SceneData = DEFAULT_SCENE): AssembledBlock[] {
  const byId = new Map(wp.prompts.map((p) => [p.identifier, p]));
  const enabledOrder = wp.order.filter((e) => e.enabled);
  const enabledIds = new Set(enabledOrder.map((e) => e.identifier));
  const blocks: AssembledBlock[] = [];
  const fillMacros = macroFiller(scene);

  const absolutePrompts = wp.prompts.filter(
    (p) => p.injection_position === 1 && !p.marker && p.content && enabledIds.has(p.identifier),
  );

  const pushChatWithInjections = () => {
    const chatLen = scene.chat.length;
    // depth d inserts before the last d messages; collect per gap index 0..chatLen
    const byGap = new Map<number, PromptEntry[]>();
    for (const p of absolutePrompts) {
      const depth = Math.min(Math.max(p.injection_depth ?? 4, 0), chatLen);
      const gap = chatLen - depth; // messages before the injection point
      byGap.set(gap, [...(byGap.get(gap) ?? []), p]);
    }
    // Chronological order at one depth, per ST's populationInjectionPrompts
    // (order groups processed descending then the whole array is reversed):
    // ascending injection_order groups; within a group assistant -> user -> system.
    const roleRank: Record<string, number> = { assistant: 0, user: 1, system: 2 };
    const emitGap = (gap: number) => {
      const ps = byGap.get(gap);
      if (!ps) return;
      ps.sort(
        (a, b) =>
          (a.injection_order ?? 100) - (b.injection_order ?? 100) ||
          roleRank[a.role || 'system'] - roleRank[b.role || 'system'],
      );
      for (const p of ps) {
        blocks.push({
          role: (p.role || 'system') as Role,
          content: fillMacros(p.content ?? ''),
          source: 'injection',
          label: `${p.name} · @depth ${p.injection_depth ?? 4}`,
          identifier: p.identifier,
          depth: p.injection_depth ?? 4,
        });
      }
    };
    for (let i = 0; i < chatLen; i++) {
      emitGap(i);
      const msg = scene.chat[i];
      blocks.push({
        role: msg.role,
        content: fillMacros(msg.text),
        source: 'chat',
        label: `chat message ${i + 1}`,
      });
    }
    emitGap(chatLen); // depth 0: after the last message
  };

  let chatRendered = false;
  for (const e of enabledOrder) {
    const p = byId.get(e.identifier);
    if (e.identifier === 'chatHistory') {
      pushChatWithInjections();
      chatRendered = true;
      continue;
    }
    if (!p) continue;
    if (p.marker) {
      const mc = markerContent(p.identifier, scene);
      if (mc !== null) {
        blocks.push({
          role: 'system',
          content: mc,
          source: 'marker',
          label: MARKER_NAMES[p.identifier] ?? p.identifier,
          identifier: p.identifier,
        });
      }
      continue;
    }
    if (p.injection_position === 1) continue; // rendered inside chat
    if (!p.content) continue;
    blocks.push({
      role: (p.role || 'system') as Role,
      content: fillMacros(p.content),
      source: 'prompt',
      label: p.name,
      identifier: p.identifier,
    });
  }

  if (!chatRendered) {
    blocks.push({
      role: 'system',
      content:
        `Chat History is disabled or missing from the order - the chat AND all In-Chat injections` +
        `${absolutePrompts.length ? ` (${absolutePrompts.length} enabled)` : ''} will NOT be sent.`,
      source: 'note',
      label: '⚠ no chat history',
    });
  }

  return blocks;
}
