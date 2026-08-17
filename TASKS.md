# AUREVANE — Active Task Ledger

This file is intentionally concise. It reports the **current implementation/validation boundary**; it does not duplicate the historical implementation diary. Detailed completed-ticket history remains available in Git history, merged PRs, issues, phase ticket specs, and release records.

The Master Game Plan defines the product. The Roadmap defines sequence. Canonical domain documents define system rules. `docs/PROJECT_GOVERNANCE_AND_COMPLEXITY.md` defines authority routing, reconciliation, complexity, and delivery discipline. This file reports what is actually active now.

## Current status

**Stage:** PV-1 — Tactical Combat Human/Internal Validation

**ACTIVE VALIDATION GATE:** issue #105 — PV-1C Conduct Tactical Combat Human/Internal Validation

**ACTIVE IMPLEMENTATION TICKET:** none. Substantial Phase 3 implementation is intentionally blocked until the PV-1 human evidence is reviewed.

P2.7 / PV-1 Combat Usability & Battlefield Scale Proof is complete through PR #100. PV-1A authoritative combat-validation telemetry is complete through PR #102. PV-1B structured playtest evidence tooling and facilitator protocol are complete through PR #104. The repository is now ready for real human/internal tactical-combat sessions; further mechanics cannot substitute for that evidence.

### PV-1C active validation boundary

Conduct and review real sessions using `docs/PV1_TACTICAL_PLAYTEST_PROTOCOL.md` and the merged report command:

```bash
pnpm validation:pv1-report .local-validation/pv1-sessions.json
```

Collect the defined evidence:

- first-battle outcome;
- time to first confident action;
- battle duration;
- obvious misclick and targeting-confusion counts;
- outcome understanding;
- voluntary replay disposition, with time/technical exclusions separated;
- tactical-decision recall;
- pace, clarity, responsiveness, audiovisual-impact and replay-desire ratings;
- concise pseudonymous qualitative notes kept in the gitignored local validation area;
- server-derived first-start/first-completion/abandonment telemetry as corroborating evidence where applicable.

Do not fabricate tester records, treat automated browser tests as human-fun evidence, or pull Phase 3 Disciplines/Arts/buildcraft, broader analytics infrastructure, production PvP/Colosseum spectation, world-retreat settlement, Expedition extraction, stronger AI grades, or unrelated breadth forward while this gate is unresolved.

## Completed foundation relevant to this work

- Phase 0 foundation and security hardening are complete.
- Phase 1 character/profile/derived-stat/XP foundations are complete.
- P1.6 Wayfarer's Practice planned windows + Rested Momentum is complete.
- P1.7 public News/Manual/Rules foundation is complete.
- P2.1–P2.6 combat engine, persistence, battle UX, Recruit AI and Tactical Hall vertical slice are complete.
- P2.7 combat usability, integrated final-facing flow, combat keybind foundation, 9×7 Duel Yard scale proof, larger-board Recruit validation and authoritative Abort Exercise are merged through PR #100.
- PV-1A private server-derived `first_combat_started`, `first_combat_completed` and `combat_abandoned` telemetry is merged through PR #102 with exact-head CI/database/security/browser validation.
- PV-1B local structured playtest records, deterministic decision-support reporting, privacy/consistency validation, report tests, synthetic example data and neutral facilitator protocol are merged through PR #104 with exact-head CI/database/browser validation.

## Current authoritative documents

- `docs/ROADMAP_PRODUCT_VALIDATION.md` governs PV-1 evidence, telemetry and the gate decision.
- `docs/COMBAT_USABILITY_BATTLEFIELDS_CONTROLS_RETREAT.md` governs the validated battle-usability contract.
- `docs/ROADMAP_COMBAT_USABILITY_BATTLEFIELDS_CONTROLS_RETREAT.md` blocks substantial Phase 3 expansion until PV-1 human/internal validation is reviewed.
- `docs/PV1_TACTICAL_PLAYTEST_PROTOCOL.md` defines the active structured human-playtest procedure.

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
#105 PV-1C — Conduct Tactical Combat Human/Internal Validation
  ↓
Record real representative sessions using the merged protocol + telemetry
  ↓
Run the PV-1 report; review qualitative notes, sample quality and confounders
  ↓
Record a human evidence decision on #105
  ↓
PASS: reconcile the boundary and open the first substantial Phase 3 implementation ticket
FAIL: open the smallest corrective Phase 2/PV-1 implementation ticket and retest
```

The telemetry and report harness support the gate; they do **not** satisfy or auto-pass the human/internal validation gate by themselves.
