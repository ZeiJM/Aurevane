AUREVANE
Complete Master Game Design, Technical Architecture & AI Implementation Specification
Master Specification v1.0
1. PRODUCT VISION

Aurevane is a persistent online tactical fantasy RPG played in the browser.

Players create a permanent character, explore a living shared fantasy world, study numerous combat Disciplines, master them, combine one current Discipline with one previously mastered Discipline, discover powerful Confluences between those styles, awaken supernatural Soulmarks, acquire build-changing equipment, complete solo and cooperative quests, descend into progressively generated dungeons, compete in 1v1 and 2v2 tactical PvP, form parties and guilds, eventually pledge themselves to nations and participate in large seasonal conflicts.

The game should combine the best qualities of:

persistent browser RPGs;
tactical RPG character building;
class mixing;
theorycrafting;
dungeon crawlers;
MMO social systems;
modern live-service games;
high-quality fantasy presentation.

But it should remain practical enough to be developed incrementally with AI.

2. THE FIVE THINGS AUREVANE MUST BE EXCELLENT AT
Character building

Players should regularly think:

“What happens if I master this Discipline and combine it with that one?”

This is the heart of the game.

Tactical combat

Positioning, terrain, timing, ability combinations, team composition and predicting opponents should matter.

Co-operative PvE

Playing with two friends should be a genuinely good experience rather than single-player combat with extra bodies.

Persistent world/social identity

Players should recognize:

famous PvP players;
guilds;
dungeon groups;
unusual builds;
nation leaders;
collectors.
Presentation

Aurevane should look and sound like a beautiful game delivered through a browser, not a CRUD website wearing fantasy artwork.

3. WHAT WE ARE NOT BRINGING BACK

The following concepts are permanently removed:

heirs;
aging;
children;
lineage inheritance;
generational replacement;
permanent character death;
giant elemental rock-paper-scissors system;
permanent class-stat mistakes;
dozens of currencies;
mandatory daily energy;
massive sprite requirements;
mandatory nation selection at creation;
permanent build traps.

Shattered Veil remains abandoned conceptually.

4. CORE GAME LOOP

The basic loop:

LOGIN
  ↓
Check character / guild / friends / world events
  ↓
Choose activity
  ↓
Explore / Quest / Train / PvP / Dungeon / Socialize
  ↓
TACTICAL COMBAT
  ↓
XP + Mastery + Crowns + Equipment + Unlocks
  ↓
Improve / modify build
  ↓
Try new Discipline combination
  ↓
Discover new Confluence
  ↓
Take on harder content
  ↓
Return to the persistent world

Long-term:

New Adventurer
      ↓
Learn first Disciplines
      ↓
Master first Discipline
      ↓
Unlock Legacy Discipline system
      ↓
Discover Confluences
      ↓
Build specialization
      ↓
Co-op dungeons
      ↓
Ranked PvP
      ↓
Guild
      ↓
Advanced Disciplines
      ↓
Hard expeditions
      ↓
Nation membership
      ↓
High-end PvP / PvE
      ↓
Seasonal endgame
5. HEALTHY RETENTION — MAKE IT HARD TO PUT DOWN WITHOUT MAKING IT MISERABLE

I want strong retention, but not cheap frustration mechanics.

The game should make players return because they have interesting goals, not because missing Tuesday destroys a streak.

Primary retention systems:

Build discovery

There is always another Discipline combination to try.

Confluence Codex

Discovering combinations fills a collection book.

Mastery

Players gradually master additional Disciplines.

Targeted gear hunting

Specific activities have known reward pools.

Procedural dungeons

Layouts, encounters and modifiers vary.

PvP seasons

Ranks and metas evolve.

Guild/social activity

Friends create reasons to return.

World events

The world changes.

New Disciplines/Soulmarks

Major updates change build possibilities.

Rested progression

Time away gives a modest Mastery/XP bonus rather than punishing inactivity.

Contract banking

Daily-ish contracts can accumulate for several days instead of disappearing immediately.

No:

YOU MISSED A DAY
YOUR 93-DAY STREAK IS DEAD
BUY 400 GEMS

That's not the game I want.

6. CHARACTER CREATION

Creation should take approximately a few minutes rather than forcing players to study the wiki before entering the world.

Players choose:

name;
body/presentation;
pronouns;
portrait;
starter appearance;
one Foundation Discipline;
small starting attribute distribution.

They do not choose a Soulmark immediately.

Soulmarks unlock through an early narrative event so players first understand basic combat.

7. CHARACTER PORTRAITS

Players may eventually use:

official portraits;
unlocked portraits;
uploaded images;
imported image URLs;
AI-created portraits subject to game rules.

Uploaded assets are copied into controlled storage rather than being permanently hotlinked.

8. CHARACTER ATTRIBUTES

Four core attributes only.

Might

Physical strength and force.

Finesse

Precision, critical effectiveness, initiative and agile combat.

Intellect

Magical potency, healing and supernatural control.

Resolve

Health, defenses and status resistance.

That's it.

9. DERIVED STATS

Calculated from attributes, Discipline, equipment and effects.

Examples:

Maximum HP
Maximum MP
Physical Power
Mystic Power
Armor
Ward
Accuracy
Evasion
Critical Chance
Initiative
Movement
Jump
Status Resistance

Players aren't asked to manually distribute thirty different numbers.

10. LEVEL

General character progression:

Level 1–100.

The cap is configurable from the Master Panel.

Levels primarily provide:

attribute points;
equipment access;
world access;
modest baseline growth.

They do not replace Discipline progression.

11. THE CLASS SYSTEM IS NOW CALLED DISCIPLINES

We are eliminating:

Jobs
Job Points
Job Level

Player-facing terminology becomes:

Discipline

Your combat profession/style.

Mastery

How experienced you are with that Discipline.

Legacy Discipline

A Discipline you have completely mastered and equipped as your secondary combat tradition.

Art

An active ability.

Trait

A passive ability.

Reaction

A passive triggered by an event.

Movement Art

Special movement ability.

Confluence

The unique interaction created by combining your current Discipline with your Legacy Discipline.

Much more Aurevane.

12. THERE IS NO JP-LIKE CURRENCY

Players simply gain Mastery experience when appropriately using a Discipline.

A Mastery bar progresses.

Stages:

Initiate
↓
Practiced
↓
Adept
↓
Expert
↓
Master

There is no pile of points players manually spend on class skills.

Important Arts unlock at milestones.

Some require a Discipline quest or challenge.

At 100%:

DISCIPLINE MASTERED

That Discipline can now become a Legacy Discipline.

13. CURRENT + LEGACY DISCIPLINE

This becomes one of Aurevane's signature systems.

Your build contains:

CURRENT DISCIPLINE
+
MASTERED LEGACY DISCIPLINE
+
SOULMARK
+
EQUIPMENT
+
CONFLUENCE

Your Current Discipline does not need to be mastered.

Your Legacy Discipline must be mastered.

14. ACTIVE BUILD

Players equip:

Current Discipline

4 Current Arts.

Legacy Discipline

2 Legacy Arts.

Traits

2 Traits.

At least one must originate from either Current or Legacy Discipline.

Reaction

1 Reaction.

Movement Art

1 Movement Art.

Soulmark

1 active Soulmark.

Confluence

Automatically determined by Current + Legacy Discipline.

This produces meaningful complexity while the combat bar remains readable.

15. CONFLUENCE SYSTEM

This is the major improvement I'm independently adding.

Whenever two Disciplines are combined:

They create a Confluence.

Every pairing has at least one unique mechanical interaction.

Not simply:

+5% damage.

Confluences should alter gameplay.

Examples:

Bastion + Chronist
Temporal Fortress

When you intercept damage for an ally, that ally gains Initiative.

Your defensive play literally accelerates teammates.

Nightveil + Veilweaver
Phantom Killer

Leaving invisibility creates an illusion on your previous tile.

The illusion can absorb one attack.

