# AUREVANE Combat Design Bible

**Status:** Canonical combat source of truth for implementation and content work.

**Initial direction approved:** 2026-08-15.  
**PV-1F rules revision approved:** 2026-08-18.  
**Terminology synchronization:** 2026-08-19.

This document defines the current AUREVANE combat baseline. When older tickets, tests, prose, screenshots, or historical documents conflict with this file, **this file wins unless the Owner explicitly approves a later change**.

The full pre-PV-1F combat bible is preserved at [`COMBAT_PRE_PV1F_REFERENCE.md`](./COMBAT_PRE_PV1F_REFERENCE.md). That snapshot is intentionally historical. Its former Sections 2–9 are superseded by this document. Its later advanced concepts remain reference material only where they do not conflict with this file, `docs/GAME_MASTER_PLAN.md`, `docs/GAME_MASTER_PLAN_BUILD_SYSTEM_ADDENDUM.md`, or a later Owner-approved domain document.

Current build terminology follows the Master Plan:

- Primary Discipline;
- optional mastered Secondary Discipline;
- Skills as the player-facing ability umbrella;
- Resonance for the passive mixed-Discipline interaction;
- Essence for the pure-Discipline special Skill;
- Soulmark or Soul-Severed/Mantle supernatural path;
- Equipment Skills where equipment grants an active ability.

The former player-facing terms Current Discipline, Legacy Discipline, Art, Confluence, and separate Trait / Reaction / Movement Art / Ultimate slot systems are retired from current design instructions.

---

## 1. North Star

AUREVANE combat is a **persistent multiplayer tactical RPG combat system**, not a disposable minigame.

The intended experience combines:

- readable grid tactics;
- meaningful positioning, terrain, elevation, and facing;
- stat-driven buildcraft;
- Primary/Secondary Discipline choices, Skills, Resonance or Essence, supernatural identity, and equipment;
- typed passive/triggered responses without requiring a separate player-facing Reaction slot system;
- server-authoritative multiplayer outcomes;
- deterministic or server-owned resolution where required;
- strong audiovisual feedback;
- enough tactical choice that players remember *why* a decision mattered;
- a baseline interaction model that is understandable before advanced systems arrive.

The engine may eventually support very deep content, but the player-facing turn grammar must remain legible.

---

## 2. Core Authority Boundary

The browser sends **intent**, never authoritative outcomes.

The server owns and validates at minimum:

- battle lifecycle and version;
- active combatant and turn order;
- Action Economy remaining;
- movement paths and terrain traversal cost;
- elevation and jump legality;
- target and range legality;
- accuracy/evasion and defense rules;
- damage, healing, mitigation, statuses, and durations;
- Skill costs, cooldowns and requirements;
- passive/triggered response resolution;
- Resonance/Essence legality and effects when implemented;
- final facing and turn completion;
- Recruit/AI decisions;
- RNG and deterministic seeds where applicable;
- idempotency and duplicate-request handling;
- rewards, progression, and battle terminal state.

Client previews are informational. A preview never spends resources or proves that a later stale command may commit.

---

## 3. Standard Turn Economy

**PV-1F supersedes the earlier `MOVE + one ACTION` validation model.**

A normal actor turn begins with **100 Action Economy (AE)** unless an authoritative rule modifies the starting value.

Current baseline costs are:

```text
Inspect                         0 AE
Move, normal traversal unit    10 AE
Move, terrain cost 2           20 AE
Basic Attack                   30 AE
Guard                          30 AE
Recover                        50 AE
Final Facing                    0 AE and ends the turn
```

Movement and actions draw from the **same** 0–100 economy. There is no second generic Movement Budget bar and no player-facing binary `Action Ready / Action Spent` rule in this rules version.

Multiple legal commands may occur during one turn while enough AE remains. Examples include:

- move → Basic Attack → move;
- Basic Attack → Basic Attack when both attacks are legal and affordable;
- Guard → movement;
- Recover → movement;
- movement through a mixture of normal and rough terrain.

The action list is not limited to these baseline actions forever. Discipline Skills, Equipment Skills, Soulmark/Essence/Mantle Skills, combat items, interactions, scenario commands, equipment effects, and future systems can define authored/versioned AE costs through the same server-authoritative pipeline.

### Economy invariants

- Normal turns start at 100 AE unless an explicit authoritative effect changes the start value.
- AE cannot be spent below zero.
- A command cannot commit when its cost exceeds remaining AE.
- Failed or illegal commands do not silently spend AE.
- Previews never spend AE.
- Successful commits spend their authoritative cost exactly once.
- A repeated idempotent request replays the committed result rather than charging twice.
- Double-clicks cannot create duplicate authoritative outcomes.
- Refunds, bonus AE, free actions, and extra turns must be explicitly authored, bounded, tested, and logged.
- Recursive action/turn generation is forbidden unless a deliberately exceptional future rule is specifically approved and protected by hard limits.

---

## 4. Movement & Terrain

Movement spends AE according to **authoritative traversal cost**.

The current baseline is:

```text
Open / normal ground    traversal cost 1  => 10 AE per tile entered
Rough ground            traversal cost 2  => 20 AE per tile entered
Blocked terrain          illegal unless a movement rule permits it
```

