# AUREVANE — Reactive Effects, Accuracy, and Discipline Skill Rebalance

**Status:** Owner-approved architectural extension  
**Approved in chat:** 2026-09-12  
**Task branch:** `agent/combat-effect-taxonomy-rework`  
**Extends:** `2026-09-12-combat-authoring-dots-copy-revision-design.md` and `2026-09-12-combat-effect-taxonomy-rework-design.md`

## 1. Authority and scope

This document extends the already approved combat-authoring, DoT, Copy, displacement, Haste/Slow, recovery-duration, compact-tag, and historical-compatibility designs.

Where this document conflicts with those earlier specs, this document wins for the subjects it explicitly covers.

The Owner clarified that the requested broad rebalance permission applies to **Discipline Skill rosters**. It does **not** authorize redesigning Discipline identities, base stat profiles, mastery structures, progression identity, or unrelated character systems.

The implementation may rebalance regular Discipline Skills across all 17 Disciplines, including:

- AP cost;
- MP/resource cost;
- cooldown;
- direct damage;
- healing/recovery amount;
- range;
- target kind/team policy;
- Single/Circle/Line shape and size;
- accuracy behavior and authored accuracy modifier;
- status/effect duration;
- status/effect magnitude;
- stack behavior;
- ordered effect combinations;
- effect recipients;
- AI utility metadata;
- presentation descriptions/tags required to truthfully describe the changed Skill.

Preserve each Discipline's gameplay fantasy and role. Do not redesign a Discipline merely to distribute every new mechanic evenly.

Previously approved Essence changes that are required for compatibility with retired effects still stand, but this new blanket rebalance authorization is for regular Discipline Skills rather than the Essence roster as a whole.

Production deployment remains separately Owner-controlled.

## 2. New compact effect tags

Add the following current player-facing effect tags, derived from authoritative definitions rather than hand-entered display strings:

- `Absorb HP`
- `Absorb MP`
- `Reflect`
- `Pierce`
- `Blind`
- `Vengeance`
- `Amplify`
- `Curse`

`Mark` remains a current tag but its mechanic changes under section 7.

These tags are gameplay-bearing. A tag must not appear merely because a description contains a matching word.

## 3. Shared effect metadata: polarity, copyability, and reaction class

Amplify and Curse require the engine to understand what an effect means instead of guessing from status names.

Current versioned effect/status definitions therefore gain explicit metadata:

- `polarity`: `positive | negative | neutral | mixed`;
- `amplifyCopyable`: boolean;
- `curseCopyable`: boolean;
- `reactionClass`: `ordinary | periodic | reactive | self-cost | system` where relevant.

Historical definitions remain valid without these fields through compatibility defaults. New authored definitions must supply or derive them explicitly.

### 3.1 Default copy policy

- positive effects may be Amplify-copyable;
- negative effects may be Curse-copyable;
- neutral, mixed, and system effects are non-copyable by default;
- a definition can explicitly opt out even when its polarity would otherwise qualify.

Examples of effects expected to be eligible when their current definitions support it:

- Amplify candidates: Guard, Haste, Inspire, Ghost/Invisible, Absorb HP, Absorb MP, Reflect and other ordinary positive status effects;
- Curse candidates: Expose, Hex, Slow, Root when explicitly allowed, Blind, Burn, Poison, Bleed and other ordinary negative status effects.

Mixed effects such as Reckless/Fortified are **not** copied by default because they contain both upside and downside. They require a future explicit authoring choice if the Owner wants them copyable.

System penalties such as PvP timeout Off-guard are never Amplify/Curse copy targets.

### 3.2 No arbitrary scripting

The Master Panel exposes typed fields for this metadata. It does not permit arbitrary runtime scripts as a substitute for supported effect types.

## 4. Damage provenance and anti-recursion rule

Several new mechanics react to damage, so authoritative damage resolution must carry provenance sufficient to distinguish:

- direct hostile command damage;
- periodic hostile damage;
- reactive damage;
- self-cost/backlash damage;
- system damage where applicable;
- source combatant/action when one exists.

Reactive effects resolve from committed authoritative damage events, not client predictions.

### 4.1 Reactive-chain rule