Cinderweaver + Stormsinger
Arcflash

Lightning attacks against Scorched targets chain electricity to another nearby unit.

Frostweaver + Stonebinder
Permafrost

Stone structures created by you become frozen.

Enemies adjacent to them become Slowed.

Runeblade + Riftwalker
Rift Edge

Once per round, a melee Art may begin with a one-tile spatial blink.

Blade Saint + Chronist
Perfect Moment

Waiting without acting charges your next Reaction.

Patient play becomes dangerous.

Beastbinder + Cantor
Pack Song

Your song effects also affect allied summons at enhanced strength.

Ravager + Sanguinist
Crimson Frenzy

Losing HP generates temporary offensive momentum.

Healing removes the momentum.

Dawnshield + Lifebinder
Sacred Mercy

Overhealing creates a small barrier.

Nightveil + Hexbinder
Cursed Blade

Striking a Hexed target extends one Hex.

Skywarden + Stormsinger
Thunderfall

Landing after a vertical leap generates electrical damage around the landing tile.

Edgedancer + Veilweaver
Mirror Riposte

Successful parries briefly create a decoy.

Loreeater + Wildwarden
Apex Scholar

Monster-derived Arts gain bonuses against the creature family from which they originated.

Alchemist + Cinderweaver
Volatile Catalysis

Certain concoction zones ignite when struck by fire Arts.

Oracle + Hexbinder
Doomed Fate

Foretold enemy failures amplify the next Curse applied.

16. TWO TYPES OF CONFLUENCE

Every pair receives a:

Confluence Trait

Automatic gameplay modification.

Important/iconic pairings may additionally have a:

Confluence Art

A special active technique available only to that exact pairing.

Example:

Skywarden
+
Stormsinger

Confluence Trait:
Thunderfall

Confluence Art:
HEAVEN'S THUNDER

Leap high into the air and crash into a target area,
dealing physical + storm damage and creating a Static Field.
17. CONFLUENCE ENGINE MUST BE DATA-DRIVEN

The database contains:

discipline_confluences

with:

primary_discipline
legacy_discipline
name
description
trigger
conditions
effects
visual_fx
confluence_art
enabled
version

The Master Panel manages these.

When a new Discipline is published, the content workflow automatically flags missing Confluences.

18. TAG INTERACTIONS

Even without a bespoke Confluence, abilities can interact.

Core gameplay tags include:

Scorched
Frozen
Conductive
Wet
Bleeding
Marked
Guarded
Inspired
Hexed
Invisible
Exposed
Poisoned
Fortified
Summoned
Airborne
Displaced

Examples:

Storm Arts may interact with Conductive.

Certain martial Arts exploit Marked.

Blood Arts interact with Bleeding.

Frost may create Frozen terrain.

Fire may remove Frozen but create Steam.

This creates emergent cross-class combinations without recreating an elemental weakness wheel.

19. FINAL DISCIPLINE ROSTER

The full target roster is:

36 Disciplines.

Not all 36 launch in Alpha.

But all 36 are designed now so architecture anticipates them.

20. FOUNDATION DISCIPLINES
1. Vanguard

Balanced armed combat.

Unlock:

Available at character creation.

Innate:

Combat Readiness — first time each battle the Vanguard becomes adjacent to an enemy, gain Guard.

Arts:

Cleave
Guard Break
Rush
Brace
Rally

Ultimate:

Heroic Advance

Move and strike through several tiles while granting nearby allies Resolve.

2. Farstrider

Ranged combat and battlefield awareness.

Innate:

Keen Sight

Range penalties are reduced.

Arts:

Aimed Shot
Pinning Shot
Scout's Mark
Quickstep
Volley

Ultimate:

Deadeye Barrage

3. Shadehand

Mobility, trickery and opportunism.

Innate:

Opportunist

Bonus effectiveness against Exposed targets.

Arts:

Backstab
Feint
Smoke Vial
Cripple
Disengage

Ultimate:

Perfect Opening

4. Ironfist

Unarmed martial combat.

Innate:

Momentum

Successful consecutive attacks build Momentum.

Arts:

Rising Fist
Sweep
Focus Breath
Counter Palm
Breakfall

Ultimate:

Hundredfold Rush

5. Aetherist

Foundation offensive mage.

Innate:

Arcane Pressure

Repeated spell use gradually builds magical pressure.

Arts:

Arc Bolt
Mana Burst
Ward Pierce
Arcane Field
Channel

Ultimate:

Aether Nova

6. Lifebinder

Foundation healing/support mage.

Innate:

Grace

Supporting wounded allies produces Grace, empowering defensive Arts.

Arts:

Mend
Purify
Barrier
Renew
Sanctuary

Ultimate:

Wellspring

21. MARTIAL & HYBRID DISCIPLINES
7. Bastion

Heavy defender.

Requires:

Vanguard Adept.

Arts:

Shield Bash
Cover
Challenge
Intercept
Fortress

Ultimate:

Last Bastion

8. Ravager

High-risk physical attacker.

Requires:

Vanguard Adept.

Arts:

Frenzy
Reckless Cleave
Blood Rush
War Roar
Execution

Ultimate:

Red Tempest

9. Edgedancer

Precision duelist.

Requires:

Vanguard Practiced + Shadehand Practiced.

Arts:

Lunge
Riposte
Disarm
Flourish
Duelist's Step

Ultimate:

Sevenfold Cut

10. Skywarden

Spear-wielding aerial fighter.

Requires:

Vanguard Practiced + Farstrider Practiced.

Arts:

Vault
Impale
High Jump
Skewer Line
Dragonfall

Ultimate:

Heaven's Lance

11. Blade Saint

Patient, disciplined sword master.

Requires:

Vanguard Expert + Ironfist Adept.

Arts:

Iai Draw
Perfect Guard
Crescent Cut
Spirit Sever
Stillness

Ultimate:

One Perfect Stroke

12. Nightveil

Stealth/mobile assassin.

Requires:

Shadehand Adept + Ironfist Practiced.

Arts:

Shadowstep
Shuriken Fan
Smoke Veil
Phantom Clone
Silence Strike

Ultimate:

Vanishing Death

No normal instant-kill mechanics.

13. Wildwarden

Hunter, traps and wilderness control.

Requires:

Farstrider Adept.

Arts:

Snare
Hunter's Mark
Camouflage
Field Remedy
Thornline

Ultimate:

Apex Hunt

14. Beastbinder

Creature partnership.

Requires:

Farstrider Adept + Ironfist Practiced.

Arts:

Call Companion
Pounce Command
Guard Command
Pack Bond
Bestial Surge

Ultimate:

Alpha Covenant

15. Runeblade

Weapon/magic hybrid.

Requires:

Vanguard Practiced + Aetherist Practiced.

Arts:

Arc Edge
Rune Guard
Spell Parry
Siphon Slash
Sigil Step

Ultimate:

Runic Overdrive

16. Dawnshield

Holy protector.

Requires:

Vanguard Adept + Lifebinder Adept.

Arts:

Radiant Strike
Sacred Guard
Purge
Consecrate
Aegis

Ultimate:

Dawn's Oath

17. Dreadblade

Dark offensive knight.

Requires:

Vanguard Adept + Aetherist Adept.

Arts:

Abyss Slash
Blood Price
Dread Aura
Soul Eater
Nightfall

Ultimate:

Black Sun

18. Cantor

Musical battlefield support.

Requires:

Farstrider Practiced + Lifebinder Practiced.

Arts:

Marching Verse
Ballad of Mending
Dirge
Crescendo
Encore

Ultimate:

Grand Chorus

19. Alchemist

Potions, reactions and battlefield chemistry.

Requires:

Shadehand Practiced + Aetherist Practiced.

Arts:

Ember Flask
Acid Vial
Tonic Mist
Transmute
Catalyst

Ultimate:

Grand Reaction

20. Warcaller

Command and team tactics.

Requires:

