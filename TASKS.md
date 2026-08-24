# AUREVANE — Active Task Ledger

This file reports the **current implementation/validation boundary**. It does not duplicate historical ticket diaries.

The Master Game Plan defines the product. `docs/ROADMAP.md` defines the current phase sequence. Canonical domain documents define system rules. Current `docs/PHASE_*_TICKETS.md` files define active/next execution details. This ledger reports what is actually active now.

**Reconciled:** 2026-08-23

---

## Current status

**Stage:** Phase 2 — Tactical Combat & Battle Platform — **Owner testing / stabilization / PV-1 exit validation**

**Phase-2 implementation state:** original combat-core scope is delivered and substantially exceeded. Direct PvP, multiple battle formats, spectation, battle communications, shared battle logs and major battle-presentation/hardening foundations are formally credited as delivered Phase-2 battle-platform scope.

**ACTIVE VALIDATION GATE:** issue #105 — PV-1 Tactical Combat Human/Internal Validation — **OPEN until explicitly reconciled/closed**.

**OWNER TESTING:** active. The Owner is still testing selected current features. Do not infer a PASS from automation, merges or deployment.

**ACTIVE IMPLEMENTATION TICKET:** none at this reconciliation point.

New implementation should be either:

- one contained Phase-2 correction justified by current Owner/testing findings; or
- **P3.1** after the Owner explicitly closes Phase 2 and activates Phase 3.

**Recent merged battle-platform work:**

- PR #159 — six-combatant desktop battle rails/Inspect — merged;
- PR #160 — spectator presentation parity/Inspect/log polish — merged.

**NEXT MAJOR FEATURE PHASE:** Phase 3 — Signature Buildcraft Foundation.

---

## Current documentation truth

- `docs/ROADMAP.md` is the reconciled canonical phase plan.
- `docs/COMBAT.md` is current combat authority.
- `docs/PHASE_2_TICKETS.md` is historical and cannot restore Movement Budget + one Action.
- `docs/PHASE_3_TICKETS.md` is the exact next implementation plan once Phase 2 closes.
- `docs/ROADMAP_BUILD_SYSTEM_REWORK.md` is aligned so first Resonance and Essence foundations belong to Phase 3; Phase 4 scales them.
- `docs/ROADMAP_PRODUCT_VALIDATION.md` uses current build/combat terminology and now includes Rekindling/frontier validation gates.
- `docs/REKINDLING_FRONTIER_ANOMALIES.md` is the binding long-horizon frontier/Rekindling/Anomaly design extension.
- `AGENTS.md` carries the current phase-transition and future frontier execution rules.

Passive Training early-stop reward semantics still require explicit canonical reconciliation if runtime behavior and the current domain spec disagree. Do not silently choose.

---

## What Phase 2 formally delivered

### Tactical combat

- deterministic/server-authoritative battle state;
- current 100-AP shared Action Economy;
- movement/path/terrain/elevation/facing;
- Basic Attack / Guard / Recover;
- typed targeting/requirements/effects;
- statuses and deterministic resolution;
- authoritative intent + battle-version persistence;
- reconnect/idempotency/concurrency protections;
- responsive battlefield-first UI;
- forecasts/Inspect/combatant state/shared battle logs;
- keybind/mobile foundations;
- Recruit AI and Battle Hall / AI Sparring;
- larger-map/usability work;
- surrender/abort/result foundations.

### Direct PvP delivered early

- authoritative lobbies/participants;
- lobby keys;
- persisted shared PvP sessions;
- multiple battle-format configurations;
- turn timing;
- surrender;
- reconnect/handoff/polling hardening;
- battle chat;
- desktop/mobile presentation;
- active-session protections;
- multi-combatant UI.

### Spectation delivered early

- keyed read-only spectation;
- spectator authorization/join/leave;
- presence/roster/count;
- read-only committed battle projection;
- spectator logs/communications;
- responsive spectator battlefield;
- Inspect;
- security/session regression coverage.

This is official roadmap credit. Mature ranked/matchmaking/seasons/tournaments/Colosseum work remains Phase 8.

---

## Allowed while Owner testing continues

One contained correction batch at a time may address real findings in:

- battle readability/scale;
- multi-combatant rails/Inspect;
- PvP handoff/responsiveness;
- AI/PvP desktop/mobile parity;
- spectator clarity;
- battle logs;
- communication/timing regressions;
- active battle/spectation safety;
- profile/training/session interactions affecting the tested flow;
- genuine authority/security defects.

Do not turn testing into unrelated Phase-3/4 breadth.

---

## Phase-2 exit sequence

