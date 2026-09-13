# AUREVANE — Covert, Sensory, and Revealed Combat Design

**Status:** Owner-approved architectural extension  
**Approved in chat:** 2026-09-12  
**Task branch:** `agent/combat-effect-taxonomy-rework`  
**Extends:** `2026-09-12-reactive-effects-accuracy-discipline-rebalance-design.md`, `2026-09-12-combat-authoring-dots-copy-revision-design.md`, and `2026-09-12-combat-effect-taxonomy-rework-design.md`

## 1. Authority and scope

This document adds three related combat concepts to the approved combat rework:

- `Covert` — temporarily hides the user's new action details and positive buff/status information from opposing viewers;
- `Sensory` — an active counter effect that attempts to expose a Covert target;
- `Revealed` — the negative state applied to the Sensory target when Sensory successfully finds Covert.

All earlier approved rules remain in force unless this document explicitly changes them.

These mechanics are information-security and combat-economy mechanics, not cosmetic log formatting. The authoritative battle state must remain complete on the server while each viewer receives only the information they are entitled to see.

Production deployment remains separately Owner-controlled.

## 2. Player-facing tags and versioning

Add current typed combat tags/effects:

- `Covert X` — X is the authored duration in owner-turn boundaries;
- `Sensory` — identifies a Skill containing the Sensory counter effect;
- `Revealed X` — X is the remaining Revealed duration when shown as an active negative effect.

Internal IDs may remain stable implementation identifiers such as `covert` and `revealed`, but the display labels above are derived from the versioned definition rather than manually typed presentation strings.

Historical battles never gain these mechanics retroactively.

## 3. Covert

### 3.1 Identity

Covert is a positive, non-stacking active status. Reapplication refreshes its authored duration rather than creating multiple Covert instances.

Current authoring duration bound: **1–4 owner-turn-start boundaries**.

Covert ends through normal duration expiry, Dispel/removal, successful Sensory Reveal, or another explicitly authored effect that removes it.

Covert is deliberately **not Amplify-copyable**. `amplifyCopyable = false` prevents Amplify from duplicating a secrecy mechanic whose value depends on information entitlement.

### 3.2 Who Covert hides information from

Covert redaction is team-relative:

- the Covert combatant sees their own full state and full action log details;
- allied/same-team controlled viewers see the full state and full action log details;
- opposing viewers receive the redacted Covert projection;
- server/admin/debug authority may inspect the full authoritative record through protected tooling;
- spectators follow the battle mode's viewer entitlement policy and must never receive hidden information merely because they are spectators.

A viewer must not be able to infer hidden information by switching between battle UI surfaces that use different projection paths.

### 3.3 Hidden positive buff/status information

While Covert is active, opposing viewers do not receive the Covert combatant's positive active buff/status identities or details.

This includes Covert itself and ordinary positive active effects such as, when present under current definitions:

- Guard;
- Haste;
- Inspire;
- Ghost/Invisible;
- Absorb HP;
- Absorb MP;
- Reflect;
- other active effects whose versioned metadata classifies them as `polarity: positive`.

The projection must not leak hidden buffs through:

- status chips;
- buff names;
- buff count badges;
- hidden placeholder slots whose count reveals how many buffs exist;
- tooltip text;
- active-effect summaries;
- battle-inspect views;
- mobile/desktop parity differences;
- raw browser-visible battle JSON.

Negative effects remain visible to opponents unless a separate mechanic explicitly hides them. Neutral/mixed/system effects follow their own visibility policy and are not automatically hidden merely because Covert exists.

### 3.4 What Covert does not hide

Covert does not make the combatant invisible on the tactical board and does not falsify public battle state.

Opponents still receive public/observable information such as:

- board position;
- facing where normally visible;
- HP and MP values/meters under the current battle visibility rules;
- defeat state;
- negative statuses that are otherwise public;
- terrain and public board changes;
- round/turn ownership;
- battle completion.

Covert hides action causality/details and positive buff/status information; it does not create fake HP, fake positions, or a second secret simulation.

## 4. Covert action-log redaction

### 4.1 Commands covered

