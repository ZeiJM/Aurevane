# AUREVANE — Adventurer's Guide: Current Rules Draft

**Status:** Design-stage player-facing Manual draft.

**Updated:** 2026-08-18.

This document translates the currently approved AUREVANE game design into player-facing language. It is intended to seed the future `/manual` experience.

AUREVANE is still in development. Some systems described here are **planned rather than currently playable**. This guide describes the intended rules and identity of the game as currently approved; live availability must always be determined by the actual released build and current News/patch notes.

---

# 1. What Is AUREVANE?

AUREVANE is a persistent browser-based multiplayer tactical fantasy RPG built around a long-lived character rather than short disposable runs.

Your character develops through:

- Character Level and attributes;
- Disciplines and Discipline Mastery;
- tactical Skills;
- equipment and equipment-granted Skills;
- Resonance or Essence build paths;
- a permanent Soulmark-versus-Severance supernatural choice;
- Mantles for Soul-Severed characters;
- quests, world exploration and live events;
- co-op Expeditions;
- PvP;
- professions/economy systems later in progression;
- Rekindling, AUREVANE's long-horizon prestige system.

The game is designed so build identity comes from **what your character can do tactically**, not only from larger damage numbers.

---

# 2. Character Select and Character Profile

After signing in, players enter **Character Select**.

The base account structure is designed around three visible character slots:

```text
Slot 1
Slot 2
Slot 3
```

An occupied slot shows the character's identity/portrait. An empty slot can be used to create a character.

Selecting a character opens that character's **Profile**, which becomes the main build headquarters.

The Profile is intended to contain:

```text
Overview
Attributes
Disciplines
Skills
Supernatural
Equipment
Loadouts
Prestige / Rekindling
```

Persistent build changes are made from the Profile rather than by rebuilding your character inside a battle.

---

# 3. Character Level, Attributes and Derived Stats

AUREVANE uses Character Level alongside a separate Discipline Mastery system.

The core character attributes are:

```text
Might
Finesse
Intellect
Resolve
```

Your personally assigned attribute investment belongs to your character.

Your **Primary Discipline** also provides a base Discipline stat profile. This means changing Primary Discipline changes the combat frame through which your character expresses their build without silently reallocating your personal attribute points.

Conceptually:

```text
Primary Discipline base profile
+
player-assigned attributes
+
equipment
+
temporary effects
=
final combat stats
```

Derived stats may include values such as HP, MP, Armor, Ward, Accuracy, Evasion, Initiative, Movement, Jump and other combat properties as the system matures.

---

# 4. Disciplines

Disciplines are AUREVANE's learned combat traditions.

The active build uses either:

```text
PRIMARY DISCIPLINE ONLY
```

or:

```text
PRIMARY DISCIPLINE
+
SECONDARY DISCIPLINE
```

The old Current/Legacy terminology is retired.

## Primary Discipline

Your Primary Discipline is your principal active combat tradition.

It determines your **base Discipline stat distribution** and gives access to that Discipline's Skill library.

A Discipline does not need to be fully mastered simply to be used as Primary.

## Secondary Discipline

Your Secondary Discipline is an optional mastered Discipline mixed into the build.

A Discipline must normally be fully **Mastered** before it can be equipped as Secondary.

Secondary does not provide a second base-stat profile. Its main value is access to another Skill library and creation of a **Resonance** with Primary.

---

# 5. Discipline Mastery

Disciplines progress through Mastery by legitimately using/studying them.

Current stages are:

```text
Initiate
↓
Practiced
↓
Adept
↓
Expert
↓
Master
```

There is no JP-like pool of generic class points that you spend on any ability you want.

Skills unlock through Mastery milestones, challenges, quests or other authored progression.

At full Mastery, the Discipline becomes eligible for use as a Secondary Discipline.

---

# 6. Changing Primary and Secondary Disciplines

Changing Disciplines is intended to be meaningful rather than something players swap every few seconds.

Current production design default:

```text
Primary Discipline change cooldown:   4 real hours
Secondary Discipline change cooldown: 4 real hours
```

The timers are separate.

Changing Primary starts only the Primary timer.

Changing Secondary starts only the Secondary timer.

Changing both starts both.

The timers continue while offline and are controlled by the server.

