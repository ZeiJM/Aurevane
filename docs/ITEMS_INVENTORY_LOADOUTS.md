# AUREVANE — Items, Effect Catalog, Inventory & Loadout System

**Status:** Authoritative item/inventory/loadout expansion subordinate to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/COMBAT.md`, `docs/PRODUCT_EXPERIENCE_CONTENT_SYSTEM.md`, `docs/MASTER_PANEL.md`, `docs/PLAYER_MANUAL.md`, and `docs/MONETIZATION.md`.

**Direction approved:** 2026-08-15.

AUREVANE's item system must be deep enough to support real theorycrafting, tactical utility, quest identity, crafting, loot hunting, marketplace activity, collection, and live balance — without turning inventory management into clerical work or making every item a stat stick.

The core principle is:

> **An item is a connected game object with purpose, acquisition, ownership, targeting, effects, requirements, presentation, balance context, and lifecycle — not merely a row containing damage and rarity.**

AUREVANE should support weapons that deal damage, armor that changes movement decisions, accessories that reshape Arts, consumables that create tactical openings, tools that manipulate terrain or objectives, materials used in crafting, relics with collection/lore value, and key/story items that exist solely to represent world progression.

This is inspired only by the abstract idea that a browser RPG can make content authorable and interconnected. AUREVANE must use its own combat grammar, art direction, progression, terminology, UI, and balance philosophy.

---

## 1. One Item Architecture, Multiple Player-Facing Inventories

The player should experience inventory as clear categories rather than one endless mixed list.

Recommended top-level inventory views:

```text
EQUIPMENT
CONSUMABLES
MATERIALS
QUEST & KEY ITEMS
COLLECTION / RELICS where appropriate
```

Currencies such as Crowns live in their own authoritative ledger and are **not physical inventory stacks**.

Internally, these views should use one coherent item/inventory domain where practical rather than five unrelated persistence systems.

The player-facing separation exists for clarity and safety.

---

## 2. Equipment Inventory

Equipment includes items that can occupy character equipment slots or otherwise alter the active build.

Existing core slots remain:

```text
Main Hand
Off Hand
Armor
Accessory I
Accessory II
```

Do not casually add ten more permanent equipment slots.

Depth should come from meaningful effects and interactions rather than slot inflation.

Equipment inventory supports:

- equip/unequip;
- compare;
- filter by slot/category/rarity/level/source/tag;
- search;
- favorite;
- lock/protect from destructive actions;
- sort by recent/power/name/rarity/acquisition;
- show which saved loadouts use an item;
- show known acquisition source;
- show current and previewed stat/effect changes;
- show mode restrictions where relevant;
- show whether an item is tradable/bound/quest-locked.

---

## 3. Consumable Inventory

Consumables are limited-use items.

They may be:

- combat consumables;
- exploration consumables;
- Expedition supplies;
- crafting-use consumables;
- event/world tools;
- utility items.

Examples of strategic consumable behavior:

- create smoke/concealment;
- remove a status;
- create temporary cover;
- reveal invisible/hidden state if the mode permits;
- cleanse terrain;
- create a small zone;
- push/pull within a strict rule;
- restore a bounded resource;
- apply a setup status;
- deploy a trap;
- interact with an objective;
- escape/return item outside combat where authored.

A consumable does **not** need to deal damage to be valuable.

---

## 4. Materials Inventory

Materials exist primarily for crafting, upgrading, trade, quests, and economy loops.

Examples:

- ores;
- fibers;
- monster parts;
- alchemical reagents;
- wood/stone/crystals;
- Expedition components;
- profession-specific ingredients;
- event materials where appropriate.

Materials are usually stackable and should support compact presentation.

The player should not need to scroll through 300 individual copies of the same herb.

---

## 5. Quest & Key Item Inventory

Story/key items must have their own protected inventory view.

These can represent:

- keys;
- seals;
- letters;
- relics;
- quest evidence;
- faction credentials;
- maps;
- ritual components;
- story tokens;
- recovered artifacts;
- temporary quest tools.

Key items are normally:

- non-tradable;
- non-sellable;
- non-discardable unless the quest/system explicitly supports it;
- excluded from ordinary bag-capacity pressure;
- safe from bulk salvage/sell actions;
- automatically referenced by quest/story logic through stable IDs.

Some key items can be hidden from the player until discovered, or can change description as story knowledge develops.

Do not make the player fear accidentally selling the item required to finish a six-hour quest chain.

---

## 6. Collection / Relic Items

Some objects are neither equipment nor ordinary quest items.

Examples:

- lore relics;
- trophies;
- rare curios;
- museum/archive objects;
- first-witness memorabilia;
- boss trophies;
- collectible cards/tokens if such a system is later approved.

These can feed Archive, achievements, housing/display systems, Hall of Selves, or social profile presentation without entering normal combat balance.

---

## 7. Item Definition Versus Item Instance

The architecture should separate an **Item Definition** from an **owned Item Instance** where needed.

### Item Definition

The published design shared by every copy:

- stable ID;
- name;
- item class/type;
- rarity;
- level/eligibility rules;
- slot/weapon category;
- stat modifiers;
- effects;
- tags;
- targeting/use rules if active;
- acquisition rules;
- tradability/binding rules;
- art/audio;
- Codex/manual metadata;
- version/publish state.

### Item Instance

The player's owned object/stack:

- owner;
- definition reference;
- quantity for stackable items;
- bound state;
- acquired-at/source/provenance;
- randomized/rolled affixes only if the specific item system later supports them;
- charges/durability only when that item actually uses such a system;
- custom cosmetic state where permitted;
- lock/favorite state;
- unique-instance identity where needed.

Do not duplicate static definition fields into every inventory row without a real persistence reason.

---

## 8. Stable Item Identity

Every important item has a stable internal identity independent of its current display name.

That stable ID connects:

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

Renaming an item must not break a quest or a saved loadout.

---

## 9. Item Classes

Use a small explicit classification rather than one giant `OTHER` bucket.

Conceptually:

```text
EQUIPMENT
CONSUMABLE
MATERIAL
QUEST_KEY
COLLECTION
```

Equipment can then have subtypes/slot data such as weapon, armor, accessory, shield, etc.

Special future classes should be added only when they truly require distinct behavior.

---

## 10. Rarity

The Master Plan's five tiers remain:

```text
Common
Uncommon
Rare
Epic
Legendary
```

Rarity communicates scarcity/importance, but it must not become a guarantee that every Legendary is mathematically correct for every build.

A niche Rare can be better for a particular strategy than a general Legendary.

That is healthy theorycrafting.

---

## 11. Item Level / Eligibility

Equipment can use minimum level and other eligibility rules, but requirements must remain understandable.

Possible requirements:

- character level;
- Discipline known/mastery stage;
- current/legacy Discipline category where justified;
- weapon proficiency/category;
- story/quest state;
- region/faction/nation state;
- Horizon;
- event entitlement;
- special owner/test entitlement.

Do not attach eight requirements to every sword.

The item page should explain unmet requirements clearly.

---

## 12. The Effect Catalog

AUREVANE needs a reusable **Effect Catalog** — a controlled inventory of approved game effects that content designers can combine to build Arts, items, Traits, Reactions, Soulmarks, Confluences, terrain interactions, objectives, and encounter modifiers.

This is one of the keys to scaling content safely.

Examples of effect primitives already established by the Master Plan / combat specification include:

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
MODIFY_MOVEMENT_BUDGET
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
INTERRUPT
SCHEDULE_EFFECT
GRANT_CONSTRAINED_ACTION
```

