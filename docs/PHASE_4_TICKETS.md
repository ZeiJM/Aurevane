# Phase 4 — execution and acceptance ledger

**Live testing release — 2026-09-12:** PR #455 is merged and the seventeen-Discipline Atlas/Chronist release is live at https://aurevane.vercel.app. See the final release evidence below. Independent human tactical, visual and listening acceptance remains open.

Owner activation: explicit request for full implementation, necessary approvals, and final production deployment; followed by confirmation that Skill targeting/effect tags belong in this work. This supersedes the earlier waiting-for-start notes. It does not manufacture human playtest evidence.

## Staged contract

1. **P4.1 — inherited roster acceptance.** Audit the five existing libraries, shared four-selection authority, exclusive Essence/Resonance, unordered pair direction, reachable setup/payoff tags, AI legality and media relationships. Reuse existing immutable AI/PvP snapshots, progression, attunement and saved-loadout authority.
2. **P4.2 — sixth Foundation.** Complete Ironfist with eight distinct regular Skills, Hundredfold Rush Essence, five pair Resonances, additive database provisioning and preserved active battle snapshots. No entitlement/mastery bypass is added.
3. **P4.3 — readable Skill information.** Show target kind/shape and effect tags; expandable authoritative range, line of sight, elevation, affected-team policy, AP overrides, ordered effects and requirements. Preserve compact typography, favorite controls, mobile/desktop parity and four selections.
4. **P4.4 — representative maps.** Preserve Basic Training Floor and Duel Yard. Add Crossroads Court and Terraced Yard for AI Sparring; retain the already-delivered PvP medium/large map generator and terrain/elevation controls. Verify base-mobility routes, provenance, retry/replay and rendered board fit.
5. **P4.5 — roster expansion review.** Assess six complete Foundations before authoring 6–8, 12 and 16. Record interaction defects, actual matchup/AI coverage, acquisition, equipment and media work. Authored count and automated tests do not establish human tactical quality.
6. **P4.6 — release.** Run repository quality checks, database and authenticated browser gates, refresh main and reconcile concurrent work, apply the exact migration, release the verified commit, restore the deployment lock, inspect production and state all verification limits.

## Current implementation boundary

The current baseline is the seventeen-Discipline Atlas/Chronist/Ironfist release through PR #455. The next authorized implementation closes the newly confirmed §18 gameplay tag/terrain and shared ground-target UI gaps. The Atlas remains within Profile → Discipline Management. See `PHASE_4_COMPLETENESS_AUDIT.md` for the requirement-to-code ledger; the earlier sixteen-Discipline text below describes historical milestones.

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
