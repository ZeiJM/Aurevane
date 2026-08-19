# AUREVANE — Items, Effect Catalog, Inventory & Loadout System

**Status:** Authoritative item/inventory/loadout specification subordinate to `docs/GAME_MASTER_PLAN.md` and `docs/GAME_MASTER_PLAN_BUILD_SYSTEM_ADDENDUM.md`, complementary to `docs/COMBAT.md`, `docs/PRODUCT_EXPERIENCE_CONTENT_SYSTEM.md`, `docs/MASTER_PANEL.md`, `docs/PLAYER_MANUAL.md`, and `docs/MONETIZATION.md`.

**Initial direction approved:** 2026-08-15.  
**Build/combat synchronization:** 2026-08-19.

AUREVANE's item system must support real theorycrafting, tactical utility, quest identity, crafting, loot hunting, marketplace activity, collection, and live balance without turning inventory management into clerical work or making every item a stat stick.

> **An item is a connected game object with purpose, acquisition, ownership, targeting, effects, requirements, presentation, balance context, and lifecycle — not merely a row containing damage and rarity.**

AUREVANE should support weapons that deal damage, armor that changes movement decisions, accessories that reshape Skills, consumables that create tactical openings, tools that manipulate terrain/objectives, materials used in crafting, relics with collection/lore value, and key/story items that represent world progression.

This document uses the current build/combat vocabulary:

- Primary Discipline;
- optional mastered Secondary Discipline;
- Discipline Skills;
- Resonance for mixed builds;
- Essence for pure builds;
- Soulmark or Soul-Severed/Mantle supernatural paths;
- Equipment Skills where equipment grants an active ability;
- the current shared Action Economy (AE) defined by `docs/COMBAT.md`.

The former Current/Legacy, Art, Confluence, separate Trait/Reaction/Movement Art/Ultimate slots, and Movement Budget + one Action assumptions are retired from current item/loadout design.

---

## 1. One Item Architecture, Multiple Player-Facing Inventories

Recommended player-facing views:

```text
EQUIPMENT
CONSUMABLES
MATERIALS
QUEST & KEY ITEMS
COLLECTION / RELICS where appropriate
```

Crowns and other ledger currencies are not physical inventory stacks.

Internally, these views should share one coherent item/inventory domain where practical rather than five unrelated persistence systems.

---

## 2. Equipment Inventory

Core slots remain:

```text
Main Hand
Off Hand
Armor
Accessory I
Accessory II
```

Do not casually add many permanent equipment slots. Depth comes from effects and interactions rather than slot inflation.

Equipment inventory supports:

- equip/unequip;
- compare;
- filter/search/sort;
- favorite;
- lock/protect;
- saved-loadout usage indicators;
- known acquisition source;
- current/previewed stat and effect changes;
- mode restrictions;
- tradable/bound/quest-locked state.

---

## 3. Consumable Inventory

Consumables may include:

- combat consumables;
- exploration consumables;
- Expedition supplies;
- crafting-use consumables;
- event/world tools;
- utility items.

Strategic examples:

- create smoke/concealment;
- remove a status;
- create temporary cover;
- reveal hidden/invisible state when allowed;
- cleanse/transform terrain;
- create a zone;
- push/pull under strict rules;
- restore bounded resources;
- apply setup statuses;
- deploy traps;
- interact with objectives;
- provide authored out-of-combat escape/return utility.

A consumable does not need to deal damage to be valuable.

---

## 4. Materials Inventory

Materials support crafting, upgrading, trade, quests and economy loops.

They are usually stackable and presented compactly. Players should not scroll through hundreds of individual copies of the same material.

---

## 5. Quest & Key Item Inventory

Story/key items have a protected inventory view.

They are normally:

- non-tradable;
- non-sellable;
- non-discardable unless explicitly authored;
- excluded from ordinary capacity pressure;
- excluded from bulk salvage/sell;
- referenced by quest/story logic through stable IDs.

Their presentation may evolve with story knowledge.

Never make players fear accidentally deleting the item required to finish a long quest chain.

---

## 6. Collection / Relic Items

Relics/trophies/curios/memorabilia can feed Archive, achievements, future display systems, Hall of Selves or social presentation without entering normal combat balance.

---

## 7. Item Definition vs Item Instance

### Item Definition

Published shared design:

- stable ID;
- name/class/type/rarity;
- eligibility;
- slot/weapon category;
- stat modifiers;
- effects;
- tags;
- targeting/use rules;
- acquisition;
- tradability/binding;
- art/audio;
- Codex/Manual metadata;
- version/publish state.

### Item Instance

Player-owned object/stack:

- owner;
- definition reference;
- quantity;
- bound state;
- acquired-at/source/provenance;
- rolled properties only if that system is explicitly supported;
- charges/durability only where authored;
- cosmetic state where permitted;
- lock/favorite state;
- unique-instance identity where needed.