Bastion Practiced + Cantor Practiced.

Arts:

Formation
Advance
Hold the Line
Focus Fire
Battle Standard

Ultimate:

Sovereign Command

This should be especially powerful in 2v2 and cooperative PvE without becoming mandatory.

22. MAGE DISCIPLINES

There are deliberately many.

A player wanting to make “a mage” should still have a massive range of identities.

21. Cinderweaver

Fire and explosive area control.

Requires:

Aetherist Practiced.

Arts:

Cinder Bolt
Flame Field
Ember Chain
Scorch
Firestorm

Ultimate:

Phoenix Wake

22. Frostweaver

Ice, barriers and slowing.

Requires:

Aetherist Practiced.

Arts:

Ice Lance
Frost Wall
Chilling Mist
Crystal Prison
Shatter

Ultimate:

Absolute Winter

23. Stormsinger

Lightning, wind and mobility.

Requires:

Aetherist Practiced + Farstrider Initiate.

Arts:

Arc Spark
Chain Lightning
Gale Step
Static Field
Thunderhead

Ultimate:

Skybreak

24. Stonebinder

Earth and terrain manipulation.

Requires:

Aetherist Practiced + Vanguard Initiate.

Arts:

Stone Rise
Quake
Earthen Ward
Spire
Seismic Pull

Ultimate:

Mountain's Judgment

25. Tidecaller

Water, mist and fluid battlefield control.

Requires:

Aetherist Practiced + Lifebinder Initiate.

Arts:

Water Lance
Mist Veil
Undertow
Cleansing Rain
Floodline

Ultimate:

Tidal Crown

26. Chronist

Time manipulation.

Requires:

Aetherist Adept.

Arts:

Haste
Slow
Delay
Rewind Step
Time Lock

Ultimate:

Borrowed Hour

Chronists manipulate turn order—not literal full match resets.

27. Riftwalker

Spatial manipulation and teleportation.

Requires:

Aetherist Adept + Shadehand Initiate.

Arts:

Blink
Rift Gate
Spatial Pull
Foldspace
Banish

Ultimate:

Event Horizon

28. Veilweaver

Illusion and deception.

Requires:

Aetherist Practiced + Shadehand Practiced.

Arts:

Decoy
Mirror Image
Confusion
False Terrain
Vanish

Ultimate:

Hall of Mirrors

29. Gravebinder

Necromancy and attrition.

Requires:

Aetherist Adept + Lifebinder Practiced.

Arts:

Soul Drain
Bone Servant
Rot
Soul Chain
Grave Soil

Ultimate:

Procession of the Dead

30. Eidolist

Magical summoning.

Requires:

Aetherist Adept + Lifebinder Adept.

Arts:

Summon Wisp
Guardian Eidolon
Ember Drake
Spirit Pact
Recall

Ultimate:

Grand Invocation

31. Oracle

Fate, prediction and support.

Requires:

Lifebinder Adept + Aetherist Initiate.

Arts:

Foretell
Misfortune
Fate Shield
Premonition
Rewrite

Ultimate:

Providence

32. Hexbinder

Curses and debuffs.

Requires:

Aetherist Practiced + Shadehand Adept.

Arts:

Weakening Hex
Silence Curse
Misery
Mark of Ruin
Curse Spread

Ultimate:

Malediction

33. Sanguinist

Blood magic and HP manipulation.

Requires:

Lifebinder Practiced + Aetherist Adept.

Arts:

Blood Spear
Life Tap
Crimson Shield
Hemorrhage
Blood Pact

Ultimate:

Red Communion

34. Loreeater

Learns supernatural Arts from monsters.

Requires:

Farstrider Practiced + Aetherist Practiced.

Arts:

Study Prey
Capture Trait
Borrowed Roar
Monster Skin
Adapt

Ultimate:

Chimera Memory

This produces an entire monster-hunting collection loop.

35. Starcaller

Astral/gravitational high magic.

Requires:

Aetherist Master + Chronist Adept + Riftwalker Adept.

Arts:

Starfall
Gravity Lens
Comet Step
Astral Ward
Constellation

Ultimate:

Celestial Rupture

36. Spellwright

Endgame metamagic Discipline.

Requires:

Aetherist Master + mastery of any three specialist magical Disciplines.

Spellwright doesn't merely provide stronger spells.

It manipulates other spells.

Arts:

Spell Stitch
Dual Weave
Rewrite Cost
Echo Cast
Counterspell Matrix

Ultimate:

Grand Formula

23. SOULMARKS

Disciplines are learned.

Soulmarks represent unusual supernatural potential unique to the person.

Initial set:

Gravity
Shadow
Blood
Mirror
Storm
Frost
Flame
Beast
Chains
Fortune
Echo
Void
Crystal
Dream
Spirit
Rift

Soulmarks are not hereditary.

No bloodline system.

24. SOULMARK FORMAT

Each Soulmark has:

passive mechanic;
signature Art;
three upgrade branches;
visual identity;
optional Discipline interactions.

Example:

Gravity

Passive:

Applying displacement builds Mass.

Signature:

Gravity Well

Branches:

Collapse

Damage-focused.

Dominion

Control-focused.

Orbit

Mobility/team-focused.

25. SOULMARKS CAN INTERACT WITH CONFLUENCES

Example:

Skywarden + Stormsinger
Confluence:
Thunderfall

Soulmark:
Gravity

Modified interaction:
Landing pulls adjacent enemies one tile toward the impact before
Thunderfall resolves.

This produces very different versions of the same Discipline combination.

26. COMBAT FORMAT

Turn-based tactical grid.

Typical map:

8×8 through 12×10.

Features:

tiles;
elevation;
terrain;
obstacles;
hazards;
zones;
summons;
interactable objects.
27. TURN STRUCTURE

Each normal turn:

MOVE
+
ACTION

They may occur in either order.

Certain Arts alter the rule.

The player can preview movement before committing unless hidden information has already been revealed.

28. FACING

Characters end turns facing:

north;
east;
south;
west.

Attacking from:

Front

Normal.

Side

Small advantage.

Rear

Greater accuracy/critical advantage.

The UI shows these effects before committing.

29. TERRAIN

Examples:

grass;
roads;
mud;
shallow water;
deep water;
rubble;
ice;
lava;
magical zones.

Different movement types interact differently.

Movement Arts provide interesting exceptions.

30. HEIGHT

Height matters, but should remain intuitive.

It can influence:

sight;
projectile trajectories;
certain ranges;
Jump Arts;
knockback.

The client visually previews legality.

Server validates everything.

31. COMBAT RESOURCES

Universal:

HP

Health.

MP

Ability resource.

Individual Disciplines may temporarily track mechanics such as:

Momentum;
Grace;
Rage;
Songs;
Marks;
Mass.

These are combat mechanics, not extra permanent currencies.

32. STATUS ENGINE

Core conditions:

Burn
Bleed
Poison
Chill
Slow
Haste
Root
Stun
Silence
Blind
Marked
Exposed
Guarded
Fortified
Regeneration
Barrier
Sleep
Confusion
Invisible
Revealed
Hexed
Conductive
Wet
Airborne

CC should have diminishing effectiveness in competitive PvP so lockout chains don't become the dominant strategy.

33. EFFECT ENGINE

Nearly every ability is built from reusable primitives:

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
CREATE_ZONE
MODIFY_STAT
RESTORE_RESOURCE
DRAIN_RESOURCE
TAUNT
STEALTH
REVEAL
COPY_EFFECT
DISPEL
DELAY_TURN
ACCELERATE_TURN

That means adding an ability normally means configuring effects rather than writing a custom combat function.

34. COMBAT RNG

Keep randomness controlled.

Players should see:

chance to hit;
damage range;
predicted statuses;
target area.

Avoid games where carefully planned turns fail constantly because of opaque RNG.

Strong tactical decisions should matter more than dice rolls.

35. COOPERATIVE PARTY SYSTEM

