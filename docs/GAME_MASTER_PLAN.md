AUREVANE
Complete Master Game Design, Technical Architecture & AI Implementation Specification
Master Specification v1.1 — Canonical terminology and current-state synchronization
Updated: 2026-08-19

0. CANONICAL SYNCHRONIZATION

This document remains AUREVANE's authoritative master game-design specification.

The 2026-08-19 synchronization incorporates owner-approved design refinements that were previously carried in addenda, implementation decisions, and public-facing content.

Current player-facing build terminology is:

Primary Discipline
Secondary Discipline
Discipline Skill
Equipment Skill
Resonance
Essence / Discipline Essence
Soulmark
The Severance / Soul-Severed
Mantle

The previous player-facing terms Current Discipline, Legacy Discipline, Art, Confluence, separate Trait slots, separate Reaction slots, separate Movement Art slots, and separate Ultimate slots are retired. They may be mentioned only when explaining historical migration or retired concepts.

The mature build-system contract is:

CHARACTER ATTRIBUTES
+
PRIMARY DISCIPLINE
+
OPTIONAL SECONDARY DISCIPLINE
+
DISCIPLINE SKILLS
+
RESONANCE OR PURE-DISCIPLINE ESSENCE
+
SOULMARK OR SOUL-SEVERED MANTLE PATH
+
EQUIPMENT + EQUIPMENT SKILLS
+
BOUNDED PRESTIGE / VETERAN EDGE

Additional authoritative detail lives in docs/GAME_MASTER_PLAN_BUILD_SYSTEM_ADDENDUM.md. If an older subordinate document still uses retired terminology, this master plan and the owner-approved build-system addendum control.

The current universal attribute model contains six attributes:

Might
Finesse
Vitality
Agility
Intellect
Resolve

The current player-facing combat test destination is the Battle Hall. Older references to Tactical Hall are retired unless discussing historical implementation.

Passive Training is the current implemented deliberate offline-training model: players choose server-timed Short, Medium, or Extended plans; longer plans trade hourly efficiency for convenience; training progress is server-owned; active training blocks starting a new battle/live combat entry. Legacy already-materialized training reports remain preserved safely. Long-term rested/catch-up concepts may still be refined, but no document should imply that new characters automatically accrue an always-on offline reward merely by being absent.

A Sprint is a development milestone, not a promised calendar week. AUREVANE advances through acceptance gates rather than public release-date promises.

1. PRODUCT VISION

Aurevane is a persistent online tactical fantasy RPG played in the browser.

Players create a permanent character, explore a living shared fantasy world, study numerous combat Disciplines, master them, choose a Primary Discipline, optionally mix in a mastered Secondary Discipline, discover powerful Resonances between mixed styles or pursue a pure-Discipline Essence, awaken or reject supernatural Soulmark power, acquire build-changing equipment, complete solo and cooperative quests, descend into progressively generated Expeditions, compete in 1v1 and 2v2 tactical PvP, form parties and guilds, eventually pledge themselves to nations and participate in large seasonal conflicts.

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

“What happens if I make this my Primary, mix that mastered Discipline as my Secondary, and build around their Resonance?”

Or:

“What can this Discipline do if I stay pure and lean into its Essence?”

This is the heart of the game.

Tactical combat

Positioning, terrain, timing, ability combinations, team composition and predicting opponents should matter.

Co-operative PvE

Playing with two friends should be a genuinely good experience rather than single-player combat with extra bodies.

Persistent world/social identity

Players should recognize:

famous PvP players;
guilds;
Expedition groups;
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
Explore / Quest / Train / PvP / Expedition / Socialize
  ↓
TACTICAL COMBAT
  ↓
XP + Mastery + Crowns + Equipment + Unlocks
  ↓
Improve / modify build
  ↓
Refine Primary / Secondary / pure-Discipline setup
  ↓
Discover or master Resonance / Essence interactions
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
Unlock Secondary Discipline buildcraft
      ↓
Explore Resonances and pure-Discipline Essence
      ↓
Build specialization
      ↓
Co-op Expeditions
      ↓
Ranked PvP
      ↓
Guild
      ↓
Advanced Disciplines
      ↓
Deep Expeditions
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

There is always another Primary/Secondary pairing, pure Discipline path, Skill configuration, Soulmark/Mantle interaction, or equipment setup to try.

Resonance / Essence discovery

Mixed pairings and pure paths create a collection and experimentation loop worth documenting in the player's Codex/knowledge surfaces.

Mastery

Players gradually master additional Disciplines.

Targeted gear hunting

Specific activities have known reward pools.

Procedural Expeditions

Layouts, encounters and modifiers vary.

PvP seasons

Ranks and metas evolve.

Guild/social activity

Friends create reasons to return.

World events

The world changes.

New Disciplines / Soulmarks / Mantle content

Major updates change build possibilities.

Passive Training and healthy catch-up

Time away should never destroy progress. The current explicit Passive Training model lets players deliberately schedule server-timed training rather than rewarding an opaque always-on absence timer. Future rested/catch-up tuning may supplement this without creating mandatory check-in pressure.

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
one Foundation Discipline as their starting Primary Discipline;
small starting attribute distribution across the six universal attributes.

They do not choose a Soulmark immediately.

The supernatural fork arrives later through authored progression so players first understand the basic game and the permanence of the Soulmarked versus Soul-Severed decision.

7. CHARACTER PORTRAITS

Players may eventually use:

official portraits;
unlocked portraits;
uploaded images;
imported image URLs;
AI-created portraits subject to game rules.

Uploaded assets are copied into controlled storage rather than being permanently hotlinked.

8. CHARACTER ATTRIBUTES

Six core attributes:

Might

Physical force, strength-led offense and related physical scaling.

Finesse

Precision, critical effectiveness and dexterous offensive expression.

Vitality

Maximum HP, stamina/endurance identity and sustained physical resilience.

Agility

Speed, Evasion, Initiative and mobile combat expression.

Intellect

Maximum MP, magical potency, healing and supernatural control.

Resolve

Armor/Ward-facing resilience, status/control resistance and defensive steadiness.

These six are the universal player-assigned attribute axes. Primary Discipline contributes its own base Discipline stat profile without silently rewriting the player's separately assigned attribute investment. Secondary Discipline does not grant a second base-stat profile.

