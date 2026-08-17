# AUREVANE — Active Task Ledger

This file is intentionally concise. It reports the **current implementation boundary**; it does not duplicate the historical implementation diary. Detailed completed-ticket history remains available in Git history, merged PRs, issues, phase ticket specs, and release records.

The Master Game Plan defines the product. The Roadmap defines sequence. Canonical domain documents define system rules. `docs/PROJECT_GOVERNANCE_AND_COMPLEXITY.md` defines authority routing, reconciliation, complexity, and delivery discipline. This file reports what is actually active now.

## Current status

**Stage:** Phase 2 — Tactical Combat Core

**ACTIVE:** issue #73 — Roadmap reconciliation finalization before P2.5

P2.5 has **not** started. The owner-requested Phase 0 / Phase 1 / P2.1–P2.4 implementation audit is complete and its focused corrections have been integrated into `main`. The remaining #73 work is final merged-main validation, issue/status cleanup, and leaving one truthful next ticket.

### Audit corrections integrated into `main`

- #80 — Phase 0 RLS helper privilege hardening
- #61 — P2.1 malformed lifecycle/counter hardening
- #64 — P2.3 Targeting, Combat Actions + Effect Grammar rebuild
- #82 — final-facing turn-commitment hardening
- #85 — Phase 1 foreign-key index hardening
- #86 — P1.7 Public News + Manual + Rules Foundation
- #71 — rebuilt P2.4 authoritative battle-session persistence boundary
- #87 — Phase 1 derived-stats → Phase 2 combat bridge
- #90 — P2.4 identifier-only battle invalidation/refetch contract

The pre-integration exact heads were green on their applicable GitHub gates. #87 and #90 received exact READY Vercel Preview checks, and the composed audit candidate was also validated before integration. Final merged-main validation still has to pass before #73 can close.

### Live audit corrections already applied

- Phase 0: browser execution of the privileged `public.rls_auto_enable()` helper has been revoked; live advisor warnings for that helper are cleared.
- Phase 1: the seven foreign-key indexes identified by the live Performance Advisor have been added; the corresponding `unindexed_foreign_keys` findings are cleared.
- P2.4: live battle persistence/RPC migrations are present under their exact Supabase ledger versions and browser roles remain outside the authoritative battle mutation boundary.

### External configuration limitation

Supabase still reports leaked-password protection as disabled. The connected organization is on the **Free** plan; Supabase documents this protection as a **Pro Plan and above** feature. Treat this as an external plan limitation, not an unresolved repository/database defect. Revisit it if the project is upgraded.

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

## Reconciliation classifications

- **PR #33:** closed/unmerged planning history. Preserve still-valid future account/character-lifecycle direction through later focused tickets; do not resurrect the stale draft wholesale.
- **Stat-driven combat:** genuine Phase 2 omission corrected by #87 so future UI/AI consume real authoritative character-driven combat values rather than fixed player placeholders.
- **Battle invalidation/refetch:** genuine P2.4 omission corrected by #90 through the existing identifier-only realtime invalidation boundary; no battle snapshots/RNG/outcomes are broadcast as truth.
- **Weight / Load / Might handling:** full equipment/load proof remains intentionally deferred when the Phase 2 slice lacks representative equipment. Do not invent a permanent fake formula merely to pull Phase 3 buildcraft forward.
- **Mantles:** no player Mantles belong in PV-1. Phase 2 preserves reusable temporary-state/action/status/requirement primitives; actual Mantle implementation remains later-phase work.
- **Battle interface:** the board-first cockpit, Turn Economy Tracker, inspect/target distinction, forecasts, reconnect/stale-version recovery and responsive controls belong to P2.5 itself.
- **Recruit decision-making:** belongs to P2.6 rather than P2.1–P2.4.
- **Visual/media direction:** P2.5/PV-1 must exercise the existing replaceable media/audio boundary and prove battlefield readability; full Asset Studio/provider operations remain later-phase work.
- **PV-1 combat telemetry:** can be completed during P2.5/P2.6 before the external validation cohort; it is not a missing P2.1–P2.4 engine prerequisite.

## Permanent execution rules

1. Inspect current `main`, open implementation PRs/issues, current phase ticket specs, and recently merged design docs before starting work.
2. One canonical implementation ticket is ACTIVE at a time.
3. Stacked drafts are exceptional dependency-bound review artifacts, not permission for uncontrolled parallel feature development.
4. Never merge a dependent ticket before its prerequisite.
5. Reconcile repository truth at phase/player-facing validation boundaries.
6. Do not use future feature work to hide a failed validation gate.
7. Run required quality, database/security, browser, and external release/Preview checks before declaring implementation complete.
8. Keep this ledger short and current. Do not allow it to become a second Roadmap or an archaeological log.

## Immediate sequence

```text
Final merged-main validation for #73
  ↓
Re-run live Supabase advisor / authority checks that matter to the audit
  ↓
Close/reconcile completed audit issues and confirm repository status is truthful
  ↓
Close #73 and set P2.5 as the single ACTIVE implementation ticket
  ↓
P2.5 — Responsive Battle Experience + Turn Economy Tracker
  ↓
P2.6 — Recruit AI + Tactical Hall vertical slice
  ↓
PV-1 — Tactical Combat Proof
```

If final merged-main validation exposes another genuine prerequisite defect, fix that smallest defect before closing #73 instead of hiding it inside P2.5.
