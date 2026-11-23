# Ground, Airborne and reader refinements Implementation Plan

Owner follow-up: Healing Down reduces both HP and MP recovery by the recorded per-application potency. Pin optional `healingDownPolicyVersion:1` in new PvE/PvP/Master previews; absent historical policy retains HP-only reduction. Flat positive recovery shares the HP calculation; percentage recovery captures the reduced amount once, including delayed activation and future ticks. HP/MP Leech recovery also shares the reduction before resource caps. MP costs/drains remain unchanged. Shared Skill/status readers and Manual explicitly say HP and MP recovery. Add actual Fieldcraft PvE/PvP, preview, stacking, periodic rounding/caps, delayed serialization and historical regressions.

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

### Follow-ups: Healing Down and Blindside

- [x] Apply Healing Down to HP and MP recovery, including delayed/periodic and Leech gains; preserve absent-policy history and drains.
- [x] Append Blindside versions for all five positional Skills and expose one-turn Instant authoring/readers.
- [x] Verify expiry, persistent Ground settlement, defeat cleanup, history and Master conversions; resolve independent review findings.
- [x] Complete combined full gate including editable Blindside (4,484 Vitest tests, seven Node checks, format/lint/types/build).
- [x] Complete exact-head release: PR #852 merged after all 17 workflows; hosted additive timing migration and explicit Production deployment verified.

- [x] Add separately editable per-Skill Blindside side/rear percentages, captured per application; verify preview/commit, reapplication/restore, Copy Buffs, malformed metadata and responsive Master inputs.

### Follow-ups: summon inspection, legal AI and Poison refresh

- [x] Reproduce summon/Recruit resolution failure; prune departed summon turn-trigger records atomically, preserve legal filters, test exhausted AI turn completion.
- [x] Share pinned ten-row summon ability cards and ! hover/tap details across desktop/mobile PvE/PvP/spectators; nested dialog layering and Escape ordering; read inspected snapshot policies.
- [x] Move condensed Ground delivery notes into Target, remove bottom Ground entry and preserve authored effect explanations.
- [x] Implement Poison policy2 duration refresh and independent maxima; preserve old policies, copying/pending/restore and no extra movement damage.
- [x] Complete combined gate/review including all follow-ups: 4,522 Vitest tests plus seven Node checks, formatting/lint/types/build.
- [x] Complete exact-head release including all follow-ups; see final release receipt.

### Task 3: Verified release

- [x] Refresh Main and publish the exact local tree. Prior editable-only native candidate835d353cdfa742f866a5f90298a63dca86c7cc57 matches local34a9f7dc485059c94af659c259f6a0fecdf1f4f4, tree d745e4dce965047e9f009598267690d4d41e36df. PR852 includes the editable Blindside follow-up.
- [x] Require all applicable exact-head workflows, merge and apply verified additive timing migration.
- [x] Deploy verified merged SHA, check canonical alias/HTTP/bounded logs, record evidence and provide Owner checklist.

## Execution ledger

Tasks 1–2 implementation and local verification complete: full check passes 4,437 Vitest tests plus seven Node checks; review fix passes 109 focused mechanics/percentage tests. Native release follows existing Owner authorization. Ruling: preserve absent-policy historical Displaced mechanics and old Ground/Airborne limits while retiring current authoring and markers — protects saved encounters; fresh encounters receive the approved rules.

Final release: October8/9 Owner follow-ups are released for testing through PR #852, merge `e68c1b66e8608b13ef791ce592920a6b6b0fe69c`. All 17 exact-head workflows passed for `4c79a8cb22cd2deea423d8cecf73ea99337ef9c0`; the merged tree `f02000544256ccb476afe51d4b62c9b9abe5de77` matches the final local verification (4,522 Vitest tests plus seven Node checks, formatting/lint/eight-package types/build). Production `dpl_Bf3k5k72q9XMW96n1DTBxCWvxQv3` is READY at https://aurevane.vercel.app since `2026-10-09T03:40:43.703Z`. The additive Push/Pull/Blindside timing migration preserves all six published policy versions and service-only grants; no new security-advisor groups were introduced. Seven public-route checks return HTTP 200, and the bounded initial runtime window shows no warning/error/fatal entries. Fresh battles pin the new policies, including Poison2; historical encounters retain their recorded rules. Human gameplay acceptance remains the Owner checklist in `docs/verification/2026-10-08-ground-airborne-readers.md`. Automatic Git deployments remain locked and this release implies no phase change.
