# November 4 Items and shared report verification

Status: implementation complete; local quality gates passed. **Not deployed.** No hosted migration or current catalogue publication was performed.

## Source and design

Work began on `ce249f40024233ae2e28747b5481eb22adb7a055`. Before finalization the branch fast-forwarded to `af3b829fde5376b185f72c1cffa3afd73f0ef2c6`, preserving the separate chat/media CPU optimization; its six files do not overlap this task.

Current authority: [Items/report followup](../superpowers/specs/2026-11-04-items-presentation-followup.md). Human testing: [Owner checklist](2026-11-04-owner-items-followup-checklist.md), which links the prior release's broader combat/media checklist. Historical release receipts remain unchanged.

Implemented: Inspect → Item cockpit order; compact Items controls/cards/details; packed filters without saved-order mutation; eight legal equipment roles under100QP; separate consumable slots alongside two-handed weapons; presentation-specific neutral faceless templates; effective Profile stats and named signed contributions; three additional selectable weapon Supports;10–30AP consumables; current Conditional Cleanse; actual Damage Instant; consistent compact Turns; shared accurate editor text guidance; single-line responsive effect headings. Source versions, custom publications, previous starter receipts and historical captures remain protected.

## Local quality evidence

The current-main run `/tmp/aurevane-followup-check-current-main.log` completed **16,499 Vitest tests and seven Node tests**, all passing. Per-package counts: game-core7036, web8770, db562, validation107, audio19, realtime3, worker2. Formatting, lint and types passed before those tests. The production build was beginning when automated workspace maintenance removed the checkout between turns.

Recovery restored123 checkpoint files and verified every Git blob hash against the saved checkpoint. Three late test-only fixes were reconstructed and rerun:39/39 pass; they add the required Instant expectation, scope Summon timing assertions per card, and supply the existing direct-component hook mock's deterministic useId. No production behavior was reconstructed or changed. The separate fresh recovery command `pnpm format:check && pnpm lint && pnpm typecheck && pnpm build` passed, including the current-main optimized production build (`/tmp/aurevane-recovered-build.log`). The earlier pre-main production build had passed, but is not used as proof of the reconciled build.

## Native browser verification

All runs mount real production components with local fixture/service transport, not an authenticated hosted account. Chromium Headless Shell151.0.7922.34 is selected by `AV_CHROMIUM_EXECUTABLE`.

| Surface | Passing evidence |
| --- | --- |
| Final battle Item flow |45/45: PvE/PvP/spectator ×1366/390/412 ×five scenarios, including actual two-handed Sunsplitter with a consumable; no private receipt leakage. `/tmp/aurevane-battle-items-final-combined-evidence/results.json` |
| Full Barrier heading |6/6 strict geometry/fit cases;280px full heading fits1366/390/412, tokens share baseline, Info does not execute and Escape restores focus; no heading/page overflow. `/tmp/aurevane-battle-items-geometry-fit-evidence/results.json` |
| Arsenal |Nine shell viewports, three saved presentation variants, three interaction viewports. Eight slots/QP fit without Equipment scroll; toolbar≤176px; square art; card bottom gap≤12px; no slot/footer overlap; authority/focus/swap/repair cases retained. `/tmp/arsenal-items-browser-evidence/` |
| Guided real service |10/10. `/tmp/aurevane-guided-items-followup-evidence/results.json` |
| Runtime Item editor |1366/390/412 controls, bound report, serialization, class reset and limits. `/tmp/runtime-item-editor-browser-evidence/` |
| Editor guidance |12 cases across Skill/Essence/Resonance/Support/Item/Tag at1280/390: persistent hints, matching dialogs, Escape, no draft mutation, overflow or runtime errors. `/tmp/aurevane-editor-guidance-browser-evidence/` |
| Profile |1440×1000 and390×844: signed colored deltas, multiple named sources, hover without focus theft, tap/Enter/Escape/outside close, unverified state and no overflow/errors. `/tmp/aurevane-profile-browser-evidence/` |

## Authority and compatibility

Migration `20261104082325_eight_slot_item_equipment.sql`:7,992bytes, SHA256 `628852930ece675238cb6477b4595f46df62cee942683470db8ac7fe5b797314`. Exactly five function bodies change with guarded predecessors. Owner/ACL/security/search-path metadata and lock order remain unchanged. Actual-SQL focused58tests cover13 seeded assignment transitions, archived fallback, support remapping, ownership/quantity/QP/hand conflicts, two-handed equipment with both consumables at100QP, schema2 ordering/admission, frozen schema1 history, exact metadata and atomic rollback. Unresolved old hand conflicts remain assigned for explicit repair; stacks/quantities/receipts/history are not deleted.

Exactly13 changed default bodies advance source versions: Twinfang Blade, Stormcaller Staff, Emberbrand, Mender Salve, Clarity Draught, Whetstone Charm, Ironbark Tonic, Swiftleaf Tea, Emberflask, Vulnerability Oil, Frostbind Powder, Smoke Veil, Ward Sigil Scroll. Purifying Incense stays unchanged at30AP/v1. The starter receipt key is unchanged. Source changes do not imply hosted publication.

Profile/battle parity tests prove Mystic Power20→32 with actual packet damage30→42, Movement4→6 and matching Evasion caps, preserving base values and reload behavior. Conditional bonuses are explicitly excluded from roaming totals. Red delta rendering does not invent a new negative-stat primitive.

## Independent review

Independent review executed243tests in16files, all passing, and inspected core/service authority, migration/metadata/transition logic, actual text consumers and shared CSS/mobile/accessibility boundaries. One important issue was repaired and independently verified: historical Chilled-only removal must select its exact pinned Tag wording before generic siblings, including pending battle tooltip projection. No unresolved important findings were reported within the reviewed scope.

## CI followup

The first review head `e5c47eb467dc8ef191c0ab2c187f19912fae430e` exposed browser assertions that treated flex-token `innerText` line breaks as semantic changes. The Controlled and modular-reader checks now normalize whitespace while retaining exact captured type/power, timing, cost and negative legacy-effect checks. Exact native buildcraft/Manual expectations include the requested Damage Instant label.

Two actual presentation defects were also repaired: Manual grid/list tracks now shrink within the viewport rather than expanding to a long formula's minimum width; new editable-field help dialogs use distinct About names so a label resolves to its input rather than both an input and a hidden dialog. Other help dialogs retain their existing titles. Added regression assertions protect the distinct field-help titles. `AV_MASTER_TAGS_ONLY=1` supports a focused local operational run; the default full operational matrix is unchanged.

Focused followup evidence:57 Controlled cases pass; complete modular reader/Manual/authoring browser run passes at1366/390; actual Tag commit controls pass desktop/mobile/150% zoom; all12 text-guidance cases pass with the new dialog names;34 affected unit tests and web typecheck pass. A focused diagnostic reproduced Manual width510px at viewport390 before the track fix and375px afterward; the full original no-page-overflow assertion remains in place. The final source production build passed after moving aside a corrupt disposable Turbopack persistence cache (`/tmp/aurevane-ci-followup-build-clean.log`). Scoped formatting, ESLint, web types and an additional independent13-test guidance review pass. Exact-head remote CI remains a separate gate below.

## Remaining gates

Configured exact-head CI is required before integration/release. No Preview/Production deployment, hosted migration or current publication was performed. Git deployments remain disabled in `apps/web/vercel.json`. Owner visual acceptance, physical devices/screen readers, authenticated production flows and human multiplayer checks remain open. No Phase5 closure is claimed.