Preview/testing tools may allow experimentation without committing the live change or starting the cooldown.

---

# 7. Discipline Skills

Every mature Discipline is planned to contain **8 learnable Skills**.

There are no separate Discipline Ultimates.

A Skill may deal damage, heal, shield, reposition, teleport, create terrain, apply statuses, summon, manipulate resources or provide another tactical effect.

## Pure Discipline build

With Primary only and no Secondary:

```text
8 Discipline Skills may be equipped
+
1 Essence Skill
```

## Mixed Discipline build

With Primary + Secondary:

```text
6 Discipline Skills total
+
1 Resonance passive
```

The six equipped Discipline Skills can come from the two active Discipline libraries according to the current legal loadout rules.

The game will always show which Discipline a Skill came from.

---

# 8. Cooldowns

All normal usable Skills have cooldowns unless a specific authored rule uses another bounded use model.

Cooldowns are server-owned and shown in combat.

The ordinary basic commands are exceptions:

```text
Move
Basic Attack
Guard
```

These do not use normal Skill cooldowns.

The baseline Recover/Heal command is different: current design gives it a **2-own-turn cooldown**.

Cooldowns may later be reduced, extended or interacted with by specific effects, but infinite refresh loops are not intended to exist.

---

# 9. Resonance

**Resonance** is the passive interaction created by combining a Primary Discipline and a Secondary Discipline.

Resonance replaces the former term Confluence.

A Resonance should make the two Disciplines interact mechanically rather than simply grant a generic percentage increase.

Examples of Resonance design space include:

- one Discipline setting up a status that changes the other's payoff;
- movement or displacement triggering a bounded effect;
- a specific Skill sequence producing a bonus;
- healing, guarding, terrain, summons, position, facing or resource use interacting differently.

Resonance is normally **passive**, not another active button.

One core Resonance is generally authored for a Discipline pair, while Primary-vs-Secondary direction still changes base stats and Skill emphasis.

---

# 10. Essence

**Essence** is the pure-Discipline counterpart to Resonance.

A character with no Secondary Discipline may equip one special **Essence Skill** in addition to the normal eight Primary Discipline Skills.

Essence represents the undiluted identity of that one Discipline.

It is not an Ultimate.

Essence follows an important balance rule:

> Higher raw damage leaves less budget for utility/effect. Stronger control, movement, defense, support or battlefield manipulation generally means lower raw damage.

This creates a real choice:

```text
PURE
8 Discipline Skills
+ Essence active Skill

MIXED
6 Discipline Skills
+ Resonance passive
```

Neither route is intended to be universally better.

---

# 11. Equipment Skills

Weapons, armor and shields can provide unique **Equipment Skills** or passive effects.

These exist outside the normal 6/8 Discipline Skill capacity.

Equipment Skills can have their own Action Economy costs and cooldowns and may do unusual things such as:

- movement/repositioning;
- attacks;
- defensive actions;
- terrain interaction;
- setup/payoff combos;
- status effects;
- utility.

Not every piece of equipment grants an active Skill. Many pieces may instead provide stats, passives or action-modifying effects.

Equipment depth should come from build interactions rather than filling the character with dozens of equipment slots.

---

# 12. No Separate Trait, Reaction, Movement Art or Ultimate Systems

Earlier AUREVANE planning used separate Trait, Reaction, Movement Art and Ultimate slots.

Those player-facing slot systems are retired.

Their useful ideas can still exist through:

- Resonance passives;
- Soulmarks;
- equipment effects;
- automatic triggered passives;
- movement-capable Skills;
- powerful long-cooldown Skills;
- Mantle buffs;
- bounded prestige effects.

The goal is deep theorycrafting without forcing players to manage too many independent subsystems.

---

# 13. Extra Skills and the 6/8 Rule

The 6/8 limit applies only to **Discipline Skills**.

Extra Skills explicitly granted by another system use that system's own rules.

Examples include:

- Essence Skill;
- Soulmark Skill;
- Equipment Skill;
- bounded Veteran Edge Skill if one exists.

Mantles are an exception in another direction: Mantles enhance the build but grant **no new active Skills**.

---

# 14. Combo and Sequence Effects

Some passives can reward performing Skills/actions in an authored order.

Examples of possible patterns:

```text
Mark target
→ reposition
→ melee Skill
= bonus effect
```

or:

```text
Guard
→ absorb a frontal hit
→ shield Skill becomes enhanced
```

or:

```text
Scorch
→ displacement
→ Storm-tagged Skill gains a payoff
```

These are readable game rules, not secret keyboard combos.

Sequence state is tracked by the server.

---

# 15. Soulmarks and The Severance

At an early story point, the character eventually reaches a permanent supernatural choice.

The normal states are:

```text
UNAWAKENED
↓
choose
↓
SOULMARKED
or
SOUL-SEVERED
```

## Soulmarked

A normal Soulmarked character may possess **one current Soulmark**.

Soulmarks represent unusual supernatural potential unique to the individual.

They are not the same thing as Disciplines and are not hereditary bloodline classes.

## Soul-Severed

A character who deliberately undergoes **The Severance** permanently rejects Soulmarks through ordinary progression.

The Severed become eligible to pursue **Mantles** instead.

Simply not having reached the supernatural decision yet does not count as being Soul-Severed.

The choice persists through Rekindling.

---

# 16. Soulmark Structure

Soulmarks are deliberately not forced into one template.

A Soulmark branch might provide:

```text
1 passive + 1 Skill
2 passives + no Skill
2 Skills + no passive
1 major passive
1 exceptional long-cooldown Skill
1 passive + 2 smaller Skills
```

A Soulmark may have:

- 1 focused branch;
- 2 branches in most cases;
- 3 branches for rarer/complex designs.

Active Soulmark Skills exist outside the Discipline 6/8 capacity.

---

# 17. Soulmark Design Possibilities

Soulmarks can be among AUREVANE's strangest build systems.

Possible identities include:

- Gravity;
- Flame, Frost, Storm, Shadow, Poison and other elemental/status identities;
- summoning creatures, spirits, constructs, echoes or copies;
- teleportation, portals, swaps and spatial distortion;
- converting eligible Skills into AoE/line/cone/chain patterns;
- infusing existing Skills with an element or status;
- poison/DoT stacking, spreading or detonation;
- unusual healing conversion;
- defensive mutation;
- movement/Jump/verticality changes;
- terrain and zone manipulation;
- combo-sequence effects;
- resource/cooldown relationships under strict caps;
- information concealment or enhanced perception;
- significant risk/reward strengths with genuine weaknesses.

Two Soulmarks do not need to have the same number of buttons or passives to be balanced.

---

# 18. Soulmark Strengths and Weaknesses

Some Soulmarks may deliberately trade a weakness for greater strength.

Examples of the design philosophy:

- stronger Fire power but a meaningful defensive weakness;
- powerful teleport payoff but temporary vulnerability after teleporting;
- excellent poison/DoT pressure but weak immediate burst;
- strong healing conversion but reduced ordinary healing received.

A drawback only counts if it actually matters to the intended build.

The game uses a broader Soulmark power budget considering passives, active Skills, cooldowns, range/area, setup, reliability, scaling, flexibility, drawbacks and counterplay.

The goal is comparable opportunity value, not identical damage output.

---

# 19. Replacing a Soulmark

A Soulmarked character can eventually bind a different eligible Soulmark when the acquisition rules permit it.

Doing so permanently removes the previous Soulmark from that character under ordinary rules.

This is a high-friction confirmed decision and is never intended to happen accidentally.

---

# 20. Soulmark Availability

The architecture is intended to support **100+ Soulmarks over the life of the game**, but quality matters more than reaching that number quickly.

Current content target philosophy:

```text
early proof:       small varied set
broad catalog:     about 24–36
mature catalog:    about 48–72
long-term:         100+ when designs remain distinct
```

Some Soulmarks may come from story, world discoveries, bosses, Expeditions or events.

Some special Soulmarks may exist outside normal acquisition pools and be granted only through exceptional Game Owner actions. These are not part of ordinary progression.

---

# 21. Mantles

Mantles are the supernatural path available to the **Soul-Severed**.

AUREVANE currently plans six normal Mantle identities.

A Mantle is not a second Soulmark and does not grant extra active Skills.

Instead it temporarily **enhances the build you already have**.

Depending on the Mantle, it can temporarily improve or alter things such as:

- damage;
- healing;
- defense;
- Armor/Ward;
- Accuracy/Evasion;
- Initiative;
- Movement;
- Jump;
- HP/MP behavior;
- resource recovery;
- existing Skill effects/tags;
- temporary passive buffs;
- Action Economy/cooldown efficiency within strict limits.

The six Mantles should represent different combat fantasies rather than six versions of `more damage`.

---

# 22. Charging a Mantle

Mantle power has a **charge period**.

The intended state is:

```text
Ready
↓
Invoke Mantle
↓
Charging
↓
Manifested
↓
Afterstrain
↓
Recovered
```

The current baseline design is that the player begins the charge and the Mantle normally becomes active at the start of their next activation.

This creates an anticipation window: opponents can see that a transformation is coming rather than receiving a completely invisible instant power spike.

The exact timing can be tuned per Mantle/mode during testing.

---

# 23. Mantle Manifestation Levels

Mantles have coded invocation levels.

## Level I — Tempered Manifestation

Normally attainable.

Provides a meaningful temporary boost with lighter Afterstrain.

## Level II — Full Manifestation

Advanced normally attainable state.

Provides much greater temporary power with serious Afterstrain.

A player who has earned Level II may still choose Level I when invoking the Mantle.

Higher attainment provides more choices rather than replacing the safer option.

## Level III — Transcendent Manifestation

An exceptional state that exists in the game rules but is **not part of normal player progression**.

If encountered on an Anomaly character or special exhibition ruleset, it represents extreme amplification with severe Afterstrain.

---

# 24. Afterstrain

When a Mantle ends, the character enters **Afterstrain**.

Afterstrain is a temporary vulnerability period and may reduce properties such as:

- Armor/Ward;
- Movement/Jump;
- Accuracy/Evasion;
- healing;
- resource recovery;
- Action Economy efficiency;
- Status Resistance;
- another Mantle-specific property.

Level I has the lightest Afterstrain.

Level II has serious Afterstrain.

Exceptional Level III uses severe Afterstrain.

Mantle timing is therefore about both the power window and surviving what follows.

---

# 25. Minimum Levels for Supernatural Progression

Supernatural systems use minimum Level floors plus other requirements.

Level alone does not automatically grant the feature.

Current design starting points are:

```text
Soulmark Awakening / Severance:
Level 10 minimum + story/combat checkpoint

Additional ordinary Soulmark acquisition:
usually Level 15+ plus its own source requirements

Second Soulmark branch:
typically Level 25+

Rare third branch:
typically Level 50+

First Mantle / Tempered Manifestation I:
Level 20 minimum + Soul-Severed + Mantle rite/source

Full Manifestation II:
Level 60 minimum + Mantle I + advanced progression + difficult rite
```

Specific Soulmarks/Mantles may require substantially higher levels, Horizons, Mastery, story progress or special challenges.

These values are balance defaults and may be tuned before/live after release.

---

# 26. Anomaly Characters

Very rare **Anomaly Characters** may exist through explicit Game Owner intervention.

Anomaly is not a normal progression path.

Anomaly characters may be permitted exceptional combinations unavailable to ordinary characters, such as:

- two active Soulmarks;
- a Soulmark and a Mantle;
- two Mantles;
- exceptional Mantle invocation access.

A Dual-Mantle Anomaly can, under its exceptional rules, have two Mantles active simultaneously after both have legitimately charged.

These combinations are not something normal players can farm, buy or unlock through ordinary progression.

## Anomaly badge

An active Anomaly character receives the visible Profile badge:

> **ANOMALY**

This badge identifies an exceptional character ruleset. It does **not** mean the player is staff and grants no moderation/Owner authority.

Standard Ranked PvP and ordinary official tournaments are designed to reject active Anomaly rules by default unless a special exhibition explicitly allows them.

---

# 27. Information Concealment and Revelation

Some Skills/passives/Soulmarks/equipment effects may alter what opponents can inspect.

Examples may include:

- hiding exact MP;
- hiding selected derived stats;
- showing a broad HP/MP band instead of exact values;
- concealing selected cooldown/equipment information;
- revealing additional information that is normally hidden.

The server always knows the true state.

Information-control effects do not allow illegal actions or client-side cheating.

