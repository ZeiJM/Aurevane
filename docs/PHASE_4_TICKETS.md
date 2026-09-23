# Phase 4 — execution and acceptance ledger

**Post-release engineering integration — 2026-09-18:** Task 10 is closed at the combat-integration level through PR #552. Exact tested head `2220b5d1e8d5b71472374bded8c2ca49ad4d81dc` passed all 15 PR workflows, including Browser Smoke, Representative Buildcraft, Discipline Build DB and full CI, plus an isolated exact-head Phase-4 ground-targeting browser gate. It merged to `agent/final-ui-combat-integration-20260917` as `56bba54a494e272152de2e672e043da707bfbe22`; the merge tree is identical to the tested head, and all five applicable post-merge push workflows passed. The work appends one audited immutable current version for each of the 136 regular Discipline Skills, versions all 17 audited Essences to v2, migrates current tempo/recovery/DoT/Mark/accuracy semantics, and stages the transactional `phase4-discipline-rebalance-v1` activation. **No Production deployment, Production database mutation or Production activation RPC was performed.** The prior live testing release below remains the Production state. PR #555 resolves the Amplify/Curse consecutive-use rule by treating clone transfer as discrete, retires the former publication-stage guard while preserving canonical validation, and does not itself publish or deploy a specific clone Skill. A03/A04/A07/A10 human acceptance remains open.

**Live testing release — 2026-09-12:** PR #461 is merged and released at https://aurevane.vercel.app. It adds visible battle button/picker effect tags, current/historical execution contracts, four effect-badge repairs and Profile recovery diagnostics on top of PR #459. All ten applicable CI workflows passed, production is READY, and live casting/reload checks passed. See `PHASE_4_FINAL_TEST_READINESS.md` for exact evidence and the isolated recovered turn-clock 503 whose underlying cause remains unestablished. Independent human tactical, visual and listening acceptance remains open.

Owner activation: explicit request for full implementation, necessary approvals, and final production deployment; followed by confirmation that Skill targeting/effect tags belong in this work. This supersedes the earlier waiting-for-start notes. It does not manufacture human playtest evidence.

### A03 — full roster rebalance redo — COMPLETE

The Owner reopened A03 on 2026-09-22 because the prior Discipline rebalance did not constitute a complete class-wide balance pass and approved the replacement design. Draft PR #605 implements the systemic pass against the Level-100 combat model: combat stat bridge/rules v4 carries Critical Chance, eligible direct Criticals are 150% with one result per successfully hit target per command, ordinary current Skill/Essence Power scaling is AP-weighted at 50 basis points per AP, Basic Attack is normalized to a 15% Physical Power coefficient at 30 AP, and current static mystic Skill/Essence MP costs use `max(2, floor(AP / 15))`.

The deterministic Balance Harness covers all 17 published Disciplines at Levels 25/50/100 with balanced/offensive representative allocations and keeps damage, positional/attrition pressure, combined setup/payoff cost, healing, protection, control, range/area, MP, Essence and Resonance dimensions separate. It deliberately does not manufacture a single class power score. Systemic correction removed the need for a blanket per-class number rewrite; the evidence-backed authored potency correction is Edgedancer Sevenfold Cut v3 (seven base-4 packets, with historical v2 retained at seven base-3 packets).

New battle authority also re-resolves the current pure Essence before freezing a new battle snapshot, matching the existing current-Skill pinning behavior while leaving character source snapshots and existing/frozen battles unchanged.

Exact-head verification completed on `ef930767c398dc23882cd79b5b746092ae5be749`. All eight PR workflows passed: Browser smoke, Representative Buildcraft, Discipline Build DB, Skill Engine, Essence Build, Resonance Build, Shared Build Snapshots and full CI. The full CI quality and database-foundation jobs passed, Browser Smoke saved its browser evidence, and the PR remained draft/unmerged during verification. No Production deployment or Production database mutation was performed as part of this A03 closeout.

A04 human build/pair differentiation, A07 independent media acceptance, and A10 Owner Phase acceptance remain open.


## Owner-approved Phase 4 operations extension — 2026-09-19

The Owner explicitly corrected the phase boundary on 2026-09-19: staff/event operations infrastructure belongs to **Phase 4**, and **Phase 5 has not started**. Historical branch names, migration filenames and merged PR titles that contain `phase5` / `Phase 5` remain unchanged where renaming would damage Git/database traceability; they are historical identifiers only and no longer define roadmap ownership.

### P4.11 — Staff authority foundation — COMPLETE

- [x] Exactly four canonical authority classes: Game Owner, Moderator, Content Staff, Event Staff.
- [x] Multiple delegated roles per account without inventing additional role classes.
- [x] Protected Game Owner identity; ordinary controls cannot create/remove Owner or self-elevate.
- [x] Server-side/service-only authorization with monotonic access versions and durable audit history.
- [x] Legacy `owner | content-staff` operator migration without breaking Combat Content.
- [x] Protected `/master/staff` Owner surface, exact-email lookup, WORLDWRIGHT presentation and explicit special-capability grants.
- [x] Role/capability escalation, final-role, root-capability, browser/direct-table and audit/versioning database invariants.

