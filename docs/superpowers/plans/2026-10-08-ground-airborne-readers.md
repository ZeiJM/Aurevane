# Ground, Airborne and reader refinements Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement these tasks in this session.

**Goal:** Release the Owner’s Ground/Airborne/Push/Pull rules and shared reader refinements for testing.

**Architecture:** Optional encounter policies preserve historical resolution. Shared engine helpers own team surcharge, Airborne targeting and exact misses; shared readers consume sanitized projections and current/pinned context. Master choices retain canonical typed payloads and audited immutable timing publication.

**Tech Stack:** TypeScript, game-core, React/Next.js, Vitest/PGlite, production-component Chromium tests, GitHub CI and Vercel.

**Spec:** `2026-10-08-ground-airborne-readers-spec.md` and `docs/COMBAT.md`.

## Global Constraints

Preserve historical snapshots, pinned definitions, privacy, normal costs, Steam, Rewind, phase boundaries and automatic deployment lock. Attack/Utility/Heal are the public annotations. Apply responsive PvE/PvP parity and spectator readers.

## Review Focus

Source-team ownership after death/replacement; automatic/friendly Airborne misses; delayed/entry immunity and expiry; history gaps/pinned content/privacy; independent Push/Pull timing with historical fallback.

### Task 1: Canonical Ground/Airborne/Push/Pull authority

Files: game-core `combat-airborne.ts`, `actions.ts`, `actions-legacy.ts`, `pv1f-action-economy.ts`, `terrain-overlays.ts`, `combat-skill-accuracy.ts`, `combat-effect-timing.ts`; web battle creation and Master authoring/preview.

- [x] Add regressions for team costs, restore/source ownership, Ground immunity, delayed/entry activation, Attack-only elevation and retired marker.
- [x] Pin optional version1 policies at new encounter creation; implement central helpers and policy-aware receipts/readers.
- [x] Add separate Push/Pull choices/timing, inherited legacy override and protected additive SQL validation; verify PGlite publication/history/grants.
- [x] Complete full workspace checks and independent review; fix premature delayed Ground percentage-DoT cancellation with two RED→GREEN activation regressions.

### Task 2: Shared readers and targeting cues

Files: shared character Skill/Resonance reports; battle preview, terrain summary, Chronicle/clipboard; sanitized log service; Master editor and shared playable targeting.

- [x] Add meaningful assertions for Ground separation, actual tile summaries, Chilled labels, exact setup names, receipt/source/content grouping and immutable inputs.
- [x] Implement shared summaries/notes and Attack-only elevation context; suppress vacant single-unit Attack cue.
- [x] Verify desktop/mobile production components, privacy, full log parity and visual evidence (72 targeting cases, both shared reader layouts).

### Task 3: Verified release

- [ ] Refresh Main; publish exact local tree as stacked candidate without disturbing the arrow-only CI.
- [ ] Require all applicable exact-head workflows, merge and apply verified additive timing migration.
- [ ] Deploy verified merged SHA, check canonical alias/HTTP/bounded logs, record evidence and provide Owner checklist.

## Execution ledger

Tasks 1–2 implementation and local verification complete: full check passes 4,437 Vitest tests plus seven Node checks; review fix passes 109 focused mechanics/percentage tests. Native release follows existing Owner authorization. Ruling: preserve absent-policy historical Displaced mechanics and old Ground/Airborne limits while retiring current authoring and markers — protects saved encounters; fresh encounters receive the approved rules.
