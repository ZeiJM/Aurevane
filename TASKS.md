# AUREVANE — Active Task Ledger

This file is intentionally concise. It reports the **current implementation/validation boundary**; it does not duplicate the historical implementation diary. Detailed completed-ticket history remains available in Git history, merged PRs, issues, phase ticket specs, and release records.

The Master Game Plan defines the product. The Roadmap defines sequence. Canonical domain documents define system rules. `docs/PROJECT_GOVERNANCE_AND_COMPLEXITY.md` defines authority routing, reconciliation, complexity, and delivery discipline. This file reports what is actually active now.

## Current status

**Stage:** PV-1 — Tactical Combat Human Retest

**ACTIVE VALIDATION GATE:** issue #105 — PV-1C Conduct Tactical Combat Human/Internal Validation — **PV-1E CORRECTED SLICE AWAITING REAL HUMAN RETEST**

**ACTIVE IMPLEMENTATION TICKET:** none

The first PV-1 human pass failed because two independent testers were mainly fighting the interface rather than discussing tactical choices. PV-1D / PR #108 corrected the catastrophic battlefield/rendering/readability failures. A production retest then exposed a second usability layer around persistent shell access, page density, battle composition, final-facing flow, movement-path visibility and Action-economy comprehension.

PV-1E / PR #111 is now merged. Its exact head passed GitHub quality/build, database/security and the complete responsive browser suite across desktop, laptop and mobile. Those automated checks establish implementation correctness and regression safety; they do **not** establish a human PV-1 pass. Substantial Phase 3 implementation remains blocked until issue #105 is rerun with real testers on the corrected live build.

## Corrected slice ready for retest

PV-1D / PR #108 established the readable authoritative combat foundation. PV-1E / PR #111 then tightened the human-facing presentation without adding Phase 3 breadth:

- persistent authenticated/public shell controls where present, including always-accessible header/footer behavior;
- Sound settings promoted above page/content stacking layers;
- Wayfarer's Practice folded into the Account State navigation instead of occupying a separate large card;
- denser Tactical Hall and authenticated surfaces rather than oversized document-like layouts;
- compact RPG-style battle composition with player/allies left, battlefield center and enemy/context information right on wide screens;
- bounded 9×7 Duel Yard presentation with responsive internal board scrolling instead of widening the page;
- visible numbered movement-path trail in addition to reachability coloring;
- simplified 0–100% player-facing Action Economy while preserving the authoritative separate Movement pool;
- final-facing direction selection directly commits the authoritative final-turn command and ends the turn;
- mobile Command Deck/facing controls kept inside the usable viewport;
- server authority, version checks, idempotency and rapid/double-submit protection preserved.

## Human evidence already established

The original failed build established the baseline problems to compare against:

- battlefield rendering/scaling problems and overlapping command text;
- movement not visually trackable and reachable/unreachable tiles unclear;
- terrain/elevation, Action economy, Guard, facing, initiative and attack outcomes difficult to understand;
- Recruit actions occurred authoritatively but appeared invisible to players;
- Combat Log discovery/currentness insufficient;
- mobile Tactical Hall selection unclear and Recruit Sparring selection unreliable;
- one tester explicitly did not want another fight.

The PV-1D production retest showed meaningful improvement but identified the second UX layer now addressed by PV-1E. These observations remain evidence to compare against; automation cannot replace the next human retest.

## Completed foundation relevant to this work

- Phase 0 foundation and security hardening are complete.
- Phase 1 character/profile/derived-stat/XP foundations are complete.
- P1.6 Wayfarer's Practice planned windows + Rested Momentum is complete.
- P1.7 public News/Manual/Rules foundation is complete.
- P2.1–P2.6 combat engine, persistence, battle UX, Recruit AI and Tactical Hall vertical slice are complete.
- P2.7 combat usability, integrated final-facing flow, combat keybind foundation, 9×7 Duel Yard scale proof, larger-board Recruit validation and authoritative Abort Exercise are merged through PR #100.
- PV-1A private server-derived combat-validation telemetry is merged through PR #102.
- PV-1B local structured playtest evidence tooling and neutral facilitator protocol are merged through PR #104.
- PV-1C produced sufficient human evidence to reject the original combat presentation.
- PV-1D combat readability, battlefield stability and turn-flow correction is merged through PR #108.
- PV-1E persistent shell, compact battle cockpit and simplified turn-economy correction is merged through PR #111; issue #110 is closed.

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
Merged PV-1E correction / PR #111
  ↓
Deploy the corrected runtime and verify live behavior
  ↓
Rerun real human PV-1 sessions under #105
  ↓
Review structured notes + corroborating telemetry + confounders
  ↓
PASS: close #105 and open the first substantial Phase 3 implementation ticket
FAIL: identify the next smallest recurring combat/usability defect and open one corrective ticket
```

Do not fabricate, simulate or infer a human PASS from automation. The next product decision requires real tester interaction with the corrected live build.