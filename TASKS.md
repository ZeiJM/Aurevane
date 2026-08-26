# AUREVANE — Active Task Ledger

This file reports the **current implementation/validation boundary**.

`docs/GAME_MASTER_PLAN.md` defines the product. `docs/ROADMAP.md` defines phase sequence. Canonical domain documents define system rules. Current `docs/PHASE_*_TICKETS.md` files define exact active/next execution.

**Reconciled:** 2026-08-26

---

## Current status

**Phase 1 — Character & Progression Foundation:** **COMPLETE by Owner decision.**

Phase-1 credit includes the persistent account/character/progression foundation, six universal attributes, Character XP/level boundaries, character/profile identity, Passive Training, and the supporting player-shell foundations now used by later phases.

**Stage:** Phase 2 — Tactical Combat & Battle Platform — **Owner testing / stabilization**.

**Phase-2 implementation:** mature and substantially beyond the original minimum.

Official Phase-2 credit includes:

- tactical combat and current 100-AP Action Economy;
- movement/path/terrain/elevation/facing;
- Basic Attack / Guard / Recover and current command/preview flow;
- authoritative persistence/reconnect/idempotency;
- responsive battle UI/Inspect/forecasts/logs;
- Recruit AI and Battle Hall / AI Sparring;
- direct private PvP lobbies/shared battles/multiple formats;
- PvP communication/timing/reconnect foundations;
- keyed read-only spectation;
- spectator presence/chat/logs/Inspect;
- multi-combatant desktop/mobile battle presentation.

**ACTIVE VALIDATION GATE:** issue #105 — **PV-1 (Phase 2 test)** — remains open while the Owner continues testing the tactical combat/battle platform.

PV-1 is the Phase-2 human/product validation gate. It is **not** a Phase-1 gate, and automation or deployment does not close it automatically.

**OWNER TESTING:** active.

**ACTIVE IMPLEMENTATION TICKET:** none beyond contained Phase-2 corrections, documentation reconciliation, and release hygiene justified by current testing.

**PHASE 3:** **NOT ACTIVE / NOT AUTHORIZED YET.** `docs/PHASE_3_TICKETS.md` remains the future execution sequence only after the Owner explicitly closes Phase 2 and instructs the project to proceed.

---

## Allowed while Phase 2 remains open

Contained work may address real findings in:

- battle readability/scale;
- multi-combatant rails/Inspect;
- PvP handoff/responsiveness;
- AI/PvP desktop/mobile parity;
- spectator clarity;
- battle logs;
- communication/timing regressions;
- active battle/spectation safety;
- profile/training/session interactions affecting the tested flow;
- public Manual/Rules drift from the actual current build;
- release/deployment hygiene;
- genuine authority/security defects.

Do not convert testing or cleanup into unrelated Phase-3/4 scope.

---

## Phase-2 / PV-1 relationship

Use this wording when ambiguity is possible:

> **PV-1 (Phase 2 test)**

PV-1 exists to validate whether the Phase-2 Tactical Combat & Battle Platform is understandable, enjoyable, stable, and ready for an explicit Owner phase-exit decision.

```text
OWNER TESTING / PHASE-2 STABILIZATION
  ↓
PV-1 (PHASE 2 TEST)
  ↓
Only justified contained Phase-2 corrections
  ↓
Owner evidence/review
  ↓
EXPLICIT OWNER DECISION
  ├── KEEP TESTING → smallest repeated defect → retest
  └── PHASE 2 DONE
        ↓
      reconcile #105 + TASKS factually
        ↓
      activate docs/PHASE_3_TICKETS.md
        ↓
      start P3.1
```

Never fabricate human evidence or metrics.

A statement that Phase 1 is complete does **not** close Phase 2. A PV-1 pass/decision should be recorded separately from the later explicit instruction to begin Phase 3 if the Owner chooses to keep polishing Phase 2 first.

---

## Future Phase 3 execution sequence — inactive

