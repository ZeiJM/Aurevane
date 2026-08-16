# AUREVANE — Master Game Plan Addendum: Deep Combat, Items, Inventory & Loadouts

**Authority:** This document is an incorporated addendum to `docs/GAME_MASTER_PLAN.md`. It does not replace the core Master Game Plan; it adds approved detail to the combat, equipment, inventory, content-authoring, balance, and player-build sections. Where implementation detail is required, `docs/COMBAT.md` and `docs/ITEMS_INVENTORY_LOADOUTS.md` are the authoritative technical/gameplay expansions for the systems summarized here.

**Direction approved:** 2026-08-15.

The guiding principle is:

> **AUREVANE should be deep because its systems interact, not because every screen contains a giant form and every turn contains a dozen unrelated meters.**

Reference games may demonstrate abstract ideas such as configurable targeting, item effects, action costs, content databases, loadout constraints, or game-management editors. AUREVANE may learn from those ideas but must not copy proprietary implementation, terminology, assets, exact economies, UI layouts, or content.

---

## 1. Combat Is a Core Character-Building Surface

Combat and character building are equal pillars.

A character's level, Current Discipline, mastered Legacy Discipline, Arts, Traits, Reaction, Movement Art, Soulmark, Confluence, equipment, combat consumables, terrain interaction, and player strategy should all change actual decisions in battle.

The battle system should repeatedly ask the player meaningful questions about position, tempo, resource use, target selection, terrain, facing, objectives, opponent behavior, setup/payoff, and risk.

---

## 2. Baseline Turn Economy

A normal turn is built around:

```text
MOVEMENT BUDGET
+
ONE NORMAL ACTION
+
EQUIPPED REACTION / BOUNDED EXCEPTIONS
```

Movement can normally occur before and after the Action if legal and if the chosen action/state does not prevent it.

AUREVANE does **not** use a default universal percentage Action Point bar or universal Stamina meter for every action.

Depth comes from interaction rather than percentage accounting.

---

## 3. Turn Economy Tracker

The battle UI must make action economy obvious.

At minimum it should show:

- Movement remaining;
- Action `READY / SPENT`;
- Reaction `READY / COOLDOWN / USED` where applicable;
- MP;
- current Discipline resource where relevant;
- cooldowns/charges;
- combat-item quantity where relevant;
- selected action cost and projected post-action state.

Example:

```text
Movement 3/6
Action READY
Reaction READY
MP 52/80
```

Previewing an action may show:

```text
Movement 3 → 1
Action READY → SPENT
MP 52 → 24
Smoke Capsule 2 → 1
```

Players should never have to guess what they are about to spend.

---

## 4. Basic Actions

Basic Actions do not consume normal Art slots.

The standard baseline includes:

- Basic Attack;
- Guard;
- Wait;
- Interact when relevant;
- Use Item only when the battle/mode permits it;
- End Turn.

Movement is normally part of the turn rather than its own Action.

Do not add a universal unlimited free Heal button that erases healer/item/attrition identity.

---

## 5. Action Costs

Actions can consume or require:

- the one normal Action;
- MP;
- HP sacrifice;
- temporary Discipline resource;
- remaining Movement Budget;
- item quantity/charge;
- cooldown;
- once-per-round/battle use;
- authored setup state.

Bonus/free actions are exceptional and require caps against loops.

---

## 6. Targeting Is First-Class Content

Every Art, Basic Attack profile, active item, boss ability, objective action, and similar capability should use the same typed targeting grammar where practical.

Targeting can define:

- target kind;
- shape;
- origin;
- minimum/maximum range;
- line of sight;
- projectile/path behavior;
- height restrictions;
- filters;
- friendly fire;
- multistage selection;
- automatic secondary-target rules;
- terrain/object interaction.

Reusable shapes can include:

`SINGLE`, `CIRCLE`, `DIAMOND`, `LINE`, `CONE`, `ARC`, `CROSS`, `RING`, `RECTANGLE`, `WALL`, `CHAIN`, `PATH`, `SELF_AURA`, and other justified typed patterns.

The player sees legal targets/areas before commitment.

---

## 7. Requirements Are Explicit

An action can require things such as:

- enough MP;
- correct weapon category;
- a visible target status;
- HP threshold;
- terrain relationship;
- facing relationship;
- remaining movement;
- Current/Legacy Discipline state;
- Soulmark state;
- cooldown/charges;
- objective state.

The UI should explain failures clearly, for example:

`Requires a Bleeding target.`

`Need 2 more MP.`

`No legal landing tile.`

`Path blocked.`

---

## 8. Effects Are a Shared Game Language

AUREVANE uses a controlled reusable Effect Catalog.

Representative primitives include:

`DAMAGE`, `HEAL`, `SHIELD`, `PUSH`, `PULL`, `MOVE`, `TELEPORT`, `SWAP`, `APPLY_STATUS`, `REMOVE_STATUS`, `SPAWN_SUMMON`, `REMOVE_SUMMON`, `CREATE_TERRAIN`, `DESTROY_TERRAIN`, `TRANSFORM_TERRAIN`, `CREATE_ZONE`, `MODIFY_STAT`, `MODIFY_MOVEMENT_BUDGET`, `MODIFY_INITIATIVE`, `RESTORE_RESOURCE`, `DRAIN_RESOURCE`, `GAIN_DISCIPLINE_RESOURCE`, `SPEND_DISCIPLINE_RESOURCE`, `CHANGE_COOLDOWN`, `TAUNT`, `STEALTH`, `REVEAL`, `COPY_EFFECT`, `DISPEL`, `DELAY_TURN`, `ACCELERATE_TURN`, `SPAWN_BATTLE_OBJECT`, `REMOVE_BATTLE_OBJECT`, `SET_FACING`, `INTERRUPT`, `SCHEDULE_EFFECT`, and `GRANT_CONSTRAINED_ACTION`.

New primitives are added only when real mechanics need them.

Content editors configure approved effects; they do not write arbitrary production JavaScript or SQL.

---

## 9. Damage Is Optional

Damage is an effect, not an assumption.

Strategic items/actions can exist solely to:

- reveal;
- cleanse;
- shield;
- displace;
- reposition;
- create terrain;
- remove terrain;
- create zones;
- change movement;
- manipulate cooldown/resources;
- interact with objectives;
- counter stealth/control;
- create temporary cover.

This is important because tactical value should not reduce to damage-per-turn.

---

## 10. Tags and Typed Effects Are Different

Typed effects determine behavior.

Controlled semantic tags express relationships such as:

- Fire;
- Frost;
- Storm;
- Weapon;
- Projectile;
- Melee;
- Blood;
- Song;
- Movement;
- Displacement;
- Terrain;
- Heal;
- Barrier.

A `DAMAGE` effect can also carry tags such as Fire or Projectile.

Do not reduce the entire rules engine to loose text tags.

---

## 11. Effect Sequences and Triggers

Items/Arts can resolve ordered effects and can attach them to typed triggers such as:

- battle start;
- turn start/end;
- move distance;
- enter/leave terrain;
- Basic Attack hit;
- Art hit;
- crit;
- take damage;
- block/parry;
- status applied;
- displacement;
- teleport;
- heal/overheal;
- ally/enemy defeated;
- objective interaction;
- item use.

Triggers can be limited by cooldown, once-per-turn/round/battle, HP threshold, terrain, target tags, mode, or other typed conditions.

---

## 12. Trigger Loop Safety

The engine must protect against infinite or abusive chains involving:

- extra Actions;
- extra turns;
- movement refunds;
- resource refunds;
- cooldown resets;
- reflect loops;
- Reaction chains;
- heal-damage loops;
- zero-cost item loops.

Use deterministic trigger ordering, consumed limits, bounded refunds, validation warnings, and recursion/event-chain guards where appropriate.

---

## 13. Discipline Arts Are Earned Through Mastery and Play

AUREVANE does not reintroduce Job Points under another name.

Each Discipline should have an authored Art Curriculum:

- **Core Arts** — early identity-defining actions learned through ordinary Mastery;
- **Mastery Arts** — meaningful Mastery-stage unlocks;
- **Trial Arts** — require a Discipline quest/mentor challenge/proof;
- **Discovery Arts** — optional specialist techniques found through the world, Archive, mentors, Expeditions, monster study, etc.;
- **Apex / Ultimate** — high-Mastery signature ability earned through a major accomplishment.

Important competitive build power must remain recurring or alternatively obtainable rather than permanently missable through an old one-time event.

---

## 14. Active Build

The approved core build remains:

- 4 Current Arts;
- 2 Legacy Arts;
- 2 Traits;
- 1 Reaction;
- 1 Movement Art;
- 1 active Soulmark;
- resolved Confluence.

