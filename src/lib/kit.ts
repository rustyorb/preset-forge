import type { WorkingPreset } from './types';
import { DEFAULT_IDENTIFIERS } from './stDefaults';
import { conflictingGroups, isSectionHeader, parseGroupKey } from './groups';
import { readRegexScripts } from './regex';
import { exportPreset } from './preset';
import { estimateTokens } from './tokens';

/**
 * Distribution kit: preset JSON + README.md + MODULE_GUIDE.md + standalone
 * regex script files - the Marinara/NemoEngine release convention.
 */

const safe = (name: string) => name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'preset';

export function generateKitReadme(wp: WorkingPreset): string {
  const enabled = new Set(wp.order.filter((e) => e.enabled).map((e) => e.identifier));
  const custom = wp.prompts.filter((p) => !p.marker && !DEFAULT_IDENTIFIERS.has(p.identifier));
  const modules = custom.filter((p) => !isSectionHeader(p));
  const on = modules.filter((p) => enabled.has(p.identifier));
  const regexes = readRegexScripts(wp);
  const groups = new Map<string, string[]>();
  for (const p of modules) {
    const key = parseGroupKey(p.name);
    if (key) groups.set(key, [...(groups.get(key) ?? []), p.name]);
  }
  const params = wp.params as Record<string, unknown>;

  return `# ${wp.name}

${modules.length} modules · ${on.length} enabled by default · ${regexes.length} bundled regex script(s)

## Install

1. SillyTavern → **Chat Completion settings** → presets → **Import**, pick \`${safe(wp.name)}.json\`.
2. Start with the shipped defaults; toggle optional modules in the **Prompt Manager**.
${regexes.length ? '3. ST will ask to **allow this preset\'s regex scripts** — accept to enable the bundled output formatting.\n' : ''}
## Defaults

${on.length ? on.map((p) => `- ${p.name}`).join('\n') : '- (settings-only preset)'}

${
  groups.size
    ? `## Pick one per group\n\n${[...groups.entries()]
        .map(([k, names]) => `- **${k}**: ${names.map((n) => n.replace(/^🔗\s*/u, '')).join(' · ')}`)
        .join('\n')}\n`
    : ''
}## Sampler settings

| setting | value |
|---|---|
${['temperature', 'top_p', 'top_k', 'min_p', 'repetition_penalty', 'openai_max_context', 'openai_max_tokens']
  .filter((k) => params[k] !== undefined)
  .map((k) => `| ${k} | ${params[k]} |`)
  .join('\n')}

See \`MODULE_GUIDE.md\` for every module. Built with PresetForge.
`;
}

export function generateModuleGuide(wp: WorkingPreset): string {
  const enabled = new Set(wp.order.filter((e) => e.enabled).map((e) => e.identifier));
  const byId = new Map(wp.prompts.map((p) => [p.identifier, p]));
  const lines: string[] = [`# ${wp.name} — Module Guide`, ''];
  const conflicts = conflictingGroups(wp);
  if (conflicts.length) {
    lines.push(`> ⚠ shipping with conflicting 🔗 groups enabled: ${conflicts.map((c) => c.key).join(', ')}`, '');
  }
  for (const e of wp.order) {
    const p = byId.get(e.identifier);
    if (!p || p.marker || DEFAULT_IDENTIFIERS.has(p.identifier)) continue;
    if (isSectionHeader(p)) {
      lines.push(`## ${p.name.replace(/^[=\s]+|[=\s]+$/g, '')}`, '');
      continue;
    }
    const placement =
      p.injection_position === 1 ? `in-chat @ depth ${p.injection_depth ?? 4}` : 'relative';
    lines.push(
      `### ${p.name}`,
      '',
      `\`${p.identifier}\` · ${enabled.has(p.identifier) ? '**on** by default' : 'off by default'} · ${placement} · ~${estimateTokens(p.content ?? '')} tokens`,
      '',
    );
    const preview = (p.content ?? '').trim().slice(0, 200).replace(/\n/g, ' ');
    if (preview) lines.push(`> ${preview}${(p.content ?? '').length > 200 ? '…' : ''}`, '');
  }
  return lines.join('\n');
}

interface KitFile {
  path: string[];
  content: string;
}

export function buildKitFiles(wp: WorkingPreset, qrSets: { name: string }[] = []): KitFile[] {
  const name = safe(wp.name);
  const files: KitFile[] = [
    { path: [`${name}.json`], content: JSON.stringify(exportPreset(wp), null, 4) },
    { path: ['README.md'], content: generateKitReadme(wp) },
    { path: ['MODULE_GUIDE.md'], content: generateModuleGuide(wp) },
  ];
  for (const script of readRegexScripts(wp)) {
    files.push({
      path: ['regex', `${safe(script.scriptName)}.json`],
      content: JSON.stringify(script, null, 4),
    });
  }
  for (const set of qrSets) {
    files.push({
      path: ['quick-replies', `${safe(set.name)}.json`],
      content: JSON.stringify(set, null, 4),
    });
  }
  return files;
}

/** Write the kit into a user-picked folder (FS Access API, Chromium). */
export async function exportKitToFolder(
  wp: WorkingPreset,
  qrSets: { name: string }[] = [],
): Promise<number> {
  const picker = (
    window as unknown as {
      showDirectoryPicker?: (o?: { mode: string }) => Promise<FileSystemDirectoryHandle>;
    }
  ).showDirectoryPicker;
  if (!picker) throw new Error('Folder export needs a Chromium browser (File System Access API)');
  const root = await picker({ mode: 'readwrite' });
  const files = buildKitFiles(wp, qrSets);
  for (const f of files) {
    let dir = root;
    for (const part of f.path.slice(0, -1)) {
      dir = await dir.getDirectoryHandle(part, { create: true });
    }
    const handle = await dir.getFileHandle(f.path[f.path.length - 1], { create: true });
    const w = await handle.createWritable();
    await w.write(f.content);
    await w.close();
  }
  return files.length;
}
