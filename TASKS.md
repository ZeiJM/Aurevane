# AUREVANE — Active Task Ledger

## Living Atlas — Phase 5 authorized parallel work (2026-09-22)

Owner approved Phase 5, the globe/sector style, uncharted territory and temporary View 360. Isolated branch `agent/phase5-strategic-atlas-20260922` implements the first Atlas/travel slice with event guidance and existing PvP entry. Phase 4 acceptance remains open. See `docs/LIVING_ATLAS_DELIVERY.md` for the bounded content scope and verification/release gates; this entry does not claim all Phase 5 complete or authorize deployment.

Draft PR #609 has passed authenticated Atlas browser acceptance across desktop/laptop/mobile, including private frontier discovery, all eight panoramas and a two-account attack during View 360 (run 35795492891). Real-database entry, expired-training and retry defects have regression coverage. Screenshot review adds compact phone identity, container-fitted globe and hover-contrast corrections. Owner acceptance, staging competition checks and further authored world content remain open.

2026-09-23 continuation adds a distinct encounterable Crown Road sector between Aureth Crown and Verdant Expanse, original map/panorama art, filtered exit controls and an authoritative travel-time estimate. The actual sector coordinate drives the globe marker. Coastal Road continues that path from Verdant Expanse to Hollow Coast with distinct cliffside/shore terrain, surf and its own panorama. Ember Road and Southern Caravan Road add volcanic and desert routes to Emberreach and Glasswind Desert. Highland Road and Northern Pass continue the northern route to Starfall Highlands and Frostmere. Eastern March Road and Old Coast Road complete the eight initial regional road connections; all now use authored encounterable sectors. Further world content and Phase-5 systems remain open.

Resumed verification: northern-road Atlas run 35847548263 passed eleven scenarios with sixteen intentional viewport-duplicate skips at `081bd4a9`; new maps and reverse panoramas were inspected. The final road pair passed all 76 focused world tests after thirteen new cases first failed, including reachability between every pair of canonical regions. Its full quality gate passed with 2,793 tests plus six report tests. Independent review identified a verge/painted-obstacle mismatch, reproduced and fixed; new browser verification is pending. The previous Battle Session DB job failed before testing on an occupied runner port; Browser Smoke was cancelled. These are not application test failures or an all-CI-green claim.


Owner's ambient-motion follow-up adds separate regional water/lava masks, Hollow Coast wash, slow wind and faint region-colored light while preserving motion-off/reduced-motion behavior and readable controls. Full local checks pass at 2,793 tests plus six reports; fresh independent review found no important defects. Browser discovery now includes actual animation/toggle checks and two deterministic real-Postgres contention scenarios (command/retry and mutual attack). Their runtime evidence is pending; the prior-head Atlas run remains queued. The prior-head Battle Session DB rerun passed, while Browser Smoke failed before tests on occupied Supabase port 54324. See delivery notes for exact evidence. No merge or deployment.


## Battle presentation polish follow-up — 2026-09-13

Owner requested four corrections to the live command dock: sleeker portrait HP/MP meters, equally wide command/history panels, restoration of the earlier rich text-log formatting, and preview tags aligned with the Skill title. This follow-up keeps the stable battlefield allocation, square artwork, three slots per rail, recent four actor turns and static header/footer. Shared desktop rail meters retain their readable numbers and card geometry while using thin coloured fill lines and subtle translucent tracks. The desktop command dock uses two equal columns. The shared React preview overrides the older PvE inset that was shifting its tags right. The text tab reuses the established transcript formatting, including concise movement narration, numbered actions, semantic colours and indented results. Height-aware pages preserve complete actions where they fit; unusually long entries provide a visible link to the full recorded results. Combat rules and saved history remain authoritative and unchanged.

Implementation is on `agent/battle-polish-followup`, based on fresh main `ef04ccd`. Focused browser guards check equal dock widths, thin meters with readable values and tag/title alignment. The Edge stage uses a separate output directory so the final successful run retains the Chromium visual evidence. Full local `pnpm check`, 39 focused transcript tests and independent review passed for initial candidate `6d08fc7`. CI, Skill Engine and Representative Buildcraft passed; the latter included 24 browser cases (six skips). Browser Smoke passed 19 focused cases (six skips), then found that the opening AI Guard action appeared under “Battle” instead of “Round 1”. The complete-history log annotator began with null context because initial AI snapshots omit start events, and could backfill opening actions into a later round. The follow-up initializes the known opening context before following recorded markers, without changing stored events or combat execution. Desktop/laptop/short-window AI/PvP and mobile forecast screenshots were reviewed. Corrected candidate `c0f4a954f54a46f101cb4324727108bc41c0db61` passed the final local `pnpm check`, 45 focused log/context tests and independent review. All four applicable exact-candidate workflows passed: CI `34754499382`, Skill Engine `34754499372`, Representative Buildcraft `34754499375` and Browser Smoke `34754499389`. Browser Smoke passed 20 focused cases (six skips), 133 Chromium cases (98 existing skips) and four Edge cases; Buildcraft passed 24 browser cases (six skips), 727 core tests and 95 server tests. Final browser artifact `10317270827` retains the reviewed rich-text log, desktop forecast, portrait/dock and mobile screenshots. The oversized-result browser check verified visible full-results access, complete recorded results and recovery to ordinary text layout.