Damage or recovery produced by a **reactive** effect does not recursively trigger another reactive effect unless a future versioned rule explicitly allows it.

Therefore:

- Reflect damage does not trigger Reflect again;
- Reflect damage does not trigger Absorb HP/MP;
- Burn attack backlash does not trigger Reflect or Absorb;
- Poison/Bleed/Burn periodic ticks do not trigger Reflect or Absorb under the current design;
- Absorb healing/restoration does not itself trigger another reaction.

This prevents infinite or order-sensitive reaction loops.

## 5. Absorb HP

### 5.1 Identity

`Absorb HP` is a positive status/effect with an authored percentage.

When its owner suffers qualifying hostile direct HP damage, the owner recovers HP equal to the authored percentage of the **actual HP damage suffered**, rounded down with a minimum recovery of 1 when the percentage calculation is non-zero and at least one qualifying damage point was suffered.

The Master Panel authors the percentage within a bounded validator range. Initial Discipline Skill balance should generally stay within **10% to 35%** unless a Skill's cost/cooldown clearly supports a stronger value.

### 5.2 Resolution order

1. Incoming damage is fully resolved, including Armor/Ward and damage modifiers unless Pierce applies.
2. HP loss is committed.
3. Defeat is checked.
4. If the owner remains alive, Absorb HP restores the calculated HP.

Absorb HP **cannot rescue lethal damage**. A unit reduced to 0 HP is defeated before Absorb HP can heal it.

Recovery cannot exceed max HP.

### 5.3 Trigger exclusions

Current Absorb HP does not trigger from:

- Reflect damage;
- Burn backlash;
- Poison/Bleed/Burn periodic damage;
- self-inflicted damage or self-cost;
- system penalties/damage.

Reapplication/stack behavior is authored by the underlying positive status definition, but the initial roster should prefer non-stacking percentage effects unless an explicit Skill is balanced around stacking.

## 6. Absorb MP

`Absorb MP` follows the same qualifying-damage and anti-recursion rules as Absorb HP, but restores MP instead of HP.

The restored amount is the authored percentage of actual qualifying HP damage suffered, rounded down with the same minimum-1 rule when applicable.

MP restoration cannot exceed max MP.

Absorb MP does not prevent defeat and cannot trigger after the owner has been defeated by the qualifying damage.

Initial Discipline Skill balance should generally keep the percentage within **10% to 30%** unless the Skill's broader package justifies more.

## 7. Mark rework

The old Mark rule — increasing damage taken from the source — is retired for new current content.

### 7.1 New identity

`Mark` is a source-specific negative state on a target that increases the **applying user's accuracy against that marked target**.

Current baseline:

- **+15 percentage points accuracy** for the Mark source against that target;
- non-stacking for the same source/target pair;
- reapplication by the same source refreshes the authored remaining duration;
- multiple different combatants may independently Mark the same target and each receives only their own accuracy benefit.

The bonus and duration are versioned/authored within validator bounds. The initial baseline is +15 percentage points rather than a multiplicative accuracy modifier.

Historical battles pinned to the old Mark definition keep the old damage-vulnerability behavior.

## 8. Blind

`Blind` is a negative accuracy status.

Current baseline:

- **-15 percentage points accuracy**;
- non-stacking;
- reapplication refreshes duration rather than compounding accuracy loss.

Blind amount and duration are authorable/versioned within validation bounds. Initial current content should generally use 1–4 owner-turn duration ticks and an accuracy penalty no stronger than 30 percentage points without explicit high-cost balancing.

Blind affects any action using the current accuracy-check pipeline; it does not make Automatic Hit Skills roll accuracy.

## 9. Generalized Skill accuracy pipeline

The current engine's stat-driven hit roll is Basic-Attack-specific. That limitation is removed for current content.

### 9.1 Authoring fields

Every current direct combat Skill definition exposes:

- `accuracyMode`: `automatic | per-target`;
- `accuracyModifierBasisPoints`: signed authored modifier, normally between -3000 and +3000 basis points unless validator policy for a special Skill explicitly permits more.

Master Panel labels these as:

- **Accuracy check:** `Automatic Hit` or `Accuracy Roll`;
- **Accuracy modifier:** signed percentage-point adjustment.

Basic Attack remains accuracy-based.