9. DERIVED STATS

Calculated from attributes, Primary Discipline base profile, equipment and effects.

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

11. DISCIPLINE AND BUILD TERMINOLOGY

The class system is called Disciplines.

We are eliminating:

Jobs
Job Points
Job Level

Player-facing terminology is:

Discipline

Your combat profession/style.

Mastery

How experienced you are with that Discipline.

Primary Discipline

Your current principal combat tradition. It defines the active Discipline base-stat profile and does not need to be mastered merely to be used as Primary.

Secondary Discipline

An optional mastered combat tradition mixed into the active build. A Secondary Discipline must normally be legitimately mastered before it can be equipped. It grants no second base-stat profile.

Skill

The player-facing umbrella term for usable authored combat abilities. Origin remains visible through labels such as Discipline Skill, Equipment Skill, Soulmark Skill, Essence Skill, Mantle Skill, and Veteran Edge where applicable.

Resonance

The passive mechanical interaction created by an eligible Primary + Secondary pairing. Resonance replaces the former Confluence terminology and should materially alter how the two Disciplines interact rather than simply add a generic percentage bonus.

Essence / Discipline Essence

The pure-Discipline counterpart to Resonance. A build with Primary only and no Secondary may access one special Essence Skill outside its normal Discipline Skill capacity.

Separate player-facing Trait, Reaction, Movement Skill-slot, and Ultimate subsystems are not part of the mature build model. Their useful design space remains available through Skills, typed passive triggers, Resonance, Soulmarks, equipment, Mantles, and bounded prestige.

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

Important Discipline Skills unlock at milestones.

Some require a Discipline quest or challenge.

At 100%:

DISCIPLINE MASTERED

That Discipline becomes eligible to be equipped as a Secondary Discipline under normal rules.

13. PRIMARY + OPTIONAL SECONDARY DISCIPLINE

This is one of Aurevane's signature systems.

A mature character build is shaped by:

PRIMARY DISCIPLINE
+
OPTIONAL MASTERED SECONDARY DISCIPLINE
+
DISCIPLINE SKILLS
+
RESONANCE OR PURE-DISCIPLINE ESSENCE
+
SOULMARK OR SOUL-SEVERED MANTLE PATH
+
EQUIPMENT + EQUIPMENT SKILLS
+
BOUNDED PRESTIGE / VETERAN EDGE

Primary does not need to be mastered merely to be used as Primary.

Secondary normally must be mastered.

Changing Primary or Secondary is a meaningful live-character commitment. The current production design default is an independent four-real-hour server-authoritative cooldown for each slot, configurable and versioned through the Master Panel. Preview/sandbox systems may allow experimentation without changing persistent live state or bypassing those cooldowns.

14. ACTIVE BUILD

Discipline Skill libraries

Every mature Discipline provides 8 learnable Discipline Skills.

Pure build — Primary only

If Secondary is empty:

up to all 8 learned Discipline Skills from Primary may be equipped;
the build has no Resonance;
the build is eligible for one special Essence Skill outside those eight Discipline slots.

Mixed build — Primary + Secondary

If both are equipped:

the active loadout may equip a total of 6 Discipline Skills from the two active Discipline libraries;
the Secondary must normally be mastered;
the pair generates a Resonance passive;
the pure-path Essence Skill is unavailable while Secondary is equipped.

The total-six mixed cap is locked. The exact permitted Primary/Secondary split inside those six slots may be tuned through validation; the engine must not assume one permanent 4/2 split.

Extra granted Skills

Explicitly tagged Skills from Soulmarks, Equipment, Mantles, Essence, or bounded Veteran Edge rules use their own bounded slots and do not consume the 6/8 Discipline Skill capacity.

Outside the Discipline cap never means unlimited buttons. Each source remains bounded and clearly grouped in the battle UI.

All usable non-basic Skills have cooldowns unless an explicit authored rule defines another bounded use model.

15. RESONANCE — MIXED-DISCIPLINE IDENTITY

Whenever an eligible Primary + Secondary pair is equipped, it produces a Resonance passive.

Resonance is not simply:

+5% damage.

It should alter gameplay and reveal something interesting about how the two traditions interact.

Examples retained from the original pairing design, now expressed as Resonances:

Bastion + Chronist
Temporal Fortress

When you intercept damage for an ally, that ally gains Initiative.

Nightveil + Veilweaver
Phantom Killer

Leaving invisibility may create an illusion on your previous tile that can absorb a bounded attack/event under authored rules.

Cinderweaver + Stormsinger
Arcflash

Storm damage against eligible Scorched targets can chain a bounded effect to another nearby unit.

Frostweaver + Stonebinder
Permafrost

Stone structures created by the build can become frozen and affect nearby enemy movement.

Runeblade + Riftwalker
Rift Edge

A bounded melee setup can begin with a short spatial blink.

Blade Saint + Chronist
Perfect Moment

Patient timing can arm a stronger next eligible triggered response.

Beastbinder + Cantor
Pack Song

Support-song effects can interact more strongly with allied summons.

Ravager + Sanguinist
Crimson Frenzy

Losing HP can create temporary offensive momentum, with healing or another authored condition ending or modifying it.

Dawnshield + Lifebinder
Sacred Mercy

Overhealing can create a bounded barrier.

Nightveil + Hexbinder
Cursed Blade

Striking an eligible Hexed target can extend one authored Hex under bounded rules.

Skywarden + Stormsinger
Thunderfall

Landing after an eligible aerial action creates a bounded storm effect around the landing area.

Edgedancer + Veilweaver
Mirror Riposte

Successful parry-like behavior can create a brief decoy effect.

Loreeater + Wildwarden
Apex Scholar

Monster-derived Skills can gain authored interactions against the creature family from which they originated.

Alchemist + Cinderweaver
Volatile Catalysis

Certain concoction zones can ignite when struck by eligible fire Skills.

Oracle + Hexbinder
Doomed Fate

Foretold enemy failures can amplify the next eligible curse effect.

The preferred content model is one core Resonance per unordered Discipline pair unless a specific design genuinely needs a Primary-dependent clause. Primary/Secondary direction already changes the base-stat profile and active Skill emphasis; the game should not automatically double the entire Resonance authoring matrix.