The exact catalog evolves only when actual mechanics require new primitives.

---

## 13. Damage Is an Effect, Not an Assumption

The important design principle is that **damage is optional**.

An item/action is not presumed to damage merely because it can be used in battle.

A smoke bomb can create a zone.

A hook can pull.

A cleansing vial can remove a status.

A wardstone can create cover/barrier.

A flare can reveal.

A relay crystal can interact with an objective.

A teleport charm can reposition.

A blood vial can trade HP for MP.

A frost capsule can transform terrain.

This allows utility items and strategic equipment to matter without every piece competing on raw damage-per-turn.

### Effect type versus tags

`DAMAGE` is a typed effect primitive.

The same effect can also carry semantic tags such as:

```text
Fire
Storm
Weapon
Projectile
Melee
Blood
Area
Displacement
```

Do not reduce all effect meaning to loose strings.

Use typed effects for behavior and tags for controlled relationships/interactions.

---

## 14. Effect Definition

A reusable Effect Definition can describe:

```text
identity / primitive type
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

Some simple effects can be inline configuration on the owning content object.

Frequently reused/complex effects may deserve stable reusable definitions.

Do not create thousands of tiny one-use database rows purely for theoretical reuse.

---

## 15. Effect Sequences

An item or Art can execute ordered effects.

Example utility consumable:

```text
Smoke Capsule

1 CREATE_ZONE smoke radius 2
2 APPLY_STATUS Concealed to eligible units inside according to rule
3 SCHEDULE_EFFECT remove/decay zone after duration
```

Example weapon effect:

```text
Gravemark Spear

On valid Basic Attack hit:
1 DAMAGE target
2 if actor moved >= 3 Movement Budget this turn:
   PUSH target 1 tile
```

Ordering is explicit and deterministic.

---

## 16. Effect Triggers

Items/equipment can attach effects to explicit triggers.

Examples:

```text
ON_EQUIP / derived-stat recalculation
ON_BATTLE_START
ON_TURN_START
ON_TURN_END
ON_MOVE_DISTANCE
ON_ENTER_TERRAIN
ON_LEAVE_TERRAIN
ON_BASIC_ATTACK_HIT
ON_ART_HIT
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

Do not create a global free-form event language exposed to ordinary content editors.

Supported triggers are typed, documented, and tested.

---

## 17. Trigger Filters

A trigger can be constrained by conditions:

- once per turn;
- once per round;
- once per battle;
- cooldown;
- HP threshold;
- specific tag;
- minimum movement distance;
- target status;
- terrain;
- ally/enemy;
- Current/Legacy Discipline;
- Soulmark;
- battle mode;
- objective state.

This is how equipment becomes interesting without unrestricted scripting.

---

## 18. Effect Loop Safety

The effect system must prevent accidental infinite chains.

Examples of dangerous patterns:

- item A triggers heal on damage;
- item B triggers damage on heal;
- item C refreshes both indefinitely.

The combat engine needs:

- deterministic trigger ordering;
- once-per-X consumption;
- event-chain depth/loop guards where appropriate;
- prohibited recursive combinations where necessary;
- validation warnings;
- golden regression tests.

The Master Panel should warn about suspicious trigger graphs before publishing.

---

## 19. Passive Stat Modifiers

Items can modify derived stats, but stat blocks should not be the only item identity.

Examples:

- Might;
- Finesse;
- Intellect;
- Resolve;
- HP/MP;
- Armor/Ward;
- Accuracy/Evasion;
- Initiative;
- Movement/Jump where carefully balanced;
- status resistance.

Flat/percentage stacking rules must be explicit and bounded.

---

## 20. Action-Modifying Effects

Some equipment can modify an existing action without granting a new button.

Examples:

- after moving four points, next ranged Art gains +1 range;
- Basic Attack becomes a two-tile spear thrust;
- Guard additionally protects against one push;
- first teleport each round leaves a one-turn zone;
- applying Barrier to an ally also rotates them toward the attacker;
- healing a Wet ally removes one additional status;
- line Arts pierce one destructible object at reduced power;
- a Movement Art refunds one point if ending on road terrain.

These modifiers reference stable tags/hooks and must be visible in forecasts where relevant.

---

## 21. Item-Granted Actions

Some items can grant an active combat action.

Examples:

- smoke bomb;
- grappling device;
- field tonic;
- deployable ward;
- throwable alchemical vial;
- quest-specific battle tool.

Item-granted actions use the same combat Target Spec, use requirements, Effect Sequence, and action-economy rules as Arts.

No second `item combat engine`.

---

## 22. Action Cost Model for Items

AUREVANE's baseline combat economy remains `Movement Budget + one Action`, not a universal percentage Action Point meter.

Therefore an item's combat action declares an **Action Cost Class** such as:

```text
NORMAL_ACTION
REACTION / triggered
MOVEMENT_ART_STYLE only for specifically allowed special content
CONSTRAINED_BONUS_ACTION
PASSIVE
OUT_OF_COMBAT
```

