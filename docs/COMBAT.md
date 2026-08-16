# AUREVANE — Tactical Combat, Action Economy & Combat Content System

**Status:** Authoritative combat-system expansion subordinate only to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/COMBAT_AI_TRAINING.md`, `docs/PRODUCT_EXPERIENCE_CONTENT_SYSTEM.md`, `docs/PLAYER_MANUAL.md`, `docs/MASTER_PANEL.md`, `docs/ART_BIBLE.md`, and `docs/AUDIO_BIBLE.md`.

**Direction approved:** 2026-08-15.

The Master Game Plan already establishes AUREVANE as a turn-based tactical grid RPG where positioning, terrain, facing, timing, abilities, build interactions, team composition, and prediction matter. This document defines how that promise becomes a deep, authorable, testable, readable, modern combat system without turning every turn into accounting.

The goal is not to reproduce another browser RPG's battle system. Reference games may demonstrate useful abstract ideas — data-driven targeting, configurable costs, explicit requirements, content editors, timed competitive turns, item/ability databases, or strong links between content and battle rules — but AUREVANE must solve those problems in its own way.

The central combat rule is:

> **Depth comes from meaningful interaction between movement, targeting, terrain, timing, resources, facing, reactions, build choices, objectives, and opponents — not from forcing the player to manage a dozen universal point pools.**

AUREVANE combat should make a player feel that they are directing a dangerous fantasy duel or team fight, not filling out a spreadsheet and not clicking through an old fixed browser form.

---

## 1. Combat North Star

A strong AUREVANE battle should repeatedly create questions such as:

- Can I reach the high ground without exposing my rear?
- Do I spend MP now or preserve it for the boss phase?
- Do I use my Movement Art to engage, escape, or set up my Confluence?
- Can I push this target into lava, rubble, a zone, or an ally's line attack?
- If I move through this lane, am I enabling an enemy Reaction?
- Is it better to finish a wounded enemy or deny the objective?
- Can I force an opponent to face the wrong direction for my teammate?
- Should I break a defensive stance now or bait it first?
- Can my Soulmark alter this terrain interaction?
- Does my current equipment change the safest line?
- Can I spend a turn setting up a stronger next turn?
- Do I know enough about this enemy's behavior to risk this play?

The answer should come from readable game state and learned mechanics rather than opaque hidden arithmetic.

---

## 2. Complexity Budget

Combat can be deep while the player's **baseline turn grammar stays small**.

The default player should learn these concepts first:

1. move;
2. use one Action;
3. understand range and target legality;
4. end facing in a deliberate direction;
5. read terrain and hazards;
6. understand HP/MP and visible statuses;
7. learn that equipped Reactions may trigger outside the normal Action;
8. gradually add Movement Arts, Soulmark interactions, Confluences, equipment effects, advanced terrain, and objective play.

Do not expose every advanced concept in the tutorial battle.

The underlying engine may support substantial expressive power, but the UI uses progressive disclosure.

---

## 3. Standard Turn Economy

The Master Plan's `MOVE + ACTION` model remains the baseline.

A normal actor turn provides:

- a **Movement Budget** derived from the actor's Movement stat and temporary modifiers;
- **one Action**;
- access to any valid always-available **Basic Actions**;
- equipped active Arts and special actions;
- an equipped **Reaction** that may trigger outside the normal Action according to its rule;
- a final facing decision before the turn is committed/ended where applicable.

AUREVANE does **not** use a default universal `100% action-point bar` where every ordinary action is priced as a percentage of the same meter.

That model can produce tactical choices, but AUREVANE can achieve richer clarity by separating **where you can move** from **what major thing you do**.

### Why this is preferable

It gives the player an immediately readable turn:

```text
WHERE DO I POSITION?
        +
WHAT DO I DO?
        +
WHAT AM I LEAVING MYSELF OPEN TO?
```

while still allowing Arts, statuses, terrain, Chronist effects, equipment, Soulmarks, and Confluences to manipulate tempo in interesting ways.

---

## 4. Movement Budget

Movement is expressed in movement points/steps rather than a second persistent resource bar.

Examples of conceptual terrain costs:

```text
Road                1
Open ground         1
Mud                  2
Rubble               2
Shallow water        2
Deep water           blocked for normal ground movement
```

Exact values are balance data, not hard-coded examples.

Different movement profiles may interpret the same terrain differently.

Examples:

- ordinary ground;
- heavy ground;
- agile ground;
- flying;
- hovering;
- burrowing where an authored creature requires it;
- teleport/blink;
- jump/vault;
- special summon movement.

Movement rules come from the authoritative terrain and movement-profile systems.

### Split movement

By default, a character may spend part of their Movement Budget, take their Action, then spend remaining legal Movement Budget afterward unless:

- the selected Art explicitly commits the character's position;
- the Art includes forced movement that consumes/changes the remaining budget;
- a status prevents further movement;
- a Reaction or terrain event changes the state;
- the actor chooses to end the turn.

This creates more fluid turns than a rigid `move once, then permanently stop` model.

### Movement never trusts the client

The client previews paths and cost.

The server validates:

- start tile;
- destination;
- path;
- terrain costs;
- occupied tiles;
- height/jump legality;
- statuses;
- movement-profile rules;
- remaining Movement Budget;
- battle version.

---

## 5. The Action

A normal turn includes one major Action.

Examples:

- Basic Attack;
- use an Art;
- Guard;
- Wait;
- Interact;
- use an allowed combat item if the mode/content supports it;
- perform a scenario-specific objective action.

An Action can itself contain movement, displacement, teleportation, terrain creation, multiple effects, or target selection.

### No universal free healing button

AUREVANE should not include a generic unlimited `Heal` basic action that trivializes Lifebinder, items, attrition, encounter design, or build identity.

Recovery comes from authored sources such as:

- Arts;
- Soulmarks;
- equipment;
- consumables where allowed;
- terrain/objects;
- scenario mechanics;
- sanctuaries outside combat;
- explicit mode-specific rules.

---

## 6. Basic Actions

Basic Actions do not occupy the six normal Art slots.

Initial standard set:

### Move

Movement is normally part of the turn rather than an Action.

### Basic Attack

Uses the equipped weapon/unarmed attack profile and the same targeting/effect engine as any other combat action.

### Guard

A conservative Action that gives a modest, clearly defined defensive benefit until the actor's next turn or until consumed according to the rule.

Guard should be useful but not stronger than a real defensive Discipline's identity.

### Wait

End the turn without spending the Action.

This is a meaningful tactical option because some builds, Reactions, initiative situations, objectives, or Confluences may reward patience.

Wait is not automatically identical to `Delay Turn`; Chronist or other explicit effects own timeline manipulation.

### Interact

Used for authored battle objects and objectives:

- lever;
- relic;
- door;
- capture device;
- rescue target;
- ritual focus;
- movable object;
- scenario-specific mechanism.

### Use Item

Only appears when the battle mode and player's loadout permit usable combat items.

Items use the same Target/Requirement/Effect system rather than inventing a second item-only combat engine.

### End Turn

Commits remaining voluntary choices and resolves end-turn processing.

---

## 7. Facing

Facing remains four-directional:

```text
NORTH
EAST
SOUTH
WEST
```

The player can choose final facing before ending the turn where no rule prevents it.

The UI may default to sensible facing such as:

- toward the last attacked target;
- along the final movement direction;
- the actor's current facing if nothing changed.

But the player should be allowed to override the default.

Facing affects tactical relationships such as:

- front/side/rear attack bonuses;
- selected Reactions;
- shields/guards;
- cones/arcs;
- cover direction where used;
- some boss mechanics;
- some equipment or Confluences.

Facing must never require pixel-perfect interpretation. The board clearly indicates orientation.

---

## 8. Action-Economy Manipulation

Builds may manipulate tempo without introducing a universal percentage Action Point meter.

Examples:

- gain +2 Movement Budget this turn;
- reduce Movement Budget through Slow;
- movement on a specific terrain costs less;
- an Art includes a one-tile step before or after its effect;
- gain a constrained bonus movement after a successful hit;
- accelerate or delay the actor in turn order;
- allow a specific tagged Basic Action after an Art;
- refund part of movement after a teleport;
- consume remaining movement to increase an Art's range/power;
- a rare effect grants one constrained bonus Action.

### Hard safety rules

Ordinary content should obey global invariants such as:

- baseline one Action per normal turn;
- no recursive extra-turn loops;
- an action granted by an extra-action effect does not itself generate another unrestricted extra action unless a deliberately authored exceptional rule says so;
- movement refunds are capped;
- resource refunds are bounded;
- zero-cost/bonus actions cannot create infinite trigger chains;
- extra turns/actions are among the highest-risk balance effects and require explicit tests and analytics.

Chronist is allowed to feel like a time manipulator without turning the game into infinite-action solitaire.

---

## 9. Turn Lifecycle

A normal turn resolves through an explicit lifecycle.

Conceptually:

```text
TURN START
  ↓