16. ESSENCE — PURE-DISCIPLINE COUNTERPART

A character who intentionally leaves Secondary empty receives no Resonance.

Instead, the pure build is eligible for one special Essence Skill representing the undiluted identity of its Primary Discipline.

The Essence Skill:

sits outside the normal eight Discipline Skill slots;
exists only while no Secondary Discipline is equipped;
is authored as a strong signature expression of the Discipline;
uses normal server-authoritative Action Economy, targeting, effect and cooldown rules;
is not called an Ultimate.

Resonance versus Essence:

MIXED BUILD
Primary + Secondary
6 Discipline Skills
+ Resonance passive
+ broader cross-Discipline interactions

PURE BUILD
Primary only
8 Discipline Skills
+ 1 Essence Skill
+ no Resonance

Neither route should be globally superior.

17. RESONANCE / ESSENCE ENGINE MUST BE DATA-DRIVEN

Future content storage must model Resonance and Essence as typed, versioned, server-authoritative content rather than bespoke UI code.

A Resonance definition needs concepts such as:

pair identity;
primary/secondary eligibility where direction matters;
name;
description;
trigger;
conditions;
effects;
visual/audio references;
combo sequence where used;
once-per-X/cooldown cap where used;
PvE/PvP tuning;
enabled state;
version.

An Essence definition needs concepts such as:

Discipline identity;
Skill definition;
damage/effect budget;
Action Economy cost;
cooldown;
tags/effects;
visual/audio references;
PvE/PvP tuning;
enabled state;
version.

The Master Panel manages these through typed editors with preview, audit, publish history and rollback.

When a new Discipline is published, the content workflow flags missing Resonance pair coverage and its pure-Discipline Essence coverage.

18. TAG INTERACTIONS

Even without a bespoke Resonance trigger, Skills can interact through typed gameplay tags.

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

Storm Skills may interact with Conductive.

Certain martial Skills exploit Marked.

Blood Skills interact with Bleeding.

Frost may create Frozen terrain.

Fire may remove Frozen but create Steam.

This creates emergent cross-Discipline combinations without recreating an elemental weakness wheel.

19. FINAL DISCIPLINE ROSTER

The full target roster is:

36 Disciplines.

Not all 36 launch in Alpha.

All 36 are designed at the identity level now so architecture anticipates them.

Every mature Discipline ultimately needs 8 learnable Discipline Skills plus its pure-path Essence Skill and appropriate Resonance coverage. The named abilities below are retained as design seeds from the original roster. Any item labeled “Signature Skill concept” originated as an old Ultimate concept but is now simply a candidate powerful cooldown Skill or Essence candidate; there is no separate Ultimate slot system.

20. FOUNDATION DISCIPLINES

1. Vanguard

Balanced armed combat.

Unlock:

Available at character creation.

Innate identity concept:

Combat Readiness — first time each battle the Vanguard becomes adjacent to an enemy, gain Guard under authored balance rules.

Initial Skill concepts:

Cleave
Guard Break
Rush
Brace
Rally

Signature Skill concept:

Heroic Advance

Move and strike through several tiles while granting nearby allies Resolve.

2. Farstrider

Ranged combat and battlefield awareness.

Innate identity concept:

Keen Sight — range penalties are reduced under authored rules.

Initial Skill concepts:

Aimed Shot
Pinning Shot
Scout's Mark
Quickstep
Volley

Signature Skill concept:

Deadeye Barrage

3. Shadehand

Mobility, trickery and opportunism.

Innate identity concept:

Opportunist — bonus effectiveness against Exposed targets under authored rules.

Initial Skill concepts:

Backstab
Feint
Smoke Vial
Cripple
Disengage

Signature Skill concept:

Perfect Opening

4. Ironfist

Unarmed martial combat.

Innate identity concept:

Momentum — successful consecutive attacks build Momentum.

Initial Skill concepts:

Rising Fist
Sweep
Focus Breath
Counter Palm
Breakfall

Signature Skill concept:

Hundredfold Rush

5. Aetherist

Foundation offensive mage.

Innate identity concept:

Arcane Pressure — repeated spell use gradually builds magical pressure.

Initial Skill concepts:

Arc Bolt
Mana Burst
Ward Pierce
Arcane Field
Channel

Signature Skill concept:

Aether Nova

6. Lifebinder

Foundation healing/support mage.

Innate identity concept:

Grace — supporting wounded allies produces Grace, empowering defensive Skills/effects.

Initial Skill concepts:

Mend
Purify
Barrier
Renew
Sanctuary

Signature Skill concept:

Wellspring

21. MARTIAL & HYBRID DISCIPLINES

7. Bastion

Heavy defender.

Requires:

Vanguard Adept.

Initial Skill concepts:

Shield Bash
Cover
Challenge
Intercept
Fortress

Signature Skill concept:

Last Bastion

8. Ravager

High-risk physical attacker.

Requires:

Vanguard Adept.

Initial Skill concepts:

Frenzy
Reckless Cleave
Blood Rush
War Roar
Execution

Signature Skill concept:

Red Tempest

9. Edgedancer

Precision duelist.

Requires:

Vanguard Practiced + Shadehand Practiced.

Initial Skill concepts:

Lunge
Riposte
Disarm
Flourish
Duelist's Step

Signature Skill concept:

Sevenfold Cut

10. Skywarden

Spear-wielding aerial fighter.

Requires:

Vanguard Practiced + Farstrider Practiced.

Initial Skill concepts:

Vault
Impale
High Jump
Skewer Line
Dragonfall

Signature Skill concept:

Heaven's Lance

11. Blade Saint

Patient, disciplined sword master.

Requires:

Vanguard Expert + Ironfist Adept.

Initial Skill concepts:

Iai Draw
Perfect Guard
Crescent Cut
Spirit Sever
Stillness

Signature Skill concept:

One Perfect Stroke

12. Nightveil

Stealth/mobile assassin.

Requires:

Shadehand Adept + Ironfist Practiced.

Initial Skill concepts:

Shadowstep
Shuriken Fan
Smoke Veil
Phantom Clone
Silence Strike

Signature Skill concept:

Vanishing Death

No normal instant-kill mechanics.

13. Wildwarden

Hunter, traps and wilderness control.

Requires:

Farstrider Adept.

Initial Skill concepts:

Snare
Hunter's Mark
Camouflage
Field Remedy
Thornline

Signature Skill concept:

Apex Hunt

14. Beastbinder

Creature partnership.

Requires:

Farstrider Adept + Ironfist Practiced.

Initial Skill concepts:

Call Companion
Pounce Command
Guard Command
Pack Bond
Bestial Surge

Signature Skill concept:

Alpha Covenant

15. Runeblade

Weapon/magic hybrid.

Requires:

Vanguard Practiced + Aetherist Practiced.

Initial Skill concepts:

Arc Edge
Rune Guard
Spell Parry
Siphon Slash
Sigil Step

Signature Skill concept:

Runic Overdrive

16. Dawnshield

Holy protector.

Requires:

Vanguard Adept + Lifebinder Adept.

Initial Skill concepts:

Radiant Strike
Sacred Guard
Purge
Consecrate
Aegis

Signature Skill concept:

Dawn's Oath

17. Dreadblade

Dark offensive knight.

Requires:

Vanguard Adept + Aetherist Adept.

Initial Skill concepts:

Abyss Slash
Blood Price
Dread Aura
Soul Eater
Nightfall

Signature Skill concept:

Black Sun

18. Cantor

Musical battlefield support.

Requires:

Farstrider Practiced + Lifebinder Practiced.

Initial Skill concepts:

Marching Verse
Ballad of Mending
Dirge
Crescendo
Encore

Signature Skill concept:

Grand Chorus

19. Alchemist

Potions, reactions and battlefield chemistry.

Requires:

Shadehand Practiced + Aetherist Practiced.

Initial Skill concepts:

Ember Flask
Acid Vial
Tonic Mist
Transmute
Catalyst

Signature Skill concept:

Grand Reaction

20. Warcaller

Command and team tactics.

Requires:

Bastion Practiced + Cantor Practiced.

Initial Skill concepts:

Formation
Advance
Hold the Line
Focus Fire
Battle Standard

Signature Skill concept:

Sovereign Command

This should be especially powerful in 2v2 and cooperative PvE without becoming mandatory.

22. MAGE DISCIPLINES

There are deliberately many.

A player wanting to make “a mage” should still have a massive range of identities.

21. Cinderweaver

Fire and explosive area control.

Requires:

Aetherist Practiced.

Initial Skill concepts:

Cinder Bolt
Flame Field
Ember Chain
Scorch
Firestorm

Signature Skill concept:

Phoenix Wake

22. Frostweaver

Ice, barriers and slowing.

Requires:

Aetherist Practiced.

Initial Skill concepts:

Ice Lance
Frost Wall
Chilling Mist
Crystal Prison
Shatter

Signature Skill concept:

Absolute Winter

23. Stormsinger

Lightning, wind and mobility.

Requires:

Aetherist Practiced + Farstrider Initiate.

Initial Skill concepts:

Arc Spark
Chain Lightning
Gale Step
Static Field
Thunderhead

Signature Skill concept:

Skybreak

24. Stonebinder

Earth and terrain manipulation.

Requires:

Aetherist Practiced + Vanguard Initiate.

Initial Skill concepts:

Stone Rise
Quake
Earthen Ward
Spire
Seismic Pull

Signature Skill concept:

Mountain's Judgment

25. Tidecaller

Water, mist and fluid battlefield control.

Requires:

Aetherist Practiced + Lifebinder Initiate.

Initial Skill concepts:

Water Lance
Mist Veil
Undertow
Cleansing Rain
Floodline

Signature Skill concept:

Tidal Crown

26. Chronist

Time manipulation.

Requires:

Aetherist Adept.

Initial Skill concepts:

Haste
Slow
Delay
Rewind Step
Time Lock

Signature Skill concept:

Borrowed Hour

Chronists manipulate turn order—not literal full match resets.

27. Riftwalker

Spatial manipulation and teleportation.

Requires:

Aetherist Adept + Shadehand Initiate.

Initial Skill concepts:

Blink
Rift Gate
Spatial Pull
Foldspace
Banish

Signature Skill concept:

Event Horizon

28. Veilweaver

Illusion and deception.

Requires:

Aetherist Practiced + Shadehand Practiced.

Initial Skill concepts:

Decoy
Mirror Image
Confusion
False Terrain
Vanish

Signature Skill concept:

Hall of Mirrors

29. Gravebinder

Necromancy and attrition.

Requires:

Aetherist Adept + Lifebinder Practiced.

Initial Skill concepts:

Soul Drain
Bone Servant
Rot
Soul Chain
Grave Soil

Signature Skill concept:

Procession of the Dead

30. Eidolist

Magical summoning.

Requires:

Aetherist Adept + Lifebinder Adept.

Initial Skill concepts:

Summon Wisp
Guardian Eidolon
Ember Drake
Spirit Pact
Recall

Signature Skill concept:

Grand Invocation

31. Oracle

Fate, prediction and support.

Requires:

Lifebinder Adept + Aetherist Initiate.

Initial Skill concepts:

Foretell
Misfortune
Fate Shield
Premonition
Rewrite

Signature Skill concept:

Providence

32. Hexbinder

Curses and debuffs.

Requires:

Aetherist Practiced + Shadehand Adept.

Initial Skill concepts:

Weakening Hex
Silence Curse
Misery
Mark of Ruin
Curse Spread

Signature Skill concept:

Malediction

33. Sanguinist

Blood magic and HP manipulation.

Requires:

Lifebinder Practiced + Aetherist Adept.

Initial Skill concepts:

Blood Spear
Life Tap
Crimson Shield
Hemorrhage
Blood Pact

Signature Skill concept:

Red Communion

34. Loreeater

Learns supernatural Skills from monsters.

Requires:

Farstrider Practiced + Aetherist Practiced.

Initial Skill concepts:

Study Prey
Capture Trait
Borrowed Roar
Monster Skin
Adapt

Signature Skill concept:

Chimera Memory

This produces an entire monster-hunting collection loop.

35. Starcaller

Astral/gravitational high magic.

Requires:

Aetherist Master + Chronist Adept + Riftwalker Adept.

Initial Skill concepts:

Starfall
Gravity Lens
Comet Step
Astral Ward
Constellation

Signature Skill concept:

Celestial Rupture

36. Spellwright

Endgame metamagic Discipline.

Requires:

Aetherist Master + mastery of any three specialist magical Disciplines.

Spellwright doesn't merely provide stronger spells.

It manipulates other spells.

Initial Skill concepts:

Spell Stitch
Dual Weave
Rewrite Cost
Echo Cast
Counterspell Matrix

Signature Skill concept:

Grand Formula

23. THE SUPERNATURAL FORK

Disciplines are learned combat traditions.

Supernatural identity is a separate character layer.

A character eventually reaches a permanent supernatural decision point with three conceptual states:

UNAWAKENED

Has not yet made the permanent supernatural choice. This temporary state cannot be exploited for Mantle access.

SOULMARKED

Accepted a Soulmark. Under ordinary rules, this character can never become Soul-Severed or acquire/manifest a Mantle.

SOUL-SEVERED

Underwent The Severance. Under ordinary rules, this character can never bind a Soulmark and may instead pursue Mantles.

Approved terminology:

The Severance — the irreversible rite/decision.
Soul-Severed — formal state/adjective.
the Severed — natural shorthand.

The choice is explicit, heavily confirmed, server-authoritative, auditable, and not reversible through ordinary respec systems.

24. SOULMARKS

Soulmarks represent persistent supernatural identity unique to the character.

A Soulmarked character may have one current Soulmark.

Soulmark branches are not forced into one universal template. Some focused Soulmarks may have one branch, most may have two, and rare/complex Soulmarks may have three. A branch may grant passives, Skills, or a deliberately balanced combination.

Potential long-term Soulmark identities include concepts such as:

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

The architecture must support 100+ Soulmarks over the lifetime of the game without schema redesign, but quality matters more than reaching a marketing number. A first broad release should prefer a smaller set of strong, distinct identities over shallow percentage variants.

Soulmarks are not hereditary.

No bloodline system.

Soulmark Skills sit outside the 6/8 Discipline Skill cap but remain bounded by the active branch and normal server-authoritative combat legality/cooldowns.

Because Soulmarks have combat effects, combat Soulmark ownership/power is not sold as cash-only or premium-only power under the current anti-pay-to-win policy. Cosmetic Soulmark presentation may be monetized.

25. RESONANCE / ESSENCE / SOULMARK / MANTLE DISTINCTION

These systems must remain distinct.

Resonance

Requires Primary + Secondary; passive; expresses interaction between two learned Disciplines.

Essence

Requires Primary only / no Secondary; grants one special pure-path Skill outside the eight Discipline Skills; expresses the undiluted identity of one Discipline.

Soulmark

Requires the Soulmarked path; persistent supernatural identity; branch-defined package of passives and/or Skills; one current Soulmark only.

Mantle

Requires the Soul-Severed path; temporary manually manifested combat transformation; mature target of six distinct Mantles; creates a major temporary power/stat/rule shift followed by a readable Afterstrain/vulnerability period.

Soulmarks and Mantles are mutually exclusive ordinary character paths.

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

The baseline combat contract is server-authoritative and tactical.

Normal turns preserve a readable movement/action economy rather than becoming a generic client-calculated action-point sandbox. The exact current implementation contract is defined in docs/COMBAT.md and its approved addenda/tests.

Skills may alter movement, targeting, timing, or other bounded rules through typed effects.

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

Movement-capable Skills provide interesting exceptions.

30. HEIGHT

Height matters, but should remain intuitive.

It can influence:

sight;
projectile trajectories;
certain ranges;
Jump/mobility Skills;
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

That means adding a Skill normally means configuring effects rather than writing a custom combat function.

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

38. EXPEDITIONS

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

At designated Sanctuaries, a party may suspend the run.

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

Players don't see the entire Expedition immediately.

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

Expedition loot is individual.

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

53. 2V2 SYNERGY IS WHERE RESONANCE BECOMES AMAZING

Example team:

Bastion Primary / Chronist Secondary
+
Cinderweaver Primary / Stormsinger Secondary

Bastion controls the map.

Chronist changes timing/tempo interactions.

Cinderweaver Scorches enemies.

Stormsinger enables Arcflash-style Resonance payoff.

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

No core Discipline progression locked behind high rank.

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
Expeditions;
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

Fast token movement updates use Realtime Broadcast, while Presence is best used for slower status such as online/offline or the region/page the player occupies.

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
guild Expeditions;
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
Expeditions;
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

After moving four tiles, your next ranged Skill gains +1 range under authored balance rules.

Very interesting:

When you teleport through an enemy, apply Exposed under authored rules.

Equipment should encourage builds.

Weapons, armor, and shields may grant Equipment Skills. Equipment Skills sit outside the 6/8 Discipline Skill cap but use the same targeting, Effect Catalog, Action Economy, cooldown, forecast, AI-legality and server-authority framework as other Skills.

Not every item should grant an active Skill. Accessories should default toward passive/effect identity unless specifically approved.

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

Rekindling remains the long-horizon prestige direction. It should reward history, flexibility, options and identity rather than infinite raw stat inflation. Strong candidate rewards include Hall of Selves / Chronicle history, bounded Memory Carryover, one bounded Veteran Edge slot in modes where allowed, loadout convenience, cosmetic/challenge content and mentorship/knowledge systems.

The Soulmarked versus Soul-Severed supernatural choice persists across Rekindling unless a future explicit story system says otherwise.

76. AUDIO IS A FIRST-CLASS SYSTEM

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

This can make a procedurally structured Expedition feel authored.

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
Resonance discovery;
Essence unlock;
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
Soulmark/Mantle art;
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

88. DUNGEON / EXPEDITION PROMPTS

Template:

Dark fantasy tactical Expedition environment, [THEME], modular architectural language suitable for grid-based tactical encounters, clear navigable floor space, dramatic practical lighting, atmospheric depth, premium hand-painted fantasy game art, original architecture, no text.

89. ITEM PROMPTS

Template:

Isolated fantasy RPG inventory item, [ITEM], elegant original silhouette, premium material rendering, centered orthographic presentation, subtle magical detail appropriate to rarity [RARITY], transparent or clean neutral background, no text, no hand holding item.

90. SOULMARK / MANTLE PROMPTS

Soulmark icons should be:

highly distinctive;
symbolic;
easy to recognize at 32px;
beautiful at large size.

Mantles should have equally distinct transformation silhouettes and state readability.

Do not create detailed mini-paintings that become unreadable icons.

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
Popular Primary Disciplines
Popular Secondary Disciplines
Popular Resonances
Pure-Discipline / Essence usage
Soulmark Usage
Mantle Usage

93. MASTER PANEL — CHARACTER CONTENT

Owner editors include:

Discipline Editor
Skill Editor
Resonance Editor
Essence Editor
Soulmark Editor
Mantle Editor
Item Editor
Equipment Set Editor
Prestige/Veteran Edge controls where applicable

94. RESONANCE / ESSENCE EDITORS

Especially important.

Example Resonance authoring:

PRIMARY:
Cinderweaver

SECONDARY:
Stormsinger

Name:
Arcflash

Trigger:
Storm damage against Scorched

Effect:
Chain bounded damage/effect to nearest valid enemy

Cooldown/cap:
Once per actor turn where authored

VFX:
plasma-chain-01

PvP coefficient:
versioned balance value

Publish.

No TypeScript edit required.

The Essence editor similarly controls the per-Discipline pure-path Skill, damage/effect budget, Action Economy cost, cooldown, tags/effects, visuals, PvE/PvP tuning, versioning and publish/rollback.

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

Audio management lives alongside content.

No developer should be required merely to replace a town song.

98. MASTER PANEL — LIVE OPS

Owner controls:

announcements;
seasonal events;
XP modifiers;
Mastery modifiers;
Expedition events;
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
Specific Skill
Specific Soulmark
Specific Resonance
Specific Essence
Specific Mantle
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
Common Secondary pairing
Common Resonance
Pure/Essence usage
Common Soulmark or Mantle path
Common Equipment

Resonances and Essences receive appropriate analytics.

102. AUTOMATED SIMULATION

Eventually:

SIMULATE

Bastion Primary + Chronist Secondary
vs
Nightveil Primary + Hexbinder Secondary

10,000 matches

Return statistical results.

AI may summarize.

AI is never allowed to automatically rebalance live content.

Owner approves balance changes.

103. SERVER ARCHITECTURE — BUILT PROPERLY FROM DAY ONE

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

Sensitive tables exposed through Supabase must use appropriate Row Level Security, and privileged service credentials must never reach the browser.

110. AUTHORITATIVE ACTION FLOW

Example battle action:

PLAYER
↓
Use Skill: Thunderfall-enabled action
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

Use Broadcast for fast gameplay/event messages and Presence for slower online/status context.

114. PRESENCE

Presence holds slower state:

online
current_region
party
status
last_seen

Do not use Presence as the authoritative movement state.

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

Do not put massive simulation jobs inside request-response functions.

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

Cloud test environment used to test deployments.

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

119. YOU DO NOT NEED ONE RUNNING SERVER PROCESS PER BATTLE

Because Aurevane is turn-based, authoritative battle state can be persisted and processed as discrete validated actions.

This considerably simplifies hosting while still giving clients immediate updates through Realtime.

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
Expedition completion
Position legality
Drop result
Marketplace transaction
Primary/Secondary cooldown completion
Passive Training completion

Everything sensitive is validated server-side.

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
Primary/Secondary pairings
Resonances used/discovered
Pure/Essence usage
Soulmark/Mantle path usage
Quest completion
Expedition abandonment room
Expedition wipe location
PvP surrender rate
Average battle turns
Matchup win rates
Returning players
Party formation
Guild participation
Passive Training usage and completion

125. THE FUN / RETENTION ENGINE

The major repeating goals:

"One more Mastery milestone."

"One more room."

"I want that item."

"I want to try this Resonance."

"What does this Discipline feel like pure with its Essence?"

"We nearly killed the boss."

"One more ranked game."

"My friend just logged on."

"I finally unlocked Starcaller."

"I need the monster-derived Skill from that boss."

"We're one win from Diamond."

"Our guild needs this objective."

"There's a world event happening."

That's the kind of compelling loop I want.

126. BLUEPRINT FOR SESSION LENGTHS

Aurevane should support:

5-minute session
inventory;
Mastery check;
Passive Training check/plan management;
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
cosmetic Skill effects;
emotes;
title packs;
character slots;
supporter packs;
premium seasonal pass.

Never sell:

dominant PvP gear;
permanent stat advantage;
exclusive meta-defining Disciplines;
combat-exclusive Soulmark/Mantle power.

128. SEASON PASS

Free and premium paths.

Primarily:

cosmetics;
profile themes;
portrait frames;
Soulmark/Mantle cosmetic VFX;
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

This is the actual high-level build order.

A Sprint means:

a development milestone, not necessarily a fixed calendar week.

The project does not proceed past a gate until acceptance criteria pass.

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

Current state: engineering foundation is substantially implemented and the project is operating through production-style GitHub/Supabase/Vercel workflows.

131. PHASE 1 — FIRST CHARACTER & PROGRESSION FOUNDATION

Core milestones include:

authentication UI;
character schema;
character creation;
character profile/build headquarters foundation;
six-attribute model;
stats/progression;
Foundation Discipline framework;
Mastery framework;
Primary Discipline foundation;
character/account controls;
server-authoritative Passive Training;
profile/title/presence quality-of-life.

Gate:

Create and maintain a character, progress Discipline Mastery, and exercise the progression foundation safely.

Current state: foundation implemented and iterated through player-validation feedback; further polish/content expansion continues through later phases.

132. PHASE 2 — COMBAT VERTICAL SLICE

Core milestones:

Effect engine;
tactical board;
movement/elevation;
turn/action-economy engine;
combat actions/statuses;
enemy AI;
rewards;
combat presentation/audio/VFX;
Battle Hall;
AI Sparring;
forecasting/readability;
combat log;
reconnect/server-authority hardening;
mobile/responsive battle usability.

Gate:

A beautiful, readable, server-authoritative complete PvE fight that survives real player validation.

