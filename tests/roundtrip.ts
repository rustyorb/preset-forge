// Semantic round-trip test: import a real preset, export it, assert nothing
// semantic changed. Exits 1 on any difference.
//
// Run:  npx esbuild tests/roundtrip.ts --bundle --format=esm --platform=node \
//         --outfile=/tmp/rt.mjs && node /tmp/rt.mjs [path-to-preset.json]
import { normalizePreset, exportPreset } from '../src/lib/preset';
import { lintPreset } from '../src/lib/lint';
import { assemblePreview } from '../src/lib/assemble';
import { readFileSync } from 'node:fs';

const path =
  process.argv[2] ??
  'U:/_silly/__st/SillyTavern/data/default-user/OpenAI Settings/Chimera_v2.json';

let failures = 0;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (!ok) failures++;
};

type AnyObj = Record<string, unknown>;
const raw = JSON.parse(readFileSync(path, 'utf-8')) as AnyObj;
const wp = normalizePreset(raw, 'test');
const out = exportPreset(wp) as AnyObj;

console.log(`--- ${path}`);
console.log(`imported prompts: ${wp.prompts.length} | order entries: ${wp.order.length}`);

// Params identical (everything except prompts/prompt_order)
const paramsOf = (o: AnyObj) =>
  Object.fromEntries(Object.entries(o).filter(([k]) => !['prompts', 'prompt_order'].includes(k)));
check(
  JSON.stringify(paramsOf(raw)) === JSON.stringify(paramsOf(out)),
  'params round-trip identically',
);

// Prompts identical by identifier (allowing the enabled-sync normalization:
// exported prompts[].enabled must match prompt_order, the authoritative source)
const rawPrompts = ((raw.prompts as AnyObj[]) ?? []);
const outPrompts = ((out.prompts as AnyObj[]) ?? []);
check(rawPrompts.length === outPrompts.length, 'prompt count preserved');
const rawOrderEntry = (o: AnyObj, id: number) =>
  ((o.prompt_order as AnyObj[]) ?? []).find((e) => e.character_id === id);
const ccOrder = (rawOrderEntry(raw, 100001) ?? rawOrderEntry(raw, 100000))?.order as
  | { identifier: string; enabled: boolean }[]
  | undefined;
const enabledByOrder = new Map((ccOrder ?? []).map((e) => [e.identifier, e.enabled]));
let promptDiffs = 0;
const outById = new Map(outPrompts.map((p) => [p.identifier, p]));
for (const p of rawPrompts) {
  const q = outById.get(p.identifier);
  if (!q) {
    promptDiffs++;
    continue;
  }
  const expected = { ...p };
  if (expected.enabled !== undefined && enabledByOrder.has(p.identifier as string) && !p.marker) {
    expected.enabled = enabledByOrder.get(p.identifier as string);
  }
  if (JSON.stringify(expected) !== JSON.stringify(q)) {
    promptDiffs++;
    console.log('  prompt diff:', p.identifier);
  }
}
check(promptDiffs === 0, 'prompt entries semantically identical');

// Chat Completion order preserved
const outCc = rawOrderEntry(out, 100001)?.order;
check(JSON.stringify(ccOrder) === JSON.stringify(outCc), 'CC (100001) order identical');

// Non-dummy per-character order entries preserved verbatim
const nonDummy = (o: AnyObj) =>
  ((o.prompt_order as AnyObj[]) ?? []).filter(
    (e) => e.character_id !== 100000 && e.character_id !== 100001,
  );
check(
  JSON.stringify(nonDummy(raw)) === JSON.stringify(nonDummy(out)),
  `non-dummy prompt_order entries preserved (${nonDummy(raw).length})`,
);

// Sampler-only presets stay sampler-only
const samplerOnly = normalizePreset({ temperature: 0.7, top_p: 0.9 }, 'sampler');
const samplerOut = exportPreset(samplerOnly);
check(
  !('prompts' in samplerOut) && !('prompt_order' in samplerOut),
  'sampler-only preset exports without fabricated prompts/prompt_order',
);

const findings = lintPreset(wp);
console.log(
  `lint: ${findings.filter((f) => f.level === 'error').length} errors, ` +
    `${findings.filter((f) => f.level === 'warn').length} warns, ` +
    `${findings.filter((f) => f.level === 'info').length} infos`,
);
const blocks = assemblePreview(wp);
console.log(
  `preview blocks: ${blocks.length} | injections: ${blocks.filter((b) => b.source === 'injection').length}`,
);

process.exit(failures ? 1 : 0);