Normal cooperative party:

Maximum 3 players.

Features:

invite;
party finder;
leader;
ready check;
party chat;
inspect teammate loadout;
ping battlefield;
reconnect;
vote leave in longer instances.

No mandatory MMO trinity.

Three damage-oriented builds can succeed if their strategy is good.

A defensive/support composition may simply be safer.

36. CO-OP QUESTS

Quest content can specify:

SOLO

1–2 PLAYERS

1–3 PLAYERS

3 REQUIRED

Co-op mission examples:

Escort

Protect a vulnerable NPC.

Siege Defense

Defend multiple objectives.

Hunt

Track a roaming elite.

Expedition

Multi-stage exploration.

Rescue

Reach prisoners before a condition is met.

Story Operation

Multiple tactical encounters tied together narratively.

37. QUEST CREDIT

When in a shared instance:

encounter completion is shared;
personal rewards are individual;
important narrative decisions can remain player-specific.

Nobody loses progress because another player got the killing blow.

38. DUNGEONS

Dungeons are called:

Expeditions

in lore/UI where appropriate.

They are progressively generated adventures built from authored modular content.

They are not completely random rooms.

39. EASY EXPEDITION

Party:

1–3.

Target experience:

approximately short-session content.

Structure:

5–7 rooms

2–4 combats

1 event

1 reward room

1 boss/miniboss

Designed for:

casual play;
learning;
solo players.
40. STANDARD EXPEDITION

Party:

2–3 recommended.

Structure:

8–12 rooms

branching routes

elites

events

hazards

rest point

miniboss

boss

Requires more build coordination.

41. DEEP EXPEDITION

This replaces “Hard Dungeon.”

Party:

Exactly 3.

Target play session:

roughly 50–75 minutes for a normal successful run.

It should feel like a serious night of content.

Structure can contain:

ENTRY
 ↓
Battle
 ↓
Branch
 ↓
Event
 ↓
Elite
 ↓
Choice
 ↓
Sanctuary
 ↓
Deeper Branch
 ↓
Hazard
 ↓
Miniboss
 ↓
Treasure
 ↓
Sanctuary
 ↓
Deep Encounter
 ↓
Puzzle
 ↓
Elite
 ↓
Final Approach
 ↓
MULTIPHASE BOSS

Approximately 15–22 modules.

42. DEEP EXPEDITIONS CAN BE SUSPENDED

This is an important usability improvement.

At designated Sanctuaries, a party may:

Suspend the run.

The server stores:

party;
seed;
room;
HP/resources;
inventory state;
modifiers;
progression.

The group can reconvene later within a configurable window.

That makes hour-long cooperative content much more practical for adults.

43. EXPEDITION GENERATION

When creating a run, server records:

template_id
seed
party_snapshot
difficulty
route_graph
encounter_budget
modifier_set
loot_seed
boss
version

The same seed must reproduce the same generated structure.

44. PROGRESSIVE REVEAL

Players don't see the entire dungeon immediately.

Example:

          ?
         /
START — ⚔ — ?
         \
          ☠

Potential icons:

⚔ Battle
☠ Elite
? Mystery
◆ Treasure
♨ Sanctuary
⚙ Puzzle
👑 Boss

Information may itself be imperfect depending on certain modifiers.

45. THREAT SYSTEM

As a group descends:

Threat increases.

Higher Threat means:

stronger encounters;
stronger modifiers;
better reward weighting.

Risky routes may intentionally increase Threat.

46. EXPEDITION MODIFIERS

Examples:

Burning Footsteps

Defeated enemies leave fire.

Relentless

Low-health enemies become faster.

Arcane Drought

MP recovery reduced.

Crushing Gravity

Push/pull distance reduced.

Blood Moon

Bleed becomes stronger for both enemies and players.

Mirror Realm

Certain enemies produce temporary copies.

Restless Dead

Some defeated enemies revive unless cleansed.

Modifiers should create different decisions, not only larger enemy numbers.

47. BOSS DESIGN

Bosses use mechanics and phases.

Example:

The Hollow Regent

Phase I:

Royal guardians.

Phase II:

Destroy cursed reliquaries.

Phase III:

The arena begins collapsing.

Phase IV:

The Regent becomes spectral and ignores certain terrain.

This is substantially more memorable than:

skeleton with 180,000 HP.

48. PERSONAL LOOT

Dungeon loot is individual.

Players should never fight teammates over who clicked the chest first.

49. TARGET FARMING

Important equipment should have known sources.

Example:

STARCALLER SET

Dropped by:
Astral Observatory Expedition

Higher chance:
Deep difficulty

Use bad-luck protection for extremely rare chase items.

50. PVP

PvP is another core pillar.

Permanent formats:

Casual 1v1
Ranked 1v1
Casual 2v2
Ranked 2v2

Special/event formats:

3v3
Tournament
Guild Arena
Nation Conflict
51. 1V1

Standard tactical arena.

Used for:

practice;
ranking;
build testing.

Matches should be relatively compact.

52. 2V2

This receives first-class support.

Players can:

Premade Queue

Invite one teammate.

Solo Queue

Matchmaking finds a partner.

Each player controls their own character.

Teammates can:

ping tiles;
ping targets;
communicate;
inspect turn order.

They cannot control each other's character.

53. 2V2 SYNERGY IS WHERE CONFLUENCE BECOMES AMAZING

Example team:

Bastion / Chronist
+
Cinderweaver / Stormsinger

Bastion controls the map.

Chronist boosts turn economy.

Cinderweaver Scorches enemies.

Stormsinger triggers Arcflash.

There should be countless team strategies like this.

54. PVP MODES
Elimination

Defeat enemies.

Crystal Control

Capture objective tiles.

Relic Run

Acquire and return an object.

Dominion

Several control points.

Collapse

Map becomes increasingly dangerous.

Initially, ranked uses Elimination.

Other formats join rotations/events later.

55. PVP GEAR FAIRNESS

Equipment still matters.

But PvP should not become:

veteran has 400% your stats, therefore you lose.

Use Arena Tempering.

In ranked play:

extreme item-stat differences are compressed into competitive bands;
equipment effects remain meaningful;
builds still matter;
progression still matters;
raw numbers don't completely invalidate skill.
56. PVP RANKS

Separate 1v1 and 2v2 ratings.

Ranks:

Bronze
Silver
Gold
Platinum
Diamond
Master
Grandmaster
Mythic

Cosmetic seasonal rewards.

No core class progression locked behind high rank.

57. TURN TIMER

Competitive turn timer configurable around:

30–45 seconds.

Timeout:

first instances automatically Defend.

Repeated absence eventually forfeits.

58. DISCONNECTS

Battle persists server-side.

Players get reconnection grace.

If they return:

battle resumes.

If they do not:

timeout logic applies.

Disconnecting should never be a strategy.

59. TOURNAMENT ENGINE

Support:

1v1

2v2

Single elimination

Scheduled brackets

Seeded brackets

Private guild tournaments

Official seasonal tournaments

Double elimination can arrive later.

60. WORLD

Aurevane uses a stylized living strategic world map.

Not a huge continuously rendered 3D environment.

Players traverse:

roads;
forests;
cities;
mountains;
ruins;
dungeons;
dangerous regions;
nation borders.
61. LIVE PLAYER PRESENCE

Nearby players appear as attractive portrait tokens.

You can:

inspect;
message;
invite;
challenge;
view guild;
view status.

Fast token movement updates use Realtime Broadcast, while Presence is best used for slower status such as online/offline or the region/page the player occupies. That's also consistent with Supabase's current guidance.

62. WORLD REGIONS

Initial world design:

Aureth Crown

Central civilization and starter region.

Verdant Expanse

Forests, beasts and ancient ruins.

Emberreach

Volcanic frontier.

Frostmere

Frozen mountains.

Glasswind Desert

Arcane desert and buried civilization.

Hollow Coast

Haunted shoreline.

Starfall Highlands