Do not duplicate static definition fields across every instance without a persistence reason.

---

## 8. Stable Identity & Relationships

Stable item identity connects:

```text
item definition
→ inventory ownership
→ equipment/loadouts
→ loot tables
→ stores/vendors
→ quests
→ crafting
→ marketplace
→ Codex
→ art/audio
→ analytics
→ Master Panel
→ support/audit
```

Renaming an item must not break a quest/loadout.

---

## 9. Item Classes

Conceptual top-level classes:

```text
EQUIPMENT
CONSUMABLE
MATERIAL
QUEST_KEY
COLLECTION
```

Add future classes only when they truly require distinct behavior.

---

## 10. Rarity

Five tiers remain:

```text
Common
Uncommon
Rare
Epic
Legendary
```

Rarity communicates scarcity/importance, not universal mathematical superiority. A niche Rare may be better for a specific build than a general Legendary.

---

## 11. Eligibility

Possible requirements include:

- character level;
- Discipline known/Mastery stage;
- Primary/Secondary Discipline identity/category where justified;
- weapon proficiency/category;
- story/quest state;
- region/faction/nation;
- Horizon;
- event entitlement;
- special Owner/test entitlement.

Requirements must remain understandable and explain unmet conditions clearly.

---

## 12. Effect Catalog

AUREVANE uses a reusable **Effect Catalog**: controlled approved effects used by Skills, items, passives/triggered systems, Resonances, Essence, Soulmarks/Mantles, terrain, objectives and encounter modifiers.

Representative primitives include:

```text
DAMAGE
HEAL
SHIELD
PUSH
PULL
MOVE
TELEPORT
SWAP
APPLY_STATUS
REMOVE_STATUS
SPAWN_SUMMON
REMOVE_SUMMON
CREATE_TERRAIN
DESTROY_TERRAIN
TRANSFORM_TERRAIN
CREATE_ZONE
MODIFY_STAT
MODIFY_ACTION_ECONOMY
MODIFY_TRAVERSAL_COST
MODIFY_INITIATIVE
RESTORE_RESOURCE
DRAIN_RESOURCE
GAIN_DISCIPLINE_RESOURCE
SPEND_DISCIPLINE_RESOURCE
CHANGE_COOLDOWN
TAUNT
STEALTH
REVEAL
COPY_EFFECT
DISPEL
DELAY_TURN
ACCELERATE_TURN
SPAWN_BATTLE_OBJECT
REMOVE_BATTLE_OBJECT
SET_FACING
SCHEDULE_EFFECT
GRANT_CONSTRAINED_COMMAND
```

The catalog evolves only when real mechanics require new primitives.

Older implementation identifiers may survive migration where technically necessary, but new content should model current combat behavior rather than the retired Movement Budget + one Action economy.

---

## 13. Damage Is an Effect, Not an Assumption

Damage is optional.

Examples:

- smoke creates a zone;
- hook pulls;
- cleansing vial removes status;
- wardstone creates cover/barrier;
- flare reveals;
- relay crystal interacts with objective;
- teleport charm repositions;
- blood vial exchanges HP/MP under authored rules;
- frost capsule transforms terrain.

Typed effects define behavior; controlled tags such as Fire, Storm, Weapon, Projectile, Melee, Blood, Area and Displacement define relationships.

---

## 14. Effect Definition & Sequence

An Effect Definition can contain:

```text
identity / primitive
source tags
target source
conditions
formula / magnitude
duration
stack policy
mode override
result tags
VFX/SFX event
AI valuation hints
version
```

An item/Skill can execute explicit ordered effects.

Example:

```text
Smoke Capsule
1 CREATE_ZONE smoke radius 2
2 APPLY_STATUS Concealed to eligible units
3 SCHEDULE_EFFECT zone decay/removal
```

Example equipment trigger:

```text
Gravemark Spear
On valid Basic Attack hit:
1 DAMAGE target
2 if actor moved >= authored threshold this turn:
   PUSH target 1 tile
```

Ordering is deterministic.

---

## 15. Effect Triggers & Filters

Supported typed triggers may include:

```text
ON_EQUIP
ON_BATTLE_START
ON_TURN_START
ON_TURN_END
ON_MOVE_DISTANCE
ON_ENTER_TERRAIN
ON_LEAVE_TERRAIN
ON_BASIC_ATTACK_HIT
ON_SKILL_HIT
ON_CRIT
ON_TAKE_DAMAGE
ON_BLOCK
ON_PARRY
ON_STATUS_APPLIED
ON_DISPLACEMENT
ON_TELEPORT
ON_HEAL
ON_OVERHEAL
ON_ALLY_DEFEATED
ON_ENEMY_DEFEATED
ON_OBJECTIVE_INTERACT
ON_ITEM_USE
```

Filters can include:

- once per turn/round/battle;
- cooldown;
- HP threshold;
- tag;
- movement distance;
- target status;
- terrain;
- ally/enemy;
- Primary/Secondary Discipline;
- Resonance/Essence route where justified;
- Soulmark/Mantle state;
- battle mode;
- objective state.

Ordinary content editors do not receive arbitrary free-form executable scripting.

---

## 16. Effect Loop Safety

The engine must prevent infinite effect chains.

Use:

- deterministic trigger ordering;
- once-per-X consumption;
- event-chain depth/loop guards;
- prohibited recursive combinations where required;
- validation warnings;
- regression/property tests.

Master Panel warns about suspicious graphs before publication.

---

## 17. Passive Stat Modifiers

Items may modify established stats including:

- Might;
- Finesse;
- Vitality;
- Agility;
- Intellect;
- Resolve;
- HP/MP;
- Physical/Mystic Power;
- Armor/Ward;
- Accuracy/Evasion;
- Critical Chance;
- Initiative;
- Movement/Jump;
- Status Resistance.

Flat/percentage stacking is explicit/bounded. Stat blocks are not the only item identity.

---

## 18. Action/Skill-Modifying Equipment

Examples:

- after moving an authored distance, next ranged Skill gains +1 range;
- Basic Attack becomes a two-tile spear thrust;
- Guard additionally protects against one push;
- first teleport each round leaves a zone;
- Barrier application rotates/protects under authored rules;
- healing a Wet ally cleanses an additional allowed status;
- line Skills pierce one destructible object at reduced power;
- a movement-capable Skill refunds bounded AE under a terrain condition.

Modifiers use stable tags/hooks and appear in forecast/inspection where relevant.

---

## 19. Equipment Skills & Item Actions

Some equipment grants an active **Equipment Skill**. Some consumables/scenario items expose an item-use command.

Examples:

- smoke bomb;
- grappling device;
- field tonic;
- deployable ward;
- throwable vial;
- quest-specific battle tool.

They use the same typed targeting, requirement, Effect Sequence, Action Economy, cooldown and AI-legality framework as other combat Skills/actions.

There is no second item combat engine.

Equipment Skills sit outside the 6/8 Discipline Skill capacity but remain bounded by equipment slots and authored rules.

---

## 20. Action Economy Cost Model

`docs/COMBAT.md` controls the current combat economy.

PV-1F uses one shared 0–100 **Action Economy (AE)** pool. The former `Movement Budget + one Action` item model is retired.

An active item/Equipment Skill may define:

- AE cost;
- MP cost;
- HP cost;
- temporary Discipline-resource cost;
- item quantity/charge;
- cooldown;
- once-per-turn/round/battle limits;
- scenario/mode restrictions.

Triggered/passive effects may use 0 AE only when their authored trigger/cap says so. Free/bonus command generation is exceptional and must be bounded against loops.

---

## 21. Battle Action Economy Tracker

The battle UI should communicate at a glance:

```text
AE: current / 100 (or authoritative modified maximum)
MP: current / max
Temporary Discipline resource: when relevant
Selected Skill/item AE cost
Selected secondary resource/charge cost
Projected AE/resource state after commit
Cooldown/charges
```

Preview is informational; server validation controls commit.

Example:

```text
AE 70 → 40
MP 52 → 24
Item 2 → 1
```

Do not restore a separate generic `Movement / Action / Reaction` tracker unless a later combat revision explicitly approves it.

---

## 22. Equipment and Action Economy

Equipment may carefully affect:

- AE cost of tagged Skills within caps;
- traversal cost under a condition;
- cooldown once per battle/round;
- bounded AE refund after a specific trigger;
- constrained follow-up command after an explicit trigger.

High-risk effects include:

- large AE refunds;
- extra turns;
- repeated free commands;
- cooldown loops;
- resource-neutral infinite chains.

These require strict budgets, simulations/regression tests and telemetry.

---

## 23. Targeting & Requirements

Active items/Equipment Skills use the same target grammar as other Skills:

- target kind/shape;
- range/min range;
- origin;
- line of sight;
- height;
- filters;
- friendly fire;
- terrain/object targeting;
- multi-stage selection;
- automatic secondary-target policy where authored.

Use requirements may include:

- mode allows the item;
- character owns quantity/charge;
- item is in allowed combat-item kit;
- actor has enough AE/resources;
- target is legal;
- level/profession/story requirements;
- required terrain/object;
- cooldown ready;
- equipment/hands requirement where genuinely needed.

Safe failure messages should explain why an action is illegal.

---

## 24. Combat Consumable Kit

Players should not have unrestricted access to their entire backpack during battle.

Pre-battle builds may contain a small configurable combat-consumable kit.

Principles:

- small number of slots;
- exact count determined by playtesting;
- duplicate rules configurable;
- PvP may use stricter normalization/allowlists;
- story scenarios may grant temporary scenario items outside normal kit.

Goal: tactical preparation, not backpack scrolling mid-turn.

---

