# AUREVANE — Active Task Ledger

This file is intentionally concise. It reports the **current implementation/validation boundary**; it does not duplicate the historical implementation diary. Detailed completed-ticket history remains in Git history, merged PRs/issues, phase ticket specs, and release records.

The Master Game Plan defines the product. The Roadmap defines sequence. Canonical domain documents define system rules. `docs/PROJECT_GOVERNANCE_AND_COMPLEXITY.md` defines authority routing, reconciliation, complexity, and delivery discipline. This file reports what is actually active now.

## Current status

**Stage:** PV-1 — Owner Feedback Correction / Tactical Combat Human Retest

**ACTIVE VALIDATION GATE:** issue #105 — PV-1C Conduct Tactical Combat Human/Internal Validation — **BLOCKED ON THE CURRENT A2 CORRECTION BEING VERIFIED AND DEPLOYED**

**ACTIVE IMPLEMENTATION TICKET:** owner-directed A2 feedback correction; no separate issue currently owns this patch

**ACTIVE IMPLEMENTATION PR:** #123 — A2 feedback: holistic battle, profile, navigation, and passive training pass

PR #122 / A1 is merged corrective history. Owner review after that build identified one further coherent A2 pass across battle readability, profile identity, navigation/social presence, titles, and background training. PR #123 is the active implementation boundary.

Substantial Phase 3 implementation remains blocked. Automated checks prove implementation safety only; real human retesting on the corrected deployed build is still required for the PV-1 product decision.

## A2 owner-feedback correction — active verification

PR #123 currently implements:

- Battle Hall starts neutral with no mode preselected; AI Sparring is an explicit first choice and future player-team-size controls are shown without pretending unavailable multiplayer exists;
- smaller mirrored combatant rails, better portrait scaling, a centered battlefield, and the **Action Economy bar geometrically centered in the battle header above the map**;
- clearer green/red attack-range and proposed-AP feedback, cleaner action hierarchy, condensed Combat Log summaries, corrected keyboard/keybind labels, directional keyboard movement, and Recover bound as the visible fifth action;
- battle chat simplified to Chat, click-away dismissal, and a compact emoji picker while keeping the current solo surface honest about transport limitations;
- custom cosmetic character profile image display carried into profile/battle presentation through server-managed profile-display state;
- clearer title selection/personal-title presentation and future-safe title metadata without prematurely implementing broad earned-title progression;
- authenticated Online Users/presence surface plus navigation cleanup;
- **Passive Training** replacing automatic offline accrual for new sessions: explicit Short / Medium / Extended server-timed plans, decreasing hourly efficiency as duration grows, live synchronized countdown, completion reward, stop-without-partial-reward behavior, and no reward merely for being logged out/idle;
- new Battle Hall fights blocked while Passive Training is active while non-combat profile/account/reference/social surfaces remain available;
- legacy already-materialized Training Reports remain valid and claimable;
- authoritative Passive Training and combat-description roadmap/spec language reconciled with implementation, including future Master Panel editing of player-facing combat names/descriptions tied to versioned mechanical definitions;
- browser and database tests updated for the A2 behavior, including a desktop assertion that the Action Economy header is centered over the battlefield.

Temporary formatter/document-sync workflows used during correction have been removed. The exact final branch head must pass the normal quality, database/security, Battle Session DB, Passive Training DB, and responsive browser gates before PR #123 is review-ready.

## Corrective history relevant to this work

- Phase 0 and Phase 1 foundations are complete.
- P1.6 established server-authoritative training/report/idempotency foundations; A2 intentionally changes the player-facing behavior for new training sessions from automatic absence accrual to explicit Passive Training while preserving legacy frozen-report compatibility.
- P1.7 public News/Manual/Rules foundation is complete.
- P2.1–P2.7 combat engine, persistence, battle UX, Recruit AI, Tactical Hall infrastructure, final-facing, keybind, arena-scale and Abort Exercise foundations are merged.
- PV-1A telemetry, PV-1B evidence tooling and PV-1C human validation gate #105 are established.
- PV-1D / PR #108, PV-1E / PR #111, PV-1F / PR #115, and A1 / PR #122 are merged corrective history.

## Current authoritative documents

- `docs/GAME_MASTER_PLAN.md` remains the highest product authority.
- `docs/OFFLINE_PROGRESSION.md` now defines explicit Passive Training behavior.
- `docs/ROADMAP_PRODUCT_VALIDATION.md` governs PV-1 evidence, telemetry and gate decisions.
- `docs/COMBAT_USABILITY_BATTLEFIELDS_CONTROLS_RETREAT.md` governs battle-usability intent.
- `docs/ROADMAP_COMBAT_USABILITY_BATTLEFIELDS_CONTROLS_RETREAT.md` blocks substantial Phase 3 expansion until PV-1 human/internal validation passes.
- `docs/PV1_TACTICAL_PLAYTEST_PROTOCOL.md` defines the human-playtest procedure.

## Established deferrals

- Phase 3: broad Disciplines, Arts, representative equipment/load/buildcraft and deeper command expansion until PV-1 passes.
- Later phases: Mantles / Confluences / Soulmarks / Current-Legacy loadouts, remote LLM combat, PvP bots, broad Tactical Record progression, full Battle Review, Colosseum/spectation and world/Expedition retreat settlement.
- Real multiplayer battle-chat transport remains coupled to multiplayer participant/communications implementation.
- Earned prestige-title progression remains deferred; current work only implements the approved personal-title/display boundaries.
- Full Master Panel combat/content editing remains later-phase work; A2 records the requirement that player-facing descriptions be editable through the same versioned definitions rather than hard-coded UI truth.

## Permanent execution rules

1. Inspect current `main`, open implementation/validation PRs/issues, current phase ticket specs, and recently merged design docs before starting work.
2. One canonical implementation ticket is ACTIVE at a time; a validation gate may explicitly hold implementation at none.
3. Never merge a dependent ticket before its prerequisite.
4. Reconcile repository truth at phase/player-facing validation boundaries.
5. Do not use future feature work to hide a failed validation gate.
6. Run required GitHub quality, database/security and responsive authenticated browser checks for implementation correctness. External deployment validation may follow once the exact merged runtime is deployable; never mislabel an older deployment as exact-head validation.
7. Keep this ledger short and current.

## Immediate sequence

```text
PR #123 A2 owner-feedback implementation
  ↓
Quality + database/security + responsive authenticated browser gates on exact final head
  ↓
Resolve remaining genuine integration/regression failures and make PR #123 review-ready
  ↓
Merge through normal repository process when safe
  ↓
Deploy exact merged runtime against an appropriately reconciled Supabase environment
  ↓
Verify build identity and critical authenticated flow
  ↓
Rerun real human PV-1 sessions under #105
  ↓
Review structured notes + corroborating telemetry + confounders
  ↓
PASS: close #105 and open the first substantial Phase 3 implementation ticket
FAIL: identify the next smallest recurring combat/usability defect and open one corrective ticket
```

Do not fabricate, simulate or infer a human PASS from automation. The next product decision still requires real tester interaction with the corrected live build.
