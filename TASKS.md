# AUREVANE — Active Task Ledger

This file is intentionally concise. It reports the **current implementation boundary**; it does not duplicate the historical implementation diary. Detailed history remains available in Git history, merged PRs, issues, phase ticket specs, and release records.

The Master Game Plan defines the product. The Roadmap defines sequence. Canonical domain documents define system rules. `docs/PROJECT_GOVERNANCE_AND_COMPLEXITY.md` defines authority routing, reconciliation, complexity, and delivery discipline. This file reports what is actually active now.

## Current status

**Stage:** Phase 2 implementation with one mandatory targeted Phase 1 backfill

**ACTIVE:** issue #95 — P1.6 backfill: Wayfarer's Practice planned windows + Rested Momentum

The approved 2026-08-17 live-events/training roadmap explicitly inserts this small Wayfarer's Practice backfill before Phase 2 continues. Completed combat work is preserved. P2.6 issue #93 / draft PR #94 remains intact but dependency-blocked until #95 is merged and P2.6 is resynchronized with `main`.

### #95 implementation boundary

Implement only the current Phase 1 foundation:

- server-authoritative activity/practice timestamps and meaningful-offline threshold;
- automatic Balanced Practice fallback;
- planned windows exactly `Short`, `Overnight`, `Extended`, with data-driven initial targets around 3h / 8h / 24h;
- prospective `Set Practice` intent for the next meaningful absence, consumed with its corresponding Training Report;
- early-return credit for legitimate elapsed time and Balanced fallback after a planned window expires;
- low-rate deterministic Character XP;
- initial authoritative Rested Momentum representation and award; no spending yet;
- frozen, idempotent Training Report generation/claim through the existing transaction boundary;
- explicit-plan versus automatic-fallback provenance/telemetry;
- responsive Character → Training / return-report presentation with clear timing and claim/no-claim explanations.

Do not add Discipline Mastery/Discipline Focus, mature Recovery & Study, profession XP, direct attributes, Crowns/materials/items, event participation, automation queues, or background tick workers in this backfill.

## Completed foundation relevant to this work

- Phase 0 foundation and security hardening are complete.
- Phase 1 character/profile/derived-stat/XP foundations are complete.
- Existing P1.6 Balanced Practice claim/replay/transaction architecture is present and should be extended rather than replaced.
- P1.7 public News/Manual/Rules foundation is complete.
- Phase 2 combat engine checkpoints P2.1–P2.5 are implemented on current `main`.
- P2.6 Recruit AI + Tactical Hall implementation is preserved in draft PR #94 while #95 is active.

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
#95 P1.6 targeted Wayfarer's Practice backfill
  ↓
Exact GitHub quality/database/browser + READY Vercel Preview validation
  ↓
Merge #95 and verify main
  ↓
Resynchronize draft P2.6 PR #94 with main
  ↓
Finish P2.6 exact-candidate validation and merge
  ↓
PV-1 — Tactical Combat Proof
```