When a combatant begins a committed **action command** while Covert, opposing viewers must not receive the action's identity or detailed causal event chain.

Current covered action commands:

- Basic Attack;
- regular Discipline Skills;
- copied Skills;
- Essence Skills;
- Guard;
- HP Recover;
- MP Recover;
- future ordinary action commands explicitly routed through the same action-resolution contract.

Ordinary movement, facing selection, turn start/end, timeout, surrender, and system lifecycle events are not hidden by Covert because those are separately observable tactical/system events rather than hidden action identities.

### 4.2 Generic opponent-facing entry

For an opposing viewer, a covered command that began while Covert is represented by one generic log entry such as:

`<Combatant> performed an action.`

The entry must not expose:

- action/Skill name;
- action ID;
- artwork/Skill icon that identifies the action;
- AP or MP cost if that cost would identify the Skill;
- effect names attributable to the hidden command;
- hit/miss wording tied to the hidden action;
- targeting shape/range;
- copied/Essence source identity;
- source Discipline identity inferred only from the hidden action.

The exact generic wording may be polished in UI, but it must remain semantically non-identifying.

### 4.3 Child-event collapse

The current battle log persists action use, damage, healing, resource changes, status changes, displacement/terrain changes, and other consequences as separate events. Merely renaming `combat_action_used` is therefore insufficient.

Authoritative action execution gains stable command-resolution provenance (for example a `resolutionId`/`commandExecutionId`) on every event caused by the same committed action.

For opposing viewers when the actor was Covert at command start:

1. the log projection emits one generic Covert action entry;
2. detailed action-caused child entries are omitted/redacted for that viewer;
3. unrelated/system events are retained;
4. terminal battle events remain visible;
5. the authoritative stored event stream remains complete and unchanged for entitled viewers and server reconciliation.

The Covert state is sampled at **command start** for that command's log visibility. If the command itself removes, expires, or otherwise changes Covert during resolution, the command remains hidden because it began under Covert.

### 4.4 Observable outcomes remain authoritative

Covert log redaction does not undo actual state changes. If a hidden action changes HP, MP, position, terrain, or applies a public negative state to another unit, the resulting authoritative battle snapshot still reflects that state according to ordinary visibility rules.

This can let an opponent infer possibilities from observable consequences, which is intentional. Covert prevents the log/UI from explicitly identifying the hidden action; it does not guarantee that every consequence is unknowable.

## 5. No retroactive disclosure

Actions successfully hidden while Covert remain hidden for opposing viewers even after Covert ends or the combatant later becomes Revealed.

Sensory/Revealed affects **future** information visibility from successful Reveal onward. It does not rewrite old projected log history to expose previously hidden Skill names or child-event details.

Server/admin history remains complete throughout.

## 6. Sensory

### 6.1 Identity

Sensory is a typed Skill effect that attempts to reveal one primary target.

Sensory itself is not a persistent status. A Skill carrying the effect displays the `Sensory` tag.

The Sensory effect resolves against the primary unit after ordinary action legality/accuracy rules for the containing Skill have succeeded.

### 6.2 Hidden-condition privacy

Whether a target currently has Covert is itself hidden from opposing viewers. Therefore Sensory target legality and preview **must not leak Covert**.

A Sensory Skill may be legally targeted at a unit even when the viewer cannot know whether that unit is Covert.

Preview may state the conditional rule, for example:

`If the target is Covert: remove its positive buffs and apply Revealed X.`

Preview must not say whether the condition is currently true for an opposing viewer.

This supersedes any earlier recommendation that a pure Sensory Skill become illegal against a non-Covert target; such legality would leak the hidden state before commit.

### 6.3 Successful Sensory resolution

At commit, after the containing Skill successfully reaches/hits its primary target:

- if the target is Covert, Sensory succeeds;
- if the target is not Covert, the Sensory block has no effect and does not apply Revealed;
- other independently authored effects on the same Skill resolve according to their normal rules.

A pure Sensory Skill may therefore consume its normal resources and fail to reveal anything when the player guessed incorrectly. This preserves Covert secrecy.

## 7. Revealed

### 7.1 Application target

