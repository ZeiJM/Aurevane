# AUREVANE — Active Task Ledger

This file reports the **current implementation/validation boundary**. It does not duplicate historical ticket diaries.

The Master Game Plan defines the product. `docs/ROADMAP.md` defines the current phase sequence. Canonical domain documents define system rules. Current `docs/PHASE_*_TICKETS.md` files define active/next execution details. This ledger reports what is actually active now.

**Reconciled:** 2026-08-23

---

## Current status

**Stage:** Phase 2 — Tactical Combat & Battle Platform — **Owner testing / stabilization / PV-1 exit validation**

**Phase-2 implementation state:** the original combat-core scope is delivered and substantially exceeded. Direct PvP, multi-format battles, spectation, battle communications, shared battle logs and major battle-presentation/hardening foundations are formally credited as delivered Phase-2 battle-platform scope.

**ACTIVE VALIDATION GATE:** issue #105 — PV-1C Conduct Tactical Combat Human/Internal Validation — **OPEN**

**OWNER TESTING:** active. The Owner is still testing selected current features. Do not infer a PASS from automated checks, merges or deployment.

**ACTIVE IMPLEMENTATION TICKET:** none at this reconciliation point. New implementation should be either:

- one contained Phase-2 correction justified by current Owner/testing findings; or
- P3.1 after the Owner explicitly closes Phase 2 and activates Phase 3.

**RECENT MERGED BATTLE-PLATFORM WORK:**

- PR #159 — six-combatant desktop battle rails/Inspect presentation — merged;
- PR #160 — spectator presentation parity/Inspect/log polish — merged.

**NEXT MAJOR FEATURE PHASE:** Phase 3 — Signature Buildcraft Foundation.

---

## What Phase 2 now formally contains

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

This is official roadmap credit. Mature ranked/matchmaking/seasons/tournaments/Colosseum-public-discovery work remains later competitive scope.

---

## What is allowed while Owner testing continues

One contained correction batch at a time may address real findings in:

- battle readability/scale;
- multi-combatant rails/Inspect;
- PvP turn handoff and responsiveness;
- AI/PvP desktop/mobile parity;
- spectator clarity;
- battle-log quality;
- battle communication/timing regressions;
- active battle/spectation session safety;
- profile/training/session interactions that materially affect the tested flow;
- genuine authority/security defects.

Do not turn testing into an excuse to begin unrelated Phase-3/4 breadth.

---

## Current documentation truth

- `docs/ROADMAP.md` is the reconciled phase plan.
- `docs/COMBAT.md` is current combat authority.
- `docs/PHASE_2_TICKETS.md` is now historical and explicitly marks its old Movement Budget + one Action assumptions as superseded.
- `docs/PHASE_3_TICKETS.md` is the exact next implementation plan once Phase 2 is closed.
- `docs/ROADMAP_BUILD_SYSTEM_REWORK.md` is aligned so first Resonance and Essence foundations belong to Phase 3; Phase 4 scales them.
- `docs/ROADMAP_PRODUCT_VALIDATION.md` uses current Primary/Secondary/Resonance/Essence and Action Economy terminology.
- Passive Training early-stop reward semantics still require explicit canonical reconciliation if runtime behavior and the current canonical domain spec disagree; do not silently choose.

---

## Phase-2 exit sequence

```text
OWNER TESTING / CURRENT FEATURE STABILIZATION
  ↓
Only justified contained Phase-2 corrections
  ↓
Freeze a representative validation candidate
  ↓
Review real PV-1 evidence / Owner testing findings
  ↓
EXPLICIT DECISION
  ├── FAIL
  │     ↓
  │   smallest repeated combat/usability correction
  │     ↓
  │   rerun affected validation slice
  │
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

If the Owner explicitly says wording equivalent to:

- “Phase 2 is done.”
- “We are done with Phase 2; start Phase 3.”
- “Proceed to Phase 3.”
- “Code Phase 3.”

then treat it as explicit authorization to transition the feature roadmap into Phase 3.

Do not ask the Owner to repeat a clear instruction because an older issue still shows Phase 2 open.

Before runtime implementation, inspect current repository truth, reconcile the phase boundary and activate **P3.1 — Discipline Build Authority + Primary Base Profiles**.

This phase-transition authorization does **not** authorize a Vercel deployment.

---

## Phase 3 execution sequence

```text
P3.1  Discipline build authority + Primary profiles
  ↓
P3.2  Secondary Discipline + independent attunement cooldowns
  ↓
P3.3  Mature Skill schema + generic cooldown engine
  ↓
P3.4  Profile Skill configuration + pure/mixed capacity
  ↓
P3.5  Resonance framework + representative mixed build
  ↓
P3.6  Essence framework + representative pure build
  ↓
P3.7  Build snapshots across AI / PvP / saved loadouts
  ↓
P3.8  Representative buildcraft slice + PV-2 readiness
```

Phase 3 then feeds PV-2 / buildcraft identity validation before Phase-4 roster expansion.

---

## Permanent execution rules

1. Inspect current `main`, open implementation/validation PRs/issues, the current roadmap and applicable canonical domain docs before starting work.
2. One canonical implementation/correction boundary is ACTIVE at a time unless the Owner explicitly authorizes a wider verified batch.
3. Owner testing may remain active while implementation is temporarily none.
4. Never use future feature breadth to hide a failed validation gate.
5. Early-delivered compatible work receives roadmap credit and is reused later.
6. Automated tests prove implementation safety, not fun or product validation.
7. Reconcile repository truth at every phase boundary.
8. Phase activation and deployment authorization are separate decisions.
9. Keep this ledger concise and current.