## 25. Capacity, Overflow & Protection

Inventory management should organize, not punish.

- key/story items do not consume ordinary capacity;
- sane stack sizes;
- generous equipment storage for experimentation;
- rewards never silently disappear because capacity is full;
- use bounded Recovery Stash/Overflow for exceptional cases;
- paid capacity is never required for normal progression;
- avoid constant forced vendor trips.

Overflow has clear notification/retention rules and stronger protection for unique/key/paid/Legendary rewards.

Players may Favorite or Lock items. Locked items cannot be sold, salvaged, discarded or consumed as crafting material without explicit unlock/confirmation.

---

## 26. Bulk Actions

Bulk sell/salvage/transfer:

- never includes key items;
- excludes locked/favorite by default;
- warns if referenced by saved loadouts;
- previews total result;
- validates every affected instance server-side;
- uses transactions/idempotency to prevent partial loss/duplication.

---

## 27. Character Profile / Armory Build Headquarters

Persistent build configuration belongs in the **Character Profile** with an Armory/build-management experience rather than six disconnected database pages.

Suggested structure:

```text
OVERVIEW
ATTRIBUTES / DERIVED STATS
PRIMARY DISCIPLINE
OPTIONAL SECONDARY DISCIPLINE
DISCIPLINE SKILLS
RESONANCE OR ESSENCE
SUPERNATURAL PATH
EQUIPMENT / EQUIPMENT SKILLS
COMBAT ITEMS
INTERACTION PREVIEW
SAVED LOADOUTS
```

Pure path:

```text
Primary only
up to 8 Primary Discipline Skills
+ 1 Essence Skill
+ no Resonance
```

Mixed path:

```text
Primary + mastered Secondary
6 total Discipline Skills across both libraries
+ Resonance passive
+ no pure Essence while Secondary is equipped
```

Character remains visually central. Changes preview meaningful derived-stat and interaction deltas.

---

## 28. Three Saved Loadout Presets

Every normal character supports **three saved combat loadouts** as a baseline convenience feature once dependent systems exist.

A loadout may store:

```text
name / icon
Primary Discipline
optional Secondary Discipline
selected Discipline Skills
resolved build route: Resonance or Essence
Soulmark configuration OR Soul-Severed/Mantle configuration where legal
Main Hand
Off Hand
Armor
Accessory I
Accessory II
combat consumable kit
optional safe cosmetic battle-presentation choices
```

Resonance is resolved/validated from the active Primary + Secondary pair. Essence is resolved/validated from a Primary-only build. A loadout cannot manually forge an impossible Resonance/Essence state.

Saved presets are convenience, not entitlement to equip illegal content.

---

## 29. Loadout UX

Players can:

- save current build;
- load preset;
- rename;
- duplicate;
- compare;
- see missing/invalid components;
- see mode restrictions;
- see estimated stat/interaction changes;
- assign approved icon/color presentation;
- set preferred defaults for contexts where appropriate.

Switching should feel immediate outside restrictions but must obey persistent legality.

---

## 30. Primary / Secondary Attunement Cooldowns

Saved loadouts **do not bypass** live Primary/Secondary change commitments.

The current production design default is independent server-authoritative four-real-hour cooldowns for Primary and Secondary changes, configurable/versioned through Master Panel.

Activating a preset that would change a locked Discipline slot must fail safely or present the exact authoritative restriction; it does not silently bypass the cooldown because the choice was previously saved.

Preview/sandbox practice can represent alternative builds under its own rules without mutating persistent live state.

---

## 31. Loadout Validation

Before activation server validates:

- ownership of character/items;
- level requirements;
- Secondary is mastered when equipped;
- selected Discipline Skills are learned and within pure/mixed capacity;
- pure/mixed build route is legal;
- Resonance/Essence resolves legally;
- supernatural state/configuration is legal;
- equipment slots/categories and weapon requirements are valid;
- content is active/enabled unless explicit entitlement allows otherwise;
- combat consumables are owned;
- queue/mode restrictions;
- Primary/Secondary attunement cooldowns;
- current location/context restrictions.

Preset may remain saved while temporarily invalid, but UI explains exactly what is wrong.

---

## 32. Missing Item & Destructive Behavior

If a referenced item is sold/traded/removed:

- preset is not silently deleted;
- missing slot is marked;
- activation fails until repaired unless an explicit fallback exists;
- destructive actions warn that the item is used by preset(s).

Support/Owner corrections preserve provenance/audit.

---

## 33. Battle Snapshots

Normal build editing occurs outside active battle.

At battle creation, server snapshots the legal build and relevant content versions.

The player cannot freely swap Primary/Secondary, Skills, supernatural configuration, equipment or consumable kit mid-battle unless an explicit battle mechanic allows a bounded change.

PvP queueing validates/locks the relevant snapshot under queue rules.

---

## 34. Loadout Convenience Is Not Pay-to-Win

