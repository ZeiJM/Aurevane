# Summon readers and Blindside implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan in the current session. Existing Owner authorization permits completion and release without another confirmation.

**Goal:** Compact summon skills, preserve named summon departures and activate Blindside only for enhanced flank hits.

**Architecture:** Extend the existing shared reader, viewer-safe recorded log enrichment and canonical effect resolver. Pin the activation change independently for new encounters; reorder presentation without changing execution.

**Tech Stack:** TypeScript, React, Vitest, Playwright, GitHub Actions, Vercel.

**Spec:** docs/superpowers/plans/2026-10-09-summon-readers-blindside-spec.md

## Global constraints

- Shared desktop/mobile PvE/PvP/spectator parity; all ten characteristics remain in the ! reader.
- Exact visible spawn source Skill version/profile determines historical summon identity.
- New policy1 only; absent historical policy preserves prior activation.
- 160% side/220% rear defaults, Skill-specific captured overrides, existing expiry/stacking/Copy and Basic Attack exclusion remain authoritative.
- Git deployments stay disabled; release only verified source within existing authorization.

## Review focus

- Summons which move or receive attacks but never use an ability still keep names after departure.
- Hidden spawn receipts and unavailable/mismatched content cannot disclose names.
- Reordered display retains effect-description alignment and immutable execution.
- Missed per-target or independent damage packets cannot grant a Blindside actor buff.
- Existing buff applications must not refresh on front/100% hits or change historical snapshots.

### Task1: Shared summon reader and Chronicle

**Files:** summon-ability-list.tsx/.module.css/.test.tsx; battle-ally-inspection-browser-regression.mjs; battle-log-service.ts; battle-log-skill-context.ts; battle-log-chronicle-model.ts; battle-log-presentation.ts; battle-log-service.context.test.ts.

**Interfaces:** SummonAbilityReader consumes pinned ability/context inside the existing popover. BattleLogEntry actorNarrator/targetNarrator capture safe identity for Chronicle and clipboard.

- [x] Update compact list regression and record failure with inline parameters still present.
- [x] Add departure/identity regressions for expiry/defeat without an ability cast, retaining hidden-spawn privacy.
- [x] Remove raw parameters; retain full actual reader; enrich visible pinned identities; retain departure events.
- [x] Run the focused six-file web suite and the actual browser inspection script; expect all passing.

### Task2: Blindside activation and display

**Files:** skill-effect-groups.ts; skill-effect-preview.ts/test; combat-blindside.ts/test; actions-legacy.ts; new battle factories, viewer projection and timing context.

**Interfaces:** blindsideActivationPolicyVersion?:1 is pinned in new encounters and validated through canonical state validation. Damage-first grouped display retains firstIndex. Shared resolver tests side/rear against actual target facing and packet hit gates before applying Blindside.

- [x] Record RED for damage-first and front/missed activation regressions.
- [x] Implement shared display ordering and policy-gated flank activation.
- [x] Verify all current positional Skills, preview/commit, neutral/front/missed/independent packet gates, restore and historical cases.

### Task3: Verification and release

- [x] Refresh Main; inspect focused patch and run pnpm check plus affected browser parity checks.
- [x] Obtain the required fresh whole-branch review; resolve material findings with regression coverage.
- [ ] Publish isolated branch/PR; wait for all applicable exact-head CI; merge verified head.
- [ ] Deploy exact merged SHA, verify canonical alias/public routes/runtime window and record actual evidence.