Fresh-main finalization preserved the unchanged baseline. PR #465 merged at `735b0302e98f555076f35411baca8f3e74e991d0`, exactly matching tested tree `e2c14f23ba5a8d840a89b0945ad9515a620d2e1d`. Configuration-only release `26ba6a240f42b51aab30824c7c3f2a1143f0de5f` reached READY as `dpl_9SQWsZSLcQmuY2YfZ91SDWN9iafe`; `aurevane.vercel.app` was confirmed on that exact deployment, and build logs reported completion.

Authenticated live AI Sparring on Terraced Yard (11×7), at 1363×936, confirmed both lower panels measure 665.5×184px. All four portrait meters use 10px tracks and 2px coloured fill lines with visible values; the bright Archer portrait is more exposed. The Guard forecast’s first tag aligns exactly with its title (0px inset), showing 30 AP, 100% success, 70 AP left and Guarded. A committed Guard spent 30 AP; Text log showed Round 1, numbered narration, an indented Guarded result and clickable full recorded details. The Opponents filter showed “Recruit moves” without coordinates in a transcript with equal client/scroll height (87px). Closing and reopening history kept the battlefield at 968.625×631.015625 with identical position and size. First Space displayed four map-facing guides while the legacy cockpit pad remained `display:none` with no layout rectangles; second Space committed facing.

The practice battle ended through Confirm Surrender in Round 3. The complete saved review retained six actions across all three rounds, including the opening Guard and concise movement in Round 1. Archer returned to the Profile with Level 1, XP 0/100, attributes 8/3/12/3/2/8, maximum HP 265, MP 62, Bastion, Last Bastion and four selected techniques unchanged. Browser diagnostics sampled extension metadata errors; production error/fatal logs for this deployment were empty during 2026-09-13 11:34:12.668–11:49:12.668 UTC.

This documentation/configuration closeout restores `deploymentEnabled: {"**": false}`. Desktop/mobile PvE/PvP verification includes the existing responsive and six-card capacity guards; it is not a claim of an actual 80% browser zoom or six-human live match. Human visual and tactical acceptance remains open for the Owner’s testing.

## Stable battle map and compact command dock — 2026-09-13

Owner requested a further revision after testing PR #463: preserve the larger battlefield with history open or closed, move compact square-art commands left and Battle Flow right, put the forecast below commands, reserve three proportionate character cards per rail, and restore previews for all Discipline Skills. The shared desktop layout now reserves one stable lower band for commands/history. Portraits and complete skill artwork use square frames; redundant card cost text moves into the existing information popup. In-battle history is bounded to the current and previous three actor turns using the authoritative turn number, while the saved post-battle review and full-log copy retain every entry. Mobile keeps its touch layout and receives the same forecast/history behavior.

Diagnosis: the prior separate history grid row changed the map's available height on toggle. Single-character rail rules enlarged portraits, and artwork-specific transforms cropped images. Guard automatically forecasts because it targets self; Barrier and Mend are authored ally Skills with range 1–3 and cannot target the caster. The new shared selection helper uses committed targeting metadata for regular Skills and Essence, presents honest cost/range/effect information before target selection, and requests the authoritative result after a valid explicit target. Switching an armed Skill refreshes its forecast, and selecting an invalid target clears the previous confirmation. Server legality, calculations, lifecycle, rewards, static header/footer and the hidden legacy facing pad remain intact.

PR #464 is merged and the Owner-authorized revision is live. Current-main reconciliation preserved the concurrent artwork release through `ce1622f` without altering its media files. Final combined local `pnpm check` passed lint, formatting, typechecking, tests and production build. Focused validation includes 31 forecast/selection tests and 45 log tests; independent code review found no additional actionable issues. Browser regressions cover stable map/dock geometry, three-card rail capacity, uncropped square artwork, compact forecast bounds at 1280/1024, basic-to-Discipline selection changes and clearing stale confirmation. No schema or catalog activation changes were made.

First candidate `d28ee408` passed CI, Skill Engine, Essence Build and Resonance Build. Browser Smoke passed 13 focused cases (three skips) and found two preview-font failures; the shared preview font is restored to the existing 12px readability minimum. Representative Buildcraft passed 15 browser cases (six skips), including the new Guard-to-Barrier preview flow, and found nine assertions using three retired Essence image paths. Those assertions now check the exact current media resolver output, reject fallback art and retain load/visibility checks. Initial desktop/laptop and short-window screenshots were reviewed; the next candidate also captured a populated command/history dock and active forecasts on desktop/mobile.