P4.11 is the previously implemented staff-authority work from PRs #557/#559, reclassified by Owner decision. It is not evidence that Phase 5 started.

### P4.12 — Persistent event operations kernel — COMPLETE

- [x] Versioned immutable Event Template / Event Definition.
- [x] Event Run / Phase / Objective state pinned to one immutable definition version.
- [x] Explicit global / region / node / cohort scope.
- [x] Authoritative lifecycle clock, optimistic state versioning and restart recovery.
- [x] Typed Event Effect references only; no arbitrary scripts or SQL.
- [x] Serialized/idempotent lifecycle transitions with direct service-role mutation/receipt forgery blocked.
- [x] Participant ledger with idempotent contribution provenance, source deduplication and run-scoped claim reservation.
- [x] Immutable Reward Package execution through the existing authoritative Character XP service, with approved XP budgets and idempotent execution receipts.
- [x] Terminal cleanup obligations, archive blocking and pre-start cancellation isolation.

Contribution authority requires a Production run that is live, the run's exact current phase to have a `live` phase row, and an active objective in that phase. Duplicate delivery and source provenance are deduplicated server-side. Claim reservation alone does not mint rewards.

P4.12 is integrated through PRs #564, #566 and #567, with later hardening carried by P4.13/P4.14. The persistent kernel, participant ledger, reward execution and cleanup boundaries all pass on the integrated Phase-4 stack.

### P4.13 — Event Builder MVP — COMPLETE

- [x] Protected `/master/events` Event Staff draft / validate / preview / publish workflow.
- [x] Private optimistic drafts and immutable published definition history.
- [x] Structured phase/objective composition and typed active/cleanup Effect references.
- [x] Reward Package and aftermath references with dependency validation.
- [x] Schedule / unschedule with scope/time overlap serialization and conflict rejection.
- [x] Preview-only test clock / phase selection that creates no Production Event state.
- [x] Production publication requires `events.production_publish`; global publication/scheduling additionally requires `events.global_scope`.
- [x] Recursive arbitrary script/SQL fields are rejected; there is no arbitrary code/SQL editor.
- [x] Permanent canon/world mutation is not authorable in the MVP.

PR #569 exact head `f9f0ced6b1b7131350789198d2c4c618a2b68d6b` passed all eight PR workflows and merged to the Phase-4 integration branch as `681d0e7fd65b3bce2f7e4dfb840f5156f5b6a3dc`. All five applicable post-merge push workflows passed.

### P4.14 — Live event operations — COMPLETE

- [x] Protected `/master/events/live` authoritative Event Run dashboard.
- [x] Participant/contribution, phase/objective, reward-claim, active-effect and cleanup visibility.
- [x] Start due run, pause, resume, graceful stop/resolve, end, archive and manual phase advance with optimistic versions and idempotency receipts.
- [x] Emergency stop requires the explicit `events.emergency_stop` capability.
- [x] Sensitive operations require an explicit reason and fresh confirmation.
- [x] Typed cleanup completion uses immutable receipts; archive remains blocked until pinned cleanup is complete.
- [x] Immutable archived Chronicle snapshot and durable staff operation history.
- [x] Browser roles cannot call database Event operations authority directly; service role cannot forge operations history directly.
- [x] Bounded restart recovery starts due runs, advances authored automatic transitions, cancels missed windows and moves expired live windows toward resolving.
- [x] Supabase `pg_cron` configuration exists as a release-only helper; the migration does not enable the Production job automatically.

PR #570 exact head `072c8cc779c26063747994e13fab7fe541ea5e30` passed all eight PR workflows and merged to the Phase-4 integration branch as `8239cc2e2bc004c1db2956e26ad32f91c53cf7cc`. All five applicable post-merge push workflows passed.

### Phase 4 extension gate — TECHNICALLY COMPLETE

The P4.11–P4.14 Operations Extension is technically complete and verified on the dedicated Phase-4 integration branch: authorized staff can define and operate a persistent multi-phase Event without routine code deployment; contribution/claim boundaries are authoritative and idempotent; rewards execute only through approved services; restart recovery works; live operations are audited; and cleanup/Chronicle/archive invariants fail closed.

This technical gate does **not** authorize Production deployment, Production Supabase mutation, Event recovery `pg_cron` activation, or the staged Discipline rebalance. Existing human Phase-4 acceptance items including A03/A04/A07/A10 remain separate.

**Phase 5 remains NOT STARTED.** Moving into player-facing Phase 5 requires a new explicit Owner authorization. This extension does not implement Phase 5's living-world content, strategic Atlas, settlements/NPCs/quests, supernatural fork, or frontier threshold.

## Previous combat completeness release — PR #459

