# World encounter turn-clock repair — 2026-10-11

## Cause and change

World attacks use `createPvpEncounter`, which omitted the existing
`pvp.missed-turn-streak` temporary resource. The normal quality-enabled lobby
factory includes it. The clock was created successfully, but its first expiry
reached `readEncounter`, which rejected the snapshot as predating PvP clock
support. Subsequent polling returned `PERSISTENCE_UNAVAILABLE` indefinitely.

The encounter factory now initializes the existing PvP quality resources for
every combatant, alongside ordinary AP resources. No timer duration, combat
formula, layout, reward or historical policy changes are included.

## Live incident recovery

The Owner explicitly requested an urgent live fix. Battle
`3eed7663-4a17-4b33-a9b6-332646d355e4` was repaired through
`commit_battle_intent_v3`, with an exact version-4 and active-actor guard,
idempotency key `f0a78a14-7ef1-49aa-a0b4-8cf5da12ad81`, and the recorded
`world_battle_turn_clock_repaired` event. The commit appended version 5 and
initialized only the omitted resource. The original version-4 snapshot remains
immutable. SQL comparisons confirmed that turn, positions, all other state and
every pre-existing combatant/resource value were preserved.

The existing deployed timeout service subsequently committed version 6, recorded
one timeout, advanced to turn 3 and created a fresh 60-second deadline. A later
read confirmed version 7, turn 4 and two recorded timeouts. Recovery did not
surrender, complete, grant rewards or reset the battle.

## Regression and release checks

The production world-attack service test failed first on
`isPvpQualityEncounter(saved) === true`, then passed with the factory fix. It also
checks exactly one initialized resource per participant, both participants'
timeout transitions, unchanged HP, no timeout-implied completion, and rejection
of timeout after a genuine surrender completes the battle. Adjacent lobby tests
pass (12 tests across both files).

Development started from current main
`585c060b11a4665a28efbf3eb12186de79bd6a58` in an isolated hotfix branch. The
unified-engine recovery branch remains paused and is excluded from this release.
The Git deployment lock remains enabled. Full quality checks and deployment are
tracked separately below once complete; live recovery is already verified.