Ground/environmental effects and Skills intended to resolve automatically may use Automatic Hit. Direct offensive Skills should normally use Accuracy Roll unless their identity deliberately pays for certainty.

### 9.2 Hit chance

For an accuracy-rolled target, current hit chance is based on:

`actor Accuracy - target Evasion + Skill accuracy modifier + applicable Mark bonus - applicable Blind penalty`

The result is clamped to 0–100% using basis-point arithmetic.

Mark applies only when the actor is the source of that Mark on the target.

Blind applies to the acting combatant regardless of target.

### 9.3 Multi-target commands

For `per-target` Circle/Line/multi-unit Skills:

- each affected hostile unit receives an independent hit roll;
- RNG consumption order is deterministic using stable affected-unit ordering;
- all hostile unit effects for that recipient are gated together by that recipient's hit result unless an individual effect is explicitly authored as ungated in a future design;
- actor/self effects and resource costs resolve regardless of hostile target hit result;
- preview shows hit chance per target but does not consume RNG.

This keeps damage + debuff packages coherent: if a strike misses one target, its Burn/Blind/Mark application to that target also misses.

### 9.4 Preview and AI

Preview and AI read the same generalized hit-chance function used by commit.

Preview exposes probabilities, not future RNG outcomes.

AI utility values expected outcomes using hit probability and cannot assume a hit before commit.

## 10. Reflect

### 10.1 Identity

`Reflect` is a positive reactive status with an authored percentage.

When its owner suffers qualifying **hostile direct command damage**, Reflect returns damage to the source attacker equal to the authored percentage of the **actual HP damage suffered**.

Current initial balance range should generally be **15% to 40%**.

### 10.2 Command aggregation

Reflect resolves **once per attacker -> defender command relationship**, not once per hit packet.

For a multi-hit command against one reflecting defender, qualifying actual HP damage to that defender is summed and reflected once after the command's ordinary effects for that defender resolve.

For an AoE command hitting multiple reflecting defenders, each defender may independently return one reflected damage instance to the attacker.

### 10.3 Resolution and defeat

Reflect damage:

- is reactive fixed damage;
- does not roll accuracy;
- ignores Armor/Ward unless a later version explicitly changes this;
- cannot itself be Reflected;
- cannot trigger Absorb HP/MP;
- can defeat the attacker;
- can create a mutual KO/draw when terminal-state rules otherwise produce no surviving winning team.

Reflect does not fire if there is no source attacker combatant.

## 11. Pierce

`Pierce` is an offensive damage property/tag.

A Piercing damage effect ignores the target's **defensive mitigation** for that damage instance, including:

- Armor/Ward defense rating mitigation;
- Guard-style incoming damage reduction;
- Fortified incoming damage reduction;
- Warded/Summoned and similar positive incoming damage-reduction modifiers;
- other current positive defensive multipliers explicitly classified as mitigation.

Pierce does **not** remove or suppress the target's statuses.

Pierce does **not** ignore:

- vulnerabilities that increase damage taken, such as Expose/Off-guard where applicable;
- the attacker's own outgoing damage bonuses/penalties;
- elemental interactions unless separately authored;
- reactive effects such as Reflect, Absorb HP, or Absorb MP;
- immunity/invalid-target rules such as Invisible selection restrictions;
- accuracy/evasion unless the Skill is also authored Automatic Hit.

The Master Panel authors Pierce on specific damage effect blocks rather than as a global character toggle.

## 12. Vengeance

### 12.1 Identity

`Vengeance` is a direct damage effect whose magnitude is derived from recent damage suffered by the user.

The authoritative encounter keeps a bounded per-combatant damage-history ledger by battle round.

At use time, Vengeance reads qualifying actual hostile HP damage suffered during:

- the **current round**;
- the **previous round**;
- the **round before that**.

This is always a three-round sliding window when those rounds exist.

### 12.2 Qualifying damage history

Count actual HP loss caused by hostile sources, including ordinary hostile direct attacks and hostile periodic DoT damage.

Do not count:

- self-inflicted damage;
- Burn backlash caused by the user's own attack;
- Reflect damage;
- system damage/penalties;
- overkill beyond HP actually available;
- damage prevented by mitigation;
- healing subsequently received.

