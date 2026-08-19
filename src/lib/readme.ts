import type { WorkingPreset } from './types';
import { DEFAULT_IDENTIFIERS } from './stDefaults';
import { parseGroupKey } from './groups';
import { readRegexScripts } from './regex';

/**
 * Generate the content for a "📖 README" module documenting the preset -
 * the mega-preset convention (NemoEngine, Chimera). Pure structural text,
 * no LLM involved; regenerate anytime the module set changes.
 */
export function generateReadmeContent(wp: WorkingPreset): string {
  const enabled = new Set(wp.order.filter((e) => e.enabled).map((e) => e.identifier));
  const custom = wp.prompts.filter(
    (p) => !p.marker && !DEFAULT_IDENTIFIERS.has(p.identifier) && p.identifier !== 'forge-readme',
  );
  const on = custom.filter((p) => enabled.has(p.identifier));
  const off = custom.filter((p) => !enabled.has(p.identifier));

  const groups = new Map<string, string[]>();
  for (const p of custom) {
    const key = parseGroupKey(p.name);
    if (key) groups.set(key, [...(groups.get(key) ?? []), p.name]);
  }

  const inChat = custom.filter((p) => p.injection_position === 1);
  const regexes = readRegexScripts(wp);

  const lines: string[] = [
    `${wp.name}`,
    `${'='.repeat(Math.min(wp.name.length, 40))}`,
    '',
    `${custom.length} modules: ${on.length} enabled by default, ${off.length} optional.`,
    '',
  ];
  if (on.length) {
    lines.push('ENABLED BY DEFAULT:');
    for (const p of on) lines.push(`- ${p.name}`);
    lines.push('');
  }
  if (off.length) {
    lines.push('OPTIONAL (toggle on as needed):');
    for (const p of off) lines.push(`- ${p.name}`);
    lines.push('');
  }
  if (groups.size) {
    lines.push('PICK ONE PER GROUP (mutually exclusive):');
    for (const [key, names] of groups) {
      lines.push(`- ${key}: ${names.map((n) => n.replace(/^🔗\s*/u, '')).join(' | ')}`);
    }
    lines.push('');
  }
  if (inChat.length) {
    lines.push('IN-CHAT INJECTIONS (ride the chat history at depth):');
    for (const p of inChat) {
      lines.push(`- ${p.name} @ depth ${p.injection_depth ?? 4}`);
    }
    lines.push('');
  }
  if (regexes.length) {
    lines.push(
      `REGEX SCRIPTS: ${regexes.length} bundled (${regexes.filter((r) => !r.disabled).length} active). ` +
        'SillyTavern will ask you to allow them for this preset.',
    );
    lines.push('');
  }
  lines.push('This module is documentation only - keep it disabled.');
  lines.push('Built with PresetForge.');
  return lines.join('\n');
}
