# AUREVANE Combat Design Bible

## P4.K4 Vengeance kernel boundary — 2026-09-15

Vengeance is an optional typed `vengeance` profile on an ordinary damage block, not a reactive status or a second damage resolver. Author `conversionBasisPoints` as a positive safe integer, optional nonnegative `minimumDamage`, and required positive finite safe-integer `maximumDamage`. The minimum cannot exceed the maximum. Conversion may exceed 100%, but the explicit maximum always bounds the derived raw potency. The block uses `amount: 0` and cannot also author offensive-stat scaling; ordinary extra damage belongs in a separate block. Unknown profile fields, invalid values and Vengeance on non-damage operations are rejected. The historical Basic Attack adapter does not accept this metadata.

The user’s authoritative current-round plus previous-two-round Damage History is read once from the command-start snapshot. Old unpruned rows, future rows and other combatants do not contribute. Each actor/round row is unique and contains a nonnegative safe integer; invalid relevant values or duplicates fail closed. The engine sums and converts using exact integer arithmetic, floors once, applies the authored minimum and maximum, and only then converts back to a safe numeric raw-damage value. There is no implicit Absorb minimum-one rule. Missing historical effect state means zero qualifying history. Casting and healing do not consume or erase the history.

The ordinary pipeline then applies targeting, Armor/Ward, tactical and damage modifiers, Barrier, actual-HP/overkill clamping, Damage History and bounded reactions. `maximumDamage` caps the history-derived raw potency, not the subsequent ordinary modifier stage. Pierce retains its existing mitigation-only meaning. Vengeance is direct command damage and may trigger eligible defender Absorb/Reflect; reflected output does not feed the user’s history. Existing hostile direct/periodic history recording and self/backlash/system exclusions are unchanged.

Kernel evaluation and commit share the same materializer. A legal Vengeance evaluation includes `vengeanceBasis` with the source, effect ordinal, window bounds, at most three per-round amounts and derived raw potency; illegal evaluations do not expose that basis. Evaluation does not advance RNG or mutate the snapshot. Commit recomputes from its current snapshot; existing expected-battle-version protection remains authoritative. Mature Skills materialize before the existing consecutive-use reduction, so the capped potency is halved at unchanged AP/MP cost, retaining the established minimum-one repeat rule only for already-positive potency.

This ticket supplies kernel calculation, validation and forecast data, not published Vengeance Skills or a player-interface release. Generalized Skill accuracy, complete reactive forecasts, AI policy, compact-tag/presentation wiring and content publication remain their separate migration/acceptance gates. Published catalogs, historical direct-damage behavior, schemas and deployment configuration are unchanged. No deployment is authorized by this checkpoint.

## P4.K4 Reflect kernel boundary — 2026-09-15

The current-kernel `reflectBasisPoints` status field is optional for historical compatibility and requires positive/reactive metadata and an integer from 1 to 10000. Active stacks and definitions combine up to 100% per defender. Reflect aggregates actual hostile direct-command HP loss after incoming mitigation, Barrier and overkill, floors the percentage once per defender, and does not inherit Absorb's minimum-1 recovery rule. Zero results emit no damage event.

Original command receipts are shared with Absorb HP/MP without recycling reaction output. Reflect deals fixed damage to the source attacker without an accuracy roll or another Armor/Ward/modifier pass. The existing first Barrier slice remains direct-command-only: attacker Barrier does not intercept reactive Reflect output in this version. Reflect is excluded from Damage History, Absorb and further Reflect triggers. Periodic damage, Burn backlash, friendly fire, self-cost and system output do not qualify. Unsupported generic self-damage remains rejected.

A defeated defender can return its qualifying damage, allowing mutual KO. The engine-owned post-command reaction boundary runs before the final terminal verdict. Attacker defeat reuses the established defeat/turn transition, removes ongoing recovery and records only the final winner or draw. Positive reflected HP loss breaks Invisible. Each positive defender return consumes one K3 trigger budget at depth 1 with a deterministic relationship identity; an exhausted or previously consumed guard suppresses the reaction, not the ordinary command. No-context public calls retain their four-argument contract and omit resolution metadata.

