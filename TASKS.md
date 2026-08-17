# AUREVANE — Active Task Ledger

This file is intentionally concise. It reports the **current implementation boundary**; it does not duplicate the historical implementation diary. Detailed completed-ticket history remains available in Git history, merged PRs, issues, phase ticket specs, and release records.

The Master Game Plan defines the product. The Roadmap defines sequence. Canonical domain documents define system rules. `docs/PROJECT_GOVERNANCE_AND_COMPLEXITY.md` defines authority routing, reconciliation, complexity, and delivery discipline. This file reports what is actually active now.

## Current status

**Stage:** Phase 2 — Tactical Combat Proof

**ACTIVE:** issue #99 — P2.7 / PV-1 Combat Usability & Battlefield Scale Proof

P2.6 Recruit AI + Tactical Hall is complete on `main` through PR #94. The active task is now the mandatory usability/proof layer before substantial Phase 3 expansion: make the baseline combat loop comprehensible without facilitator explanation, prove scenario-driven battlefield scale beyond the 5×3 drill, preserve meaningful facing without redundant bureaucracy, add comfortable keyboard controls, and provide a safe authoritative practice exit.

### P2.7 current implementation boundary

Implement and validate:

- visible Move → Action → Facing → End Turn mental model and clear mode instructions;
- explicit unavailable reasons for Basic Attack, Guard, End Turn and other visible commands;
- Turn Economy treatment that makes Movement remaining and Action Ready/Spent unmistakable;
- smallest useful Tactical Hall teaching sequence: Movement, Strike, Guard, Facing, then Recruit Sparring Partner;
- provisional final-facing UX with player override and an End Turn flow that does not require a redundant separate facing commit;
- combat keybind foundation using normal preview/intent authority: 1–5, WASD/arrows in context, Space, Enter, Escape, Tab/Shift+Tab, L;
- one authored Duel/Small Encounter battlefield beyond the 5×3 Micro floor, with terrain, flank space and representative pathing;
- tactical-density tests proving no hard-coded 5×3 assumptions and acceptable Recruit decision budget;
- authoritative `Abort Exercise` for no-reward practice with explicit confirmation, idempotent settlement and clean Hall return;
- minimum typed battle-exit-policy/outcome seam for later Retreat/Extraction/Surrender without implementing those later systems now;
- responsive authenticated browser coverage for the new usability path.

Do not pull Phase 3 Disciplines/Arts/buildcraft, production PvP/Colosseum spectation, world-retreat settlement, Expedition extraction, mature account settings breadth, stronger AI grades, or full production art/VFX forward.

## Completed foundation relevant to this work

- Phase 0 foundation and security hardening are complete.
- Phase 1 character/profile/derived-stat/XP foundations are complete.
- P1.6 Wayfarer's Practice planned windows + Rested Momentum are complete.
- P1.7 public News/Manual/Rules foundation is complete.
- P2.1–P2.5 combat engine, persistence, authority, preview and cockpit foundations are complete.
- P2.6 deterministic server-authoritative Recruit AI, Tactical Hall repeat loop, battle completion/retry, no-normal-progression reward contract, and authenticated browser journey are merged through PR #94.
- `docs/PHASE_0_2_RETROACTIVE_COMPATIBILITY_AUDIT.md` records that later identity/staff/profession/item/enchantment/Vault/Event systems require no speculative early schema expansion.

## Current authoritative additions affecting this ticket

- `docs/COMBAT_USABILITY_BATTLEFIELDS_CONTROLS_RETREAT.md` governs battle usability, scenario-driven battlefield scale, keybind direction, final-facing ergonomics and battle-exit semantics.
- `docs/ROADMAP_COMBAT_USABILITY_BATTLEFIELDS_CONTROLS_RETREAT.md` inserts P2.7/PV-1 before Phase 3.
- `docs/PVP_SPECTATION_COLOSSEUM.md` and its roadmap addendum are later PvP/social scope; P2.7 should preserve composable committed battle state but must not implement Colosseum/spectation early.

## Established deferrals

- Phase 3: Disciplines, Arts, representative equipment/load/buildcraft and related deeper command expansion.
- Later phases: Mantles / Confluences / Soulmarks / Current-Legacy loadouts, stronger AI grades, remote LLM combat, PvP bots, broad Tactical Record progression, full Battle Review, Colosseum/spectation, world/Expedition retreat settlement.
- Final production combat art/VFX/audio polish and full websocket/co-op synchronization remain later scope.

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
#99 P2.7 / PV-1 — Combat Usability & Battlefield Scale Proof
  ↓
GitHub quality + database/security + responsive authenticated browser validation
  ↓
Merge P2.7 and verify main
  ↓
PV-1 human/internal tactical usability validation
  ↓
Only after the PV-1 gate: begin substantial Phase 3 expansion
```

If P2.7 uncovers a genuine lower-layer combat-authority defect, fix the smallest authoritative seam explicitly rather than compensating in UI-only code.