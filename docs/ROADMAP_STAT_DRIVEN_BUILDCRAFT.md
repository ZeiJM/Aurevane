# AUREVANE — Stat-Driven Buildcraft Roadmap Integration

**Status:** Binding extension of `docs/ROADMAP.md` for meaningful stat expression, tactical build archetypes, verticality, stat-aware content authoring, and long-term balance validation.

**Authority:** `docs/GAME_MASTER_PLAN.md` remains primary. `docs/STAT_DRIVEN_BUILDCRAFT.md` defines the stat-expression model. `docs/COMBAT.md` defines battlefield rules. `docs/ITEMS_INVENTORY_LOADOUTS.md` defines equipment/effect/loadout integration. `docs/COMBAT_AI_TRAINING.md` defines AI requirements. `docs/MASTER_PANEL.md` defines operational tooling.

**Direction approved:** 2026-08-16.

The roadmap principle is:

> **Do not add a stat unless the game eventually gives players meaningful reasons to build around it; do not force every build to be stat-led; and do not let one stat become mandatory simply because its tactical expression is strong.**

---

## 1. Cross-Cutting Buildcraft Rule

The existing derived stats are not merely outputs displayed on the character sheet.

As dependent systems arrive, they should progressively gain meaningful tactical expression through combinations of:

- Disciplines;
- Arts / Traits / Reactions / Movement Arts;
- Current + Legacy / Confluences;
- Soulmarks;
- equipment;
- Mantles;
- terrain/elevation;
- map geometry;
- encounter mechanics;
- objectives;
- team composition.

Stats remain **build axes**, not classes.

AUREVANE must continue supporting mechanic-led and hybrid builds that are not centered on maximizing a particular stat.

---

## 2. Phase 1 — Preserve the Derived-Stat Foundation

Phase 1 already establishes the four attributes and derived-stat framework.

Do **not** expand current P1.6/P1.7 implementation scope to build tactical stat systems before combat exists.

Phase 1 requirements are architectural/design only:

- retain the existing derived-stat identities unless later evidence justifies change;
- keep formulas versioned/configurable rather than embedding launch assumptions;
- profile/help text should describe stats semantically rather than promise unimplemented combat interactions;
- do not hard-code Movement/Jump in ways that prevent later terrain/elevation use;
- do not add direct manual allocation for thirteen derived stats;
- preserve future modifier provenance from equipment/Disciplines/effects;
- no permanent build traps.

No additional Phase 1 gate is introduced.

---

## 3. Phase 2 — Prove Spatial / Tempo / Reliability Stats in Combat

Phase 2 is the first major proof point because stats become meaningful only when a battlefield exists.

The Tactical Combat Core should deliberately prove representative interactions for:

### Movement

- converts to normal Movement Budget;
- paths/terrain visibly consume budget;
- extra Movement creates real positional options;
- movement remains bounded by terrain/zones/occupancy and opportunity cost.

### Jump

- vertical movement legality uses a clear Jump/elevation rule;
- at least one representative battle map contains meaningful elevation;
- path preview explains legal/illegal elevation transitions;
- a ranged/high-ground interaction can be tested without creating an unreachable safe zone;
- melee attacks obey actual adjacency/elevation legality rather than attacking vertically through impossible geometry.

### Initiative

- visible initiative/turn-order timeline reflects the stat;
- the test slice verifies that initiative matters without granting repeated free turns or unavoidable opening kills.

### Accuracy / Evasion

- forecast shows hit reliability;
- cover/terrain/target state can matter where implemented;
- baseline combat remains reliable enough to avoid frustrating miss spam;
- Evasion cannot become passive invulnerability.

### Armor / Ward / HP / MP

- baseline defensive/resource meaning is real and forecast/debuggable;
- no need to create advanced build archetypes yet.

### Status Resistance

Implement only if the first vertical slice has meaningful hostile statuses; otherwise preserve the interface and add it when real status content justifies it.

### Phase 2 map requirement

At least one representative PvE combat map should prove **verticality as gameplay**, not visual decoration.

This map should provide:

- more than one route/approach;
- high ground that is advantageous but counterable;
- at least one way for non-Jump-specialists to pressure or route around the position;
- readable height/path preview.