PR [#459](https://github.com/ZeiJM/Aurevane/pull/459) merged as `f7369a23d745fef9fe6242eb391082f5c2dab0f0`. Its verified head `4ac18af9f8b1831552b27f38a4cd2a3cd5766d6b` and merge share tree `c2ae2239ab9f130890f28983b7c406248fb0e1bc`. All fifteen exact-head CI workflows passed. Whole-branch review and subsequent bounded corrections are approved. The only application release delta was the temporary main deployment switch; the final documentation/configuration commit restores `deploymentEnabled: { "**": false }`.

- The integrated `pnpm check` passed formatting, lint, types, tests and production build: 918 core, 315 web Vitest cases, existing web Node tests and 59 other package tests. Subsequent bounded changes passed their covering checks and final exact-head CI.
- [Representative Buildcraft 34707419058](https://github.com/ZeiJM/Aurevane/actions/runs/34707419058): 612 focused core and 65 focused web tests; actual publication/save concurrency, parent-row busy/retry, caller denial, replay, frozen/saved/future provisioning; **24 browser passes, six existing viewport skips**. All six responsive Atlas cases and six PvE/PvP ground-targeting cases, including three native spectator inspections, passed. Final screenshot artifact: `10302640885`. Desktop/laptop/phone spectator Inspect text and the laptop Arena picker were visually reviewed.
- [Browser smoke 34707419106](https://github.com/ZeiJM/Aurevane/actions/runs/34707419106): **133 Chromium passes, 98 existing skips, four Edge passes**. Both desktop layout workflows and all database/security workflows passed. No new required assertion was skipped or replaced with a fabricated response.
- Supabase Git integration applied `20260912133206_phase4_combat_publication_staged.sql` and `20260912165224_spectator_participant_title_read.sql`; all **79** hosted migration version/name pairs match Git. The latter grants service-role access to only the existing participant `id`/`personal_title` projection; browser-role permissions remain unchanged.
- Production [AUREVANE](https://aurevane.vercel.app) is READY on deployment `dpl_Hr4ShGPgWjZQ98D4nXbVRLAnmS2v`, application commit `a4a06d01e64e59ee8819353fd874bea4b92aa1db`. Compatible application source and the healthy authenticated Profile were verified before content activation.
- Service-role activation of `phase4-combat-interactions-v2` completed at **2026-09-12T17:30:11.705295+00:00**, updating seven unlocks and one build. A second identical call returned `replayed: true` with the same receipt. Twenty release Skill v2 references are active (21 total including the pre-existing Vanguard version), while the roster remains 136 regular Skills. At activation, all 176 progress rows and six earned-Mastery rows retained their exact fingerprints, as did three sampled terminal battle histories. No historical battle rewrite or testing-to-earned-XP conversion occurred.
- Live Profile → Discipline Management → Atlas passed whitespace/case-insensitive Frostweaver search, the **17 of 36** published filter, current trial/testing/planned guidance, ratings and Escape/focus restoration. The live AI Sparring Arena control was visually checked: readable label above the dark picker, helper text below, consistent border/chevron and spacing.
- Live Standard AI practice `ce9ed6a7-9d0e-4111-8ed1-655bf40c2cd8` on Crossroads Court committed Chilling Mist and Flame Burst to an empty tile. Stored snapshots prove **100 → 55 → 10 AP**, five Frozen tiles becoming five Steam tiles, and fire MP **136 → 133**. All four selected Skill references remained v2 in the frozen build. Steam survived reload with normal round expiry and visible LoS/Inspect feedback. The battle was surrendered; ordinary practice granted no character/Mastery XP. The original pure Bastion build, Challenge/Cover/Fortress/Shield Bash, Last Bastion, original attributes and Level 1 / 0 XP were restored and verified through the UI, reload and read-only build queries.
- One final Profile reload displayed the service-recovery surface. Retry and character reselection recovered it; a subsequent reload passed with the restored four-Skill build. The cause was not established. Production warning/error/fatal log queries returned no entries during this check. This isolated recovered interruption is recorded, not presented as a reproduced or fixed source defect.

Two reviewed rulings remain explicit: a primary-unit Resonance payoff needs a unit-targeted Skill; ground casts preserve armed setup and empty ground cannot farm actor rewards. The cost is that ground-heavy mixed builds may need a unit Skill to cash in. Perfect Opening retains its authored **22,000 (2.2×)** rear-facing Skill ceiling; basic/combined conditional **20,000** caps remain unchanged. Its cost is continuing human balance review of that 2.2× payoff.

All approved Phase-4 engineering implementation is live for testing, including typed battle tags, ground targeting and the Profile Atlas/Mastery extension. Scope is **17 published combat libraries / 36 Atlas identities**; the other 19 are planned, not playable libraries. A03 balance, A04 human pair differentiation, A07 human visual/listening acceptance and A10 Owner phase acceptance remain open. Full world acquisition/Rites, equipment catalogs, later roster expansion and production presentation retain their later roadmap ownership. Automated release evidence is not independent multi-tester PV-2 acceptance.

## Staged contract

1. **P4.1 — inherited roster acceptance.** Audit the five existing libraries, shared four-selection authority, exclusive Essence/Resonance, unordered pair direction, reachable setup/payoff tags, AI legality and media relationships. Reuse existing immutable AI/PvP snapshots, progression, attunement and saved-loadout authority.
2. **P4.2 — sixth Foundation.** Complete Ironfist with eight distinct regular Skills, Hundredfold Rush Essence, five pair Resonances, additive database provisioning and preserved active battle snapshots. No entitlement/mastery bypass is added.
3. **P4.3 — readable Skill information.** Show target kind/shape and effect tags; expandable authoritative range, line of sight, elevation, affected-team policy, AP overrides, ordered effects and requirements. Preserve compact typography, favorite controls, mobile/desktop parity and four selections.
4. **P4.4 — representative maps.** Preserve Basic Training Floor and Duel Yard. Add Crossroads Court and Terraced Yard for AI Sparring; retain the already-delivered PvP medium/large map generator and terrain/elevation controls. Verify base-mobility routes, provenance, retry/replay and rendered board fit.
5. **P4.5 — roster expansion review.** Assess six complete Foundations before authoring 6–8, 12 and 16. Record interaction defects, actual matchup/AI coverage, acquisition, equipment and media work. Authored count and automated tests do not establish human tactical quality.
6. **P4.6 — release.** Run repository quality checks, database and authenticated browser gates, refresh main and reconcile concurrent work, apply the exact migration, release the verified commit, restore the deployment lock, inspect production and state all verification limits.

## Current implementation boundary

PR #459 preserves the seventeen-Discipline Atlas/Chronist/Ironfist release and closes the confirmed §18 gameplay tag/terrain and shared ground-target UI gaps. The Atlas remains within Profile → Discipline Management. See `PHASE_4_COMPLETENESS_AUDIT.md` for the requirement-to-code ledger; the earlier sixteen-Discipline text below describes historical milestones.

The sixteen-Discipline playable baseline is live through PR #451, the self-target correction through #452, and ten painted identities plus 72 synthesized cue variants through #454. Phase 4 now also owns the approved 36-identity Discipline Atlas/Mastery extension in `ROADMAP_DISCIPLINE_ATLAS_MASTERY.md`: published content may continue expanding during testing, while planned identities remain non-selectable until their authoritative combat libraries exist. Independent human visual/listening and tactical acceptance remains open. Earlier milestone evidence below is historical.

## Owner continuation — descriptive effects and full implementation

The Owner reaffirmed full Phase-4 implementation after the six-Foundation release. Add conditional increases/decreases to damage dealt and damage taken, and a sparse set of strong benefit/drawback Skills. Effects need short names that describe their actual behavior; target conditions, magnitude, duration and affected recipient belong in expanded details and battle previews. Do not present a status on the user as if it affects the enemy.

Implementation proceeds through Bastion/Ravager (eight total), Edgedancer/Wildwarden/Runeblade/Dawnshield (twelve), then Cinderweaver/Frostweaver/Stormsinger/Tidecaller (sixteen). These are existing Master Plan identities, not new invented Disciplines. Their prerequisites remain the authored Mastery requirements. Character creation retains the original six Foundation choices.

Damage modifiers must resolve for each actual attacker/recipient pair. Linked benefit/drawback statuses keep both parts together under application, expiry and removal. New percentage modifiers have explicit caps and single-stack authoring; existing Guarded/Exposed rules remain compatible. Direct damage boosts and strong trade-offs require an explicit per-Skill justification and distribution audit, rather than becoming a default filler effect across the roster or all Resonances.

The typed effect extensions, complete libraries/signatures, Mastery Trials, current unarmed/armor/ward interactions, database/browser checks and live release are delivered. The painted identity and synthesized cue integration is now released; independent human media/balance acceptance remains open. Equipment catalogs and their active Skills retain their later roadmap integration.

## Roster acceptance matrix

| Discipline | Tactical decision | Counterplay | Library | Essence | Mixed pairs |
|---|---|---|---:|---|---:|
| Vanguard | Guard/setup versus direct melee pressure | Range and flank | 8 inherited | Unbroken Strike | 5 with Ironfist |
| Lifebinder | Spend AP supporting versus attacking | Pressure and separation | 8 inherited | Verdant Rupture | 5 with Ironfist |
| Aetherist | Single target versus line/area spell pressure | Spacing, sight and elevation | 8 inherited | Aether Nova | 5 with Ironfist |
| Farstrider | Maintain minimum range and firing lanes | Close distance and break sight | 8 inherited | Deadeye Barrage | 5 with Ironfist |
| Shadehand | Face/Expose setup versus immediate damage | Face the attacker and deny openings | 8 inherited | Perfect Opening | 5 with Ironfist |
| Ironfist | Defensive setup or exposed-target payoff at close range | Kite; deny setup; armor checks each rush hit | 8 released | Hundredfold Rush | 5 released |

The acquisition boundary is server-authoritative. During the active development-testing policy, every published Primary and Secondary is available without converting that temporary entitlement into earned Mastery. With testing closed, authored mastery/Rekindling requirements resume as the real gates. Planned/unpublished Disciplines remain unavailable in either mode. Final world/story acquisition routes beyond the implemented Mastery/Atlas foundation remain later work.

## Ironfist authored contract

| Skill | AP | Distinct role |
|---|---:|---|
| Rising Fist | 35 | 7 base damage and one Exposed stack to an adjacent enemy |
| Sweep | 45 | 7 base damage to enemies in radius 1 around an adjacent target |
| Focus Breath | 35 | Restore up to 7 HP and 5 MP to self |
| Counter Palm | 35 | 14 base damage; requires Guarded on self |
| Breakfall | 25 | One Guarded stack on self |
| Hammer Knuckle | 45 | 17 base damage; requires Exposed on the target |
| Pressure Palm | 45 | 7 base damage to the target and one Guarded stack on self |
| Last Stand | 40 | Restore up to 12 HP and one Guarded stack; requires at most 50% HP |
| Hundredfold Rush, Essence | 60 / 65 PvP | Three ordered 7-base-damage hits against an adjacent enemy |

All effects use existing server-owned primitives. Counter Palm is an active guarded-state payoff, not an automatic retaliation. Breakfall does not claim falling-damage immunity. Sweep does not claim knockdown or displacement. Momentum remains an early identity concept expressed here through alternating setup/payoff choices, not a newly invented meter or passive. Legacy positive cooldown schema metadata remains inert in the current shared repeat-use path. Repeated quantitative effects fall to 50%; discrete one-stack repeats are omitted; AP remains unchanged.

## Media and equipment boundary

Stable media hooks exist for every new Skill/signature. The existing class-colored vector icon renderer supplies distinct interim icons with the Ironfist amber palette. Dedicated production illustrations/audio remain explicit requests in `content/art-requests/ART-DISC-002.md`; they are not claimed delivered by these interim symbols. No new asset vendor, runtime dependency or browser authority is introduced.

The current unarmed battle platform supplies the equipment baseline. This ticket adds no weapon requirement that could silently block existing characters. Weapon/hands, load archetypes and equipment-Skill coverage must be proved when those catalogs are expanded; these are not inferred from unarmed tests.

## Required evidence

- Pure and mixed committed selection and immutable battle snapshot checks.
- All six libraries and fifteen pair definitions; both Primary directions; reachable setup/payoff.
- Ironfist legal execution and rejected prerequisites in both PvE/PvP; AP and repeat-use persistence.
- Normal Ironfist provisioning without a test kit; no duplicate learned facts; browser-role denial.
- Skill detail expansion does not toggle selection; persists four selected Skills after reload; phone/desktop overflow and screenshots.
- New arena creation, ground path at Jump 0, reflected terrain/spawns, provenance and rematch.
- Exact commit CI, database migration history, production deployment and interaction evidence.

Balance, broader human exploration and authoring throughput remain separate from deterministic correctness.

## Release evidence — 2026-09-11

PR #450 merged as `a9fa6e92f606e6ea9047be8159461dcf8876971a`. Its verified head `57dde60a96e9095059d70184d8b21ac61feb3dc7` passed all fifteen CI workflows. The merged tree matches that head exactly. Current-main mobile-polish PR #449 was incorporated before final validation.

- `pnpm check`: 586 Vitest unit/service tests and six Node report tests; formatting, lint, TypeScript and optimized production build pass. Coverage includes frozen pre-Phase-4 Ironfist snapshots, modern signature requirements, roster execution, both pair directions, AI legality and arena provenance.
- Representative Buildcraft run `34608070258`: normal Ironfist creation/provisioning, pure snapshot, idempotency and browser-role denial pass; five browser flows pass with four intentional viewport skips. Phase-4 Skill selection/reload and both new arenas pass on desktop, laptop and phone. Screenshots/traces: artifact `10267725636`.
- Browser smoke run `34608070148`: 117 Chromium tests pass, 93 intentional skips; four focused Microsoft Edge tests pass. Desktop experience and page-fit workflows also pass.
- Browser verification found and fixed open-dialog hydration mismatches, a Discipline-commit/Profile-refresh race and expanded Skill-card clipping. The tests check saved selections independently after reload and verify the default Duel Yard through the new selector.
- Supabase Git integration applied `20260911130317_phase4_ironfist_content.sql` with its committed identity. All 74 hosted version/name pairs match Git. Production has six enabled Essences and fifteen enabled Resonances; the existing active Ironfist build received all eight learned Skills. Anonymous and authenticated browser roles cannot execute the private provisioning trigger. No migration-history rewrite was needed.
- Production release `b2da21e297c61e05c5442e465c980daf830d5a6d` is READY at https://aurevane.vercel.app through deployment `dpl_6zem5DU9ewgjpkPpNkrboWioRWHs`. The only release delta from the verified merge is the temporary main deployment switch. Commit `45e1d82433e92d2d73d7b8857c042e385f0a3975` restores the deployment lock.

The authenticated live check confirms Skill target/effect tags, expanded range/effects without clipping or changing the four selections, both arena options, Crossroads Court launch and a committed 30-AP Guard action, and Terraced Yard's 77 tiles/elevation after reload. Both practice battles were surrendered and returned to the Battle Hall. Production application-error logs were empty during verification; browser-extension diagnostics are unrelated to the application.

The supplied test account signed in successfully. Its selected character required the existing one-time Core Stat conversion, completed with three points in Might and two in Vitality; Brace, Cleave, Forceful Strike and Rally were equipped through the normal UI for testing. No test-kit unlocks or mastery bypass were used in production.

This is a live six-Foundation milestone (48 regular Skills, six Essences, fifteen pairs), not full sixteen-Discipline Phase-4 closure. Broader expansion, dedicated art/audio, later acquisition/equipment coverage and independent human balance/playtest evidence remain open under P4.5.


## Sixteen-Discipline continuation — live implementation

Branch `agent/phase4-completion` adds the ten planned advanced libraries (80 regular Skills), ten Essences and 105 cross-library sequence Resonances. Together with Foundations this is 128 regular Skills, 16 Essences and 120 unordered pairs. The roster is live. Implementation evidence does not replace human acceptance.

The new short effect names are Burn, Bleed, Poison, Regeneration, Slow, Root, Reckless, Fortified, Challenged, Marked and Warded. Periodic effects tick at affected turn end; other statuses expire at affected turn start. Cleanse removes explicitly named negative statuses. Linked Reckless/Fortified tradeoffs remain inseparable under application, expiry and removal. The new conditional multiplier budget is 50–200% after combining modifiers; historical Guarded/Exposed/Lowered Guard rules remain separate. Integer arithmetic resolves each actual attacker/recipient pair. Skill damage now uses each recipient's armor or ward and each hit independently. New mystic attacks spend a small authored MP cost; repeated costs are unchanged.

Distribution audit: five of 128 regular Skills apply the new percentage statuses (Bastion Challenge and Fortress, Ravager Frenzy, Wildwarden Hunter's Mark, Cinderweaver Ash Ward). Only Fortress and Frenzy are linked strong benefit/drawback regular Skills. Last Bastion is the only additional Essence using that tradeoff family. No new Resonance grants a blanket percentage bonus.

Acquisition: six Foundation creation choices remain unchanged. A separate Standard/High Mastery Trial awards 50 Primary Mastery XP after a victory with two distinct Primary regular Skills used across at least three commands and no player timeout. XP derives from frozen origin/build and committed events; one claim per battle, atomic with learned Skill/mastery facts. Milestones are 100 Practiced, 300 Adept, 600 Expert, 1,000 Master. Master also requires demonstrating all eight regular Skills across qualifying victories. Advanced libraries teach 4/2/2 Skills at Initiate/Practiced/Adept. Their Master Plan prerequisites are enforced in the database for all Primary-change paths. Ordinary AI Sparring and Passive Training do not award Mastery.

Equipment interaction review: every new Skill is usable with the current unarmed build. No unimplemented weapon or hands requirement is advertised. The shared defense bridge now verifies physical/armor and mystic/ward interactions separately for each area recipient. Equipment-granted active Skills and the full equipment catalog remain their later roadmap integration; this release does not claim those systems exist.

Media: original semantic vector sigils cover the added traditions and their Skill target/effect identities without third-party licenses or missing-art placeholders. Dedicated illustrated masters and independent art approval remain separate from this playable implementation. Audio/VFX production requirements, performance budgets and the remaining human media review are tracked in `content/audio-requests/AUDIO-DISC-001.md` and `content/art-requests/ART-DISC-003.md`. Dedicated recordings are not inferred from metadata hooks.

Verification so far: all advanced regular Skills/Essences execute in PvE and PvP; all 105 new Resonance sequences arm and consume a legal cross-library payoff in each mode. Focused checks cover per-opponent modifiers, cleanse, linked tradeoffs, Root/Slow, periodic expiry/lethal completion, replay and per-recipient armor/ward. Repository checks, database CI, authenticated browser verification and the roster deployment passed; see the release record below.


Testing-access compatibility: temporary testing entitlement is now a separate server-owned policy rather than a Mastery fact. While `testing_open` is active, every published Discipline remains selectable as Primary/Secondary and its published library is available for testing; earned XP/stage, release prerequisites and Mastery history remain independent. Isolated database fixtures close the policy inside rolled-back transactions to prove normal prerequisites and 4/2/2 learning. The final release transition must disable the testing policy and normalize temporary testing-only Skill unlocks before release gates are considered live.


## Sixteen-Discipline release evidence — 2026-09-11

- PR [#451](https://github.com/ZeiJM/Aurevane/pull/451) merged the verified tree `a2c1eafc00a332428f82283f0400e405544227f7` at `43e43cdbac1308382dce754f630910faec66f382`. All 15 workflows passed on exact feature head `dc85ba560adf4b495bf1d6adcde328b9066c5204`.
- `pnpm check` passed formatting, lint, typecheck, 1,001 Vitest tests, six Node report tests and production build. Representative Buildcraft [run 34633894950](https://github.com/ZeiJM/Aurevane/actions/runs/34633894950) passed its Mastery database matrix and eight browser cases (four intentional viewport skips); retained screenshots/traces are attached to the run. Browser Smoke passed 117 Chromium and four Edge cases, with 96 intentional skips.
- Exact migration `20260911174638_phase4_roster_mastery.sql` applied through the established Git integration. All 75 production migration version/name identities match committed files. Production catalogs contain 128 regular Skills, 16 Essences and 120 Resonances. Browser roles cannot call the Mastery claim RPC directly or update progress.
- Git release `7a539581651caad9fe57b8da8dba23652dadb624` produced READY deployment `dpl_6fWVva8NzKxpJp41Zcd3WNwNWA29` at https://aurevane.vercel.app. Commit `ff56e9acfdd2cc09a96071dd4bdf3d8dfe5540b6` restored the deployment lock with the verified application tree unchanged.
- Authenticated production checks confirmed all 16 Primary/Secondary choices and Mastery bars, Bastion's eight Skills, Last Bastion Essence, exact Fortified benefit/drawback details, targeting/shape/effect tags, four persisted selections and Mastery Trial launch. Fortress committed at 30 AP. The trial timed out during inspection and was closed as a defeat; it is not reward-eligibility evidence. Earned rewards, rejection rules and replay safety are verified by the isolated database matrix.
- Live checking exposed a shared cockpit defect: re-clicking the caster after selecting a self Skill submitted a unit target. The follow-up keeps the self target and adds a phone/desktop authenticated regression asserting the actual preview and committed Fortified status. The follow-up passed and is released; see below.

Acceptance still open: dedicated illustrated masters, recorded Skill audio and actual independent human tactical/balance review. Original vector identities and shared media hooks are implemented; no recording, human review or equipment catalog is claimed from those hooks.


## Final self-target correction — released

PR [#452](https://github.com/ZeiJM/Aurevane/pull/452) merged at `75f1fcf5d1944c3eeb4a6ea2a55795cdc4e45cdf`. All four applicable workflows passed on exact head `83ba920845071ca860469bcb56dce56d5ef609dc`: CI, Skill Engine, Representative Buildcraft and Browser Smoke. Full local checks passed again. Representative Buildcraft passed eight browser cases with four intentional viewport skips, including the Fortress self-tile preview/commit regression on desktop and phone. [Retained screenshots and traces](https://github.com/ZeiJM/Aurevane/actions/runs/34636756858/artifacts/10278827877). Browser Smoke passed 117 Chromium and four Edge cases, with 96 intentional skips.

Release `fa98cf197bf2533d6f1d23904380d347ec3a78d7` produced READY production deployment `dpl_ALiUzcMmkJ2yceaHJXHkgb6ktyoF` at https://aurevane.vercel.app. Authenticated live verification reselected the caster tile, saw a legal Fortress preview with Fortified and two turns, committed the action, and confirmed the Fortified entry in the combat log. The sparring battle was surrendered and the test character returned to the Battle Hall. Production error/fatal logs were empty during this check; observed browser-extension diagnostics were unrelated to the application. This record is committed together with restoring the Vercel deployment lock. No migration or balance changes were required by this correction.

The playable implementation is ready for Owner testing. Human tactical acceptance and dedicated production artwork/audio remain open as recorded above.


## Phase 4 media integration — Owner testing release

The Owner reiterated continuation after the candidate packet and requested completion of integration and the already-authorized live release. `content/media-releases/phase4-v01.json` records that activation authorization and every runtime file hash. It does not claim an independent visual/listening review or tactical acceptance. The original candidate manifests remain unchanged as provenance.

Ten painted advanced Discipline identities now serve the Profile identity and Essence presentation. Regular Skills retain distinct semantic target/effect sigils. Seventy-two original synthesized cue variants cover the ten advanced action/Essence families plus shared attrition, healing, cleanse and Resonance conversion. These are reusable cue families, not 128 unique recordings or 120 bespoke pair mixes.

Shared playable PvE/PvP and spectator presentation consumes only recent persisted events through a private authenticated endpoint. The existing participant/active-spectator RPC checks authorize each read; no database policy, migration or gameplay rule changes. Reads are bounded to one 100-event page per observed new version, with at most two compact cue descriptors. Initial history, replayed commands, version gaps, previews, failures, hidden tabs and disabled audio produce no catch-up playback. Pending loads cancel on new state, tab changes and unmount. SFX keeps the central volume/mute, gesture unlock and two-voice priority limit.

Final acceptance still needs actual human listening and gameplay feedback. No fabricated playtest outcomes are recorded.


## Media integration release evidence — 2026-09-11

- PR [#454](https://github.com/ZeiJM/Aurevane/pull/454) merged at `f756d92de20b583a718c8f5faf67769ef32762e8`. The merged tree exactly matches tested tree `6611e91ec72675f4df92d5f72c51c1fd540033ab`; main stayed at `f67cd8c3` until this merge.
- All six workflows passed on final head `d1dee5e9dc13f3d8ff80d9dcc2c3b6afae312057`: [CI](https://github.com/ZeiJM/Aurevane/actions/runs/34658206578), [Skill Engine](https://github.com/ZeiJM/Aurevane/actions/runs/34658206573), [Essence Build](https://github.com/ZeiJM/Aurevane/actions/runs/34658206571), [Resonance Build](https://github.com/ZeiJM/Aurevane/actions/runs/34658206567), [Representative Buildcraft](https://github.com/ZeiJM/Aurevane/actions/runs/34658206614), and [Browser Smoke](https://github.com/ZeiJM/Aurevane/actions/runs/34658206589). Local `pnpm check` passed formatting, lint, typecheck, 1,016 Vitest tests, six Node report tests and production build.
- Representative Buildcraft passed eight browser cases with four intentional viewport skips. Desktop/laptop/mobile checks prove painted Essence loading, silent action previews, exact committed cue responses and nonempty MP3 delivery with valid HTTP 200/206 and audio/mpeg. [Retained browser evidence](https://github.com/ZeiJM/Aurevane/actions/runs/34658206614/artifacts/10285448915). The final test-only correction accepts valid HTTP range delivery rather than assuming every successful MP3 response is 200.
- Release commit `4ec4036c6781621a1eb502aaf00b5941b99d4656` produced READY production deployment `dpl_DWVodLdpQ7vN3jnPPptqjtLyGeEK`, with the production alias https://aurevane.vercel.app and exact Git SHA verified. Only the temporary main deployment switch differs from the verified merge. This evidence commit restores the deployment lock; application code/assets remain unchanged. No database migration, entitlement or balance change was needed.
- Authenticated production checking confirmed Bastion 128px identity and 256px Last Bastion artwork loaded, preserved targeting/shape/effect tags and four selected Skills, a legal self-tile Fortress preview, its committed 30 AP cost and Fortified combat-log entry. The turn timer elapsed during post-action inspection; this is not reward evidence. The practice battle was surrendered in Round 2 and the character returned to the Battle Hall. Production error/fatal logs were empty during the check.

The set is live for Owner evaluation. Automated audio delivery is verified; human listening quality, visual acceptance and independent tactical/balance feedback remain unclaimed. Source candidate manifests are immutable; `content/media-releases/phase4-v01.json` records the continuation authorization and 102 runtime file hashes (571,754 bytes total). No unique recording for every Skill or bespoke mix for every pair is claimed.


## Seventeen-Discipline Atlas/runtime integration — 2026-09-12

The combined Phase-4 candidate preserves the sixteen released Disciplines and adds Chronist rather than replacing Tidecaller. The published inventory is now 17 Disciplines, 136 regular Skills, 17 Essences and 136 unordered Resonance pairs. Chronist contributes eight Skills, Borrowed Hour, sixteen pair definitions, bounded next-round initiative scheduling, Rewind Step, advanced-AI coverage and dedicated art/audio. Ironfist's recovered dedicated media is retained.

During development testing, every published Discipline—including Chronist—is selectable through the separate server-owned testing entitlement without creating earned Mastery. With testing closed, Chronist's normal release path is **Rekindling I + Aetherist Adept**; Aetherist Adept alone is intentionally insufficient. Once release-eligible, Chronist follows the normal advanced 4/2/2 acquisition milestones. Planned Atlas identities remain non-selectable until their authoritative combat libraries are published.

Historical sixteen-Discipline release records above remain historical. The combined exact-head matrix must prove Atlas publication, the Chronist Rekindling gate, 4/2/2 learning, all sixteen Chronist pairs, temporal/reload safety, earned-Mastery UI victory/claim/reload/retry, media routing and inherited authority regressions before merge. Human balance, visual and listening acceptance remain separate open evidence.

## Atlas, Chronist and Ironfist live release evidence — 2026-09-12

- PR [#455](https://github.com/ZeiJM/Aurevane/pull/455) merged final head `6ef646d882f5cdc5b781b6da1710d955c6833251` at `90a3c4f69e26ecab222f53482af882eb4fa03133`. The merge exactly preserves tested tree `e60acf85998f329472cb4aec1fa50f2a1df52f5e`. It includes the independently reviewed surrender/PvP metadata corrections from #458.
- All fifteen final-head workflows passed: CI, Browser Smoke, Representative Buildcraft, Battle Session DB, Discipline Build DB, Foundation Security DB, Wayfarer's Practice DB, Attribute Allocation, Profile Skill Build, Shared Build Snapshots, Skill Engine, Essence Build, Resonance Build, Desktop Page Fit and Desktop Experience.
- [Representative Buildcraft run 34684933247](https://github.com/ZeiJM/Aurevane/actions/runs/34684933247) passed its database gates, 498 focused tests and twelve browser cases with six intentional viewport skips. The desktop earned-Mastery case completed the real UI victory, first claim, reload and duplicate retry, and verified earned Bastion release eligibility independently of testing access. This is automated gameplay evidence, not human balance acceptance.
- Release `df1be4f72762bc11dc75c7b2e4eb62934241f8ec` produced READY production deployment `dpl_FH4atQ3A4sTdxdREmKhbKDSTGPwp`, with https://aurevane.vercel.app assigned to that exact commit. Only the temporary deployment switch differs from the verified merge. This evidence commit restores the deployment lock without changing the application or assets.
- Production read-only verification confirms both exact migration identities: `20260912012521_phase4_chronist` and `20260912070000_discipline_atlas_testing_separation`. The live catalog has 17 Disciplines, 136 regular Skills, 17 Essences and 136 pairs; the server-owned testing policy is open.
- Authenticated production checking loaded the Profile, all seventeen Primary choices, and the Atlas showing 36 designed identities with seventeen published. Chronist is available for testing while its normal release requirements remain Rekindling I plus Aetherist Adept. The existing Bastion loadout was preserved. One earlier presence request logged a persistence-unavailable 503; the subsequent live online count loaded successfully and the final five-minute error/fatal scan was empty.

The combined release is live for Owner testing. Planned Atlas identities remain unavailable until their combat libraries are implemented. Human visual/listening and tactical acceptance remains unclaimed.