Astral anomalies and dragons.

Umbral March

High-level dangerous frontier.

63. WORLD EVENTS

Examples:

Dragon Migration.
Fallen Star.
Demon Incursion.
Ghost Tide.
Arcane Storm.
Nation Siege.
Expedition Surge.
Legendary Hunt.

Events alter encounters and available objectives.

64. GUILDS

Features:

Create
Join
Applications
Invitations
Ranks
Permissions
Guild chat
Emblem
Treasury
Activity
Guild contracts
Guild level
Achievements
Leaderboard

Later:

guild hall;
guild PvP;
guild expeditions;
territory contributions.
65. NATIONS

Players are not forced to choose at character creation.

Nation affiliation unlocks later.

Five initial political powers:

Aureth Concord

Trade and civic institutions.

Kaedran Dominion

Military hierarchy.

Sylvaran Compact

Decentralized wilderness states.

Astral Collegium

Scholarly magical society.

Free Marches

Independent frontier coalition.

No nation locks important Disciplines.

66. NATION WARFARE

Seasonal campaigns.

Players contribute through:

PvP;
PvE;
quests;
expeditions;
resource objectives;
world events.

Therefore a PvE player can still materially help their nation.

67. EQUIPMENT

Slots:

Main Hand
Off Hand
Armor
Accessory I
Accessory II

Keep it manageable.

68. WEAPONS

Core categories:

Sword
Greatblade
Axe
Spear
Dagger
Bow
Crossbow
Staff
Wand
Gauntlet
Katana-like curved blade
Shield

The world should develop original visual identities for these rather than borrowing exact franchise designs.

69. EQUIPMENT PHILOSOPHY

Basic:

Might.

Interesting:

After moving four tiles, your next ranged Art gains +1 range.

Very interesting:

When you teleport through an enemy, apply Exposed.

Equipment should encourage builds.

70. RARITY

Five tiers only:

Common
Uncommon
Rare
Epic
Legendary

Legendary actually means rare.

71. SETS

Maximum meaningful sets should usually require:

2–3 items.

Avoid six-piece sets that eliminate gear experimentation.

72. ECONOMY

Primary tradable currency:

Crowns

Most progression systems should use:

XP;
Mastery;
reputation;

rather than fifteen token currencies.

73. MARKETPLACE

Eventually:

listings;
search;
filters;
item history;
tax;
server-side transactions;
economic analytics.

All transfers atomic and authoritative.

74. CRAFTING

Later professions:

Smithcraft;
Alchemy;
Enchanting;
Cooking.

Four is enough initially.

75. CHARACTER PRESTIGE AFTER LEVEL CAP

Do not introduce endless raw stat scaling.

At cap, players gain Renown.

Renown mainly unlocks:

titles;
cosmetics;
profile decoration;
prestige achievements;
collection progression.

This prevents ancient characters becoming mathematically unreachable.

76. AUDIO IS NOW A FIRST-CLASS SYSTEM

The previous plans underweighted this.

Aurevane should have a memorable musical identity.

Audio is part of the design from Sprint 1.

77. MUSIC SYSTEM

Use an adaptive Audio Director.

Music states:

TITLE
TOWN
WORLD_EXPLORATION
WORLD_DANGER
QUEST
BATTLE
BOSS
EXPEDITION
DEEP_EXPEDITION
PVP
PVP_CRITICAL
VICTORY
DEFEAT
NATION_WAR
EVENT
78. ADAPTIVE MUSIC

Music can contain stems:

Base ambience
Percussion
Melody
Tension
Choir
Combat layer

Example Deep Expedition:

Early rooms:

ambient
+
light melody

Threat increases:

ambient
+
percussion
+
tension

Near boss:

full instrumentation

Boss:

transition seamlessly into boss arrangement.

This can make a procedurally structured dungeon feel authored.

79. LEITMOTIFS

Important nations/characters/bosses should have recognizable melodies reused in different arrangements.

Example:

A nation theme may appear:

peacefully in its city;
triumphantly during victory;
ominously during civil conflict.

That gives Aurevane musical identity.

80. SOUND EFFECT CATEGORIES

Need distinct libraries for:

UI
click;
hover;
tab;
equip;
error;
confirmation.
Combat
weapon swings;
impacts;
blocks;
crits;
casting;
status;
movement;
teleportation.
World
footsteps;
wind;
rain;
crowds;
animals;
water.
Rewards
item found;
rare item;
level;
Mastery;
Confluence discovered;
achievement.
81. AUDIO SETTINGS

Settings page contains:

Master Volume
Music
Sound Effects
UI Sounds
Ambient
Voice/Narration

Every channel:

slider;
mute.

Also:

MUTE ALL

Audio preference is stored locally for immediate loading and synchronized to the user's account when logged in.

The game must be entirely playable muted.

82. AUDIO MASTER PANEL

Owner can:

upload tracks;
upload SFX;
preview;
assign music states;
adjust gain;
define loops;
define fade time;
associate tracks with regions;
associate tracks with bosses;
activate/deactivate tracks.

Track metadata includes:

composer/source;
license;
file;
version;
loop points;
tags.
83. ART DIRECTION

Aurevane aesthetic:

premium dark high fantasy + refined anime influence + tactical RPG clarity.

Not:

childish chibi;
generic AI fantasy;
hyper-realistic grimdark;
copied Final Fantasy aesthetics.

Characters should have:

elegant silhouettes;
striking costume design;
readable role identity;
mature fantasy proportions;
rich fabrics/metals;
sophisticated color separation.
84. ASSET STRATEGY

Do not require thousands of custom images.

Spend artistic effort where players notice it:

Premium
character portraits;
Discipline key art;
Soulmark art;
region art;
bosses;
legendary items;
login/season artwork.
System-generated/reusable
battle tokens;
borders;
cards;
VFX;
terrain tiles;
UI;
status icons;
particles.
85. AI ART REQUEST SYSTEM

Whenever the development AI encounters missing art, it must not silently create an ugly generic colored rectangle and forget about it.

It creates an:

ART_REQUEST

Stored under:

/content/art-requests/

Example:

ID:
ART-CHAR-0042

TYPE:
Character Portrait

SUBJECT:
Female Stormsinger battle mage

PURPOSE:
Discipline selection screen

ASPECT:
4:5

STYLE:
Aurevane character art

REQUIREMENTS:
- adult fantasy mage
- elegant asymmetrical storm robes
- wind-torn cloak
- silver conductive ornamentation
- subtle lightning
- confident expression
- readable silhouette

BACKGROUND:
minimal atmospheric storm gradient

AVOID:
- text
- logos
- excessive armor
- chibi proportions
- photorealism
- franchise-specific clothing

STATUS:
REQUESTED
86. MASTER IMAGE PROMPT STYLE

Use a shared base prompt such as:

Premium hand-painted fantasy RPG concept art with refined anime influence, mature character proportions, intricate but readable costume design, cinematic lighting, rich material rendering, elegant silhouette, controlled color palette, dramatic depth, high-end tactical RPG key-art quality, original fantasy design, no text, no logos.

Each asset request adds subject-specific information.

87. REGION ART PROMPTS

Template:

Cinematic wide fantasy environment illustration for Aurevane, [REGION DESCRIPTION], strong foreground/midground/background separation, atmospheric perspective, navigable-world feeling, premium RPG loading-screen quality, sophisticated lighting, no characters dominating composition, no text, no logo.

88. DUNGEON PROMPTS

Template:

Dark fantasy tactical dungeon environment, [THEME], modular architectural language suitable for grid-based tactical encounters, clear navigable floor space, dramatic practical lighting, atmospheric depth, premium hand-painted fantasy game art, original architecture, no text.

89. ITEM PROMPTS

Template:

Isolated fantasy RPG inventory item, [ITEM], elegant original silhouette, premium material rendering, centered orthographic presentation, subtle magical detail appropriate to rarity [RARITY], transparent or clean neutral background, no text, no hand holding item.