When Reflect defeats the current actor but the battle continues, the successor receives normal owner-turn-start status expiration. A crossed round applies and consumes scheduled tempo and advances temporary terrain exactly once, using the same upkeep as normal turn endings. The defeated actor's ordinary periodic damage/recovery is not replayed.

This is a kernel primitive, not a published roster or balance change. No published Skill/status catalog, player UI, AI policy, schema or deployment is activated by this slice. Current player forecasts do not yet display reactive returns; forecast/AI integration must be completed before authored Reflect content is published through the later migration and acceptance gates. Existing AP, targeting, direct-damage calculations and historical definitions remain protected.

## Phase 4 roster and effect implementation — 2026-09-12

The published seventeen-Discipline roster contains 136 regular Skills, 17 pure Essences and all 136 unordered Resonance pairs. Eight learned Skills per mature library remain distinct from four battle selections. Full mixed builds use 1+3, 2+2 or 3+1; Essence and Resonance are exclusive. The gameplay-tag continuation below adds versions of existing Skills without adding selectable slots or rewriting frozen battles. See `PHASE_4_COMPLETENESS_AUDIT.md` and `PHASE_4_TICKETS.md` for candidate verification and live release status.

Existing named statuses include Burn, Bleed, Poison, Regeneration, Slow, Root, Reckless, Fortified, Challenged, Marked and Warded. Conditioned outgoing/incoming damage evaluates each attacker/recipient pair, using a 50–200% combined budget for the new modifiers. Guarded/Exposed/Lowered Guard remain separate historical multipliers. New percentage statuses are single-stack; Reckless and Fortified keep their benefit and drawback together.

Periodic HP effects tick at affected turn end, before completion; they cannot revive a defeated unit. Root blocks movement while leaving actions/facing available. Slow adds 10 AP per tile within the normal Movement allowance. Cleanse removes only named statuses. Mature Skill damage resolves each hit against each actual recipient's Armor (physical) or Ward (mystic). New mystic attacks have bounded authored MP costs. Repeated quantitative effects halve, discrete one-stack/cleanse repeats are omitted, and AP/MP costs remain unchanged.

Normal advanced acquisition uses listed Foundation Mastery prerequisites and 4/2/2 learned milestones at Initiate/Practiced/Adept. Mastery Trials on Standard/High award up to 50 XP for an eligible victory using two different Primary regular Skills across at least three Primary Skill commands and no player timeout. The database checks immutable origin/build and committed events; claims are atomic and idempotent. Stages are 100/300/600/1,000 XP, with all eight regular Skills demonstrated for normal Master. Owner-authorized testing access permits immediate published-roster testing independently of earned XP, stage and release eligibility. Ordinary sparring grants no Mastery XP. The 36-identity Discipline Atlas is inside Profile → Discipline Management; unpublished nodes and later authored Mastery Rites remain planned.

World acquisition, full equipment catalogs and supernatural systems retain their later roadmap boundaries. Illustrated masters, recorded SFX and independent human balance/media acceptance remain explicitly tracked; automated authored coverage is not that acceptance.

### P4.K2 Stat-Scaled Potency v2 boundary

Damage effects may optionally opt into one authoritative offensive rating using deterministic basis-point math:

```text
RawDamage = AuthoredBasePower + floor(SelectedOffensivePower * ScalingCoefficientBasisPoints / 10000)
```