Start-turn statuses / resource hooks / triggers
  ↓
Refresh legal baseline Movement Budget and Action
  ↓
PLAYER DECISION LOOP
  ├── move / inspect / select
  ├── choose Action
  ├── continue legal remaining movement
  └── choose final facing
  ↓
COMMIT / END TURN
  ↓
End-turn statuses / zones / durations / objective checks
  ↓
Schedule next actor
```

Reactions or interrupt windows can occur at deterministic points inside that lifecycle.

The combat event log records the actual authoritative sequence.

---

## 10. Turn Timing

Timers are a **mode rule**, not a universal punishment.

### Solo PvE

No aggressive short decision timer is required by default.

An inactivity timeout may protect abandoned server sessions, but normal solo tactical thinking should not be rushed.

### Co-op PvE

Use a generous configurable decision timer only where required for group flow.

Party communication and accessibility matter more than forcing speed.

### Competitive PvP

The Master Plan's approximate **30–45 second configurable decision window** remains the starting direction.

A future queue may additionally support a modest per-match time reserve if playtesting proves that it improves deep decision-making without enabling stalling.

### Timer rules

- server owns the clock;
- resolution animations do not consume the next player's thinking time;
- reconnect grace is explicit;
- latency allowance is handled server-side;
- warnings appear before timeout;
- the first timeout can perform a safe default such as Guard/End Turn according to queue rules;
- repeated timeout/absence eventually forfeits;
- tournament/event rules may use different published timing.

No player should lose seconds because another client is still playing a long animation.

---

## 11. Active Combat Loadout

The Master Plan's loadout remains the core build constraint:

```text
CURRENT DISCIPLINE
  4 Current Arts

MASTERED LEGACY DISCIPLINE
  2 Legacy Arts

TRAITS
  2

REACTION
  1

MOVEMENT ART
  1

SOULMARK
  1 active Soulmark

CONFLUENCE
  resolved from Current + Legacy
```

### Special action slots

To preserve the identity of the systems without forcing the player to sacrifice every normal Art slot:

- the **Current Discipline Ultimate**, once legitimately unlocked, uses a dedicated Ultimate presentation slot;
- the active **Soulmark Signature Art**, where the Soulmark provides one, uses a dedicated Soulmark presentation slot;
- an iconic **Confluence Art**, when the current pairing actually has one, uses a dedicated Confluence presentation slot.

These are not all necessarily usable at every moment. Their requirements, costs, cooldowns, once-per-battle rules, setup requirements, or state conditions control availability.

The UI groups special actions cleanly rather than showing fifteen equally weighted permanent buttons.

### Why the loadout is limited

The player may **know** many Arts but carries a deliberately bounded battle kit.

This creates:

- pre-battle planning;
- readable opponents;
- meaningful Current/Legacy choices;
- fewer hotbar buttons;
- stronger build identity;
- easier balance analysis;
- room for equipment/Soulmark/Confluence interactions without overwhelming the battle UI.

---

## 12. No Per-Art Skill-Point Currency

AUREVANE does not reintroduce Job Points under another name.

There is no default currency that asks the player to buy every Art from a skill tree.

Combat ability progression is primarily tied to **Discipline Mastery + authored achievement**.

The player grows because they become experienced in a style and prove that growth through play.

---

## 13. Discipline Art Curriculum

Each Discipline should have an authored **Art Curriculum** rather than dumping its entire catalog on a new character.

A useful conceptual structure is:

### Core Arts

Early identity-defining actions that unlock automatically through ordinary Mastery progression.

They make the Discipline functional and should not be hidden behind obscure missable content.

### Mastery Arts

Unlock at meaningful Mastery milestones such as Practiced/Adept/Expert.

### Trial Arts

Require a Discipline quest, mentor challenge, combat trial, or other authored proof in addition to Mastery.

### Discovery Arts

Optional specialized Arts learned through appropriate world discovery:

- a mentor;
- region school;
- Archive source;
- monster study for Loreeater;
- Expedition reward;
- boss technique study where fiction supports it;
- faction/nation tradition later;
- event content with recurring/alternate access if it affects competitive build power.

### Apex / Ultimate

The Current Discipline's Ultimate should feel earned.

Its unlock can combine high Mastery with a final Discipline challenge or other major accomplishment rather than simply appearing because a bar reached a number.

---

## 14. Art Unlock Rules

Unlock rules are authoritative, versioned content.

Conceptually an Art can reference requirements such as:

```text
minimum_character_level
minimum_discipline_mastery
required_discipline
required_current_or_legacy_state
required_quest_or_trial
required_story_state
required_region_discovery
required_horizon
required_boss_or_expedition_clear
required_archive_discovery
required_tactical_record
required_soulmark_state
alternative_requirement_groups
visibility / spoiler state
```

Do not use every field on every Art.

Most Core Arts should have simple requirements.

Complexity belongs only where the ability's place in the world justifies it.

### Alternate acquisition

Important competitive build-enabling power should not permanently disappear because the player missed one old seasonal event.

If an event grants an important combat Art, it must recur or gain an alternate path.

High PvP rank should not be the sole source of core Discipline progression.

---

## 15. Mastery Credit and Anti-Spam

Mastery progression should reward meaningful use of a Discipline, not mindless repetition of the cheapest button.

The progression system may consider:

- battle completion;
- encounter difficulty relative to the character;
- using the Discipline's actual mechanics;
- varied relevant actions;
- authored Mastery trials;
- objectives and challenges;
- diminishing value from trivial/repetitive farming where necessary.

Do not require the player to cast `Arc Bolt` 9,000 times to prove mastery.

Wayfarer's Practice can assist bounded Mastery progress according to its separate specification but cannot replace final proofs/trials.

---

## 16. Unlocks Are Permanent Knowledge, Loadouts Are Flexible

Once a legitimate Art is learned, the character retains that knowledge unless an exceptional narrative/system rule explicitly says otherwise.

The player can change normal combat loadouts outside battle through a clear build interface.

Avoid permanent build traps.

During an active battle, the loadout is normally pinned to the battle snapshot.

Changing the live content definition in the Master Panel does not silently replace an Art inside an existing version-pinned battle.

---

## 17. Combat Action Definition

Every active combat capability — Art, Basic Attack profile, usable item effect, scenario action, boss action, or similar — should resolve through the same typed combat grammar where practical.

Conceptual shape:

```text
CombatActionDefinition
  identity
  source_type
  tags
  target_spec
  cost_spec
  use_requirements
  effect_sequence
  cooldown / charges / use_limit
  timing / reaction metadata
  AI metadata
  presentation metadata
  PvE/PvP mode overrides where justified
  acquisition / visibility metadata where applicable
  version / publish state