When unlocked/available, the Current Discipline Ultimate, Soulmark Signature Art, and iconic Confluence Art can use dedicated presentation slots so the normal action bar remains readable.

---

## 15. Three Saved Combat Loadouts

Every normal character eventually supports **three saved combat loadout presets** as a base-game feature.

A preset may store:

- Current Discipline;
- Legacy Discipline;
- 4 Current Arts;
- 2 Legacy Arts;
- 2 Traits;
- Reaction;
- Movement Art;
- Soulmark;
- resolved Confluence;
- Main Hand;
- Off Hand;
- Armor;
- Accessory I;
- Accessory II;
- combat consumable kit;
- approved cosmetic battle-presentation choices.

The server validates and atomically activates presets.

A missing/retired item makes the preset visibly invalid rather than silently deleting it.

---

## 16. Central Build / Armory Experience

Equipment and combat configuration should live in one polished central Build / Armory destination rather than six disconnected database-like pages.

Suggested organization:

- Overview;
- Equipment;
- Arts;
- Traits & Reaction;
- Movement Art;
- Soulmark & Confluence;
- Combat Items;
- Stats / Interaction Preview;
- Saved Loadouts.

The player can compare meaningful deltas without relying on one misleading Power Score.

---

## 17. Inventory Categories

Player-facing inventory is separated by purpose:

```text
EQUIPMENT
CONSUMABLES
MATERIALS
QUEST & KEY ITEMS
COLLECTION / RELICS where later justified
```

Crowns and similar currencies remain authoritative ledgers rather than bag items.

Internally, these categories should use one coherent inventory/item domain where practical.

---

## 18. Quest & Key Item Safety

Quest/key items are protected by default.

They are ordinarily:

- non-tradable;
- non-sellable;
- non-salvageable;
- non-discardable unless explicitly authored;
- excluded from normal inventory-capacity pressure;
- excluded from bulk destructive actions.

Quest logic explicitly defines whether a key item is checked/retained, consumed, transformed, temporarily removed, or returned.

---

## 19. Item Definition Versus Owned Instance

Shared Item Definition data includes:

- stable ID;
- name;
- class/type;
- rarity;
- requirements;
- slot/weapon category;
- stats;
- effects;
- tags;
- active use/targeting rules;
- acquisition;
- trade/binding policy;
- art/audio;
- Codex/manual metadata;
- version.

Owned Item Instance/stack data includes:

- owner;
- definition reference;
- quantity;
- binding;
- provenance;
- charges/durability only if applicable;
- rolled affixes only if later approved;
- lock/favorite state;
- unique-instance identity where needed.

Static definition data should not be copied into every owned inventory row without a real reason.

---

## 20. Equipment Philosophy

Equipment can provide:

- base stats;
- passive effects;
- triggered effects;
- modifiers to existing actions;
- granted active actions;
- terrain relationships;
- status/setup interactions;
- movement changes;
- resource/cooldown relationships;
- objective utility.

Examples:

- after moving four points, next ranged Art gains +1 range;
- first teleport each round leaves a decoy/zone;
- Basic Attack gains spear reach;
- Guard prevents one push;
- rubble costs one less Movement Budget once per turn.

Reject endless `same sword +8% damage` filler.

A niche Rare may legitimately outperform a Legendary for one strategy.

---

## 21. Combat Consumable Kit

Players do not browse their entire inventory during combat.

A small pre-battle combat-consumable kit determines which approved items are available.

Exact slot count is tuned through testing.

Normal combat consumables generally consume the one normal Action unless an explicitly bounded Action Cost Class says otherwise.

PvP may use stricter allowlists, limits, or normalized charges.

---

## 22. Inventory Capacity Philosophy

Inventory should create organization, not punitive monetization pressure.

- key items do not consume normal capacity;
- materials/consumables stack cleanly;
- equipment storage is generous enough for build experimentation;
- important rewards are not silently deleted when inventory is full;
- bounded overflow/recovery protects exceptional rewards;
- paid storage is not required for normal progression;
- constant forced vendor trips are not a retention mechanic.

Universal durability/repair chores are not required.

Durability remains optional only where a specific item loop genuinely benefits.

---

## 23. Favorite / Lock / Bulk Safety

Players can Favorite and Lock items.

Locked/favorite items and items referenced by saved loadouts receive strong protection from sell/salvage/discard flows.

Bulk actions must:

- never include key items;
- exclude protected items by default;
- warn about saved-loadout references;
- preview results;
- validate server-side;
- execute atomically/idempotently where appropriate.

