# AUREVANE — Equipment Load & Build Physics Roadmap Integration

**Status:** Binding extension of `docs/ROADMAP.md` for equipment Weight, Equipped Load, Load Handling, mobility tradeoffs, load-aware buildcraft, UI preview, AI, PvP safety, and Master Panel operations.

**Authority:** `docs/GAME_MASTER_PLAN.md` remains primary. `docs/EQUIPMENT_LOAD_AND_BUILD_PHYSICS.md` defines the feature model. `docs/STAT_DRIVEN_BUILDCRAFT.md` defines stat expression. `docs/ITEMS_INVENTORY_LOADOUTS.md` defines equipment/loadouts. `docs/COMBAT.md` defines movement/terrain/elevation. `docs/MASTER_PANEL.md` defines operations.

**Direction approved:** 2026-08-16.

The roadmap principle is:

> **Let equipped gear have physical consequences once combat and equipment are mature enough to make those consequences interesting; never turn owned inventory into a global encumbrance chore.**

---

## 1. Cross-Cutting Rule

When Weight becomes active, relevant equipment can contribute to **Equipped Load**. Load can influence Movement, Jump/vertical legality, selected terrain interactions, and authored build conditions.

The system must preserve these guardrails at every phase:

- backpack/material/quest-item ownership does not automatically slow ordinary movement;
- Weight consequences are previewed before loadout commitment;
- Heavy equipment buys real benefits rather than existing only as a penalty;
- Light, standard, heavy, and unusual hybrid builds can all be viable;
- the four-attribute model remains;
- no hidden universal penalty pile;
- maps provide counterplay to mobility/vertical specialization;
- load rules are server-authoritative and deterministic;
- item/load changes are data-driven and Master Panel editable when the relevant editor arrives.

---

## 2. Phase 1 — Preserve Future Compatibility Only

Current Phase 1 / P1.6 / P1.7 scope is unchanged.

Do **not** add an unfinished Weight system before tactical combat/equipment depth exists.

Phase 1 guardrails:

- item/equipment identity must remain capable of receiving a future `weight` property;
- derived Movement/Jump architecture must not assume equipment is mechanically weightless forever;
- build/loadout boundaries must remain server-authoritative;
- do not add inventory carry-weight penalties;
- no new manual attribute/stat is needed merely for Weight.

There is no new Phase 1 implementation gate.

---

## 3. Phase 2 — First Combat Physics Proof

Tactical Combat Core is the first appropriate place to prove the smallest complete Load interaction if the vertical slice includes representative equipment.

Target proof:

- one lightweight equipment configuration;
- one heavier configuration;
- authored Item Weight on the relevant test equipment;
- deterministic Equipped Load calculation;
- one clear Load breakpoint or equivalent rule;
- Load modifies Movement and/or ordinary Jump legality in an understandable way;
- the movement/path forecast explains the consequence;
- the heavier build receives a meaningful compensating equipment benefit;
- the test map contains enough elevation/route structure to observe the tradeoff.

Do not delay PV-1 merely to build a complete armor-weight ecosystem.

If Phase 2 equipment is too narrow for a meaningful proof, preserve the contracts and perform the first complete proof in Phase 3 rather than shipping a fake system.

### Phase 2 validation questions

- Did the player understand why the heavier setup moved/climbed differently?
- Was the heavier setup still tactically desirable?
- Did high-ground access remain counterable?
- Were penalties visible before action commitment?
- Did the system add choice rather than bookkeeping?

---

## 4. Phase 3 — Build / Armory Integration

When the real Current/Legacy/build/loadout system arrives, Equipment Load becomes an explicit buildcraft surface.

Add as justified:

- stable item Weight values;
- authoritative Equipped Load calculation;
- initial Load Handling/Tolerance model;
- player-facing Load State/bands;
- Armory total Load display;
- equipment comparison showing before/after Load;
- preview of Movement/Jump breakpoint changes;
- clear requirement invalidation/activation;
- first typed Load conditions in Traits/Movement Arts/equipment effects;
- saved presets store the actual equipment/build configuration and recompute Load authoritatively;
- AI understands the released load-aware interactions;
- Manual documentation.

PV-2 buildcraft testing should include whether Load creates an understandable tradeoff rather than feeling like an arbitrary equipment tax.

---

## 5. Phase 4 — Deliberate Load Archetypes

The first meaningful equipment/Discipline content set should deliberately include more than one relationship with Load.

Representative targets may include:

- light mobile/ranged build;
- standard generalist build;
- heavy anchor/protector build;
- one hybrid that invests to overcome an expected Load weakness.

Map suite should include enough variety that:

- light mobility is sometimes valuable;
- heavy durability/position-holding is sometimes valuable;
- neither is universally correct;
- there is no single unbeatable rooftop/anchor position.

Content review should reject Weight values that exist only as arbitrary flavor numbers.

---

## 6. Phase 5 — Bounded World / Traversal Expression

Living World content may begin using Weight in optional authored situations where it creates interesting preparation.

Examples:

- optional climbing route;
- pressure plate/mechanism;
- unstable bridge/platform;
- regional hazard;
- alternate route or hidden discovery.

Guardrails:

- ordinary overworld travel speed is not reduced by heavy equipment;
- main-story progression has reasonable alternate paths;
- players are not asked to change clothing every few screens;
- world UI explains why Weight matters when it does.

The public Manual gains a concise Weight/Load guide once released.

---

## 7. Phase 6 — Co-op Complementarity

Party play should test whether different Load profiles create useful complementary roles without mandatory composition.

