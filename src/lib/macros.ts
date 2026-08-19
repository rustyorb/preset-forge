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
  const addOnce = (list: string[], id: string) => {
    if (!list.includes(id)) list.push(id);
  };
  for (const p of wp.prompts) {
    const content = p.content ?? '';
    for (const m of content.matchAll(/\{\{setvar::([^:}]+)::/g)) {
      addOnce(get(m[1].trim()).definedIn, p.identifier);
    }
    for (const m of content.matchAll(/\{\{getvar::([^}]+)\}\}/g)) {
      addOnce(get(m[1].trim()).usedIn, p.identifier);
    }
  }
  return [...vars.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** A variable name is usable if it can live inside {{setvar::name::v}} / {{getvar::name}}. */
export function isValidVarName(name: string): boolean {
  return name.length > 0 && !/[:{}]/.test(name);
}

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escSub = (s: string) => s.replace(/\$/g, '$$$$');

/** Content rewriter renaming a variable in both setvar and getvar macros. */
export function makeVarRenamer(oldName: string, newName: string): (content: string) => string {
  const setRe = new RegExp(`(\\{\\{setvar::\\s*)${escRe(oldName)}(\\s*::)`, 'g');
  const getRe = new RegExp(`(\\{\\{getvar::\\s*)${escRe(oldName)}(\\s*\\}\\})`, 'g');
  const sub = `$1${escSub(newName)}$2`;
  return (c) => c.replace(setRe, sub).replace(getRe, sub);
}

/** Content rewriter redirecting only getvar reads (dangling-variable fix). */
export function makeGetvarRedirect(oldName: string, newName: string): (content: string) => string {
  const getRe = new RegExp(`(\\{\\{getvar::\\s*)${escRe(oldName)}(\\s*\\}\\})`, 'g');
  return (c) => c.replace(getRe, `$1${escSub(newName)}$2`);
}