A normal combat consumable should generally consume the one normal Action.

Bonus/free actions are exceptional and require strong caps.

An item can additionally cost:

- MP;
- HP;
- temporary Discipline resource;
- remaining Movement Budget;
- item charge/quantity;
- once-per-battle use;
- cooldown.

---

## 23. Battle Action Economy Tracker

The battle UI must include a compact, readable **Turn Economy Tracker**.

The player should be able to understand at a glance:

```text
Movement: 3 / 6 remaining
Action: READY / SPENT
Reaction: READY / COOLDOWN / USED
MP: current / max
Discipline resource: when relevant
Selected action cost: what will be spent
Cooldown/charges: visible on the relevant action
```

The tracker is not decorative.

When the player previews an action, it shows projected post-action state:

```text
Movement 3 → 1
Action READY → SPENT
MP 52 → 24
Item 2 → 1
```

This is how AUREVANE retains the useful clarity of an action-cost system without importing a percentage AP economy.

---

## 24. Equipment Can Affect Action Economy Carefully

Examples:

- reduce MP cost of tagged Arts within a cap;
- refund one Movement Budget under a condition;
- increase Movement Budget on a terrain type;
- reduce a cooldown once per battle;
- allow one constrained follow-up Basic Attack after a specific trigger;
- improve Reaction availability under a condition.

High-risk effects include:

- extra Actions;
- extra turns;
- cooldown loops;
- resource-neutral infinite chains.

These require strict design budgets, simulation/regression tests, and live analytics.

---

## 25. Item Targeting

Any active item uses the same typed target grammar as combat Arts.

It can specify:

- target kind;
- target shape;
- range/min range;
- origin;
- line of sight;
- height;
- filters;
- friendly fire;
- terrain/object targeting;
- multi-stage selection;
- automatic secondary-target policy.

Examples:

### Cleansing Phial

```text
Target: SELF or ALLY_UNIT
Range: 0–2
Effect: REMOVE_STATUS from approved dispellable categories
Action Cost: NORMAL_ACTION
```

### Smoke Canister

```text
Target: GROUND_TILE
Range: 1–4
Shape: CIRCLE radius 2
Effect: CREATE_ZONE smoke
Action Cost: NORMAL_ACTION
```

### Breaching Charge

```text
Target: destructible BATTLE_OBJECT
Range: adjacent
Effect: heavy object damage / authored breach effect
Use: scenario/mode restricted
```

---

## 26. Item Use Requirements

Items can have typed requirements such as:

- battle mode allows items;
- character owns quantity/charge;
- item equipped in combat-item loadout;
- actor has normal Action available;
- target legal;
- required level;
- required profession;
- required story state;
- required object/terrain present;
- cooldown ready;
- not Silenced only if the item logically requires casting;
- hands/free/equipment requirement where the mechanic warrants it.

Requirements must produce clear player-facing failure messages where safe.

---

## 27. Combat Consumable Loadout

Players should not have unrestricted access to their entire inventory during battle.

A pre-battle build can include a small configurable **combat consumable kit**.

Initial planning direction:

- a small number of consumable slots;
- exact count tuned through playtesting rather than assumed from another game;
- duplicate item rules configurable;
- PvP may use stricter normalization/allowlists;
- story scenarios may grant temporary scenario items outside the normal kit.

The goal is tactical preparation, not backpack scrolling mid-turn.

---

## 28. Inventory Capacity Philosophy

Inventory management should create organization and collection decisions, not punitive inconvenience designed to sell storage.

Principles:

- key/story items do not consume ordinary capacity;
- stackable materials/consumables use sane stack sizes;
- equipment storage is generous enough for build experimentation;
- quest rewards should never be silently deleted because a bag is full;
- use a recovery/overflow mechanism for exceptional cases;
- do not make paid inventory capacity necessary for normal progression;
- avoid constant forced vendor trips.

If capacity exists, it should be tunable and player-friendly.

---

## 29. Overflow / Recovery Stash

When a reward cannot enter normal inventory safely:

- it enters a bounded Recovery Stash / Overflow;
- player receives clear notification;
- important unique/key rewards receive stronger protection;
- overflow has explicit retention rules if any;
- the game does not silently destroy paid, legendary, quest, or one-time rewards.

This system is server-authoritative and audited for support.

---

## 30. Favorite / Lock

Players can mark equipment/items as:

- Favorite;
- Locked/Protected.

Locked items cannot be sold, salvaged, discarded, or used as crafting material without explicit unlock/confirmation.

Saved loadouts automatically flag referenced equipment before destructive operations.

---

## 31. Bulk Actions

Bulk sell/salvage/transfer operations need filters and previews.

Safety:

- never include key items;
- exclude locked/favorite items by default;
- warn if item belongs to a saved loadout;
- show total result before confirmation;
- server validates each affected instance;
- transaction/idempotency protects against partial duplication/loss.

---

## 32. Central Build / Armory Page

AUREVANE should have one polished **Build / Armory** destination where the player configures the combat-ready character.

It should not require bouncing through six disconnected database pages.

Suggested structure:

```text
OVERVIEW
EQUIPMENT
ARTS
TRAITS & REACTION
MOVEMENT ART
SOULMARK & CONFLUENCE
COMBAT ITEMS
STATS / INTERACTION PREVIEW
SAVED LOADOUTS
```

The character remains visually central.

Changes update a clear preview of derived stats and important mechanics before saving/equipping.

---

## 33. Three Saved Loadout Presets

Every normal character should support **three saved combat loadouts** as a baseline feature.

These are not premium power.

A loadout can store:

```text
name / icon
Current Discipline
Legacy Discipline
4 Current Arts
2 Legacy Arts
2 Traits
Reaction
Movement Art
Soulmark
resolved Confluence reference
Main Hand
Off Hand
Armor
Accessory I
Accessory II
combat consumable kit
optional cosmetic battle-presentation choices where safe
```

The Confluence is resolved/validated from Current + Legacy rather than manually forged into an invalid pairing.

---

## 34. Loadout Preset UX

Players can:

- save current build into preset;
- load preset;
- rename preset;
- duplicate one preset into another;
- compare presets;
- see missing/invalid components;
- see mode restrictions;
- see estimated stat/result changes;
- optionally assign custom icon/color from approved UI options;
- set a preferred default for PvE/Tactical Hall where appropriate.

Switching should feel immediate and satisfying outside restricted contexts.

---

## 35. Loadout Validation

The server validates a preset before activation:

- character owns/equips referenced item instances;
- level requirements met;
- Legacy Discipline mastered;
- Arts actually learned;
- Traits/Reaction/Movement Art legal;
- Soulmark unlocked;
- equipment slot/category compatible;
- weapon requirements satisfied;
- no retired/disabled content unless entitlement allows it;
- combat consumables owned;
- queue/mode restrictions satisfied.

The preset may remain saved even when temporarily invalid, but the UI shows exactly what needs fixing.

---

## 36. Missing Item Behavior

If a player sells/trades/loses an item referenced by a preset:

- preset is not silently deleted;
- missing slot is clearly marked;
- character cannot activate that preset until repaired or valid fallback behavior is explicitly designed;
- destructive actions warn that the item is referenced by preset(s).

Support/Owner corrections preserve audit/provenance.

---

## 37. Loadout Changes and Battle Snapshots

Normal loadout editing occurs outside active battle.

When battle begins, the server snapshots the legal combat build/content versions.

The player cannot swap armor, Arts, Soulmark, or consumable kit mid-battle unless the battle system explicitly provides an authored mechanic for doing so.

PvP queueing also locks/validates the relevant build under the queue's rules.

---

## 38. Loadout Convenience Is Not Pay-to-Win

Three saved loadouts are part of the base game.

If additional convenience slots are ever monetized, they must never grant:

- more equipped Arts;
- more combat consumables;
- higher stats;
- faster swapping inside restricted content;
- stronger Tactical Hall access;
- progression acceleration.

Do not deliberately make base loadout management painful in order to sell relief.

---

## 39. Item Acquisition Is First-Class Data

An item definition can reference one or more acquisition paths:

- enemy drop;
- boss/Expedition loot;
- quest reward;
- world-event reward;
- vendor/store;
- crafting recipe;
- reputation/faction reward;
- PvP seasonal reward where competitive power recurs/has alternate access;
- nation content later;
- starter/tutorial;
- premium commerce only for commerce-safe cosmetic/account goods;
- Owner/support grant;
- internal/test.

Known acquisition should render from authoritative rules where practical.

---

## 40. Target Farming

Important build-enabling equipment should have understandable sources.

Players should be able to answer:

> Where do I go to pursue this build?

Without guaranteeing the exact drop every run, the game should surface known source families and use bad-luck protection where extremely rare chase items would otherwise become unhealthy.

---

## 41. Loot Tables

Loot tables are stable versioned content relationships.

They can define:

- eligible item pools;
- weights;
- quantity ranges;
- rarity/quality rules;
- personal-loot behavior;
- first-clear bonus;
- bad-luck protection group;
- account/character eligibility;
- event modifiers;
- mode/difficulty;
- unique ownership rules;
- fallback currency/material rewards.

The client never chooses the drop.

---

## 42. Personal Loot

Expedition/boss personal-loot direction remains.

Players should not race to click a chest before teammates.

Server resolves each eligible player's rewards authoritatively and idempotently.

---

## 43. Unique / Limited Ownership

Some items may be unique-equipped or unique-owned.

This must be explicit:

```text
NONE
UNIQUE_EQUIPPED
UNIQUE_CHARACTER
UNIQUE_ACCOUNT where justified
```

Duplicate behavior should be defined:

- convert to material/currency;
- reroll within pool;
- allow duplicate but only one equipped;
- other authored outcome.

Do not silently delete the duplicate.

---

## 44. Binding / Trading

Possible binding policies:

```text
TRADEABLE
BIND_ON_EQUIP
BIND_ON_ACQUIRE
ACCOUNT_BOUND
NON_TRADEABLE
QUEST_LOCKED
```

Use binding deliberately.

Avoid converting the whole economy into non-tradable clutter.

Paid premium cosmetics/entitlements follow commerce ownership rules and must not be accidentally tradable for Crowns if that enables real-money economic abuse.

---

## 45. Durability

AUREVANE should **not** assume universal durability/repair attrition merely because other RPGs use it.

Durability is supported as optional metadata only if a specific item/content loop genuinely benefits from it.

Do not create routine repair chores that add no tactical or economic value.

Charges on consumables/devices are a separate, clearer concept.

---

## 46. Equipment Sets

The Master Plan's small-set philosophy remains.

Meaningful sets should usually use 2–3 pieces, not six-piece mandatory uniforms.

Set bonuses should:

- reinforce a build idea;
- use the same Effect Catalog;
- remain inspectable;
- not erase gear experimentation;
- be included in impact/balance analytics.

---

## 47. Affixes / Procedural Rolls

Do not introduce Diablo-style random affix overload by default.

If item variation later needs affixes:

- use a curated affix pool;
- stable typed effects;
- bounded roll ranges;
- clear item identity;
- deterministic provenance;
- no impossible/contradictory combinations;
- balance budgets;
- market-friendly inspectability.

Named items and Legendaries should retain authored identity rather than becoming generic bases with random numbers.

---

## 48. Effect / Power Budget

The Master Panel should support **soft balance budgets**.

A budget is a warning/analysis system, not a simplistic formula that auto-designs items.

It can flag combinations such as:

- too much baseline stat efficiency for level/rarity;
- high damage plus high control plus free mobility;
- zero-cost resource loops;
- excessive cooldown reduction;
- extra-action stacking;
- too many defensive layers;
- PvP control risk;
- effect duplication with an existing item.

The Owner can deliberately override a warning with reason/audit where safe.

---

## 49. Strategic Non-Damage Items

The design team should intentionally create attractive items whose value is not raw DPS.

Examples:

### Pathfinder's Boots

- difficult terrain costs one less Movement Budget once per turn;
- no damage bonus.

### Mirror Buckler

- first successful Guard against a projectile marks the attacker;
- modest defensive stats.

### Wayfinder Lens

- increases range of reveal/scouting effects;
- helps against stealth/illusion builds.

### Anchor Charm