Second candidate `b3f22f29` passed CI, Skill Engine, Essence Build, Resonance Build and Representative Buildcraft (24 browser cases; six skips). Browser Smoke passed the focused layout stage and 129 full-suite cases (98 existing skips), finding three more retired Foundation artwork assertions and one mobile PvP test interaction failure. Foundation checks now use exact current registry sources and retain decoded-image, visibility and geometry checks. The mobile map-invariance helper now closes the shared communication drawer with its actual close button, instead of clicking its covered opener. The same board-bound assertions remain. These scenarios run in the focused stage before the unchanged full Chromium and Edge gates. Active desktop/mobile forecast and populated-history screenshots were reviewed. These test-only corrections passed in the final candidate below.

Release evidence:

- All six workflows passed at exact candidate `c045f81aa58c327928954cc509f5f2db7b5b848f`: CI `34751449808`, Skill Engine `34751449840`, Essence Build `34751449835`, Resonance Build `34751449803`, Representative Buildcraft `34751449847` and Browser Smoke `34751449828`. Browser Smoke passed 20 focused cases (six skips), 133 Chromium cases (98 existing skips) and four Edge cases. Representative Buildcraft passed 24 browser cases (six skips), plus focused batches of 727 and 92 tests.
- Rendered desktop, short-window, mobile forecast and populated-history evidence from `b3f22f29` was reviewed; its application source is identical to the final candidate. Final Browser Smoke passed but uploaded no artifact because the final successful Edge invocation cleared its output directory. Representative artifact `10315692279` remains available. Live screenshots of the deployed layout and Fortress forecast were also reviewed. The 2400×1228 CI viewport covers space equivalent to the supplied 80% reference; an actual browser zoom change was not verified. Six-card coverage checks rendered capacity using cloned real cards, not a live six-human match.
- Fresh-main gates preserved concurrent changes. Merge `f63ec10ad26adb7d217f72518ae119a1a7211171` exactly matched tested tree `15e5c2d9a31a6258ce21dc58d99939a8b826a847`. Configuration-only release `84027cbc58013a422b5c60ab55ca2d5398395cbb` reached READY as `dpl_Go19uCrz8NoabRMgW4gERZTJfBdh`; the production alias resolves to that exact SHA. Build logs reported successful completion.
- Authenticated live AI Sparring on Terraced Yard (11×7), at 1363×936, measured the battlefield at 968.625×631.015625 and board at 956.75×608.84375. Opening/closing Battle Flow preserved their x/y/width/height exactly. The command/history panels share a 184px lower band, the forecast sits beneath the commands, all six skill images loaded at 74×74 with `contain` and no transform, and both portrait frames measured 90.125×90.125. There was no horizontal document overflow. Populated log panel/feed both measured 154px client and scroll height.
- Live Fortress selection displayed 30 AP, Success 100%, 70 AP remaining and Fortified. An invalid empty target cleared confirmation; selecting Archer restored the authoritative forecast. The opening committed cast applied Fortified for two turns. A later consecutive Fortress cast correctly omitted its effect under the existing repeat-use scaling rule; no server gameplay changes were made. Basic Attack preview and its details popup displayed 30 AP, 56% hit chance and 11 damage on hit. First Space displayed four map-facing guides while the legacy pad had `display:none` and zero layout rectangles; second Space committed facing. The six-entry Map Key opened and dismissed by clicking away; timeline action details opened correctly.
- In-battle history rolled forward through the latest four actor turns. After Confirm Surrender, Review Battle Log retained all 24 actions across seven rounds, including the opening Fortress application in Round 1. Copy Full Log remains available and was clicked, but the cloud clipboard read was empty, so successful clipboard export is not claimed. The complete saved review was verified directly.
- Archer returned through Battle Hall to the profile with Level 1, XP 0/100, attributes 8/3/12/3/2/8, maximum HP 265, MP 62, Last Bastion and four selected techniques unchanged. The browser diagnostic sample contained extension metadata errors; production error/fatal logs were empty for this deployment during 2026-09-13 10:27:49.103–10:42:49.103 UTC.
- This documentation/configuration closeout restores `deploymentEnabled: {"**": false}`. Human tactical and visual acceptance remains open for the Owner's testing.

## Battle map space and forecast correction — 2026-09-13

Owner requested restoring battlefield space after reviewing the live layout at 100% and 80% zoom. This correction removes the legacy board size ceiling and scales portrait tokens from each tile; gives three combatants per rail a bounded allocation with HP/MP values inside the portrait bars; reduces the cockpit to artwork-led cards with dismissible skill information; and pages the timeline/text history without internal scrolling. Map Key moves immediately left of Victory Conditions in the static header. The redundant header log control, coordinates toggle, visible tile coordinates and under-map legend are removed. Tile accessibility labels retain positions. Forecasts now render directly from the current validated React preview state, preserving projected damage, healing, accuracy, status effects, costs and legality without fetch/DOM observer races. The initial facing pad stays hidden; existing map-facing and server commit handlers remain authoritative.