```

AUREVANE should not need a new bespoke combat function for every new Art.

---

## 18. Targeting Is a First-Class System

Targeting is one of the main places combat gains expressive depth.

A combat action should define **what can be selected, from where, at what range, in what shape, under what visibility/height/path rules, and what happens after selection**.

This should be data-driven and previewable.

---

## 19. Target Kinds

A Target Spec can support authored categories such as:

```text
SELF
ALLY_UNIT
ENEMY_UNIT
ANY_UNIT
SUMMON
BATTLE_OBJECT
GROUND_TILE
EMPTY_TILE
OCCUPIED_TILE
ZONE
OBJECTIVE
```

Additional domain-specific target kinds should be introduced only when real mechanics require them.

Do not encode arbitrary one-off target names for every Art.

---

## 20. Target Shapes

Reusable shapes can include:

```text
SINGLE
CIRCLE / RADIUS
DIAMOND
LINE
CONE
ARC
CROSS
RING
RECTANGLE
WALL
CHAIN
PATH
SELF_AURA
DIRECTIONAL_SWEEP
GLOBAL where an authored exceptional rule requires it
```

A shape definition includes parameters such as:

- radius;
- length;
- width;
- minimum range;
- maximum range;
- maximum selected targets;
- whether the center tile is included;
- orientation;
- falloff policy;
- whether obstacles clip the shape;
- whether height changes legality;
- whether secondary targets are manually selected or automatically resolved.

This replaces strings such as `aoe_large_wall_shoot` with a clearer composable grammar.

---

## 21. Target Origin

The shape can originate from:

- caster tile;
- selected target tile;
- selected target unit;
- weapon/projectile impact tile;
- a summoned object;
- an existing zone;
- a previously selected portal/anchor;
- another effect in the same sequence.

This makes complex Arts possible without bespoke UI every time.

---

## 22. Range and Line Rules

Targeting can declare:

- minimum range;
- maximum range;
- Manhattan/grid distance or other approved distance rule;
- line-of-sight requirement;
- projectile path requirement;
- arc/height allowance;
- maximum vertical difference;
- whether cover modifies hit rather than legality;
- whether adjacent dead space is allowed;
- whether target must share a connected traversable region;
- whether the action can target beyond an obstacle through teleportation or magic.

The UI displays these rules visually before commitment.

---

## 23. Target Filters

A selected target can be filtered by typed predicates such as:

- ally/enemy;
- alive/defeated state where the rules support it;
- summon/non-summon;
- creature family;
- marked/exposed/bleeding/hexed/etc.;
- HP percentage threshold;
- status immunity/resistance where visible;
- objective ownership;
- size/category;
- airborne/grounded;
- inside/outside a zone;
- specific content tag when a real mechanic requires it.

Avoid giant hard-coded exclusion lists tied directly to object IDs unless the lore/mechanic truly requires a named exception.

Prefer semantic tags.

---

## 24. Friendly Fire

Every area or multi-target action must explicitly define friendly-fire behavior.

Possible policies:

```text
ENEMIES_ONLY
ALLIES_ONLY
ALL_UNITS
ALL_EXCEPT_CASTER
PRIMARY_ENEMY_WITH_ALL_AREA_UNITS
MODE_DEPENDENT
```

The preview clearly marks affected allies and enemies before commitment.

A player should not discover friendly fire only after pressing Confirm.

---

## 25. Multi-Stage Targeting

The targeting engine must support a small number of reusable multi-stage patterns.

Examples:

### Rift Gate

1. select valid entrance tile;
2. select valid exit tile within second-stage constraints;
3. preview both;
4. confirm;
5. create linked gate objects/effects.

### Dragonfall

1. select destination area;
2. preview leap path/height legality;
3. preview impact radius;
4. confirm.

### Intercept

1. select ally;
2. resolve valid protector position/relationship;
3. show coverage/result.

### Chain Lightning

1. select primary enemy;
2. show deterministic/known secondary-chain policy where the player is entitled to know it;
3. preview likely chain path;
4. resolve using the server state.

The engine should not support arbitrary infinite target-step scripting.

Keep a finite library of understandable selection stages.

---

## 26. Automatic Secondary Target Policies

Some abilities select one primary target and then resolve additional targets automatically.

Reusable policies can include:

- nearest valid;
- nearest valid not already hit;
- lowest HP percentage;
- highest threat/value according to an explicit game stat;
- forward-most in line;
- seeded random among valid equals;
- nearest to impact point;
- clockwise/counter-clockwise around anchor;
- authored priority list.

Where the player should be able to plan around the policy, the tooltip explains it.

Do not hide arbitrary target-selection logic in code.

---

## 27. Use Requirements — Actor Side

An action may require actor state such as:

- enough MP;
- enough Discipline resource;
- minimum/maximum HP threshold;
- required weapon category;
- required Current/Legacy Discipline relationship;
- required Soulmark;
- required stance/status;
- not Silenced;
- not Rooted for movement actions;
- not already acted;
- minimum remaining Movement Budget;
- actor moved at least/at most N points this turn;
- actor has/has not taken damage this round;
- cooldown ready;
- charges remaining;
- once-per-round/once-per-battle use available;
- required facing relationship;
- required summoned object/zone exists;
- required combat resource stack count.

Use only requirements that create meaningful gameplay.

---

## 28. Use Requirements — Target/Environment Side

An action may require:

- target has a particular visible status;
- target is in a specific HP band;
- target is adjacent;
- target is behind/front/side relative to actor;
- target is standing on a specific terrain tag;
- target is airborne;
- destination is empty;
- destination has enough height clearance;
- line of sight exists;
- a specific zone/object is present;
- actor is on high/low ground relative to target;
- objective state permits interaction;
- scenario phase permits the action.

The UI should explain which requirement failed.

`Cannot use this` is insufficient.

Prefer:

> Requires a Bleeding target.

> No legal landing tile.

> Need 2 more MP.

> Path blocked by occupied tile.

---

## 29. Requirement Grammar

Requirements should use a typed composable predicate system rather than arbitrary JavaScript/SQL written inside the Master Panel.

Conceptually:

```text
ALL OF
  - actor.mp >= 30
  - actor.status NOT Silenced
  - target.team = ENEMY

ANY OF
  - target.status = Bleeding
  - target.status = Exposed