Important board facts such as position, visible terrain, target legality, objective state and required Mantle telegraphs remain visible according to the active ruleset.

PvP modes may normalize or restrict information-concealment mechanics for readability and fairness.

---

# 28. Tactical Combat Basics

AUREVANE combat is battlefield-first and server-authoritative.

The approved tactical direction uses **100 Action Economy points per normal turn**.

Current baseline costs:

```text
Normal movement:
10 points per normal traversal-cost unit

Rough terrain cost 2:
20 points

Basic Attack:
30 points

Guard:
30 points

Recover:
50 points + 2-own-turn cooldown

Final Facing:
0 points and commits/ends the turn
```

Multiple legal actions can be used while enough Action Economy remains.

Final Facing uses the four cardinal directions:

```text
North
East
South
West
```

Facing matters for directional attacks, defense, positioning and future build interactions.

---

# 29. Movement, Terrain and Battlefield Scale

Battle maps are scenario-driven rather than fixed at one small size.

Approximate design bands include:

```text
Micro / drill:          ~5×3 to 6×5
Duel / small:           ~7×5 to 9×7
Skirmish:               ~9×7 to 12×9
Large / boss/objective: ~12×9 to 16×12+ when validated
```

Map size depends on unit count, movement/range, summons, terrain, elevation, objectives, reinforcements, boss mechanics, flank routes, readability and performance.

Terrain traversal cost feeds directly into Action Economy movement cost.

Movement and Jump are intended to create real tactical access differences, not decorative stat lines.

---

# 30. Retreat, Surrender and Aborting Practice

Different battle types use different exit rules.

Examples include:

- Practice/Tactical Hall: **Abort Exercise** with no normal victory/reward penalty;
- low-stakes PvE: **Retreat**, which counts as a non-victory result and does not award victory rewards;
- PvP: **Surrender / Forfeit**;
- dangerous authored content: possible tactical extraction rules;
- some encounters may not allow voluntary exit.

Disconnecting is not intended to be a cheaper form of retreat.

---

# 31. Tactical Hall and AI Practice

The **Tactical Hall** is the player-facing combat training area.

Players begin with a simple Recruit-level practice opponent and gradually unlock more Tactical Records through legitimate play.

AI Intelligence and raw combat power are separate settings.

A high-level Recruit AI is not the same thing as a lower-level Master AI.

Intelligence grades currently use the design ladder:

```text
Recruit
Trained
Veteran
Elite
Master
```

Stronger AI is intended to be stronger because it reasons better, not because it secretly reads hidden information or receives invisible stat bonuses.

AI must respect information-concealment effects through the same legal knowledge rules as other opponents unless it possesses an explicit perception mechanic.

Practice Arena battles do not normally provide repeatable XP, loot, currency, PvP rating or world-progression rewards.

---

# 32. Wayfarer's Practice

Wayfarer's Practice provides modest offline progression without requiring constant login.

The planned windows are exactly:

```text
Short      ~3 hours
Overnight  ~8 hours
Extended   ~24 hours
```

These durations are tuning defaults controlled by the server.

If you return early, only legitimate elapsed time counts.

If you stay away beyond the chosen window, the selected focus ends and remaining eligible time falls back to Balanced Practice under normal caps.

A planned practice is for the next meaningful absence and is consumed after its Training Report is generated.

Wayfarer's Practice is not intended to replace active play and does not grant professions, event participation or passive item/currency farming.

---

# 33. Long-Horizon Progression and Horizons

AUREVANE's first complete character cycle is intended to be a long journey.

The current production target for the first full endgame/Rekindling eligibility cycle is approximately **180 calendar days minimum**, together with actual gameplay milestones.

Time alone is not enough.

The game uses broad **Horizon** gates so major progression tiers unlock over the long journey without a mandatory daily-energy system.

Characters also need gameplay achievements such as level, story/world progress, Discipline Mastery, advanced build progression and endgame challenges.

---

# 34. Rekindling

**Rekindling** is AUREVANE's voluntary long-horizon prestige system.

The fantasy is not deleting your character. It is completing one version of the character and beginning another long journey while preserving identity, history and selected veteran advantages.

Rekindling is planned to preserve things such as:

- name/identity;
- appearance/cosmetics;
- achievements;
- titles/badges;
- social history;
- Chronicle history;
- Rekindling count;
- Hall of Selves history;
- selected veteran unlocks.

The supernatural fork persists: Soulmarked remains Soulmarked and Soul-Severed remains Soul-Severed under ordinary rules.

---

# 35. Memory Carryover and Veteran Edge

Before Rekindling, the player may eventually choose a limited **Memory Carryover** package so later cycles feel informed without becoming trivial.

AUREVANE also plans a bounded **Veteran Edge** system.

The key prestige rule is:

> Prestige should unlock history, flexibility and tactical options rather than endless raw-stat stacking.

Standard competitive design allows only a bounded Edge slot rather than adding another permanent percentage bonus every Rekindling.

Additional Rekindlings should mostly broaden choices and prestige presentation.

---

# 36. World, Quests and Live Events

AUREVANE is planned as a living strategic world rather than one giant continuously rendered 3D map.

Players travel through regions, settlements, roads, dangerous areas, ruins, dungeons and event spaces.

Live events can change encounters, objectives, NPC states, world conditions and public communications for minutes, hours, days or longer depending on the event.

World Pulse is intended to answer:

> What is happening in the world that matters to my character right now?

Important build power should not permanently disappear merely because a player missed one short event window.

---

# 37. Lore and the Archive

The **Archive** records lore legitimately discovered by the character.

AUREVANE's lore may include:

- primary sources;
- testimony;
- institutional records;
- field observations;
- reconstructed conclusions;
- unresolved contradictions.

Sources may disagree intentionally.

The Manual explains how systems work; the Archive preserves what your character has discovered about the world's history.

---

# 38. Parties and Co-op

Party/co-op systems are planned to support shared tactical play while each player controls their own character.

The social roadmap includes:

- party creation/invites;
- party chat;
- shared objectives/waypoints;
- friend relationships;
- co-op encounter support;
- reconnect-safe multiplayer state.

Core Friends are planned before the mature social-world systems.

---

# 39. Expeditions

Expeditions are planned as deeper cooperative PvE sessions with structured routes, encounters, modifiers and bosses.

Deep Expeditions may use designated Sanctuaries where a run can be suspended and resumed within configured rules.

Loot is planned to be personal so players do not fight teammates over who clicked a reward first.

Higher Threat/deeper routes can improve rewards while increasing encounter difficulty.

Bosses should use authored phases and mechanics rather than only giant HP pools.

---

# 40. PvP

AUREVANE plans first-class competitive tactical PvP including:

```text
Casual 1v1
Ranked 1v1
Casual 2v2
Ranked 2v2
```

Additional tournaments/event formats can arrive later.

PvP uses server-authoritative battle state and competitive rules such as Arena Tempering so progression/build choices still matter without raw equipment numbers making skill irrelevant.

PvP uses **Surrender/Forfeit** rather than ordinary PvE Retreat.

Anomaly builds are rejected by normal ranked/tournament rules by default.

---

# 41. Spectating and the Colosseum

Later PvP development includes a player-facing **Colosseum** and spectator system.

Planned visibility modes include:

```text
Public
Unlisted
Private Key
Closed
```

Spectators receive a dedicated safe projection rather than the full participant state.

Ranked/tournament spectation can use a server-owned delay to prevent real-time information abuse.

Private sparring can use a separate Battle Key rather than placing secret access information in a public URL.

---

# 42. Friends, Social Presence and Notifications

AUREVANE plans a persistent Friends system using stable account relationships while presenting the player's current public character identity.

Relationships include request/accept/decline/cancel/remove/block behavior.

Blocking overrides ordinary invites, DMs and friend-specific presence interactions but is not intended to become ranked-matchmaking avoidance.

The world may show a privacy-safe **Adventurers Online** presence layer using coarse public information rather than exact private position/build data.

Notifications are an attention layer for social requests, messages, News, world events, economy and competitive activity rather than a second copy of canonical content.

---

# 43. Guilds and Nations

Guilds and Nations are later living-world systems.

Guilds are planned to include membership, permissions, chat, contracts, progression and cooperative identity.

Nation affiliation unlocks later rather than being forced during character creation.

Nation systems may support campaign participation through both PvE and PvP contributions.