- once per battle, prevent one forced displacement;
- then becomes inert for that battle.

### Emberglass Vial

- creates a temporary heat zone that melts Frozen terrain;
- very low/no direct damage.

### Pilgrim's Thread

- improves Interact/escort/objective positioning under a narrow rule.

These create real tactical choices and counterbuilds.

---

## 50. Item Counterplay

Strong item effects need readable counterplay.

Questions:

- can an opponent see the relevant equipped effect when game rules allow loadout inspection?
- is there a telegraph/status/icon?
- can it be baited, dispelled, avoided, outranged, repositioned, or exhausted?
- is it once-per-round/once-per-battle?
- does it dominate one matchup without alternative response?

The goal is powerful tools, not gotcha effects hidden in tiny tooltip text.

---

## 51. PvP Equipment Rules

Arena Tempering remains the main raw-stat fairness system.

Equipment effects can remain meaningful, but ranked PvP can use explicit rules such as:

- stat compression bands;
- mode-specific coefficients;
- effect duration adjustment;
- consumable allowlist/limits;
- disabled broken item emergency flag;
- summon/object caps;
- standardized charges;
- normalized durability if durability ever exists.

Mode overrides are versioned and visible.

Do not maintain a completely separate duplicate item catalog for PvP.

---

## 52. Item Inspection

Player-facing inspection should reveal useful information without exposing hidden server/internal content.

Possible fields:

- name;
- art;
- rarity;
- slot/type;
- level/requirements;
- stats;
- passive/triggered effects;
- granted actions;
- target/range/action cost for active items;
- cooldown/charges;
- set information;
- bound/trade state;
- acquisition source if known;
- flavor/lore;
- current equipped/loadout usage;
- PvP override note where relevant.

Use progressive disclosure rather than one wall of raw fields.

---

## 53. Item Art

Items need recognizable, authored visual identity.

Premium art effort should focus on:

- Legendaries;
- iconic quest relics;
- major weapons;
- notable sets;
- important consumable silhouettes;
- story artifacts.

Common/material items can use efficient approved art kits while still avoiding obvious duplicate placeholders.

At inventory scale, icons must remain readable at small sizes.

---

## 54. Item Audio

Important item actions can reference audio events:

- equip;
- consume/use;
- throw/deploy;
- impact;
- activate proc;
- shield/ward;
- rare acquisition;
- Legendary acquisition;
- quest/key-item discovery.

Do not attach bespoke audio to every herb.

---

## 55. Inventory UX

The inventory should feel like a polished RPG interface, not a database table.

Design priorities:

- large central usable space;
- responsive grid/list toggle where useful;
- clear category tabs;
- filters that collapse when not needed;
- hover **and** click/tap inspection;
- compare equipped item quickly;
- multi-select for safe bulk actions;
- clear stack quantities;
- unmistakable locked/favorite/quest indicators;
- keyboard/game-style shortcuts where practical;
- good mobile/touch behavior;
- low-friction move to equipment/loadout page.

---

## 56. Search and Filters

Useful filters can include:

- text search;
- rarity;
- type/slot;
- weapon category;
- level range;
- usable now;
- tradable/bound;
- set;
- acquired source;
- effect tags;
- status interaction;
- Current/Legacy compatibility;
- loadout usage;
- new/recent;
- locked/favorite.

Do not present fifteen filters by default on a small screen.

Use an expandable advanced-filter surface.

---

## 57. Inventory and Codex Are Different

Inventory answers:

> What do I own?

Codex answers:

> What does my character know exists?

The Codex can show discovered but unowned equipment/items and known acquisition sources.

The inventory must not leak hidden/unreleased definitions simply because the database contains them.

---

## 58. Quest Item and Archive Relationship

A physical quest item may also unlock an Archive entry or evidence record.

The two systems are linked but not identical.

Example:

- obtain `Ash-Sealed Letter` as a quest item;
- reading it unlocks an Archive source;
- quest later consumes/transfers the physical letter;
- Archive knowledge remains preserved.

This avoids deleting learned lore when the item leaves inventory.

---

## 59. Crafting Relationship

Crafting consumes authoritative material/item instances and creates authoritative outputs.

Recipes reference stable item definitions.

Transactions must prevent:

- duplicated inputs;
- output without consumption;
- partial craft state;
- client-selected result;
- stale inventory races.

Later crafting professions can use effect/item templates without inventing separate item behavior.

---

## 60. Marketplace Relationship

Tradable item instances/stacks can enter the marketplace through atomic server-side transfers.

The marketplace must understand:

- definition;
- instance properties;
- binding;
- quantity;
- unique limits;
- affixes/rolls if implemented;
- current content version/display;
- seller ownership;
- listing lock state.

An item cannot remain simultaneously equipped and transferred unless the service explicitly handles unequip atomically.

---

## 61. Vendor / Store Relationship

Normal in-game vendors reference authoritative item definitions/acquisition rules.

A vendor offer can define:

- item;
- Crown price;
- stock rules;
- reputation/story/Horizon requirement;
- refresh/rotation;
- buy limit;
- sell-back policy;
- world/event availability;
- region/nation context.

Premium USD commerce remains a separate system governed by `docs/MONETIZATION.md`.

Do not mix real-money price fields into ordinary Crown vendor logic.

---

## 62. Premium Cosmetics and Items

Premium goods can use the item/entitlement presentation framework where useful, but normal premium commerce must remain non-P2W.

The premium shop cannot sell:

- superior combat equipment;
- extra equipped slots;
- stronger combat consumables;
- more consumable slots;
- exclusive meta-defining item effects;
- higher action economy;
- stronger loadouts;
- progression-exclusive equipment shortcuts.

Cosmetic weapon skins, appearance variants, profile presentation, and other approved non-power goods are acceptable.

---

## 63. Item Provenance

Important ownership mutations should preserve provenance such as:

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

This helps support, exploit investigation, economy analytics, and rollback.

---

## 64. Inventory Authority

The server owns:

- ownership;
- quantity;
- equip state;
- bound state;
- item consumption;
- trade/listing state;
- quest item state;
- crafting consumption/output;
- reward delivery;
- loadout activation;
- combat-item kit;
- effect legality;
- item use result.

The client submits intent only.

---

## 65. Inventory Transactions

