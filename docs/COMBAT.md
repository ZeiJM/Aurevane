# AUREVANE Combat Design Bible

## Phase 4 roster and effect implementation — 2026-09-11

The sixteen-Discipline candidate contains 128 regular Skills, 16 pure Essences and all 120 unordered Resonance pairs. Eight learned Skills per mature library remain distinct from four battle selections. Full mixed builds use 1+3, 2+2 or 3+1; Essence and Resonance are exclusive. See `PHASE_4_TICKETS.md` for exact verification and release status.

New named statuses are Burn, Bleed, Poison, Regeneration, Slow, Root, Reckless, Fortified, Challenged, Marked and Warded. Conditioned outgoing/incoming damage evaluates each attacker/recipient pair, using a 50–200% combined budget for the new modifiers. Guarded/Exposed/Lowered Guard remain separate historical multipliers. All new percentage statuses are single-stack; Reckless and Fortified keep their benefit and drawback together. Only five regular Skills apply the new percentage families; two of those are potent linked tradeoffs.

Periodic HP effects tick at affected turn end, before completion; they cannot revive a defeated unit. Root blocks movement while leaving actions/facing available. Slow adds 10 AP per tile within the normal Movement allowance. Cleanse removes only named statuses. Mature Skill damage resolves each hit against each actual recipient's Armor (physical) or Ward (mystic). New mystic attacks have bounded authored MP costs. Repeated quantitative effects halve, discrete one-stack/cleanse repeats are omitted, and AP/MP costs remain unchanged.

Normal advanced acquisition uses listed Foundation Mastery prerequisites and 4/2/2 learned milestones at Initiate/Practiced/Adept. Mastery Trials on Standard/High award up to 50 XP for an eligible victory with two Primary regular Skills across three commands and no player timeout. The database checks immutable origin/build and committed events; claims are atomic and idempotent. Stages are 100/300/600/1,000 XP, with all eight regular Skills demonstrated for normal Master. Existing Owner-authorized testing Mastery grants remain intact and permit immediate full-roster testing.

World acquisition, full equipment catalogs and supernatural systems retain their later roadmap boundaries. Illustrated masters, recorded SFX and independent human balance/media acceptance remain explicitly tracked; automated authored coverage is not that acceptance.



## Current selected-Technique and repeat-use authority — 2026-09-11 synchronization

`docs/GAME_MASTER_PLAN_TECHNIQUE_REPEAT_USE_ADDENDUM.md` (Owner-approved 2026-09-06) supersedes earlier 8-pure/6-mixed selected-capacity and ordinary authored-Skill cooldown language in this document. Current selection is up to **four Techniques** in either build; full mixed splits are **1+3, 2+2 or 3+1**, with partial selections permitted. Pure Essence remains outside those four slots; mixed builds retain Resonance and no pure Essence. A mature library may still teach eight Skills.

Ordinary authored Techniques and Essence Skills use **50% consecutive-use effectiveness at unchanged AP cost**, not turn cooldowns. A different actual combat command resets the chain; ending a turn alone does not. Basic recovery timing remains separate. Conflicting older passages below are historical design context and must not restore retired runtime rules.


**Status:** Canonical combat source of truth for implementation and content work.

**Initial direction approved:** 2026-08-15.  
**PV-1F rules revision approved:** 2026-08-18.  
**Terminology/current implementation synchronization:** 2026-09-11.

The approved September attribute/progression addendum supersedes the original PV-1F movement costs: 20 AP per terrain-cost point, with a separately enforced character Movement allowance.

This document defines the current AUREVANE combat baseline. When older tickets, tests, prose, screenshots, or historical documents conflict with this file, **this file wins unless the Owner explicitly approves a later change**.

The full pre-PV-1F combat bible is preserved at [`COMBAT_PRE_PV1F_REFERENCE.md`](./COMBAT_PRE_PV1F_REFERENCE.md). That snapshot is intentionally historical. Its former Movement Budget + one Action model is superseded.

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
- meaningful positioning, terrain, elevation and facing;
- stat-driven buildcraft;
- Primary/Secondary Discipline choices, Skills, Resonance or Essence, supernatural identity and equipment;
- typed passive/triggered responses without requiring a separate player-facing Reaction slot system;
- server-authoritative multiplayer outcomes;
- deterministic or server-owned resolution where required;
- strong audiovisual feedback;
- enough tactical choice that players remember why a decision mattered;
- a baseline interaction model that is understandable before advanced systems arrive.

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
- damage, healing, mitigation, statuses and durations;
- Skill costs, cooldowns and requirements;
- passive/triggered response resolution;
- Resonance/Essence legality and effects when implemented;
- final facing and turn completion;
- Recruit/AI decisions;
- RNG and deterministic seeds where applicable;
- idempotency and duplicate-request handling;
- rewards, progression and battle terminal state.

Client previews are informational. A preview never spends resources or proves that a later stale command may commit.

---

## 3. Standard Turn Economy

**PV-1F supersedes the earlier `MOVE + one ACTION` validation model.**

A normal actor turn begins with **100 Action Economy**, displayed to players as **100 AP**, unless an authoritative rule modifies the starting value.