PR #463 from `agent/battle-space-and-forecast` is merged and the Owner-authorized correction is live. The board size ceiling, fixed token dimensions and competing legacy preview observers caused the reported sizing and missing-forecast regressions. The correction keeps the static header/footer and authoritative combat rules. No database schema or catalog activation changes were made.

Release evidence:

- All four applicable workflows passed at exact candidate `6ac626a8e697e5fe3a74f0bbe8265e986cd8c60a`: CI `34729464848`, Skill Engine `34729464880`, Representative Buildcraft `34729464889` and Browser Smoke `34729464971`. Local `pnpm check` also passed before the final mobile CSS and test-selector adjustments; final CI validated those adjustments.
- Browser Smoke job `103649460919` passed 15 focused cases (three existing skips), 133 Chromium cases (98 existing skips) and four Edge cases. Representative Buildcraft passed 24 applicable browser scenarios (six skips). Coverage retains PvE/PvP gameplay and adds geometry, six-card rail allocation, paged history, dismissible skill/key/forecast popups, target previews, skill selection and first/second-Space behavior.
- Desktop screenshots at 1920×982 and 1280×720 and the final mobile screenshot were visually reviewed. The 2400×1228 responsive viewport covers the space equivalent to the supplied 80% reference; this is not a claim of a real browser-zoom test or a live six-human match. The final mobile adjustment prevents the headline from collapsing into narrow wrapped text.
- Fresh-main checks immediately before merge and release preserved concurrent work. Merge `c479784c10c06038c48aa75be5aef168fed409b2` exactly matched verified tree `0f18903dd513b1567244e4338b4ccc5896d5e8e0`. Configuration-only release `335af270fda3ee440c5f7b83588b44a31a2384bc` reached READY as `dpl_5WjuWcAa9XPgBw8bqWUaLxrWgHnt`, with the production alias confirmed on that deployment.
- Authenticated live AI Sparring on Terraced Yard (11×7) at 1363×936 showed the enlarged map, proportional portrait tokens, HP/MP numbers inside portrait bars, compact artwork cards, header Map Key immediately before Victory Conditions and bounded Battle Flow without internal scrolling. Map Key displayed six descriptive entries and closed with Escape.
- A live Basic Attack preview displayed 30 AP, 56% hit chance, 11 damage on hit and 70 AP remaining, both in the cockpit and its Action forecast popup. A committed Guard spent 30 AP and displayed Guarded for two turns with Damage received −15%. First Space displayed map-facing guides with the legacy cockpit pad hidden; second Space committed facing. Clicked timeline details showed the recorded Guard result. Live history advanced to a paged 15-action sequence without a scrolling log pane.
- The disposable practice battle ended through Confirm Surrender. Archer returned through Battle Hall to the profile with Level 1, XP 0/100, attributes 8/3/12/3/2/8, maximum HP 265, MP 62 and Last Bastion unchanged. No character build or progression was modified. Browser diagnostics returned extension metadata errors, not application-origin warnings/errors. Production error/fatal logs for this release were empty during 2026-09-13 01:12:27.249–01:27:27.249 UTC.
- During final evidence recording, concurrent artwork commit `15f672b663f02b12b69d75ef813f6eda6f607fc3` followed this release and independently reached READY as `dpl_wYXNa2qb72VrikDjuVW1NgLyKEVT`; alias inspection resolved to that descendant. Its four media/presentation files and subsequent formatting through `999ac2c6740d8ac2ceaf1b432f73b6d5508445ba` are preserved unchanged. This correction's exact-head test evidence does not certify that separate artwork change. The release-evidence branch fast-forwarded to current main before editing only this ledger and deployment configuration. Follow-up error/fatal logs on the artwork deployment showed one `PERSISTENCE_UNAVAILABLE` 503 at 01:26 UTC on a different battle's events request; the cause is unestablished and the layout smoke completed successfully.
- This documentation/configuration closeout restores `deploymentEnabled: {"**": false}`. Human tactical, media and layout acceptance remains open for the Owner's testing.

## Profile and combat layout adaptation — 2026-09-12

Owner requested adapting abstract layout ideas from two browser-RPG references, preserving the static header/footer, improving typography/spacing and releasing live for testing. The profile now separates character identity/progression, the central character sheet, and navigation/loadout controls. A later combat reference adds a compact AP/timer group, a compact command deck, a filtered action-icon timeline with click-through recorded action details and an optional text log below it, and combatant status panels with benefits, drawbacks and conditional modifiers. Changes live in the shared PvE/PvP presentation and reuse authoritative snapshots and status definitions. The desktop log opens by default and remembers collapse state; mobile keeps its touch composition. Existing server data, management dialogs, Atlas, combat rules and progression remain authoritative and unchanged. Responsive rules use available panel width and retain scrolling where needed. No third-party artwork or new dependencies are introduced. Browser review caught and corrected legacy floating-log positioning and short-viewport clipping on nonstandard map sizes. The shared playable/spectator board now fits the available viewport while preserving tactical dimensions and the existing size ceiling. Action-detail keyboard focus is isolated from combat shortcuts. The command deck and history span the battle area so the latest effect tags wrap into fewer rows; the status and timeline typography uses the existing body-font token. PR #460 passed all eleven CI workflows and merged at `ce8734c9`. Before deployment, the Owner requested more prominent and consistent cockpit artwork. The shared PvE/PvP cards now reserve a 64–88px desktop artwork frame (52px on phones), with names/AP alongside and readable effect tags beneath it. The Owner also reported a first-Space flash of the legacy directional pad. That pad now remains hidden from the initial render; the shared map-facing guides and existing authoritative commit handlers are retained, with transition visibility and two-Space regression coverage. PR #462 passed all five applicable CI workflows and merged at `3bdd775338866c20e43aa7267e82b98e02596058`. The Owner-authorized release is live and verified.

