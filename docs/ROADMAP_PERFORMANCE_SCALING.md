# AUREVANE — Performance & Scaling Roadmap

**Status:** Owner-approved companion roadmap

**Added:** 2026-08-26

**Authority:** This document is subordinate to `docs/GAME_MASTER_PLAN.md`, `docs/ROADMAP.md`, `TASKS.md`, and applicable canonical domain documents. It defines behavior-preserving performance/scaling work only. It never authorizes a gameplay redesign.

---

# 1. Non-negotiable guardrails

Performance work must preserve the game that already exists.

1. Do not change combat rules, timers, rewards, progression, PvP semantics, spectator permissions, training semantics, or session ownership merely to improve metrics.
2. Authoritative gameplay state remains server-side.
3. `commit_battle_intent_v2` and equivalent authoritative mutation boundaries must not be bypassed or weakened.
4. Security/RLS/authentication boundaries must not be relaxed for performance.
5. Prefer additive, reversible, measurable changes.
6. Inspect real call sites and runtime behavior before changing polling architecture.
7. Make one contained optimization boundary at a time and verify before continuing.
8. Stop optimizing when evidence shows the remaining benefit is marginal.
9. Realtime, if adopted later, is advisory/invalidation for authoritative gameplay unless a canonical design explicitly says otherwise.
10. Never remove an index or rewrite an authority path based only on low-traffic development statistics.

---

# 2. Baseline — 2026-08-26

Current Supabase evidence indicates the database is healthy and has substantial headroom:

- low connection pressure and no observed deadlocks;
- ordinary battle/PvP/session reads are generally very fast;
- CPU, disk I/O, network, connection, and storage graphs are not showing sustained saturation;
- the primary scaling opportunity is request/polling efficiency rather than raw PostgreSQL query speed;
- historical transaction rollback counts are anomalously high and require historical explanation, but current sampling does not show an active runaway rollback/request loop;
- `commit_battle_intent_v2` has healthy average latency but historical high-tail outliers worth investigating;
- current combat mutation code already includes idempotency, request-fingerprint validation, expected battle-version checks, row locking, authoritative snapshots/events, and terminal-state protection;
- active game-session leasing and character online presence are separate responsibilities and must not be conflated during optimization.

Phase-2 additive hardening completed 2026-08-26:

- added `app_private.pvp_lobby_members(user_id)` supporting index;
- added `app_private.product_validation_events(character_id)` supporting index;
- reran Supabase performance advisor and confirmed both unindexed-FK findings cleared.

Unused-index notices remain informational only and do not authorize removal.

---

# 3. Automatic checkpoint rule

Performance/scaling is a continuous cross-cutting responsibility. It is **not** postponed until the late security/scale phase.

Run a performance checkpoint automatically when any of the following is true:

1. a phase boundary is being reconciled;
2. a phase materially increases persistent state, request volume, concurrency, or realtime traffic;
3. a new multiplayer/social/economy system is about to expand concurrent reads/writes;
4. monitoring shows sustained latency, connection, CPU, memory, I/O, network, rollback, deadlock, lock-wait, or error regression;
5. Owner testing exposes responsiveness or timeout behavior that may be architectural rather than purely UI/gameplay.

High-value planned checkpoints include:

- completed Phase-2 stabilization / PV-1 exit checkpoint, retained as the comparison baseline;
- Phase 3 build snapshots and build-state reads;
- Phase 4 roster/content expansion;
- Phase 6 co-op concurrency;
- Phase 7 long-running Expeditions;
- Phase 8 competitive PvP scale;
- Phase 10 social/presence growth;
- Phase 11 economy/trade load;
- Phase 15 full pre-alpha scale/security hardening.

At each checkpoint, do only what current evidence justifies.

---

# 4. Standard checkpoint procedure

For each automatic checkpoint:

1. inspect current repository/runtime truth before proposing changes;
2. baseline Supabase/Vercel resource and error health;
3. rerun Supabase performance/security advisors;
4. inspect top RPC/request volume and p50/p95/p99 latency where available;
5. inspect connection/pool pressure, locks/deadlocks, commit/rollback trends, CPU, memory, disk I/O, WAL/network and table growth where relevant;
6. trace the actual frontend/server call sites responsible for hot RPCs;
7. identify duplicate/overlapping/in-flight equivalent reads before changing intervals;
8. compare against the last baseline;
9. apply the smallest behavior-preserving improvement;
10. rerun automated/database/browser checks and the relevant human test flow;
11. stop if evidence does not justify further complexity.

