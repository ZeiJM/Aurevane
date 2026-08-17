# AUREVANE — Equipment Load & Build Physics

**Status:** Authoritative buildcraft/combat refinement subordinate only to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/STAT_DRIVEN_BUILDCRAFT.md`, `docs/ITEMS_INVENTORY_LOADOUTS.md`, `docs/COMBAT.md`, `docs/COMBAT_AI_TRAINING.md`, `docs/PLAYER_MANUAL.md`, `docs/MASTER_PANEL.md`, and `docs/ROADMAP_EQUIPMENT_LOAD_AND_BUILD_PHYSICS.md`.

**Direction approved:** 2026-08-16.

AUREVANE should let the physical character of a build matter. Armor, shields, weapons, specialized equipment, and other carried combat gear should not be mechanically weightless abstractions.

The governing rule is:

> **Equipment Weight should create understandable tactical tradeoffs in the active build without turning inventory ownership or loot collection into encumbrance chores.**

A heavily equipped character may gain powerful defensive, reach, Guard, anchoring, or equipment-specific advantages while giving up some ease of movement and vertical access. A light build may move and climb more freely while accepting lower protection or different equipment opportunities.

Weight is therefore a **build property**, not a punishment for picking up treasure.

---

## 1. Three Distinct Concepts

Use clear terminology rather than one overloaded `weight` number.

### Item Weight

A stable authored property on relevant equipment definitions.

Examples include armor, shields, main/off-hand weapons, and unusually substantial accessories or combat devices when justified. Not every tiny object needs meaningful Weight.

### Equipped Load

The total authoritative Weight contribution of the character's active equipped combat build, after explicit modifiers.

Conceptually:

```text
EQUIPPED LOAD
= relevant equipped-item Weight
+ explicit build modifiers
- explicit load-reduction/handling effects
```

The exact formula is versioned balance data.

### Load Handling / Tolerance

The amount/type of Load the character can handle before stronger mobility consequences apply.

This can derive from a controlled combination of baseline character capability, Might where appropriate, selected Discipline/Movement Art/Traits, load-supporting equipment, and later Soulmark/Confluence/Mantle effects only where justified.

Do not make one attribute the only viable route to every heavy build. A non-Might archetype may have authored equipment/Discipline routes to manage load at an opportunity cost.

---

## 2. Backpack / Loot Is Not Combat Encumbrance

AUREVANE should **not** default to classic inventory-weight punishment.

Normal owned inventory, materials, quest items, cosmetics, and newly acquired loot do not continuously reduce the character's Movement simply because they exist in storage.

The combat-relevant calculation uses the **active equipped/loadout state**.

Therefore looting thirty pieces of ore does not make the character crawl across the world map.

If a future Expedition, survival scenario, transport objective, or special carried-object mechanic benefits from temporary carried weight, that is an explicit scenario rule rather than the global inventory default.

---

## 3. Load States

The player should not need to interpret invisible fractions.

The exact model is validated in combat prototyping, but the system should expose a small readable set of Load States or equivalent bands.

A candidate conceptual structure is:

```text
LIGHT / UNBURDENED
READY / STANDARD
HEAVY / BURDENED
OVERLOADED
```

These labels are not final launch balance promises.

Required properties:

- transitions are deterministic and previewable;
- the Armory explains what changes at the next threshold;
- there are not dozens of hidden penalty steps;
- a build can deliberately target a Load State;
- Overloaded should normally be an invalid combat loadout or an exceptional heavily penalized state, not an accidental trap discovered after entering battle.

If playtesting shows that a smoother continuous model is clearer, it may be used internally while still presenting readable player-facing breakpoints.

---

## 4. Core Mobility Relationship

Equipment Load should primarily interact with the spatial systems where physical burden is intuitive.

### Movement

Higher Load can reduce usable Movement Budget or make selected movement profiles/terrain more expensive when configured thresholds are crossed.

The player must see the result before committing the build.

### Jump / Verticality

Higher Load can reduce ordinary vertical movement capability or make some height transitions unavailable without more Jump, greater Load Handling, a compatible Movement Art, an equipment effect, a special movement profile, or another authored override.

This naturally creates relationships such as:

```text
HEAVY ARMOR + SHIELD
→ stronger frontline package
→ greater Load
→ harder vertical access