Release evidence:

- PR #460 passed all eleven CI workflows at `db2ced4a61b9ce48cc3b0e58f1048edd7ef09cb5`. PR #462 passed all five applicable workflows at final head `7e2571ca0df6b91eb544689c716af7126ccac0b0`; its merged tree exactly matched tested tree `f1bee4b867662bf0bf147b678be51c26298116cb`.
- The final local `pnpm check` passed lint, typechecking, formatting, tests and production build. Browser smoke run `34722216933` / job `103630070988` passed 133 Chromium scenarios and four Edge scenarios, including first-Space pad visibility, map-facing guides, second-Space commit, artwork sizing and text separation. Final desktop/laptop screenshots were visually reviewed; responsive coverage includes mobile and a wide viewport corresponding to the reference's 80%-zoom space, without claiming a real browser-zoom test.
- Production application commit `173d738571469bdfa2b9c018bf878400e448923f` reached READY as deployment `dpl_EFkjha6bCg9pZezboYrpEc4LFS2v`; `aurevane.vercel.app` was confirmed on that exact deployment. Build logs reported successful completion.
- Authenticated live checks at 1363×936 verified the profile, Maximum HP details, existing technique management, Battle Hall navigation and AI Sparring. Static header/footer geometry matched the prior release exactly, and there was no horizontal document overflow.
- A live Fortress cast spent 30 AP and displayed Fortified with two turns remaining, green Damage received −30% and red Damage dealt −20%. First Space kept the legacy pad hidden with zero layout rectangles while displaying four map-facing guides; second Space committed facing. Timeline filters and the optional text log worked. Clicked details showed the recorded Fortress result and a Recruit attack with eight damage, 257 HP remaining and 69% hit chance. Space inside the details dialog preserved AP and kept the dialog open; Escape closed it.
- The practice battle was surrendered through its confirmation and Archer returned to the profile with the same Level 1, XP 0/100, attributes 8/3/12/3/2/8, maximum HP 265, MP 62, Last Bastion Essence and four selected techniques. No character build or progression was changed.
- The live application console review found no application warnings/errors during verification. Vercel production warning/error logs for this deployment were empty for 2026-09-12 22:25:53.490–22:35:53.490 UTC.
- The deployment lock is restored by this documentation/configuration commit (`deploymentEnabled: {"**": false}`). No application code changes follow the verified release. Human Phase-4 tactical/media acceptance remains open.

**Final-testing release — 2026-09-12:** PR #461 is merged and live with battle button/picker tags from committed Skill versions, full current/historical execution contracts, four effect-badge repairs and safe Profile recovery diagnostics. All ten applicable CI workflows passed; live Fortress casting, reload, saved effect expiry and return to the unchanged Profile were verified. See `docs/PHASE_4_FINAL_TEST_READINESS.md` for exact evidence, the isolated recovered turn-clock 503 with unestablished cause, and the remaining A03/A04/A07/A10 human gates.

## Prior Phase 4 release — PR #459

Owner authorized full Phase 4 implementation and release. PR #459 is merged, deployed and activated with typed gameplay tags, Frozen/Steam terrain, shared targeting, the AI Sparring Arena picker fix and the Profile Discipline Atlas/Mastery extension. All fifteen exact-head CI workflows and authenticated live interaction checks passed. See `docs/PHASE_4_TICKETS.md` for actual evidence and the recovered Profile interruption. The deployment lock is restored by this documentation/configuration commit. Human tactical/media acceptance remains open.

This file reports the **current implementation/validation boundary**.

`docs/GAME_MASTER_PLAN.md` defines the product. `docs/ROADMAP.md` defines phase sequence. Canonical domain documents define system rules. `docs/PHASE_3_TICKETS.md` defines the Phase-3 implementation contract. `docs/ROADMAP_PRODUCT_VALIDATION.md` defines PV-2 evidence requirements.

**Reconciled:** 2026-09-13

**Phase-4 completeness audit:** See `docs/PHASE_4_COMPLETENESS_AUDIT.md` for current coverage and historical checkpoints. PR #455 released Chronist as the seventeenth Discipline, preserved Tidecaller, integrated Ironfist media, and placed the 36-identity Atlas inside Discipline Management. Its Representative Buildcraft gate included a real earned-Mastery UI claim. Those results validate the prior release only.