### Phase 2 gate addition

PV-1 combat proof should ask:

- Did Movement/Jump create choices players noticed?
- Did players understand why a vertical move was legal or illegal?
- Did high ground create strategy rather than immunity?
- Did Initiative/Accuracy/Evasion feel understandable rather than random/opaque?

Do not delay PV-1 to implement every stat archetype.

---

## 4. Phase 3 — Bind Stats Into the Real Build System

When Current/Legacy, Arts, Traits, Reactions, Movement Arts, Soulmarks, Confluences and saved loadouts become real, stat expression becomes a true buildcraft concern.

Add:

- typed stat requirements/scaling where genuinely needed by released content;
- content metadata that identifies stat-relevant interactions;
- Armory preview of stat changes from build/equipment choices;
- threshold/breakpoint explanation for Movement/Jump and other discrete rules;
- warnings when changing equipment/build invalidates a requirement;
- no hidden stat requirements;
- Confluence/Soulmark stat interactions only where they deepen identity;
- AI awareness of stat-relevant build behavior;
- first stat/build telemetry.

### Required representative builds

Phase 3 should be capable of expressing at least a few distinct concepts such as:

- mobility/skirmish;
- durable anchor;
- resource-heavy caster/support;
- precision/range;
- mechanic-led Confluence build that does **not** depend on stat stacking.

The goal is architectural proof, not a complete meta.

---

## 5. Phase 4 — First Stat-Expression Content Pass

As the initial playable Discipline set expands, stat-driven buildcraft becomes a content-quality requirement.

Every Discipline/content batch should be reviewed against the **Stat Expression Matrix** from `docs/STAT_DRIVEN_BUILDCRAFT.md`.

Phase 4 should intentionally provide representative support for multiple stat identities through:

- Disciplines;
- equipment;
- Arts/Traits/Reactions;
- battle maps;
- enemies;
- Tactical Hall scenarios.

### Required prototype archetypes

Do not treat these names as permanent classes, but the test library should contain functional equivalents of several archetypes:

1. **Vertical ranged specialist** — Jump + Accuracy/range + high-ground play.
2. **Mobile skirmisher** — Movement + Evasion/tempo.
3. **Durable anchor** — HP + Armor/Ward/Status Resistance depending matchup.
4. **Deep-resource support/caster** — Maximum MP + Mystic Power/resource interaction.
5. **Setup burst / precision build** — Accuracy/Initiative/Critical setup rather than raw casino crit.
6. **Mechanic-first build** — success comes primarily from Confluence/Art/equipment interaction rather than stat maxima.

### Phase 4 map suite

Representative maps should vary so different stats become useful in different contexts:

- a meaningful vertical map;
- a cramped/line-control map;
- a more open mobility/objective map;
- terrain/hazard interaction.

Do not make each map a checklist containing every mechanic.

### Gate

External/internal testers should be able to identify multiple builds by **how they play**, not merely by their damage numbers.

---

## 6. Phase 5 — World & Exploration Expression

When the Living World arrives, stat expression may extend outside battle carefully.

Allowed examples:

- Jump enabling an optional ledge/shortcut/discovery;
- movement-profile interactions in authored traversal situations;
- alternate approaches to world encounters;
- stat-relevant environmental flavor.

Guardrails:

- main-story progression must not require one specific stat build;
- important permanent build components require alternate legitimate acquisition where necessary;
- do not turn AUREVANE into a platformer;
- traversal opportunities should reinforce world geography rather than appear as arbitrary stat gates.

The Manual should begin showing illustrated examples of Movement, Jump, elevation and representative build ideas without publishing a solved meta.

---

## 7. Phase 6 — Co-op Stat Synergy

Party play introduces another layer: one player can specialize because teammates cover weaknesses.

Validate concepts such as:

- high-Jump ranged player taking a firing position while allies control approaches;
- durable anchor holding a lane for fragile support;
- high-Movement rescuer rotating between allies/objectives;
- high-Initiative setup player enabling a teammate's payoff;
- status-resistant frontline absorbing control pressure.

Do not create mandatory `tank/healer/DPS` role locks simply because stat synergies emerge.

