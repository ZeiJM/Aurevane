# AUREVANE — Active Task Ledger

This file is intentionally concise. It reports the **current implementation boundary**; it does not duplicate the historical implementation diary. Detailed completed-ticket history remains available in Git history, merged PRs, issues, phase ticket specs, and release records.

The Master Game Plan defines the product. The Roadmap defines sequence. Canonical domain documents define system rules. `docs/PROJECT_GOVERNANCE_AND_COMPLEXITY.md` defines authority routing, reconciliation, complexity, and delivery discipline. This file reports what is actually active now.

## Current status

**Stage:** Phase 2 — Tactical Combat Core

**ACTIVE:** issue #91 — P2.5 Responsive Battle Experience + Turn Economy Tracker

The mandatory Phase 0 / Phase 1 / P2.1–P2.4 reconciliation gate #73 is complete. P2.5 is now the single active implementation ticket. Build the smallest complete battlefield-first cockpit required to make the current authoritative tactical slice understandable and playable; do not pull P2.6 AI or Phase 3 buildcraft forward.

### P2.5 current implementation boundary

Implement against the existing authoritative P2.4 session boundary:

- authenticated battle launch/resume route and board-first cockpit;
- server-derived read-only movement/action/facing/end-turn previews using current game-core legality and stat-driven forecasts;
- current actor, HP/MP, initiative and concise visible status/context;
- Turn Economy Tracker for Movement remaining/total, Action ready/spent, MP and current relevant costs/resources;
- explicit Inspect mode versus Target mode;
- movement/path, target/shape and facing previews with useful legality explanations;
- explicit Cancel/Back/Confirm flow and duplicate-submit protection;
- stale-version/refetch/reconnect recovery without client-side authority guessing;
- responsive desktop/laptop/phone composition with keyboard/touch/reduced-motion baseline;
- graceful requested-media/audio fallbacks through existing boundaries.

Do not duplicate combat formulas or hidden RNG state in React. Previews may inform the player, but every committed result remains server authoritative.

## Audit corrections integrated into `main`

- #80 — Phase 0 RLS helper privilege hardening
- #61 — P2.1 malformed lifecycle/counter hardening
- #64 — P2.3 Targeting, Combat Actions + Effect Grammar rebuild
- #82 — final-facing turn-commitment hardening
- #85 — Phase 1 foreign-key index hardening
- #86 — P1.7 Public News + Manual + Rules Foundation
- #71 — rebuilt P2.4 authoritative battle-session persistence boundary
- #87 — Phase 1 derived-stats → Phase 2 combat bridge
- #90 — P2.4 identifier-only battle invalidation/refetch contract

Final reconciled `main` passed exact quality/database/browser gates and an exact READY Vercel production deployment before #73 closed.

### Live audit state

- Phase 0 privileged helper browser execution is revoked.
- Phase 1 foreign-key covering indexes are present; missing-index advisor findings are cleared.
- P2.4 battle persistence/RPC migrations are present under the exact live Supabase ledger versions and browser roles remain outside authoritative mutation.
- Supabase leaked-password protection remains an external Free-plan limitation; revisit if the project is upgraded to Pro+.

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

### Phase 2 — engine checkpoints through P2.4 ✅

- P2.1 Deterministic Battle State + Turn Economy Foundation, including malformed-state and final-facing hardening
- P2.2 Board, Movement, Terrain + Facing Legality
- P2.3 Targeting, Combat Actions + Effect Grammar
- P2.4 Authoritative Battle Session + Persistence Boundary
- representative Phase 1-derived combat stat expression integrated through #87
- identifier-only authoritative battle invalidation/refetch contract integrated through #90

## Established deferrals

- Weight / Load / Might: full equipment/load proof remains Phase 3 when representative equipment exists.
- Mantles: no player Mantles belong in PV-1; actual Mantle implementation remains later-phase work.
- Recruit AI / Tactical Hall: P2.6, only after the normal P2.5 player loop is stable.
- Current/Legacy/Confluence/Soulmark loadout cockpit: Phase 3+ as those systems become real.
- PvP clocks, Battle Review, full map editor, full websocket/co-op sync and final production combat polish remain later scope.
- Full Asset Studio/provider operations remain later-phase work; P2.5 uses the existing replaceable media/audio boundary and graceful fallbacks.

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
#91 P2.5 — Responsive Battle Experience + Turn Economy Tracker
  ↓
Exact GitHub + responsive browser + Vercel Preview validation
  ↓
P2.6 — Recruit AI + Tactical Hall vertical slice
  ↓
PV-1 — Tactical Combat Proof
```

If P2.5 uncovers a genuine lower-layer authority defect, fix that smallest defect explicitly rather than hiding it inside presentation code.
