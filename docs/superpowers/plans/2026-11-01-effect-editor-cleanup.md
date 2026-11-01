# Effect editor cleanup implementation plan

> **For agentic workers:** Use superpowers:executing-plans for the shared editor changes; the independent duration audit uses superpowers:dispatching-parallel-agents.

**Goal:** Simplify shared effect authoring, align its controls and support editable durations through 99 turns.

**Architecture:** Keep effect identity in the effect picker. Reuse shared controls and target labels across Skills, Essences, Resonances and Summon Skills. Extend existing duration limits through authoring, capture and runtime without rewriting historical definitions.

**Tech stack:** TypeScript, React, CSS modules, Vitest, native browser regression fixtures.

**Spec:** Owner requests in this work item: remove pictured Requirements prose, Use tag requirements and Add behavior controls; remove behavior disclosures and repeated elemental repair prompts from Range, Execution and Effects; remove redundant Range legend/help; remove all effect-identity Status selectors; align all effect fields; allow every editable duration through 99; show each Target once without “existing rules”. Later additions: Burn Ward potency through 100%; correct stacked-modifier precision; remove the Chilled movement claim and cleansing advice from status/skill descriptions.

## Constraints and review focus

- Preserve saved targets, requirements, multiple behaviors, provenance, notes and automatic elemental pairing. Opening a form must not migrate its data.
- Keep status-condition and cleanse/copy selection controls; they select affected statuses, not the effect identity.
- Keep bounded draft repair in Details & Text, without repeating it in other tabs.
- Keep inherited targets with compound/external meanings accurate; deduplicate only matching labels and preserve inherited values until an edit.
- Durations of 99 must survive validation/capture and count down; reject 100. Recovery can need 100 applications for an immediate application plus 99 turns. Fixed lifetimes remain fixed.
- No dependency changes, catalogue republication, database writes or deployment in this follow-up.

## Tasks

### 1. Shared form cleanup

- [x] Add failing rendered/control tests for missing identity selectors, retained tuning and data, section-specific headings/repair, duplicate-free target choices and 99-turn input callbacks.
- [x] Remove the requested controls in `ability-definition-editor.tsx`, `skill-effect-editor.tsx` and `skill-targeting-editor.tsx`. Keep every existing group and editing callback; render non-Details groups without a disclosure.
- [x] In `effect-target-editor.tsx`, retain the inherited option value while replacing its matching explicit option, with plain target labels.
- [x] Normalize native and shared label/control dimensions in `combat-content-editor.module.css`; add representative Barrier, Airborne, compound-control and nested Summon desktop/mobile regression cases.
- [ ] Review the configured CI desktop/mobile layout evidence; local Chromium download returned an invalid archive.
- [x] Adapt native browser fixtures that previously used Add behavior: seed their existing multiple groups, preserving publication/removal coverage.

### 2. Duration limits

- [x] Add failing native/canonical authoring, capture, persisted-state and runtime regressions at 99/100.
- [x] Extend the shared duration maximum and dependent limits, retaining fixed lifecycle rules and historical capture compatibility.
- [x] Bind all editable duration inputs (including Reveal and Summon lifetime) to that shared maximum; retain minimums and recovery scheduling.
- [x] Run focused tests, then adjacent/full combat coverage because duration state spans the engine.

### 3. Verification and delivery

- [x] Run focused Master editor tests, compile the native browser fixture and exercise the actual Basic HTTP handler/service probe. Native interactions and layout remain in the CI evidence task above.
- [x] Run formatting, lint, typecheck, full tests and build on the stable patch (`pnpm check`). World/auth mechanics are unchanged; retain configured core/browser smoke rather than adding unrelated development suites.
- [x] Review the final diff and refresh main; remote main remains55543011 with the original base tree.
- [ ] Publish the reviewable PR and inspect configured CI. Keep deployment disabled; this work item supplies no new release authorization.

## Review and added scope