**2026-09-12 completed continuation:** PR #459 releases typed gameplay tags, Frozen/Steam terrain, twenty appended Skill versions, shared ground targeting, readable combat feedback, Arena picker styling and Atlas filtering/accessibility. Staged database activation followed compatible application READY. Repository, final review, database-concurrency, browser, exact-head CI and live checks passed; independent human tactical/media acceptance remains open.

---

## Current status

**Stage:** Phase 4 — First Playable Buildcraft Roster — **PLAYABLE IMPLEMENTATION LIVE; HUMAN ACCEPTANCE OPEN**. Phase 3 is closed by Owner decision; see `docs/PHASE_3_CLOSEOUT.md`.

**Phase 2:** CLOSED on 2026-09-02 by explicit Owner decision after the final production regression test. PV-1 is reconciled as completed by that Owner phase-exit decision; do not invent additional human evidence.

**Phase 3 implementation:** P3.1 through P3.8 are merged to `main` and deployed on the existing no-cost Supabase/Vercel stack.

**Phase 4:** **ACTIVATED** by explicit Owner request for full implementation and final production deployment. See `docs/PHASE_4_TICKETS.md`.

**Phase-3 closeout:** PR #445 passed its release checks and was released as `9da6c4684f99b0617cdccab019a38f90f56795b0`; the recorded Owner closeout decision is preserved. Production READY is not independent human/product evidence.

**Presentation follow-up:** PR #446 merged while this audit was in progress and was released at `0df098e8`; preserve its desktop/mobile changes and assess its exact release interaction evidence.

**Current implementation:** the full approved Phase-4 engineering scope through PR #459 is live for testing, preserving the earlier roster, media, self-target cockpit and earned Mastery.

**Live baseline:** 17 Disciplines, 136 regular Skills, 17 Essences, 136 unordered Resonance pairs and the 36-identity Atlas. PR #465's portrait meters, equal command/history panels, rich text log and preview alignment polish is live as `26ba6a240f42b51aab30824c7c3f2a1143f0de5f` / `dpl_9SQWsZSLcQmuY2YfZ91SDWN9iafe`, preserving PR #464's stable map and Discipline forecasts and the earlier artwork release. All four exact-candidate workflows and authenticated practice checks passed; the production alias was verified on that SHA. See the release evidence at the top for scope, browser/clipboard limits and the restored deployment lock. `docs/PHASE_4_FINAL_TEST_READINESS.md` records the preceding phase baseline and remaining human gates. Earlier milestone notes below are historical.

---

## Phase-3 production baseline

Runtime/test-access closeout:

- P3.1–P3.8 implementation merged through `main` commit `76446155d69ae283c8be1ba3f5525a0bf381b8cb`;
- Owner-only production PV-2 access merged at `abb7ae3cc50b4bc67efa8c9abc04251abdc02be7`;
- Vercel production deployment for `abb7ae3cc50b4bc67efa8c9abc04251abdc02be7` reached `READY`;
- production alias verified at `https://aurevane.vercel.app`;
- live Supabase Phase-3 migrations are applied through the private PV-2 tester allowlist migration;
- all 10 pre-existing characters were backfilled with authoritative active-build rows during Phase-3 migration preparation;
- the private PV-2 allowlist contains exactly one enabled Owner tester account;
- browser roles cannot read/write the allowlist table or execute its privileged lookup RPC directly;
- the PV-2 preparation route re-checks server authorization and selected-character ownership before granting representative test facts.

No paid Supabase branch or paid Vercel resource was created.

---

## Phase-3 delivered buildcraft platform

Phase 3 now provides:

- authoritative versioned Primary Discipline build state and base profiles;
- separately owned player-assigned attributes preserved across Primary changes;
- optional mastered Secondary Discipline;
- independent server-owned Primary/Secondary attunement cooldowns;
- mature versioned Discipline Skill definitions;
- generic server-authoritative owner-turn cooldown engine;
- persistent learned/equipped Discipline Skill authority;
- pure capacity: up to 4 selected Discipline Techniques + Essence outside the cap;
- mixed capacity: up to 4 selected Techniques + Resonance; full splits 1+3, 2+2 or 3+1;
- Profile as the persistent build headquarters;
- first representative Resonance framework and mixed build;
- first representative Essence framework and pure build;
- immutable committed build snapshots shared by Recruit AI and direct PvP;
- battle snapshot persistence across reconnect/Profile changes;
- saved-loadout authority with atomic activation, legality checks, idempotency and attunement protection;
- eight-Skill libraries for Vanguard, Lifebinder, Aetherist, Farstrider and Shadehand, five Essences and ten unordered pair Resonances; Ironfist remains an incomplete sixth Foundation;
- owner-only production preparation path for the representative PV-2 character facts.

The existing Phase-2 tactical battle/PvP/spectator platform remains the execution foundation; Phase 3 did not fork a parallel combat rule path.