90. SOULMARK PROMPTS

Soulmark icons should be:

highly distinctive;
symbolic;
easy to recognize at 32px;
beautiful at large size.

Not detailed mini-paintings that become unreadable icons.

91. MASTER PANEL — ART STUDIO

Add:

Asset Studio

Owner sees:

Requested
Generated
Needs Revision
Approved
Published
Retired

For each asset:

prompt;
reference image;
variation history;
upload;
crop;
asset type;
tags;
license/source;
version;
approval.

This lets us later connect an image-generation provider without rebuilding the game-management workflow.

92. MASTER PANEL — OVERVIEW

Route:

/master

This is effectively the developer's game operating system.

Home dashboard:

Players Online
Registrations
Active PvP
Active Parties
Active Expeditions
World Events
Current Season
Server Health
Economy
Reports
Errors
Popular Disciplines
Popular Confluences
Soulmark Usage
93. MASTER PANEL — CHARACTER CONTENT

Owner editors:

Discipline Editor
Art Editor
Trait Editor
Confluence Editor
Soulmark Editor
Item Editor
Equipment Set Editor
94. CONFLUENCE EDITOR

Especially important.

Select:

CURRENT:
Cinderweaver

LEGACY:
Stormsinger

Then:

Name:
Arcflash

Trigger:
Storm damage against Scorched

Effect:
Chain 35% damage to nearest valid enemy

Cooldown:
Once per actor turn

VFX:
plasma-chain-01

PvP coefficient:
0.8

Publish.

No TypeScript edit required.

95. MASTER PANEL — WORLD CONTENT

Editors:

regions;
map nodes;
NPCs;
stores;
enemies;
bosses;
quests;
dialogue;
Expeditions;
rooms;
encounters;
loot tables;
world events.
96. MASTER PANEL — EXPEDITION EDITOR

Configure:

Name

Theme

Difficulty

Party requirement

Room range

Allowed room templates

Enemy pools

Elite pools

Bosses

Threat curve

Modifier pool

Sanctuary frequency

Loot table

Resume rules

Recommended level

Enabled
97. MASTER PANEL — AUDIO

Already discussed, but it lives alongside content.

No developer required to replace a town song.

98. MASTER PANEL — LIVE OPS

Owner controls:

announcements;
seasonal events;
XP modifiers;
Mastery modifiers;
dungeon events;
world invasions;
PvP rotations;
tournament schedules;
login banner;
maintenance mode.
99. MASTER PANEL — FEATURE FLAGS

Instantly enable/disable:

Ranked
2v2
Marketplace
Trading
Specific Discipline
Specific Art
Specific Soulmark
Specific Confluence
Expeditions
Specific Expedition
Guilds
Nation War
World PvP
Chat
Battle Pass

A broken feature doesn't require shutting down the entire game.

100. CONTENT VERSIONING

Every important content change:

DRAFT
↓
PREVIEW
↓
PUBLISH

Keep history.

Allow rollback.

101. MASTER PANEL — BALANCE LAB

For each Discipline:

Pick Rate
Mastery Rate
PvE Win Rate
1v1 Win Rate
2v2 Win Rate
Damage
Healing
Survival
Common Legacy
Common Soulmark
Common Equipment

Confluences receive the same analytics.

102. AUTOMATED SIMULATION

Eventually:

SIMULATE

Bastion + Chronist
vs
Nightveil + Hexbinder

10,000 matches

Return statistical results.

AI may summarize.

AI is never allowed to automatically rebalance live content.

Owner approves balance changes.

103. SERVER ARCHITECTURE — BUILT PROPERLY FROM DAY ONE

This is the other major change you requested.

We design the software boundaries now so multiplayer servers aren't a future rewrite.

104. MONOREPO

Recommended:

/apps
  /web
  /worker

/packages
  /game-core
  /combat
  /expeditions
  /matchmaking
  /content
  /db
  /realtime
  /audio
  /ui
  /config
  /validation
  /analytics
105. WEB APPLICATION

apps/web

Contains:

Next.js;
React;
pages;
game shell;
master panel;
tRPC entry points;
authentication integration.

It must never contain authoritative game calculations inside UI components.

106. GAME CORE

packages/game-core

Pure server-authoritative rules.

No React.

No browser logic.

Contains:

stats;
progression;
equipment;
rewards;
shared invariants.
107. COMBAT ENGINE

packages/combat

Deterministic battle engine.

Input:

battle state
+
validated action
+
RNG seed

Output:

new battle state
+
events

This makes it:

testable;
replayable;
simulatable;
portable to a dedicated service later.
108. EXPEDITION ENGINE

packages/expeditions

Generates:

graphs;
rooms;
encounter budgets;
Threat;
modifiers;
loot seed.

Also handles:

suspension;
reconnection;
run completion.
109. DATABASE & AUTH

Supabase initially provides:

PostgreSQL;
authentication;
Realtime;
storage.

Sensitive tables exposed through Supabase must use appropriate Row Level Security, and privileged service credentials must never reach the browser. Supabase's current documentation explicitly recommends RLS for exposed schemas.

110. AUTHORITATIVE ACTION FLOW

Example battle action:

PLAYER
↓
Use Art: Thunderfall
↓
API
↓
Authenticate
↓
Validate schema
↓
Load battle
↓
Verify battle version
↓
Verify ownership
↓
Verify turn
↓
Validate target
↓
Combat Engine
↓
Database transaction
↓
Save state + action event
↓
Realtime Broadcast
↓
ALL BATTLE CLIENTS UPDATE

The browser never submits:

Damage = 954.

111. BATTLE VERSIONING

Each battle has:

version

Client submits expected version.

Server rejects/retries stale action attempts.

This is particularly important when several participants are connected.

112. IDEMPOTENCY

Reward-changing requests have an:

idempotency_key

If the same successful request is accidentally repeated:

the player does not receive the reward twice.

Use this for:

loot;
purchases;
marketplace transfers;
quest rewards;
battle rewards.
113. REALTIME CHANNEL DESIGN

Examples:

battle:<battleId>

party:<partyId>

expedition:<runId>

region:<regionId>

guild:<guildId>

nation:<nationId>

user:<userId>

Use Broadcast for fast gameplay/event messages. Supabase itself recommends Broadcast for higher-frequency event delivery and notes that Postgres Changes has per-subscriber authorization scaling costs.

114. PRESENCE

Presence holds slower state:

online
current_region
party
status
last_seen

Do not use Presence as the authoritative movement state.

Supabase currently recommends Broadcast rather than Presence for high-frequency/fire-and-forget updates.

115. WORKER

apps/worker

Handles asynchronous/server jobs:

scheduled events;
leaderboard processing;
matchmaking maintenance;
stale session cleanup;
world events;
emails;
economic snapshots;
battle simulations;
analytics aggregation.

Do not put massive simulation jobs inside request-response functions. Supabase's Edge Functions documentation specifically advises keeping those functions short-lived/idempotent and moving heavy long-running work to background workers.

116. THREE ENVIRONMENTS FROM THE BEGINNING

Use:

LOCAL
STAGING
PRODUCTION
Local

Your PC.

Fake/test accounts.

Disposable data.

Staging

Cloud test environment.

Used to test deployments.

Production

Real players.

Never test dangerous migrations directly against Production.

117. DEPLOYMENT ARCHITECTURE

Initially:

PLAYER BROWSER
      ↓
NEXT.JS WEB/API
      ↓
SERVER DOMAIN LOGIC
      ↓
SUPABASE POSTGRES
      │
      ├── Auth
      ├── Storage
      └── Realtime

Worker:

BACKGROUND WORKER
      ↓
POSTGRES

This is sufficient for the turn-based architecture.

118. FUTURE PHYSICAL GAME SERVER

If the game grows enough:

Next.js
↓
Dedicated Game API
↓
game-core packages
↓
Postgres