LIGHTER RANGED KIT
→ lower protection
→ lower Load
→ easier high-ground access
```

These are tendencies, not rigid classes. A player can deliberately build a **heavy climber**, **armored lancer**, or other unusual hybrid by paying the required opportunity cost.

---

## 5. Do Not Apply Every Possible Penalty at Once

Weight systems become oppressive when one number simultaneously reduces Movement, Jump, Initiative, Evasion, Accuracy, recovery, Action speed, and everything else.

AUREVANE should not do that by default.

The baseline Load system keeps universal consequences small and legible, centered primarily on **movement/verticality and explicit equipment legality/handling**.

Additional relationships belong to authored content where they create a real identity and are clearly previewed.

Examples:

- a Trait may reward Light Load with Evasion after moving;
- a heavy shield may improve Guard against displacement;
- a Movement Art may require `not Heavy`;
- an armored Discipline Trait may ignore the first Movement penalty band;
- a Mantle Path may deliberately require Heavy Load;
- a precision Art may require stable footing but not care about Load.

---

## 6. Weight Must Buy Something

If Weight is only a tax, every optimized build tries to minimize it.

Heavier equipment must therefore be allowed to justify its burden through properties such as:

- Armor/Ward;
- block/Guard effects;
- weapon reach/profile;
- stronger defensive equipment effects;
- protection against selected hazards;
- Discipline/Confluence synergies;
- displacement/anchoring interactions where explicitly authored;
- charge/slam/momentum interactions where explicitly authored;
- equipment categories that lighter builds cannot reproduce for free.

The exact benefits come from the equipment and build content, not from a universal `heavy = better` rule.

Likewise, low Load creates opportunity rather than an automatic blanket damage bonus.

---

## 7. Load as a Typed Build Condition

Load State should be available to the controlled effect/requirement grammar so authored content can refer to it safely.

Examples:

```text
requires_load_state <= READY
requires_load_state == HEAVY
if_load_state == LIGHT
if_equipped_weight >= X
ignore_load_penalty_band = 1
modify_load_tolerance = +Y
```

The exact schema should avoid free-form scripting.

Potential content users include Traits, equipment effects, Movement Arts, Disciplines, Confluences, Soulmarks, Mantle Paths, terrain interactions, and encounter mechanics.

---

## 8. Effective Mass / Displacement

Selected push/pull/knockback rules may care about effective mass/load, but this remains explicit.

Do **not** assume every magical displacement effect is resisted because a character wears heavy armor.

A displacement definition may declare that it checks a property such as `LOAD_CLASS`, `MASS_CLASS`, `STABILITY`, or an equivalent tested primitive.

Examples:

- an ordinary shove may move a Light target farther than a Heavy braced target;
- a gravity Soulmark effect may explicitly ignore equipment Load;
- a boss launch mechanic may use its own forced-movement rule;
- `Brace` may convert Heavy Load into stronger anchoring for one turn.

The forecast should show the actual result.

---

## 9. Terrain and Environmental Possibilities

Weight may interact with selected terrain when the interaction is intuitive and worth the complexity.

Possible authored examples:

- fragile platforms with load limits;
- pressure plates requiring sufficient mass;
- strong wind where a braced/heavier unit is harder to displace;
- deep mud that punishes heavy ground movement;
- climbing/vault transitions that become harder at Heavy Load;
- collapsing bridges or mechanisms with explicit weight rules;
- water/unstable ground only where the encounter clearly teaches the interaction.

Do not make every terrain tile query equipment Weight. Environmental Weight rules should be special enough to notice, common enough to learn where relevant, and always previewable.

---

## 10. Representative Build Identities

These are examples, not formal classes.

### Ridge Marksman

```text
Low/Ready Load
+ high Jump
+ Accuracy
+ ranged Arts
+ mobility equipment
```

Uses elevation and sight lines while sacrificing some heavy protection.

### Iron Anchor

```text
Heavy armor/shield
+ Load Handling
+ HP/Armor/Status Resistance
+ Guard/intercept tools
```

Controls space and resists pressure but has reduced route freedom unless additional investment compensates.

### Armored Lancer

```text
Heavy weapon/armor
+ enough Movement/Load Handling
+ charge/reach mechanics
```

Pays heavily to keep mobility while preserving an impactful physical kit.

### Veil Skirmisher

```text
Light Load
+ Movement/Evasion
+ repositioning
+ opportunistic Arts
```

Uses route access and disengagement rather than standing power.

### Heavy Climber

```text
Heavy equipment
+ unusually high Jump or dedicated Movement Art
+ Load-handling Trait/equipment
```

A deliberately expensive hybrid proving the system is not a rigid `heavy characters cannot climb` lock.

---

## 11. Build Opportunity Cost

The system should create questions such as:

- Is this heavier armor worth losing one Movement breakpoint?
- Can I change my boots/weapon and stay below Heavy?
- Do I spend a Trait/Movement Art to support heavy equipment?
- Is the high-ground route important enough to use my lighter preset?
- Can my team compensate for my slower anchor build?
- Is a lighter shield worth losing protection to preserve Jump?

The answer should vary by build, map, opponent, and objective.

There must not be one universally correct target Weight for all characters.

---

## 12. Armory / Compare UX

The Build / Armory interface must make Weight consequences obvious.

A useful presentation is conceptually:

```text
EQUIPPED LOAD     31 / 38
STATE             READY

