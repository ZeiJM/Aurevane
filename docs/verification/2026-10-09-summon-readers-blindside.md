# October9 summon readers and Blindside verification

Status: summon/Blindside/targeting/Airborne Jump/Ground copy scope locally verified and reviewed. PR854 is open; not yet merged or deployed.

BaseMain: `8b7646ff7b3143c915fb13e8c3f943b6c8521634`. Isolated branch `agent/summon-compact-chronicle-20261009`. Existing Owner automatic release authorization covers these continuation requests. The Vercel Git deployment lock is unchanged. No database/SMTP work is needed.

Scope/design: `../superpowers/plans/2026-10-09-summon-readers-blindside-spec.md` and its companion plan. Three original defects were reproduced before implementation: duplicated inline summon parameters; missing departure receipts/identity for summons without ability casts; Blindside listed before Damage. Expanded Owner activation request reproduced front and missed casts incorrectly granting the buff.

Focused verification: 32core Blindside tests and181web reader/log/effect tests pass. The actual mounted inspection browser script passes all10cases: ally inspection in PvE/PvP at1366×768/390×844 plus summon inspection in PvE/PvP/spectator at both sizes. It verifies collapsed names+! rows, all ten full-reader fields, pinned45AP, hover/tap, layering, nested Escape, single-reader ownership, overflow and zero command authority/console errors. Desktop/mobile screenshots were visually reviewed. Full `NODE_OPTIONS=--max-old-space-size=2048 pnpm check` passes: formatting, lint, all eight package type checks,4,533Vitest tests plus seven Node checks, and the production build. Final source/tree/CI/deployment evidence will be recorded after completion. No human acceptance is claimed.

## Targeting follow-up

Single range previews were incorrectly restricted by the renderer to occupied eligible targets; Ground Single aiming also reduced its potential footprint to the selected tile. Failing mounted browser and unit regressions reproduced both. Restored potential coverage preserves shared canonical geometry and legality. Vacated tiles previously skipped semantic polish cleanup, retaining inline red target borders after movement; the shared polish now synchronizes every tile. The first corrected run passes39focused tests and72actual browser targeting cases, including desktop/mobile PvE/PvP, legacy geometry, spatial gates, command failure, Ground lifetime and spectators. Desktop Single and mobile Line screenshots were visually reviewed. A stronger regression arms real Basic Attack, confirms its inline red border, publishes a placement change and checks cleanup before rearming the Skill. It fails on the old polish at the vacated-border assertion and passes with the fix. It also confirms the empty tile keeps potential reach until Cancel, which clears both layers. All72browser cases pass with this stronger regression. The combined full `pnpm check` passes again with4,533Vitest tests plus seven Node checks, formatting/lint/eight-package types/build. A fresh targeting review found no material issue; its minor stale combat-document sentence was corrected to distinguish range glow from recipient outline.

## Airborne Jump follow-up

An actual canonical movement regression reproduced active Airborne failing to enter a height3 tile despite existing Attack Target Elevation3. New independent airborneJumpPolicyVersion1 derives Jump3 while the status is active, retaining stored stats/movement profiles and historical snapshots. Preview, per-step commit, board reach and Recruit route planning share the effective movement helper. Captured readers and Manual report the added rule only for the current policy. Initial focused verification passes97core tests and123web tests. A fresh review found gaps in UI absolute-elevation entry, holder Jump for forced/Rewind movement, and current-stat inspection; all were corrected and the reviewer found no remaining material issue. Inspector projections derive Jump from viewer-visible status. The expiry extension permits level plateau traversal and descent for low-baseline Jump, preserving historical absence. Its canonical RED case failed before the fix; current phase4/board112tests and UIgeometry29tests pass. All76mounted browser cases pass, including desktop/mobile PvE/PvP Attack-height3 commits, height3 movement, actual expiry/removal descent and compact Ground inspection. Desktop/mobile compact Inspect screenshots were visually reviewed. The final combined full `pnpm check` passes:4,544Vitest tests plus seven Node checks, formatting/lint/eight-package types/build. The bounded plateau follow-up review is clean; every fifth policy argument is propagated and historical behavior is preserved. The next elemental Owner request is being developed before the combined release.

## Ground copy follow-up

Two focused RED cases reproduced the verbose Inspect and log wording. The shared compact Inspect and forecast/Chronicle/Copy summaries now omit redundant notes, preserving canonical affected tiles, cast boundaries and full accessibility rules. The affected seven-file web suite passes91tests; all76browser cases include compact Ground Inspect and summary assertions.

## Owner tests once live

- [ ] Start a new battle, gain Airborne and move onto a tile with an elevation difference of3. Attack Skills can also target a height difference of3. Once Airborne expires, Jump and targeting return to their ordinary values; cross a level plateau and descend even with baseline Jump0, paying ordinary costs. Rooted still blocks movement.
- [ ] Select Single, Line, Circle, All and Ground Skills on desktop/mobile: full potential range appears; aiming/forecast changes do not shrink it to occupied tiles. Cancel removes targeting cues.
- [ ] Push and Pull an outlined enemy: its old empty tile has no residual target border; selecting another Skill still shows the correct full range.
- [ ] Inspect Verdant Stalker on desktop/mobile: each ability shows only its name and !. Hover/tap ! for the full ten characteristics, description and effect explanations; Escape closes the child reader first.
- [ ] Let a summon expire and defeat another: Chronicle and Copy Full Log explicitly name its departure; previous movement and incoming attacks still name Verdant Stalker.
- [ ] Inspect Perfect Opening, Backstab, Exploit Opening, Execution Cut and Flanking Cut: Damage is listed before Blindside, including effect explanations.
- [ ] Start a new battle. Use a Blindside Skill from the front: normal damage, no new BLS status and no Blindside activation in the log.
- [ ] Use it from side/rear: captured bonus damage and one-turn BLS status/log; buff ends at the holder's turn end. Misses and a Skill-authored100% modifier do not grant/refresh it.
- [ ] Repeat in playable PvP and inspect as a spectator; preserved historical battles retain their saved rules.

## Fresh review

A fresh reviewer found one material defect: earned Blindside pending applications were discarded during settlement because the reconstructed pending action contains only the status effect. Next-round and delayed regressions failed after JSON restore; restricting qualification to the granting cast fixes both, and all32core tests pass. No other material findings were identified.

Additional coverage deferred: mismatch/failing-resolver negative summon cases; an explicit same-version attack/departure grouping assertion; and actual randomized area/Ground packet hit scenarios beyond the deterministic canonical miss gates. The reviewer traced the existing fail-closed source checks, standalone grouping and packet gates and found no corresponding defect.

Validation environment: the first full check with a768MB Node heap exhausted memory in web types; the complete rerun uses2048MB. Standard Chrome required an unavailable Unix socket; the same actual browser script succeeded with official Chrome Headless Shell155.0.8059.39. These are runner limitations; no test was disabled and no browser behavior was substituted.