Multi-step inventory operations require transactions/idempotency where applicable.

Examples:

- equip new Main Hand and unequip old one;
- marketplace sale;
- crafting;
- loot grant;
- quest reward/consume;
- bulk sell;
- loadout activation affecting several equipment slots;
- combat consumable use;
- owner/support correction.

No partial state such as `currency removed but item never granted`.

---

## 66. Loadout Activation as One Authoritative Command

Activating a saved preset should be one domain command.

Conceptually:

```text
activate_loadout(character_id, loadout_id, expected_version)
```

Server:

1. authenticates ownership;
2. loads preset;
3. validates all referenced learned/equipped/owned content;
4. validates current mode/location restrictions;
5. resolves Confluence;
6. applies the build atomically;
7. increments character/build version;
8. returns resulting snapshot.

Do not make the browser issue eleven independent equip requests and hope all succeed.

---

## 67. Loadout Versioning

Saved loadouts should have a version/update timestamp so stale simultaneous edits do not silently overwrite each other.

The character's active build can also carry a build version used when entering battle.

Battle creation snapshots the active build.

---

## 68. Build Comparison

The Armory can compare:

- current active build;
- another saved preset;
- hovered inventory item;
- candidate equipment change.

Show meaningful deltas:

```text
+12 Armor
-4 Initiative
Basic Attack range 1 → 2
First teleport each round creates Mirror Decoy
Movement on rubble 2 → 1
```

Do not reduce comparison to one fake `Power Score` that hides tactical tradeoffs.

A rough score can exist for basic guidance if clearly non-authoritative, but build depth must remain visible.

---

## 69. Build Warnings

The build screen can flag:

- Art requires a weapon not equipped;
- duplicate unique item;
- consumable unavailable;
- retired/disabled content;
- PvP-restricted item;
- Current/Legacy invalid;
- missing Mastery;
- no legal Confluence state;
- over-cap combat-item kit;
- redundant/possibly nonfunctional interaction;
- two effects that do not stack as the player may expect.

Warnings explain rather than silently stripping choices.

---

## 70. Recommended Build Help Without Solving the Game

The game can offer beginner-friendly guidance:

- Foundation presets;
- starter recommended Arts;
- simple tags such as `Defensive`, `Mobility`, `Zone Control`;
- warnings for nonfunctional weapon requirements;
- example synergies.

Do not auto-optimize everyone into one meta build.

Discovery/theorycrafting is a core retention pillar.

---

## 71. Master Panel — Item Studio

The Master Panel should eventually contain an **Item Studio** with structured sections rather than one giant flat form.

Suggested editor flow:

```text
IDENTITY
  name / class / subtype / rarity / flavor / tags

OWNERSHIP
  stack / unique / binding / trade / key-item protections

ELIGIBILITY
  level / Discipline / quest / story / mode requirements

EQUIPMENT
  slot / weapon category / base stats / set

ACTION / TARGETING
  action cost / combat item use / target spec / range / shape

EFFECTS
  passive / triggered / granted actions / effect sequence

ACQUISITION
  loot / quest / vendor / craft / event / other

PRESENTATION
  icon / key art / VFX / SFX / tooltip / Codex

PVP
  Arena Tempering / mode overrides / restrictions

VALIDATION
  power-budget warnings / interaction graph / test character

VERSION
  draft / preview / diff / publish / rollback / retire
```

---

## 72. Master Panel — Effect Catalog

Authorized staff can inspect the approved Effect Catalog.

For each primitive/template:

- description;
- valid target sources;
- valid parameters;
- safety bounds;
- affected systems;
- tags;
- AI support state;
- manual documentation;
- test coverage;
- version/availability.

Adding a brand-new primitive is closer to engineering work than normal content entry and may require code/tests before appearing in the catalog.

Content editors configure approved effects; they do not invent executable code.

---

## 73. Master Panel — Effect/Trigger Graph

For complex equipment, the Item Studio can visualize:

```text
TRIGGER
  ↓
CONDITION
  ↓
EFFECT(S)
  ↓
COOLDOWN / LIMIT
```

Example:

```text
ON_TELEPORT
  ↓
first time this round
  ↓
CREATE_ZONE at origin
  ↓
APPLY_STATUS Exposed to enemies entering
```

This is easier to review than hidden nested JSON.

---

## 74. Master Panel — Target Preview

If an item grants an active combat action, the editor uses the same visual targeting test board planned by `docs/COMBAT.md`.

The owner can see:

- valid target types;
- range;
- shape;
- line clipping;
- friendly fire;
- height;
- terrain/object targeting;
- projected effect sequence.

---

## 75. Master Panel — Acquisition Graph

The Item Studio should eventually answer:

> Where can a player legitimately obtain this?

Show links from:

- loot tables;
- quests;
- vendors;
- crafting recipes;
- events;
- PvP rewards;
- nation/reputation systems;
- premium catalog if commerce-safe;
- internal/Owner grant only.

An important item with no acquisition path can be flagged before publication.

---

## 76. Master Panel — Dependency / Impact Preview

Before editing/retiring an item, show dependencies such as:

- saved player loadouts using it;
- current equipped count;
- marketplace listings;
- quests requiring/rewarding it;
- recipes consuming/creating it;
- vendors selling it;
- loot tables dropping it;
- sets referencing it;
- Arts/Traits/Confluences/statuses interacting with its tags;
- AI loadouts using it;
- Tactical Hall scenarios using it;
- Codex/manual entries;
- premium product relationship if any;
- active battles pinned to an older version.

A destructive edit should not surprise the live game.

---

## 77. Master Panel — Test Equip

Authorized staff should be able to launch a test character with:

- selected level;
- attributes;
- Disciplines;
- Soulmark;
- equipment;
- consumable kit;
- selected map;
- selected AI;
- deterministic seed.

The test uses the real server-authoritative combat engine.

---

## 78. Master Panel — Item Analytics

Useful item telemetry can include:

### Equipment

- ownership rate;
- equip rate among owners;
- equip rate by level/Horizon;
- Current/Legacy pairing;
- Soulmark pairing;
- PvE/PvP win/performance association;
- common replacement item;
- time equipped before replacement;
- marketplace price/volume where tradable;
- acquisition source distribution;
- effect trigger frequency/value;
- map/terrain correlation;
- underused effects.