```

Nested logic should remain intentionally bounded and inspectable.

The editor produces a human-readable summary.

---

## 30. Action Costs

Costs can include, where the specific action requires them:

- Action consumption;
- MP;
- HP sacrifice;
- Discipline-specific temporary resource;
- remaining Movement Budget;
- charge;
- item quantity;
- once-per-battle token;
- setup state or consumed status/mark.

Do not introduce universal Stamina merely because another game has it.

The Master Plan already establishes HP + MP as the universal persistent combat resources. Discipline resources are temporary mechanics, not another permanent economy.

---

## 31. Cooldowns and Charges

Cooldowns are allowed but should not be attached to every Art by default.

An Art may use:

- no cooldown;
- N actor turns;
- N rounds;
- once per battle;
- limited charges;
- reset on explicit event;
- special boss-phase rule.

Cooldown semantics are server-authoritative and versioned.

Cooldown reduction/refund effects must be bounded to prevent loops.

---

## 32. Effect Sequences

An action resolves an ordered sequence of reusable effects.

Example:

```text
1. MOVE caster to selected landing tile
2. DAMAGE units in impact area
3. APPLY_STATUS Shocked to valid targets
4. CREATE_ZONE Static Field at impact area
5. ROTATE caster toward primary target
```

Each effect may declare:

- target source;
- condition;
- scaling;
- duration;
- stack policy;
- tags;
- audiovisual event reference;
- whether failure stops or skips the remaining sequence.

Ordering is explicit and tested.

---

## 33. Effect Primitive Expansion

The Master Plan's effect engine remains authoritative.

As real combat requires it, the shared primitive library may grow with well-defined reusable operations such as:

- SET_FACING;
- MODIFY_MOVEMENT_BUDGET;
- MODIFY_INITIATIVE;
- CHANGE_COOLDOWN;
- GAIN_DISCIPLINE_RESOURCE;
- SPEND_DISCIPLINE_RESOURCE;
- SPAWN_BATTLE_OBJECT;
- REMOVE_BATTLE_OBJECT;
- TRANSFORM_TERRAIN;
- INTERRUPT;
- SCHEDULE_EFFECT;
- GRANT_CONSTRAINED_ACTION;
- CANCEL_SCHEDULED_EFFECT where an authored counter mechanic requires it.

Do not add a new primitive if existing primitives compose the behavior cleanly.

Do not embed entire bespoke minigames inside one primitive.

---

## 34. Damage and Healing Specification

Damage/healing should use typed formula metadata rather than arbitrary client-supplied numbers.

A damage effect may reference concepts such as:

```text
power_channel = PHYSICAL | MYSTIC | HYBRID | FIXED_SPECIAL
base_power
scaling_coefficient(s)
defense_channel = ARMOR | WARD | MIXED | NONE_SPECIAL
accuracy_policy
critical_policy
range_falloff
area_falloff
PvP_coefficient
minimum / maximum safety bounds where justified
```

The exact final formula belongs to tested combat-core code and balance configuration.

The Master Panel edits approved coefficients/configuration, not executable production source code.

---

## 35. Safe Formula Language

Where designers need formulas more expressive than fixed coefficient fields, use a small whitelisted expression language rather than arbitrary JavaScript.

Allowed references might include approved symbols such as:

```text
actor.physical_power
actor.mystic_power
target.armor
target.ward
distance
stacks
missing_hp_percent
```

The expression system must support:

- static validation;
- type checking/allowed symbols;
- division-by-zero protection;
- bounded complexity;
- deterministic evaluation;
- server-only authoritative execution;
- preview/test values in the Master Panel.

Never execute arbitrary code entered by content staff.

---

## 36. Tags Instead of a Giant Element Wheel

AUREVANE does not return to a giant elemental weakness chart.

Actions can carry meaningful semantic tags such as:

- Fire;
- Frost;
- Storm;
- Projectile;
- Melee;
- Weapon;
- Spell;
- Movement;
- Displacement;
- Blood;
- Song;
- Summon;
- Terrain;
- Control;
- Heal;
- Barrier.

Tags allow explicit interactions without assuming every `Fire` ability automatically receives a universal damage multiplier against every `Ice` target.

Examples:

- Conductive can respond to Storm-tagged effects;
- Frozen terrain can respond to selected Fire-tagged effects;
- a Trait can enhance Projectile Arts after moving;
- a boss can react to Displacement without being weak to a fictional element chart.

---

## 37. Status Engine Requirements

Every status needs explicit metadata for:

- duration unit;
- stacking policy;
- maximum stacks;
- refresh/extend/replace behavior;
- dispel category;
- immunity/resistance interaction;
- start/end timing;
- visible player description;
- PvP override where justified;
- VFX/SFX/icon;
- AI evaluation tags;
- version.

The player manual/status glossary should render exact current behavior from authoritative metadata where practical.

---

## 38. Reactions

A player equips **one Reaction**.

Reactions give combat life outside the acting player's normal Action.

Possible triggers include:

- targeted by a melee attack;
- hit by a projectile;
- ally within range is targeted;
- enemy enters/leaves adjacency;
- enemy moves through a watched tile;
- actor falls below an HP threshold;
- status is applied;
- displacement occurs;
- attack misses;
- attack is parried/blocked;
- ally is defeated;
- zone is entered;
- an Art with a matching tag resolves.

### Default reaction behavior

Most Reactions should resolve automatically when their explicit condition is satisfied.

This keeps multiplayer from pausing for a prompt after every event.

### Manual response windows

A small number of high-value authored mechanics may create a short explicit response window.

Use these sparingly.

They require:

- clear visual/audio cue;
- server timer;
- deterministic timeout behavior;
- no repeated prompt spam;
- accessibility consideration;
- PvP latency fairness.

---

## 39. Reaction Priority and Loop Safety

When multiple triggers occur, resolution order must be deterministic.

The engine needs explicit ordering rules such as:

```text
ACTION ACCEPTED
→ pre-hit reactions
→ hit/miss resolution
→ damage/effect resolution
→ post-hit reactions
→ defeat checks
→ movement/terrain aftermath
→ objective checks
```

Exact ordering is finalized in implementation tests.

Safety rules must prevent:

- reaction A endlessly triggering reaction B triggering A;
- reflect loops;
- unlimited counter chains;
- recursive death-prevention chains;
- unbounded zone enter/leave loops.

Use event-chain depth/trigger-consumption guards where required.

---

## 40. Telegraphs, Windups and Interrupts

Some dangerous actions should create tension by being telegraphed rather than instantly resolved.

A telegraphed action can define:

- announced target area;
- resolve timing;
- whether the actor can move before resolution;
- interrupt conditions;
- displacement/cancel conditions;
- what happens if the original target moves;
- visual telegraph asset;
- audio cue;
- AI response expectations.

Bosses benefit heavily from this system.

Normal player Arts should use windups selectively so combat does not become slow.

---

## 41. Weapon Attack Profiles

Weapons do more than add stats.

A weapon category can define the shape/range/behavior of the Basic Attack through the same targeting system.

Illustrative identities:

### Sword

Reliable adjacent single-target attack.

### Greatblade

Slower/heavier-feeling cleave or arc potential depending on item/Discipline rules.

### Spear

Reach/line identity.

### Dagger

Short reach with mobility/facing synergy.

### Bow/Crossbow

Longer range with line-of-sight/projectile rules.

### Staff/Wand

Mystic attack profile or Discipline-dependent casting support.

### Gauntlet

Close-range unarmed/martial profile.

### Shield

Primarily defensive/off-hand but selected content may define a bash profile.

Specific item effects modify or augment the authoritative profile rather than replacing the combat engine.

---

## 42. Equipment Modifiers

Equipment can create buildcraft through modifiers such as:

- +1 range under a condition;
- reduce movement cost on a terrain tag;
- alter a tagged Art's status application;
- create a zone after teleporting;
- change a Basic Attack shape;
- improve Guard under a specific condition;
- alter cooldown or MP cost within bounded limits;
- change a targeting filter;
- add a conditional follow-up effect.

These should reference stable action/effect/tag hooks.

Avoid equipment that requires one-off UI/combat code unless its legendary identity truly justifies a new reusable mechanic.

---

## 43. Combat Items

If combat consumables are enabled for a mode, they must use:

- a defined item slot/loadout policy;
- an Action cost unless explicitly designed otherwise;
- the same Target Spec;
- the same Effect Spec;
- mode restrictions;
- inventory authority;
- idempotent authoritative consumption;
- clear PvP policy.

Do not let players carry an unlimited backpack of healing potions into ranked combat.

---

## 44. Terrain

`docs/PRODUCT_EXPERIENCE_CONTENT_SYSTEM.md` defines terrain as gameplay data rather than decoration.

Combat builds on that requirement.

A terrain definition can affect:

- movement cost by profile;
- line of sight;
- cover/concealment;
- stopping/traction rules;
- damage/status interactions;
- elevation;
- displacement landing legality;
- zone persistence;
- destructibility;
- transformation;
- AI valuation;
- VFX/SFX/footsteps;
- weather interaction;
- map-generation placement rules.

Terrain previews are part of combat clarity.

---

## 45. Terrain Transformations

Transformations are explicit recipes, not uncontrolled simulation.

Examples:

```text
Frozen Ground + approved Fire effect → Melt / Wet
Destroyed Wall → Rubble
Floodline → Shallow Water
Stone Rise → elevated obstacle
Burnable Brush + Fire → Burning Ground / cleared brush according to rule
```

Each recipe defines:

- valid source state;
- triggering tags/effects;
- result state;
- precedence;
- duration where temporary;
- event log;
- visuals/audio;
- AI knowledge;
- network payload.

---

## 46. Height and Vertical Rules

Height should add tactical value without requiring simulation-grade physics.

It may influence:

- line of sight;
- projectile legality;
- selected range bonuses/penalties;
- Jump/Leap Arts;
- knockback/fall outcomes;
- cover;
- selected area shapes.

The UI previews the actual rule.

Do not force the player to estimate hidden three-dimensional geometry from an illustration.

---

## 47. Battle Objects

Maps can contain authorable interactive objects such as:

- destructible cover;
- doors;
- crystals;
- ritual focuses;
- traps;
- capture devices;
- explosive objects;
- movable barriers;
- healing/support objects where the scenario calls for them;
- switches/levers;
- escort targets.

Objects have stable combat identities with:

- tile/footprint;
- HP/state if relevant;
- targetability;
- interaction action;
- tags;
- effects;
- visibility rules;
- art/audio;
- AI behavior metadata.

---

## 48. Summons

Summons are combatants or battle objects according to their authored type.

A summon definition includes:

- owner/team;
- control policy;
- AI profile if autonomous;
- movement profile;
- ability loadout;
- lifespan;
- targetability;
- turn-order policy;
- defeat/despawn behavior;
- reward/credit rules;
- occupancy;
- visual/audio kit.

Player summons must not multiply turns without clear balance costs and caps.

---

## 49. Objectives

Not every battle is elimination.

The combat scenario system must support objectives such as:

- defeat all enemies;
- defeat a priority target;
- survive N rounds;
- hold/control a zone;
- capture multiple zones;
- escort;
- rescue;
- escape/extract;
- destroy/protect objects;
- interrupt a ritual;
- carry/return an objective;
- multi-stage boss objective;
- scripted story objective.

Victory/defeat conditions are explicit authoritative scenario data.

AI receives the same objective rules through its permitted knowledge boundary.

---

## 50. Battle Scenario Definition

A reusable scenario can reference:

```text
id / version
battle_mode
board / scene
spawn zones
allowed party sizes
objective set
victory conditions
defeat conditions
turn/round limit if any
reinforcement rules
hazards
weather / environment state
encounter roster
AI profile references
reward reference
PvP ruleset where applicable
music / ambience
story/event context
```

A quest or Expedition references a scenario rather than rebuilding combat rules inline.

---

## 51. Battle Scene / Background System

The battle background is part of the encounter identity.

AUREVANE should not place every tactical grid over one generic image.

A **Battle Scene Definition** can combine:

- board geometry;
- terrain/elevation layout;
- tile/material kit;
- environment background;
- foreground/background/parallax layers where appropriate;
- landmark props;
- weather;
- lighting;
- ambient animation;
- camera defaults;
- music state;
- ambience;
- environmental VFX;
- event/story variant;
- accessibility/reduced-motion behavior.

The scene should normally derive from the actual world location so battle feels connected to travel.

---

## 52. Authored Maps + Reusable Kits

Reuse:

- terrain systems;
- material kits;
- biome prop libraries;
- board rendering;
- objective markers;
- lighting/weather systems;
- camera rules.

Do not reuse:

- the same meaningful tactical layout under a different paint job for every encounter;
- landmark composition;
- boss arena identity;
- every spawn pattern;
- every elevation pattern.

Procedural/seeded encounter maps may assemble approved authored modules, but combat readability and tactical validity are validated before use.

---

## 53. Combat Presentation Loop

The emotional rhythm of an action should be:

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

AUREVANE should make strong Arts feel powerful without holding the player hostage to slow animation.

---

## 54. Visual Impact

Combat presentation can use:

- purposeful anticipation poses/effects;
- movement trails;
- impact flashes;
- hit stop on major contact;
- restrained camera shake;
- camera focus/pan;
- directional particles;
- ground decals;
- terrain transformation animation;
- concise damage/heal/status numbers;
- stagger/guard/parry feedback;
- environment response;
- special Ultimate/Confluence/Soulmark presentation.

The Art Bible's tactical-readability priority always wins.

No effect may make the board unreadable simply because it looks impressive in a screenshot.

---

## 55. Audio Impact

Combat needs strong audio layers:

- weapon movement;
- impacts;
- blocks/parries;
- spell cast;
- projectile travel;
- terrain footsteps;
- teleportation;
- displacement;
- status application;
- shields/barriers;
- critical/major impact;
- Ultimate/Confluence/Soulmark signatures;
- environmental battle ambience;
- objective cues;
- turn/clock warnings;
- victory/defeat.

Important abilities need audio identity, not one generic explosion sample.

The game remains fully playable muted.

---

## 56. Animation Speed and Respect for Time

Ordinary combat actions should resolve briskly.

Longer cinematic treatment is reserved for moments that earn it:

- Ultimates;
- boss phase changes;
- major Confluence Arts;
- important story attacks;
- exceptional Soulmark events.

PvE may eventually support faster repeat-animation settings after the player has seen content, provided timing does not alter authoritative mechanics.

PvP participants must receive equivalent rules/timing and should not gain information advantages from different animation settings.

Reduced-motion settings remain supported.

---

## 57. Battle UI Hierarchy

The battle board is the primary canvas.

Always/usually visible:

- board;
- current actor;
- concise selected actor HP/MP/state;
- turn order/timeline;
- Movement Budget;
- action bar;
- current target/path/area preview;
- objective state;
- confirm/cancel/end controls.

Contextual:

- full status details;
- terrain details;
- Art deep description;
- combat log;
- character sheet;
- AI/Tactical Record information;
- party communication;
- Battle Review.

Do not permanently consume half the viewport with database-like side panels.

---

## 58. Action Bar Organization

The action bar should visually group rather than flatten every command equally.

Conceptually:

### Basics

- Basic Attack;
- Guard;
- Interact when available;
- Wait/End.

### Equipped Arts

- 4 Current;
- 2 Legacy.

### Movement

- dedicated Movement Art.

### Signature

- Soulmark Signature;
- Confluence Art when present;
- Current Ultimate.

On narrow screens, these groups can become touch-friendly trays/sheets without covering the board permanently.

---

## 59. Targeting UX

Selecting an action should immediately communicate:

- valid tiles/units;
- invalid areas;
- range;
- line of sight;
- movement/path cost where relevant;
- shape;
- friendly fire;
- height restrictions;
- destination;
- expected affected targets;
- requirements not currently met.

A player should not need to read the database definition to know how an Art targets.

---

## 60. Forecast

Before a normal committed action, show the information the character/player is legitimately entitled to know.

Possible forecast fields:

- hit chance;
- damage/healing range;
- crit possibility;
- statuses to be applied;
- displacement endpoint;
- movement remaining;
- target facing after effect;
- terrain/zone changes;
- objective effect;
- known Reaction risk;
- resource/cooldown result.

Hidden information remains hidden.

The server calculates the final authoritative result after commitment.

---

## 61. Combat Log

The event log should be readable rather than an internal debug dump.

It can record:

- turn/round;
- action used;
- target;
- hit/miss/crit;
- damage/healing;
- status;
- resource change;
- movement/displacement;
- terrain change;
- Reaction;
- defeat;
- objective progress.

Advanced details can be expanded when needed.

The same structured events support replay, Battle Review, debugging, analytics, and spectator presentation later.

---

## 62. Combat Information Is Authoritative Content

The player-facing Art/Codex page should be able to render current known information from the same combat definition used by the engine.

Examples:

- MP cost;
- range;
- target type;
- shape;
- cooldown;
- required weapon;
- key statuses;
- movement interaction;
- known acquisition method;
- PvP-specific rule if public;
- current version/change note where useful.

Do not manually rewrite these numbers in three places.

---

## 63. PvE and PvP Use the Same Core Definitions

Do not maintain separate unrelated `PvE Art` and `PvP Art` objects.

One action definition may contain explicit **mode overrides** where balance requires them, such as:

- PvP coefficient;
- control duration;
- summon cap;
- healing modifier;
- banned/normalized effect;
- cooldown.

The difference must be inspectable, versioned, testable, and communicated to players where relevant.

---

## 64. PvP Control Safety

Crowd control cannot become a permanent lockout chain.

Competitive rules should support diminishing control effectiveness or other tested anti-lockout protections.

The exact model can be tuned, but it must be:

- deterministic;
- visible enough to understand;
- shared across affected statuses;
- configurable;
- tested against chain-control builds;
- represented in the manual.

---

## 65. Initiative and Turn Order

Initiative determines ordering.

The UI should make future near-term order readable.

Effects such as Haste, Slow, Delay, Accelerate, or Chronist abilities modify an explicit timeline/initiative model rather than secretly awarding unexplained actions.

The implementation must define:

- how ties resolve;
- what happens when Initiative changes mid-round;
- whether an actor can be moved before/after another actor's already-scheduled turn;
- caps against infinite turn compression;
- how summons enter the order;
- how defeated units are removed;
- how extra boss actions are represented.

These rules require deterministic tests.

---

## 66. RNG

Combat randomness remains controlled.

Use RNG where it creates tension or build identity, not to erase planning.

Possible random domains:

- hit/miss where accuracy/evasion mechanics warrant it;
- critical effects;
- bounded damage variance;
- explicitly random target choice;
- authored proc chance;
- procedural encounter inputs.

The player sees relevant probabilities.

All combat RNG is server-seeded and reproducible for debugging/replay where practical.

---

## 67. No Hidden Client Calculation

The browser may:

- render previews;
- calculate non-authoritative display aids from server-provided rules/state;
- animate accepted events;
- collect input.

The browser does not authoritatively decide:

- legal target;
- legal path;
- damage;
- hit;
- crit;
- status;
- cooldown;
- resource spend;
- Reaction trigger;
- terrain transformation;
- victory;
- reward.

The server revalidates the submitted command against current battle version/state.

---

## 68. Battle Command Shape

A player command should contain intent rather than outcome.

Conceptually:

```text
battle_id
expected_battle_version
actor_id
action_id
selected_target(s) / tile(s) / direction
selected_path if the action requires a chosen path
client_action_id / idempotency token
```

Never:

```text
damage = 954
status_applied = true
reward = legendary_sword
```

---

## 69. Determinism and Replays

A battle snapshot should pin relevant versions such as:

- combat rules version;
- content/action versions;
- AI profile version;
- scenario/map version;
- PvP ruleset version;
- RNG seed/state.

This supports:

- deterministic debugging;
- replay;
- simulation;
- customer support;
- desync investigation;
- balance regression tests.

Publishing a buff to an Art should not mutate a battle already in progress unless the system explicitly performs a safe emergency intervention.

---

## 70. Combat Persistence and Reconnect

Battle state persists server-side.

A reconnecting client should receive:

- current authoritative snapshot;
- current version;
- relevant recent events;
- active timer state;
- actor/control ownership;
- content/rules versions needed for display.

The game should recover without replaying every animation from the beginning.

Disconnects cannot be used to reroll RNG or undo a committed action.

---

## 71. Combat Content Studio — Master Panel

The Master Panel should eventually contain a coherent **Combat Content Studio**, not dozens of unrelated raw forms.

It can provide authorized editors for:

- Arts;
- Traits;
- Reactions;
- Movement Arts;
- Ultimates;
- Confluence Arts/Traits;
- Soulmark combat effects;
- weapon attack profiles;
- statuses;
- terrain;
- movement profiles;
- combat items;
- battle objects;
- summons;
- scenarios/objectives;
- battle scenes/maps;
- mode overrides;
- combat-related acquisition rules.

Editors arrive with the underlying system. Do not build empty panels early.

---

## 72. Art Editor Workflow

An Art Editor should eventually organize the definition into understandable sections:

```text
IDENTITY
  name / description / tags / Discipline

