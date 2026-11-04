# Damage Up Types Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to execute inline and obtain one final independent review.

**Goal:** Select All Damage or any combination of Pierce/Fire/Water/Ice/Storm and enforce those choices in battle.
**Architecture:** Optional damageTypes tuning survives normal application/copy/capture; one packet predicate serves ordinary statuses and canonical command/ongoing modifiers. Preserve legacy elementFilter and absent-scope behavior.
**Tech Stack:** Existing TypeScript, React, Vitest, native browser fixture.
**Spec:** docs/superpowers/specs/2026-11-04-damage-up-types-design.md

## Global Constraints
- Absent damageTypes means All Damage; present array is nonempty, distinct, contains only pierce/fire/water/ice/storm.
- Scope applies once per matching direct packet; never double-boost captured DoT ticks.
- Existing timing, potency limits, stacking, snapshots and Owner drafts remain authoritative.
- Release with Seal only after exact-head configured CI passes. Git deployments remain disabled until explicit coordinated cutover.

## Review Focus
- Historical typed Pierce packets must never get duplicate boosts when Pierce and its element both match.
- Copy/stacking must retain per-application scopes and not apply only the newest scope to every stack.
- Canonical manual/automatic/ongoing modifier bonuses and native attacks use the same classification.
- Empty/duplicate/unknown scope and scope on unrelated status are rejected at authoring and snapshot boundaries.
- Shared reports must not claim All Damage when a captured application is restricted.

### Task 1: Engine, validation and capture
- [ ] Add failing real executeCombatAction/commitCombatAbilityCommand tests for all packet types, mixed scope, overlapping matches, modifier modes and historical absence.
- [ ] Add shared damage-up type definitions, validation, summary and matcher; thread packet piercing and optional scope through status tuning, canonical payloads and command modifiers.
- [ ] Verify stacking, expiry, Copy, reload, delayed resolution and unchanged captured DoT amounts with real battle tests.
- [ ] Run focused core and adjacent capture/command/status suites; commit.

### Task 2: Editor and reports
- [ ] Add failing React tests for All Damage and combined checkboxes, retained scalar element filters, percentage/duration preservation and actual captured reports.
- [ ] Implement shared controls and type-aware active/compact/full/Chronicle prose through existing adapters.
- [ ] Run native interaction/reload at desktop/laptop/phone and focused editor/reader tests; commit.

### Task 3: Review, quality and coordinated release
- [ ] Update current guidance and receipt; run pnpm check with telemetry disabled, review full diff and one independent whole-branch review.
- [ ] Refresh main and Seal; preserve concurrent changes; push via Git Data if shell lacks credentials and verify tree identity.
- [ ] Open separate draft Damage Up PR; exact-head CI must pass before integration and the coordinated release. No waiting/polling loop for pending remote CI.
