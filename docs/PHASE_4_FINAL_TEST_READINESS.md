# Phase 4 — final testing readiness

Released on 2026-09-12 through [PR #461](https://github.com/ZeiJM/Aurevane/pull/461). Production is READY at https://aurevane.vercel.app on application commit `c5a9f633d5769a4cea15ed840473389e1a462aac`, deployment `dpl_CVuyfURtMUXM7LpZfWsEkyhv4Y9z`. Human acceptance remains open. The release ledger remains `PHASE_4_TICKETS.md`.

## Changes released for final testing

- Battle Skill buttons and their category pickers show target, shape and effect tags from the exact content version committed to the battle. This includes pure-build Essences. The shared helper distinguishes elemental damage, named statuses, terrain, displacement, healing, MP drain/restoration, Cleanse and Dispel. Target previews continue to determine actual legal recipients, costs and repeat reduction.
- Four missing effect badges are repaired: Chronist Haste and Delay, Stormsinger Static Drain, and Tidecaller Water Lance. Unknown future statuses receive a neutral badge instead of invalid SVG text.
- Profile persistence recovery now records the failing stage and stable error code through the existing server logger. No raw database error, account identifier or session data is logged. The earlier isolated interruption was not reproduced; this is a diagnostic improvement, not an established fix for its unknown cause.

## Automated evidence and limits

- Combat contracts cover all **153 current Skills/Essences** and **20 historical v1 definitions**, each in PvE and PvP. Independent expected outcomes check recipient HP/MP changes, statuses/stacks/source/duration, selective removal, position, terrain, costs, forecasts, requirements, affordability and consecutive execution after JSON reload. The core suite passes **1,033 tests**. No production combat-engine change was required by this audit.
- Intentional repeat rejections remain: Brace when already Guarded, Pressure Palm after pushing its target out of range, and Conductive Bolt after consuming its prerequisite. Ordinary repeat effectiveness and unchanged AP/MP costs remain intact.
- These deterministic recipient contracts complement existing interaction, publication, AI, Resonance and frozen-build regressions; they do not exhaust all map/build combinations or establish balance.
- All **120 released media files** match recorded hashes/sizes: 36 WebP derivatives and 84 MP3 cues. Images and audio decode; audio lasts 160–540 ms with peaks from −17.16 to −9.76 dBFS and no clipping. All **289 roster artwork outputs** render. Focused media/presentation tests pass 27 cases; audio passes 13 cases.
- Focused Profile recovery tests preserve healthy rendering, battle redirection, cosmetic fallbacks and propagation of unexpected errors. The original incident's detailed runtime-log window was unavailable because of a provider diagnostic quota.
- Full `pnpm check` passed formatting, lint, types, **1,033 core and 344 web Vitest tests**, six web Node tests, 59 other package tests and the production build. Independent review identified and verified corrections for desktop clipping, mobile artwork overlap and the narrow-desktop height budget. The final narrow-desktop spacing adjustment passed its covering formatting check and final CI.
- All **ten applicable workflows** passed at head `317b175ae08f54d6fe721b9c3e91e8c1b3bef839`. Its merge `414378f0e7876db49696f3256d7b564c61ef7fa2` has the identical tree `920590c826e8a50bc0e33efb3fcd8496ffd24d1b`.
- [Representative Buildcraft 34716876051](https://github.com/ZeiJM/Aurevane/actions/runs/34716876051) passed 727 focused core tests, 87 focused web tests, actual database/publication checks, and **24 browser cases with six existing skips**. All six PvE/PvP ground-targeting cases passed at desktop/laptop/phone sizes, including visible tags at least 12px, containment without artwork overlap, casts, reload and native spectator inspection. Evidence artifact: `10305465265`. Its download reference returned HTTP 403 during attempted image retrieval; do not represent its screenshots as visually reviewed.
- [Browser smoke 34716876040](https://github.com/ZeiJM/Aurevane/actions/runs/34716876040) passed **133 Chromium cases with 98 existing skips**, plus four Edge cases. Both dedicated desktop layout workflows passed. No new assertion was skipped or replaced with a fabricated response.

## Production verification and runtime follow-up

- The release commit differs from the verified application only by the temporary main deployment switch. The deployment lock was restored after the build started, at `ec16bec0f4fe4c4e8b72f6bfb96fbdab6c7acd8e`, before the live checks. No migration, content activation or combat-balance change was needed.
- Live Standard AI Sparring on Duel Yard, battle `d4375bc1-d590-47a5-a247-dcbc0989e662`, showed the authored tags in the picker and command cards. The command cards were visually reviewed on the live desktop viewport. Fortress committed in Round 2 for **100 → 70 AP**; reload preserved the 70-AP state. The saved log records **Fortified for two turns**, followed by its expiry in Round 4.
- UI inspection allowed timed turns to expire; these were not claimed as tactical playtest results. The practice battle was surrendered in Round 4. The result explicitly grants no normal progression rewards. The original pure Bastion build, four selected Techniques, Last Bastion, assigned attributes and Level 1 / 0 XP were verified on return to Profile. Profile recovery did not recur; the scoped Profile runtime-error query since 20:40 UTC returned none.
- **Unresolved intermittent runtime observation:** one turn-clock request returned **503 / PERSISTENCE_UNAVAILABLE** at 20:44:02 UTC, logged at 20:44:07.389, on the same battle. The subsequent scoped log query reported 14 successful 200 responses; the battle continued, preserved state and accepted surrender. The existing clock client retries with bounded backoff. The server maps multiple persistence operations to the same sanitized error, so the underlying cause was not established. No speculative engine or database change is claimed to fix it. Record the time and battle ID if it recurs during final testing.

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
