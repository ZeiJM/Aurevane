# Phase 4 — execution and acceptance ledger

Owner activation: explicit request for full implementation, necessary approvals, and final production deployment; followed by confirmation that Skill targeting/effect tags belong in this work. This supersedes the earlier waiting-for-start notes. It does not manufacture human playtest evidence.

## Staged contract

1. **P4.1 — inherited roster acceptance.** Audit the five existing libraries, shared four-selection authority, exclusive Essence/Resonance, unordered pair direction, reachable setup/payoff tags, AI legality and media relationships. Reuse existing immutable AI/PvP snapshots, progression, attunement and saved-loadout authority.
2. **P4.2 — sixth Foundation.** Complete Ironfist with eight distinct regular Skills, Hundredfold Rush Essence, five pair Resonances, additive database provisioning and preserved active battle snapshots. No entitlement/mastery bypass is added.
3. **P4.3 — readable Skill information.** Show target kind/shape and effect tags; expandable authoritative range, line of sight, elevation, affected-team policy, AP overrides, ordered effects and requirements. Preserve compact typography, favorite controls, mobile/desktop parity and four selections.
4. **P4.4 — representative maps.** Preserve Basic Training Floor and Duel Yard. Add Crossroads Court and Terraced Yard for AI Sparring; retain the already-delivered PvP medium/large map generator and terrain/elevation controls. Verify base-mobility routes, provenance, retry/replay and rendered board fit.
5. **P4.5 — roster expansion review.** Assess six complete Foundations before authoring 6–8, 12 and 16. Record interaction defects, actual matchup/AI coverage, acquisition, equipment and media work. Authored count and automated tests do not establish human tactical quality.
6. **P4.6 — release.** Run repository quality checks, database and authenticated browser gates, refresh main and reconcile concurrent work, apply the exact migration, release the verified commit, restore the deployment lock, inspect production and state all verification limits.

## Current implementation boundary

P4.1–P4.4 are implemented and released as the six-Foundation stage. P4.5 expansion and full Phase-4 closure are not yet established. This ledger must not be reported as a completed sixteen-Discipline roster.

## Roster acceptance matrix

| Discipline | Tactical decision | Counterplay | Library | Essence | Mixed pairs |
|---|---|---|---:|---|---:|
| Vanguard | Guard/setup versus direct melee pressure | Range and flank | 8 inherited | Unbroken Strike | 5 with Ironfist |
| Lifebinder | Spend AP supporting versus attacking | Pressure and separation | 8 inherited | Verdant Rupture | 5 with Ironfist |
| Aetherist | Single target versus line/area spell pressure | Spacing, sight and elevation | 8 inherited | Aether Nova | 5 with Ironfist |
| Farstrider | Maintain minimum range and firing lanes | Close distance and break sight | 8 inherited | Deadeye Barrage | 5 with Ironfist |
| Shadehand | Face/Expose setup versus immediate damage | Face the attacker and deny openings | 8 inherited | Perfect Opening | 5 with Ironfist |
| Ironfist | Defensive setup or exposed-target payoff at close range | Kite; deny setup; armor checks each rush hit | 8 released | Hundredfold Rush | 5 released |

The acquisition boundary is inherited Foundation provisioning on active Discipline change, with durable learned facts. Secondary still requires server-owned mastery. The private PV-2 preparation path is testing only. Final world-based acquisition and mastery routes are not claimed by this content release.

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