Equip Ironwall Plate:
Load              31 → 41
State             READY → HEAVY
Movement Budget   6 → 5
Jump capability   3 → 2
Armor             84 → 112

NEW INTERACTIONS
Heavy-load conditions active
```

Exact values/labels are balance data.

The player is warned **before** equipping an item causes a meaningful breakpoint.

Compare views should show item Weight, new Equipped Load, resulting Load State, Movement/Jump changes, requirements that become valid/invalid, and major interactions activated/deactivated.

Do not require manual arithmetic.

---

## 13. Battle UI / Forecast

The battle UI does not need a giant permanent Weight meter.

Show Load when relevant:

- character/build inspection;
- movement/path preview if Load explains cost/legality;
- terrain tooltip when Load matters;
- displacement forecast when the effect checks Load/Mass;
- status/effect detail when a temporary change alters Load Handling.

The path preview should explain cases such as:

> **Height 2 unavailable: current Heavy Load permits ordinary ascent of Height 1.**

or equivalent concise language.

---

## 14. Temporary Effects

Temporary combat effects may change Weight contribution, Load Handling, Load State interpretation, movement profile, or specific consequences.

Examples include magical lightening, gravity increase, summoned armor, discarded shield state, transformation/Mantle state, or a temporary brace/anchor state.

Any mid-battle change affecting legal movement resolves deterministically and visibly.

Do not allow ordinary inventory/equipment swapping mid-battle merely to exploit Weight unless a specific Art/system explicitly supports it.

---

## 15. Attributes and Load Handling

Might is the intuitive primary attribute candidate for ordinary physical Load Handling because the existing attribute represents physical strength and force.

The exact production formula must be proven in balance testing.

Guardrails:

- do not make high Might mandatory for all armor users;
- do not make Resolve secretly duplicate Might's Load role without a clear reason;
- allow authored equipment/Discipline routes to support heavy non-Might archetypes;
- do not add manual `Carry Strength` point allocation;
- preserve the four-attribute model.

If testing shows attribute-based tolerance creates unhealthy taxes, move more of the system into equipment/categories/content instead of adding more attributes.

---

## 16. NPCs, Creatures, and AI

Not every creature needs equipment Weight.

NPCs/monsters can use an authored movement/mass/load profile directly where appropriate. Humanoid equipment-using enemies may use the same Load system where useful.

AI must understand relevant consequences:

- heavy actors avoid routes they cannot traverse;
- light ranged actors value reachable high ground;
- anchor actors understand chokepoints/objectives;
- AI can evaluate when a Load-changing effect opens/closes a route;
- opponents can counter obvious high-ground/heavy-anchor plans.

AI never cheats vertical/load legality.

---

## 17. PvP Safety

Watch for:

- ultra-light infinite kiting;
- high-Jump ranged positions with no practical answer;
- Heavy builds becoming impossible to displace or kill;
- one armor category becoming mandatory;
- Load Handling becoming a mandatory attribute tax;
- one Weight point causing disproportionate breakpoint power;
- equipment-swap/loadout bugs bypassing legality;
- hidden interactions opponents cannot reasonably read.

PvP maps require multiple approaches and counterplay.

Standard queues may use mode-specific coefficients or restrictions, but should avoid silently changing basic Weight meaning unless clearly published.

---

## 18. Exploration / World Use

Weight can occasionally matter outside tactical combat where it creates interesting authored choices: optional climbing routes, unstable bridges, pressure mechanisms, traversal challenges, or Expedition branches.

Do not make ordinary overworld travel slower because the player wears heavy armor.

Do not lock mandatory main-story progression behind one Weight state without reasonable alternate paths.

World expression should reward preparation, not force wardrobe changes every few minutes.

---

## 19. Equipment Authoring Requirements

When Weight becomes active, relevant equipment definitions should support concepts equivalent to:

```text
weight
weight_category (optional presentation/content tag)
load_handling_modifier (rare/explicit)
movement_or_jump_effects (through normal effect grammar)
load_state_requirements/triggers (when used)
```

Item authoring should answer:

- Why is this item this heavy/light?
- What does the player receive in exchange?
- Which builds care about the Weight?
- Does the Weight create a meaningful breakpoint?
- Is the item still usable in a coherent build?
- Are visuals/audio consistent with its physical identity?

Weight values must not be random filler numbers.

---

## 20. Master Panel / Balance Lab

As tooling matures, authorized staff should be able to inspect and tune:

- item Weight;
- Load thresholds;
- Load Handling configuration;
- Movement/Jump consequences;
- content requirements keyed to Load;
- mode overrides;
- representative loadouts;
- Weight distribution by equipment category;
- player Load-State distribution;
- win/use rates by Load State;
- map performance by Load State;
- high-ground access frequency;
- displacement outcomes where Load matters.

Publishing a Weight change that alters a live item/build should support dependency preview, Manual impact, News impact, versioning, and rollback.

---

## 21. Manual / Rules Communication

The **Manual** explains how Weight, Equipped Load, Load Handling, Movement, Jump, and relevant terrain rules work mechanically.

The **Rules** page does not duplicate these mechanics unless a fair-play policy needs to reference exploit behavior.

A balance change to Weight may require a Manual update, News/patch note, or both.

---

## 22. Telemetry / Validation

Track enough data to answer:

- Which Load States are actually used?
- Are Light builds overrepresented among winners?
- Are Heavy builds viable outside one Discipline?
- How often does Load alter a path/Jump decision?
- How often do players stop just below a breakpoint?
- Are players surprised by Load consequences?
- Which items are rejected almost entirely because of Weight?
- Do PvE/PvP maps provide meaningful counterplay?

The goal is multiple healthy strategic choices, not equal usage for its own sake.

---

## 23. Success Condition

The system succeeds when a player can look at a piece of equipment and think beyond:

> **“This has more Armor.”**

They should also consider:

> **“Can my build carry this without giving up the route, Jump breakpoint, or mobility plan I care about — and is the protection worth that trade?”**

At the same time, acquiring loot remains satisfying rather than turning the backpack into a permanent movement penalty.