ACQUISITION
  Mastery / quest / trial / discovery / visibility

ACTION ECONOMY
  Action use / movement interaction / MP / resource / cooldown

TARGETING
  target kind / shape / range / LoS / height / friendly fire

REQUIREMENTS
  actor / target / terrain / status / weapon / mode

EFFECT SEQUENCE
  ordered reusable effects + formulas

REACTION / TIMING
  triggers / windup / interrupts / once-per-X

AI
  usage tags / preferred situations / obvious-waste tests

PRESENTATION
  icon / animation / VFX / SFX / camera / tooltip

PVP
  explicit overrides

VALIDATION / TEST
  preview board / test character / simulation

VERSION / PUBLISH
  diff / notes / schedule / rollback
```

This should be considerably easier to reason about than one giant flat form with dozens of unexplained dropdowns.

---

## 73. Visual Targeting Builder

The Combat Content Studio should eventually include a test board where a designer can configure and immediately preview:

- range;
- min range;
- shape;
- radius/length/width;
- line clipping;
- height legality;
- ground/unit targeting;
- friendly fire;
- multistage selection;
- displacement destination;
- zone/terrain creation.

The owner should be able to **see the targeting pattern** before publishing it.

---

## 74. Requirement Builder

The editor should expose typed, human-readable requirement blocks.

Example:

```text
Can use when:
  ALL
    MP >= 35
    Actor is not Silenced
    Equipped weapon is Sword OR Greatblade

