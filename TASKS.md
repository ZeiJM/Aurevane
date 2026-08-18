# AUREVANE — Active Task Ledger

This file is intentionally concise. It reports the **current implementation/validation boundary**; it does not duplicate the historical implementation diary. Detailed completed-ticket history remains available in Git history, merged PRs, issues, phase ticket specs, and release records.

The Master Game Plan defines the product. The Roadmap defines sequence. Canonical domain documents define system rules. `docs/PROJECT_GOVERNANCE_AND_COMPLEXITY.md` defines authority routing, reconciliation, complexity, and delivery discipline. This file reports what is actually active now.

## Current status

**Stage:** PV-1 — Tactical Combat Human Retest / Production Handoff

**ACTIVE VALIDATION GATE:** issue #105 — PV-1C Conduct Tactical Combat Human/Internal Validation — **RETEST BLOCKED UNTIL EXACT PV-1F PRODUCTION DEPLOYMENT**

**ACTIVE IMPLEMENTATION TICKET:** issue #117 — PV-1F release handoff — restore exact production deployment

**ACTIVE IMPLEMENTATION PR:** draft PR #118

PV-1F / issue #112 / PR #115 is merged and its exact tested head passed all required implementation-safety gates. Production Supabase has been reconciled to the merged PV-1F migrations and verified. The remaining blocker is the web release path: `aurevane.vercel.app` is still serving an older `main` runtime, while automatic `agent/**` preview deployments created unnecessary release churn during the corrective loop.

Issue #117 / PR #118 is limited to release mechanics: suppress automatic Vercel deployments for `agent/**` repair branches while leaving unspecified branches such as `main` enabled, then verify the exact production Git identity after merge. No gameplay or PV-1 evidence rules change here.

Substantial Phase 3 implementation remains blocked. Automated checks may prove implementation safety, but only real human retesting on the corrected production build can reopen the PV-1 decision.

## PV-1F correction boundary — complete

PV-1F was intentionally allowed to revise earlier combat baseline rules because the owner explicitly approved the revision during failed-product validation. The merged correction includes:

- Character Select as the post-login gateway with three numbered character slots;
- occupied/empty slot cards, server-authoritative selection and 24-hour confirmed character-deletion grace state;
- one active gameplay login per account and one active battle per account;
- one Account menu for Audio, Character Select and Sign Out;
- Character Profile as the selected-character hub for Tactical Hall, Controls and Offline Training;
- denser RPG-style Profile presentation with titles/distinctions area and compact stat presentation;
- Wayfarer's Practice renamed player-facing to **Offline Training**, with live server-synced presentation and clearer absence-plan semantics;
- Tactical Hall persistent shell, compact practice selection and Easy / Standard / High Recruit AI selector;
- an authoritative **100-point Action Economy** replacing the validation slice's old Movement + one-Action grammar;
- Move = 10 points per normal terrain-cost unit, Basic Attack = 30, Guard = 30, Recover = 50, final facing = 0 and ends the turn immediately;
- Recover restores 10% maximum HP; Guard reduces incoming damage by 15% for 2 turns; Basic Attack uses the versioned level/Might/Finesse starter formula defined by the PV-1F combat amendment;
- multiple legal actions/moves while economy remains, with all costs and sequences server-authoritative;
- compact battle cockpit with auto-fit board, player/enemy side rails, portrait HP/MP meters, status mini-icons, mutually exclusive detail popovers, contextual Inspect strip, Round→Combat Log and fixed battle footer controls;
- beneficial effects use green-bordered mini-icons and harmful effects use red-bordered mini-icons;
- solo Recruit battle reserves the collapsible chat surface without pretending multiplayer transport already exists;
- authoritative Abort Exercise compatibility for both initial PV-1F Recruit provenance and canonical Tactical Hall arena provenance;
- permanent automated deletion-lifecycle and pending-character non-playability proofs.

## Human evidence driving this correction

Recurring feedback across testers/owner included:

- battlefield scale and page scale felt wrong even after the first correction;
- player/enemy information was not organized like a readable game cockpit;
- movement, terrain, elevation, Action Economy, Guard and attack results needed stronger immediate explanation;
- the old action model still felt cumbersome;
- character/account navigation was too document-like and duplicated information;
- Wayfarer's Practice was not self-explanatory and its time display looked frozen;
- character creation bonus allocation was mistaken for the fixed baseline;
- simultaneous mobile/laptop play could create independent live fights;
- the profile page was too verbose and visually weak;
- testers still did not demonstrate voluntary replay desire sufficient for a PV-1 pass.

## Completed foundation relevant to this work

- Phase 0 foundation and security hardening are complete.
- Phase 1 character/profile/derived-stat/XP foundations are complete.
- P1.6 Wayfarer's Practice + planned windows + Rested Momentum is complete; PV-1F changes its player-facing presentation, not its authoritative reward provenance.
- P1.7 public News/Manual/Rules foundation is complete.
- P2.1–P2.7 combat engine, persistence, battle UX, Recruit AI, Tactical Hall, final-facing, keybind, arena-scale and Abort Exercise foundations are merged.
- PV-1A telemetry, PV-1B evidence tooling and the PV-1C human validation gate are established.
- PV-1D / PR #108, PV-1E / PR #111 and PV-1F / PR #115 are merged corrective history.

## Current authoritative documents

- `docs/ROADMAP_PRODUCT_VALIDATION.md` governs PV-1 evidence, telemetry and gate decisions.
- `docs/COMBAT_USABILITY_BATTLEFIELDS_CONTROLS_RETREAT.md` governs battle-usability intent.
- `docs/ROADMAP_COMBAT_USABILITY_BATTLEFIELDS_CONTROLS_RETREAT.md` blocks substantial Phase 3 expansion until PV-1 human/internal validation passes.
- `docs/PV1_TACTICAL_PLAYTEST_PROTOCOL.md` defines the human-playtest procedure.
- `docs/PV1F_TURN_ECONOMY_AND_CHARACTER_HUB_AMENDMENT.md` is the owner-approved corrective amendment and supersedes conflicting validation-slice rules in `docs/COMBAT.md` for the areas it explicitly changes.

## Established deferrals

- Phase 3: broad Disciplines, Arts, representative equipment/load/buildcraft and deeper command expansion until PV-1 passes.
- Later phases: Mantles / Confluences / Soulmarks / Current-Legacy loadouts, remote LLM combat, PvP bots, broad Tactical Record progression, full Battle Review, Colosseum/spectation and world/Expedition retreat settlement.
- Real multiplayer battle-chat transport remains coupled to multiplayer participant/communications implementation; PV-1F only establishes the cockpit surface and solo-unavailable state.
- Broad analytics/session-replay vendors remain deferred until product evidence justifies them.

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
Production Supabase PV-1F schema reconciled and verified
  ↓
#117 / PR #118 reduce Vercel agent-branch deployment churn
  ↓
Merge with GitHub gates green and verify exact main production deployment identity
  ↓
Verify critical authenticated production flow
  ↓
Rerun real human PV-1 sessions under #105
  ↓
Review structured notes + corroborating telemetry + confounders
  ↓
PASS: close #105 and open the first substantial Phase 3 implementation ticket
FAIL: identify the next smallest recurring combat/usability defect and open one corrective ticket
```

Do not fabricate, simulate or infer a human PASS from automation. The next product decision still requires real tester interaction with the corrected live build.
