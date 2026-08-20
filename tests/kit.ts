// Kit builder test against real NemoEngine 11.5.1.
import { readFileSync } from 'node:fs';
import { normalizePreset } from '../src/lib/preset';
import { buildKitFiles, generateModuleGuide } from '../src/lib/kit';

let failures = 0;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (!ok) failures++;
};

const raw = JSON.parse(
  readFileSync(
    'C:/Users/Robotics/AppData/Local/Temp/claude/C--Users-Robotics/2cc9e211-b7c4-4694-8c67-93a0a8c0c26d/scratchpad/nemoengine.json',
    'utf-8',
  ),
);
const wp = normalizePreset(raw, 'NemoEngine 11.5.1');
const files = buildKitFiles(wp);

check(files.length === 3 + 91, `kit has preset+README+GUIDE+91 regex files (got ${files.length})`);
check(files[0].path[0].endsWith('.json') && files[0].content.includes('"prompt_order"'), 'preset json present');
const readme = files.find((f) => f.path[0] === 'README.md')!.content;
check(readme.includes('allow this preset') && readme.includes('91 bundled regex'), 'README mentions regex allow-gate + count');
check(readme.includes('| temperature |'), 'README sampler table populated');
const guide = generateModuleGuide(wp);
check((guide.match(/^## /gm) ?? []).length >= 15, `GUIDE has section headings (${(guide.match(/^## /gm) ?? []).length})`);
check((guide.match(/^### /gm) ?? []).length > 400, `GUIDE documents 400+ modules (${(guide.match(/^### /gm) ?? []).length})`);
check(files.filter((f) => f.path[0] === 'regex').every((f) => JSON.parse(f.content).findRegex !== undefined), 'standalone regex files parse');

process.exit(failures ? 1 : 0);
