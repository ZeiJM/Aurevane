# Skill Accuracy Kernel Implementation Plan

> For agentic workers: use superpowers:executing-plans. This is the first independently verified slice of the approved accuracy / Mark / Blind group.

**Goal:** Resolve opted-in Skills using one deterministic roll per hostile unit while preserving existing command effects, costs, reactions and historical behavior.

**Architecture:** A shared probability helper reads committed stat profiles. The public wrapper validates and resolves target rolls; an engine-owned recipient filter skips missed hostile recipients inside the existing effect sequence. No second damage resolver or authored hit-result override is introduced.

**Tech Stack:** Existing TypeScript, Vitest, pnpm and GitHub Actions; no dependency changes.

**Spec:** `docs/superpowers/specs/2026-09-12-reactive-effects-accuracy-discipline-rebalance-design.md`, section 9. Mark/Blind status mechanics and complete presentation/AI publication remain following slices.

## Global constraints

Server-owned state and deterministic RNG; optional backward-compatible fields; immutable published catalogs; no deployment; never merge diagnostic workbench branches. Use the exact verified shared base and expected-head merge locks. Ordinary automatic behavior and the Basic Attack adapter remain compatible.

## Task 1: Per-target accuracy runtime

- [x] Verify shared baseline and read command, authoring, provenance and mature Skill entry points.
- [x] Write public-entry-point tests; correct the fixture type annotation; observe 40 assertion-only RED failures with 1,443 passing tests.
- [x] Add `combat-skill-accuracy.ts`: common authoring validation, pure hit probability, stable hostile recipient forecasts and deterministic rolls.
- [x] Wire public `actions.ts` and the engine-owned commit recipient filter in `actions-legacy.ts`; exclude missed recipients from K3 provenance assignment.
- [x] Forward optional fields through `mature-skills.ts`; reuse probability math in the existing Basic Attack adapter without changing its execution behavior.
- [x] Run focused tests, typecheck and full `pnpm check`; inspect exact source/file scope and retain the source-only candidate.
- [ ] Review and pass all exact-head PR workflows, merge into shared combat, then verify exact merge-head Quality and Database checks. PR receipts record this integration stage.

## Interfaces and follow-on boundary

`CombatAccuracyAuthoring` defines optional accuracy mode and modifier. `forecastCombatSkillAccuracy` adds `targetHitChances` and `projectionsAssumeHits` only to legal opted-in previews. `rollCombatSkillAccuracy` consumes the same chances and returns immutable RNG state, accuracy receipts and missed recipient IDs. `calculateHitChanceBasisPoints` remains the shared arithmetic function also re-exported by the historical Basic Attack module.

Mark/Blind requires separate source-specific state, refresh/nonstack validation, historical Mark compatibility and integration into this same probability function. Player-facing conditional forecasts, AI expected-value scoring and content publication are not certified by this kernel ticket.
