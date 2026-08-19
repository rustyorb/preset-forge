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

process.exit(failures ? 1 : 0);