```text
OWNER TESTING / CURRENT FEATURE STABILIZATION
  ↓
Only justified contained Phase-2 corrections
  ↓
Freeze representative candidate
  ↓
Review real PV-1 evidence / Owner findings
  ↓
EXPLICIT DECISION
  ├── FAIL → smallest repeated defect → retest
  └── OWNER CLOSES PHASE 2 / PASS
        ↓
      reconcile #105 + TASKS factually
        ↓
      activate docs/PHASE_3_TICKETS.md
        ↓
      start P3.1
```

Never fabricate human evidence or metrics.

---

## Owner Phase-3 activation rule

If the Owner clearly says wording equivalent to:

- “Phase 2 is done.”
- “We are done with Phase 2; start Phase 3.”
- “Proceed to Phase 3.”
- “Code Phase 3.”

then treat it as explicit authorization to transition the feature roadmap into Phase 3.

Do not ask the Owner to repeat a clear instruction because an older issue still shows Phase 2 open.

Before runtime implementation, inspect current repository truth, reconcile the phase boundary and activate **P3.1 — Discipline Build Authority + Primary Base Profiles**.

This does **not** authorize Vercel deployment.

---

## Phase 3 execution sequence

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

## Newly approved long-horizon direction — not active implementation

The updated roadmap now formally includes:

### Rekindling replay differentiation

- Rekindling should not repeat the identical journey;
- later cycles use Memory Carryover, Echo Routes, history-aware NPC/mentor interactions, alternate progression/build goals, abbreviated mastered tutorials, Hall of Selves and frontier history;
- later cycles remain meaningful long journeys rather than becoming a trivial XP multiplier loop.

### The Unwritten Reach

- common player/NPC phrase: **Edge of the World**;
- canonical working name: **Unwritten Reach**;
- authored persistent **Anchors** connected by mutable deterministic **Driftspace**;
- server-seeded **Cartographic Drift** gives near-infinite exploration feeling without uncontrolled infinite generation;
- frontier ties directly to the Unchosen/Unmoored/Closed Horizon/Great Vane mythology.

### Frontier Acumen / legendary explorers

- frontier mastery represents proven knowledge/competencies rather than a universal damage reputation bar;
- famous explorers can earn Chronicle attribution, rare epithets, Archive/map recognition and exceptional investigation access.

### Veyr / Inward Drift — working lore concepts

- **Veyr:** non-monolithic far-inhabitant culture shaped by unstable continuity;
- **Inward Drift:** frontier-like contradictions beginning to appear inside stable civilization, creating a looming reality threat rather than a generic invading army.

### Anomalies

- exceptionally rare irregular-origin Skills/items/effects/memories/traversal capabilities or exceptional acquisitions;
- usually not obtainable through ordinary sanctioned progression;
- in-world unsanctioned/forbidden routes may exist;
- exploiting/cheating is never legitimate acquisition;
- provenance/server authority/competitive legality required;
- no cash-only Anomaly combat power;
- no ultra-rare Anomaly required for standard competitive viability;
- Anomalous Disciplines are exceptional future possibilities requiring separate Owner approval, not routine frontier rewards.

Roadmap timing:

```text
Phase 5  → first small Reach threshold / Anchor / Drift proof
Phase 6  → party frontier support where useful
Phase 7  → deep Reach / Acumen / Veyr / first Anomaly proof
Phase 8  → competitive Anomaly legality
Phase 9  → controlled frontier/catalog scale
Phase 10 → explorer social identity / Ledger / route sharing
Phase 11 → frontier economy / provenance / contraband rules
Phase 12 → nation policies toward Reach / Veyr / Anomalies
Phase 13 → full Reach/Anomaly operations tooling
Phase 14 → production frontier art/audio identity
Phase 15 → drift/provenance/exploit/scale hardening
Endgame → mature Rekindling replayability validation
```

This is future scope. Do not implement it early merely because the design is now approved.

---

## Permanent execution rules

1. Inspect current `main`, open implementation/validation PRs/issues, roadmap and applicable canonical docs before work.
2. One canonical implementation/correction boundary is ACTIVE at a time unless the Owner explicitly authorizes wider work.
3. Owner testing may remain active while implementation is none.
4. Never use future feature breadth to hide a failed validation gate.
5. Early-delivered compatible work receives roadmap credit/reuse.
6. Automated tests prove implementation safety, not fun/product validation.
7. Reconcile repository truth at every phase boundary.
8. Phase activation and deployment authorization are separate decisions.
9. Future frontier work must follow `docs/REKINDLING_FRONTIER_ANOMALIES.md` rather than improvising a generic procedural zone.
10. Keep this ledger concise and current.