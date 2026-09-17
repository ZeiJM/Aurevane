# AUREVANE — Combat Authoring, DoT Identity, and Copy Revision

**Status:** Owner-approved design revision; supersedes conflicting sections of `2026-09-12-combat-effect-taxonomy-rework-design.md`  
**Approved in chat:** 2026-09-12  
**Task branch:** `agent/combat-effect-taxonomy-rework`

## 1. Authority and scope

This revision extends the approved combat-effect taxonomy rework and supersedes its earlier Burn/Bleed/Poison spatial-identity design.

All non-conflicting rules in the original design remain approved, including compact tags, variable Push/Pull, Haste/Slow movement AP, Heal/MP Rec duration, historical compatibility, and roster-wide rebalance.

This revision adds three architectural requirements:

1. Skill targeting/effect routing must be versioned, data-driven, and authorable from the protected Master Panel rather than requiring source edits for ordinary balance/content changes.
2. Poison, Bleed, and Burn gain mechanically distinct persistent/stacking/reactive identities independent of target shape.
3. A new `Copy` effect/tag grants a random eligible regular Skill from a target for the remainder of the battle at half AP cost.

Production deployment remains separately Owner-controlled.

## 2. Skill targeting is authored content

Target shape is a property of the Skill, not of its status/effect identity.

Burn, Bleed, Poison, Guard, Copy, damage, healing, displacement, and other effects do not force a particular target shape. A designer may author a single-target Poison Skill, a Circle Burn Skill, a Line Bleed Skill, a ground-targeted Copy setup Skill where the primary unit is selected through the ground effect, or any other combination that passes validation.

### 2.1 Master Panel Skill/Combat Content editor

The implementation must ship the minimum real protected editor needed to author current Skill combat definitions. It must not be a fake UI over hard-coded source values.

For a Skill draft, authorized Owner/content staff can configure at minimum:

- target kind: Self / Unit / Ground / Empty Tile;
- team policy: Self / Ally / Enemy / Anyone;
- minimum range;
- maximum range;
- line-of-sight requirement;
- maximum elevation difference;
- target shape: Single / Circle X / Line X;
- Circle radius X;
- Line maximum length X;
- friendly-fire policy;
- ordered effect sequence;
- recipient for each effect where that effect supports recipient selection;
- AP cost;
- MP/resource cost;
- enabled/version state;
- current compact presentation tags derived from the definition rather than typed by hand.

The editor follows the existing Master Panel authority model:

`EDIT DRAFT -> VALIDATE -> VIEW DIFF -> PREVIEW/SIMULATE -> PUBLISH -> MONITOR -> ROLLBACK`

Publishing creates a new immutable content version. It never silently rewrites a version already pinned by a committed battle.

### 2.2 Validation

The editor must reject invalid combinations before publication, including impossible ranges, invalid shapes, unsafe effect parameters, unsupported recipients, malformed displacement distances, invalid DoT values, and Copy definitions with no legal unit source.

The server repeats validation on publish. Client validation is convenience only.

## 3. Poison (Poisoned)

### 3.1 Identity

Poison is a persistent, non-stacking attrition status.

Once applied, Poison lasts for the remainder of the battle unless it is removed by Cleanse or another explicitly authored removal effect.

Poison does not expire naturally at a turn boundary.

### 3.2 Damage

The current canonical Poison profile deals a small fixed **2 HP** periodic damage at the poisoned unit's end of turn.

The Effect Catalog may version this global profile later, but ordinary Skills do not invent separate incompatible Poison magnitudes unless a future Owner-approved design explicitly permits parameterized Poison variants.

Poison damage remains periodic damage: it does not roll ordinary attack accuracy and does not recursively trigger ordinary on-hit effects.

### 3.3 Movement-triggered Poison

Each Poison instance tracks a persistent movement counter from `0` through `4`.

Every traversed tile increments the counter by one. On the fifth tile:

1. Poison immediately deals one additional normal Poison tick;
2. the counter subtracts five;
3. any additional movement continues accumulating.