- Shared editor regressions first failed for the redundant controls and duplicate target labels, then passed after removal. Opening forms preserves saved values; recovery remains in Details only.
- Independent review found three boundary gaps. Regressions reproduced native Summon duration100 being accepted, Amplify rejecting long start-turn lifetimes, and historical canonical Summon lifetime100 failing reload. Current authoring now validates nested Summon effects and caps new lifetimes; shared capture readers retain historical lifetimes. Copying permits the authored start-boundary offset and longer legitimate catalogue defaults. Focused fix suite: 104 core tests pass; server/field/corrector 176 tests pass.
- Burn Ward now shares a per-status potency ceiling across input, corrector, native/canonical validation, application and restored state. All other potency limits remain unchanged. A current-combat100% reduction and its restored state are covered.
- Description cleanup is presentation-only. It removes cleansing tips, including historical help text, without changing captured mechanics; Cleanse effects still explain their own action.
- Rounding audit: one 50% reduction turns 11 into 5 under the established floor rule. A separate premature basis-point truncation loses precision for five 50% reductions on 32 damage (0 instead of 1). Carry exact conditional ratios to settlement only under a new captured policy; preserve historical arithmetic and existing defense/critical/level/facing stages.
- The native browser fixture compiles. The actual local HTTP/service probe passes, including seeded existing multigroup editing. Local Chromium installation failed because the download returned an invalid archive; desktop/mobile rendering remains a configured CI check, not a claimed local pass.

### Added tasks from live Owner review

- [x] Reuse same-group Damage or Pierce for Poison/Burn/Bleed regardless of each effect’s Target; stop duplicate generated hits and removal resurrection. Preserve separate authored hits and notes. New different-recipient DoTs capture actual hostile command HP loss under an explicit profile marker; absent historical markers retain per-recipient arithmetic.
- [x] Hide Poison copy eligibility without deleting stored values. Add `movementRefreshTiles` (1–99/default5), bind combat refresh, copy/reapplication and current descriptions to the captured threshold. Higher potency carries its threshold; equal/weaker reapplication retains the incumbent threshold while duration maxima remain independent.
- [x] Remove redundant requirement explanation footers across shared and native reports; retain the Requirements row and its existing inline references.
- [x] Permit Conductive potency through 100% using the same central ceiling used for validation, correction, application and restored state. Test save bounds and real forecast/commit damage.

The first full repository check passed formatting, lint, types and all core/package suites; its web suite reached 7739 passes with one obsolete Fire-cleansing text assertion. That assertion was updated for the explicit description-removal request. Later DoT/refresh/requirement additions invalidate this intermediate full result; the final gate must run after those changes stabilize.

The DoT implementation completed a separate red/green cycle: command-total basis, later damage ordering, zero/Barrier/HP-cap behavior, native/canonical capture and reload; Poison threshold merge/copy/refresh and pending/active metadata. The focused web matrix passed331 tests. Full core passed6287 before one additional real seven-tile Push/Pull regression (that test also passed); the final combined check will include6288. Conductive100% forecast/commit and restored state passed90 elemental tests and185 web validation/field/corrector tests. New browser checks edit Poison toSelf with an existing hit, set7-tile refresh/99-turn duration, assert one unchanged damage row, and remove Poison.

### Copy Buffs addition

- [x] Current Copy Buffs options omit the historical positive Blindside and include Covert. Current All Buffs normalizes to an explicit current selection; user subsets remain subsets. Captured old Blindside selections remain readable, and old omitted-All selection does not acquire Covert.
- [x] Current Copy Buffs pins optional `invisibleDonorPolicyVersion: 1`; old absent-policy captures keep their prior Invisible targeting. Invisible donor admission applies to copying, with ordinary hostile packets still blocked unless actual Reveal independently permits them.
- [x] Verify native/canonical/captured Skill, Essence, Resonance and Summon paths, Covert/Invisible duration/provenance, viewer-safe receipts and source retention. Add native desktop/mobile checkbox interactions and rerun the final combined gate; rendered evidence remains the CI task above.

The117-file pre-Copy checkpoint passed `pnpm check`:6288 core,7755 web and all other package tests,7 Node tests, formatting, lint, types and production build. Its local checkpoint is42a6b4e/tree29f50; its real-parent counterpart is689d90a5. New Copy work requires final combined validation and is not live.

Copy Buffs implementation and focused review are complete. The final focused suite passes250 core and71 web tests plus both typechecks. The native fixture compiles and the actual Basic HTTP service probe passes. The full check exposed a missing target in the provenance test fixture; its8 assertions remain intact, the fixture now supplies a valid unit target, and the no-catalog recipient path short-circuits before concealment checks. The43 adjacent tests pass and the focused reviewer approved the correction. The final combined gate is running again; desktop/mobile rendering is still CI evidence pending.

Final stable-source `pnpm check` passes (`/tmp/av-copy-release-check.log`): formatting, lint, types,219 core files/6308 tests,543 web files/7760 tests, all other package suites (604 tests),7 Node tests and the production build. Total Vitest tests:14672. The Copy Buffs review and the earlier scope reviews report no remaining findings. No application source changed after this successful gate. The source is ready for a reviewable PR; configured desktop/mobile evidence remains pending. No deployment, database migration or catalogue republication was performed.