`SelectedOffensivePower` is explicitly authored as Physical Power or Mystic Power for that damage effect. Scaling is opt-in; omitted scaling preserves authored-base-only behavior. The current published Discipline Skills, pure Essence Skills and Basic Attack remain unscaled by K2, and Basic Attack keeps its existing independent derived-damage formula. After optional scaling, the existing Armor/Ward mitigation, facing, target-status and bounded conditional modifier stages still resolve in their established order. Historical stat-bridge v1 encounters remain valid for unscaled content; a scaled effect requires a complete v2 offensive-stat bridge and fails closed if those ratings are absent. Broad coefficient assignment, roster rebalance and tuning belong to the later controlled content migration and Balance Harness work rather than this foundation ticket.

### Gameplay tags and temporary terrain continuation

The typed gameplay tags are Scorched, Frozen, Conductive, Wet, Bleeding, Marked, Guarded, Inspired, Hexed, Invisible, Exposed, Poisoned, Fortified, Summoned, Airborne and Displaced. Existing Burn, Bleed and Poison map to Scorched, Bleeding and Poisoned without changing their historical status IDs. Authored requirements and conditional damage consume these tags explicitly.

- Water Skills apply Wet only when authored to do so. The first positive storm hit per recipient per command receives a 20% bonus from Wet or Conductive, within the existing combined modifier budget. The conditions do not double the bonus. Conductive is consumed; Wet remains.
- Positive fire damage removes Wet and Frozen statuses. Independently, fire on an affected Frozen tile converts that overlay to Steam, including empty tiles and either team's tiles.
- Inspired adds 10% outgoing damage within the same combined budget. Hexed reduces incoming direct and periodic healing by 25%; it does not change ordinary revive effects. Summoned provides temporary, dispellable spirit protection that reduces incoming damage by 15% within the combined budget; it creates no extra actor or turn.
- Invisible blocks hostile direct unit selection. It does not prevent a ground or area effect from hitting the unit. Taking positive damage or committing the holder's damaging command breaks concealment, including a missed basic attack.
- Frozen terrain adds 10 AP per tile entered, on top of base terrain and Slow costs. Airborne ignores only this temporary Frozen surcharge; it does not bypass Root, occupancy, elevation, base terrain or the separate Movement allowance.
- Steam blocks line of sight through intermediate tiles, following the existing endpoint convention. Frozen and Steam affect both teams, preserve base terrain and expire after two round boundaries. Reapplication refreshes duration without stacking; at most one overlay occupies a tile.
- A one-tile push moves directly away from the caster along the dominant axis, with a horizontal tie-break. Bounds, passability, vacancy, elevation and Root still apply. Failure does not move the unit or refund costs. Success preserves facing/resources and records Displaced for one owner turn start; it grants no extra turn.

The newly introduced status instances last two owner turn starts unless specified otherwise; refreshing a single-stack status does not stack its modifier. Preview and commit share effect resolution. Ground casts submit tile intent, and only explicitly authored terrain/elemental actions can resolve without an affected unit. Existing primary-unit Resonance payoffs retain their scope: a ground cast preserves that setup for a later unit-targeted Skill, and empty ground cannot farm an actor reward. Consecutive repeats omit discrete terrain creation/displacement just as they omit other discrete benefits, while quantitative effects halve at unchanged AP/MP cost.

Authored Skill facing multipliers accept up to 22,000 basis points so the existing Perfect Opening Essence's 2.2× rear payoff can execute. Basic attack facing and combined conditional modifier caps remain 20,000; these are separate limits.

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

## Phase-4 Chronist scheduling and positional return

Chronist implements next-round Initiative scheduling: Hastened +20, Delayed -20, Borrowed Hour +40, capped at ±40 per unit. Tempo is consumed at the round boundary and determines a frozen order for that round only. Base attributes remain unchanged. Stable identity resolves ties. Each living unit receives one turn; lethal turn-end ticks cannot grant a defeated unit a new turn. The next boundary restores base order unless another tempo effect was prepared. These effects do not add AP or grant extra turns.