---

## 24. Acquisition Is First-Class Data

Items can have authoritative acquisition paths through:

- enemy/boss/Expedition loot;
- quests;
- world events;
- vendors;
- crafting;
- reputation;
- PvP seasonal rewards where competitive power remains recurring/alternatively obtainable;
- nations later;
- starter/tutorial;
- Owner/support grants;
- internal testing;
- premium commerce only for commerce-safe non-power goods.

Important build-enabling equipment should have known source families so players can intentionally pursue a build.

---

## 25. Personal Loot and Bad-Luck Protection

Expedition/boss loot remains personal rather than click-race loot.

Server resolves rewards authoritatively and idempotently.

Extremely rare chase items can use bad-luck protection where appropriate so healthy target farming does not become pathological variance.

---

## 26. Quest Items and Archive Knowledge

Physical quest items and learned Archive knowledge are linked but distinct.

Example:

1. acquire an `Ash-Sealed Letter`;
2. reading it unlocks an Archive source;
3. a later quest consumes/transfers the physical letter;
4. the Archive knowledge remains.

Learned history should not vanish merely because a physical object left inventory.

---

## 27. Item Discovery and Codex

Inventory answers:

> What do I own?

Codex answers:

> What does my character know exists?

Known/discovered items can expose legitimate acquisition information.

Hidden/unreleased items are not sent to the browser merely to be hidden by UI.

---

## 28. PvP Equipment Rules

PvE and PvP share the same core item/action definitions.

Ranked PvP may apply explicit versioned rules such as:

- Arena Tempering stat compression;
- PvP coefficient;
- control/healing adjustments;
- consumable allowlist/limits;
- summon caps;
- cooldown/charge normalization;
- emergency disable.

Do not maintain a secret duplicate PvP copy of every item.

---

## 29. Non-P2W Loadouts and Items

The premium shop must not sell:

- superior combat equipment;
- stronger combat consumables;
- extra combat-consumable slots;
- additional equipped Arts;
- stronger action economy;
- exclusive meta-defining item effects;
- paid access to core combat power;
- progression shortcuts through the natural six-month journey.

Three saved loadouts are part of the base game.

Additional convenience preset slots, if ever monetized, cannot increase in-battle power or bypass restrictions.

---

## 30. Battle Scenes Belong to the World

A battle scene can combine:

- board geometry;
- terrain/elevation;
- material kit;
- environment background;
- landmarks;
- parallax/foreground layers;
- weather;
- lighting;
- ambient animation;
- music;
- ambience;
- environmental VFX;
- story/event variants.

Battle should normally feel connected to the world location/encounter that produced it.

Reuse rendering systems and environment kits, not carbon-copy tactical layouts.

---

## 31. Combat Presentation

The emotional action rhythm is:

```text
READ
↓
AIM / PREVIEW
↓
COMMIT
↓
ANTICIPATION
↓
IMPACT
↓
CLEAR CONSEQUENCE
↓
BOARD READABILITY RESTORED
↓
NEXT DECISION
```

Use VFX, animation, hit stop, camera, terrain response, and audio to make major actions feel powerful while preserving tactical readability.

Long cinematic treatment is reserved for moments that earn it: Ultimates, boss phase changes, major Confluence Arts, and exceptional Soulmark events.

---

## 32. Combat Content Studio

The complete Master Panel eventually includes a structured Combat Content Studio for:

- Arts;
- Traits;
- Reactions;
- Movement Arts;
- Ultimates;
- Confluence/Soulmark combat effects;
- weapon attack profiles;
- statuses;
- terrain/movement profiles;
- battle objects;
- summons;
- objectives/scenarios;
- battle maps/scenes;
- Target/Requirement/Effect data;
- PvP overrides.

Editors arrive alongside real underlying systems rather than as empty future forms.

---

## 33. Item Studio / Effect Catalog

The complete Master Panel also includes Item Studio / Effect Catalog controls for:

- equipment;
- consumables;
- materials;
- quest/key items;
- sets;
- item triggers/effects;
- action costs;
- targeting;
- requirements;
- loot/acquisition;
- binding/unique policies;
- PvP overrides;
- retirement/migration.

Content staff configure approved typed effects and rules rather than executable code.

---

## 34. Visual Target / Effect Preview

Authorized staff should be able to preview on a real combat test board:

- range;
- minimum range;
- shape;
- radius/length/width;
- line of sight;
- height;
- target filters;
- friendly fire;
- terrain/object targeting;
- multistage selection;
- displacement;
- zone/terrain creation;
- effect sequence.

Preview uses the real combat engine/rules.

---

## 35. Dependency / Impact Preview

Before changing or retiring content, the Master Panel should eventually show dependencies.

For an item this can include:

- player ownership/equip count;
- saved loadouts;
- marketplace listings;
- quests;
- loot tables;
- vendors;
- recipes;
- sets;
- AI loadouts;
- Tactical Hall scenarios;
- Codex/manual pages;
- active battles pinned to old versions.

For an Art/status this can include:

- Disciplines;
- AI profiles;
- Confluences;
- equipment/tag interactions;
- benchmark tests;
- manual/Codex impact;
- active battles.

---

## 36. Balance Lab

Balance analysis should go beyond one win-rate number.

Useful data can include:

- Art equip/cast rate;
- damage/healing/control contribution;
- resource efficiency;
- item ownership/equip rate;
- item effect trigger frequency/value;
- consumable carry/use rate;
- Current/Legacy/Soulmark/item pairings;
- matchup win rates;
- movement/map heatmaps;
- objective performance;
- spawn-side bias;
- battle length;
- PvP timeout/surrender;
- marketplace price/volume;
- replacement behavior;
- acquisition-source distribution.

Analytics inform humans.

AI may summarize data, but it never automatically rebalances live production content.

---

## 37. AI Uses the Same Rules

NPC AI uses the same legal movement, target, cost, requirement, effect, status, terrain, item-granted action, and objective rules as players.

AI must understand strategic non-damage effects, equipment, terrain tools, and combat consumables when they are legitimately in the enemy's loadout.

AI difficulty still comes from better tactical evaluation rather than hidden stat cheating.

---

## 38. Versioning and Battle Snapshots

Important combat/item definitions are versioned.

An active battle pins relevant:

- combat rules version;
- action/content versions;
- item/equipment effect versions;
- AI profile version;
- scenario/map version;
- PvP ruleset version;
- RNG seed/state.

Publishing a live balance change does not silently mutate an already-running battle.

---

## 39. Implementation Timing

The detailed sequencing lives in `docs/COMBAT.md`, `docs/ITEMS_INVENTORY_LOADOUTS.md`, and `docs/ROADMAP.md`.

Broadly:

- **Phase 1:** item ownership/equipment foundations;
- **Phase 2:** combat grammar, Effect Catalog foundation, Turn Economy Tracker;
- **Phase 3:** complete build/loadout integration, Reactions, Movement Arts, Soulmarks, Confluences, combat-item kit;
- **Phase 4:** prove strategic item/content depth with real Disciplines and equipment;
- **Phase 5:** quest/key items, world vendors/acquisition, Codex connection;
- **Phase 7:** targeted personal loot/Expedition item loops;
- **Phase 8:** PvP equipment/loadout/consumable rules;
- **Phase 11:** full normal economy, stores, crafting, marketplace, inventory maturity;
- **Phase 13:** complete Combat Content Studio, Item Studio, Effect Catalog, Balance Lab, impact preview, rollback;
- **Phase 14:** production presentation/art/audio polish;
- **Phase 15:** authority, exploit, concurrency, trigger-loop, migration, balance, performance, PvP, and inventory hardening.

This addendum is final-product authority, **not permission to implement future systems ahead of their roadmap tickets**.

---

## 40. Definition of Success

This expansion succeeds when:

- a new player quickly understands basic combat;
- an advanced player can spend months discovering tactical interactions;
- the action economy is always readable;
- targeting/effects are expressive without one bespoke implementation per skill;
- non-damage utility is valuable;
- equipment changes strategy rather than only numbers;
- inventory is organized and safe rather than tedious;
- story/key items cannot be accidentally destroyed;
- three saved loadouts make experimentation fast and satisfying;
- item acquisition supports intentional build goals;
- combat visuals/audio feel powerful without obscuring the board;
- AI uses the same fair rules;
- PvP keeps equipment meaningful without raw-stat hopelessness;
- Master Panel authoring, testing, impact preview, analytics, publishing, rollback, and emergency controls make the system operable;
- the same stable content identities feed gameplay, inventory, combat, quests, AI, Codex/manual, art/audio, economy, analytics, support, simulation, and live operations;
- AUREVANE feels like a modern, original tactical RPG rather than a reskinned database-driven browser game.