**The Sensory target** receives Revealed. The Sensory user does not.

On successful Sensory resolution against a Covert target:

1. purge the target's eligible positive buffs;
2. remove Covert as part of that purge;
3. apply `Revealed X` to that target;
4. subsequent target actions are no longer Covert-redacted;
5. the target's qualifying Skill AP costs are doubled while Revealed remains.

### 7.2 Duration and stacking

Revealed is a visible negative, non-stacking status.

Current authoring duration bound: **1–4 owner-turn-start boundaries**.

Reapplication refreshes duration rather than stacking multiple AP multipliers.

Revealed is Cleanse-removable under ordinary negative-status removal rules unless a specific future version explicitly says otherwise.

Revealed is `curseCopyable = false`. Curse cannot bypass the Sensory/Covert condition by cloning Revealed onto an unrelated target.

### 7.3 Covert lockout

While Revealed is active, the target cannot gain Covert.

Attempts to apply Covert to a Revealed unit fail/no-op according to the containing effect's normal application semantics and produce truthful entitled feedback.

This prevents immediate re-hiding while the counter-state is active.

## 8. Reveal buff purge

### 8.1 Meaning of “lose all buffs”

On successful Sensory Reveal, the **target** loses every current active effect instance whose pinned definition is classified `polarity: positive`, except protected permanent/system/build identity that is not an ordinary removable active buff.

Expected removable examples include:

- Covert;
- Guard;
- Haste;
- Inspire;
- Ghost/Invisible;
- Absorb HP;
- Absorb MP;
- Reflect;
- other ordinary current positive statuses/buffs.

The purge is semantic and definition-driven; it must not maintain a hard-coded list of names in the Sensory resolver.

### 8.2 Things Reveal does not purge

Successful Reveal does not remove merely beneficial state that is not an active buff, including:

- current HP/MP;
- Action Economy/AP itself;
- scheduled `Heal X` or `MP Rec X` recovery instances;
- copied temporary Skills;
- cooldown/repeat-use history;
- Primary/Secondary Discipline identity;
- Essence/Resonance identity;
- progression/mastery/build data;
- terrain;
- permanent scenario/system identity;
- negative effects.

If a future active effect is beneficial but intentionally protected from buff removal, its versioned definition must explicitly classify it outside the ordinary removable-positive-buff contract.

### 8.3 Purge ordering

The positive-buff purge happens before Revealed is applied.

The purge emits full authoritative removal events. Opposing viewers are entitled to see the Reveal outcome from that point forward; same-team/owner viewers also see the full removal list.

Previously hidden action history remains hidden as specified in section 5.

## 9. Revealed Skill AP multiplier

### 9.1 Qualifying commands

While Revealed, multiply the target combatant's AP cost by **2** for:

- regular Discipline Skills;
- copied Skills;
- Essence Skills;
- future action definitions explicitly classified as Skills.

Do not double:

- ordinary movement AP;
- Basic Attack;
- Guard;
- HP Recover;
- MP Recover;
- final facing;
- non-Skill system commands.

MP/resource costs are unchanged.

### 9.2 Cost-order rule

Resolve intrinsic Skill cost transforms before Revealed.

Current required order:

1. start from the pinned Skill's authored AP cost;
2. apply intrinsic command transformation such as Copy's `ceil(original AP / 2)`;
3. apply Revealed's `×2` Skill AP multiplier;
4. apply any future explicitly ordered global Skill-cost rule;
5. validate affordability against current Action Economy.

Example:

- original Skill 35 AP;
- copied version = `ceil(35 / 2) = 18 AP`;
- copied combatant is Revealed;
- final Skill AP cost = `18 × 2 = 36 AP`.

A Skill made unaffordable by Revealed is simply unavailable until the actor has sufficient AP or Revealed ends/gets Cleansed.

### 9.3 Preview and AI

The Revealed combatant's own action preview shows the doubled AP cost before commit.

AI uses the same final cost calculation and must not plan using the undiscounted/unmultiplied base value.

Opponent UI may display ordinary public cost information where the current product already exposes it, but hidden Covert state must never be inferred through preview side channels.