When, and only when, the Owner explicitly closes Phase 2 and authorizes Phase 3, the sequence remains:

```text
P3.1 Discipline build authority + Primary profiles
  ↓
P3.2 Secondary + independent attunement cooldowns
  ↓
P3.3 Mature Skill schema + cooldown engine
  ↓
P3.4 Profile Skill configuration + pure/mixed capacity
  ↓
P3.5 Resonance framework + mixed proof
  ↓
P3.6 Essence framework + pure proof
  ↓
P3.7 Shared AI / PvP / saved-loadout build snapshots
  ↓
P3.8 Representative buildcraft slice + PV-2 readiness
```

Phase 3 feeds PV-2 before Phase-4 roster expansion.

---

## Approved future long-horizon direction — not active implementation

### Rekindling replay differentiation

Authority: `docs/REKINDLING_FRONTIER.md`.

Approved direction:

- Rekindling should not repeat the identical progression journey;
- use Memory Carryover, Echo Routes, history-aware NPC/mentor interactions, alternate progression/build goals, abbreviated mastered tutorials and Hall of Selves;
- later cycles remain meaningful long journeys rather than becoming a trivial XP multiplier loop.

### The Unwritten Reach

Authority: `docs/REKINDLING_FRONTIER.md`.

Approved direction:

- common phrase: Edge of the World;
- working system/lore name: Unwritten Reach;
- persistent Anchors + mutable Driftspace;
- deterministic Cartographic Drift;
- Frontier Acumen based on demonstrated knowledge;
- legendary explorer identity through rare deeds/Chronicle attribution;
- working far-inhabitant concept: Veyr;
- long-term continuity threat: Inward Drift.

This is future Phase-5+ scope and must not leak into active Phase 2 work.

### Anomalies

Authority: `docs/ANOMALIES.md`.

Anomaly means **Owner-granted exceptional character state**, not frontier rarity/acquisition.

Initial approved forms:

```text
Soulmark + Mantle
Two Soulmarks
Two Mantles
```

Ordinary gameplay cannot earn/find/craft/trade/buy/roll these states. Creation/revocation uses audited server-authoritative Master Panel / Owner Override workflow, and gameplay-affecting Anomalies remain excluded from standard ranked PvP by default.

---

## Current documentation truth

- `docs/ROADMAP.md` — canonical phase plan.
- `AGENTS.md` — permanent coding/execution guidance.
- `docs/COMBAT.md` — current combat authority.
- `docs/ROADMAP_PRODUCT_VALIDATION.md` — validation authority; PV-1 is the Phase-2 tactical/battle-platform gate.
- `docs/PHASE_2_TICKETS.md` — historical Phase-2 record.
- `docs/PHASE_3_TICKETS.md` — future exact Phase-3 sequence; inactive until explicit Owner authorization.
- `docs/ROADMAP_BUILD_SYSTEM_REWORK.md` — build-system sequencing companion.
- `docs/REKINDLING_FRONTIER.md` — Rekindling + Unwritten Reach authority.
- `docs/ANOMALIES.md` — Owner-only exceptional Anomaly authority.
- `docs/OWNER_OVERRIDE.md` / `docs/MASTER_PANEL.md` — privileged operational authority.

Passive Training early-stop reward semantics still require explicit canonical reconciliation if runtime behavior and a domain specification disagree. Do not silently choose.

---

## Permanent execution rules

1. Inspect current `main`, open implementation/validation PRs/issues, roadmap and canonical domain docs before work.
2. One canonical implementation/correction boundary is active at a time unless the Owner authorizes a wider verified batch.
3. Owner testing may remain active while no implementation ticket is active.
4. Never use future feature breadth to hide a failed validation gate.
5. Early-delivered compatible work receives roadmap credit and is reused later.
6. Automated tests prove implementation safety, not human/product validation.
7. Reconcile repository truth at every phase boundary.
8. Phase activation and deployment authorization are separate decisions.
9. Keep this ledger current and concise.
