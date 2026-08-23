# AUREVANE — Active Task Ledger

This file reports the **current implementation/validation boundary**. It does not duplicate historical ticket diaries.

The Master Game Plan defines the product. `docs/ROADMAP.md` defines the current phase sequence and now formally credits the extended Phase-2 battle-platform work. Canonical domain documents define system rules. This ledger reports what is actually active now.

**Reconciled:** 2026-08-23

---

## Current status

**Stage:** Phase 2 — Tactical Combat & Battle Platform — **Owner testing / stabilization / PV-1 exit validation**

**Phase-2 implementation state:** the original combat-core scope is delivered and substantially exceeded. Direct PvP, multi-format battles, spectation, battle communications and major battle-presentation/hardening foundations are now formally credited as Phase-2 delivered battle-platform scope.

**ACTIVE VALIDATION GATE:** issue #105 — PV-1C Conduct Tactical Combat Human/Internal Validation — **OPEN**

**OWNER TESTING:** active. The Owner is still testing selected current features. Do not infer a PASS from automated checks or from production deployment.

**ACTIVE IMPLEMENTATION / CORRECTION CANDIDATE:** PR #159 — Scale desktop battle rails for six combatants — open at the time of this reconciliation. Treat it as contained Phase-2 battle-platform presentation/stability work, not Phase-3 expansion.

**RECENT MERGED BATTLE-PLATFORM WORK:** PR #160 — spectator presentation parity/Inspect/log polish — merged and credited to the Phase-2 spectator foundation.

**NEXT MAJOR FEATURE PHASE:** Phase 3 — Signature Buildcraft Foundation — blocked until the current Phase-2 candidate is stabilized and the required PV-1 decision is explicitly recorded.

---

## What Phase 2 now formally contains

The revised roadmap intentionally absorbs the above-and-beyond work instead of pretending it did not happen.

### Tactical combat foundation

- deterministic/server-authoritative battle state;
- current 100-AP shared Action Economy;
- movement/path/terrain/elevation/facing;
- Basic Attack / Guard / Recover;
- typed targeting/requirement/effect foundations;
- statuses and deterministic resolution;
- authoritative intent + battle-version persistence;
- reconnect/idempotency/concurrency protections;
- responsive battlefield-first combat UI;
- forecasts, Inspect, combatant state and shared battle logs;
- combat keybind and mobile/touch foundations;
- Recruit AI and Battle Hall / AI Sparring;
- larger-map/usability correction work;
- surrender/abort/result foundations.

### Direct PvP foundation delivered early

- authoritative PvP lobbies and participants;
- lobby keys;
- shared persisted PvP battle sessions;
- multiple supported battle-format configurations;
- PvP turn-timing foundations;
- surrender;
- battle-state handoff/reconnect/polling hardening;
- battle chat/communication foundation;
- desktop/mobile PvP presentation;
- active-session mutation/navigation protections;
- multi-combatant UI work.

### Spectation foundation delivered early

- keyed read-only spectation;
- spectator authorization/join/leave;
- spectator presence/roster/count;
- read-only committed battle projection;
- spectator battle logs and communications;
- responsive spectator battlefield presentation;
- spectator Inspect foundation;
- spectator security/session regression coverage.

This is now **official roadmap credit**. Mature ranked/matchmaking/seasons/tournaments/Colosseum-public-discovery work remains Phase 8.

---

## What is allowed while Owner testing continues

One contained correction batch at a time may address real findings in:

- battle readability/scale;
- multi-combatant rails/Inspect;
- PvP turn handoff and responsiveness;
- AI/PvP desktop/mobile parity;
- spectator clarity;
- battle log quality;
- battle communication/timing regressions;
- active battle/spectation session safety;
- profile/training/session interactions that materially affect the tested flow;
- genuine authority/security defects.

Do not turn testing into an excuse to begin unrelated Phase-3/4 breadth.

---

## Current known design/document reconciliation

- `docs/COMBAT.md` is current combat authority. The historical Movement Budget + one Action model in older Phase-2 material is superseded by the 100-AP shared Action Economy.
- `docs/ROADMAP.md` has been rewritten to the current project state.
- Older Phase-2/Tactical Hall wording is historical where it conflicts with current Battle Hall terminology.
- Product-validation/buildcraft documents that still use retired Current/Legacy/Confluence terminology should be reconciled before Phase-3/PV-2 implementation begins.
- Passive Training early-stop reward semantics currently require explicit canonical reconciliation if the tested runtime behavior is retained; do not silently let a subordinate implementation/history document redefine the permanent design.

---

## Phase-2 exit sequence

```text
OWNER TESTING / CURRENT FEATURE STABILIZATION
  ↓
Finish only justified contained Phase-2 battle-platform corrections
  ↓
Freeze a representative validation candidate
  ↓
Run/complete real human PV-1 sessions under issue #105
  ↓
Review qualitative evidence + telemetry + confounders
  ↓
EXPLICIT DECISION
  ├── FAIL
  │     ↓
  │   smallest repeated combat/usability correction
  │     ↓
  │   rerun affected validation slice
  │
  └── PASS
        ↓
      close Phase 2 / #105
        ↓
      open Phase 3 Signature Buildcraft Foundation
```

No human PASS may be fabricated, simulated or inferred from automation.

---

## Next major phase — Phase 3

Once Phase 2 exits, the next coherent feature investment is:

1. Primary Discipline base-stat profiles and authoritative selection rules;
2. Secondary Discipline and independent attunement cooldowns;
3. mature Skill schema and generic cooldown engine;
4. pure 8-Skill versus mixed 6-Skill capacity;
5. Character Profile build headquarters;
6. Resonance framework/library;
7. pure-Discipline Essence framework/Skills;
8. saved-loadout legality;
9. AI understanding of released Skills/build state;
10. reuse the already-built direct PvP battle platform for build snapshot/legality testing rather than rebuilding multiplayer later.

Phase 3 then feeds PV-2 / buildcraft identity validation before broad roster expansion.

---

## Permanent execution rules

1. Inspect current `main`, open implementation/validation PRs/issues, the current roadmap and applicable canonical domain docs before starting work.
2. One canonical implementation/correction boundary is ACTIVE at a time unless the Owner explicitly authorizes a broader verified batch.
3. Owner testing may remain active while implementation is temporarily none.
4. Never use future feature breadth to hide a failed validation gate.
5. Early-delivered compatible work receives roadmap credit and is reused later.
6. Automated tests prove implementation safety, not fun or product validation.
7. Reconcile repository truth at every phase boundary.
8. Keep this ledger concise and current.
