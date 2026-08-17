# AUREVANE — Active Task Ledger

This file is intentionally concise. It reports the **current implementation boundary**; it does not duplicate the historical implementation diary. Detailed completed-ticket history remains available in Git history, merged PRs, issues, phase ticket specs, and release records.

The Master Game Plan defines the product. The Roadmap defines sequence. Canonical domain documents define system rules. `docs/PROJECT_GOVERNANCE_AND_COMPLEXITY.md` defines authority routing, reconciliation, complexity, and delivery discipline. This file reports what is actually active now.

## Current status

**Stage:** Phase 2 — Tactical Combat Core

**ACTIVE:** issue #93 — P2.6 Recruit AI + Tactical Hall Vertical Slice

The mandatory P1.6 Wayfarer's Practice backfill is complete on `main` through PR #98. P2.6 is now resynchronized with that authoritative base. The current task is to prove that the same combat grammar supports a fair deterministic Recruit opponent and a constrained repeatable Tactical Hall practice loop. Do not pull Phase 3 buildcraft, Mantles, broad Tactical Record progression, PvP bots, or remote LLM combat logic forward.

### P2.6 current implementation boundary

Implement and validate:

- server-authoritative AI decision interface consuming the same movement/target/action/effect legality as player commands;
- explicit AI knowledge filter over committed encounter state only;
- first deliberately weak Recruit intelligence profile;
- deterministic seeded tie-breaking and bounded decision budget;
- simple utility scoring for legal damage/utility, survival, positioning, and scenario objective where present;
- safe fallback hierarchy ending in Guard/Wait/End Turn rather than illegal actions;
- structured decision-reason tags for logs/debugging;
- deterministic QA practice harness and golden tactical regression states;
- first player-facing Tactical Hall repeat loop with one Recruit floor, constrained supported presets, instant retry, and no normal repeatable progression rewards;
- intelligence profile kept separate from raw combatant stats;
- full responsive authenticated battle journey through Recruit resolution, battle completion, result presentation, and fresh retry.

All AI-selected intents still commit through the authoritative P2.4/P2.5 battle session, expected-version, idempotency, and event boundaries. The AI gets no privileged legality shortcut and no hidden future RNG or uncommitted browser planning state.

## Completed foundation relevant to this work

- Phase 0 foundation and security hardening are complete.
- Phase 1 character/profile/derived-stat/XP foundations are complete.
- P1.6 Wayfarer's Practice now includes server-authoritative Short / Overnight / Extended prospective plans, one-absence consumption, Balanced fallback provenance, and stored Rested Momentum through PR #98.
- P1.7 public News/Manual/Rules foundation is complete.
- Phase 2 combat engine checkpoints P2.1–P2.5 are implemented on current `main`.
- P2.5 includes the responsive board-first cockpit, authoritative planning preview API, stale/reconnect handling, sanitized committed battle history, media/audio hooks, and authenticated responsive browser journey.

## Live persistence / authority state

- browser roles remain outside authoritative battle mutation and private battle-event tables;
- P2.5 owner-scoped battle-event read remains service-role only via `20260817141155_p25_battle_event_read`;
- Phase 0 helper hardening and Phase 1 FK covering indexes remain live;
- P1.6 planned Practice configuration and state remain private/service-role-only, with exact 3h / 8h / 24h initial tuning and compatibility wrapper live;
- Supabase leaked-password protection remains an external Free-plan limitation and is not a repository defect.

## Established deferrals

- Weight / Load / Might: Phase 3 when representative equipment exists.
- Mantles / Confluences / Soulmarks / Current-Legacy loadouts: later phases.
- stronger AI grades/profiles, remote LLM combat, reinforcement learning, PvP bot substitution, broad Tactical Record progression, and full Battle Review: later scope.
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
Merge P2.6 and verify main
  ↓
PV-1 — Tactical Combat Proof
```

If P2.6 uncovers a genuine lower-layer combat-authority defect, fix that smallest defect explicitly rather than hiding it inside AI scoring or Tactical Hall presentation.
