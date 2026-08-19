// P2 feature tests: variable rename/redirect, card parsing, scene building.
// Run:  npx esbuild tests/features.ts --bundle --format=esm --platform=node \
//         --outfile=/tmp/ft.mjs && node /tmp/ft.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { normalizePreset } from '../src/lib/preset';
import {
  analyzeVariables,
  isValidVarName,
  makeGetvarRedirect,
  makeVarRenamer,
} from '../src/lib/macros';
import { parseCardFile } from '../src/lib/cards';
import { sceneFromCard } from '../src/lib/assemble';

const ST_DATA = 'U:/_silly/__st/SillyTavern/data/default-user';

let failures = 0;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (!ok) failures++;
};

// --- variable rename on a real preset ---
{
  const raw = JSON.parse(
    readFileSync(join(ST_DATA, 'OpenAI Settings/Chimera_v2.json'), 'utf-8'),
  );
  const wp = normalizePreset(raw, 'chimera');
  const before = analyzeVariables(wp);
  const target = before.find((v) => v.definedIn.length && v.usedIn.length);
  check(!!target, `found a var with defs+uses to rename (${target?.name ?? 'none'})`);
  if (target) {
    const newName = 'renamed_test_var_xyz';
    const rename = makeVarRenamer(target.name, newName);
    wp.prompts = wp.prompts.map((p) =>
      typeof p.content === 'string' ? { ...p, content: rename(p.content) } : p,
    );
    const after = analyzeVariables(wp);
    const renamed = after.find((v) => v.name === newName);
    check(!after.some((v) => v.name === target.name), `old name "${target.name}" fully gone`);
    check(
      !!renamed &&
        renamed.definedIn.length === target.definedIn.length &&
        renamed.usedIn.length === target.usedIn.length,
      `new name carries identical usage counts (${renamed?.definedIn.length}/${renamed?.usedIn.length})`,
    );
    check(after.length === before.length, 'total variable count unchanged');
  }
}

// --- redirect + name validation ---
{
  const redirect = makeGetvarRedirect('ghost', 'real');
  check(
    redirect('a {{getvar::ghost}} b {{setvar::ghost::1}}') === 'a {{getvar::real}} b {{setvar::ghost::1}}',
    'redirect rewrites getvar only, leaves setvar alone',
  );
  const rename = makeVarRenamer('a.b', 'c$d');
  check(
    rename('{{setvar::a.b::v}} {{getvar::a.b}} {{getvar::aXb}}') ===
      '{{setvar::c$d::v}} {{getvar::c$d}} {{getvar::aXb}}',
    'rename escapes regex metachars in old name and $ in new name',
  );
  check(isValidVarName('pov_style 2') && !isValidVarName('a::b') && !isValidVarName('a}b') && !isValidVarName(''), 'var name validation');
}

// --- card parsing from a real ST card PNG ---
{
  const dir = join(ST_DATA, 'characters');
  const pngs = readdirSync(dir).filter((f) => f.endsWith('.png'));
  check(pngs.length > 0, `found ${pngs.length} card PNGs`);
  let parsed = 0;
  let firstMes = 0;
  for (const f of pngs.slice(0, 5)) {
    try {
      const buf = readFileSync(join(dir, f));
      const card = await parseCardFile(new File([new Uint8Array(buf)], f));
      if (card.name.length > 0) parsed++;
      const scene = sceneFromCard(card);
      if (card.first_mes) {
        firstMes++;
        if (!(scene.chat[0].role === 'assistant' && scene.chat[0].text === card.first_mes)) {
          check(false, `scene chat[0] should be first_mes for ${f}`);
        }
      }
      if (scene.char !== card.name) check(false, `scene char mismatch for ${f}`);
    } catch (e) {
      console.log(`  note: ${f} did not parse (${String(e).slice(0, 80)})`);
    }
  }
  check(parsed >= 3, `parsed ${parsed}/5 sampled card PNGs (names extracted)`);
  console.log(`  (${firstMes} of sampled cards had a first_mes; scene ordering verified for each)`);
}

// --- regex scripts ---
{
  const { runRegexScript, validateRegexScript, newRegexScript, writeRegexScripts, readRegexScripts } =
    await import('../src/lib/regex');
  const s = { ...newRegexScript(), findRegex: '/—/g', replaceString: ',' };
  check(runRegexScript(s, 'a — b — c') === 'a , b , c', 'regex: em-dash removal runs');
  const s2 = { ...newRegexScript(), findRegex: '/"([^"]+)"/g', replaceString: '“$1”' };
  check(runRegexScript(s2, 'She said "hi" and "bye".') === 'She said “hi” and “bye”.', 'regex: capture groups work');
  const s3 = { ...newRegexScript(), findRegex: '/\\bvery\\b/g', replaceString: '[{{match}}]' };
  check(runRegexScript(s3, 'very good, very bad') === '[very] good, [very] bad', 'regex: {{match}} substitution');
  check(validateRegexScript({ ...newRegexScript(), findRegex: '/[unclosed/g' }) !== null, 'regex: invalid pattern caught');
  const params = writeRegexScripts({ temperature: 1 }, [s]);
  const back = readRegexScripts({ name: '', params, prompts: [], order: [], extraOrders: [], hadPrompts: true, importNotes: { wasWrapped: false, hadFlatOrder: false } });
  check(back.length === 1 && back[0].findRegex === '/—/g', 'regex: round-trips through extensions.regex_scripts');
}

// --- exclusion groups ---
{
  const { parseGroupKey, conflictingGroups } = await import('../src/lib/groups');
  check(parseGroupKey('🔗 POV: First Person') === 'pov', 'groups: parses 🔗 Group: Variant');
  check(parseGroupKey('🌹 Romance') === null && parseGroupKey('🔗 Simple HTML') === null, 'groups: non-grouped names ignored');
  const wp = {
    name: 't', params: {}, extraOrders: [], hadPrompts: true,
    importNotes: { wasWrapped: false, hadFlatOrder: false },
    prompts: [
      { identifier: 'a', name: '🔗 POV: First' },
      { identifier: 'b', name: '🔗 POV: Third' },
      { identifier: 'c', name: '🔗 Stance: Soft' },
    ],
    order: [
      { identifier: 'a', enabled: true },
      { identifier: 'b', enabled: true },
      { identifier: 'c', enabled: true },
    ],
  };
  const conf = conflictingGroups(wp);
  check(conf.length === 1 && conf[0].key === 'pov', 'groups: conflict detected only for pov');
}

// --- readme generator ---
{
  const { generateReadmeContent } = await import('../src/lib/readme');
  const wp = {
    name: 'TestPreset', params: {}, extraOrders: [], hadPrompts: true,
    importNotes: { wasWrapped: false, hadFlatOrder: false },
    prompts: [
      { identifier: 'm1', name: '📜 Core', content: 'x' },
      { identifier: 'm2', name: '🔗 POV: First', content: 'x' },
      { identifier: 'm3', name: '🔗 POV: Third', content: 'x', injection_position: 1 as const, injection_depth: 2 },
    ],
    order: [
      { identifier: 'm1', enabled: true },
      { identifier: 'm2', enabled: false },
      { identifier: 'm3', enabled: false },
    ],
  };
  const md = generateReadmeContent(wp);
  check(md.includes('ENABLED BY DEFAULT') && md.includes('📜 Core'), 'readme: lists enabled modules');
  check(md.includes('PICK ONE PER GROUP') && md.includes('pov'), 'readme: documents exclusion groups');
  check(md.includes('@ depth 2'), 'readme: documents in-chat injections');
}

process.exit(failures ? 1 : 0);
