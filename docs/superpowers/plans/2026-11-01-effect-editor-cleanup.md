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

Pre-Barrier-follow-up `pnpm check` passed (`/tmp/av-copy-release-check.log`): formatting, lint, types,219 core files/6308 tests,543 web files/7760 tests, all other package suites (604 tests),7 Node tests and the production build. Total Vitest tests:14672. The Copy Buffs review and the earlier scope reviews report no remaining findings. No application source changed after this successful gate. The source is ready for a reviewable PR; configured desktop/mobile evidence remains pending. No deployment, database migration or catalogue republication was performed.

Native CI follow-up: run41266889565 onf4c42596 stopped at the new Summon geometry fixture because its Effects disclosure was closed. The fixture now opens and tests ability0 consistently, and explicitly requires canonical Barrier99 to have no compatibility warning. Reviewing the desktop evidence exposed Barrier authoring/grant and persisted-clock validators still capped at4; their file contained literal NULs and had been skipped by ordinary text searches. Both validators now use the shared99 limit; equivalent `\u0000` source escapes preserve key bytes and make the file searchable. Six new tests cover canonical/native99,100 rejection, both persisted clocks, capture/reload and actual99-turn expiry under Instant/Normal/Delayed timing. The narrow review approved the corrected source and fixture. Historical unexposed generic apply-status Bleed and static roster normalizers retain their own contracts.

The final `pnpm check` passes on the Barrier follow-up (`/tmp/av-barrier-release-green-check.log`):6314 core tests,7760 web tests,604 other package tests,7 Node tests, formatting, lint, types and production build. The latest browser fixture separately passes lint and compilation. An intermediate build failed opening its local Turbopack persistence cache; moving that generated cache aside resolved it without an application change. New native desktop/mobile CI evidence is pending. No merge, deployment, migration or catalogue republication.

## Additional Owner Copy, Reflect and percentage follow-up

The Owner added these requests while testing the prior live build. They remain part of this update; none authorizes deployment or catalogue republication.

- Confirm Covert applied to enemies. The engine already applies it; the viewer projection had hidden the caster's own application. Show the caster team a sanitized Active/Pending Covert confirmation on the opposing unit, without revealing other buffs, aggregate applications or shared lifetimes. Friendly recipients retain full information; spectators and foreign-only Covert stay concealed.
- Current Copy Buffs and Copy Debuffs use the full original resolved source lifetime captured when the source application was created. Optional durationPolicyVersion1 opts edited/new copies into this behavior; historical copies without it retain remaining-duration rules. Missing historical donor origin metadata falls back to its saved lifetime, without guessing from a mutable catalogue. Capture originalDurationTurns privately per application, including established clock offsets.
- Current Copy Debuffs excludes Burn, Bleed and Poison from its choices, All Debuffs, defaults and execution. Historical selections remain readable. Cleanse still supports those DoTs.
- Copy may appear after other effects. Instant execution sees the already-resolved source prefix. A newly supported nonfirst queued Copy reads the source at its activation; prefix forecasting sorts by activation round, with authored order for ties. Existing first-Copy commands keep their cast snapshots. Missed/resisted/expired source creation cannot invent a copy. Private copyEffectOrdinal preserves queued identity; transient source maps never become public or saved data.
- Endure is excluded from Dispel choices and authored removal resolution, while its natural expiry, damage release and defeat cleanup retain their existing lifecycle.
- Current Dispel can select Invisible through a captured packet-specific opt-in. Self/Ally Dispel cannot admit an unrelated Invisible enemy, and other hostile packets retain their concealment rules.
- Current Counter presentation becomes Reflect, with Physical Reflect, Magical Reflect and Full Reflect. Internal identities, pinned mechanics and custom names remain. Reflection Chronicle/clipboard text uses a human-readable action label and actual actor narration while preserving every damage outcome.
- Editable tag percentage potencies accept up to999% across current controls, authoring validation and runtime. Other numeric controls are unchanged; effective probability/resource bounds and zero-damage floors remain authoritative. Existing defaults and historical oversized captures are preserved.
- The Owner withdrew the proposed Reckless/Fortified reclassification. Both remain neutral, white and noncopyable.

Focused RED/GREEN evidence and independent reviews cover source lifetimes, DoT exclusion, Covert mixed-source/private refresh cases, Copy scheduling/provenance/resistance and Reflect presentation. Percentage and Dispel implementations and focused reviews are complete. The final integrated gate and new configured CI must run after source freeze.


## Finishing-hit display and Endure action recovery

- [x] Retain full post-mitigation finishing-hit damage separately from capped HP loss in optional receipt metadata. Direct, reflected, periodic, backlash and Endure-release receipts share this rule; exact values beyond safe numeric representation use decimal strings. Barrier and summon limits remain part of resolved damage.
- [x] Show this number through the shared desktop/mobile PvE/PvP/spectator Chronicle and copied log. Keep HP, damage ledgers, DoT bases, reflection, recovery and Endure accumulation on actual HP loss. Historical receipts fall back to their recorded amount.
- [x] Repair Endure movement/turn/abort reconstruction without exposing or synthesizing its private ledger. Verify actual movement, support, opposing AI and save/reload; damage-dealing actions remain blocked only for the bearer.

