# PresetForge

A generative, visual builder for SillyTavern Chat Completion presets.

- **Outline** — every module with toggles, drag-to-reorder (writes real `prompt_order`), search.
- **Editor** — content, role, Relative ⇄ In-Chat placement with depth/order (shown only when they actually apply, like ST itself), AI refine box.
- **Context preview** — a structural simulation of what the model receives: relative prompts in order, markers expanded with a sample scene, In-Chat prompts spliced into the chat at their real depth.
- **Lint** — catches the classic breakage: guide-style wrapper files, flat `prompt_order`, depth-on-relative no-ops, trailing-`::` getvar, unreachable modules, deprecated keys.
- **Wizard** — describe a preset → model proposes a module plan → you approve → content is generated per-module and assembled app-side (the LLM never writes preset JSON).
- **Workspace** — a preset library with switcher/duplicate/delete; imports (file or 🌐 URL) open new slots, nothing gets overwritten.
- **Variable manager** — rename a `{{setvar}}`/`{{getvar}}` variable across every module, IDE-style jump-to-usage, dangling-read quick fix.
- **Card-aware** — load a real character card (V2/V3 JSON or PNG) to preview against, and let the 🎯 Advisor recommend module toggles for that character.
- **Regex kit** — author SillyTavern regex scripts (with a live test box) stored inside the preset at `extensions.regex_scripts`, the way the big preset engines ship them.
- **🔗 exclusion groups** — name modules `🔗 Group: Variant` and enabling one auto-disables its siblings; conflicts lint.
- **📖 README generator** — one click documents the preset's toggles/groups/injections as a top-of-list module.
- **Module library** — ☆ save any module as a reusable block and 📦 insert it into any preset.

Format knowledge verified against SillyTavern 1.18.0 `release` source. Sibling of the
`creating-sillytavern-presets` Claude Code skill — same spec philosophy and lint rules.

## Run

```bash
npm install
npm run dev   # http://localhost:5299
```

LLM features need a provider (⚙): any OpenAI-compatible endpoint (LM Studio, OpenRouter) or Anthropic. Keys live in your browser's localStorage only.

## Test

```bash
npx esbuild tests/roundtrip.ts --bundle --format=esm --platform=node --outfile=/tmp/rt.mjs && node /tmp/rt.mjs
```

Round-trips a real 90-module preset (path inside points at a local ST install — adjust) and asserts semantic identity of prompts, params, and order.
