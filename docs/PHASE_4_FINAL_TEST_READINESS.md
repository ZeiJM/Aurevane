# Phase 4 — final testing readiness

Engineering follow-up to PR #459, prepared on 2026-09-12. This record does not close the human acceptance gates or claim a new production deployment. The release ledger remains `PHASE_4_TICKETS.md`.

## Changes prepared for final testing

- Battle Skill buttons and their category pickers show target, shape and effect tags from the exact content version committed to the battle. This includes pure-build Essences. The shared helper distinguishes elemental damage, named statuses, terrain, displacement, healing, MP drain/restoration, Cleanse and Dispel. Target previews continue to determine actual legal recipients, costs and repeat reduction.
- Four missing effect badges are repaired: Chronist Haste and Delay, Stormsinger Static Drain, and Tidecaller Water Lance. Unknown future statuses receive a neutral badge instead of invalid SVG text.
- Profile persistence recovery now records the failing stage and stable error code through the existing server logger. No raw database error, account identifier or session data is logged. The earlier isolated interruption was not reproduced; this is a diagnostic improvement, not an established fix for its unknown cause.

## Automated evidence and limits

- Combat contracts cover all **153 current Skills/Essences** and **20 historical v1 definitions**, each in PvE and PvP. Independent expected outcomes check recipient HP/MP changes, statuses/stacks/source/duration, selective removal, position, terrain, costs, forecasts, requirements, affordability and consecutive execution after JSON reload. The core suite passes **1,033 tests**. No production combat-engine change was required by this audit.
- Intentional repeat rejections remain: Brace when already Guarded, Pressure Palm after pushing its target out of range, and Conductive Bolt after consuming its prerequisite. Ordinary repeat effectiveness and unchanged AP/MP costs remain intact.
- These deterministic recipient contracts complement existing interaction, publication, AI, Resonance and frozen-build regressions; they do not exhaust all map/build combinations or establish balance.
- All **120 released media files** match recorded hashes/sizes: 36 WebP derivatives and 84 MP3 cues. Images and audio decode; audio lasts 160–540 ms with peaks from −17.16 to −9.76 dBFS and no clipping. All **289 roster artwork outputs** render. Focused media/presentation tests pass 27 cases; audio passes 13 cases.
- Focused Profile recovery tests preserve healthy rendering, battle redirection, cosmetic fallbacks and propagation of unexpected errors. The original incident's detailed runtime-log window was unavailable because of a provider diagnostic quota.
- Repository-wide checks, independent review and CI browser evidence are recorded at integration. The shared ground-targeting browser tests exercise visible tags, readable tag size, button containment, actual casts, reload and spectator inspection in desktop, laptop and phone viewports.

## Final human testing

Run `PHASE_4_PLAYTEST_PACKET.md` against the verified release and record actual results in `content/balance/phase4-playtest-results-template.csv`.

| Gate                            | What remains for the player/Owner                                                                                                 |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| A03 — balance and counterplay   | Compare representative matchups, linked benefits/drawbacks, conditional effects, repeat use and AI choices with a fixed baseline. |
| A04 — Resonance differentiation | Check whether representative pairs change decisions and offer understandable setup/payoff and counterplay.                        |
| A07 — media and accessibility   | Judge effect/tag clarity, art identity, listening comfort, mute/volume and reduced motion on actual devices.                      |
| A10 — phase acceptance          | Review recorded results, resolve reproducible defects and explicitly accept Phase 4.                                              |

For the new UI, select Techniques from each category, read the button/picker tags, then compare the target preview, committed result and log. Include Water Lance → storm, Chilling Mist → fire, healing/MP drain, Cleanse/Dispel, a repeated Skill, and a pure Essence. Reload once during battle and return to Profile afterward. If recovery appears, record the time and battle ID for the new stage diagnostics.

The playable scope remains **17 Disciplines, 136 regular Skills, 17 Essences and 136 Resonance pairs**. The Atlas lists 36 identities; its other 19 entries remain planned. No human results or Owner acceptance are supplied by these automated checks.