Focused finishing-hit checks pass149 core tests plus122 Barrier/Reflect/summon tests and164 web reader/clipboard tests (overlapping suites); the Poison movement regression also passes. The overkill review approved both current and historical Reflect display paths without mechanical changes. The prior integrated check passed formatting/lint/types and6453 core tests but stopped on a pre-existing timezone-fragile DB week assertion: the timestamp was correctly Monday UTC serialized as Sunday16:00−08. Comparing its normalized UTC instant fixes the assertion; all473 DB tests and both UTC/non-UTC focused runs pass. No migration or reporting behavior change. The final integrated gate must include Endure recovery and these additions.

Endure action recovery is frozen and independently reviewed:6470 core tests,134 focused core tests, strict types/lint/format, and actual server AI JSON-roundtrip/movement plus terminal-abort/Master recovery cases pass. Full-state movement and AI/PvP quality updates retain private authority. Surrender cancels only the forfeiting holder before turn handoff; no final-tick burst. Natural expiry still releases normally. Master recovery clears Endure and Reversal ledgers together with active effects/primes; resources and captures remain. The additive SQL patch updates only the two current RPC execution-state checks through guarded exactly-once text replacements, preserving delegated page authority, conflict codes, service-only ACLs, locks, CAS, immutable NoContest history and audit.61 recovery PGlite tests pass. The urgent current stuck encounter is being handled through this narrow recovery correction; the broader web batch remains unreleased.

Urgent recovery completion: hosted migration20261101053041 updates exactly the two private execution cleanup lists in the current Master recovery RPC; exact before/after function comparison confirms every other body byte, owner, ACL and configuration is preserved. The one stuck version6 encounter passed the strict local validator and a rollback-only canonical recovery rehearsal, then committed once as version7 NoContest/NoRewards with one immutable receipt and audit. No active encounter remains for that character; progression, character/build rows, paid resources and captured definitions are unchanged. No application deployment occurred. The full prevention fix remains in the pending web source. Receipt: `docs/verification/2026-11-01-endure-recovery.md`.

Final finishing-hit completeness: Reversal uses separate optional exact display metadata after its real return caps, summon cap and Barrier. Actual returnedDamage, preventedDamage, trigger guards and RNG remain unchanged. Four real interception cases and genuine controlled prime→interception→service→Chronicle/clipboard cases pass; independent review reports no findings. The superseded combined run observed two new integration fixtures during their temporary invalid setup; the final frozen run starts only after their correction, all types/focused checks and source freeze. No expected value or production guard was weakened.

## Circle radius addition

The Owner requested that Circle radius increase from5 to15. Update the shared modern editor, current authoring/correction and runtime targeting together; preserve historical unbounded legacy handling and independent effect targets. Verify15 saved/captured/reloaded and actual boundary recipients, reject16 under current rules, and add a native field interaction without changing other shape limits. The final gate must include this addition after source freeze.

Circle15 source is frozen and reviewed: shared editor/corrector/current geometry bounds and runtime footprint agree. Modern Summon profiles enforce only Circle reach, preserving unrelated targeting and unversioned historical radius16. Focused110 core and48 web tests pass; an independent review additionally passes87 core/45 web. Actual Skill/Essence/Resonance capture/reload reaches the15tile boundary and excludes16; Summon coverage verifies stored profiles and editor callbacks. The palette fixture compiles and checks native15/16 validity/restoration; execution in Chromium remains CI evidence.

## Terrain presentation additions

- [x] Group repeated terrain forecast entries by transition, duration, activation and policy, counting unique actual tiles. One48tile Frozen Ground result replaces48 shrinking chips; mixed outcomes remain distinct, full details stay available and unit forecasts are preserved. The shared pane retains fixed artwork/strip geometry and scrolls internally for longer mixed summaries.
- [x] Hide only position-derived terrain-evasion/terrain-defense indicators from compact character rails before aggregation/counting. Genuine Buff/Debuff/Pending effects (including pending terrain creation) and full noncompact inspection remain.
- [x] Shrink tile terrain icons and numbers only in mobile media queries to elevation-style tile-relative sizing, preserving desktop styling, values, visibility/click mechanics and shared playable/spectator parity.
- [x] Add36 native browser cases (desktop1366 and mobile390/320 ×PvE/PvP/spectator ×unit/ground aim ×single/mixed terrain) for grouping, readable labels/internal overflow, fixed64pxstrip/32pxart, unchanged forecast inputs and marker geometry. The existing ability-readers workflow runs them and saves screenshots/results. Local Chromium is unavailable; no native-rendering success is claimed until CI runs.

The complete pre-Circle/terrain source passed `pnpm check`:14923 Vitest tests,7 Node tests, formatting, lint, types and production build. New terrain focused56 tests, rail68 adjacent tests and mobile19 tests pass; full web types are green after the preview union annotation fix. The final combined gate begins only after all new source freezes.

Final completed-checkpoint verification: `pnpm check` exits0 on `/tmp/av-final-circle-terrain-check.log`:6486 core,7850 web,480 DB and131 other Vitest tests (14947 total),7 Node tests, formatting, lint, types and production build. All completed scope reviews report no findings. The new36case native browser fixture is wired into existing CI but has not run locally because Chromium is unavailable. Source is being checkpointed into PR#1002 before the newly requested Ground-contact/identity/Freeze Ground retirement, tile timer restoration and zero-cost Haste mechanics begin. Those subsequent requests require a separate implementation plan and fresh verification.