Current implemented costs are:

```text
Inspect                         0 AP
Move, normal traversal point   20 AP
Move, terrain cost 2           40 AP
Basic Attack                   30 AP
Guard                          30 AP
Recover                        50 AP
Final Facing                    0 AP and ends the turn
```

These values are confirmed by the current server-authoritative `pv1f-action-economy` implementation and current Battle Hall UI. They are versioned balance values, but they are the current rules until deliberately changed.

Movement and actions draw from the **same** 0–100 Action Economy. Movement additionally obeys the committed character Movement allowance (baseline 2, maximum 5). Enough AP does not authorize movement beyond that allowance. Jump starts at 0 and caps at 3. The retired binary `Action Ready / Action Spent` model remains retired.

Multiple legal commands may occur during one turn while enough AP remains. For example:

- Basic Attack → Basic Attack if both attacks are legal and affordable;
- Basic Attack → movement if sufficient AP remains;
- Guard → movement where affordable;
- Recover → movement where affordable;
- movement through a mixture of normal and rough terrain.

### Economy invariants

- Normal turns start at 100 AP unless an explicit authoritative effect changes the start value.
- AP cannot be spent below zero.
- A command cannot commit when its cost exceeds remaining AP.
- Failed or illegal commands do not silently spend AP.
- Previews never spend AP.
- Successful commits spend their authoritative cost exactly once.
- A repeated idempotent request replays the committed result rather than charging twice.
- Double-clicks cannot create duplicate authoritative outcomes.
- Refunds, bonus AP, free actions and extra turns must be explicitly authored, bounded, tested and logged.
- Recursive action/turn generation is forbidden unless specifically approved and protected by hard limits.

---

## 4. Movement & Terrain

Movement spends AP according to **authoritative traversal cost**.

Current baseline:

```text
Open / normal ground    traversal cost 1  => 20 AP per tile entered
Rough ground            traversal cost 2  => 40 AP per tile entered
Blocked terrain          illegal unless a movement rule permits it
```

The client may display reachable tiles, legality, a path trail, terrain cost and projected remaining AP before confirmation. The server revalidates the entire path.

### Split movement

Movement may occur around other legal actions if both AP and Movement allowance remain and no status/effect prohibits it.

### Movement identity still matters

Character/build properties such as Movement, Jump, statuses, elevation rules, movement profiles, equipment, Skills and special traversal effects still influence which routes are legal.

Future movement profiles may include heavy/agile ground movement, flying, burrowing, teleport/blink, jump/vault behavior, summon movement and terrain affinity/penalties. All remain server-authoritative.

---

## 5. Baseline Actions

### Inspect — 0 AP

Inspect is optional utility. It can reveal contextual information such as tile position, terrain/traversal cost, elevation, reachability, combatant Initiative/Movement/Jump/Armor/Evasion, facing and statuses.

Inspect does not commit battle state and does not spend AP.

### Basic Attack — 30 AP

Basic Attack is the low-complexity default offensive command. It uses the authoritative target, facing, accuracy/evasion, defense and effect pipeline.

For the current PV-1F unarmed validation baseline, raw physical power begins from:

```text
6 + Level + floor(Might × 0.8) + floor(Finesse × 0.4)
```

The result then passes through current accuracy/evasion, Armor/defense, facing, status and other authoritative modifiers. This formula is versioned balance data and may evolve as representative equipment/content arrives.

### Guard — 30 AP

Guard applies one stack of **15% incoming-damage reduction for 2 authoritative turns** in the
current validation rules. Guarded may be reapplied up to three stacks; each application spends AP,
adds a stack until the cap, and refreshes the shared authoritative duration.

The duration follows authoritative turn progression, not client animation timing.

Released buffs and debuffs use their authored stack cap rather than a universal one-stack block.
Lowered Guard uses the same three-stack cap and retains its one-owner-turn-start duration.

### Recover — 50 AP

Recover immediately restores **10% of maximum HP**, capped at max HP.

Recover is a bounded universal recovery command; it does not replace healing Disciplines, Skills, items, equipment or supernatural systems.

---

## 6. Facing

Facing is four-directional:

```text
NORTH
EAST
SOUTH
WEST
```

Every combatant should have a readable battlefield orientation indicator.

In the current flow, choosing final facing is the **final command**. A legal direction selection:

1. commits the selected facing;
2. costs 0 AP;
3. performs authoritative end-turn processing;
4. advances authority to the next actor.

There is no second mandatory End Turn confirmation after a valid final-facing choice.

Current Basic Attack positional damage:

```text
Front   100%
Side    110%
Rear    125%
```

Later systems may interact with facing through explicit/versioned accuracy, critical, shield, passive, cone/arc, Skill, boss, equipment, Resonance or supernatural rules.

---

## 7. Turn Lifecycle

A normal PV-1F turn conceptually follows:

```text
TURN START
  ↓
Start-turn statuses / hooks / typed triggers
  ↓
Refresh Action Economy (normally 100 AP)
  ↓
PLAYER DECISION LOOP
  ├── Inspect (0 AP)
  ├── Move (spend AP by traversal cost)
  ├── Basic Attack / Guard / Recover / future Skills or actions
  ├── continue while legal and affordable
  └── choose final facing
  ↓
FACING COMMIT = END TURN
  ↓
End-turn statuses / durations / zones / objective checks
  ↓
Schedule next actor
```

