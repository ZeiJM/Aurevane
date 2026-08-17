# AUREVANE — Active Task Ledger

This file is intentionally concise. It reports the **current implementation boundary**; it does not duplicate the historical implementation diary. Detailed completed-ticket history remains available in Git history, merged PRs, issues, phase ticket specs, and release records.

The Master Game Plan defines the product. The Roadmap defines sequence. Canonical domain documents define system rules. `docs/PROJECT_GOVERNANCE_AND_COMPLEXITY.md` defines authority routing, reconciliation, complexity, and delivery discipline. This file reports what is actually active now.

## Current status

**Stage:** Phase 2 — Tactical Combat Core

**ACTIVE:** P2.3 — Targeting, Combat Actions + Effect Grammar

- Issue: #63
- PR: #64 (`agent/p2-3-targeting-actions-effects`)
- Status: draft / must complete its full acceptance and release gates before dependent implementation is allowed to merge.

**STACKED DRAFT — dependency-bound:** P2.4 — Authoritative Battle Session + Persistence Boundary

- Issue: #69
- PR: #71 (`agent/p2-4-authoritative-battle-session`)
- Base/dependency: P2.3 branch
- Status: may remain a reviewable stacked draft only; **must not merge before P2.3** and should not continue expanding if P2.3 changes its contracts.

**RECONCILIATION GATE BEFORE P2.5:** issue #73

Before the first player-facing battle UI ticket begins, reconcile later roadmap/design additions against what actually shipped in Phase 1 and P2.1–P2.4, resolve genuine omissions in focused work, classify intentional deferrals, clean stale planning/branches/PRs, and make this ledger truthful.

**PUBLIC INFORMATION PREREQUISITE BEFORE P2.5 / EXTERNAL COMBAT TESTING:** issue #55

P1.7 — Public News + Manual + Rules Foundation remains required before the player-facing P2.5/external combat-testing checkpoint. Engine-only P2.1–P2.4 work having already begun does not remove the product requirement; it changes the truthful sequencing from “before any Phase 2 code exists” to “before the Phase 2 player-facing validation milestone.”

## Completed major milestones

### Phase 0 — Foundation ✅

- F0.1 Repository + Runnable Web Foundation
- F0.2 Infrastructure + Persistence Baseline
- F0.3 Server Architecture Skeleton
- F0.4 Design System + Media/Audio Core

### Phase 1 — Character Foundation ✅ through P1.6

- P1.1 Account Entry + Player Profile Boundary
- P1.2 Character Domain Rules + Creation Contract
- P1.3 Authoritative Character Creation + Persistence Experience
- P1.4 Character Profile + Derived Stat Framework
- P1.5 Level 1–100 XP Progression + Telemetry Foundation
- P1.6 Wayfarer’s Practice: Balanced Practice Foundation

P1.6 merged through commit `e73243d9b317ac2c739a2b9ceb8a17d7d1e28678`.

### Phase 2 — completed checkpoints

- P2.1 Deterministic Battle State + Turn Economy Foundation ✅
- P2.2 Board, Movement, Terrain + Facing Legality ✅

## Open reconciliation items

The reconciliation gate must explicitly inspect, not blindly merge:

- draft PR #61 — P2.1 malformed-lifecycle hardening;
- the **closed/unmerged** PR #33 design history for any still-valid account-recovery/roster/lifecycle direction that should become future focused tickets; do not resurrect the stale draft wholesale;
- P2.3/P2.4 stacked dependency state;
- P1.7 public News/Manual/Rules sequencing;
- all later-approved combat/build rules that could reasonably have implied an earlier foundation requirement;
- stale issue/PR text that still describes superseded sequencing.

If an item is still correct, integrate it cleanly. If later work superseded it, close/retire it with an explanatory record rather than keeping indefinite ambiguous drafts.

## Permanent execution rules

1. Inspect current `main`, open implementation PRs/issues, current phase ticket specs, and recently merged design docs before starting work.
2. One canonical implementation ticket is ACTIVE at a time.
3. Stacked drafts are exceptional dependency-bound review artifacts, not permission for a second implementation stream.
4. Never merge a dependent ticket before its prerequisite.
5. Reconcile repository truth at phase/player-facing validation boundaries.
6. Do not use future feature work to hide a failed validation gate.
7. Run required quality, database/security, browser, and external release/Preview checks before declaring implementation complete.
8. Keep this ledger short and current. Do not allow it to become a second Roadmap or an archaeological log.

## Immediate sequence

```text
P2.3 acceptance / release gates
  ↓
P2.4 dependency-safe completion
  ↓
Issue #73 roadmap/repository reconciliation
  +
Issue #55 public News / Manual / Rules foundation
  ↓
P2.5 Responsive Battle Experience + Turn Economy Tracker
  ↓
P2.6 Recruit AI + Tactical Hall vertical slice
  ↓
PV-1 Tactical Combat Proof
```

If reconciliation finds a genuine missed prerequisite, insert the smallest focused corrective ticket before P2.5 instead of hiding the gap inside the battle-UI ticket.