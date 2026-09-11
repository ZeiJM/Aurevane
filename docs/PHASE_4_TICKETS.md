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

P4.1–P4.4 candidate work is in progress. P4.5 expansion and full Phase-4 closure are not yet established. This ledger must not be reported as a completed sixteen-Discipline roster.

## Roster acceptance matrix

| Discipline | Tactical decision | Counterplay | Library | Essence | Mixed pairs |
|---|---|---|---:|---|---:|
| Vanguard | Guard/setup versus direct melee pressure | Range and flank | 8 inherited | Unbroken Strike | 5 with Ironfist |
| Lifebinder | Spend AP supporting versus attacking | Pressure and separation | 8 inherited | Verdant Rupture | 5 with Ironfist |
| Aetherist | Single target versus line/area spell pressure | Spacing, sight and elevation | 8 inherited | Aether Nova | 5 with Ironfist |
| Farstrider | Maintain minimum range and firing lanes | Close distance and break sight | 8 inherited | Deadeye Barrage | 5 with Ironfist |
| Shadehand | Face/Expose setup versus immediate damage | Face the attacker and deny openings | 8 inherited | Perfect Opening | 5 with Ironfist |
| Ironfist | Defensive setup or exposed-target payoff at close range | Kite; deny setup; armor checks each rush hit | 8 candidate | Hundredfold Rush | 5 candidate |

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


## Local verification checkpoint

The candidate passes 582 Vitest unit/service tests and six Node report tests, including 43 focused roster, Ironfist AI/Resonance and arena tests. Formatting, lint, TypeScript and the optimized production build pass (`pnpm check`). The updated Manual assertion now credits Ironfist while retaining the later acquisition/mastery boundary. The Skill-detail styles use the actual shared body-font token. Browser test authoring follows the current Battle Hall mode selector rather than an obsolete button.

Automatic approval review rejected the push to the public `ZeiJM/Aurevane` repository because the current user request did not explicitly name that publication destination and payload. Do not work around the rejected push through another tool. The local change set consists of game code, one additive database migration, tests, the existing browser workflow, and implementation/media-request documentation. The Owner subsequently explicitly approved that destination and payload with “Yes just continue”; the publication blocker is resolved and the same push may be retried.

No Phase-4 database migration, GitHub publication, CI run or production deployment has occurred at this checkpoint. Authenticated local database/browser flows are prepared for CI but have not run in this workspace (Docker is unavailable). The production browser reaches account entry and needs secure sign-in for the eventual live interaction check. No production interaction or human balance PASS is claimed.
