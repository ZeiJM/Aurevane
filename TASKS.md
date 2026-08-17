# AUREVANE — Active Task Ledger

This file is intentionally concise. It reports the **current implementation boundary**; it does not duplicate the historical implementation diary. Detailed completed-ticket history remains available in Git history, merged PRs, issues, phase ticket specs, and release records.

The Master Game Plan defines the product. The Roadmap defines sequence. Canonical domain documents define system rules. `docs/PROJECT_GOVERNANCE_AND_COMPLEXITY.md` defines authority routing, reconciliation, complexity, and delivery discipline. This file reports what is actually active now.

## Current status

**Stage:** Phase 2 — Tactical Combat Core

**ACTIVE:** issue #93 — P2.6 Recruit AI + Tactical Hall Vertical Slice

P2.5 is merged to `main` through PR #92 and its exact Preview/release gates were completed before merge. The current task is to prove that the same authoritative combat grammar supports a fair deterministic Recruit opponent and a constrained repeatable Tactical Hall practice loop. Do not pull Phase 3 buildcraft, Mantles, broad Tactical Record progression, PvP bots, or remote LLM combat logic forward.

### P2.6 current implementation boundary

Implement:

- server-authoritative AI decision interface consuming the same movement/target/action/effect legality as player commands;
- explicit AI knowledge filter over committed encounter state only;
- first deliberately weak Recruit intelligence profile;
- deterministic seeded tie-breaking and bounded decision budget;
- simple utility scoring for legal damage/utility, survival, positioning, and scenario objective where present;
- safe fallback hierarchy ending in Guard/Wait/End Turn rather than illegal actions;
- structured decision-reason tags for logs/debugging;
- deterministic QA practice harness and golden tactical regression states;
- first player-facing Tactical Hall repeat loop with one Recruit floor, constrained supported presets, instant retry, and no normal repeatable progression rewards;
- intelligence profile kept separate from raw combatant stats.

All AI-selected intents still commit through the authoritative P2.4/P2.5 battle session, expected-version, idempotency, and event boundaries. The AI gets no privileged legality shortcut and no hidden future RNG or uncommitted browser planning state.

## Completed major milestones on `main`

### Phase 0 — Foundation ✅
- F0.1 Repository + Runnable Web Foundation
- F0.2 Infrastructure + Persistence Baseline
- F0.3 Server Architecture Skeleton
- F0.4 Design System + Media/Audio Core
- audit security hardening integrated through #80

### Phase 1 — Character Foundation ✅
- P1.1 Account Entry + Player Profile Boundary
- P1.2 Character Domain Rules + Creation Contract
- P1.3 Authoritative Character Creation + Persistence Experience
- P1.4 Character Profile + Derived Stat Framework
- P1.5 Level 1–100 XP Progression + Telemetry Foundation
- P1.6 Wayfarer’s Practice: Balanced Practice Foundation
- P1.7 Public News + Manual + Rules Foundation
- audit performance hardening integrated through #85

### Phase 2 — through P2.5 ✅
- P2.1 Deterministic Battle State + Turn Economy Foundation
- P2.2 Board, Movement, Terrain + Facing Legality
- P2.3 Targeting, Combat Actions + Effect Grammar
- P2.4 Authoritative Battle Session + Persistence Boundary
- Phase 1-derived combat stat bridge through #87
- identifier-only battle invalidation/refetch through #90
- P2.5 Responsive Battle Experience + Turn Economy Tracker through #92

P2.5 includes the responsive board-first cockpit, authoritative planning preview API, current Turn Economy presentation, stale/reconnect handling, sanitized committed battle history, governed media fallback, gesture-gated audio integration, and authenticated responsive browser journey.

## Live persistence / authority state

- browser roles remain outside authoritative battle mutation and private battle-event tables;
- P2.5 owner-scoped battle-event read remains service-role only via `20260817141155_p25_battle_event_read`;
- Phase 0 helper hardening and Phase 1 FK covering indexes remain live;
- Supabase leaked-password protection remains an external Free-plan limitation and is not a repository defect.

## Established deferrals

- Weight / Load / Might: Phase 3 when representative equipment exists.
- Mantles / Confluences / Soulmarks / Current-Legacy loadouts: later phases.
- stronger AI grades beyond tiny testing stubs, remote LLM combat, reinforcement learning, PvP bot substitution, broad Tactical Record progression, and full Battle Review: later scope.
- final production combat art/VFX polish and full websocket/co-op synchronization: later scope.

## Permanent execution rules

1. Inspect current `main`, open implementation PRs/issues, current phase ticket specs, and recently merged design docs before starting work.
2. One canonical implementation ticket is ACTIVE at a time.
3. Never merge a dependent ticket before its prerequisite.
4. Reconcile repository truth at phase/player-facing validation boundaries.
5. Do not use future feature work to hide a failed validation gate.
6. Run required quality, database/security, browser, and exact external Preview checks before declaring implementation complete.
7. Keep this ledger short and current. Do not allow it to become a second Roadmap or an archaeological log.

## Immediate sequence

```text
#93 P2.6 — Recruit AI + Tactical Hall Vertical Slice
  ↓
Exact GitHub + database + responsive browser + Vercel Preview validation
  ↓
PV-1 — Tactical Combat Proof
```

If P2.6 uncovers a genuine lower-layer combat-authority defect, fix that smallest defect explicitly rather than hiding it inside AI scoring or Tactical Hall presentation.
