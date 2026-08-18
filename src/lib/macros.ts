import type { WorkingPreset } from './types';

export interface VariableUsage {
  name: string;
  /** identifiers of prompts that {{setvar}} this variable */
  definedIn: string[];
  /** identifiers of prompts that {{getvar}} it */
  usedIn: string[];
}

/** Build the setvar/getvar relationship map across all prompts. */
export function analyzeVariables(wp: WorkingPreset): VariableUsage[] {
  const vars = new Map<string, VariableUsage>();
  const get = (name: string) => {
    let v = vars.get(name);
    if (!v) {
      v = { name, definedIn: [], usedIn: [] };
      vars.set(name, v);
    }
    return v;
  };
  for (const p of wp.prompts) {
    const content = p.content ?? '';
    for (const m of content.matchAll(/\{\{setvar::([^:}]+)::/g)) {
      get(m[1].trim()).definedIn.push(p.identifier);
    }
    for (const m of content.matchAll(/\{\{getvar::([^}]+)\}\}/g)) {
      get(m[1].trim()).usedIn.push(p.identifier);
    }
  }
  return [...vars.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Split content into text/macro segments for highlighting. */
export function segmentMacros(content: string): { text: string; macro: boolean }[] {
  const out: { text: string; macro: boolean }[] = [];
  let last = 0;
  for (const m of content.matchAll(/\{\{[^{}]*\}\}/g)) {
    if (m.index! > last) out.push({ text: content.slice(last, m.index), macro: false });
    out.push({ text: m[0], macro: true });
    last = m.index! + m[0].length;
  }
  if (last < content.length) out.push({ text: content.slice(last), macro: false });
  return out;
}