---

## Automated closeout evidence

The final Owner-access candidate passed the focused Phase-3 preservation gates:

- Representative Buildcraft — **PASS**;
- Discipline Build DB — **PASS**;
- Foundation Security DB — **PASS**;
- Battle Session DB — **PASS**;
- Wayfarer's Practice DB — **PASS**;
- Profile Skill Build — **PASS**;
- Resonance Build — **PASS**;
- Essence Build — **PASS**.

The historical initial P3.8 proof below predates the September four-Technique revision; preserve it only as historical evidence. Current tests must use four selected Techniques and consecutive-use falloff. That original proof exercised:

- PV-2 test preparation;
- pure Vanguard `8 / 8` Skill configuration with active Essence;
- committed pure loadout persistence;
- Vanguard + Lifebinder Secondary preview/commit;
- mixed `6 / 6` configuration;
- active `Mercy's Edge` Resonance;
- Essence removal while Secondary is active;
- committed mixed loadout persistence.

The historical aggregate formatting failures and Browser Smoke fitting issues above are no longer the current baseline: PR #444 passed all 11 triggered workflows before deployment. The final UI release must pass its own applicable checks. Preserve the regression guards; do not suppress failures to close the phase.

Automated correctness is **not** a PV-2 PASS.

---

## Owner PV-2 handoff

Use `docs/PV2_OWNER_TEST_RUNBOOK.md` and the live site:

`https://aurevane.vercel.app`

The Owner test should answer the product questions defined in `docs/ROADMAP_PRODUCT_VALIDATION.md`, especially whether the representative build system creates understandable, curiosity-driven experimentation around:

- Primary versus Secondary;
- Primary base-profile consequences;
- pure four selected Techniques + Essence versus mixed four selected Techniques + Resonance;
- Skill sources/AP/consecutive-use falloff;
- meaningful tactical changes between builds;
- build-configuration friction and recovery from poor experiments;
- mandatory, pointless, redundant or unreadable combinations.

Do not fabricate tester counts, ratings, direct-PvP human evidence or a PASS decision. Record only what the Owner actually tests/reports.

---

## Phase-3 / Phase-4 boundary

Phase 3 has reached its implementation gate from `docs/PHASE_3_TICKETS.md`. On 2026-09-11 the Owner approved closure after the final requested fixes and quality work, while explicitly reserving the command to start Phase 4.

The current transition is:

```text
Verified final UI/quality release
  → Phase 3 closed by Owner decision
  → wait for separate explicit Owner command to start Phase 4
```

Do not start broad roster production, large Resonance matrices, Soulmark/Mantle runtime, frontier systems or other later-phase expansion during this closeout. Owner closure is not independent cohort evidence or a Phase-4 start instruction.

---

## Permanent execution rules

1. Inspect current `main`, roadmap, canonical specs and validation state before implementation.
2. One canonical implementation ticket is active at a time unless the Owner authorizes a wider verified batch.
3. Automated tests prove implementation safety, not fun/product validation.
4. Phase activation and deployment authorization are separate decisions.
5. All authoritative build, combat, progression, reward, inventory, PvP and persistence state remains server-owned.
6. Never silently redesign/remove mechanics or weaken authority/security to simplify implementation.
7. Keep temporary validation/support access bounded, auditable and fail-closed.
8. Keep this ledger current and concise.

## Phase 4 media continuation — historical candidate preparation

Branch `agent/phase4-media-candidates` prepares ten painted identity masters, 72 original synthesized cues, provenance, bounded central audio audition and an offline review gallery. `docs/PHASE_4_PLAYTEST_PACKET.md` provides actual-session scenarios and an empty results template. Automated media/runtime checks are recorded with the candidate pack. Browser walkthrough of the local review file was blocked by the browser URL policy and is not claimed. Human art/listening acceptance remains required by `docs/MEDIA_PIPELINE.md`; live assets and gameplay rules are unchanged.

## Phase 4 media integration continuation

PR #453 merged the candidate work at `f67cd8c3`; CI, Skill Engine and Browser Smoke passed. Branch `agent/phase4-media-integration` connects the Owner-authorized testing release of ten identity paintings and 72 synthesized cues. The shared committed-event path preserves authorization, gesture/mute settings and no-replay behavior. PR #454 merged at `f756d92d` with the exact tested tree unchanged. All six workflows passed on `d1dee5e9`; local `pnpm check` passed 1,016 Vitest tests, six Node report tests, lint/typecheck/formatting and production build. Release `4ec4036c` is READY at https://aurevane.vercel.app. Live artwork and Fortress preview/commit were verified, production error/fatal logs were empty, and the practice character returned to the Battle Hall. This commit restores the deployment lock and records detailed evidence in `docs/PHASE_4_TICKETS.md`. Independent human media/balance acceptance remains outstanding.

## Audit implementation — 2026-09-12

Owner instruction: “Take what ever authorizations you need and implement.” This authorizes the implementation and its GitHub, database and production release steps. It does not fabricate human playtest results or final media acceptance.

