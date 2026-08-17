# AUREVANE — Roadmap Addendum: Combat Usability, Battlefield Scale, Controls & Retreat

**Authority:** Binding roadmap integration for `docs/COMBAT_USABILITY_BATTLEFIELDS_CONTROLS_RETREAT.md`, subordinate to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/ROADMAP.md` and `docs/ROADMAP_PRODUCT_VALIDATION.md`.

**Direction approved:** 2026-08-17.

This roadmap module exists because the current Phase-2 combat slice is mechanically functional but player feedback has exposed an important PV-1 risk: combat must become understandable and tactically spacious enough **before** Phase 3 adds substantially more commands and build systems.

---

# Current implementation position

Current active work remains P2.6 Recruit AI + Tactical Hall vertical slice.

Do **not** destabilize or restart P2.6 merely to absorb this newly approved work.

Correct sequence:

```text
finish/seal P2.6 exact candidate
  ↓
P2.7 / PV-1 Combat Usability & Battlefield Scale Proof
  ↓
PV-1 human/internal validation
  ↓
only then proceed into Phase 3 expansion
```

P2.7 is a refinement/proof ticket, not permission to implement Phase-3 Arts/Disciplines early.

---

# P2.7 — Combat Usability & Battlefield Scale Proof

## Goal

Prove that a new player can understand and enjoy the baseline battle loop without facilitator explanation, and prove that AUREVANE combat is not structurally trapped on a tiny 5x3 training board.

## A. Combat action clarity

Implement/refine:

- visible Move → Action → Facing → End Turn mental model;
- Turn Economy Tracker prominently distinguishes `Action Ready` vs `Action Spent`;
- Move visibly communicates that it does not normally spend the Action;
- Basic Attack/Guard explain why they are disabled;
- selected mode shows a short instruction such as `Choose an enemy in range`;
- legal destinations/targets have unmistakable board treatment;
- current target/destination and pending intent are clear;
- preview state and Confirm availability are visually obvious;
- Cancel/back semantics remain deterministic;
- no ordinary player should need to infer command state from gray buttons alone.

## B. Early Tactical Hall teaching drills

Add or author the smallest useful instructional sequence:

- Movement Drill;
- Strike Drill;
- Guard Drill;
- Facing Drill;
- Recruit Sparring Partner remains the combined duel.

Allow skipping/re-entering drills as appropriate. Practice remains isolated from normal progression/economy rewards.

## C. Final-facing ergonomics

Preserve four-direction facing and all front/side/rear tactical relationships.

Replace the mandatory extra-facing ceremony with a provisional valid facing throughout the turn.

Default heuristic:

1. face most recent directional attack target;
2. otherwise final movement direction;
3. otherwise retain current facing.

The player may override before End Turn.

Preferred implementation direction:

- End Turn preview includes the final facing;
- the authoritative End Turn transaction/intent can validate and commit the chosen final facing atomically rather than requiring a separate player-visible facing commit followed by another End Turn commit;
- preserve compatibility/replay determinism while migrating away from avoidable double-command UX.

P2.7 must include regression tests proving front/side/rear damage/legality remains correct after the UX change.

## D. Keyboard controls / account keybind foundation

Add the first server-backed/account preference boundary for Controls & Keybinds if the existing preference architecture cannot already express it cleanly.

Implement current Combat bindings only; future systems add their categories later.

Initial testable defaults:

```text
1              Inspect
2              Move
3              Basic Attack
4              Guard
5              End Turn preparation
W/A/S/D        direction / final facing when relevant
Arrow keys     alternate directional navigation
Space          End Turn preparation
Enter          Confirm
Escape         Cancel/back
Tab            cycle relevant visible target/unit
Shift+Tab      reverse cycle
L              Combat Log
```

Requirements:

- visible UI remains fully usable without keyboard;
- remapping with conflict detection;
- reset to defaults;
- text inputs suppress combat shortcuts;
- keybinds invoke the normal preview/intent flow, never bypass server legality;
- `Space` does not silently throw away a turn by default; it opens/prepares End Turn and `Enter` confirms;
- account settings surface is extensible later to World/Map, Menus, Social and other categories.

## E. Battlefield scale proof

Keep the existing tiny Basic Training Floor as a **Micro/Drill map**.

Add at least one larger authored Duel/Small Encounter battlefield, approximately within the 7x5–9x7 design band or another measured equivalent, that demonstrates:

- meaningful approach options;
- enough space for side/rear positioning;
- nontrivial terrain cost;
- no immediate trivial ranged dominance from spawn;
- melee reaches engagement without multiple dead turns;
- clear camera/pan/zoom readability;
- current deterministic/path/facing/AI systems work without assuming 5x3 dimensions.

P2.7 does not need the final map suite. It proves the engine, UI, AI and camera can support meaningful scenario-driven sizes.

## F. Tactical density checks

Add tests/validation sufficient for the proof maps:

- legal spawn zones;
- reachability;
- no occupied/blocked invalid placements;
- representative path availability;
- reasonable first-contact distance;
- AI remains within decision budget on the larger board;
- no map-specific hard-coded 5x3 assumptions;
- no-horizontal-overflow and board/command accessibility at representative laptop/phone viewports.

## G. Practice exit

Add **Abort Exercise** to Tactical Hall/practice battles.

Requirements:

- explicit confirmation;
- server-authoritative terminal result/settlement;
- no normal progression rewards;
- no loss/rating/economy punishment for no-reward practice;
- return to Tactical Hall cleanly;
- idempotent/reconnect-safe terminal command;
- do not use browser close/disconnect as the intended exit mechanism.

## H. Battle-exit policy foundation

Add only the minimum typed scenario/domain boundary needed so later modes can declare their exit policy without redesigning battle settlement.

Conceptual policies:

```text
ABORT_PRACTICE
IMMEDIATE_RETREAT
TACTICAL_EXTRACTION
SURRENDER
NO_VOLUNTARY_EXIT
```

Do not implement full world-retreat, Expedition extraction, or PvP rating behavior in P2.7.

The battle completion/result model should be extensible to distinguish terminal outcomes such as:

- victory;
- defeat;
- retreated;
- surrendered;
- aborted;
- draw where applicable.

## P2.7 gate

Do not proceed to substantial Phase-3 command/build expansion until:

- a tester can identify Move, Basic Attack, Guard and End Turn without facilitator help after minimal onboarding;
- disabled actions explain their reason;
- movement is not confused with spending the Action;
- final facing is understood as a tactical choice rather than arbitrary bureaucracy;
- a turn can normally be ended without a redundant separate-facing commit;
- keyboard users can play the baseline turn comfortably with remappable bindings;
- the 5x3 map is demonstrably only a training fixture;
- at least one larger map produces meaningful positioning/flanking/terrain decisions;
- Recruit AI works correctly on the larger map;
- practice can be aborted safely;
- PV-1 testers discuss tactical choices more than interface confusion.

---

# Phase 3 — Discipline Framework additions

No major scope change.

As new Arts/Movement Arts/Reactions appear:

- every new command must plug into the same clarified selection/target/preview/confirm grammar;
- action-slot keybind support grows without creating a wall of mandatory shortcuts;
- unavailable Arts expose reasons;
- directional/facing interactions use the established fast-facing UX;
- do not regress into separate bespoke input flows for every Discipline.

The Phase-3 gate inherits the P2.7 usability contract.

---

# Phase 4 — Map Suite & Combat Presentation Expansion

Phase 4 already expands representative battle maps. Add explicit map-scale work:

- author a varied map suite across Duel/Small, Skirmish and selected larger scenarios;
- test combatant counts, engagement ranges, terrain/elevation, objectives and flank routes;
- reject carbon-copy tactical layouts with different paint;
- tune camera and board density across desktop/laptop/tablet/phone;
- begin stronger environment/terrain/unit/action presentation needed for representative PV-1/PV-2 testing;
- keep Micro maps for drills/special arenas only where appropriate.

Map-size bands remain data-driven guidelines, not permanent hard engine caps.

---

# Phase 5 — World Encounters + PvE Retreat

When ordinary world encounters arrive, implement `IMMEDIATE_RETREAT` where appropriate.

For standard low-stakes PvE:

- Retreat is an explicit battle utility action;
- confirmation shows consequences;
- result is `retreated` / encounter loss, not victory;
- no victory XP/loot/objective credit;
- battle-consumed items/resources remain consumed;
- committed entry costs are not silently refunded;
- modest encounter reset/re-entry friction may apply where required;
- return to authoritative world location/state is atomic with settlement;
- no Character XP deletion, arbitrary item destruction, or generic durability punishment.

World encounter definitions decide whether retreat is available.

Some story encounters use `NO_VOLUNTARY_EXIT` or later `TACTICAL_EXTRACTION` as authored.

World/UI should make the policy clear enough that players do not confuse unavailable retreat with a broken button.

---

# Phase 6 — Party & Co-op

Extend exit rules for cooperative battles:

- individual disconnect is not the same as team retreat;
- ordinary co-op encounter retreat policy is explicit;
- do not let one player silently terminate the whole party battle unless the scenario deliberately allows it;
- party extraction objectives can require all required living members or an authored threshold;
- reconnect state takes precedence over prematurely classifying temporary disconnect as retreat.

---

# Phase 7 — Expeditions & Tactical Extraction

Implement richer `TACTICAL_EXTRACTION` rules where appropriate:

- extraction tiles/zones;
- survive-until-exit-opens rules;
- escape objects/doors;
- party extraction conditions;
- threat/attempt/run-state consequences;
- suspended Expedition state cannot be abused to bypass failed retreat;
- rewards and consumed inventory settle exactly once.

Some sealed/boss rooms may use `NO_VOLUNTARY_EXIT` until an authored condition changes.

If escaping is the actual scenario objective, successful extraction is Victory rather than Retreat.

---

# Phase 8 — PvP Surrender

Add formal Surrender/Forfeit behavior.

## 1v1

- confirmed surrender available according to queue/ruleset;
- immediate legitimate loss;
- opponent receives legitimate win;
- normal rating/season consequence of a loss;
- no arbitrary extra rating punishment merely for using the official control;
- repeated very-early surrender/disconnect abuse can trigger separate queue/cooldown protections.

## 2v2

Author a team surrender policy:

- vote/consent rule;
- minimum eligible timing if needed;
- one player cannot unilaterally erase the teammate's match unless the rules explicitly permit it;
- disconnect/abandon remains separate from surrender.

Timers/reconnect/forfeit logic must not make disconnect a cheaper surrender method.

---

# Phase 9+ — Larger Combat Content

As enemy groups, summons and Disciplines expand:

- map size/density validators include expected unit/summon footprint;
- AI decision-budget tests include larger representative boards;
- ranged/melee/mobility archetypes are tested on multiple map scales;
- facing/Reactions should gain tactical value from space and lane design rather than from mandatory clicks.

---

# Phase 10 — Account Settings maturity

Expand Controls & Keybinds into the mature account settings surface with categories for:

- General;
- Combat;
- World / Map;
- Menus;
- Social;
- Accessibility-related shortcuts where useful.

Preserve account-wide preferences with appropriate device-local exceptions.

Provide a searchable shortcut reference/help panel.

---

# Phase 13 — Combat Content Studio / Scenario Operations

Add authoring/validation surfaces for:

- board dimensions/geometry;
- participant footprint assumptions;
- spawn zones;
- tactical-density checks;
- exit policy;
- extraction zones/conditions;
- world-return policy;
- reward/entry-cost settlement behavior;
- PvP surrender rules;
- practice-abort policy;
- preview/test launch at representative participant counts;
- warnings for cramped/empty maps and invalid escape policies.

Staff cannot inject arbitrary retreat penalties or scripts.

---

# Phase 14 — Production Combat Polish

The mature visual/audio pass must transform the current functional cockpit into the Art Bible target:

- real battlefield environment art/materials;
- stronger unit/portrait presentation;
- readable terrain/elevation;
- action/status/source icons;
- movement/attack/Guard/Reaction animations;
- impact VFX/SFX;
- battle music/ambience;
- high-quality targeting overlays;
- polished initiative and turn-state presentation;
- polished keyboard/pointer/touch feedback;
- facing communication through character orientation and board markers;
- retreat/surrender/abort confirmation presentation;
- no generic dashboard/debug-floor appearance.

Phase 14 is not permission to leave Phase-2 interaction clarity broken until then.

---

# Phase 15 — Hardening additions

Add tests for:

- keybind conflict/remap/reset persistence;
- shortcuts disabled while typing;
- Space/Enter accidental End Turn protection;
- final-facing atomic End Turn stale-version/idempotency behavior;
- map-size performance/pathfinding/AI decision worst cases;
- cramped/oversized tactical-density regression scenarios;
- Abort/Retreat/Surrender authorization and duplicate settlement;
- disconnect vs retreat/forfeit boundaries;
- PvP surrender abuse controls;
- Expedition extraction/reconnect/suspension interactions;
- reward/rating/world-state settlement for every terminal result;
- no client ability to forge exit policy/result classification.

---

# Validation lock

The project must not treat the current 5x3 Recruit drill as proof that final combat-map scale is sufficient.

The project must not treat a mechanically completable battle as a passed PV-1 if representative players cannot understand how to attack, why actions are unavailable, or how facing/end-turn works.

The next feature layer earns expansion only after baseline combat is both **functional and comprehensible**.
