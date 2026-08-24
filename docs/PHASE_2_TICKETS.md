# AUREVANE — Phase 2 Tactical Combat & Battle Platform — Historical Record

**Status:** Historical implementation record. **Not an active implementation specification.**

**Reconciled:** 2026-08-23

**Current authority:** `docs/ROADMAP.md`, `docs/COMBAT.md`, `TASKS.md`, `docs/ROADMAP_PRODUCT_VALIDATION.md`, and the applicable canonical domain specifications.

This file replaces the older active Phase-2 ticket document so obsolete mechanics and sequencing cannot accidentally be treated as current instructions. The detailed original P2.1–P2.7 ticket text remains preserved in Git history.

---

## 1. Why this file is historical

The original Phase-2 plan intentionally targeted the smallest tactical-combat vertical slice. During implementation and Owner feedback, AUREVANE deliberately evolved beyond that minimum and also changed important combat rules.

The current roadmap therefore treats Phase 2 as **Tactical Combat & Battle Platform**, not merely Tactical Combat Core.

Do not use the old Phase-2 ticket history to override current design.

In particular, these original assumptions are superseded:

- **Movement Budget + one Action** is retired;
- binary `Action Ready / Spent` is retired as the normal current turn model;
- split movement around one Action is no longer the canonical generic turn grammar;
- **Tactical Hall** is retired as the current player-facing practice destination;
- the current player-facing destination is **Battle Hall**;
- direct PvP and spectation are no longer treated as wholly unimplemented future systems.

`docs/COMBAT.md` is definitive for current combat rules.

---

## 2. Current Phase-2 combat baseline

Current combat uses one shared **Action Economy**, displayed as AP, normally starting at 100 AP.

Current implemented baseline costs are:

```text
Inspect                         0 AP
Move, normal traversal point   25 AP
Move, terrain cost 2           50 AP
Basic Attack                   30 AP
Guard                          30 AP
Recover                        50 AP
Final Facing                    0 AP and ends the turn
```

Multiple legal commands may occur while AP remains.

Never restore the obsolete Movement Budget + one Action model merely because it existed in the original Phase-2 implementation tickets.

---

## 3. Original Phase-2 implementation sequence — delivered history

The original implementation sequence was broadly:

```text
P2.1 deterministic battle state / turn-economy foundation
  ↓
P2.2 board / movement / terrain / facing
  ↓
P2.3 targeting / combat actions / effect grammar
  ↓
P2.4 authoritative persisted battle session
  ↓
P2.5 responsive player battle experience
  ↓
P2.6 Recruit AI / practice vertical slice
  ↓
P2.7 combat usability / battlefield scale / controls / exit proof
  ↓
PV-1 correction and usability iterations
```

These tickets are **implemented history**, not future work.

Their durable architectural outcomes include:

- deterministic/server-authoritative battle state;
- typed combat definitions and versioned rules/content;
- authoritative movement/target/effect legality;
- terrain/elevation/facing foundations;
- persisted battle sessions;
- idempotent/stale-version-safe command handling;
- responsive battle presentation;
- Recruit AI using shared legality;
- Battle Hall / AI Sparring foundations;
- human-usability correction work.

---

## 4. Delivered beyond the original Phase-2 minimum

The extended Phase-2 cycle also produced reusable battle-platform capability that the current roadmap now formally credits rather than rebuilding later.

### Direct PvP foundation

Delivered foundation includes:

- server-authoritative PvP lobbies and participant mapping;
- lobby keys;
- persisted shared PvP battles;
- multiple supported format configurations, including current 1v1, 2v2, 3v3, three-way and flexible-team variants;
- turn-timing foundations;
- surrender/forfeit foundations;
- reconnect/handoff/polling hardening;
- battle communication foundations;
- active-session safety;
- responsive PvP battle presentation;
- multi-combatant presentation foundations.

### Spectation foundation

Delivered foundation includes:

- keyed read-only spectation;
- spectator authorization/join/leave;
- spectator presence/roster/count;
- read-only committed battle projection;
- spectator battle logs and communication foundations;
- responsive spectator battlefield presentation;
- spectator combatant/terrain Inspect;
- spectator mutation/security protections.

This work is official roadmap credit. Mature ranked/matchmaking/seasons/tournaments/Colosseum/public-discovery capability remains later work under the current Phase 8.

---

## 5. Current Phase-2 status

As of this reconciliation:

- engineering implementation is mature and substantially beyond the original minimum;
- Owner testing of selected current features is still active;
- PV-1 / Phase-2 human exit validation remains open until explicitly decided;
- contained regression/usability/stability correction remains valid Phase-2 work;
- unrelated Phase-3/4 feature breadth remains blocked until Phase 2 is explicitly closed.

Automated checks, merges and deployments do not create a human PV PASS by themselves.

---

## 6. Phase-2 exit protocol

Phase 2 closes through this sequence:

```text
OWNER TESTING / CURRENT FEATURE STABILIZATION
  ↓
Only justified contained Phase-2 corrections
  ↓
Representative candidate frozen
  ↓
Real PV-1 evidence reviewed
  ↓
Explicit Owner / project decision
  ├── FAIL → smallest repeated defect → retest
  └── PASS → Phase 2 closed → Phase 3 activated
```

Do not fabricate tester evidence. If the Owner explicitly declares Phase 2 complete after their testing, record the factual Owner decision and repository state without inventing metrics that were not collected.

---

## 7. After Phase 2 closes

Once the Owner explicitly closes Phase 2:

- this file remains historical;
- normal new feature implementation moves to `docs/PHASE_3_TICKETS.md`;
- Phase-2 code may still receive security, regression, compatibility and bug fixes when justified;
- no new feature should be labeled Phase 2 merely because it touches combat;
- existing PvP/spectator foundations are inherited by later phases and audited rather than rebuilt.

Git history remains the source for the exact original P2.1–P2.7 acceptance text and implementation-era details.