## 10. Snapshot and viewer-specific projection

The current server projection removes RNG but otherwise exposes broad authoritative battle state. Covert requires a viewer-aware projection boundary.

Authoritative persistence continues to store full state.

Before battle state reaches the browser, the server builds a projection using at minimum:

- viewer user/participant identity;
- controlled combatant IDs;
- viewer team entitlement;
- target combatant team;
- active Covert/Revealed state;
- effect polarity/visibility metadata.

For opposing viewers, positive buff/status instances belonging to a Covert combatant are omitted before serialization.

Do not send hidden values to the browser and rely on CSS/React to conceal them.

PvE, PvP, team PvP, reconnect, spectator, and battle-log endpoints must use compatible visibility policy so another endpoint cannot become an information oracle.

## 11. Battle-log service architecture

Battle event persistence remains full-fidelity.

The log service becomes viewer-aware instead of converting stored events into the same `BattleLogView` for every authorized participant.

Implementation must be able to determine, for each historical committed action:

- actor combatant;
- actor team;
- viewer team/entitlement;
- whether actor was Covert at command start;
- action resolution/event grouping identity.

The redaction decision must use persisted authoritative provenance, not the actor's **current** Covert state at log-fetch time. Otherwise old entries could incorrectly appear/disappear when Covert expires.

## 12. Interaction rules with other approved effects

### Amplify

- Covert is positive but not Amplify-copyable.
- Revealed is negative and not Amplify-copyable.
- Sensory is an action effect, not an active effect to copy.

### Curse

- Revealed is not Curse-copyable.
- Covert is positive and therefore not a Curse source.
- Sensory is not a persistent Curse-copyable state.

### Dispel

- Covert is an ordinary positive status and can be removed by a legal Dispel effect.
- Dispel need not know/show the hidden buff name before commit; the server resolves it authoritatively.

### Cleanse

- Revealed is an ordinary negative status and can be removed by Cleanse.
- Cleanse does not restore the positive buffs that Sensory already purged.

### Ghost / targeting

Covert is not invisibility. Covert by itself does not prevent target selection. Ghost/Invisible continues to control selection restrictions under its own rules.

### Copy

A copied Sensory Skill keeps its normal Sensory behavior and Copy AP discount. If the copier is Revealed, the Copy discount resolves before the Revealed ×2 multiplier.

Copy cannot gain information about a Covert target's hidden buff list or hidden past action names.

### Pierce / Reflect / Absorb / DoTs

Covert does not alter their mechanics. It only changes opponent-facing information entitlement while active.

Sensory's buff purge can remove positive Reflect/Absorb effects before later commands, but Sensory does not retroactively change already-resolved reactions.

## 13. Master Panel authoring

The Combat Content editor gains typed authoring support for:

### Covert

- status application recipient;
- duration X (1–4 current bound);
- non-stacking/refresh semantics fixed by current Covert profile;
- derived `Covert X` tag;
- visibility metadata fixed by the current versioned Covert definition.

### Sensory

- primary-unit recipient;
- Revealed duration X (1–4 current bound);
- normal containing-Skill target/range/shape/accuracy fields;
- derived `Sensory` tag;
- conditional description generated from the typed effect.

### Revealed

Revealed is the typed result of Sensory and not an unrestricted arbitrary status block for ordinary current Skill authoring unless a future Owner-approved design permits other application sources.

This prevents ordinary Skills from bypassing the intended “Sensory counters Covert” condition.

Publishing creates new immutable content versions under the already approved authoring/versioning rules.

## 14. Discipline Skill rebalance implications

The roster-wide regular Discipline Skill audit may assign Covert and Sensory where they fit Discipline identity.

Balance expectations:

- Covert is significant PvP information denial and should carry a real AP/cooldown/opportunity cost;
- long-duration Covert should not be paired cheaply with top-tier offense, Ghost, or broad defensive stacks;
- Sensory is a conditional hard counter and may be cheaper than a universal Dispel because it can fail when the target is not Covert;
- successful Sensory is powerful because it both purges positive buffs and applies a temporary ×2 Skill AP tax;
- therefore Revealed duration, Sensory AP cost, cooldown, range, and any additional damage/effects must be evaluated together;
- do not distribute Covert/Sensory across every Discipline merely to use the mechanic;
- preserve each Discipline's established fantasy and role.