Three saved loadouts are base-game convenience.

Additional convenience slots, if ever monetized, cannot grant:

- more equipped Discipline Skills;
- extra Essence/Resonance access;
- extra Equipment Skills;
- more combat consumables;
- higher stats;
- bypassed attunement cooldowns;
- faster restricted swapping;
- stronger Battle Hall access;
- progression acceleration.

---

## 35. Acquisition Is First-Class Data

Acquisition paths include:

- enemy drop;
- boss/Expedition loot;
- quest reward;
- world event;
- vendor;
- crafting;
- reputation/faction;
- recurring PvP seasonal rewards where combat relevance requires recurrence/alternate paths;
- nation content;
- starter/tutorial;
- commerce-safe premium cosmetic/account goods;
- Owner/support grant;
- internal/test.

Known acquisition should render from authoritative rules where practical.

---

## 36. Target Farming, Loot Tables & Personal Loot

Important build-enabling equipment has understandable sources.

Loot tables define:

- eligible pools;
- weights;
- quantity;
- rarity/quality rules;
- personal-loot behavior;
- first-clear bonuses;
- bad-luck protection groups;
- eligibility;
- event/mode/difficulty modifiers;
- unique ownership rules;
- fallback rewards.

Client never chooses drops.

Expedition/boss loot remains personal where designed; teammates do not race to click a chest.

---

## 37. Unique Ownership, Binding & Trading

Possible uniqueness:

```text
NONE
UNIQUE_EQUIPPED
UNIQUE_CHARACTER
UNIQUE_ACCOUNT where justified
```

Duplicate behavior is explicit; duplicates are never silently deleted.

Binding policies can include:

```text
TRADEABLE
BIND_ON_EQUIP
BIND_ON_ACQUIRE
ACCOUNT_BOUND
NON_TRADEABLE
QUEST_LOCKED
```

Use binding deliberately rather than turning the economy into non-tradable clutter.

---

## 38. Durability, Charges, Sets & Affixes

- No universal durability chore by default.
- Charges are distinct and used only where an item requires them.
- Sets generally use 2–3 meaningful pieces, not six-piece mandatory uniforms.
- Set bonuses use the Effect Catalog and remain inspectable.
- Do not introduce random-affix overload by default.
- If affixes arrive, use curated pools, bounded ranges, typed effects, provenance and combination validation.
- Named/Legendary items retain authored identity.

---

## 39. Effect / Power Budget

Master Panel can provide soft warnings for:

- excess stat efficiency;
- high damage + control + mobility stacks;
- zero-cost loops;
- excessive cooldown/AE manipulation;
- repeated free-command effects;
- excessive defensive layering;
- PvP control risk;
- effect duplication.

Budget is a warning tool, not an auto-designer. Owner can deliberately override safe warnings with reason/audit.

---

## 40. Strategic Non-Damage Items

Examples:

### Pathfinder's Boots

Reduce traversal penalty under a bounded authored condition; no damage bonus.

### Mirror Buckler

First successful Guard against an eligible projectile Marks the attacker; modest defense.

### Wayfinder Lens

Improves reveal/scouting effects against stealth/illusion builds.

### Anchor Charm

Once per battle prevents one eligible forced displacement, then becomes inert for that battle.

### Emberglass Vial

Creates a heat zone that alters Frozen terrain with little/no direct damage.

### Pilgrim's Thread

Improves a narrow objective/escort positioning interaction.

These should create counterbuilds and tactical choices.

---

## 41. Item Counterplay & PvP

Strong item effects require readable counterplay.

Ask:

- is the relevant effect visible when loadout-inspection rules allow it?
- is there a telegraph/status/icon?
- can it be baited, dispelled, avoided, outranged, repositioned or exhausted?
- is it bounded per turn/round/battle?
- does it dominate a matchup without alternatives?

Arena Tempering remains the main raw-stat fairness direction.

Ranked may use transparent versioned:

- stat compression;
- mode coefficients;
- duration adjustment;
- consumable allowlists/limits;
- emergency item disable;
- summon/object caps;
- standardized charges.

Do not maintain a duplicate PvP item catalog.

---

## 42. Item Inspection, Tooltips, Art & Audio

Inspection may show:

- name/art/rarity/type;
- requirements;
- stats;
- passive/triggered effects;
- Equipment Skills/item actions;
- target/range/AE/resource cost;
- cooldown/charges;
- set;
- binding/trade state;
- acquisition source;
- lore;
- equipped/loadout usage;
- PvP override.

Use progressive disclosure.

Art effort focuses on Legendaries, iconic quest relics, major weapons, notable sets and important consumables while common/material art remains efficient but intentional.

Audio events may include equip, consume, throw/deploy, impact, proc, ward, rare acquisition, Legendary acquisition and key-item discovery.

---

## 43. Inventory UX, Search & Codex

Inventory should feel like a polished RPG interface:

- strong central space;
- category tabs;
- grid/list where useful;
- collapsing filters;
- hover and click/tap inspection;
- quick comparison;
- safe multi-select;
- clear quantities/protection indicators;
- keyboard/touch support;
- low-friction Character Profile/Armory navigation.

Useful filters can include rarity, type/slot, weapon category, level, usable now, tradability, set, source, effect tags, status interaction, Primary/Secondary compatibility, loadout usage, new/recent and favorite/locked.

Inventory answers **what do I own?**

Codex answers **what does my character know exists?**

Inventory never leaks hidden/unreleased definitions.

---

## 44. Quest Items & Archive

A physical quest item may unlock an Archive entry; consuming/transferring the physical item later does not erase learned knowledge.

Quest logic explicitly defines whether an item is checked/retained, consumed, transformed/replaced, temporarily removed, or returned later.

Story item presentation may evolve with authoritative spoiler-aware states.

---

## 45. Crafting, Marketplace & Vendors

Crafting atomically consumes authoritative inputs and creates outputs; no duplicated inputs, output-without-consumption, partial state, client-chosen result, or stale-inventory race.

Marketplace transfers are atomic and understand definition/instance/binding/quantity/unique rules. Equipped items cannot be simultaneously transferred without explicit atomic handling.

Normal vendors reference authoritative definitions and may use Crown price, stock, reputation/story/Horizon requirements, rotations, buy limits, sell-back rules, world/event availability and region/nation context.

USD premium commerce remains separate under `docs/MONETIZATION.md`.

---

## 46. Premium Guardrail

Premium shop cannot sell:

- superior combat equipment;
- extra equipped combat slots;
- stronger combat consumables;
- extra consumable slots;
- exclusive meta-defining item effects;
- higher Action Economy;
- bypassed loadout/attunement restrictions;
- progression-exclusive equipment shortcuts.

Commerce-safe cosmetics/skins/presentation are acceptable.

---

## 47. Provenance, Authority & Transactions

Important provenance values may include:

```text
LOOT
QUEST
VENDOR
CRAFT
MARKETPLACE
EVENT
SUPPORT_GRANT
OWNER_OVERRIDE
PREMIUM_ENTITLEMENT where commerce-safe
INTERNAL_TEST
MIGRATION
```

Server owns:

- ownership/quantity;
- equip/bound state;
- consumption;
- trade/listing;
- quest item state;
- crafting inputs/outputs;
- reward delivery;
- loadout activation;
- combat-item kit;
- effect legality;
- item-use result.

Multi-step inventory operations use transactions/idempotency where applicable.

---

## 48. Loadout Activation as One Authoritative Command

Conceptually:

```text
activate_loadout(character_id, loadout_id, expected_version)
```

Server:

1. authenticates ownership;
2. loads preset;
3. validates Skills/items/build state;
4. validates context/mode restrictions;
5. validates Primary/Secondary cooldowns;
6. resolves legal Resonance or Essence route;
7. validates supernatural/equipment/consumable state;
8. applies legal changes atomically;
9. increments build version;
10. returns resulting snapshot.

The browser does not issue many independent equip/change requests and hope all succeed.

Saved loadouts/build state carry versions so stale edits do not silently overwrite one another.

---

## 49. Build Comparison & Warnings

Compare active build, preset and candidate item with meaningful deltas:

```text
+12 Armor
-4 Initiative
Basic Attack range 1 → 2
First teleport each round creates Mirror Decoy
Rough-terrain traversal cost reduced under authored condition
```

Do not reduce depth to one fake Power Score.

Warnings can flag:

- Skill requires unequipped weapon/category;
- duplicate unique item;
- consumable unavailable;
- retired/disabled content;
- PvP-restricted item;
- invalid/unmastered Secondary;
- illegal pure/mixed Skill capacity;
- no legal Resonance/Essence state;
- Primary/Secondary attunement cooldown;
- illegal supernatural configuration;
- over-cap combat kit;
- redundant/nonfunctional interaction;
- non-stacking effects.

Warnings explain rather than silently strip choices.

Beginner guidance may offer Foundation presets, starter recommended Skills, tags and example synergies without auto-optimizing everyone into one meta build.

---

## 50. Master Panel — Item Studio & Effect Catalog

Structured Item Studio sections:

```text
IDENTITY
OWNERSHIP
ELIGIBILITY
EQUIPMENT
ACTIVE SKILL / TARGETING
EFFECTS
ACQUISITION
PRESENTATION
PVP
VALIDATION
VERSION
```

Effect Catalog shows:

- primitive description;
- valid target sources/parameters;
- safety bounds;
- affected systems;
- tags;
- AI support;
- Manual docs;
- test coverage;
- version/availability.

New engine primitives require engineering/tests before becoming ordinary authoring options.

---

## 51. Trigger Graph, Target Preview & Acquisition Graph

For complex equipment, visualize:

```text
TRIGGER
  ↓
CONDITION
  ↓
EFFECT(S)
  ↓
COOLDOWN / LIMIT
```

Active Equipment Skills/items use the same targeting test board as combat content.

Acquisition graph answers:

> Where can a player legitimately obtain this?

It links loot, quests, vendors, crafting, events, PvP, nation/reputation, commerce-safe premium sources, and internal/Owner-only sources.

Important item with no legitimate path is flagged.

---

## 52. Dependency / Impact Preview

Before editing/retiring, show dependencies including:

- saved player loadouts;
- equipped count;
- marketplace listings;
- quests;
- recipes;
- vendors;
- loot tables;
- sets;
- Skills/Resonances/Essence/Soulmark/Mantle/status/tag interactions;
- AI loadouts;
- Battle Hall scenarios;
- Codex/Manual;
- premium relationship;
- active battles pinned to older version.

Retirement never hard-deletes definitions still needed by ownership/audit/history.

---

## 53. Test Equip, Analytics & Balance Controls

Authorized staff can launch test characters with selected legal level/attributes/build/equipment/consumables/map/AI/seed using the real server-authoritative combat engine.

Analytics can measure:

### Equipment

- ownership/equip rate;
- level/Horizon;
- Primary/Secondary pairing;
- Resonance vs Essence route;
- supernatural pairing;
- PvE/PvP performance association;
- replacement/time equipped;
- marketplace price/volume;
- acquisition source;
- trigger frequency/value;
- map/terrain correlation;
- underused effects.

### Consumables

- carried/use rate;
- success;
- encounter context;
- unused-at-end;
- economy impact;
- PvP association.

Telemetry informs humans; it does not auto-balance.

Versioned balance controls may adjust compatible stat/effect/cooldown/AE/resource/range/proc/PvP/loot/vendor/requirement values with dependency/simulation review.

---

## 54. Item Retirement & Versioning

Retirement options can include:

- no longer obtainable;
- existing copies remain;
- explicit legacy/cosmetic migration;
- exchange/replacement;
- ranked disable;
- compensated migration.

Workflow:

```text
DRAFT
→ VALIDATE
→ PREVIEW / TEST
→ DIFF
→ PUBLISH
→ MONITOR
→ ROLLBACK if necessary
```

Existing battles pin relevant content versions. Ownership keeps stable definition identity.

---

## 55. Contextual Balance & Retention

Items can be strong through:

- mobility;
- terrain;
- objective pressure;
- defense;
- setup consistency;
- team synergy;
- anti-stealth/control;
- resource efficiency;
- Action Economy interactions;
- map shape;
- matchup specificity.

Healthy long-term goals include target farming, completing a small set, finding a niche counter, crafting a component, obtaining a beautiful Legendary, discovering a relic, filling a Codex entry, saving a new loadout, and revisiting old content for newly relevant effects.

Prefer fewer meaningful equipment drops over trash-loot spam.

---

## 56. Salvage & Story Item Safety

If salvage exists:

- optional/clear;
- useful output;
- respects lock/favorite/loadout references;
- safe bulk behavior;
- no mandatory micromanagement;
- server-authoritative transaction.

Quest/key/premium-protected items are excluded unless a specific safe rule exists.

---

## 57. Discovery & Notifications

Codex discovery states may include:

```text
Hidden
Rumored
Discovered
Known
Owned
```

Hidden future content never appears merely because it exists in production tables.

Use restrained notifications for:

- new Legendary;
- first-time discovery;
- key quest item;
- item completing set;
- item enabling/fixing loadout;
- overflow warning.

Do not celebrate every common material with a modal.

---

## 58. No Hidden Effect Soup

Prefer a memorable thesis:

> **This spear rewards moving before attacking.**

rather than many tiny unrelated proc percentages.

Use complexity budgets. Legendary effects may be dramatic but remain understandable.

Repeated player-facing effects use stable names/definitions so tooltips and glossary do not drift.

---

## 59. Visual Representation & Cosmetics

Where scope allows, equipment may influence portrait treatment, battle weapon silhouette, inspect screen, loadout cards and victory presentation without requiring bespoke full-character redraws for every item.

Combat set identity and cosmetic appearance are separate. Future cosmetic override must preserve tactical weapon/readability requirements in competitive play.

---

## 60. AI & Enemy/NPC Equipment

AI uses the same legal item/effect rules as players and can value Equipment Skills, procs, cooldowns, consumables, terrain modifiers, defensive thresholds, objectives, counter items and AE impact.

Enemies may use player equipment definitions or enemy-only equipment-like content where appropriate. Monsters need not own marketplace item instances; the combat engine cares about legal actions/effects.

---

## 61. Battle Hall & Loadouts

Battle Hall can let a player test their legal saved loadouts against legitimately unlocked practice content.

Questions it should help answer:

- which loadout handles this AI better?
- which item matters on this terrain?
- is this consumable worth carrying?
- does the build have enough mobility?
- what happens if I change one Secondary Discipline Skill?
- how does the Resonance route compare with the pure Essence route?

Practice does not bypass ownership, attunement cooldowns or persistent progression rules unless explicitly running a non-persistent sandbox representation.

---

## 62. Build Sharing — Later

A future social feature may share a build card containing only player-approved/game-permitted information for guild advice, theorycrafting, tournament recaps or Hall of Selves history.

Never expose private/unrevealed inventory data without permission.

---

## 63. Implementation Timing

### Phase 1 — Character Foundation

Implement only needed foundations:

- stable Item Definition boundary;
- Item Instance/stack ownership;
- core equipment slots;
- basic equipment inventory;
- authoritative equip/unequip;
- derived-stat recalculation;
- protected Quest/Key category boundary;
- Character Profile/Armory foundation when scoped;
- saved-loadout storage only when dependencies exist cleanly.

### Phase 2 — Tactical Combat Core

- Effect Catalog primitives required by released slice;
- Basic Attack weapon profiles where used;
- representative item/equipment effects required by test content;
- shared AE integration and forecast;
- combat-item grammar only if real released content uses it;
- no giant consumable catalog.

### Phase 3 — Signature Buildcraft

- loadouts become fully meaningful with Primary/Secondary, Discipline Skills, Resonance/Essence and released supernatural systems;
- three presets;
- atomic activation/versioning;
- attunement-cooldown validation;
- trigger/filter expansion required by real equipment;
- initial combat-consumable kit;
- comparison/warnings;
- Equipment Skill integration;
- AI understanding of item/build interactions.

### Phase 4 — First Playable Content

- representative equipment/consumables with strategic non-damage effects;
- item identities that create decisions;
- no filler duplicate gear;
- Battle Hall loadout testing;
- AI coverage;
- first telemetry.

### Phase 5 — World / Quests

- Quest & Key inventory becomes active;
- consume/retain/transform rules;
- story state variants;
- vendors/acquisition links;
- Codex discovery;
- world rewards connect to authoritative inventory.

### Phase 7 — Expeditions

- personal loot;
- targeted pools;
- rare chase/bad-luck protection;
- Expedition consumables/tools where approved;
- suspend/reconnect preserves run inventory state.

### Phase 8 — PvP

- ranked build/item validation;
- Arena Tempering;
- consumable allowlists;
- PvP overrides;
- AE/effect exploit tests;
- inspect/counterplay rules.

### Phase 11 — Economy

- stores/vendors;
- mature loot;
- marketplace;
- crafting/materials;
- binding/trading;
- salvage if approved;
- telemetry;
- overflow/recovery;
- acquisition graph maturity.

### Phase 13 — Master Panel

Complete Item/Effect operations:

- Item Studio;
- Effect Catalog;
- trigger graph;
- target preview;
- acquisition/dependency graphs;
- test equip/battle;
- power-budget warnings;
- analytics;
- staged publish/rollback;
- retirement/migration;
- emergency disable;
- permissions/audit;
- Owner support corrections.

### Phase 14 — Production Polish

- icons/key art;
- Legendary presentation;
- Armory/inventory polish;
- item/Equipment Skill VFX/SFX;
- responsive mobile build UI;
- AE tracker/forecast polish;
- comparison/tooltips;
- accessibility.

### Phase 15 — Hardening

- ownership/concurrency;
- duplicate rewards;
- bulk safety;
- marketplace/equip races;
- loadout atomicity/version/attunement races;
- key-item protection;
- overflow;
- effect loops/property tests;
- AE/resource/refund/free-command exploits;
- PvP normalization;
- retirement/migration;
- permissions/audit;
- large-inventory performance.

---

## 64. Definition of Success

The system succeeds when:

- inventory is understandable for new players;
- protected story items are safe;
- equipment creates meaningful build choices, not only bigger numbers;
- non-damage utility is genuinely desirable;
- active items/Equipment Skills use the same clear combat grammar as other Skills;
- AE/resource costs are always understandable;
- players can maintain three legal saved builds and switch cleanly outside restrictions;
- saved loadouts respect Primary/Secondary attunement cooldowns and current 8-pure/6-mixed Discipline Skill rules;
- Resonance/Essence state resolves legally;
- loadouts fail safely and explain why;
- tactical tradeoffs are visible without a misleading single Power Score;
- loot is exciting without garbage spam;
- acquisition paths support targeted progression;
- AI understands equipment through shared rules;
- PvP keeps equipment meaningful without raw-stat hopelessness;
- Master Panel can author, test, rebalance, publish, retire and inspect dependencies without routine source/database edits;
- stable identities connect gameplay, inventory, loadouts, combat, quests, economy, Codex/Manual, art/audio, analytics, AI, simulation, support and live operations;
- the system feels deep because interactions matter, not because the inventory contains hundreds of arbitrary fields.