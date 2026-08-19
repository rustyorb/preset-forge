import type { WorkingPreset } from './types';

/**
 * SillyTavern regex scripts (verified against 1.18 extensions/regex/engine.js).
 * Presets carry them at extensions.regex_scripts; ST gates execution behind a
 * per-preset user allow-list, so shipping them in the preset is standard.
 */
export interface RegexScript {
  id: string;
  scriptName: string;
  findRegex: string;
  replaceString: string;
  trimStrings: string[];
  placement: number[];
  disabled: boolean;
  markdownOnly: boolean;
  promptOnly: boolean;
  runOnEdit: boolean;
  /** 0 = don't substitute macros in findRegex, 1 = raw, 2 = escaped */
  substituteRegex: number;
  minDepth: number | null;
  maxDepth: number | null;
}

export const PLACEMENTS: { value: number; label: string }[] = [
  { value: 1, label: 'User input' },
  { value: 2, label: 'AI output' },
  { value: 3, label: 'Slash commands' },
  { value: 5, label: 'World info' },
  { value: 6, label: 'Reasoning' },
];

export function newRegexScript(): RegexScript {
  return {
    id: crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2),
    scriptName: 'New regex',
    findRegex: '',
    replaceString: '',
    trimStrings: [],
    placement: [2],
    disabled: false,
    markdownOnly: true,
    promptOnly: false,
    runOnEdit: false,
    substituteRegex: 0,
    minDepth: null,
    maxDepth: null,
  };
}

export function readRegexScripts(wp: WorkingPreset): RegexScript[] {
  const ext = wp.params.extensions;
  if (typeof ext !== 'object' || ext === null) return [];
  const scripts = (ext as Record<string, unknown>).regex_scripts;
  return Array.isArray(scripts) ? (scripts as RegexScript[]) : [];
}

export function writeRegexScripts(
  params: Record<string, unknown>,
  scripts: RegexScript[],
): Record<string, unknown> {
  const ext =
    typeof params.extensions === 'object' && params.extensions !== null
      ? { ...(params.extensions as Record<string, unknown>) }
      : {};
  if (scripts.length) ext.regex_scripts = scripts;
  else delete ext.regex_scripts;
  const next = { ...params };
  if (Object.keys(ext).length) next.extensions = ext;
  else delete next.extensions;
  return next;
}

/** Parse ST's findRegex format: "/pattern/flags" or a bare pattern. */
export function parseFindRegex(findRegex: string): RegExp {
  const m = findRegex.match(/^\/(.+)\/([a-z]*)$/s);
  if (m) return new RegExp(m[1], m[2]);
  return new RegExp(findRegex);
}

/**
 * Run one script against text the way ST's runRegexScript does for previews:
 * {{match}} in the replacement is the whole match; $1... capture groups work;
 * trimStrings are removed from each match before substitution.
 */
export function runRegexScript(script: RegexScript, text: string): string {
  if (!script.findRegex) return text;
  const re = parseFindRegex(script.findRegex);
  const global = re.flags.includes('g') ? re : new RegExp(re.source, re.flags + 'g');
  return text.replace(global, (...args) => {
    let match = args[0] as string;
    for (const trim of script.trimStrings) {
      match = match.replaceAll(trim, '');
    }
    // Rebuild the replacement per-match: {{match}} -> trimmed match, $N -> groups.
    let out = script.replaceString.replaceAll('{{match}}', match);
    const groups = args.slice(1, -2) as (string | undefined)[];
    out = out.replace(/\$(\d)/g, (_, n) => groups[Number(n) - 1] ?? '');
    return out;
  });
}

/** Validate a script; returns an error message or null. */
export function validateRegexScript(script: RegexScript): string | null {
  if (!script.scriptName.trim()) return 'script needs a name';
  if (!script.findRegex.trim()) return 'find pattern is empty';
  try {
    parseFindRegex(script.findRegex);
  } catch (e) {
    return `invalid pattern: ${e instanceof Error ? e.message : e}`;
  }
  if (!script.placement.length) return 'no placement selected (script will never run)';
  return null;
}
