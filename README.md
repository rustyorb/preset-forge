# PresetForge

A generative, visual builder for SillyTavern Chat Completion presets.

- **Outline** — every module with toggles, drag-to-reorder (writes real `prompt_order`), search.
- **Editor** — content, role, Relative ⇄ In-Chat placement with depth/order (shown only when they actually apply, like ST itself), AI refine box.
- **Context preview** — a structural simulation of what the model receives: relative prompts in order, markers expanded with a sample scene, In-Chat prompts spliced into the chat at their real depth.
- **Lint** — catches the classic breakage: guide-style wrapper files, flat `prompt_order`, depth-on-relative no-ops, trailing-`::` getvar, unreachable modules, deprecated keys.
- **Wizard** — describe a preset → model proposes a module plan → you approve → content is generated per-module and assembled app-side (the LLM never writes preset JSON).

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