Valid targets:
  ENEMY UNIT
  target has Exposed
  range 1–2
```

The published tooltip can derive a simplified player-facing explanation from the same rule where appropriate.

No arbitrary SQL/JS expression editor for normal staff.

---

## 75. Effect Stack Editor

Authorized content staff can build an action from approved primitives.

Example:

```text
1 DAMAGE target
  base 40
  scale Physical Power 0.85

2 APPLY_STATUS Exposed
  duration 1 actor turn
  only if damage dealt > 0

3 PUSH target 1 tile
  if destination legal
```

The editor validates:

- missing targets;
- impossible conditions;
- invalid effect order;
- unsupported formula symbols;
- recursive trigger risk where detectable;
- missing media/manual data according to content-completeness rules.

---

## 76. Weapon/Profile Editor

Authorized staff can configure:

- weapon category;
- basic target shape;
- range;
- power channel;
- tags;
- equipment requirements;
- animation/VFX/SFX profile;
- special item modifiers;
- PvP restrictions.

The item editor references the attack profile rather than duplicating its targeting logic.

---

## 77. Status Editor

The status editor exposes:

- icon/name/description;
- category;
- duration;
- stack policy;
- maximum stacks;
- timing hooks;
- stat modifiers;
- trigger effects;
- dispel/removal tags;
- resistance/immunity tags;
- PvP override;
- AI valuation;
- VFX/SFX;
- manual glossary link;
- version/history.

---

## 78. Battle Scene / Map Editor

A map/scenario editor can eventually configure:

- board size/geometry;
- tiles;
- elevation;
- terrain;
- obstacles;
- battle objects;
- spawn zones;
- objective zones;
- reinforcement points;
- environment art kit;
- background/parallax;
- weather/lighting;
- ambience/music;
- camera bounds;
- allowed scenario types;
- validation pass.

This is not permission to build a giant Unity-style editor in the browser before it is needed.

Start with clean data tools and add richer visual editing when map volume justifies it.

---

## 79. Combat Content Validation

Before publication, important combat content should be validated for completeness.

An Art may require:

- stable ID;
- Discipline/source;
- valid Target Spec;
- valid costs;
- valid requirements;
- at least one meaningful effect or explicit utility behavior;
- player-facing description;
- icon/media state according to phase;
- AI usage metadata where NPCs can use it;
- acquisition rule;
- tests;
- PvP rule if relevant;
- manual/Codex metadata;
- version note.

A battle scene may require:

- valid reachable spawn positions;
- objective reachability;
- no illegal isolated mandatory tile;
- terrain references valid;
- camera bounds;
- background/environment reference;
- performance/readability check;
- scenario compatibility.

---

## 80. Impact Preview

Before changing or retiring combat content, the Master Panel should eventually answer:

### If this Art changes

- which Disciplines use it;
- which player builds currently slot it;
- which AI profiles know/use it;
- which Confluences/equipment/statuses reference its tags;
- which Tactical Hall records use it;
- which benchmark tests should rerun;
- which manual/Codex pages change;
- which current battles remain pinned to the old version.

### If this status changes

- which Arts apply/remove it;
- which Traits/Reactions respond to it;
- which terrain recipes use it;
- which AI profiles value it;
- which PvP protections apply;
- which manual glossary entries change.

This is the circular content model applied to combat.

---

## 81. Preview and Test

Authorized staff should be able to preview combat content before publication through staged tools such as:

- test target dummy;
- small targeting board;
- chosen character/loadout;
- specific terrain arrangement;
- repeatable RNG seed;
- human vs AI;
- AI vs AI in the protected lab;
- scenario preview;
- responsive battle UI preview;
- combat log inspection;
- media/audio preview.

The test tools call the real combat engine.

Do not create a fake preview calculator with subtly different rules.

---

## 82. Balance Lab — Combat Analytics

Combat balance cannot rely only on global win rate.

Useful telemetry can include:

### Arts

- equipped/slot rate;
- cast rate when equipped;
- successful-use rate;
- average targets hit;
- hit chance/result;
- damage/healing/control contribution;
- MP/resource efficiency;
- cooldown left unused;
- kill/assist involvement;
- use by map/terrain;
- use by Current/Legacy pairing;
- use by Soulmark;
- PvE/PvP split.

### Builds

- Discipline pick rate;
- Legacy pairing rate;
- Confluence rate;
- Soulmark rate;
- equipment combinations;
- matchup win rates;
- objective performance;
- average battle length;
- surrender/timeout/disconnect rate.

### Maps

- win rate by spawn side;
- movement heatmaps;
- kill/death zones;
- objective contest zones;
- commonly unused areas;
- terrain interaction frequency;
- average turns to contact;
- ranged/melee performance imbalance.

### Reactions

- trigger frequency;
- trigger success/value;
- never-triggered rate;
- repeated-loop safety events;
- player understanding/support questions.

Telemetry informs humans. It does not auto-rebalance production.

---

## 83. Balance Change Workflow

Recommended workflow:

```text
OBSERVE
  ↓
FORM HYPOTHESIS
  ↓
EDIT DRAFT
  ↓