The full audit must explicitly check whether existing stealth/information, scouting/awareness, debuff, and anti-buff Skills are better thematic homes for these mechanics than creating redundant new identities.

## 15. Testing requirements

### Covert projection

Tests must prove:

- owner sees own positive buffs while Covert;
- same-team viewer sees allied positive buffs while Covert;
- opponent does not receive Covert or other positive buff identities/counts/details;
- negative effects remain visible;
- raw browser projection contains no hidden positive status payload;
- desktop/mobile/inspect surfaces cannot recover hidden values;
- reconnect preserves the same entitlement;
- spectator policy does not leak hidden values.

### Covert log

Tests must prove:

- Basic Attack/Skill/Copy/Essence/Guard/Recover are redacted for opponents when command begins Covert;
- one generic action entry replaces the detailed child-event chain;
- owner/allies still see full logs;
- movement/facing/system events remain visible;
- action that removes Covert mid-resolution is still hidden if it began Covert;
- later Covert expiry does not retroactively reveal old actions;
- server/admin authoritative event history remains full-fidelity;
- battle completion/system terminal events are not hidden.

### Sensory privacy

Tests must prove:

- preview/target legality does not reveal whether opponent is Covert;
- pure Sensory can legally be attempted on non-Covert target and no-ops its Sensory block;
- successful hit/reach against Covert target triggers Reveal;
- miss/failed containing action does not Reveal;
- Revealed applies to the **target**, not the Sensory user.

### Buff purge

Tests must prove successful Reveal:

- removes Covert;
- removes all ordinary positive active buffs;
- preserves negative statuses;
- preserves scheduled Heal/MP Rec recovery;
- preserves copied Skills/cooldowns/build identity/resources;
- emits correct authoritative removal events;
- does not restore purged buffs when Revealed is Cleansed.

### Revealed AP

Tests must prove:

- regular Discipline Skill cost ×2;
- Essence Skill cost ×2;
- copied Skill applies Copy half-cost first, then Revealed ×2;
- Basic Attack unchanged;
- Guard unchanged;
- Recover unchanged;
- movement AP unchanged;
- MP costs unchanged;
- affordability/preview/commit/AI all use the same final cost.

### Cross-effect rules

Tests must prove:

- Covert cannot be Amplified;
- Revealed cannot be Cursed;
- Dispel can remove Covert;
- Cleanse can remove Revealed but does not restore purged buffs;
- Revealed blocks new Covert application;
- Copy of Sensory remains functional;
- historical battles without these definitions retain old projection/log behavior.

## 16. Acceptance criteria

This extension is complete when:

1. Covert is a versioned positive status with authored X duration.
2. Opponents cannot obtain Covert user's positive buff identities/details from any battle projection surface.
3. Covered actions begun under Covert appear to opponents only as one generic action entry, with detailed action-caused child events redacted from their log view.
4. Owner/allies/server authority retain full information.
5. Hidden historical actions never become retroactively visible when Covert ends or Sensory succeeds later.
6. Sensory preview/legality does not reveal hidden Covert state.
7. Successful Sensory against a Covert target purges that target's ordinary positive buffs, removes Covert, and applies Revealed X.
8. Sensory against a non-Covert target does not apply Revealed.
9. Revealed doubles only qualifying Skill AP costs, including Discipline/Copy/Essence, while leaving movement/basic/Guard/Recover/MP costs unchanged.
10. Copy half-cost resolves before Revealed ×2.
11. Revealed blocks Covert until Revealed ends or is Cleansed.
12. Covert is not Amplify-copyable and Revealed is not Curse-copyable.
13. PvE, PvP, team/spectator/reconnect and battle-log paths share the same entitlement policy.
14. The Master Panel can author Covert duration and Sensory/Revealed duration through typed validated fields.
15. The Discipline Skill rebalance accounts for the power of information denial, buff purge, and the Skill AP tax rather than treating these as free tags.
