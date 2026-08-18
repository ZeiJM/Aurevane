# AUREVANE — Active Task Ledger

This file is intentionally concise. It reports the **current implementation/validation boundary**; it does not duplicate the historical implementation diary. Detailed completed-ticket history remains available in Git history, merged PRs, issues, phase ticket specs, and release records.

The Master Game Plan defines the product. The Roadmap defines sequence. Canonical domain documents define system rules. `docs/PROJECT_GOVERNANCE_AND_COMPLEXITY.md` defines authority routing, reconciliation, complexity, and delivery discipline. This file reports what is actually active now.

## Current status

**Stage:** PV-1 — Tactical Combat Corrective Validation

**ACTIVE VALIDATION GATE:** issue #105 — PV-1C Conduct Tactical Combat Human/Internal Validation — **FAILED CURRENT BUILD / AWAITING RETEST**

**ACTIVE IMPLEMENTATION TICKET:** issue #107 — PV-1D Combat Readability, Battlefield Stability & Turn-Flow Correction

Two independent human feedback batches found the same recurring failure: testers were mainly fighting the interface rather than discussing tactical choices. Battlefield scale/rendering, movement readability, information hierarchy, Recruit-turn visibility, action feedback, Tactical Hall selection, and mobile layout require correction before another PV-1 decision. Substantial Phase 3 implementation remains blocked.

### PV-1D active implementation boundary

Repair the existing authoritative Phase 2 slice rather than adding breadth:

- keep the battlefield visibly stable through preview, commit, Recruit turns, refresh, and responsive layout changes;
- enlarge tiles/units and make legal reachability, blocked movement, rough terrain, elevation, and facing visually understandable;
- provide always-readable HP, MP, status, initiative, facing, Movement, and Action state;
- make the intended Move → Action → Facing → End Turn sequence obvious without duplicating the same information across several panels;
- make attack, miss, damage, Guard, movement, and enemy-turn results immediately visible;
- make the Combat Log obvious and keep it current as battle versions advance;
- preserve server authority and strengthen client rapid/double-submit protection rather than relying on visual disabled state alone;
- simplify Tactical Hall drill selection, consolidate Movement + Facing teaching, and ensure Recruit Sparring launches the intended Duel Yard;
- reorganize the authenticated home so Sign Out lives near Sound, game navigation lives with Account State, and Wayfarer's Practice is compact/on-demand;
- rerun responsive authenticated automation and then real human PV-1 testing.

Do not add Phase 3 Disciplines/Arts/buildcraft, new regions/classes, stronger AI grades, production PvP/Colosseum, or unrelated metagame breadth as a substitute for fixing the failed combat experience.

## Human evidence already established

- two independent testers reported battlefield rendering/scaling problems and overlapping command text;
- movement was not visually trackable and reachable/unreachable tiles were unclear;
- terrain/elevation, Action economy, Guard, facing, initiative, and attack outcomes were difficult to understand;
- Recruit actions occurred authoritatively but appeared invisible to players;
- Combat Log discovery/currentness was insufficient;
- mobile Tactical Hall selection was unclear and Recruit Sparring selection was unreliable;
- first tester explicitly did not want another fight in the current build.

These observations are recorded on issue #105. They are a corrective signal, not a PV-1 pass.

## Completed foundation relevant to this work

- Phase 0 foundation and security hardening are complete.
- Phase 1 character/profile/derived-stat/XP foundations are complete.
- P1.6 Wayfarer's Practice planned windows + Rested Momentum is complete.
- P1.7 public News/Manual/Rules foundation is complete.
- P2.1–P2.6 combat engine, persistence, battle UX, Recruit AI and Tactical Hall vertical slice are complete.
- P2.7 combat usability, integrated final-facing flow, combat keybind foundation, 9×7 Duel Yard scale proof, larger-board Recruit validation and authoritative Abort Exercise are merged through PR #100.
- PV-1A private server-derived combat-validation telemetry is merged through PR #102.
- PV-1B local structured playtest evidence tooling and neutral facilitator protocol are merged through PR #104.
- PV-1C collected sufficient human evidence to reject the current combat presentation and open corrective issue #107.

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
2. One canonical implementation ticket is ACTIVE at a time.
3. Never merge a dependent ticket before its prerequisite.
4. Reconcile repository truth at phase/player-facing validation boundaries.
5. Do not use future feature work to hide a failed validation gate.
6. Run required GitHub quality, database/security and responsive authenticated browser checks for implementation correctness. Vercel/external Preview validation should be performed when available, but an explicit Owner waiver may defer that external deployment gate without blocking implementation or GitHub merge; never mislabel an older deployment as exact-head validation.
7. Keep this ledger short and current. Do not allow it to become a second Roadmap or an archaeological log.

## Immediate sequence

```text
#107 PV-1D — Combat Readability, Battlefield Stability & Turn-Flow Correction
  ↓
GitHub quality + database/security + responsive authenticated browser validation
  ↓
Deploy corrected slice and verify live production behavior
  ↓
Rerun real human PV-1 sessions under #105
  ↓
PASS: close #105 and begin the first substantial Phase 3 implementation ticket
FAIL: identify the next smallest recurring combat/usability defect and correct it
```

Automation proves correctness and regression safety; only the subsequent human retest can decide whether PV-1 now passes.