Reaction-like behavior may occur only at deterministic/authored trigger points. It is implemented as typed passive/triggered behavior rather than a separate universal player-facing Reaction slot.

---

## 8. HP, MP, Statuses & Combatant Presentation

HP and MP are represented visually on combatant rails/cards rather than redundantly repeated everywhere.

Compact combatant summaries may surface Initiative, Movement, Jump, Armor, Evasion, facing and status icons.

Statuses use compact readable icons. Positive/negative state must not rely on color alone; color may reinforce meaning but accessibility requires text/icon context.

Selecting a status may expose name, classification, remaining authoritative duration and concise effect.

---

## 9. Battle UI Baseline

The battle cockpit should prioritize the battlefield and avoid unnecessary page scrolling where the viewport can reasonably fit the encounter.

Baseline goals include:

- responsive/auto-fit board sizing;
- readable unit scale;
- compact combatant rails;
- Action Economy in the battle header;
- clear committed versus proposed AP;
- Combat Log access;
- fixed/clear confirm/cancel/abort controls;
- target and movement legality feedback;
- visible path preview;
- terrain/elevation readability;
- spatial final-facing controls;
- direct result feedback after commit;
- clear Skill source labeling when mature build systems arrive.

The current 9×7 Duel Yard is a validation arena, not a universal maximum battlefield size.

Persistent build configuration belongs in Character Profile/build-management surfaces. Battle displays the committed battle snapshot rather than acting as a persistent respec editor.

---

## 10. Recruit / AI Baseline

Recruit AI is authoritative and receives no hidden client-only advantages.

Current preview exposes three player-selectable practice profiles:

- Easy;
- Standard;
- High.

All profiles obey the same legal movement, AP, facing, targeting, status and battle-version rules as the encounter defines.

AI must complete legal turns and visibly return authority to the player. A silent/non-acting opponent is a validation failure.

The current player-facing destination is **Battle Hall**, with **AI Sparring** as the first explicit full training duel.

---

## 11. Skills, Resonance, Essence & Advanced Build Interaction

The current vertical slice does not require the full mature build system, but combat architecture must anticipate it without restoring retired slot clutter.

### Discipline Skills

Every mature Discipline targets eight learnable Discipline Skills.

- Pure Primary builds may equip up to eight learned Primary Discipline Skills.
- Mixed Primary + mastered Secondary builds may equip six total Discipline Skills across the active libraries.
- The exact Primary/Secondary split inside the mixed six may be tuned; do not hard-code a permanent 4/2 rule without a later approved rule.

### Resonance

Resonance is the passive mixed-Discipline interaction created by an eligible Primary + Secondary pair.

It should use typed triggers/conditions/effects and bounded caps where needed. It is not a default extra active button and should not be reduced to generic percentage bonuses.

### Essence

A Primary-only build with no Secondary is eligible for one special Essence Skill outside the normal eight Discipline Skill capacity.

Essence uses the same authoritative AP, targeting, effect, cooldown, forecast, AI-legality and content-version systems as other usable Skills.

### Extra Skill sources

Equipment Skills, Soulmark Skills, Mantle Skills and other approved bounded source systems sit outside the 6/8 Discipline Skill capacity, but each source remains explicitly bounded.

### Typed triggered behavior

Useful design space formerly described as Traits/Reactions remains available through Resonance passives, supernatural passives, equipment passives, status/effect triggers, combo/sequence passives and bounded prestige rules.

---

## 12. Advanced Content & Historical Reference

The preserved pre-PV-1F combat reference contains older design work for targeting, damage architecture, tags, objectives, multiplayer timing, movement, authoring and other later systems.

Those concepts remain useful only where they do not conflict with the current combat rules or build terminology.

Specifically:

- Movement Budget + one Action is historical and must not be restored;
- separate player-facing Reaction/Movement Art/Ultimate slot assumptions are superseded;
- Confluence means Resonance only where the underlying mechanic remains approved;
- Current/Legacy must be reconciled to Primary/Secondary only where the underlying mechanic remains approved;
- older fixed Art-slot counts do not override approved pure/mixed Discipline Skill capacities;
- numerical combat constants must be checked against the current server-authoritative implementation before being copied into canonical docs.

---

## 13. Current Validation Standard

PV-1F is not product-validated merely because code exists or automated tests pass.

Automated gates prove authority, persistence, browser responsiveness and regression safety. Human testing determines whether the system is understandable, responsive, tactically legible and worth replaying.

A successful validation session should let a tester explain:

- where they can move and what it costs;
- how much AP remains;
- what Attack, Guard, Recover or another available action costs;
- what happened after committing;
- how terrain/elevation/facing influenced a decision;
- what the Recruit did;
- why the battle outcome occurred;
- at least one tactical decision they remember making.

The strongest product signal remains voluntary desire to play another battle.

**Automated green gates do not constitute a human PV PASS.**