---

# 5. Phase-2 checkpoint — closed baseline

Phase 2 is formally closed. The work below is retained as the measured PV-1/Phase-2 comparison baseline; Phase-3 checkpoints must preserve those authority and behavior guarantees.

## P2-PERF.1 — Diagnosis and baselining

- preserve current Supabase resource screenshots and DB/RPC observations as comparison baseline;
- trace actual battle/PvP/session/presence polling call sites;
- identify duplicate and overlapping requests;
- keep account game-session lease checks separate from character presence semantics;
- investigate the historical rollback window without changing current request semantics;
- investigate `commit_battle_intent_v2` p95/p99/tail behavior without altering combat semantics.

## P2-PERF.2 — Additive database hardening

Completed 2026-08-26:

- add verified missing FK-supporting indexes only;
- rerun Supabase performance/security advisors after DDL;
- do not delete unused indexes;
- do not alter authoritative functions solely for benchmark gains.

## P2-PERF.3 — Safe client request hygiene

Only after code tracing proves a concrete duplicate/overlap:

- single-flight equivalent in-flight reads by resource/RPC + arguments;
- prevent overlapping identical polling requests;
- cancel superseded reads on navigation where safe;
- reduce background/hidden-tab visual polling while forcing immediate authoritative refresh on focus;
- preserve session lease, timeout, reconnect, and battle-authority behavior.

Regression checks must cover combat, PvP timers, reconnect, multiple tabs, spectation, training/session interactions, and the current PV-1 flows.

---

# 6. Later measured scaling work

## PERF.4 — Version-aware battle reads

Use the existing monotonic authoritative battle version as a read-side optimization so unchanged battle state can return a small explicit unchanged result instead of retransmitting full state.

Rules:

- version remains server-owned;
- mutation + version increment remain atomic;
- read optimization must not silently redefine write concurrency semantics.

## PERF.5 — Selective PvP read consolidation

Consider a bounded battle-live-state read model containing only state commonly needed together, such as:

- battle snapshot/version;
- turn/timer state;
- incremental battle events;
- optionally spectator count when justified.

Keep unrelated consumption patterns independent by default:

- chat;
- full spectator roster;
- global online-character presence.

Do not create a single all-purpose god RPC without measured evidence.

## PERF.6 — Realtime candidates

Adopt incrementally, not as a sweep.

Best early candidates:

- chat;
- spectator presence;
- global online-character presence.

Potential later hybrid candidate:

- authoritative battle/turn change invalidation signal -> client refetches authoritative RPC state.

Realtime messages must not decide hits, victory, rewards, XP, turn legality, timeout ownership, or any other fairness-critical state.

## PERF.7 — Load and concurrency validation

Before real scale, test at minimum:

- simultaneous combatant submissions;
- manual action racing timer expiry;
- duplicate submission/network retry;
- stale battle version;
- two tabs for one authenticated player;
- reconnect at a turn boundary;
- large spectator counts;
- concurrent-battle ramps;
- turn-boundary bursts;
- sustained soak testing.

Track p50/p95/p99 latency, requests/sec per RPC, pool utilization, connections, lock waits, rollback/commit trends, CPU, memory, disk I/O, WAL, network throughput, and table growth.

---

# 7. Explicitly deferred unless evidence justifies them

Do not do these merely as speculative optimization:

- full event-sourcing/CQRS rewrite;
- moving authoritative combat resolution into Realtime;
- broad caching/materialized-view architecture for tiny fast reads;
- blanket Realtime conversion;
- blanket polling interval changes that could affect responsiveness;
- removal of unused indexes from low-traffic statistics;
- weakening idempotency, version checks, row locks, RLS, or session lease guarantees;
- increasing infrastructure size before current resource headroom is actually consumed.

---

# 8. Execution order

```text
PHASE-2 CHECKPOINT COMPLETE                  2026-09-03
  ↓
PHASE 3 ACTIVE
  ↓
P3.1 authoritative build-state boundary
  ↓
Measure build-state read/write behavior and preserve server authority
  ↓
Future automatic performance checkpoints at phase/scale boundaries
  ↓
Version-aware reads / selective consolidation / Realtime only when evidence justifies them
```