Healing does not erase recorded damage history.

### 12.3 Authored conversion

A Vengeance Skill authors:

- conversion percentage of qualifying three-round damage history;
- minimum damage if desired;
- maximum damage cap;
- ordinary target/accuracy behavior;
- whether its Vengeance damage block is Piercing.

The validator requires a finite cap so long battles or burst windows cannot create unbounded one-shot damage.

Vengeance preview shows the currently calculable damage amount and explains the three-round basis. Commit uses the same ledger value unless another action changed state first, in which case normal battle-version concurrency prevents stale commit.

## 13. Amplify

### 13.1 Identity

`Amplify` copies eligible **positive active effects from the target onto the user** for the current battle state.

The target keeps all of its effects. Amplify is copying, not stealing or dispelling.

### 13.2 Copied state

For each eligible effect, Amplify copies its **current** state, including applicable:

- remaining duration;
- stack count up to the receiving definition's cap;
- current stage/counter when the effect explicitly supports copyable dynamic state;
- versioned definition identity.

The new copied instance belongs to the Amplify user.

Source attribution is rebound to the Amplify user when the effect's mechanics can be meaningfully rebound. Effects whose mechanics fundamentally require their original external source must set `amplifyCopyable = false` unless they define an explicit clone rule.

### 13.3 Exclusions

Amplify never copies:

- Essence or Resonance identity/effects that are not represented as ordinary copyable active effects;
- cooldown state;
- AP/MP pools;
- permanent build/progression state;
- copied temporary Skills;
- terrain;
- neutral/mixed/system effects by default;
- effects marked non-copyable.

If the target has no eligible positive effects, Amplify is illegal for that target unless the containing Skill has another independently meaningful effect and its authored rule explicitly permits the Amplify block to no-op.

Initial implementation should prefer fail-fast/illegal targeting for pure Amplify Skills so preview is clear.

## 14. Curse

### 14.1 Identity

`Curse` copies eligible **negative active effects from the user onto the target**.

The user keeps the original negative effects.

### 14.2 Copied state

Curse copies current effect state subject to receiving caps and clone rules.

Current special cases:

- **Poison:** copy Poison with its current movement counter; target receives one non-stacking Poison instance. If target already has Poison, normal non-stacking reapplication rules win rather than creating a second instance.
- **Burn:** copy the current Burn stage/remaining sequence rather than restarting at 4 damage unless the target already has Burn and normal reapplication rules restart/replace it under the pinned Burn definition.
- **Bleed:** copy current independent Bleed stacks in stable order, respecting the target's maximum 3-stack replacement rule.
- **Blind/Slow/Hex/Expose/etc.:** copy remaining duration and authored magnitude under their versioned definition.

Source attribution for newly cursed effects is the Curse user when source identity matters. This prevents copied debuffs from granting mechanics to an unrelated historical applier.

### 14.3 Exclusions

Curse never copies:

- PvP timeout Off-guard/system penalties;
- neutral/mixed effects by default;
- self-cost markers;
- cooldowns/resources/build state;
- effects marked `curseCopyable = false`.

A pure Curse Skill targeting a user with no eligible negative effects is illegal and preview explains why.

## 15. Interaction ordering

For a committed Skill command, current ordering is:

1. validate action/target/resource legality;
2. determine affected units/tiles;
3. calculate per-target hit chances where applicable;
4. consume deterministic hit RNG in stable order at commit only;
5. resolve ordinary direct effects in authored order for successful recipients;
6. record actual qualifying HP damage in the round damage ledger;
7. resolve non-recursive reactive consequences such as Reflect/Absorb from the committed damage summary;
8. resolve Burn attack backlash if applicable;
9. resolve defeat/terminal state after the full command consequence chain;
10. spend/record cooldown/AP/MP according to existing authoritative command rules.

Where the existing engine must spend command resources before individual effect application for transaction safety, implementation may preserve that internal transaction shape as long as externally observable outcomes and rollback legality match this ordering and no partial committed state escapes.

## 16. Master Panel authoring additions

The approved Combat Content editor must expose typed authoring for the new mechanics.

At minimum add:

### Accuracy

- Automatic Hit / Accuracy Roll;
- signed accuracy modifier;
- previewed target hit chance in simulation.

