import { normalizePreset, exportPreset } from '../src/lib/preset';
import { lintPreset } from '../src/lib/lint';
import { assemblePreview } from '../src/lib/assemble';
import { readFileSync, writeFileSync } from 'node:fs';

const raw = JSON.parse(readFileSync('U:/_silly/__st/SillyTavern/data/default-user/OpenAI Settings/Chimera_v2.json', 'utf-8')) as Record<string, unknown>;
const wp = normalizePreset(raw, 'Chimera_v2');
console.log('imported prompts:', wp.prompts.length, '| order entries:', wp.order.length);

const out = exportPreset(wp) as Record<string, unknown>;
writeFileSync('roundtrip_chimera.json', JSON.stringify(out, null, 2));

type AnyObj = Record<string, unknown>;
const semantics = (o: AnyObj) => ({
  params: Object.fromEntries(Object.entries(o).filter(([k]) => !['prompts', 'prompt_order'].includes(k))),
  prompts: Object.fromEntries(((o.prompts as AnyObj[]) ?? []).map((p) => [p.identifier as string, p])),
  order: (((o.prompt_order as AnyObj[]).find((e) => e.character_id === 100001) ?? (o.prompt_order as AnyObj[])[0]) as AnyObj).order,
});
const a = semantics(raw), b = semantics(out);
console.log('order identical:', JSON.stringify(a.order) === JSON.stringify(b.order));
let diffs = 0;
for (const [id, p] of Object.entries(a.prompts)) {
  if (JSON.stringify(p) !== JSON.stringify((b.prompts as AnyObj)[id])) { diffs++; console.log('prompt diff:', id); }
}
console.log('prompt entry diffs:', diffs, '| counts:', Object.keys(a.prompts).length, '->', Object.keys(b.prompts).length);
let pdiffs = 0;
for (const [k, v] of Object.entries(a.params)) {
  if (JSON.stringify(v) !== JSON.stringify((b.params as AnyObj)[k])) { pdiffs++; console.log('param diff:', k); }
}
console.log('param diffs:', pdiffs);

const findings = lintPreset(wp);
console.log('lint(ts):', findings.filter((f) => f.level === 'error').length, 'errors,', findings.filter((f) => f.level === 'warn').length, 'warns,', findings.filter((f) => f.level === 'info').length, 'infos');

const blocks = assemblePreview(wp);
console.log('preview blocks:', blocks.length, '| injections:', blocks.filter((x) => x.source === 'injection').length);