Therefore a committed path that traverses ten qualifying tiles can trigger two extra Poison ticks.

The counter carries across turns for as long as that Poison instance remains.

### 3.4 What counts as movement

Count movement that is resolved tile-by-tile by the authoritative tactical engine:

- ordinary voluntary movement;
- Haste/Slow-modified movement;
- stepwise Push;
- stepwise Pull;
- other future movement explicitly routed through the same traversed-tile hook.

Do not count instantaneous relocation that does not traverse intervening tiles:

- Revert / return-to-turn-start;
- teleport/blink-style relocation unless a later rule explicitly says it traverses tiles;
- spawn/initial placement.

If a movement-triggered Poison tick defeats the moving/displaced unit, remaining path/displacement steps stop immediately and terminal-state resolution occurs normally.

### 3.5 Reapplication

Poison does not stack.

Reapplying Poison to an already poisoned unit:

- does not add another Poison instance;
- does not increase periodic damage;
- does not reset the existing movement counter;
- may update source attribution only if required by the existing authoritative provenance model, without changing magnitude/counter.

If Poison is Cleansed and later applied again, the new instance begins at movement counter `0`.

## 4. Bleed (Bleeding)

### 4.1 Identity

Bleed is a stackable timed physical attrition effect.

Current maximum: **3 concurrent Bleed stacks** per combatant.

Each application is its own stack record with independent:

- source combatant;
- source action/Skill;
- damage per tick;
- remaining turn ticks;
- stable application order.

A new stack must not refresh every existing stack's duration.

### 4.2 Authored duration and damage

Bleed applications may author **1 to 4 end-of-turn ticks**.

Shorter Bleeds may hit harder per tick; longer Bleeds must use a lower per-tick amount. The current recommended balance targets are:

- 1 turn: up to 5 damage;
- 2 turns: up to 4 damage per turn;
- 3 turns: up to 3 damage per turn;
- 4 turns: up to 2 damage per turn.

The validator enforces a bounded raw-damage budget so extending duration cannot also keep the strongest per-tick value. Current per-stack raw total must not exceed **10 damage** before other approved modifiers.

### 4.3 Tick and expiry

At the affected unit's end of turn, every active Bleed stack ticks independently, then loses one remaining tick.

Stacks that reach zero expire independently.

The UI may summarize `Bleed (Bleeding) xN`, with inspection exposing each stack's remaining ticks when useful.

### 4.4 Applying at the cap

When three Bleed stacks already exist, a new application replaces the stack with the fewest remaining ticks; ties replace the oldest such stack.

This keeps the maximum at three while making a successful Bleed application meaningful without refreshing all stacks.

Cleanse removes all Bleed stacks.

## 5. Burn (Scorched)

### 5.1 Identity

Burn is a non-stacking, short-pressure DoT that starts hot, cools over time, and punishes attacking while burning.

The current canonical profile is:

- end-of-turn tick 1: **4 damage**;
- end-of-turn tick 2: **3 damage**;
- end-of-turn tick 3: **2 damage**;
- damaging-command backlash: **2 damage**.

These values live in the versioned effect definition so the Master Panel Effect Catalog can rebalance the canonical Burn profile later without changing the engine.

### 5.2 Decaying periodic damage

Burn ticks once at each affected unit end-of-turn boundary for its three-step sequence, then expires.

It does not stack.

Reapplying Burn restarts the canonical 4 -> 3 -> 2 sequence rather than adding a second Burn.

### 5.3 Attack backlash

While Burned, when the unit commits a damaging attack command, it takes one Burn backlash instance after that command's normal effects resolve.

A command counts as damaging if its authoritative action definition contains at least one positive direct-damage effect or is the Basic Attack.

Rules:

- one backlash per committed command, not per hit;
- multi-hit and AoE attacks still trigger only one backlash;
- a missed damaging attack still triggers backlash because the unit attacked while burning;
- healing/support/movement/Guard/Recover commands do not trigger backlash unless they also contain a positive damage effect;
- periodic DoT ticks do not themselves trigger Burn backlash;
- a copied damaging Skill triggers backlash normally.