Current state: active validation/iteration focus. Automated green tests do not substitute for human player-validation PASS.

133. PHASE 3 — BUILDCRAFT IDENTITY

Implement and validate:

Primary Discipline commitment and base-stat profiles;
optional mastered Secondary Discipline;
independent live Discipline-change cooldowns;
8-Skill pure Discipline capacity;
6-Skill mixed Discipline capacity;
first complete Discipline Skill libraries;
Resonance framework;
first Resonance library;
pure-Discipline Essence framework and first Essence Skills;
Character Profile build configuration;
Skill cooldown/readability rules;
first supernatural fork/Soulmark proof where appropriate to progression.

Gate:

A player can meaningfully choose between a pure Primary + Essence build and a Primary + mastered Secondary + Resonance build, configure Skills, enter combat, and understand why the build behaves differently.

This is the moment Aurevane's signature theorycraft loop becomes fully visible.

134. PHASE 4 — CORE CONTENT

Implement six Foundations plus first advanced group, including the original target identities:

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

Each playable Discipline needs sufficient Skill-library content, pure Essence coverage, relevant Resonance coverage, AI rules, VFX/SFX and PvE/PvP validation appropriate to the stage.

Do not delay testing until all 36 exist.

135. PHASE 5 — WORLD

World map / Atlas;
movement/presence;
towns/settlements;
encounters;
NPC/dialogue;
quest engine;
initial story;
world-event foundations;
regional presentation.

136. PHASE 6 — PARTY & CO-OP

Parties;
party realtime;
co-op battles;
shared quests;
party finder;
party UX;
reconnect handling.

Gate:

Three people can complete a mission together and each player retains control of their own character.

137. PHASE 7 — EXPEDITIONS

Dungeon/Expedition template engine;
seeded generation;
progressive reveal;
Easy Expeditions;
Standard Expeditions;
Threat/modifiers;
suspension/reconnect;
Deep Expeditions;
multiphase bosses;
personal loot/leaderboards.

Gate:

A three-player, roughly hour-scale Deep Expedition is fully playable and resumable under its authored rules.

138. PHASE 8 — PVP

Direct challenges;
Casual 1v1;
Ranked 1v1;
Arena Tempering;
Casual 2v2;
Ranked 2v2;
matchmaking;
disconnect protection;
seasons;
tournament framework;
competitive telemetry and anti-abuse.

139. PHASE 9 — FULL DISCIPLINE ROSTER

Implement remaining Disciplines in batches.

Every mature new Discipline must include:

Primary base-stat profile;
8 learnable Discipline Skills;
pure-path Essence Skill;
Resonance coverage with the released roster;
AI usage rules;
VFX;
SFX;
PvP tests;
PvE tests;
analytics hooks;
Master Panel content support.

Eventually reach all 36.

140. PHASE 10 — SOCIAL WORLD

guilds;
friends;
messages;
guild quests;
guild progression;
social profile;
moderation;
recognition surfaces for notable players/builds/teams.

141. PHASE 11 — ECONOMY

stores;
loot;
marketplace;
crafting;
economic telemetry;
transactional exploit protection.

142. PHASE 12 — NATIONS

allegiance;
reputation;
nation quests;
campaigns;
nation warfare;
political rankings;
PvE and PvP contribution paths.

143. PHASE 13 — MASTER PANEL

Some admin functionality exists earlier.

This phase builds the complete owner experience:

content editors;
Discipline/Skill editors;
Resonance editor;
Essence editor;
Soulmark/Mantle editors;
quest editor;
Expedition editor;
event editor;
audio manager;
Asset Studio;
balance dashboards;
simulation;
economic analytics;
moderation;
feature flags;
version rollback;
audit and publish workflows.

144. PHASE 14 — ART & AUDIO POLISH

Dedicated production pass.

Not:

add more features.

Instead:

region artwork;
character art;
Discipline artwork;
Soulmark/Mantle art;
soundtrack;
ambient audio;
SFX;
transitions;
particles;
animations;
responsive polish;
loading states;
error states;
accessibility/readability polish.

145. PHASE 15 — HARDENING

penetration/security review;
abuse testing;
rate limits;
SQL/index optimization;
load testing;
matchmaking load;
Realtime load;
Expedition concurrency;
economic exploit testing;
reconnect/failure-mode testing;
content rollback drills.

146. CLOSED ALPHA

Alpha target remains a substantial, evolving gate rather than a date promise.

Target shape:

16 Disciplines
8 Soulmarks for the initial Alpha supernatural set
Resonance coverage sufficient to make mixed builds genuinely varied
pure-Discipline Essence coverage for the playable roster
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
Master Panel foundation
full audio coverage for the Alpha experience
strong visual presentation

That is already a substantial game.

147. THE AI MUST KEEP DOCUMENTATION

Repository documentation includes or should include:

/docs/GAME_MASTER_PLAN.md
/docs/GAME_MASTER_PLAN_BUILD_SYSTEM_ADDENDUM.md
/docs/TECH_ARCHITECTURE.md
/docs/DISCIPLINES.md
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

Do not invent a non-existent documentation filename merely because an older plan referenced it. When a legacy document name is retired, update links and authoritative indexes rather than preserving phantom paths.

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

1. GAME_MASTER_PLAN describes the FINAL product.
2. Never interpret the full spec as permission to implement everything.
3. Implement ONLY the assigned ticket.
4. Read relevant documentation before coding.
5. Inspect existing code before editing.
6. Server owns authoritative gameplay.
7. UI never calculates authoritative outcomes.
8. Use reusable typed effects rather than bespoke Skill logic whenever possible.
9. Content should be data-driven.
10. Every database schema change requires a migration.
11. Every sensitive table requires an explicit security decision.
12. Never expose service credentials.
13. Economy changes must be transactional.
14. Rewards must be idempotent.
15. All significant combat behavior requires tests.
16. Expedition generation must be deterministic by seed.
17. Never remove working behavior simply to make implementation easier.
18. Never create giant miscellaneous utility files.
19. Respect feature-module boundaries.
20. Preserve responsive mobile behavior.
21. Respect the Art Bible.
22. Respect the Audio Bible.
23. If art is missing, create an ART_REQUEST.
24. If audio is missing, create an AUDIO_REQUEST.
25. Never introduce unlicensed third-party artwork, music or code.
26. Never copy another game's implementation or assets.
27. Reference games may only inform abstract UX/game-design principles.
28. Run tests, typecheck and lint after each ticket.
29. Explain manual testing steps.
30. Stop when the assigned ticket is complete unless the active execution mandate explicitly authorizes continuing through the next verified release step.

