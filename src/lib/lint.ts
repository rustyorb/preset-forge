import type { LintFinding, WorkingPreset } from './types';
import { DEFAULT_IDENTIFIERS, DEPRECATED_KEYS, UNSAFE_EXPORT_KEYS } from './stDefaults';

const VALID_ROLES = new Set(['system', 'user', 'assistant']);
const DIVIDER_CHARS = ['━', '─', '═', '▬', '➤', '▼', '👇'];

/** Rule parity with the creating-sillytavern-presets skill's validate_preset.py. */
export function lintPreset(wp: WorkingPreset): LintFinding[] {
  const out: LintFinding[] = [];
  const byId = new Map(wp.prompts.map((p) => [p.identifier, p]));
  const enabledIds = new Set(wp.order.filter((e) => e.enabled).map((e) => e.identifier));
  const orderedIds = new Set(wp.order.map((e) => e.identifier));

  for (const [oldKey, newKey] of Object.entries(DEPRECATED_KEYS)) {
    if (oldKey in wp.params) {
      out.push({
        level: 'warn',
        message: `deprecated key "${oldKey}" (ST auto-migrates it, but use "${newKey}")`,
      });
    }
  }
  for (const key of UNSAFE_EXPORT_KEYS) {
    if (wp.params[key]) {
      out.push({
        level: 'warn',
        message: `"${key}" is set - proxy/endpoint keys trigger an import warning and can leak secrets`,
      });
    }
  }
  const nb = wp.params.names_behavior;
  if (nb !== undefined && ![-1, 0, 1, 2].includes(nb as number)) {
    out.push({ level: 'warn', message: `names_behavior=${nb} invalid (-1 none, 0 default, 1 completion, 2 content)` });
  }

  const seen = new Set<string>();
  for (const p of wp.prompts) {
    const id = p.identifier;
    if (!id) {
      out.push({ level: 'error', message: `prompt "${p.name ?? '?'}" has no identifier` });
      continue;
    }
    if (seen.has(id)) out.push({ level: 'error', identifier: id, message: `duplicate identifier "${id}"` });
    seen.add(id);

    const marker = !!p.marker;
    if (p.role !== undefined && !VALID_ROLES.has(p.role) && !(marker && p.role === '')) {
      out.push({ level: 'error', identifier: id, message: `invalid role "${p.role}"` });
    }

    const content = p.content ?? '';
    if (!marker && !content && !DEFAULT_IDENTIFIERS.has(id)) {
      const looksDivider = DIVIDER_CHARS.some((c) => (p.name ?? '').includes(c));
      if (enabledIds.has(id) && !looksDivider) {
        out.push({ level: 'warn', identifier: id, message: `"${p.name}" is enabled but has empty content` });
      } else {
        out.push({ level: 'info', identifier: id, message: `"${p.name}" has empty content (divider/header?)` });
      }
    }

    const pos = p.injection_position ?? 0;
    if (pos !== 0 && pos !== 1) {
      out.push({ level: 'error', identifier: id, message: `injection_position must be 0 or 1, got ${pos}` });
    }
    if (pos === 0 && p.injection_depth !== undefined && p.injection_depth !== 4 && !marker && !p.system_prompt) {
      out.push({
        level: 'info',
        identifier: id,
        message: `injection_depth=${p.injection_depth} has NO effect: position is Relative (depth applies only In-Chat)`,
      });
    }

    for (const m of content.matchAll(/\{\{getvar::([^}]*?)::\s*\}\}/g)) {
      out.push({
        level: 'error',
        identifier: id,
        message: `"{{getvar::${m[1]}::}}" has a trailing "::" - correct is {{getvar::${m[1]}}}`,
      });
    }

    if (!marker && !orderedIds.has(id) && !DEFAULT_IDENTIFIERS.has(id)) {
      out.push({ level: 'warn', identifier: id, message: `"${p.name}" is not in the order - unreachable in ST's UI` });
    }
  }

  for (const e of wp.order) {
    if (!byId.has(e.identifier) && !DEFAULT_IDENTIFIERS.has(e.identifier)) {
      out.push({ level: 'warn', identifier: e.identifier, message: `order references missing prompt "${e.identifier}" (ST skips it)` });
    }
  }

  return out;
}