### Consumables

- carried rate;
- use rate;
- use success;
- use by encounter type;
- unused-at-end rate;
- cost/reward impact;
- PvP use/win correlation;
- economy sink/source impact.

Telemetry informs humans and does not auto-balance live content.

---

## 79. Owner Balance Controls

Authorized staff can safely adjust published balance values through versioned draft/publish workflows.

Examples:

- stat values;
- effect coefficients;
- cooldown;
- MP/resource cost;
- use limit;
- target range/shape within compatible rules;
- proc limit;
- PvP coefficient;
- loot weight;
- vendor price;
- requirement;
- active/retired state.

High-impact changes should prompt appropriate dependency/simulation review.

---

## 80. Item Retirement

Retiring an item is not the same as deleting its history.

Possible retirement behavior:

- no longer drops/sells/crafts;
- existing copies remain usable;
- existing copies become legacy/cosmetic according to an explicit migration;
- replacement/exchange offered;
- disabled in ranked but preserved elsewhere;
- full migration performed with compensation.

The Master Panel must show impact before retirement.

Never hard-delete an item definition that is still referenced by ownership/audit/history.

---

## 81. Content Versioning

Important item/effect changes follow:

```text
DRAFT
→ VALIDATE
→ PREVIEW / TEST
→ DIFF
→ PUBLISH
→ MONITOR
→ ROLLBACK if necessary
```

Existing battles pin relevant versions.

Inventory ownership retains stable definition identity.

---

## 82. Item Balance Is Contextual

Do not balance only against a single dummy DPS test.

An item can be strong because of:

- mobility;
- terrain;
- objective pressure;
- defense;
- setup consistency;
- team synergy;
- anti-stealth;
- anti-control;
- resource efficiency;
- action economy;
- map shape;
- matchup specificity.

Balance Lab should consider those dimensions.

---

## 83. Loadout Analytics

Track preset usage without collecting unnecessary sensitive information.

Useful metrics:

- % players using saved loadouts;
- switch frequency;
- common named system categories (not user-entered names for analytics unless needed);
- invalid preset causes;
- loadout activation failures;
- mode-specific preset use;
- item/Art combinations;
- time from item acquisition to equip;
- preset conversion after balance patch.

---

## 84. Inventory Retention Loop

Inventory should support healthy long-term goals:

- targeted gear hunt;
- complete a small set;
- find a niche counter item;
- craft a build component;
- obtain a beautiful Legendary;
- discover a quest relic;
- fill a Codex/collection entry;
- save a new loadout around a new item;
- revisit older content for a newly relevant effect.

Avoid endless trash-loot showers that force constant cleanup.

---

## 85. Loot Quality Over Quantity

AUREVANE should prefer fewer meaningful drops over inventory spam.

Common materials can be frequent.

Equipment drops should feel inspectable and potentially purposeful.

The game should not require the player to delete 80 nearly identical swords after every Expedition.

---

## 86. Salvage

If salvage is implemented, it should:

- be optional/clear;
- produce useful materials;
- respect lock/favorite/loadout use;
- support safe bulk actions;
- not become mandatory micromanagement after every fight;
- use server-authoritative transactions.

Quest/key/premium protected items are excluded unless a specific safe rule exists.

---

## 87. Quest Consumption Rules

Quest logic must explicitly define whether an item is:

- checked but retained;
- consumed;
- transformed/replaced;
- temporarily removed;
- returned later.

The UI communicates this before an irreversible hand-in where meaningful.

---

## 88. Story Item Variants

A story item's presentation can evolve without creating duplicate disconnected definitions.

Example states:

```text
Unknown Sealed Relic
→ Identified as Closed-Star Reliquary
→ Cracked Reliquary
→ Empty Reliquary / Archive record remains
```

State transitions are authoritative and spoiler-aware.

---

## 89. Item Discovery

The Codex can use discovery states such as:

```text
Hidden
Rumored
Discovered
Known
Owned
```

A hidden future Legendary should not appear in a public inventory filter simply because it exists in production content tables.

---

## 90. Inventory Notifications

Use restrained notifications for:

- new Legendary;
- first-time item discovery;
- key quest item;
- item completing a set;
- item enabling/fixing a saved loadout;
- overflow/recovery warning.

Do not celebrate every common herb with a modal.

---

## 91. Item Tooltips

Tooltips use progressive disclosure.

Quick layer:

- name;
- rarity/type;
- main stats;
- core effect;
- requirements;
- compare delta.

Expanded:

- exact trigger;
- cooldown/limit;
- target/action cost;
- set;
- acquisition;
- PvP override;
- flavor/lore;
- effect tags/interactions.

Deep mechanics link to Manual/Codex.

---

## 92. No Hidden “Effect Soup”

An item with five triggered effects is not automatically more interesting than one with one clear identity.

Prefer a memorable thesis:

> **This spear rewards moving before attacking.**

rather than:

> +4% damage, +3% crit, +2% MP, 7% chance to Burn, 4% chance to Heal, 2% chance to Haste...

Use complexity budget per item.

Legendary effects may be more dramatic but should still be understandable.

---

## 93. Effect Naming

Player-facing named effects should use stable readable names when repeated.

Example:

```text
Anchored — cannot be displaced by the next eligible effect this round.
```

Avoid tooltips repeating slightly different prose for the same mechanic across 20 items.

The underlying status/effect definition can feed the glossary.

---

## 94. Equipment Visual Representation

Where production scope allows, equipped weapon/armor can influence:

- character portrait treatment;
- battle token/weapon silhouette;
- inspect screen;
- loadout card;
- victory presentation.

Do not require full bespoke character redraws for every item.

Use layered/approved visual systems efficiently.

---

## 95. Item Sets and Cosmetics

Combat set identity and cosmetic appearance are separate.

A player should not be forced into an ugly visual combination to keep a build if a safe cosmetic/transmog-like presentation system is later approved.

Cosmetic override must not obscure tactical weapon category/readability in PvP.

---

## 96. Item/Effect Support for AI

AI uses the same item/effect rules as players.

AI profiles can value:

- granted active actions;
- proc/setup effects;
- cooldowns;
- consumables;
- terrain modifiers;
- defensive thresholds;
- objective tools;
- counter items;
- action-economy impact.