### Absorb HP / Absorb MP

- percentage;
- duration;
- stacking policy where supported;
- recipient.

### Reflect

- percentage;
- duration;
- recipient.

### Pierce

- boolean/property on each damage effect block.

### Blind

- accuracy penalty;
- duration;
- recipient.

### Mark

- source-specific accuracy bonus;
- duration;
- recipient.

### Vengeance

- conversion percentage;
- minimum damage if non-zero;
- maximum cap;
- Pierce toggle for the Vengeance damage block;
- ordinary target/accuracy fields.

### Amplify / Curse

- typed effect block;
- recipient/source rules fixed by the effect contract rather than arbitrary script;
- validation against impossible/self-contradictory target specs.

Publishing still creates immutable versions and never rewrites a version pinned by an existing battle.

## 17. Discipline Skill roster rebalance authority

The implementation must perform a deliberate audit of **every current regular Discipline Skill** across all 17 Disciplines.

This is not a mechanical rename pass.

For each Skill, evaluate:

1. role/fantasy fit;
2. AP efficiency;
3. MP/cooldown burden;
4. direct output;
5. range/shape/target flexibility;
6. reliability through the new accuracy system;
7. setup/payoff dependencies;
8. DoT value under new Poison/Bleed/Burn rules;
9. displacement value under variable Push/Pull;
10. Haste/Slow movement-AP value;
11. recovery-over-time value;
12. Copy's battle-long half-AP value;
13. new reactive/effect-copying value;
14. AI usability;
15. PvE/PvP abuse risk;
16. overlap/redundancy with another Skill in the same Discipline.

### 17.1 Balance guardrails

- Do not give every Discipline every new mechanic.
- A Skill combining damage + hard control + sustain + mobility/reactivity must pay for the package through AP/MP/cooldown/output trade-offs.
- Persistent Poison is priced as battle-long pressure, not as an ordinary short DoT.
- Stackable Bleed is priced assuming a realistic route to 3 stacks.
- Burn is priced for both decaying DoT and attack backlash pressure.
- Copy is priced for the battle-long command grant and 50% AP discount.
- Reflect/Absorb percentages are priced as expected prevented/recovered/returned value over their duration.
- Pierce is priced for bypassing mitigation and should not become a cheap universal answer to defense.
- Blind/Mark are priced using expected hit-probability swing, not as cosmetic debuffs.
- Vengeance must have a cap and cannot become a low-cost guaranteed one-shot after ordinary focus fire.
- Amplify/Curse are priced by the maximum realistic state they can duplicate, with cooldown/AP safeguards where necessary.

### 17.2 Versioning

Do not mutate historical Skill versions in place.

Rebalanced Skills receive new immutable content versions. Current selection/loadout publishing points new battles/build updates to the new versions according to existing content lifecycle rules.

Existing committed battle snapshots continue resolving their pinned versions.

## 18. Presentation and battle UI

Centralized player-facing labels must include the new compact names and the previously approved vocabulary.

Battle Skill details/forecast should surface enough information to make mechanics actionable:

- Absorb/Reflect percentage and remaining duration;
- Blind/Mark accuracy change;
- actual hit chance after Blind/Mark and Skill modifier;
- Vengeance current three-round damage basis and capped projected damage;
- Pierce indicator on relevant damage;
- Amplify eligible positive effects on the chosen target before commit;
- Curse eligible negative effects currently on the user;
- copied status/effect inspection after Amplify/Curse;
- Copy's eligible Skill count without revealing the random committed result;
- DoT counters/stacks/stages from the prior approved design.

Preview must not consume authoritative RNG.

## 19. AI requirements

AI uses the same authoritative definitions and mechanics.

Utility evaluation must account for:

- hit chance after Blind/Mark;
- expected Reflect self-risk;
- expected Absorb recovery value;
- Pierce value against high mitigation;
- current Vengeance ledger value;
- available Amplify/Curse copy targets;
- DoT state and movement-triggered Poison risk;
- Copy's random eligible pool and half-AP future options.

AI must not read future RNG outcomes.

## 20. Historical compatibility

Compatibility remains mandatory.