Party composition should reward complementary strengths while preserving multiple solutions.

---

## 8. Phase 7 — Expedition Build Tests

Expeditions are ideal for testing stat versatility across changing rooms/modifiers.

Add:

- vertical rooms;
- mobility challenges;
- attrition/resource pressure;
- status-heavy encounters;
- mixed physical/mystic threats;
- objectives where tempo/position matter;
- bosses that challenge stat-led builds through mechanics rather than blanket disabling them.

Deep Expedition modifiers can temporarily alter the relative value of stats, encouraging loadout adaptation.

Do not generate rooms that are unwinnable for a legitimate party because none invested in a specific stat.

---

## 9. Phase 8 — PvP Counterplay & Stat Safety

PvP is a hard validation gate for stat-driven builds.

Explicitly test and tune:

- high-ground camping;
- spawn/elevation asymmetry;
- Movement/kiting loops;
- Initiative first-turn advantage;
- Accuracy/Evasion miss rates;
- crit volatility;
- Armor/Ward/HP sustain extremes;
- Status Resistance/control immunity;
- MP/HP conversion loops;
- stat breakpoints that become mandatory in ranked play.

Ranked map pools should provide fair counterplay without making every map symmetrical or flat.

PvP may use mode-specific coefficients/caps where required, but do not maintain a completely separate stat system.

### PvP gate

No stat-led build should create a reliable **interaction denial** state where the opponent lacks meaningful legal counterplay.

---

## 10. Phase 9 — Full Discipline Expansion With Stat Diversity

As the roster expands toward the long-term target, new Disciplines must deepen the stat ecosystem rather than cluster around identical stat priorities.

For each Discipline batch, review:

- preferred stats;
- useful secondary stats;
- stat-agnostic mechanic builds;
- map preferences;
- natural counters;
- equipment interactions;
- AI behavior;
- PvE/PvP telemetry;
- whether an existing stat is becoming mandatory or dead.

Do not create one Discipline for each stat as a mechanical checklist.

Different Disciplines may value the same stat for entirely different reasons.

---

## 11. Phase 10 — Social / Profile Build Identity

As social profiles mature, allow players to express build identity without exposing hidden/private tactical information that should remain private in competitive contexts.

Potential safe presentation:

- saved build names chosen by player;
- public favorite Discipline/Soulmark/Mantle where permitted;
- high-level identity tags or achievements;
- showcase/stat milestones if intentionally public.

Do not publish exact competitive loadouts automatically where doing so undermines strategic privacy.

---

## 12. Phase 11 — Economy / Equipment Ecosystem

The mature item/economy phase should ensure equipment provides multiple legitimate stat paths.

Add/validate:

- stat-budget tradeoffs;
- stat-conversion or threshold-enabling equipment where justified;
- niche rares that can outperform generic legendary gear for specific builds;
- target-farmable equipment for known archetypes;
- crafting paths that let players intentionally pursue build goals without perfect-RNG dependence;
- economic analytics for stat-affix demand;
- protections against one universal best-in-slot stat profile.

Marketplace/crafting must not become the only viable source for a mandatory stat breakpoint.

---

## 13. Phase 12 — Nation / Large-Scale Context

Nation content can create new tactical environments and team compositions that shift stat value.

Examples:

- fortress assaults with vertical lanes;
- open-field objectives favoring mobility;
- defensive holds rewarding durability/control resistance;
- region-specific terrain.

Do not give permanent nation affiliation exclusive access to universally superior stat mechanics.

---

## 14. Phase 13 — Build & Stat Operations in the Master Panel

The mature Master Panel / Balance Lab should include a **Stat Ecosystem** view or equivalent analytical tooling.

Required capabilities should grow toward:

- distribution of each stat by level/Horizon/mode;
- common breakpoints;
- popular stat combinations;
- Discipline/loadout correlation;
- equipment/affix correlation;
- win/success rates by stat band;
- map-specific performance;
- elevation/Jump usage;
- Movement/objective contribution;
- Accuracy/Evasion outcome distributions;
- Initiative opening advantage;
- status application/resistance outcomes;
- HP/MP resource-conversion anomalies;
- build diversity indicators.

The Content Graph / authoring tools should eventually flag:

- stats with little released support;
- content that creates a suspicious mandatory breakpoint;
- maps where one stat archetype dominates;
- item/Art requirements that reference retired/changed stat rules.

Owner/balance staff remain responsible for publication decisions.

---

## 15. Phase 14 — Visual / Feedback Polish

Production polish should make stat expression satisfying and legible.

Examples:

- clear vertical path/high-ground presentation;
- distinctive movement arcs/vaults;
- accurate targeting/evasion feedback;
- initiative/timeline animation that remains readable;
- equipment/Armory stat-change presentation;
- illustrated Manual diagrams;
- battle forecast polish;
- audio/VFX cues for important thresholds/interactions without turning combat into noise.

The game should visually communicate why a specialist can do something unusual.

---

## 16. Phase 15 — Hardening

Hardening must include stat-system abuse and edge cases.

Test:

- extreme stat values;
- integer/rounding thresholds;
- Movement/Jump path exploits;
- unreachable tiles;
- teleport + verticality interactions;
- line-of-sight edge cases;
- Initiative/timeline loops;
- Accuracy/Evasion caps;
- crit distributions;
- damage reduction extremes;
- Status Resistance immunity edges;
- HP/MP conversion loops;
- equipment stacking;
- loadout swap eligibility;
- PvP spawn/map exploits;
- AI pathing with vertical specialists;
- mobile readability of multi-level maps.

Performance/load testing should include pathfinding/forecast behavior on representative multi-level maps.

---

## 17. Product Validation Integration

### PV-1 Tactical Combat Proof

Include basic evidence that Movement/elevation/Jump and readable reliability/tempo stats create understandable tactical decisions.

### PV-2 AUREVANE Identity / Buildcraft

Include evidence that players discover both:

- mechanic-led Current + Legacy + Confluence/Soulmark builds;
- stat-led or hybrid builds with distinct tactical identities.

The success signal is not `players maximize stats`.

The success signal is:

> **Players can explain why their build wants different positions, timing, targets, resources, or risks than another valid build.**

### Later validation

PvE/co-op/PvP gates should continue measuring whether specialization creates cooperation/counterplay rather than mandatory meta compression.

---

## 18. Stat Expression Matrix Requirement

By Phase 4 and increasingly thereafter, maintain a lightweight design matrix covering the active derived stats.

For each stat, track at minimum:

```text
Baseline rule
Representative build(s)
Released supporting content
Relevant maps/encounters
Natural counters
PvP risk
AI support
Telemetry support
```

This can begin as documentation/data metadata and mature into Master Panel tooling later.

It is an audit mechanism, not a requirement for identical content counts.

---

## 19. Map Authoring Rule

Every substantial tactical-map batch should answer:

- Which movement/elevation choices define this map?
- Which build types gain an advantage here?
- What counters those advantages?
- Are any spawn positions effectively unreachable?
- Can an ordinary build still pursue the objective?
- Does terrain create choices rather than simply taxes?
- Is verticality mechanically real where visually present?

Do not flatten maps merely for balance convenience.

Do not create unreachable sniper fortresses merely for spectacle.

---

## 20. Build Ticket Rule

Once combat/build systems exist, feature/content tickets that materially affect stats should include:

- stat interaction intent;
- opportunity cost;
- counterplay;
- forecast/UI behavior;
- AI implications;
- PvE/PvP implications;
- tests for important thresholds;
- telemetry where appropriate.

A flat stat modifier can still be valid. It simply should not be the entire identity of every item, Discipline or build.

---

## 21. Definition of Roadmap Success

This roadmap extension succeeds when AUREVANE eventually contains a healthy mixture of:

- stat-led builds;
- mechanic-led builds;
- hybrid builds;
- spatial specialists;
- resource specialists;
- tempo specialists;
- durability/control-resistance specialists;
- unusual Current + Legacy / Confluence / Soulmark / Mantle combinations;

and none of the permanent derived stats exist merely because `RPGs have stats`.

The long-term character-building question should expand from:

> **“Which numbers are highest?”**

into:

> **“What tactical possibilities am I buying with this build, and what am I giving up to get them?”**

That is the intended AUREVANE buildcraft standard.