AI must not ignore an equipped item simply because its logic exists in a separate system.

---

## 97. Enemy/NPC Equipment

Enemies can use equipment definitions or enemy-only equipment-like content where appropriate, but do not force every creature to own a player-tradable sword object.

Humanoid NPCs may share weapon/equipment profiles.

Monsters can use innate action/loadout definitions.

The combat engine cares about legal actions/effects, not whether every attack came from a marketplace item.

---

## 98. Tactical Hall and Loadouts

The Tactical Hall should let the player test any of their three saved loadouts against legitimately unlocked practice opponents.

Practice can help answer:

- which loadout handles this AI better?
- which item effect matters on this terrain?
- is this consumable worth carrying?
- does the build have enough mobility?
- what happens if I replace one Legacy Art?

Normal practice still grants no repeatable farming rewards.

---

## 99. Loadout Share / Inspect — Later

A later social feature may allow a player to share a build card containing only information they choose and that game rules permit.

This can support:

- guild advice;
- community theorycrafting;
- tournament recaps;
- Hall of Selves history.

Do not expose private/unrevealed inventory data without permission.

---

## 100. Implementation Timing

This document is future design authority, not permission to build the entire item/effect/inventory system now.

### Phase 1 — Character Foundation

Implement only the foundations required for the first persistent character:

- stable Item Definition identity/schema boundary;
- Item Instance/stack ownership model;
- core equipment slots;
- basic equipment inventory;
- equip/unequip authoritative command;
- derived-stat recalculation;
- key/quest-item-safe category boundary even if quests arrive later;
- initial Build/Armory shell when scoped;
- three saved loadout data model can be introduced only when its dependent build components exist cleanly, rather than filling presets with nonexistent systems.

### Phase 2 — Combat Core

- shared Effect Catalog primitives required by the vertical slice;
- Basic Attack weapon profiles;
- item/equipment effects required by released test content;
- Action Cost Class integration;
- Turn Economy Tracker showing Movement/Action/Reaction/resources/cost preview;
- combat-item action grammar foundation only if at least one vertical-slice item genuinely uses it;
- no giant consumable catalog yet.

### Phase 3 — Discipline Framework

- saved loadouts become fully meaningful as Arts/Traits/Reaction/Movement/Soulmark/Confluence systems exist;
- three complete presets;
- loadout activation command/versioning;
- effect trigger/filter expansion required by real equipment interactions;
- initial combat consumable kit;
- build comparison/warnings;
- item effects integrate with Current/Legacy/Confluence/Soulmark rules.

### Phase 4 — First Playable Content

- representative equipment and consumables with strategic non-damage effects;
- several item identities that create actual build decisions;
- no filler duplicate gear;
- Tactical Hall loadout testing;
- effect/item AI usage coverage;
- first item/effect balance telemetry.

### Phase 5 — World / Quests

- Quest & Key Item inventory becomes active;
- quest consume/retain/transform rules;
- story item state variants;
- vendors/known acquisition links as world services appear;
- item discovery/Codex integration;
- world encounter rewards connect to authoritative inventory.

### Phase 7 — Expeditions

- personal loot;
- targeted equipment pools;
- rare chase items/bad-luck protection;
- Expedition consumables/tools where approved;
- suspend/reconnect preserves inventory/run item state.

### Phase 8 — PvP

- ranked item/loadout validation;
- Arena Tempering integration;
- consumable rules/allowlist;
- PvP mode overrides;
- effect/action-economy exploit tests;
- clear inspect/counterplay rules.

### Phase 11 — Economy

Complete ordinary item economy:

- stores/vendors;
- loot systems;
- marketplace;
- crafting/materials;
- binding/trading;
- salvage if approved;
- item/economy telemetry;
- overflow/recovery;
- acquisition graph maturity.

### Phase 13 — Complete Master Panel

Complete Item/Effect/Inventory operations:

- Item Studio;
- Effect Catalog;
- effect/trigger graph;
- target preview;
- status/effect relationships;
- acquisition graph;
- dependency/impact preview;
- test equip/test battle;
- power-budget warnings;
- item/loadout/effect analytics;
- staged publish;
- rollback;
- retirement/migration tooling;
- emergency disable;
- permissions/audit;
- Owner support corrections.

### Phase 14 — Production Polish

- item icons/key art;
- Legendary acquisition presentation;
- Armory/inventory polish;
- item action VFX/SFX;
- responsive mobile inventory/build UI;
- battle Turn Economy Tracker polish;
- comparison/tooltip animations;
- accessibility.

### Phase 15 — Hardening

- ownership/concurrency tests;
- duplicate reward prevention;
- bulk action safety;
- marketplace/equip races;
- loadout atomicity/version races;
- key-item deletion protection;
- overflow/recovery tests;
- effect-loop/property tests;
- action-cost/resource/refund exploit tests;
- PvP item normalization;
- content retirement/migration;
- permission/audit;
- performance with large inventories.

---

## 101. Definition of Success

The system succeeds when:

- inventory is easy to understand even for a new player;
- quest/key items are safe and never mixed into destructive bulk actions;
- equipment creates meaningful build decisions rather than only bigger numbers;
- non-damage utility items are genuinely desirable;
- every active item uses the same clear combat targeting/cost/effect grammar as other combat content;
- the Turn Economy Tracker always makes movement/action/resource cost understandable;
- a player can maintain three complete saved builds and switch them cleanly outside restricted contexts;
- loadouts fail safely and explain missing requirements;
- the player can compare tactical tradeoffs without relying on a misleading single Power Score;
- loot is exciting without becoming inventory garbage spam;
- known acquisition paths support targeted progression;
- AI understands item/equipment effects through the shared combat system;
- PvP keeps equipment meaningful without becoming raw-stat hopelessness;
- the Master Panel can author, test, rebalance, publish, retire, and inspect item/effect dependencies without routine code/database editing;
- the same stable item/effect identities feed gameplay, inventory, loadouts, combat, quests, economy, Codex/manual, art/audio, analytics, AI, simulation, support, and live operations;
- the system feels modern, deep, attractive, and addictive because interactions matter — not because the inventory screen contains hundreds of arbitrary fields.
