# Barrier programmed lifetime — verification, 19 October 2026

Integration status: **LIVE for testing**, 2026-10-19T13:41:53.097Z, through source
`b174339574f45ea8cf81ce75ed0aca3daae33701` and production `dpl_FBGiA9CA4eS27e5ZnckmLKy86KJJ`.
All 45 current Barrier definitions (46 payloads) now explicitly author two turns, editable in Master.
Full quality/browser checks and exact publication/readback pass. See the authoritative
[integrated release](2026-10-19-resonance-modularity.md). Start a new battle; historical untimed pools
keep their captured rules. The isolated checkpoint evidence below records the earlier implementation.

Status at isolated checkpoint: local source only, isolated branch `agent/barrier-duration-20261019`, base `f65f9b1560f5e31406f2c9b4f65b432c7bd752a6`. No publication, migration, deployment, or hosted write had occurred at that checkpoint.

## Defect and boundary

Canonical authoring already accepted the shared `durationTurns` field, but Barrier execution discarded it. Pools recorded amount/source/provenance without a clock; both pending and active presentation advertised protection until depleted. Turn and round expiry advanced statuses only. Aegis and Lifebinder Barrier still cast correctly on full-HP self/allies; the prior effective-HP card correction is preserved.

The first corrected-fixture RED run failed seven of eight native cases: missing Instant counters, Normal/Delayed incorrectly labelled until-spent, independent residual pools retained after expiry, and AI/PvP idle timeouts retaining protection. The omitted-duration compatibility case passed. Fixture-only immutable-source/resource-ordering errors were corrected before this RED result.

## Captured rules

- Explicit Barrier duration is an integer from 1–4. An omitted duration preserves historical until-depleted protection; existing stored pools and pending effects receive no inferred clock.
- Instant counts the affected character's completed turn ends, matching ordinary Instant statuses. A self-cast can count the current turn's eventual completion. Periodic damage/recovery settles before the residual Barrier expires.
- Normal/Delayed starts a complete-global-round clock at actual activation. Expiry advances before fresh pending grants activate. A two-round grant activated in round 3 protects rounds 3–4 and expires entering round 5.
- Each timed grant retains its own clock/application identity through partial damage, additional casts and JSON reload. Historical stacking caps and untimed merge behavior remain unchanged.
- Manual facing/end turn and AI/PvP timeout use the same native lifecycle. No separate client timer or turn/reward authority is introduced.
- Expiry emits an ordinary Barrier mutation with an explicit expiry reason and remaining total; Chronicle distinguishes expiration from Pierce shattering. Timed pools capture original Covert source restrictions, including queued activation after Covert ends; later expiry retains those restrictions.
- Master uses its existing shared duration input, now editable for Barrier. Newly added Barrier effects default to two turns. Historical absent duration stays visibly blank until explicitly edited. The shared compact reader already displays authored duration; the rail reads the persisted pool clock.

## Verification

All test commands used `VITEST_MAX_WORKERS=1` and explicit Vitest file filters.

| Check                                                                                                                                                           | Result                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Game-core: Barrier lifetime, Barrier, effect timing, delayed timing, modular Barrier damage, modular correction interactions, unlimited provenance, PvP quality | 8 files / 132 tests passed |
| Web: effect editor/list editor, Chronicle service, history privacy, Barrier projection-to-card, combatant card, effect identity                                 | 7 files / 137 tests passed |
| Game-core `tsc --noEmit`                                                                                                                                        | passed                     |
| Web `next typegen && tsc --noEmit`                                                                                                                              | passed                     |
| ESLint for all changed TypeScript files, from each package's correct configuration directory, zero warnings allowed                                             | passed                     |
| Formatting and diff whitespace                                                                                                                                  | checked before commit      |

The new native matrix covers real duration-bearing Aegis/Lifebinder captures, full-HP self/allies, invalid authoring/persisted clocks, independent same-command and later same-source casts, partial absorption/reload, last periodic tick, mixed historical untimed pools, Normal/Delayed full rounds, coincident expiry/activation, manual completion, AI/PvP idle and acted timeouts, repeated no-input round transitions, terminal timeout rejection and absence of fabricated completion. Native privacy cases cover Instant/Normal/Delayed expiry after the original source's Covert has ended. Existing viewer-projection/card tests preserve authorized effective HP and hidden-holder privacy.

During expansion, the mixed historical-pool test exposed that the shared application-order allocator rejects old pools without an order. Timed allocation now includes only ordered pools; legacy untimed pools keep their original shape. The privacy regression exposed missing original-source metadata on a timed grant made while already Covert; the timed grant/queued activation now captures it. Both guards passed after their corresponding repairs. An initial root-config lint invocation reported ignored web files; rerunning those files under the web configuration passed without suppressing warnings. The web Vitest run emits the existing Vite configuration-loader notice; no test failure remains.

## Compatibility and integration limits

This change supplies the generic lifetime path. It does not rewrite any published definition or assign durations to historical captures. At the isolated checkpoint the source-published catalogue's Barrier payloads omitted duration; the integrated release above subsequently published explicit duration-bearing versions for new encounters. There is no runtime lookup of old flat Guarded effects, per-Skill timer table, or retroactive default. Full release evidence is recorded in the integrated report above.
