# AUREVANE — Active Task Ledger

This file is intentionally concise. It reports the **current implementation/validation boundary**; it does not duplicate the historical implementation diary. Detailed completed-ticket history remains available in Git history, merged PRs, issues, phase ticket specs, and release records.

The Master Game Plan defines the product. The Roadmap defines sequence. Canonical domain documents define system rules. `docs/PROJECT_GOVERNANCE_AND_COMPLEXITY.md` defines authority routing, reconciliation, complexity, and delivery discipline. This file reports what is actually active now.

## Current status

**Stage:** PV-1 — Owner Feedback Correction / Tactical Combat Human Retest

**ACTIVE VALIDATION GATE:** issue #105 — PV-1C Conduct Tactical Combat Human/Internal Validation — **BLOCKED ON THE CURRENT A1 CORRECTION BEING VERIFIED AND DEPLOYED**

**ACTIVE IMPLEMENTATION TICKET:** owner-directed A1 feedback correction; no separate issue currently owns this patch

**ACTIVE IMPLEMENTATION PR:** #122 — A1 feedback: holistic UX, character, battle, and navigation patch

PV-1F / issue #112 / PR #115 remains merged corrective history. Owner review after that build identified a further coherent set of navigation, character-model, terminology, readability and battle-economy corrections. PR #122 is the active implementation boundary for those changes.

Substantial Phase 3 implementation remains blocked. Automated checks may prove implementation safety, but only real human retesting on the corrected deployed build can reopen the PV-1 product decision.

## A1 owner-feedback correction — active verification

PR #122 currently implements:

- preservation of the AUREVANE diamond **A** brand crest plus a bordered mini character portrait and green screen-identity cluster on authenticated non-battle headers;
- the active battle screen remaining outside that shared screen-identity pattern so its combat HUD owns the top-level context;
- condensed authenticated navigation through a **Navigation** menu, with profile/game destinations separated from account/settings actions and its popover layered above page content;
- **Battle Hall** as the current player-facing name for the tactical practice area;
- **Wayfarer's Practice** restored as the player-facing absence-protection/training name, with a clearer plan-away → leave normally → return-to-report ritual;
- six core attributes — Might, Finesse, Vitality, Agility, Intellect and Resolve — wired through creation, persistence, profile reads, derived stats and battle character loading;
- three character slots plus a server-authoritative one-hour return cooldown after swapping away from a character;
- character creation obeying that same selection/cooldown authority instead of providing a swap bypass;
- one permanent cosmetic personal-title claim per character under Account, with server validation, collision protection and server-only read/write RPC boundaries;
- compact News, Manual, Rules, Controls & Keybinds, Character Profile, Character Select, Battle Hall, Wayfarer's Practice and login/account-entry presentation;
- desktop/laptop regression coverage requiring Account Entry, News, Profile, Battle Hall, Controls, Wayfarer's Practice and Character Select to fit their intended initial viewport without page scrollbars;
- an authoritative **100-point Action Economy** with Move = 25 AP per normal terrain-cost unit and rough ground = 50 AP, while Basic Attack = 30 AP, Guard = 30 AP and Recover = 50 AP;
- battle action proposals with glowing provisional AP depletion, consistent AP wording, neutral initial action state, clearer terrain/Inspect feedback, compact combatant rails, self-chat with the chat popover layered above the battle surface, double-click/tap quick commit for target and self actions with self-action proposals preserved across the second tap, Battle Log grouping/access and current action naming;
- current Manual content aligned with the six-attribute model, Discipline terminology, Battle Hall, character switching, titles and current player-facing terminology;
- E2E expectations reconciled with the current navigation, scaling and combat model.

The two new migrations for six-attribute/swap-cooldown state and personal titles have rebuilt successfully in GitHub infrastructure. Full quality, database/security and responsive browser gates are now being rerun on the final **formatted, touch-safe, overlay-corrected** branch head before PR #122 is considered review-ready.

## PV-1F corrective history

PV-1F was intentionally allowed to revise earlier combat baseline rules because the owner explicitly approved the revision during failed-product validation. Its merged correction established:

- Character Select as the post-login gateway with three numbered character slots;
- occupied/empty slot cards, server-authoritative selection and 24-hour confirmed character-deletion grace state;
- one active gameplay login per account and one active battle per account;
- Character Profile as the selected-character hub;
- Tactical Hall / Recruit-practice infrastructure and Easy / Standard / High Recruit AI selection;
- the authoritative 100-point Action Economy foundation;
- Recover, Guard, Basic Attack and final-facing foundations;
- compact battle cockpit foundations, combat logs and solo chat surface;
- authoritative Abort Exercise compatibility and deletion/pending-character proofs.

PR #122 supersedes conflicting **player-facing terminology and balancing values** from that PV-1F snapshot where the current owner-feedback correction explicitly changes them.

## Human evidence driving this correction

Recurring feedback across testers/owner included:

- battlefield scale and page scale felt wrong even after the first correction;
- player/enemy information was not organized like a readable game cockpit;
- movement, terrain, elevation, Action Economy, Guard and attack results needed stronger immediate explanation;
- the old action model still felt cumbersome;
- character/account navigation was too document-like and duplicated information;
- Wayfarer's Practice was not self-explanatory and its time display looked frozen;
- character creation bonus allocation was mistaken for the fixed baseline;
- character identity/profile presentation needed clearer hierarchy and more useful account controls;
- simultaneous/mobile-laptop and character-switch boundaries needed to remain server-authoritative;
- testers still did not demonstrate voluntary replay desire sufficient for a PV-1 pass.

## Completed foundation relevant to this work

- Phase 0 foundation and security hardening are complete.
- Phase 1 character/profile/derived-stat/XP foundations are complete.
- P1.6 Wayfarer's Practice + planned windows + Rested Momentum is complete; the active patch changes presentation/clarity without weakening authoritative reward provenance.
- P1.7 public News/Manual/Rules foundation is complete; PR #122 updates current Manual content on top of that foundation.
- P2.1–P2.7 combat engine, persistence, battle UX, Recruit AI, Tactical Hall infrastructure, final-facing, keybind, arena-scale and Abort Exercise foundations are merged.
- PV-1A telemetry, PV-1B evidence tooling and the PV-1C human validation gate are established.
- PV-1D / PR #108, PV-1E / PR #111 and PV-1F / PR #115 are merged corrective history.

## Current authoritative documents

- `docs/ROADMAP_PRODUCT_VALIDATION.md` governs PV-1 evidence, telemetry and gate decisions.
- `docs/COMBAT_USABILITY_BATTLEFIELDS_CONTROLS_RETREAT.md` governs battle-usability intent.
- `docs/ROADMAP_COMBAT_USABILITY_BATTLEFIELDS_CONTROLS_RETREAT.md` blocks substantial Phase 3 expansion until PV-1 human/internal validation passes.
- `docs/PV1_TACTICAL_PLAYTEST_PROTOCOL.md` defines the human-playtest procedure.
- `docs/PV1F_TURN_ECONOMY_AND_CHARACTER_HUB_AMENDMENT.md` remains corrective history; PR #122 and its current source-controlled rules supersede conflicting values/labels in the areas explicitly changed by the owner-feedback pass.

## Established deferrals

- Phase 3: broad Disciplines, Arts, representative equipment/load/buildcraft and deeper command expansion until PV-1 passes.
- Later phases: Mantles / Confluences / Soulmarks / Current-Legacy loadouts, remote LLM combat, PvP bots, broad Tactical Record progression, full Battle Review, Colosseum/spectation and world/Expedition retreat settlement.
- Real multiplayer battle-chat transport remains coupled to multiplayer participant/communications implementation; the current solo surface does not pretend transport already exists.
- Earned prestige-title progression remains deferred; PR #122 implements the approved per-character personal-title identity boundary only.
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
PR #122 A1 owner-feedback implementation
  ↓
Quality + database/security + responsive authenticated browser gates on exact final head
  ↓
Resolve any remaining integration/regression failures and make PR #122 review-ready
  ↓
Merge through normal repository process when approved
  ↓
Deploy exact merged runtime + reconcile production Supabase migrations/schema
  ↓
Verify production build identity and critical authenticated flow
  ↓
Rerun real human PV-1 sessions under #105
  ↓
Review structured notes + corroborating telemetry + confounders
  ↓
PASS: close #105 and open the first substantial Phase 3 implementation ticket
FAIL: identify the next smallest recurring combat/usability defect and open one corrective ticket
```

Do not fabricate, simulate or infer a human PASS from automation. The next product decision still requires real tester interaction with the corrected live build.