VALIDATE
  ↓
DIFF
  ↓
TARGETING/SCENARIO PREVIEW
  ↓
BENCHMARK / SIMULATION where useful
  ↓
HUMAN PLAYTEST
  ↓
STAGING
  ↓
PUBLISH
  ↓
MONITOR
  ↓
ROLL BACK if necessary
```

Do not react to one noisy statistic with a live coefficient change five minutes later.

---

## 84. AI Integration

`docs/COMBAT_AI_TRAINING.md` remains authoritative for AI intelligence/fairness.

The combat system must expose to AI the same legal/action abstractions available to player validation:

- Target Specs;
- movement/path rules;
- costs;
- requirements;
- statuses;
- terrain;
- effects;
- objectives;
- known reactions;
- initiative;
- loadouts.

AI does not receive a second simplified combat rulebook.

---

## 85. AI Usage Metadata for Arts

An Art can provide authored tactical hints that improve identity without hardcoding its entire decision logic.

Examples:

- preferred range;
- setup tags;
- payoff tags;
- avoid-overkill;
- defensive threshold;
- emergency-use tag;
- finisher tag;
- mobility purpose;
- zone-control purpose;
- objective-control value;
- combo prerequisites;
- conserve-until condition;
- obvious-waste cases.

The generic AI framework combines these with actual state and its profile/intelligence grade.

---

## 86. Battle Review

After battle, the player can eventually review useful tactical information such as:

- turn timeline;
- major damage/healing events;
- objective progress;
- status/terrain interactions;
- missed opportunities where the system can state them from structured rules;
- AI decision-reason summaries in the Tactical Hall;
- build performance summaries;
- death/defeat sequence.

Do not generate fake coaching explanations that are not grounded in recorded state/events.

---

## 87. Onboarding Combat Progression

Combat systems should unlock in digestible layers.

A possible teaching progression:

### First fights

- Move;
- Basic Attack;
- one/two simple Arts;
- HP/MP;
- Guard;
- obvious terrain.

### Early progression

- facing;
- status effects;
- area targeting;
- elevation;
- Movement Art;
- Reaction.

### After build systems open

- Legacy Arts;
- Confluences;
- Soulmark Signature;
- deeper terrain transformations;
- advanced objectives;
- equipment interactions.

### Advanced

- initiative manipulation;
- complex reaction baiting;
- multistage targeting;
- deep boss mechanics;
- competitive PvP timing;
- team compositions.

Players learn by doing, with contextual help available.

---

## 88. Tactical Hall as the Safe Learning Space

The Tactical Hall supports combat depth without forcing every player to learn through expensive losses.

It should eventually provide authored drills such as:

- movement/terrain;
- facing;
- line of sight;
- displacement;
- zone control;
- Reaction timing;
- objective play;
- build matchup;
- boss pattern after legitimate unlock;
- team coordination.

Progression-gated Tactical Records protect spoilers and preserve discovery.

---

## 89. Combat Manual Requirements

The player manual needs exact visual examples for:

- Action + Movement Budget;
- split movement;
- facing;
- targeting shapes;
- minimum/maximum range;
- line of sight;
- terrain cost;
- elevation;
- cover;
- statuses;
- Reactions;
- cooldowns/charges;
- initiative;
- friendly fire;
- terrain transformation;
- objective actions;
- PvP timer/timeout rules;
- loadout slots;
- acquisition/Mastery rules.

Complex tooltips should deep-link to the relevant manual section.

---

## 90. Accessibility

Combat must support:

- keyboard navigation;
- touch input;
- sufficiently large click/tap targets;
- non-hover access to all essential information;
- color + shape/pattern distinction;
- reduced motion;
- camera-shake reduction/disable;
- readable text scaling;
- captions/visual equivalents for important audio cues;
- accessible timer warning;
- clear focus states;
- target/terrain descriptions available without color alone.

Tactical depth must not depend on perfect color vision or twitch reflexes.

---

## 91. Performance

Combat must stay responsive on ordinary consumer hardware.

Engineering should watch:

- pathfinding cost;
- target-shape enumeration;
- AI candidate generation;
- effect-chain size;
- React/UI rerenders;
- board draw cost;
- particle count;
- texture memory;
- realtime event payload size;
- reconnect snapshot size;
- combat-log growth.

Use bounded collections, cached/derived board data where justified, and targeted updates.

Do not optimize by weakening correctness or determinism.

---

## 92. Combat Test Matrix

Combat tickets require deterministic automated coverage appropriate to scope.

Important categories include:

### Movement

- terrain cost;
- path blocking;
- occupancy;
- height;
- movement profiles;
- split movement;
- remaining budget;
- displacement.

### Targeting

- each implemented shape;
- min/max range;
- line of sight;
- height;
- target filters;
- friendly fire;
- multistage targeting;
- automatic secondary target policies;
- invalid reason correctness.

### Costs/requirements

- exact MP/resource spend;
- insufficient resource;
- status/weapon/terrain requirements;
- cooldown;
- charges;
- once-per-X limits;
- rollback on rejected action.

### Effects

- ordering;
- status application/removal;
- terrain transformation;
- summon/object creation;
- damage/heal formula;
- PvP override;
- death/objective interaction.

### Reactions

- trigger timing;
- deterministic priority;
- resource/cooldown use;
- manual response timeout if implemented;
- recursion/loop safety.

### Battle authority

- stale battle version rejection;
- client cannot submit outcomes;
- idempotent command retry;
- reconnect;
- seed replay;
- content version pinning.

### Maps/objectives

- spawn reachability;
- objective reachability;
- no impossible mandatory route;
- side-bias benchmarks;
- turn/round limit;
- reinforcement rules.

---

## 93. Golden Tactical Scenarios

Maintain a curated regression suite of small board states.

Examples:

- rear attack preview;
- line attack through obstacle;
- push into hazard;
- push blocked by occupied tile;
- ice transformed by Fire;
- Wet + Conductive interaction;
- teleport across blocked route;
- Reaction on ally attack;
- cleanse before damage-over-time tick;
- lethal damage + barrier;
- control diminishing in PvP;
- initiative acceleration;
- summon entering turn order;
- objective win before elimination;
- disconnect/reconnect mid-turn.

These become stable test fixtures for engine changes.

---

## 94. Master Panel Permissions

Combat authoring privileges should be granular.

Examples:

```text
combat.view
combat.actions.edit
combat.actions.publish
combat.statuses.edit
combat.statuses.publish
combat.terrain.edit
combat.terrain.publish
combat.maps.edit
combat.maps.publish
combat.scenarios.edit
combat.scenarios.publish
combat.balance.view
combat.balance.edit
combat.balance.publish
combat.simulate
combat.emergency_disable
```

The exact permission names are finalized when the system exists.

Editing is not the same as publishing.

High-impact production changes are audited.

---

## 95. Emergency Controls

The Owner/authorized staff should eventually be able to disable:

- one broken Art;
- one status interaction;
- one item effect;
- one terrain transformation;
- one map/scenario;
- one queue ruleset;
- one AI profile;
- one boss ability;
- a combat feature flag where supported.

Disabling must define what happens to:

- active battles;
- queued PvP;
- player loadouts;
- content dependencies;
- Codex/manual display;
- AI builds.

Do not silently corrupt active state.

---

## 96. Content Quality Standard

A combat ability is not good merely because it has an icon and damage coefficient.

Each meaningful Art should answer:

- what tactical decision does it create?
- when is it strong?
- when is it weak?
- what positioning does it reward?
- what counterplay exists?
- how does it fit its Discipline?
- how does it interact with Current/Legacy/Confluence/Soulmark/equipment?
- what terrain/objective situations change its value?
- does the AI understand its intended use?
- does its VFX/audio communicate the mechanic?
- is the tooltip honest?

Reject filler Arts that are only `same attack, +8% damage, different color` unless a simple attack genuinely fills an intentional low-complexity role.

---

## 97. Discipline Combat Identity

Every Discipline should have a battle identity visible in decisions, not just lore.

Its content package should establish concepts such as:

- preferred engagement range;
- mobility profile;
- defensive pattern;
- resource rhythm;
- setup/payoff pattern;
- terrain relationship;
- facing relationship;
- team role possibilities;
- objective strengths;
- vulnerabilities/counterplay;
- signature visual/audio motion language.

No mandatory MMO trinity is required, but every Discipline should contribute recognizable tactical behavior.

---

## 98. Avoid False Depth

Do not add complexity merely because the combat engine can support it.

Avoid:

- five interchangeable combat resources;
- percentage costs on every tiny interaction;
- multiple redundant cooldown categories;
- separate targeting engines for Arts/items/weapons;
- arbitrary elemental weakness charts;
- hidden formulas players must datamine;
- every ability having six conditional clauses;
- reaction prompts after every movement tile;
- twenty permanent hotbar buttons;
- maps cluttered with meaningless hazards;
- endless status icons;
- giant numeric power inflation;
- AI-only secret combat rules;
- bespoke code for every Art.

Depth should emerge from a relatively small grammar composed well.

---

## 99. Example Art — Arcflash Lance

Illustrative only; final content belongs to the relevant Discipline ticket.

```text
Name: Arcflash Lance
Source: Stormsinger
Action: consumes Action
Cost: 32 MP
Target: ENEMY_UNIT
Range: 2–5
LoS: required
Shape: SINGLE primary
Requirement: target is Conductive OR standing in Wet terrain
Effect 1: Storm damage
Effect 2: if Conductive, chain reduced damage to nearest valid enemy within 2
Cooldown: 2 actor turns
AI tags: payoff, ranged, avoid_overkill, conductive_combo
Presentation: lightning spear + short chain arc
```

What matters is not the exact number.

The important part is that targeting, requirement, effect, AI, presentation, and authoring all describe the same action.

---

## 100. Example Art — Stone Rampart

```text
Name: Stone Rampart
Source: Stonebinder
Action: consumes Action
Cost: 40 MP
Target: EMPTY_TILE
Range: 1–4
Selection: choose two valid endpoints within maximum wall length
Requirement: valid supported ground / no occupied mandatory tile
Effect: create connected Stone Wall battle objects
Duration: persistent until destroyed/end of battle
AI tags: zone_control, protect, chokepoint
Presentation: ground fracture → rising stone segments
```

This demonstrates why targeting needs more than `self / other user`.

---

## 101. Example Movement Art — Gale Step

```text
Name: Gale Step
Source: Stormsinger
Type: Movement Art
Target: EMPTY_TILE
Range: 1–3
Path: may ignore ordinary difficult-ground cost; cannot pass sealed wall
Cost: 18 MP
Action: does not consume normal Action
Limit: once per actor turn
Safety: cannot generate another free Gale Step through its own effects
Effect: reposition + brief Evasion/air-current effect according to final design
```

Movement Arts are a major source of rule-breaking mobility and therefore need clear legality/preview rules.

---

## 102. Example Reaction — Mirror Riposte

```text
Trigger: actor successfully parries a melee attack
Requirement: Reaction ready, sufficient resource if applicable
Effect 1: create decoy on a valid adjacent tile
Effect 2: optionally rotate actor toward attacker according to rule
Cooldown: once per round
Confluence context: Edgedancer + Veilweaver
```

It resolves through the same event/effect system rather than custom UI code.

---

## 103. Implementation Timing

This specification does **not** authorize implementing all combat complexity in the next ticket.

### Phase 1

Prepare only the character/build data boundaries necessary for later combat:

- attributes/derived stats;
- initial Discipline/Mastery identity;
- equipment foundations where scoped;
- no complete combat engine yet.

### Phase 2 — Tactical Combat Core

Build the smallest complete combat grammar needed for a genuinely fun vertical slice:

- battle state/version/seed;
- board;
- turn/round lifecycle;
- Movement Budget and split-movement rules;
- terrain/path/elevation basics;
- facing;
- one Action;
- Basic Attack / Guard / Wait / Interact where scenario needs it;
- typed Target Spec foundation;
- initial shapes such as Single, Circle, Line;
- range/LoS/height validation;
- HP/MP;
- initial statuses;
- reusable effects;
- Action cost/requirement foundation;
- event log;
- authoritative command flow;
- battle UI preview/forecast foundation;
- initial battle scene/environment presentation;
- first PvE AI integration through the same legality system;
- deterministic tests and practice harness.

Do not implement every targeting shape, every content editor, full PvP, all Reactions, all Disciplines, or the final map editor merely because the architecture anticipates them.

### Phase 3 — Discipline Framework

Extend the grammar as real build content needs it:

- full six-Art loadout constraints;
- Traits;
- Reactions;
- Movement Arts;
- Current Ultimate slot;
- Soulmark Signature slot;
- Confluence Trait/Art integration;
- additional Target Specs required by released Arts;
- requirement grammar;
- cooldown/charge/use-limit rules;
- Discipline resources;
- Art Curriculum/acquisition metadata;
- first combat-content authoring/validation tools where implementation volume justifies them.

### Phase 4 — First Playable Discipline Set

Use real content to prove the system:

- each Discipline has a distinct combat identity;
- enough targeting/effect patterns exist to make builds meaningfully different;
- AI can use the released Arts;
- content duplication/filler review;
- balance benchmarks;
- art/audio/VFX for representative abilities;
- Tactical Hall drills;
- first mature Battle Review telemetry;
- human playtests for fun/clarity.

### Phase 5 — World Integration

- world locations select coherent battle scenes;
- encounter context drives terrain/environment/weather variants;
- battle return flow reconnects cleanly to the world;
- story/event state can alter scenarios through approved data;
- Master Panel world/encounter operations can reference combat content safely.

### Phase 6 — Co-op

- multi-player turn ownership;
- team pings/communication;
- coordinated objectives;
- enemy team intelligence;
- multi-unit Reactions/targeting tested for pacing;
- reconnect for several players.

### Phase 7 — Expeditions/Bosses

- richer scenario/objective definitions;
- authored modular encounter maps;
- telegraphs/windups/interrupts as boss content requires;
- multiphase battle-state rules;
- environmental transformations;
- long-run version/reconnect safety.

### Phase 8 — PvP

- competitive timer rules;
- Arena Tempering integration;
- explicit PvP overrides;
- CC anti-lockout;
- 1v1/2v2 map balance;
- ranked loadout validation;
- timeout/disconnect/surrender;
- competitive analytics.

### Phase 9+

Expand the grammar only as the full Discipline roster and later systems require it.

### Phase 13 — Complete Combat Operations

Complete the Combat Content Studio / Balance Lab / Combat AI Lab integration:

- comprehensive editors;
- visual targeting preview;
- requirements/effect-stack editor;
- status/terrain/weapon/map/scenario editors;
- dependency/impact preview;
- test-character battle launch;
- deterministic replay;
- batch simulation;
- analytics;
- staged publish;
- rollback;
- emergency disable;
- permissions/audit.

### Phase 14

Dedicated visual/audio polish for combat presentation, maps, actions, transitions, signatures, Ultimates, Confluences, Soulmarks, responsive battle UI, and accessibility.

### Phase 15

Hardening:

- exploit/authority testing;
- action idempotency/version races;
- pathfinding worst cases;
- targeting/property tests;
- reaction-loop tests;
- map bias/load tests;
- PvP timing/reconnect abuse;
- AI performance;
- visual readability;
- cross-browser/mobile performance;
- content-publish/rollback safety.

---

## 104. Definition of Success

The combat system succeeds when:

- a new player can understand the basic turn quickly;
- an advanced player can spend months discovering deeper tactical interactions;
- Current + Legacy + Confluence + Soulmark + equipment choices materially change battle decisions;
- movement and terrain matter every fight without becoming tedious accounting;
- targeting supports expressive Arts without a separate custom implementation for each one;
- players understand why actions are legal/illegal;
- forecasts make combat feel fair while preserving legitimate hidden information;
- Reactions create tension without constantly interrupting flow;
- Ultimates and major Arts feel powerful through art/audio/animation as well as numbers;
- battle scenes feel connected to the actual world;
- AI uses the same rules and remains fair;
- PvP retains skill expression without chain-control or raw-stat hopelessness;
- the Master Panel can safely author, validate, preview, rebalance, publish, disable, and roll back combat content;
- one combat definition feeds gameplay, AI, Codex/manual, analytics, media, acquisition, support, simulation, and Master Panel views;
- the system is deep because its parts interact, not because every action has twenty fields the player must manage;
- combat feels like a modern fantasy tactical battle rather than a dated browser database screen.