Burn backlash may defeat the attacker.

The engine must therefore support current-actor self-defeat as an authoritative command consequence rather than retaining the old `self-damage-deferred` restriction.

Battle completion is evaluated after the command and Burn backlash consequences finish. If the final living combatants on all teams are defeated by the same command sequence, the existing no-winning-team/draw terminal representation is used rather than fabricating a winner.

### 5.4 Cleanse and reapplication

Cleanse removes Burn.

Burn is single-instance and never stacks.

## 6. DoT targeting is independent

The earlier design tying Burn to Circle, Bleed to Line, and Poison to Ground Circle is retired.

A Skill's targeting is fully authored through its target spec. Its effect list independently determines whether it applies Poison, Bleed, Burn, or another effect.

Roster rebalance may still use varied shapes for class identity, but no engine rule or content validator forces a DoT to a specific shape.

## 7. Copy

### 7.1 Player-facing identity

Add the compact effect tag **`Copy`**.

A Skill whose authoritative effect sequence contains the Copy effect automatically displays the `Copy` tag. Designers do not manually type the presentation tag.

### 7.2 Copy source

Copy reads the target combatant's **committed battle Skill snapshot**, not the target's entire learned library and not mutable profile state outside the battle.

Eligible sources are committed regular battle Skills/Techniques only.

Explicitly ineligible:

- Essence Skills;
- Resonance/passive effects;
- Basic Attack;
- Guard;
- Recover;
- Final Facing and movement;
- scenario/system-only commands that are not committed regular Skills;
- temporary Skills the target obtained through Copy.

Future Equipment Skills may be made copyable only when their battle snapshot explicitly classifies them as regular copyable Skills; they are not silently included by default.

### 7.3 Selection

On successful Copy resolution, the server builds the target's eligible pool in stable Skill-ID order and selects one using the battle's server-owned deterministic RNG stream.

Randomness is authoritative and reproducible. The browser never chooses the copied Skill.

Preview must not reveal or consume a hidden random result before commit. Preview may report the eligible pool/count and that the outcome is random. Commit consumes the authoritative RNG result exactly once.

### 7.4 Already-copied Skills

A copier cannot receive duplicate temporary copies of the same pinned Skill version.

Skills that the copier already holds as copied temporary Skills are excluded from that Copy roll.

If no eligible uncopied Skill remains on the selected target, the Copy action is illegal for that target and preview explains why.

The copier's ordinary equipped version of the same Skill does not block Copy unless it is the exact same pinned definition and keeping a duplicate command would be mechanically redundant; implementation should deduplicate by effective pinned Skill identity.

### 7.5 Lifetime

A successfully copied Skill persists until the battle ends.

It remains available if the source target is later defeated.

Copied Skills are encounter state only. They never mutate the character's learned Skills, loadout, Mastery, progression, inventory, profile, or post-battle state.

### 7.6 AP and resource cost

A copied Skill's AP cost is:

`ceil(original AP cost / 2)`

Examples:

- 25 AP -> 13 AP;
- 30 AP -> 15 AP;
- 35 AP -> 18 AP;
- 45 AP -> 23 AP;
- 60 AP would be 30 AP, but Essence is ineligible.

Only AP is halved.

The copied Skill retains its original:

- MP/resource cost;
- targeting definition;
- ordered effects;
- status interactions;
- accuracy/defense/facing behavior;
- requirements;
- repeat-use effectiveness rules;
- cooldown rule if a copyable historical/current regular Skill has one;
- media/narration references where available.

The copier starts with a clean copied-Skill cooldown/repeat-use history. The target's own prior uses/cooldowns are not inherited.

### 7.7 Build identity and interactions

A copied Skill retains its original action/effect tags and pinned source definition so its mechanics resolve correctly.

It does **not** change the copier's committed Primary/Secondary Discipline, Essence/Resonance eligibility, Mastery, or loadout identity.