The client may display reachable tiles, red/green legality, a path trail, terrain cost, and resulting remaining AE before confirmation. The server revalidates the entire path.

### Split movement

Movement may be split around other legal actions. Spending AE on an attack, Guard, Recover, or another future action does **not** automatically forbid later movement if enough AE remains and no status/effect says otherwise.

### Movement identity still matters

Although there is no separate generic movement bar, character/build properties such as Movement, Jump, statuses, elevation rules, movement profiles, equipment, Skills, and special traversal effects still influence what routes are legal and how positioning works.

Future profiles may include concepts such as:

- heavy or agile ground movement;
- flying or hovering;
- burrowing;
- teleport/blink;
- jump/vault behavior;
- summon-specific movement;
- terrain affinity or penalties.

All remain server-authoritative.

---

## 5. Baseline Actions

### Inspect — 0 AE

Inspect is an optional utility mode rather than the required opening action.

It can reveal contextual information such as:

- tile position;
- terrain type and traversal cost;
- elevation;
- reachability;
- combatant Initiative, Movement, Jump, Armor, and Evasion summaries;
- facing explanation;
- statuses and their effects.

Inspect does not commit battle state and does not spend AE.

### Basic Attack — 30 AE

Basic Attack is the low-complexity default offensive command. It uses the authoritative attack, target, facing, accuracy/evasion, defense, and effect pipeline.

For the current PV-1F unarmed validation baseline, raw physical power begins from:

```text
6 + Level + floor(Might × 0.8) + floor(Finesse × 0.4)
```

The result then passes through the current accuracy/evasion, Armor/defense, facing, status, and other authoritative combat modifiers. This formula is versioned balance data and is expected to evolve when representative weapons and broader equipment/content arrive.

### Guard — 30 AE

Guard applies **15% incoming-damage reduction for 2 authoritative turns** in the current validation rules.

The duration is governed by authoritative combat turn progression, not client animation timing. Guard is intentionally a modest universal defensive tool so dedicated defensive Disciplines and equipment can retain stronger identities later.

### Recover — 50 AE

Recover immediately restores **10% of the actor's maximum HP**, capped at max HP.

Recover is a bounded baseline recovery command. It does not replace healing Disciplines, Skills, items, equipment, Soulmarks, encounter mechanics, or future support builds.

---

## 6. Facing

Facing is four-directional:

```text
NORTH
EAST
SOUTH
WEST
```

Every combatant must have a readable battlefield orientation indicator.

In the current turn flow, choosing a final direction is the **final command**. A legal direction selection:

1. commits the selected facing;
2. costs 0 AE;
3. performs authoritative end-turn processing;
4. advances authority to the next actor.

There is **no second mandatory End Turn confirmation after a valid final-facing choice**.

### Current positional relationship

For the current validation baseline, Basic Attack positional damage is:

```text
Front   100%
Side    110%
Rear    125%
```

Later authored systems may interact with facing through accuracy, evasion, critical effects, shields, passive/triggered responses, cones/arcs, cover, Skills, bosses, equipment, Resonances, or supernatural effects. Those effects must be explicit and versioned rather than silently inferred.

---

## 7. Turn Lifecycle

A normal PV-1F turn follows this conceptual lifecycle:

```text
TURN START
  ↓
Start-turn statuses / hooks / typed triggers
  ↓
Refresh authoritative Action Economy (normally 100)
  ↓
PLAYER DECISION LOOP
  ├── Inspect (free utility)
  ├── Move (spend AE by traversal cost)
  ├── Basic Attack / Guard / Recover / future Skills or actions (spend AE)
  ├── continue taking legal commands while AE permits
  └── choose final facing
  ↓
FACING COMMIT = END TURN
  ↓
End-turn statuses / durations / zones / objective checks
  ↓
Schedule next actor
```

Interrupt-like or reaction-like behavior may occur only at deterministic/authored trigger points. It is implemented as typed passive/triggered behavior rather than requiring a separate universal player-facing Reaction slot.

The combat log records the actual authoritative sequence.

---

## 8. HP, MP, Statuses & Combatant Presentation

HP and MP are represented visually on combatant rails/cards rather than redundantly repeated everywhere.

Compact combatant summaries may surface Initiative, Movement, Jump, Armor, Evasion, facing, and status icons without requiring Inspect for basic awareness.

Statuses use compact icons:

- **green border** for beneficial effects/buffs;
- **red border** for harmful effects/debuffs.

Selecting a status icon may open a contextual popup showing:

- status name;
- positive/negative classification;
- remaining authoritative duration;
- concise mechanical effect.

Only one contextual popup bubble should be open at a time. Opening another context closes the previous one.

---

## 9. Battle UI Baseline

The current battle cockpit should prioritize the battlefield and avoid forcing page scrolling for normal play where the viewport can reasonably fit the encounter.

Baseline presentation goals include:

- responsive/auto-fit battlefield sizing;
- readable unit scale rather than tiny tokens;
- player/allied combatant information to the left of the battlefield where layout permits;
- enemy information to the right where layout permits;
- compact action controls;
- Action Economy summarized in the fixed battle header;
- Round control opening the Combat Log;
- fixed battle footer for confirmation/cancel/abort and chat presentation where enabled;
- red/green movement/target legality communication;
- visible movement trail/path preview;
- clear rough-terrain and elevation art/readability;
- final-facing controls arranged spatially as north/west/east/south rather than an arbitrary flat list;
- direct post-commit result feedback so damage, healing, Guard, movement, Skills, effects, and AI turns are understandable;
- Skill source labeling/grouping when the mature build system arrives so Discipline, Equipment, Essence, Soulmark, Mantle, and other bounded sources remain readable.

The board may scale in dimensions for future modes and player counts. The current 9×7 Duel Yard is a validation arena, not a universal maximum battlefield size.

Persistent build configuration belongs in Character Profile/build-management surfaces. The battle screen displays the committed battle snapshot rather than becoming a persistent respec editor.

---

## 10. Recruit / AI Baseline

Recruit AI is authoritative and does not receive hidden client-only advantages.

PV-1F exposes three player-selectable practice profiles:

- Easy;
- Standard;
- High.

The profiles may differ in candidate evaluation, positioning quality, action selection, risk tolerance, or other authored heuristics, but all must obey the same legal movement, AE, facing, target, status, and battle-version rules as the encounter defines.

The AI must be capable of completing legal turns and visibly returning authority to the player. A silent/non-acting opponent is a validation failure, not intended pacing.

The current player-facing destination is **Battle Hall**, with **AI Sparring** as the first explicit full training duel. Future practice records, scenarios and stronger profiles must remain progression/spoiler aware.

---

## 11. Skills, Resonance, Essence & Advanced Build Interaction

The current vertical slice does not require the entire mature build system, but combat architecture must anticipate it without restoring retired slot clutter.

### Discipline Skills

Every mature Discipline targets eight learnable Discipline Skills.

- Pure Primary builds may equip up to eight learned Primary Discipline Skills.
- Mixed Primary + mastered Secondary builds may equip six total Discipline Skills across the two active libraries.
- The exact Primary/Secondary split within the mixed six may be tuned; do not hard-code a permanent 4/2 rule unless a current validated rules version explicitly says so.

### Resonance

Resonance is the passive mixed-Discipline interaction created by an eligible Primary + Secondary pair.

Resonance should use typed triggers/conditions/effects and bounded caps where needed. It is not a default extra active button and should not be reduced to generic percentage bonuses.

### Essence

A Primary-only build with no Secondary is eligible for one special Essence Skill outside the normal eight Discipline Skill capacity.

Essence uses the same authoritative AE, targeting, effect, cooldown, forecast, AI-legality and content-version systems as other usable Skills.

### Extra Skill sources

Equipment Skills, Soulmark Skills, Mantle Skills and other approved bounded source systems sit outside the 6/8 Discipline Skill capacity, but each source remains explicitly bounded. “Outside the Discipline cap” never means unlimited action-bar growth.

### Typed triggered behavior

Useful design space formerly described as Traits/Reactions remains available through:

- Resonance passives;
- Soulmark/Mantle passives;
- equipment passives;
- status/effect triggers;
- combo/sequence passives;
- bounded prestige/Veteran Edge rules.

These use deterministic typed triggers and loop guards. They do not recreate separate universal player-facing Trait or Reaction slots.

---

## 12. Timing, Advanced Actions & Later Systems

The preserved pre-PV-1F combat reference contains extensive older design work for timers, targeting, damage architecture, formula safety, tags, objectives, multiplayer timing, advanced movement, content authoring and other later systems.

Those sections remain useful **only where they do not conflict** with the current combat rules or current build-system terminology.

Specifically:

- the former Movement Budget + one Action validation model is historical and must not be restored;
- separate player-facing Reaction/Movement Art/Ultimate slot assumptions are superseded by the current Skill/passive build model;
- Confluence references must be interpreted as Resonance only where the underlying mechanic is still approved;
- Current/Legacy references must be interpreted through Primary/Secondary only where the underlying mechanic is still approved;
- older fixed Art-slot counts do not override the approved 8-pure / 6-mixed Discipline Skill capacities;
- later-system concepts remain planned only when another current authoritative document still supports them;
- any implementation ticket touching an old reference concept must reconcile it into this canonical file or the relevant current domain document rather than relying indefinitely on historical wording.

---

## 13. Current Validation Standard

PV-1F is not product-validated because code exists or automated tests pass.

Automated gates must prove authority, persistence, browser responsiveness, and regression safety. Human/internal testing must then determine whether the system is actually understandable, responsive, tactically legible, and worth replaying.

A successful validation session should let a tester explain:

- where they can move and what it costs;
- how much AE remains;
- what an attack, Guard, Recover, or other available action will cost;
- what happened after committing an action;
- how terrain/elevation/facing influenced a decision;
- what the Recruit did on its turn;
- why the battle outcome occurred;
- at least one tactical decision they remember making.

The strongest product signal remains voluntary desire to play another battle rather than merely tolerating the interface.

**Automated green gates do not constitute a human PV PASS.**