Rewind Step returns the caster to its authoritative current-turn origin, provided it moved, is not Rooted and the origin is still passable and unoccupied. It restores only position, without restoring HP, MP, AP, movement allowance, facing or commands. Consecutive-repeat rules omit this discrete effect. Existing cleanse lists remain explicitly authored; they are not silently broadened to remove Delayed.

### Approved effect-rework implementation checkpoint (feature branch)

The Owner-approved specifications under `docs/superpowers/specs/2026-09-12-*` supersede older design values as their new immutable content versions are introduced. This checkpoint does not claim that all new content is published.

The feature branch currently supports explicit `displace.direction` (`push` or `pull`) and a positive safe-integer `distance`. It resolves one legal tile at a time, recomputing the dominant axis after each step and breaking ties horizontally. Pull stops before the caster; blocked movement retains prior legal steps. Successful displacement applies Displaced. Historical directionless displacement remains Push 1.

Haste changes entered-tile AP by -10 and Slow by +10. Terrain and Frozen apply first; legal entered tiles cost at least 10 AP. Haste does not alter the separate Movement allowance or historical initiative-based Hastened. Board reachability and authoritative execution share the entered-tile cost helper.

Healing and positive MP recovery accept `ticks` from 1 to 4. One application is immediate; the rest occur at the recipient's end of turn. Amounts are per application, caps apply each time, and Hex affects HP recovery at each tick, not MP. Reapplication replaces the same recipient/resource/action schedule; distinct actions coexist. Defeat clears future recovery and cannot be reversed by a scheduled tick. Current ordinary Cleanse/Dispel does not erase these schedules. Future amounts retain cast-time repeat-use scaling. Omitted duration preserves a single immediate application, and historical Regeneration remains unchanged.

New persistent Poison, independent Bleed stacks, decaying Burn/backlash, the remaining new effects, roster version migration, Covert viewer security, and Master Panel publishing are still pending. Do not infer their availability from this intermediate runtime checkpoint.

## P4.K3 Combat Kernel provenance boundary — 2026-09-15

P4.K3 defines the behavior-preserving deterministic resolution/provenance substrate used by later advanced combat mechanics. `COMBAT_RESOLUTION_PIPELINE_VERSION = 1` fixes the following stage order: `command-validation`, `legality`, `target-context`, `accuracy`, `pre-hit-reactions`, `raw-potency`, `defense`, `tactical-modifiers`, `damage-modifiers`, `barrier-redirect`, `commit-mutation`, `after-damage-triggers`, `bounded-reactions`, `consequences`, `battle-state-checks`, `metadata`. Changing the semantic order requires a versioned contract change rather than silently reinterpreting V1.

Trigger chains are bounded and deterministic. Current infrastructure defaults are maximum depth 8, reaction budget 32, and triggered damage policy `non-reactive`; an effect instance may execute at most once per chain under the duplicate-instance guard. These are kernel safety ceilings, not a claim that every future reactive mechanic is implemented.

An optional `CombatResolutionContext` carries immutable command provenance and the trigger guard through authoritative execution. The historical four-argument `executeCombatAction(...)` shape remains valid and does not add provenance fields to historical state. When a K3 context is supplied, newly committed persistent status, ongoing recovery, Poison, Bleed, and Burn rows receive deterministic `CombatEffectInstanceProvenance` after the existing authoritative resolver completes. Provenance identifies the originating command/ruleset/controller/trigger chain, target, zero-based effect ordinal, and pre-command round/turn, with reserved copied/inherited lineage links for later typed Copy/Mirror work.

Historical snapshots may omit K3 provenance. Omitted provenance remains valid; if provenance is present, it is validated fail-closed. K3 does not alter damage values, AP/MP costs, targeting, accuracy, DoT values, durations, published content, or battle UX, and it does not by itself implement Barrier, Reflect, Absorb, lifesteal, redirect/interception, or other K4 mechanics. Those mechanics must consume this shared versioned pipeline and provenance model rather than create competing resolver or provenance paths.