- Chronist is added alongside Tidecaller: 17 Disciplines, 136 regular Skills, 17 Essences and 136 unordered pairs. During development testing, the separate testing entitlement makes every published Discipline immediately available without creating Mastery. With testing closed, Chronist requires Rekindling I plus Aetherist Adept; its eight Skills then follow normal 4/2/2 acquisition.
- Chronist schedules bounded Initiative changes for the next round (+20 Haste, -20 Delay, +40 Borrowed Hour, combined ±40). Each round remains a frozen order, each living unit receives one turn, and the next boundary restores base Initiative unless another effect was prepared. Lethal outgoing periodic damage excludes the defeated unit before the next turn is selected. No extra AP, extra turns or battle resets.
- Rewind Step returns only to the current turn's recorded starting tile. Root, blocked/occupied destinations and an unchanged position make it illegal. It never refunds resources, movement, health or prior commands. Origins and round schedules survive authoritative snapshot reloads.
- Normal player and AI Skill preview/commit now resolve the Resonance frozen in the committed build. The old isolated helper was tested but had not been wired into normal runtime. Setup persists through movement/end turn, the next authored Skill consumes or expires it, and the payoff is shown in previews without mutating state. Duplicate application through the older wrapper is prevented.
- Advanced AI now compares authored Skill scores on the same difficulty scale as basic actions, and values reachable Resonance setup/payoff. Tests exercise every advanced committed library, legal costs, unchanged input state and a reloaded mixed payoff.
- The complete recovered Ironfist media commit is retained. Chronist adds one generated painting at three runtime sizes plus three action and three Essence cues; exact originals, prompts, synthesis settings, hashes and testing-release manifests are retained. Human listening/visual acceptance remains open.
- Representative Buildcraft triggers cover advanced combat content, Mastery routes/service, migrations, media routing and verification scripts. Its focused suites now include temporal mechanics, the advanced effect matrix and actual AI choices. Database coverage adds Chronist's prerequisite, four/six/eight acquisition and all sixteen pairs. Browser coverage adds Chronist presentation and retains Ironfist silent-preview/committed-audio checks.

Validation and deployment results are recorded below when completed. Historical counts and release records earlier in this document refer to their original sixteen-Discipline snapshots.

Release checkpoint: local `pnpm check` passed (1,095 tests including the six report tests). Automatic review blocked publishing to public `ZeiJM/Aurevane`; explicit destination approval is required. See `docs/PHASE_4_TICKETS.md` for remaining CI, earned-Mastery UI and coordinated migration/deployment steps. No live-release completion is claimed.


## Combat effect overhaul — intermediate movement/recovery checkpoint

- [x] Variable Push/Pull runtime and diagonal/collision safety, with Displaced only on successful movement.
- [x] Haste/Slow movement AP and shared per-tile minimum-cost calculation; Movement allowance unchanged.
- [x] Heal X / MP Rec X scheduled-recovery runtime, validation, preview parity, persistence-shaped state and defeat cleanup.
- [x] Connect compact tag vocabulary to shared Skill/status presentation; update displacement and recovery descriptions.
- [x] Publish rebalanced immutable Discipline Skill versions and retire current legacy applications — PR #552 exact head `2220b5d1e8d5b71472374bded8c2ca49ad4d81dc` passed all 15 PR workflows and merged to the combat integration branch as `56bba54a494e272152de2e672e043da707bfbe22`; all five applicable post-merge push workflows passed. The activation migration remains staged and has not been executed against Production.
- [x] New Poison/Bleed/Burn runtime identities plus the landed K4 Absorb HP/MP, Reflect, Vengeance and generalized Skill-accuracy kernel slices are implemented and verified at their current engine boundaries.
- [x] Amplify/Curse integration covers authoritative status-copy legality/commit/provenance, typed Poison/Burn/Bleed cloning, Recruit AI forecast utility and player-facing clone forecasts.
- [x] Implement the separate `Copy` mechanic that grants a random eligible regular battle Skill for the remainder of battle at half AP cost, including encounter state/RNG, UI, AI and persistence integration.
- [x] Implement Covert/Sensory/Revealed at their approved authority and presentation boundaries.
- [x] Ship the real protected Master Panel Combat Content editor with typed validation, diff/preview and immutable publication; do not substitute hard-coded source edits or speculative UI.
- [x] Resolve the Owner rule for consecutive-use Amplify/Curse clone transfer — clone transfer is discrete and omitted on a consecutive repeat; later effects retain their normal repeat scaling, pure clone repeats are full-cost no-ops, and the former `effects.status-copy-staged` publication guard is retired. This does not by itself publish or deploy a specific clone Skill.
- [ ] Owner/human end-to-end acceptance and explicit release decision. Automated exact-head browser, database and repository gates are green through PR #552, but automation does not supply A03/A04/A07/A10 human evidence. No Production deployment or Task 10 activation is included in this checkpoint.