Important Disciplines should not be permanently locked behind one nation choice.

---

# 44. Equipment, Crafting and Professions

Equipment uses a deliberately manageable core slot structure such as:

```text
Main Hand
Off Hand
Armor
Accessory I
Accessory II
```

Later profession design uses one Craft specialization and one Gathering specialization at a time.

Current planned Craft choices:

```text
Weaponwright
Outfitter
Enchanter
```

Gathering choices:

```text
Prospector
Forager
Tracker
```

Profession progression comes from active use, not passive Wayfarer's Practice.

Crafted gear is intended to be specialized sidegrade buildcraft rather than universally stronger best-in-slot power.

---

# 45. Trade House and Economy

The primary tradable currency is **Crowns**.

A future Trade House uses authoritative escrow/transactions and item provenance to prevent duplication/race exploits.

Important equipment should generally have understandable acquisition paths and bad-luck protection where appropriate.

Referral rewards and similar account-bound rewards are not intended to become tradeable power.

---

# 46. Homestead

The later Homestead system is a persistent personal safe space associated with a nation.

It is planned for:

- rooms/decor;
- trophies;
- expanded non-combat Vault space;
- Workshop convenience;
- visiting/social permissions.

Homesteads are not intended to be raid targets, passive farms or combat-buff engines.

---

# 47. News and Manual

Two public information surfaces are permanent parts of AUREVANE:

```text
/news
/manual
```

News explains what changed and what is happening.

The Manual explains how the released game works.

Both are intended to remain available before and after sign-in.

Rules changes should update the Manual and link from relevant News/patch notes.

---

# 48. Staff and Official Badges

AUREVANE uses exactly four staff authority classes:

```text
GAME OWNER
MODERATOR
CONTENT STAFF
EVENT STAFF
```

Normal players are not staff.

Official Staff Badges indicate role presentation but authority is always checked by the server.

The Game Owner's official badge is **WORLDWRIGHT**.

The **ANOMALY** badge is separate from staff badges and grants no staff authority.

---

# 49. Accessibility and Settings

The game is intended to be fully playable muted and to support responsive desktop/mobile interaction.

Accessibility direction includes:

- keyboard/touch support;
- sufficient contrast;
- semantic UI;
- reduced-motion alternatives;
- no critical information conveyed only by color;
- readable Manual/help content;
- audio channel controls.

---

# 50. Glossary

**Primary Discipline** — your principal active combat tradition and source of your base Discipline stat profile.

**Secondary Discipline** — an optional mastered Discipline mixed into the build.

**Mastery** — progression within a Discipline from Initiate through Master.

**Skill** — an active combat ability from a Discipline, equipment, Soulmark, Essence or another approved source.

**Resonance** — passive interaction produced by combining Primary + Secondary.

**Essence** — pure-Discipline extra active Skill available when Secondary is empty.

**Soulmark** — persistent supernatural identity with one or more branch packages.

**The Severance** — irreversible ordinary rejection of Soulmarks.

**Soul-Severed / the Severed** — character state that can pursue Mantles instead of Soulmarks.

**Mantle** — charged temporary transformation that enhances the existing build and ends in Afterstrain.

**Tempered Manifestation** — Mantle Level I.

**Full Manifestation** — Mantle Level II.

**Transcendent Manifestation** — exceptional coded Mantle Level III, not normal progression.

**Afterstrain** — temporary vulnerability after a Mantle ends.

**Anomaly** — exceptional Game Owner-granted character rules exception; also a visible Profile badge while active.

**Horizon** — broad long-term progression gate.

**Wayfarer's Practice** — bounded offline character training system.

**Rekindling** — long-horizon prestige/reset journey preserving character identity/history.

**Veteran Edge** — bounded prestige tactical-option layer.

**Tactical Hall** — practice/training destination for fighting unlocked AI simulations.

**Tactical Record** — progression record that unlocks an AI opponent/scenario for practice.

**World Pulse** — live contextual summary of what is happening in the shared world.

**Archive** — character-discovered lore collection.

---

# 51. Manual Rule

This document must change whenever a major approved player-facing mechanic changes.

Before release, exact numerical values may still move through validation. Where the live game differs from this design draft, the released game's current published Manual/News/versioned rules are authoritative for players.