Examples:

- Heavy anchor holds a chokepoint/objective;
- Light skirmisher accesses elevation or distant mechanisms;
- support effects temporarily improve ally Load Handling;
- party strategy uses alternate routes rather than one required mobility stat.

Do not make a specific Load State mandatory for ordinary co-op progression.

---

## 8. Phase 7 — Expedition Depth

Expeditions can use Weight more creatively because route variation and preparation are part of their identity.

Possible content:

- load-aware room hazards;
- optional high routes;
- strong wind/unstable footing;
- pressure/mass mechanisms;
- temporary gear/load modifiers;
- modifiers that reward a particular Load strategy without invalidating every other build.

Deep Expeditions may test specialization more aggressively, but critical progression still needs fair composition/path alternatives.

---

## 9. Phase 8 — PvP Safety Gate

Before Load is trusted in ranked play, explicitly test:

- Light-load kiting loops;
- Jump/high-ground ranged camping;
- Heavy anchor objective dominance;
- displacement resistance interactions;
- map routes/line of sight;
- Load breakpoint readability;
- whether Might/Load Handling becomes mandatory;
- equipment-category diversity;
- whether opponents can infer enough public build information to plan counterplay.

Queue-specific rules may normalize or restrict exceptional content, but basic Load meaning should remain stable and published.

News/Manual impact is required for material competitive Weight changes.

---

## 10. Phase 9 — Roster Scale

As the Discipline roster expands:

- audit which Disciplines benefit from Light/Standard/Heavy Load;
- avoid assigning every agile Discipline the same Light bonus;
- avoid making every tank Discipline solve Heavy penalties for free;
- create occasional surprising but coherent hybrids;
- make Mantle Paths able to reference Load only where it meaningfully reinforces specialization;
- update AI/Tactical Records to understand load-aware builds.

The stat-expression matrix should include Load relationships even though Equipped Load is a build property rather than a new manually allocated core stat.

---

## 11. Phase 10 — Social / Profile Presentation

Public/social profiles may expose a coarse combat identity such as equipment/loadout presentation only if existing visibility rules already permit it.

Do not expose hidden competitive build details merely because Load exists.

No major new Load mechanics are required here.

---

## 12. Phase 11 — Economy / Equipment Scale

The mature equipment/economy phase is where Weight becomes a large-scale content-authoring concern.

Add/validate:

- consistent Weight ranges by equipment category;
- crafting/material choices that may affect Weight only where the crafting system supports meaningful tradeoffs;
- loot/vendor filters/comparison that surface Weight;
- marketplace display where needed;
- no item with an unexplained nonsensical Weight merely for spreadsheet variety;
- acquisition diversity for key light/heavy build pieces.

A rare lighter item can be strategically superior for one build even if a heavier Legendary has larger defenses.

---

## 13. Phase 12 — Nations / World Warfare

Nation/campaign maps may use mass/mobility considerations in selected objectives or terrain, but must not create one nation/build identity as permanently superior because of Weight.

No nation may sell or grant exclusive permanent competitive Load bypass that violates anti-P2W/fairness rules.

---

## 14. Phase 13 — Master Panel / Stat Ecosystem Operations

The complete Balance Lab / Item Studio should include Load operations.

Authorized staff can inspect/edit, with validation and versioning:

- Item Weight;
- Load thresholds;
- Load Handling rules;
- Movement/Jump consequences;
- Load-tagged content requirements;
- mode overrides;
- representative loadouts;
- distribution of player Load States;
- item rejection/use rates versus Weight;
- map/PvP performance by Load State;
- high-ground access and displacement telemetry.

Publishing should show dependency impact, especially when a Weight edit changes a movement breakpoint for many live builds.

Owner/staff must be able to roll back a bad Weight configuration without direct production SQL.

---

## 15. Phase 14 — Presentation Polish

Make physical build identity visible and audible without hurting clarity.

Examples:

- heavy equipment animation/silhouette communicates mass;
- footsteps/armor movement may reflect material/load without becoming repetitive noise;
- light movement remains crisp;
- path/elevation previews remain readable;
- Armory comparison receives polished breakpoint communication;
- Manual diagrams show representative Load tradeoffs.

Do not slow UI animation merely to simulate heaviness if it makes the game feel unresponsive.

---

## 16. Phase 15 — Hardening

Test:

- server/client Load disagreement;
- stale loadout Weight after content publication;
- breakpoint rounding;
- negative/overflow Weight values;
- missing item Weight defaults;
- loadout swap/reconnect exploits;
- movement legality after temporary Load changes;
- forced movement/mass edge cases;
- AI legality;
- PvP route exploits;
- performance of pathfinding with load-aware rules;
- accessibility/readability of Load feedback.

Property and regression tests should cover representative Light/Standard/Heavy builds across terrain/vertical transitions.

---

## 17. Ticket Impact Rule

Once Weight is released, equipment/combat tickets should explicitly consider:

```text
LOAD IMPACT
- item Weight changed?
- Equipped Load threshold changed?
- Movement/Jump legality changed?
- Load-conditioned content changed?
- affected saved loadouts?
- PvP/map impact?

PUBLIC INFORMATION IMPACT
- Manual update?
- News/patch note?
```

---

## 18. Success Condition

The roadmap succeeds when Weight grows from a simple equipment property into a coherent tactical/buildcraft layer **only as the systems needed to make it fun become available**.

The mature player should be able to choose between protection, mobility, vertical access, special synergies, and unusual hybrids without ever feeling punished for simply owning loot.
