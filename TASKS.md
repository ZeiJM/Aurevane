# AUREVANE — Active Task Ledger

This file is intentionally concise. It reports the **current implementation/validation boundary**; it does not duplicate the historical implementation diary. Detailed completed-ticket history remains available in Git history, merged PRs, issues, phase ticket specs, and release records.

The Master Game Plan defines the product. The Roadmap defines sequence. Canonical domain documents define system rules. `docs/PROJECT_GOVERNANCE_AND_COMPLEXITY.md` defines authority routing, reconciliation, complexity, and delivery discipline. This file reports what is actually active now.

## Current status

**Stage:** PV-1 — Tactical Combat Human Retest / UX Correction

**ACTIVE VALIDATION GATE:** issue #105 — PV-1C Conduct Tactical Combat Human/Internal Validation — **HUMAN RETEST IN PROGRESS / SECOND CORRECTION OPEN**

**ACTIVE IMPLEMENTATION TICKET:** issue #110 — PV-1E Persistent game shell, compact battle cockpit & simplified turn economy

The first PV-1 human pass failed because two independent testers were mainly fighting the interface rather than discussing tactical choices. Corrective issue #107 is now closed through merged PR #108. The corrected Phase 2 combat slice passed exact-head GitHub quality, database/security and responsive authenticated browser validation across desktop, laptop and mobile. Those automated checks establish implementation correctness and regression safety; they do **not** establish that PV-1 now passes.

The production retest confirmed that PV-1D fixed the catastrophic rendering failures, but the owner identified a second usability layer: shell controls must remain reachable, page density is still too document-like, the battle board is oversized, combatant information belongs beside the battlefield, final facing should itself end the turn, and Action economy needs a simpler 0–100% player-facing explanation. Issue #110 is the single focused correction for those findings. Substantial Phase 3 implementation remains blocked.

## Corrected slice ready for retest

PR #108 / PV-1D addressed the recurring human-test failures without adding Phase 3 breadth:

- stable, larger battlefield presentation through preview, commit, Recruit turns and responsive layouts;
- clearer tiles/units, movement reachability, blocked movement, rough terrain, elevation and facing;
- always-readable HP, MP, status, initiative, facing, Movement and Action state;
- a clearer Move → Action → Facing → End Turn sequence;
- more legible attack, miss, damage, Guard, movement and Recruit-turn results;
- a prominent, current Combat Log aligned with the authoritative event-read contract;
- preserved server authority plus stronger client rapid/double-submit protection;
- simplified Tactical Hall selection, combined Movement + Facing teaching and corrected Recruit Sparring arena selection;
- compact/non-obstructive teaching UI and improved mobile selection/readability;
- cleaner authenticated-home navigation and an on-demand Wayfarer's Practice panel.

## Human evidence already established

The previous build failed PV-1 because:

- two independent testers reported battlefield rendering/scaling problems and overlapping command text;
- movement was not visually trackable and reachable/unreachable tiles were unclear;
- terrain/elevation, Action economy, Guard, facing, initiative and attack outcomes were difficult to understand;
- Recruit actions occurred authoritatively but appeared invisible to players;
- Combat Log discovery/currentness was insufficient;
- mobile Tactical Hall selection was unclear and Recruit Sparring selection was unreliable;
- one tester explicitly did not want another fight in that build.

These observations remain the baseline to compare against during the corrected-build retest; they are not a permanent verdict on the corrected slice.

## Completed foundation relevant to this work

- Phase 0 foundation and security hardening are complete.
- Phase 1 character/profile/derived-stat/XP foundations are complete.
- P1.6 Wayfarer's Practice planned windows + Rested Momentum is complete.
- P1.7 public News/Manual/Rules foundation is complete.
- P2.1–P2.6 combat engine, persistence, battle UX, Recruit AI and Tactical Hall vertical slice are complete.
- P2.7 combat usability, integrated final-facing flow, combat keybind foundation, 9×7 Duel Yard scale proof, larger-board Recruit validation and authoritative Abort Exercise are merged through PR #100.
- PV-1A private server-derived combat-validation telemetry is merged through PR #102.
- PV-1B local structured playtest evidence tooling and neutral facilitator protocol are merged through PR #104.
- PV-1C produced sufficient human evidence to reject the prior combat presentation.
- PV-1D combat readability, battlefield stability and turn-flow correction is merged through PR #108; issue #107 is closed.

## Current authoritative documents

- `docs/ROADMAP_PRODUCT_VALIDATION.md` governs PV-1 evidence, telemetry and the gate decision.
- `docs/COMBAT_USABILITY_BATTLEFIELDS_CONTROLS_RETREAT.md` governs battle-usability intent.
- `docs/ROADMAP_COMBAT_USABILITY_BATTLEFIELDS_CONTROLS_RETREAT.md` blocks substantial Phase 3 expansion until PV-1 human/internal validation passes.
- `docs/PV1_TACTICAL_PLAYTEST_PROTOCOL.md` defines the human-playtest procedure for the corrected slice.

## Established deferrals

- Phase 3: Disciplines, Arts, representative equipment/load/buildcraft and deeper command expansion until the PV-1 human evidence gate passes.
- Later phases: Mantles / Confluences / Soulmarks / Current-Legacy loadouts, stronger AI grades, remote LLM combat, PvP bots, broad Tactical Record progression, full Battle Review, Colosseum/spectation, world/Expedition retreat settlement.
- Broad telemetry vendors/SDKs, analytics dashboards, session replay and large event taxonomies remain deferred until product evidence justifies them.

## Permanent execution rules

1. Inspect current `main`, open implementation/validation PRs/issues, current phase ticket specs, and recently merged design docs before starting work.
2. One canonical implementation ticket is ACTIVE at a time; a validation gate may explicitly hold implementation at none.
3. Never merge a dependent ticket before its prerequisite.
4. Reconcile repository truth at phase/player-facing validation boundaries.
5. Do not use future feature work to hide a failed validation gate.
6. Run required GitHub quality, database/security and responsive authenticated browser checks for implementation correctness. Vercel/external Preview validation should be performed when available, but an explicit Owner waiver may defer that external deployment gate without blocking implementation or GitHub merge; never mislabel an older deployment as exact-head validation.
7. Keep this ledger short and current. Do not allow it to become a second Roadmap or an archaeological log.

## Immediate sequence

```text
Merged PV-1D correction / PR #108
  ↓
Deploy corrected main and verify live behavior
  ↓
Rerun real human PV-1 sessions under #105
  ↓
Review structured notes + corroborating telemetry + confounders
  ↓
PASS: close #105 and open the first substantial Phase 3 implementation ticket
FAIL: identify the next smallest recurring combat/usability defect and open one corrective ticket
```

Do not fabricate, simulate or infer a human PASS from automation. The next product decision requires real tester interaction with the corrected build.