151. FIRST PROMPT TO GIVE A LOCAL AI

Once the documentation exists:

You are the principal implementation engineer for Aurevane.

Aurevane is a persistent online browser-based tactical fantasy RPG.

The complete long-term product is defined in /docs, led by docs/GAME_MASTER_PLAN.md and the authoritative addenda indexed by AGENTS.md.

Before doing anything:

Read:
- AGENTS.md
- docs/GAME_MASTER_PLAN.md
- docs/GAME_MASTER_PLAN_BUILD_SYSTEM_ADDENDUM.md
- docs/TECH_ARCHITECTURE.md
- docs/DESIGN_SYSTEM.md where present
- docs/ART_BIBLE.md
- docs/AUDIO_BIBLE.md
- docs/SECURITY.md
- docs/ROADMAP.md

Then inspect the repository.

Do NOT implement the complete game.

The architecture must anticipate the complete product, including:

- server-authoritative gameplay
- six universal attributes
- 36 Disciplines
- Discipline Mastery
- Primary Discipline + optional mastered Secondary Discipline
- 8 pure / 6 mixed Discipline Skill capacity
- Resonance for mixed builds
- pure-Discipline Essence
- Soulmark versus Soul-Severed/Mantle supernatural path
- tactical combat
- Battle Hall and AI Sparring validation surfaces
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

IMPLEMENT ONLY THE CURRENT SPRINT/TICKET unless the active execution mandate explicitly authorizes a wider verified release workflow.

For implementation work, define:

- purpose
- exact scope
- files/modules affected
- implementation approach
- automated tests
- acceptance criteria
- manual verification procedure
- dependencies

152. THE SINGLE MOST IMPORTANT RULE

The final game is huge.

That's okay.

The mistake would be asking an AI:

Build Aurevane.

Instead:

THE SPEC
defines everything we eventually want.

THE ROADMAP
defines what we build next.

THE TICKET
defines what the AI is allowed to touch today.

That distinction is what gives a project of this scale a chance of staying coherent.

153. FINAL CHARACTER FORMULA

The finished character experience is:

CHARACTER
│
├── Level
├── 6 Attributes
│   ├── Might
│   ├── Finesse
│   ├── Vitality
│   ├── Agility
│   ├── Intellect
│   └── Resolve
│
├── Primary Discipline
│   └── base Discipline stat profile
│
├── Optional mastered Secondary Discipline
│
├── Discipline Skills
│   ├── Pure: up to 8 Primary Discipline Skills
│   └── Mixed: 6 total Discipline Skills across Primary + Secondary
│
├── Build identity
│   ├── Pure: Essence Skill
│   └── Mixed: Resonance passive
│
├── Supernatural path
│   ├── Soulmarked: one Soulmark + active branch package
│   └── Soul-Severed: Mantle access
│
├── Equipment
│   └── stats / passives / bounded Equipment Skills
│
├── Bounded prestige / Veteran Edge where allowed
│
└── Player strategy

No heirs.

No aging.

No weird lineage bookkeeping.

No giant elemental chart.

No separate clutter of Trait, Reaction, Movement Art, or Ultimate loadout systems.

Depth comes from systems interacting cleanly.

154. WHY THIS VERSION IS BETTER

The earlier concepts were trying to manufacture depth by adding systems.

AUREVANE should get depth from interaction.

A player doesn't need twelve ancestry systems or six separate ability-slot taxonomies.

They need to wonder:

What if I make Stonebinder my Primary and equip my mastered Frostweaver as Secondary?

What Resonance does that pairing unlock, and how does Stonebinder's Primary base-stat profile change the result compared with reversing the pair?

Then:

What happens if I stay pure Stonebinder instead and build around its Essence Skill?

Then:

How does my Soulmark—or, on a different character path, a timed Mantle—change the plan?

Then:

What if this legendary accessory alters created walls or grants an Equipment Skill that changes my positioning?

Then their friend says:

I'm bringing Stormsinger Primary with Cantor Secondary. That should work with your terrain build in tonight's Deep Expedition.

Then next week:

Let's rebuild for 2v2 because that team on the leaderboard is countering us.

That is the compelling part of Aurevane to optimize for: discovery, experimentation, mastery, teamwork and competition.

Not clicking a button because a predatory streak timer demands it.

Not replacing a dead aging character with an heir.

Not collecting fifteen currencies.

And not copying another game's implementation or assets.

Aurevane should eventually feel like its own game—one where Primary/Secondary buildcraft, Resonance versus Essence, tactical combat, supernatural identity, equipment interactions, co-op Expeditions and competitive play form a recognizable whole.

BATTLE LOG IDENTITY + SHORT SKILL NARRATION CONTRACT (2026-08-24)

Battle history remains a presentation projection over committed server-authoritative events. PvP and spectator battle-log surfaces must resolve both actor and target from authoritative participant metadata (`combatantId -> characterName`); a `character:` prefix alone never proves that the combatant is the local viewer. This convention exists to prevent self-attribution bugs in player-vs-player logs.

Player-facing entries prioritize immediate comprehension: who acted, what happened, who was affected, the important outcome, and concise status lifecycle. Useful optional tactical detail uses explicit labels such as `HP remaining`, `hit chance`, and `consecutive timeouts`; raw engine vocabulary, basis points, sentinel durations, RNG data, and state-machine labels remain hidden. Natural status expiration is a quiet standalone lifecycle event rather than unexplained detail attached to another action.

Versioned Skill content may include optional short `hit`, `miss`, and future authoritative `critical` narration using the allow-listed `{actor}`, `{target}`, `{ability}`, and `{damage}` tokens. Generic narration is mandatory fallback. Authored text never determines combat outcomes. The later Master Panel Skill editor must edit this same contract with validation/preview/versioning rather than requiring a new battle-log architecture.
