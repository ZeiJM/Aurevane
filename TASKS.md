# AUREVANE — Active Task Ledger

This file is intentionally concise. It reports the **current implementation boundary**; it does not duplicate the historical implementation diary. Detailed completed-ticket history remains available in Git history, merged PRs, issues, phase ticket specs, and release records.

The Master Game Plan defines the product. The Roadmap defines sequence. Canonical domain documents define system rules. `docs/PROJECT_GOVERNANCE_AND_COMPLEXITY.md` defines authority routing, reconciliation, complexity, and delivery discipline. This file reports what is actually active now.

## Current status

**Stage:** PV-1 — Tactical Combat Human/Internal Validation

**ACTIVE:** issue #103 — PV-1B Tactical Combat Playtest Evidence Harness

P2.7 / PV-1 Combat Usability & Battlefield Scale Proof is complete through PR #100. PV-1A authoritative combat-validation telemetry is complete through PR #102. The active implementation boundary is now the smallest structured human-playtest harness needed to turn PV-1 sessions into comparable evidence without fabricating human results or starting Phase 3 early.

### PV-1B current implementation boundary

Implement and validate:

- a privacy-conscious local JSON record for one tactical-combat playtest session;
- required fields for first-battle outcome, first-confident-action time, battle duration, misclick/targeting confusion, outcome understanding, voluntary replay and tactical-decision recall;
- compact 1–5 pace/clarity/responsiveness/audiovisual/replay-desire ratings;
- optional qualitative notes retained locally rather than written to production telemetry;
- deterministic report aggregation with the roadmap's provisional replay warning;
- validation that fails closed on duplicate sessions, unsupported fields and contradictory technical/replay states;
- tests for medians, exclusions, warning behavior and privacy guardrails;
- a neutral facilitator protocol that avoids coaching the evidence.

Do not pull Phase 3 Disciplines/Arts/buildcraft, broader analytics infrastructure, production PvP/Colosseum spectation, world-retreat settlement, Expedition extraction, stronger AI grades, or unrelated account/settings breadth forward.

## Completed foundation relevant to this work

- Phase 0 foundation and security hardening are complete.
- Phase 1 character/profile/derived-stat/XP foundations are complete.
- P1.6 Wayfarer's Practice planned windows + Rested Momentum is complete.
- P1.7 public News/Manual/Rules foundation is complete.
- P2.1–P2.6 combat engine, persistence, battle UX, Recruit AI and Tactical Hall vertical slice are complete.
- P2.7 combat usability, integrated final-facing flow, combat keybind foundation, 9×7 Duel Yard scale proof, larger-board Recruit validation and authoritative Abort Exercise are merged through PR #100.
- PV-1A private server-derived `first_combat_started`, `first_combat_completed` and `combat_abandoned` telemetry is merged through PR #102 with exact-head CI/database/security/browser validation.

## Current authoritative documents

- `docs/ROADMAP_PRODUCT_VALIDATION.md` governs PV-1 evidence, telemetry and the gate decision.
- `docs/COMBAT_USABILITY_BATTLEFIELDS_CONTROLS_RETREAT.md` governs the validated battle-usability contract.
- `docs/ROADMAP_COMBAT_USABILITY_BATTLEFIELDS_CONTROLS_RETREAT.md` blocks substantial Phase 3 expansion until PV-1 human/internal validation is reviewed.
- `docs/PV1_TACTICAL_PLAYTEST_PROTOCOL.md` defines the active structured human-playtest procedure once PV-1B merges.

## Established deferrals

- Phase 3: Disciplines, Arts, representative equipment/load/buildcraft and deeper command expansion until the PV-1 human evidence gate passes.
- Later phases: Mantles / Confluences / Soulmarks / Current-Legacy loadouts, stronger AI grades, remote LLM combat, PvP bots, broad Tactical Record progression, full Battle Review, Colosseum/spectation, world/Expedition retreat settlement.
- Broad telemetry vendors/SDKs, analytics dashboards, session replay and large event taxonomies remain deferred until product evidence justifies them.

## Permanent execution rules

1. Inspect current `main`, open implementation PRs/issues, current phase ticket specs, and recently merged design docs before starting work.
2. One canonical implementation ticket is ACTIVE at a time.
3. Never merge a dependent ticket before its prerequisite.
4. Reconcile repository truth at phase/player-facing validation boundaries.
5. Do not use future feature work to hide a failed validation gate.
6. Run required GitHub quality, database/security and responsive authenticated browser checks for implementation correctness. Vercel/external Preview validation should be performed when available, but an explicit Owner waiver may defer that external deployment gate without blocking implementation or GitHub merge; never mislabel an older deployment as exact-head validation.
7. Keep this ledger short and current. Do not allow it to become a second Roadmap or an archaeological log.

## Immediate sequence

```text
#103 PV-1B — Tactical Combat Playtest Evidence Harness
  ↓
GitHub quality validation
  ↓
Merge PV-1B and verify main
  ↓
Run real human/internal PV-1 tactical-combat sessions using the protocol + telemetry
  ↓
Generate report; review qualitative notes, sample quality and confounders
  ↓
PASS: begin substantial Phase 3 expansion
FAIL: open the smallest corrective Phase 2/PV-1 ticket and retest
```

The report tool supports the gate; it does **not** satisfy or auto-pass the human/internal validation gate by itself.
