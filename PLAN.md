# PresetForge — Plan

*A generative, visual preset builder for SillyTavern Chat Completion presets.*
*(Name provisional — sibling to TavernForge/TomeForge. Drafted 2026-08-18.)*

## Why this exists

Verified against SillyTavern 1.18.0 source and real presets on 2026-08-18:

- Modern popular presets are **huge**: Chimera_v2 carries 90 prompt modules (30
  in-chat injections); NemoEngine-class presets run 60+ modules with emoji
  taxonomies, divider modules, and README modules — all managed today through
  either a raw JSON file or ST's cramped drag-and-drop list.
- The ecosystem grew a whole extension (NemoPresetExt, "prompt workstation":
  search, collapsible sections, snapshots, directives, its own Hub) just to make
  these navigable *inside* ST. Authoring tooling still doesn't exist.
- The format is a trap for hand-authors and LLMs alike. A popular AI-authoring
  guide (cha1latte/sillytavern-preset-creator) teaches a wrapper object that
  imports as a dead preset, a flat `prompt_order` that ST silently ignores, and a
  depth system attached to the wrong `injection_position` value. People are
  generating broken presets and can't tell why.

## Design principle #1: the LLM never writes JSON

The single highest-leverage decision. The LLM authors **module content and a
spec** (names, roles, placement intent, plain text). The app owns serialization:
identifiers, markers, `prompt_order` wiring (character_id 100000+100001), escaping.
This makes the "Invalid file" / empty-module / ignored-order failure class
structurally impossible — and it's why the whole guide-sized pile of JSON escaping
rules becomes unnecessary.

The `creating-sillytavern-presets` skill (installed 2026-08-18) already implements
this headlessly: spec → `build_preset.py` → `validate_preset.py`. PresetForge is
the interactive UI over the same spec format and lint rules. Skill = the brain
(Claude Code path); app = the hands (tinkering path). Keep the spec format shared.

## Product shape

Local-first React SPA. No backend; LLM calls go straight from the browser to a
configurable provider. Three panes:

1. **Outline** — module tree grouped by category, toggle switches, drag to
   reorder (writes `prompt_order`), mutual-exclusion groups, search/filter.
   Live token meter (enabled vs total).
2. **Editor** — selected module: name, role, placement (Relative ⇄ In-Chat with
   depth/order controls that only appear for In-Chat, like ST itself), content
   with macro highlighting (`{{char}}`, `{{setvar}}`, broken-getvar detection).
3. **Context Preview** (the killer feature) — a simulated assembly of what the
   model actually receives: relative prompts in order, markers expanded with
   sample card data, in-chat injections spliced into a fake chat history at
   their real depths. Nobody's tool shows this today, and it is exactly the thing
   everyone (including the guide) gets wrong. Toggling a module updates the
   preview live.

## Generative layer

- **Wizard**: "describe the preset you want" → LLM returns a structured module
  plan (spec, not JSON-file) → user prunes/edits the plan → per-module content
  generation with the design-pattern prompts (genre modules 50–150 tokens, core
  800–2000, etc.).
- **Per-module refine chat**: select a module, converse to rewrite it; diffs
  shown before accepting.
- **Sampler advisor**: use-case → recommended params, with source-awareness
  (min_p/rep_pen greyed out for Claude/OpenAI targets).
- **Providers**: OpenAI-compatible endpoint (covers LM Studio/local), Anthropic,
  OpenRouter. Keys in localStorage, never exported with presets.
- Generation is enforced via structured output (JSON schema / tool-call), then
  assembled app-side regardless — belt and suspenders.

## Import / lint / export

- **Import** any existing preset (NemoEngine, Chimera…): parse into the module
  model, preserve unknown top-level keys verbatim, surface lint findings
  (deprecated keys, unreachable modules, depth-on-relative no-ops).
- **Lint** continuously with the validator ruleset (port of `validate_preset.py`
  to TS; keep the two rule lists in sync).
- **Export** flat preset JSON (never model/source/proxy keys), plus optional
  README module generation and a MODULE_GUIDE.md for distribution.

## Phases (each gated on a verify step)

**P0 — Foundation (no LLM yet)**
Schema types, import, outline+editor panes, drag-order → `prompt_order`, live
lint, token estimate, export.
*Verify: import Chimera_v2 → export → semantic round-trip (same prompts, order,
toggles); exported file passes `validate_preset.py`; import into a scratch ST
and confirm the manager renders it identically.*

**P1 — Generative wizard**
Spec wizard, per-module generation + refine chat, sampler advisor.
*Verify: generate three archetypes (Tier-1 settings-only, Tier-2 10-module
genre system, Tier-3 30-module w/ stances+dividers); all pass lint; import and
spot-check in ST.*

**P2 — Context Preview + power tools**
Assembly simulation with sample card/chat, module diff view, exclusion groups,
reusable module library (save/insert your own genre/stance/CoT blocks).
*Verify: preview output matches ST's actual prompt itemization (compare against
ST's prompt inspector for the same preset + dummy chat).*

**P3 — Distribution polish**
README/MODULE_GUIDE generators, preset snapshots/versioning, NemoPresetExt
convention interop (dividers, `@tooltip` directives), shareable module packs.

## Stack

Vite + React + TS + Zustand; virtualized lists (90+ modules); `gpt-tokenizer`
for estimates (chars/4 fallback); FS Access API + drag-drop for files. No build
dependency on ST. Optional later: Tauri wrap, or a thin ST extension that
live-syncs the working preset into a running ST instance (stretch).

## Risks

- **Format drift**: schema pinned to verified 1.18.0 anatomy; keep a "re-verify
  points" list (INJECTION_POSITION, migrateChatCompletionSettings,
  chatCompletionDefaultPrompts, onPresetImportFileChange) to diff on ST releases.
- **Preview fidelity**: don't promise byte-accuracy; promise structural accuracy
  and validate against ST's prompt inspector in P2.
- **LLM output quality**: content quality varies by provider — refine chat and
  the module library are the mitigation, not stricter prompts.
