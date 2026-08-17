# AUREVANE — Active Task Ledger

This file is intentionally concise. It reports the **current implementation boundary**; it does not duplicate the historical implementation diary. Detailed completed-ticket history remains available in Git history, merged PRs, issues, phase ticket specs, and release records.

The Master Game Plan defines the product. The Roadmap defines sequence. Canonical domain documents define system rules. `docs/PROJECT_GOVERNANCE_AND_COMPLEXITY.md` defines authority routing, reconciliation, complexity, and delivery discipline. This file reports what is actually active now.

## Current status

**Stage:** PV-1 — Tactical Combat Human/Internal Validation

**ACTIVE:** issue #101 — PV-1A Tactical Combat Validation Telemetry Foundation

P2.7 / PV-1 Combat Usability & Battlefield Scale Proof is complete on `main` through PR #100. The implementation boundary is now the smallest privacy-respecting measurement seam required to conduct and interpret human/internal tactical-combat validation before substantial Phase 3 expansion.

### PV-1A current implementation boundary

Implement and validate:

- a private server-derived product-validation event ledger;
- authoritative `first_combat_started`, `first_combat_completed`, and `combat_abandoned` capture from battle persistence rather than client analytics calls;
- first-event uniqueness and replay/idempotency safety;
- only stable account/character/battle/version identifiers needed for validation analysis;
- no email, character name, IP address, free-form text, session replay, or arbitrary browser payloads;
- no direct `anon` or `authenticated` table read/write authority;
- focused database verification through the Battle Session DB workflow.

Do not pull Phase 3 Disciplines/Arts/buildcraft, broader analytics infrastructure, production PvP/Colosseum spectation, world-retreat settlement, Expedition extraction, stronger AI grades, or unrelated account/settings breadth forward.

## Completed foundation relevant to this work

- Phase 0 foundation and security hardening are complete.
- Phase 1 character/profile/derived-stat/XP foundations are complete.
- P1.6 Wayfarer's Practice planned windows + Rested Momentum is complete.
- P1.7 public News/Manual/Rules foundation is complete.
- P2.1–P2.6 combat engine, persistence, battle UX, Recruit AI and Tactical Hall vertical slice are complete.
- P2.7 combat usability, integrated final-facing flow, combat keybind foundation, 9×7 Duel Yard scale proof, larger-board Recruit validation and authoritative Abort Exercise are merged through PR #100.
- Exact-head P2.7 GitHub CI, database/security and responsive browser gates passed; the Vercel preview also reached Ready.

## Current authoritative documents

- `docs/ROADMAP_PRODUCT_VALIDATION.md` governs PV-1 evidence and the minimum telemetry boundary.
- `docs/COMBAT_USABILITY_BATTLEFIELDS_CONTROLS_RETREAT.md` governs the validated battle-usability contract.
- `docs/ROADMAP_COMBAT_USABILITY_BATTLEFIELDS_CONTROLS_RETREAT.md` blocks substantial Phase 3 expansion until PV-1 human/internal validation is reviewed.

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
#101 PV-1A — Tactical Combat Validation Telemetry Foundation
  ↓
GitHub quality + database/security validation
  ↓
Merge PV-1A and verify main
  ↓
Run human/internal PV-1 tactical-combat sessions with structured notes + telemetry
  ↓
Review comprehension, abandonment, confidence, outcome understanding and replay desire
  ↓
PASS: begin substantial Phase 3 expansion
FAIL: open the smallest corrective Phase 2/PV-1 ticket and retest
```

The telemetry layer measures the gate; it does **not** satisfy the human/internal validation gate by itself.