Do not reinterpret historical snapshots merely because they share internal IDs such as `marked`, `burn`, `poison`, or `bleed`.

Pinned old versions retain their old semantics, including old Mark damage-vulnerability behavior and old initiative/Regeneration/displacement behavior where previously committed.

New battle snapshots carry the definition/version data and encounter extensions required for:

- dynamic DoT state;
- temporary copied Skills;
- signed movement AP modifiers;
- scheduled recovery;
- damage provenance;
- per-round damage history for Vengeance;
- Amplify/Curse cloneable effect state;
- deterministic accuracy/Copy RNG.

## 21. Validation and failure behavior

Authoring/publish validation rejects at minimum:

- out-of-range percentages;
- negative/overflow caps;
- invalid accuracy modifiers;
- unsupported polarity/copyability combinations;
- Pierce on non-damage effect blocks;
- Vengeance without a finite positive cap;
- Amplify/Curse with target contracts that cannot supply their required source/recipient;
- system effects marked copyable;
- recursive reactive configuration;
- malformed durations/stacks;
- any definition failing the shared combat schema.

At runtime, illegal pure Copy/Amplify/Curse targets are rejected before spending AP/MP and preview explains the reason.

## 22. Testing contract

Implementation is not complete without automated coverage for all of the following.

### Core mechanics

- Absorb HP/MP uses actual qualifying damage and cannot rescue lethal damage;
- Absorb/Reflect anti-recursion exclusions;
- Reflect aggregates multi-hit damage once per defender/command and can cause mutual KO;
- Pierce bypasses mitigation but not vulnerability, accuracy, or reactive effects;
- Blind lowers rolled Skill/Basic Attack hit chance;
- Mark benefits only its source against its marked target;
- historical Mark retains old behavior under its pinned version;
- multi-target Skill accuracy rolls are deterministic and per target;
- preview never consumes hit RNG;
- Vengeance reads exactly current + previous two rounds and respects cap;
- healing does not erase Vengeance history;
- Amplify copies only eligible positive current state without removing it from target;
- Curse copies only eligible negative current state without removing it from user;
- Poison/Burn/Bleed special clone rules work;
- Off-guard/system penalties cannot be Cursed;
- mixed/neutral effects are excluded by default.

### Existing approved mechanics

Regression coverage remains required for:

- Push/Pull X;
- Displaced;
- Haste/Slow movement AP;
- Heal X / MP Rec X;
- Poison movement counter;
- independent Bleed stacks;
- decaying/reactive Burn;
- Copy deterministic selection and half AP;
- historical snapshot compatibility.

### Content and UI

- every current enabled Discipline Skill validates under the new schema;
- no current Skill points to retired current-only status semantics unintentionally;
- compact presentation tags match mechanics;
- battle forecast/log/effect inspection presents new mechanics correctly;
- PvE/PvP use the same shared definitions and battle components where applicable;
- Master Panel publishes immutable versions and existing battle snapshots remain unchanged.

## 23. Documentation updates required during implementation

Update at minimum:

- `docs/COMBAT.md`;
- applicable Master Panel/operator documentation;
- any current roster/content authority docs that enumerate Skill mechanics;
- affected tests/fixtures that describe old Mark, DoT, initiative, Regeneration, displacement, or accuracy behavior.

Do not rewrite historical migration documentation to pretend old behavior never existed.

## 24. Completion criteria

This extension is complete only when:

1. all eight new effect tags are mechanically implemented and authorable where applicable;
2. Mark uses source-specific accuracy instead of current damage vulnerability for new content;
3. the generalized accuracy pipeline supports current authored Discipline Skills and Basic Attack;
4. preview/commit/AI share the same accuracy and effect rules;
5. all 17 regular Discipline Skill rosters have been deliberately audited and rebalanced where justified;
6. changed Skills publish as new immutable versions;
7. Amplify/Curse use explicit polarity/copyability rather than name guessing;
8. Vengeance uses authoritative three-round damage history;
9. reactive loops are impossible under current definitions;
10. historical battles retain pinned legacy semantics;
11. PvE/PvP shared parity remains intact;
12. focused tests, full relevant suites, typecheck, lint, and build pass before completion is claimed;
13. no production deployment occurs without explicit Owner authorization in the current work item.