Because the core gameplay is already isolated in packages, moving API execution to separate server containers should not require rewriting combat.

That's the important part.

119. YOU DO NOT NEED ONE RUNNING SERVER PROCESS PER BATTLE

Because Aurevane is turn-based, authoritative battle state can be persisted and processed as discrete validated actions.

This is a design inference, not a platform limitation: it considerably simplifies hosting while still giving clients immediate updates through Realtime.

120. SECURITY

Never trust client-provided:

XP
Crowns
Damage
Healing
Items
Level
Mastery
Cooldown
Battle result
Quest completion
Dungeon completion
Position legality
Drop result
Marketplace transaction

Everything sensitive validated server-side.

121. RATE LIMITS

Rate-limit:

login;
chat;
marketplace;
movement commands;
PvP queue;
battle actions;
friend requests;
messaging.
122. AUDIT LOGGING

Administrative actions record:

admin
timestamp
action
target
reason
old value
new value

Owner actions included.

123. SERVER OBSERVABILITY

Track:

error rates;
API latency;
battle-processing time;
database query latency;
Realtime disconnects;
worker failures;
queue depth;
active users;
active battles.
124. GAME ANALYTICS

Do not only track revenue.

Track whether players are actually enjoying systems.

Examples:

Where players quit tutorial
Disciplines tried
Disciplines mastered
Confluences discovered
Quest completion
Dungeon abandonment room
Dungeon wipe location
PvP surrender rate
Average battle turns
Matchup win rates
Returning players
Party formation
Guild participation
125. THE FUN/RETENTION ENGINE

The major repeating goals:

"One more Discipline level."

"One more room."

"I want that item."

"I want to try this Confluence."

"We nearly killed the boss."

"One more ranked game."

"My friend just logged on."

"I finally unlocked Starcaller."

"I need the monster Art from that boss."

"We're one win from Diamond."

"Our guild needs this objective."

"There's a world event happening."

That's the kind of compelling loop I want.

126. BLUEPRINT FOR SESSION LENGTHS

Aurevane should support:

5-minute session
inventory;
Mastery check;
contract;
shop;
quick travel.
15-minute session
quest;
casual PvP;
easy encounter chain.
30-minute session
Standard Expedition;
several quests;
ranked games.
~1-hour session
Deep Expedition;
tournament;
major guild event.

Players aren't required to have huge blocks of free time.

127. MONETIZATION

Focus on cosmetics.

Potential:

portraits;
profile frames;
battle banners;
weapon skins;
cosmetic spell effects;
emotes;
title packs;
character slots;
supporter packs;
premium seasonal pass.

Never sell:

dominant PvP gear;
permanent stat advantage;
exclusive meta-defining Disciplines.
128. SEASON PASS

Free and premium paths.

Primarily:

cosmetics;
profile themes;
portrait frames;
Soulmark cosmetic VFX;
emotes;
banners;
music-player unlocks;
titles.

Owner controls all rewards through Master Panel.

129. CONTENT ROTATION

Seasonal items can feel special.

But important gameplay systems should eventually return.

Don't permanently lock a competitive build behind:

you weren't playing in August 2027.

130. IMPLEMENTATION SCHEDULE

This is now the actual build order.

A Sprint means:

a development milestone, not necessarily a fixed calendar week.

The AI does not proceed until acceptance criteria pass.

PHASE 0 — ENGINEERING FOUNDATION
Sprint 0 — Repository
monorepo;
TypeScript;
formatting;
lint;
Git;
CI;
test framework.
Sprint 1 — Infrastructure
Supabase local;
staging configuration;
production configuration;
migrations;
authentication;
RLS baseline;
deployment pipeline.
Sprint 2 — Server Architecture
game-core;
transactional service pattern;
idempotency;
realtime adapter;
worker skeleton.
Sprint 3 — Design System + Audio Core
typography;
colors;
UI primitives;
responsive game shell;
Audio Director;
audio settings;
mute;
Master volume channels.

Gate:

Beautiful empty Aurevane shell + functioning production-style infrastructure.

131. PHASE 1 — FIRST CHARACTER
Sprint 4

Authentication UI.

Sprint 5

Character schema.

Sprint 6

Character creation.

Sprint 7

Character profile.

Sprint 8

Stats/progression.

Sprint 9

Foundation Discipline framework.

Sprint 10

Mastery framework.

Gate:

Create character and progress Discipline Mastery.

132. PHASE 2 — COMBAT VERTICAL SLICE
Sprint 11

Effect engine.

Sprint 12

Tactical board.

Sprint 13

Movement/elevation.

Sprint 14

Turn engine.

Sprint 15

Combat actions/statuses.

Sprint 16

Enemy AI.

Sprint 17

Rewards.

Sprint 18

Combat presentation/audio/VFX.

Gate:

Beautiful complete PvE fight.

133. PHASE 3 — DISCIPLINE MIXING
Sprint 19

Legacy Discipline.

Sprint 20

Borrowed Arts.

Sprint 21

Traits/Reactions/Movement Arts.

Sprint 22

Confluence framework.

Sprint 23

First Confluence library.

Sprint 24

Soulmark framework.

Gate:

Current + Legacy + Soulmark build works.

This is the moment Aurevane actually starts becoming Aurevane.

134. PHASE 4 — CORE CONTENT

Implement six Foundations plus first advanced group:

Bastion;
Ravager;
Edgedancer;
Wildwarden;
Cinderweaver;
Frostweaver;
Stormsinger;
Chronist;
Runeblade;
Dawnshield.

Target Alpha initially around:

16 playable Disciplines.

Do not delay testing until all 36 exist.

135. PHASE 5 — WORLD
Sprint 29

World map.

Sprint 30

Movement/presence.

Sprint 31

Towns.

Sprint 32

Encounters.

Sprint 33

NPC/dialogue.

Sprint 34

Quest engine.

Sprint 35

Initial story.

136. PHASE 6 — PARTY & CO-OP
Sprint 36

Parties.

Sprint 37

Party realtime.

Sprint 38

Co-op battles.

Sprint 39

Shared quests.

Sprint 40

Party finder.

Gate:

Three people can complete a mission together.

137. PHASE 7 — EXPEDITIONS
Sprint 41

Dungeon template engine.

Sprint 42

Seeded generation.

Sprint 43

Progressive reveal.

Sprint 44

Easy Expeditions.

Sprint 45

Standard Expeditions.

Sprint 46

Threat/modifiers.

Sprint 47

Suspension/reconnect.

Sprint 48

Deep Expeditions.

Sprint 49

Multiphase bosses.

Sprint 50

Personal loot/leaderboards.

Gate:

Three-player hour-scale Deep Expedition is fully playable.

138. PHASE 8 — PVP
Sprint 51

Direct challenges.

Sprint 52

Casual 1v1.

Sprint 53

Ranked 1v1.

Sprint 54

Arena Tempering.

Sprint 55

Casual 2v2.

Sprint 56

Ranked 2v2.

Sprint 57

Matchmaking.

Sprint 58

Disconnect protection.

Sprint 59

Seasons.

Sprint 60

Tournament framework.

139. PHASE 9 — FULL DISCIPLINE ROSTER

Implement remaining Disciplines in batches.

Every new Discipline must include:

Innate
5+ Arts
Ultimate
Traits
Reaction where appropriate
Movement Art where appropriate
AI usage rules
VFX
SFX
Confluence definitions
PvP tests
PvE tests

Eventually reach all 36.

140. PHASE 10 — SOCIAL WORLD
guilds;
friends;
messages;
guild quests;
guild progression;
social profile;
moderation.
141. PHASE 11 — ECONOMY
stores;
loot;
marketplace;
crafting;
economic telemetry.
142. PHASE 12 — NATIONS
allegiance;
reputation;
nation quests;
campaigns;
nation warfare;
political rankings.
143. PHASE 13 — MASTER PANEL

Some admin functionality exists earlier.

This phase builds the complete owner experience:

content editors;
Confluence editor;
quest editor;
expedition editor;
event editor;
audio manager;
Asset Studio;
balance dashboards;
simulation;
economic analytics;
moderation;
version rollback.
144. PHASE 14 — ART & AUDIO POLISH

Dedicated production pass.

Not:

add more features.

Instead:

region artwork;
character art;
Discipline artwork;
Soulmark art;
soundtrack;
ambient audio;
SFX;
transitions;
particles;
animations;
responsive polish;
loading states;
error states.
145. PHASE 15 — HARDENING
penetration/security review;
abuse testing;
rate limits;
SQL/index optimization;
load testing;
matchmaking load;
Realtime load;
expedition concurrency;
economic exploit testing.
146. CLOSED ALPHA

Alpha target:

16 Disciplines
8 Soulmarks
dozens of Confluences
4 world regions
20–30 enemies
4–6 bosses
50+ items
20+ quests
Easy Expedition
Standard Expedition
1 Deep Expedition
1v1 PvP
2v2 PvP
Guild foundation
Master Panel
full audio
strong visual presentation

That is already a substantial game.

147. THE AI MUST KEEP DOCUMENTATION

Repository:

/docs/MASTER_GAME_SPEC.md

/docs/TECH_ARCHITECTURE.md

/docs/DISCIPLINES.md

/docs/CONFLUENCE_SYSTEM.md

/docs/SOULMARKS.md

/docs/COMBAT.md

/docs/PVP.md

/docs/EXPEDITIONS.md

/docs/QUESTS.md

/docs/WORLD.md

/docs/GUILDS.md

/docs/NATIONS.md

/docs/ECONOMY.md

/docs/MASTER_PANEL.md

/docs/AUDIO_BIBLE.md

/docs/ART_BIBLE.md

/docs/SECURITY.md

/docs/ROADMAP.md

AGENTS.md

TASKS.md
148. ART REQUEST DIRECTORY

Also:

/content/art-requests/

/content/audio-requests/

/content/seed/

/content/balance/

When artwork/music is missing:

AI creates a request specification.

It doesn't randomly change the visual style.

149. AUDIO REQUEST FORMAT

Example:

AUDIO-EXP-003

TYPE:
Music

CONTEXT:
Deep Expedition - Frostmere Crypt

MOOD:
mysterious, dangerous, ancient, gradually intensifying

STYLE:
orchestral fantasy with restrained choir, bowed strings,
low percussion, glassy textures

LOOP:
yes

STEMS:
ambient
rhythm
tension

AVOID:
trailer music
modern EDM
cheerful melody

LENGTH:
long-loop gameplay track

STATUS:
REQUESTED
150. AGENTS.MD — NON-NEGOTIABLE RULES

Your coding AI must be told:

AUREVANE AI DEVELOPMENT CONTRACT

1. MASTER_GAME_SPEC describes the FINAL product.
2. Never interpret the full spec as permission to implement everything.
3. Implement ONLY the assigned ticket.
4. Read relevant documentation before coding.
5. Inspect existing code before editing.
6. Server owns authoritative gameplay.
7. UI never calculates authoritative outcomes.
8. Use reusable effects rather than bespoke ability logic whenever possible.
9. Content should be data-driven.
10. Every database schema change requires a migration.
11. Every sensitive table requires an explicit security decision.
12. Never expose service credentials.
13. Economy changes must be transactional.
14. Rewards must be idempotent.
15. All significant combat behavior requires tests.
16. Dungeon generation must be deterministic by seed.
17. Never remove working behavior simply to make implementation easier.
18. Never create giant miscellaneous utility files.
19. Respect feature-module boundaries.
20. Preserve responsive mobile behavior.
21. Respect the Art Bible.
22. Respect the Audio Bible.
23. If art is missing, create an ART_REQUEST.
24. If audio is missing, create an AUDIO_REQUEST.
25. Never introduce unlicensed third-party artwork, music or code.
26. Never copy TheNinjaRPG implementation or assets.
27. Reference games may only inform abstract UX/game-design principles.
28. Run tests, typecheck and lint after each ticket.
29. Explain manual testing steps.
30. Stop when the assigned ticket is complete.
151. FIRST PROMPT TO GIVE YOUR LOCAL AI

Once the documentation exists:

You are the principal implementation engineer for Aurevane.

Aurevane is a persistent online browser-based tactical fantasy RPG.

The complete long-term product is defined in /docs.

I am a beginner and will primarily be vibe coding, so protecting
architecture, code quality, security and project scope is part of
your responsibility.

Before doing anything:

Read:
- AGENTS.md
- docs/MASTER_GAME_SPEC.md
- docs/TECH_ARCHITECTURE.md
- docs/DESIGN_SYSTEM.md
- docs/ART_BIBLE.md
- docs/AUDIO_BIBLE.md
- docs/SECURITY.md
- docs/ROADMAP.md

Then inspect the repository.

Do NOT implement the complete game.

The architecture must anticipate the complete product, including:

- server-authoritative gameplay
- 36 Disciplines
- Discipline Mastery
- Current + mastered Legacy Discipline
- Confluence system
- Soulmarks
- tactical combat
- co-operative quests
- parties of up to three
- seeded progressive Expeditions
- long three-player Deep Expeditions
- 1v1 PvP
- 2v2 PvP
- matchmaking
- guilds
- nations
- economy
- world events
- adaptive music
- sound effects and mute settings
- AI art request pipeline
- owner Master Panel
- content versioning
- staging/production infrastructure

However:

IMPLEMENT ONLY THE CURRENT SPRINT.

Your first task is to design Sprint 0 as individual implementation
tickets.

For each ticket return:

- purpose
- exact scope
- files/modules affected
- implementation approach
- automated tests
- acceptance criteria
- manual verification procedure
- dependencies on other tickets

Do not write code until I explicitly assign the first ticket.
152. THE SINGLE MOST IMPORTANT RULE

The final game is huge.

That's okay.

The mistake would be asking your AI:

Build Aurevane.

Instead:

THE SPEC
defines everything we eventually want.

THE ROADMAP
defines what we build next.

THE TICKET
defines what the AI is allowed to touch today.

That distinction is what gives a vibe-coded project of this scale a chance of staying coherent.

153. FINAL CHARACTER FORMULA

The finished character experience is:

CHARACTER
│
├── Level
├── 4 Attributes
│
├── Current Discipline
│      └── 4 Arts
│
├── Mastered Legacy Discipline
│      └── 2 Borrowed Arts
│
├── Traits
├── Reaction
├── Movement Art
│
├── CONFLUENCE
│      ├── unique pairing Trait
│      └── sometimes unique pairing Art
│
├── Soulmark
│
├── Equipment
│
└── Player strategy

No heirs.

No aging.

No weird lineage bookkeeping.

No giant elemental chart.

Yet the build possibilities are far larger because the systems interact.

154. WHY I THINK THIS VERSION IS MUCH BETTER

The earlier concepts were trying to manufacture depth by adding systems.

This version gets depth from interaction.

A player doesn't need twelve ancestry systems.

They need to wonder:

What if my mastered Frostweaver becomes the Legacy Discipline for my current Stonebinder?

And discover Permafrost.

Then:

What happens if I use a Gravity Soulmark?

Then:

What if this legendary accessory alters created walls?

Then their friend says:

I'm bringing Stormsinger/Cantor. That should work with your terrain build in tonight's Deep Expedition.

Then next week:

Let's rebuild for 2v2 because that team on the leaderboard is countering us.

That is the addictive part of Aurevane I would optimize for: discovery, experimentation, mastery, teamwork and competition.

Not clicking a training button because a timer expired.

Not replacing a dead 47-year-old character with his son.

Not collecting fifteen currencies.

And not copying TheNinjaRPG or Final Fantasy Tactics Advance.

Aurevane should eventually feel like its own game—one where the Current + Legacy + Confluence system becomes the mechanic players associate specifically with it.