Resonance rules that require the copier to have an equipped Discipline continue to consult the copier's committed build, not the copied Skill's foreign source Discipline. Generic action-tag/status/element interactions still see the copied Skill's actual action tags.

### 7.8 Copy targeting and effect recipient

The Skill carrying Copy may use any otherwise legal authored target spec, but the Copy effect itself resolves from one **primary unit**.

This avoids ambiguous multi-target random-copy bursts while still allowing a designer to combine Copy with other Circle/Line effects in the same Skill.

A Copy effect cannot target Self without a distinct eligible external source and therefore current validation requires a unit/ground selection that resolves a primary non-self unit.

### 7.9 Multiple copied Skills and battle UI

Multiple distinct copied Skills may persist simultaneously for the battle.

To prevent command-card overflow, battle UI exposes them through one compact **Copied Skills** command group/picker rather than permanently expanding the main command rail for every copied Skill.

Selecting a copied Skill then uses its normal target-selection/forecast flow with the halved AP cost visible before commit.

### 7.10 AI

AI-controlled combatants can receive and use copied Skills through the same authoritative encounter state.

AI utility evaluation uses the copied Skill's real effects/costs and the halved AP value. It must not treat Copy as a free action or assume the random result before commit.

## 8. Battle state additions

The encounter snapshot must be extended/versioned to carry the new mechanics without mutating historical semantics.

Current-state additions conceptually include:

- persistent Poison instance state including movement counter;
- independent Bleed stack records;
- Burn stage/remaining ticks;
- scheduled Heal/MP recovery from the original approved design;
- temporary copied Skill grants per combatant;
- deterministic RNG state/counter sufficient for Copy and future authoritative random mechanics.

Historical schema versions normalize through explicit migration/compatibility logic. Old committed `burn`, `bleed`, `poison`, `hastened`, `delayed`, `regeneration`, and displacement definitions retain their pinned old behavior.

Do not reinterpret old status instances as the new mechanics merely because the internal string ID matches.

## 9. Master Panel effect authoring

The minimum Combat Content editor must expose typed effect blocks for current supported effects, including:

- Dmg / elemental Dmg;
- Heal X;
- MP Rec X / MP Drain;
- apply/remove status;
- Cleanse / Dispel;
- Push X / Pull X;
- Revert;
- Freeze Ground;
- Copy;
- Bleed application duration/damage within validator limits;
- standard status applications such as Poison/Burn using their current canonical effect profiles.

Copy is a typed effect, not an arbitrary script field.

Poison's 5-tile interval and current canonical damage, and Burn's decay/backlash profile, belong to versioned Effect Catalog definitions. Ordinary Skill drafts reference those versions rather than cloning magic numbers into every Skill.

## 10. Roster-wide rebalance implications

The previous roster audit remains required, but the DoT changes alter its criteria.

### Poison

Poison becomes significantly stronger over long battles because duration is battle-long and movement can create extra ticks. Existing Poison Skills must have their direct damage/AP/availability reviewed downward where necessary. Poison application should remain deliberate rather than ubiquitous.

### Bleed

Bleed Skills must author duration/damage explicitly and be evaluated assuming up to three simultaneous stacks. Low-cost repeated Bleed applicators must not create runaway damage at the 3-stack cap.

### Burn

Burn Skills now impose both decaying DoT pressure and an attack tax. Existing direct damage/AP must be re-evaluated so Burn is not simply free extra damage on already-efficient nukes.

### Copy

Any new/current Skill using Copy must pay an appropriate acquisition/setup cost because the copied command is battle-long and receives a 50% AP discount. Copy itself should not simultaneously be one of the roster's strongest direct-damage actions unless the total package is intentionally priced for that utility.

The full 17-Discipline + Essence roster audit must identify affected skills rather than mechanically changing unrelated content.

## 11. Preview, logging, and inspection

Player-facing feedback must make the new state understandable.

Examples:

- Poison active effect may show `Poison (Poisoned) · 3/5 move`;
- Bleed may show `Bleed (Bleeding) x2`, with inspection listing stack durations;
- Burn may show the next periodic value/remaining stages and its attack-backlash warning;
- Copy preview shows that the result is random and which target's committed regular Skill pool is eligible without revealing the future RNG result;
- Copy commit log records the exact copied Skill and pinned version;
- Copied Skill cards show a `Copied` provenance badge and the discounted AP cost;
- movement preview includes whether the proposed path crosses a Poison 5-tile trigger threshold and projected self-damage/death consequences.

Preview must never mutate RNG, status counters, cooldowns, or copied-Skill state.

## 12. Test contract additions

### Poison

Test:

- battle-long persistence across many turns;
- no natural expiry;
- non-stacking reapplication;
- movement counter persists across turns;
- 5th tile causes exactly one extra tick;
- 10 traversed tiles cause exactly two extra ticks;
- Push/Pull tiles count;
- Revert does not count;
- Cleanse removes Poison and its counter;
- lethal movement tick stops remaining movement;
- preview does not mutate the counter.

### Bleed

Test:

- 1–4 turn authored durations;
- damage validation/budget;
- independent stack timers;
- max three stacks;
- cap replacement chooses shortest-remaining then oldest;
- all active stacks tick independently;
- one stack expiring does not refresh/remove others;
- Cleanse removes all stacks.

### Burn

Test:

- 4 -> 3 -> 2 default periodic sequence;
- no stacking;
- reapplication restarts sequence;
- exactly one backlash per damaging command;
- AoE/multi-hit still one backlash;
- miss still causes backlash;
- support command does not;
- copied damaging Skill does;
- lethal backlash/current-actor self-defeat;
- simultaneous final defeat resolves as no-winner/draw rather than false victory.

### Copy

Test:

- committed regular Skill pool only;
- Essence excluded;
- Resonance/basic/system/copied temporary skills excluded;
- deterministic server random selection;
- preview does not consume/reveal the committed RNG roll;
- copied Skill persists after source defeat and until battle end;
- copied Skill disappears after battle and never mutates profile/loadout;
- AP uses `ceil(original / 2)`;
- MP/other costs stay original;
- targeting/effects/requirements preserved;
- target cooldown history not inherited;
- duplicate copied pinned Skill excluded;
- no eligible pool makes target illegal;
- copied Skills do not change build/Resonance eligibility;
- PvE/PvP/AI share authority.

### Master Panel

Test:

- authorization/permissions;
- draft validation;
- invalid target/effect combinations rejected server-side;
- publish creates a new version;
- pinned battles remain on old versions;
- rollback repoints current content without deleting history;
- compact UI tags derive from published mechanics.

## 13. Documentation reconciliation

When implementation becomes current, reconcile at minimum:

- `docs/COMBAT.md`;
- `docs/MASTER_PANEL.md`;
- `docs/GAME_MASTER_PLAN.md` or current combat/build addendum;
- `docs/PLAYER_MANUAL.md`;
- `docs/ROADMAP.md` if sequencing/status changes;
- `TASKS.md`;
- active Phase-4/continuation docs;
- `AGENTS.md` combat summary if stale.

The earlier DoT spatial-signature text in the original design is superseded by this revision and must not be implemented.

## 14. Implementation boundary

Implementation should proceed in verified increments:

1. encounter/schema foundations: versioning, RNG, persistent Poison, independent Bleed stacks, Burn/self-defeat, copied-Skill state;
2. effect execution and movement hooks: Poison movement ticks, Push/Pull integration, Burn backlash, Copy resolution;
3. content schema and current Skill versions, including Heal/MP Rec/Haste/Slow from the original approved design;
4. roster-wide rebalance and AI metadata audit;
5. shared presentation/forecast/log/Active Effects/Copied Skills UI;
6. protected Master Panel Skill/Combat Content editor with validation/versioned publishing/rollback;
7. documentation reconciliation and full quality gate.

No production deployment is authorized by this design revision.