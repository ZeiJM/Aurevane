# Battle map and input fit implementation plan

> **For agentic workers:** Use the parallel layout/input split below; run the combined verification and independent branch review before release.

**Goal:** Increase battlefield space, align cockpit controls, equalize player cards and improve terrain recognition and repeated keyboard actions.

**Architecture:** Retain the shared BattleExperience controller and existing server previews/commits. Layout changes belong to the existing CSS modules; no alternate battle renderer or gameplay authority is introduced.

**Tech Stack:** React, CSS modules, Vitest, Playwright, existing Next.js app.

**Spec:** Owner requests in this workstream, 2026-10-01; `docs/COMBAT.md` and battle `AGENTS.md` remain authority outside these requested changes.

## Global constraints

- Preserve AI/PvP parity, spectator presentation, natural phone flow and server-authoritative AP/movement legality.
- Keep the map dimensions stable across action selection, target previews and final facing.
- Keep info popovers, readable forecasts, effect duration icons, log controls and circular grid portraits.
- Existing Owner merge/deploy approval applies; maintain the configuration-only release/relock boundary.

## Review focus

- Empty and populated slots, long names and End Turn align at normal and short desktop sizes.
- Both combatant cards retain equal allocated height with twenty effects and all terrain samples.
- Terrain artwork remains legible and labels remain available with a full key at narrow desktop widths.
- Repeated casts cannot reuse stale previews, duplicate requests or continue into terminal/other-player turns.
- Move highlights and accepted clicks agree and preserve terrain AP charges and movement allowance.

## Task 1: Board and rail layout

Files: selected-skills and skill-command modules/markup; PvP and spectator experience modules; map-key module; forecast layout E2E.

- [x] Establish failing browser geometry assertions: preview 44px, equal card heights, aligned artwork/control baselines, terrain samples at least 24px on regular desktop, no clipping.
- [x] Use a two-line fixed preview with its heading beside the forecast; align cockpit artwork/name/control tracks including empty slots and remove visible future-path Coming soon caption.
- [x] Give both rail cards the same shared height derived from available rail height, then allocate the remaining space to terrain/log utilities; enlarge terrain samples with a compact multi-row key.
- [x] Run actual-component desktop/phone matrix with normal/dense effects, full key, log views and final facing; compare map dimensions before/after.

## Task 2: Repeated inputs and immediate targets

Files: BattleExperience controller, geometry/preview helpers as needed, focused tests and refined execution E2E.

- [x] Add failing behavioral regressions for immediate-step movement, second self hotkey cast and action retention after authoritative commits.
- [x] Keep selected actions across same-turn commits while clearing obsolete receipts; acquire fresh informational aim without automatic execution.
- [x] Limit Move highlighting/clicks to legal adjacent steps and remove path labels; add shaded red range treatment consistent with Move.
- [x] Verify repeated hotkeys/WASD, key-repeat suppression, blocked inputs, exhausted AP, stale version, handoff and terminal boundaries.

## Task 3: Combined verification and release

- [x] Run format, lint, typecheck, complete tests and build separately; inspect results.
- [x] Review the complete diff independently, reconcile fresh main and pass all applicable exact-head CI workflows.
- [x] Merge application bytes; release with configuration-only main enablement, verify READY canonical deployment and public smoke/runtime logs, then relock and record evidence.
