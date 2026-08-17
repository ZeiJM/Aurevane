# AUREVANE — Stat-Driven Buildcraft & Tactical Expression

**Status:** Authoritative buildcraft refinement subordinate only to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/COMBAT.md`, `docs/ITEMS_INVENTORY_LOADOUTS.md`, `docs/PRODUCT_EXPERIENCE_CONTENT_SYSTEM.md`, `docs/COMBAT_AI_TRAINING.md`, `docs/PLAYER_MANUAL.md`, `docs/MASTER_PANEL.md`, and `docs/ROADMAP_STAT_DRIVEN_BUILDCRAFT.md`.

**Direction approved:** 2026-08-16.

AUREVANE's statistics must not become decorative character-sheet numbers whose only purpose is to make a coefficient larger.

The governing rule is:

> **A meaningful stat earns its place by changing what a build can do, where it wants to stand, what risks it can take, what tactical problems it can solve, or which synergies it can exploit.**

A player who invests heavily into Jump should eventually be able to imagine real plans that another build cannot execute as easily. A player investing into Initiative should be able to build around tempo. A player investing into Maximum HP should have more possibilities than simply taking one more hit. The same principle applies across the released stat ecosystem.

This does **not** mean every character must choose a stat archetype, nor that every stat must be equally valuable on every build or every battlefield. Disciplines, Current + Legacy combinations, Confluences, Soulmarks, Arts, equipment, Mantles, team composition, terrain, objectives and encounter rules remain equally important sources of build identity.

Stats are **build axes**, not classes.

---

## 1. Existing Stat Foundation Remains

The established four core attributes remain:

- Might;
- Finesse;
- Intellect;
- Resolve.

The established derived-stat framework remains:

- Maximum HP;
- Maximum MP;
- Physical Power;
- Mystic Power;
- Armor;
- Ward;
- Accuracy;
- Evasion;
- Critical Chance;
- Initiative;
- Movement;
- Jump;
- Status Resistance.

Do not add a giant new list of base stats merely to create more buildcraft.

Depth should come from the interaction between the existing stats and authored systems.

The current derived-stat formulas are development balance and remain tunable/versioned. This specification defines **how stats are allowed to matter**, not permanent numerical coefficients.

---

## 2. Stat Expression Contract

Every derived stat that remains in the production game should eventually satisfy a **Stat Expression Contract**.

For a stat to justify permanent player-facing prominence, the released game should provide:

1. **Baseline meaning** — the ordinary direct rule must be understandable.
2. **At least one meaningful build path** — some coherent combination of content should make investing in the stat strategically attractive.
3. **Multiple expression points over time** — the stat should interact with more than one item or one gimmick across the mature content library.
4. **Counterplay or opportunity cost** — specialization must not simply make a character universally superior.
5. **Relevant content frequency** — maps, encounters and activities must use the rule often enough that the stat is not a trap.
6. **Readable UI feedback** — the player should understand what changed and why the investment matters.
7. **AI understanding** — NPC AI using a stat-led build should understand how to exploit it and opponents should be able to respond.
8. **Analytics** — the team should be able to detect whether the stat is ignored, mandatory, overpowered, or only useful in one accidental exploit.

A stat that cannot satisfy these requirements should be redesigned, merged, or removed rather than kept because RPGs traditionally have it.

---

## 3. Three Sources of Build Identity

AUREVANE should support all three of the following without forcing one to dominate.

### 3.1 Stat-led builds

The player begins from a tactical property they want to exploit.

Examples:

- high Jump + ranged pressure;
- high Initiative + setup/control;
- high Evasion + skirmishing;
- high Maximum HP + self-costing techniques;
- high Status Resistance + frontline disruption resistance.

The player then chooses Disciplines, equipment and Arts that reward that investment.

### 3.2 Mechanic-led builds

The player begins from a mechanic or interaction.

Examples:

- Bleeding setup/payoff;
- terrain creation;
- Barrier/overheal interactions;
- a particular Confluence;
- summon coordination;
- Mantle specialization;
- counterattack/Reactions;
- displacement/objective control.

Stats support the plan, but the mechanic is the identity.

### 3.3 Hybrid builds

Most sophisticated builds should combine both.

Example:

```text
High Movement
+ high Evasion
+ a mobility Discipline
+ equipment rewarding distance moved
+ an Art that marks enemies after flanking
+ a Confluence that triggers on displacement
```

That is richer than either `stack Movement` or `equip one combo` alone.

---

## 4. Jump & Verticality — Reference Archetype

Jump is the clearest example of the intended philosophy.

### Baseline meaning

Jump represents vertical movement capability before movement-profile, terrain and temporary modifiers.

It may affect authored rules such as:

- the maximum height difference a normal movement path can ascend/descend safely;
- movement cost for elevation changes;
- access to ledges, balconies, rooftops, cliffs, ruins, platforms and other traversable vertical terrain;
- eligibility for particular jump/vault movement interactions;
- safe landing/fall rules where the battle system uses them.

Exact thresholds and formulas are balance data.

### Example build: Ridge Marksman

A player might deliberately combine:

- strong Jump;
- Accuracy and/or range support;
- a ranged Current Discipline;
- a Movement Art that helps reach or change elevation;
- equipment that rewards attacking from higher elevation;
- defensive tools for disengaging from enemies who reach the perch.

The goal is not simply `+10% damage while high`.

The actual tactical identity is:

> **Reach firing positions that are inconvenient for ordinary melee builds, exploit sight-lines and range, then manage the risk of being isolated or displaced.**

A melee unit that cannot legally reach the elevation cannot make an ordinary adjacent melee attack from below merely because the UI selected the target.

That makes geometry real.

### High ground must have counterplay

Vertical specialization must never create guaranteed untouchable sniping nests.

Counterplay can include:

- enemies with sufficient Jump;
- climb/vault/jump Movement Arts;
- ranged attacks;
- line-of-sight blocking;
- pull/push/displacement;
- teleport/blink;
- destructible or transformable terrain;
- alternate routes;
- objectives that force the ranged player to move;
- summons or zones that contest the perch;
- map-specific hazards;
- abilities that attack vertical positions;
- pressure on the specialist's less-protected teammates.

High ground should create an advantage, not immunity.

### Vertical map quality rule

If Jump exists as a prominent stat, a healthy portion of tactical maps must contain meaningful but fair elevation decisions.

Do not create:

- dozens of flat maps where Jump does nothing;
- one mandatory rooftop on every map;
- unreachable sniper ledges with no counterplay;
- cosmetic elevation that the rules ignore.

Verticality should vary by location and encounter identity.

---

## 5. Maximum HP — Endurance, Sacrifice & Threshold Builds

Maximum HP should support more than surviving raw damage.

Possible build identities include:

### Attrition bruiser

A character accepts trades that fragile builds cannot and wins through sustained board presence.

### Self-cost / blood-price build

Certain authored Arts or equipment may spend HP, scale from missing HP, reserve a portion of HP, or convert HP into another resource.

Higher Maximum HP then increases the player's tactical budget without making self-damage free.

### Interceptor / protector

A tank-like build may redirect, share, or intercept damage. Maximum HP lets that player perform the role for longer while Armor/Ward/Barrier choices determine efficiency.

### Threshold manipulation

Effects may care about being above/below authored HP percentages, but avoid creating constant micro-optimization around dozens of arbitrary breakpoints.

Counterplay includes burst, healing denial where appropriate, percentage-based effects, displacement/objective pressure, or attacking the build's weaker defenses/resources.

Do not make Maximum HP universally better than Armor/Ward or vice versa.

---

## 6. Maximum MP — Reservoir, Conversion & Long-Fight Builds

Maximum MP should create a different resource rhythm from simply increasing Mystic Power.

Possible build identities:

### Reservoir caster

Uses expensive high-impact Arts more frequently before needing recovery.

### Long-horizon controller/support

Sacrifices peak burst for sustained access to control, healing, terrain or support tools over a long encounter.

### Resource conversion

Authored effects may convert MP into barriers, movement, temporary resources or other tactical outputs.

### Deep-channel build

Certain high-commitment techniques may require an unusually large MP pool rather than merely a cheap cost reduction.

Counterplay includes MP drain where explicitly supported, pressure that forces inefficient spending, cooldown timing, or attacking before the resource advantage compounds.

Do not let large MP plus cost reduction create effectively infinite casting.

---

## 7. Physical Power — Forceful Physical Expression

Physical Power remains a baseline physical-effectiveness rating, but builds should be able to express it through more than one weapon coefficient.

Potential interactions include:

- stronger authored physical Arts;
- weapon-based scaling;
- conditional payoff on heavy impacts;
- limited interactions with breakable objects, Guard-breaking or physical displacement when an Art explicitly uses Physical Power as part of the rule;
- execution-style physical effects that trade speed, range or flexibility for force.

Do not globally make every push distance scale with Physical Power; that would destroy map predictability. Any non-damage scaling must be explicitly authored, bounded and forecastable.

---

## 8. Mystic Power — Supernatural Potency & Control Expression

Mystic Power remains a baseline magical/supernatural effectiveness rating.

Possible build identities include:

- spell damage;
- healing/support magnitude where authored;
- barrier potency;
- zone or terrain effect strength;
- summon/support scaling;
- controlled supernatural debuff potency where the status system permits scaling.

Do not let Mystic Power automatically improve duration, range, accuracy, healing, damage and every supernatural property at once. Individual content definitions decide what scales.

---

## 9. Armor — Physical Anchor Builds

Armor should support builds that deliberately accept physical contact.

Possible identities include:

- front-line anchor;
- intercept/protector;
- counterattack build that wants enemies to commit into melee;
- heavy objective holder;
- physical attrition specialist.

Armor specialization should have weaknesses:

- Mystic pressure;
- displacement;
- objectives requiring mobility;
- Armor-piercing/break effects where authored;
- resource pressure;
- mixed-damage teams.

Do not allow raw Armor stacking to solve every physical mechanic, especially forced movement, objectives and statuses whose rules are not damage.

---

## 10. Ward — Mystic Anchor Builds

Ward is the supernatural-defense counterpart to Armor, but it should not merely be `Armor for blue damage`.

Possible build identities include:

- anti-caster anchor;
- warded support who can safely operate inside hostile magical zones;
- spell-bait/counter-Reaction build;
- protector against mystic AoE;
- equipment interactions that trigger after resisting or absorbing supernatural effects.

Ward must remain distinct from Status Resistance: surviving mystic damage is not the same as resisting control/debuffs.

---

## 11. Accuracy — Precision, Range & Counter-Evasion Builds

Accuracy should be valuable to builds that ask harder targeting questions.

Possible identities include:

### Long-range precision

Ranged builds may accept distance, cover, elevation or other penalties that high Accuracy can offset within bounded rules.

### Anti-skirmisher

Accuracy becomes a natural answer to Evasion-focused enemies.

### Precision technique

Some high-payoff Arts may trade reliability for effect strength, allowing an Accuracy build to use them more consistently.

### Marking / setup

Certain effects may temporarily improve Accuracy or remove target defenses, creating team setup/payoff.

Avoid accuracy systems where ordinary players routinely miss basic actions at frustrating rates. Accuracy specialization should open harder shots and counter evasive targets, not make baseline combat feel incompetent.

---

## 12. Evasion — Skirmisher, Bait & Positioning Builds

Evasion should represent an active tactical identity rather than passive coin-flip invulnerability.

Possible builds include:

- mobile skirmisher;
- flanker;
- Reaction baiter;
- fragile duelist who survives by positioning and avoidance;
- equipment that rewards a successful eligible evade with a bounded reposition/resource effect.

Guardrails:

- some effects/actions may not be evadable;
- Evasion has diminishing returns/caps as needed;
- high Accuracy is a counter;
- zones, terrain, guaranteed utility, objectives and positioning can pressure evasive builds;
- PvP must not devolve into repeated low-information misses.

Forecast UI should communicate hit reliability clearly.

---

## 13. Critical Chance — Setup/Payoff Rather Than Casino Buildcraft

Critical Chance can support burst-oriented builds, but AUREVANE should avoid making the best build depend on uncontrolled lucky streaks.

Useful patterns include:

- Marks/Exposed states that improve critical opportunity;
- Arts whose crit behavior is especially valuable but still bounded;
- equipment that converts crits into a limited secondary benefit;
- build packages that trade consistency/defense for burst potential;
- effects that guarantee or heavily improve a crit only after deliberate setup.

The strongest crit archetypes should feel like **engineering an opening**, not pulling a slot machine lever.

---

## 14. Initiative — Tempo & Sequencing Builds

Initiative should support players who care about **when** actions occur, not merely who gets first turn once.

Possible identities include:

- opening setup specialist;
- fast interrupter;
- ally-enabling tempo support;
- objective racer;
- combo sequencing build that wants to act before/after a teammate or enemy;
- Chronist-like timeline manipulation where the Discipline owns the more advanced rules.

Guardrails:

- high Initiative does not grant endless extra turns;
- initiative/timeline manipulation remains bounded and forecastable;
- speed advantage must not create unavoidable first-turn kills;
- PvP opening rules may normalize or constrain extreme values.

Initiative should interact cleanly with the visible turn-order timeline.

---

## 15. Movement — Space-Control & Objective Builds

Movement is already converted into the normal Movement Budget and should be one of AUREVANE's most tactically expressive stats.

Possible build identities include:

- kiting ranged attacker;
- objective runner;
- melee engager/chaser;
- flanker/back-line diver;
- support who needs to reach multiple allies;
- terrain specialist who exploits roads/low-cost terrain;
- equipment or Arts that reward distance travelled or remaining Movement Budget.

Movement should not merely be `more is always better`.

Tradeoffs may include:

- lighter/less defensive equipment;
- lower raw output;
- reduced access to other stats/effects;
- terrain that constrains certain movement profiles;
- enemy zones/Reactions that punish careless movement.

Maps must provide enough space and objectives for Movement to matter without forcing every build to max it.

---

## 16. Jump — Vertical Positioning Builds

Jump's primary production identity is **vertical access and vertical tactical options**.

Potential archetypes include:

- Ridge Marksman — high ground + ranged precision;
- Rooftop Skirmisher — uses elevation to disengage/reposition;
- Diving Striker — gains payoff from descending/leaping into melee through an authored Movement Art;
- Vertical Support — reaches separated allies/objectives on multi-level maps;
- Ruin Runner — crosses walls, ledges or broken paths that constrain ordinary movement.

Not every one of these must ship. They illustrate the required breadth.

Jump must not become a universal damage multiplier merely because verticality exists.

---

## 17. Status Resistance — Anti-Control & Reliability Builds

Status Resistance should be meaningful to builds whose job requires reliability under pressure.

Possible identities include:

- frontline anchor who must remain able to Guard/Intercept;
- support who cannot afford to be repeatedly silenced/disabled;
- anti-control duelist;
- objective holder;
- equipment that gains a bounded benefit after resisting a hostile status.

Guardrails:

- resistance does not mean universal immunity;
- hard/rare boss mechanics may use explicit categories/rules;
- some statuses can use guaranteed application with other counterplay if authored;
- status application and resistance formulas must be understandable enough for forecasting/debugging.

---

## 18. Compound Stat Archetypes

The best stat-driven builds will often combine several stats rather than stacking one indefinitely.

Examples:

### Ridge Marksman

```text
Jump
+ Accuracy
+ enough Movement
+ ranged Discipline/Arts
+ elevation-aware equipment
```

### Mobile Duelist

```text
Movement
+ Evasion
+ Initiative
+ close-range mobility Arts
+ Reaction payoff
```

### Iron Anchor

```text
Maximum HP
+ Armor
+ Status Resistance
+ Guard/intercept tools
+ objective-control equipment
```

### Mystic Bulwark

```text
Maximum MP
+ Ward
+ Mystic Power
+ Barrier/support Arts
+ resource conversion
```

### Precision Opener

```text
Initiative
+ Accuracy
+ controlled Critical setup
+ Mark/Exposed mechanics
```

### Blood-Price Ravager

```text
Maximum HP
+ Physical Power
+ self-costing Arts
+ missing-HP payoff
+ sustain with explicit limits
```

These are examples, not fixed classes or mandatory named builds.

The player should discover many combinations organically.

---

## 19. Stats + Disciplines

Disciplines should not all scale from the same two obvious offensive stats.

Across the mature roster, Discipline kits should create different reasons to value stats.

Examples of design questions for a Discipline ticket:

- Does this kit care about Movement distance?
- Does it benefit from acting early or deliberately acting later?
- Does its Movement Art make Jump unusually useful?
- Does it spend HP or MP in a distinctive way?
- Does it want to survive contact or avoid contact?
- Can it exploit Accuracy to make difficult targeting patterns reliable?
- Does it reward resisting control?
- Does its Confluence create a new stat relationship?

Do not force every Discipline to care about every stat.

The goal is ecosystem diversity.

---

## 20. Stats + Equipment

Equipment is one of the primary ways players deliberately lean into stat expression.

Equipment can:

- add bounded stat modifiers;
- trade one stat for another;
- create conditional effects tied to stat-relevant behavior;
- unlock a special interaction after meeting a clear threshold;
- reward terrain/elevation/movement behavior;
- change how a stat is used without simply multiplying it.

Examples:

- boots that reduce the movement cost of the first elevation change each turn if Jump is high enough;
- a bow that gains a range/accuracy interaction from high ground rather than flat damage;
- armor that trades Movement for Armor and gains an objective-hold effect;
- an accessory that converts a portion of unused MP into a turn-start Barrier under a cap;
- a dueling charm that rewards successful Evasion once per round;
- a standard that rewards high Status Resistance while standing on an objective.

Do not create equipment where every slot is simply `+main damage stat`.

---

## 21. Stats + Arts, Traits, Reactions & Movement Arts

Content may use explicit stat requirements or scaling when it creates a real choice.

Useful patterns:

- minimum Jump requirement for an advanced vault path;
- scaling effect with Movement spent, under a cap;
- Reaction trigger after eligible Evasion;
- Trait that changes how high Initiative is converted into opening utility;
- Art that spends a percentage/amount of Maximum HP as an explicit cost;
- Art whose hit reliability makes Accuracy strategically valuable;
- support effect that scales partially with Maximum MP or Mystic Power.

Avoid arbitrary requirements such as `requires 47 Jump` on unrelated abilities.

Requirements must have thematic and tactical justification.

---

## 22. Stats + Soulmarks, Confluences & Mantles

Higher-order build systems may interact with stats, but they must avoid creating a mandatory universal stat package.

### Soulmarks

A Soulmark branch can create an unusual stat relationship where appropriate.

Example: Gravity could make vertical positioning or displacement interact differently with Jump/Movement without simply becoming `the Jump Soulmark`.

### Confluences

A Confluence may reward a stat-relevant action such as moving distance, intercepting, acting in a timing window or attacking from elevation.

Avoid bespoke `every Confluence × every stat` matrices.

### Mantles

Mantle Paths may use stat thresholds as part of specialization eligibility, but higher-rank Mantles must still require broader Dedication/opportunity cost as defined in `docs/MANTLES.md`.

A Mantle must not become `stack one stat to unlock Rank III`.

---

## 23. Terrain & Map Design Must Serve Build Diversity

Stats only matter tactically when content gives them something to interact with.

Map authoring should deliberately include varied questions across the library:

- vertical routes;
- narrow lanes;
- open sight-lines;
- cover;
- rough terrain;
- hazards;
- destructible terrain;
- alternate routes;
- objectives at different elevations/positions;
- safe and unsafe firing positions;
- areas where mobility matters;
- areas where durability matters;
- areas where control resistance matters.

But each map should have its own identity.

Do not create checklist maps containing one feature for every stat.

A mountain fort may strongly reward Jump and range.

A cramped crypt may reduce the value of raw range but reward Armor, Ward, status control and lane management.

An open battlefield may reward Movement and initiative.

This variation is healthy because players have saved loadouts and build choice.

---

## 24. No Stat May Require One Specific Map Type

A stat can be situational without becoming dead outside one environment.

Example: Jump is strongest on highly vertical maps, but can still matter through authored Movement Arts, obstacle crossing, vaulting or equipment interactions on moderate terrain.

Likewise:

- Status Resistance matters anywhere meaningful control exists;
- Accuracy matters against evasive enemies and difficult shots;
- Movement matters on objectives and positioning even without huge maps;
- Initiative matters in sequencing even when there is no race objective.

The content library should provide **frequency**, not universality.

---

## 25. Opportunity Cost & Diminishing Returns

Stat specialization must cost something.

Possible sources of opportunity cost:

- finite attribute contribution;
- equipment affix/stat budgets;
- slot competition;
- Discipline/build requirements;
- Traits/Arts chosen to exploit the stat instead of other options;
- Mantle Dedication;
- lighter/heavier equipment tradeoffs;
- diminishing returns or bounded caps for high-risk stats.

Do not create a mature meta where every optimal build simply maxes the same offensive stat, the same Movement threshold and the same defensive stat.

High-risk stats such as Evasion, Critical Chance, Initiative and Status Resistance require explicit curve/cap review because extreme stacking can invalidate interaction.

---

## 26. Breakpoints Must Be Legible

Some tactical stats naturally use discrete thresholds.

Examples:

- Jump may cross an additional elevation tier;
- Movement may gain another movement step/budget point;
- equipment may require a minimum stat to enable a special interaction.

Breakpoints can be exciting because they create build goals.

However:

- important thresholds must be visible in the Armory/profile;
- the player should see what the next point/threshold changes;
- hidden decimal rounding must not create unexplained behavior;
- a one-point breakpoint should not secretly double a build's power without a clear cost;
- balance should avoid one mandatory universal threshold across all builds.

---

## 27. Build Preview & Armory UX

The Armory should eventually help the player understand stat expression rather than showing only green/red numbers.

Useful presentation can include:

- before/after derived stats;
- next meaningful Movement/Jump breakpoint;
- affected action range/legality where deterministically previewable;
- changed hit/crit forecasts in representative contexts;
- equipment/Art effects currently enabled by a threshold;
- warnings when a build loses a requirement;
- concise synergy hints based on deterministic content metadata.

Example:

```text
JUMP 3 → 4

New capability:
• Can ascend Height 2 through ordinary movement on compatible terrain.

Enabled interaction:
• Cliffstrider Boots: High Step now active.
```

Do not have an AI invent build advice dynamically in the authoritative UI. Hints should come from published content relationships/metadata.

---

## 28. Combat Forecasting

When a stat affects a current tactical decision, the forecast should expose the consequence where practical.

Examples:

- hit chance reflects Accuracy/Evasion/cover/elevation modifiers;
- movement preview shows legal vertical transitions from Jump;
- path preview shows Movement Budget;
- initiative timeline reflects current timing state;
- status preview shows resistance/application information at the appropriate level;
- damage/healing forecast includes relevant power/defense contributions without exposing unnecessary internal noise.

Players should learn the system from the board, not from external spreadsheets alone.

---

## 29. AI Requirements

Combat AI must understand the tactical value of its own stat profile.

Examples:

- high-Jump ranged AI seeks useful elevation when the route is worth the opportunity cost;
- high-Movement skirmisher AI maintains distance or flanks rather than standing still;
- high-Armor anchor AI contests objectives/chokepoints;
- high-Initiative setup AI sequences buffs/debuffs intelligently;
- high-Accuracy AI can consider difficult shots that low-Accuracy profiles should reject;
- high-Status-Resistance AI may accept control risk that fragile support AI should avoid.

AI must also understand counters enough not to feed obvious stat-led strategies indefinitely.

Do not give AI hidden stat bonuses to simulate intelligence.

---

## 30. PvP Requirements

Stat-led builds are especially vulnerable to PvP degeneracy and require explicit validation.

Test for:

- unreachable high-ground camping;
- Evasion/Accuracy non-games;
- first-turn Initiative kills;
- unkillable Armor/Ward/HP stacking;
- control immunity through Status Resistance;
- infinite Movement/kiting;
- crit volatility deciding matches without counterplay;
- resource loops from Maximum MP/HP conversion;
- map-specific auto-win spawn positions.

Ranked maps and rules must contain counterplay for supported archetypes.

This does not mean every build must be equally favored on every map.

A healthy competitive environment can contain map/build advantages as long as they are visible, bounded and strategically answerable.

---

## 31. PvE & Boss Requirements

Bosses should not invalidate whole stat archetypes by blanket immunity unless the encounter's identity truly requires it.

Prefer targeted encounter answers:

- a boss may destroy high-ground platforms rather than simply disable Jump;
- an anti-evasion attack may be telegraphed rather than every boss having perfect Accuracy;
- a control-heavy boss rewards Status Resistance but still has mechanics that require movement/positioning;
- an Armor-heavy player can survive physical hits but must still solve objective mechanics.

Stat investment should change how a player approaches an encounter, not let them skip the encounter.

---

## 32. Exploration / World Expression

Where practical, some movement-oriented stats can create **bounded non-combat expression** without turning the world into a platformer.

Potential examples:

- Jump opens an alternate route or optional ledge in a location;
- Movement affects an authored traversal challenge only where the rules are clear;
- certain exploration tools reuse movement profiles.

Important progression must not become permanently inaccessible because a character did not choose one stat build.

Use optional shortcuts, discoveries, tactical positioning advantages or alternate approaches rather than hard-locking the main story behind a stat.

---

## 33. Content Authoring Requirement — Stat Expression Matrix

As content volume grows, maintain a lightweight **Stat Expression Matrix**.

For each derived stat, track released support across categories such as:

```text
STAT
├── baseline rule
├── supporting Disciplines / Arts
├── equipment interactions
├── terrain/map interactions
├── enemy/encounter interactions
├── Soulmark/Confluence/Mantle interactions where relevant
├── PvE counters
├── PvP counters
└── telemetry coverage
```

The matrix is a design/audit tool, not a requirement that every cell contain content.

Its purpose is to reveal:

- dead stats;
- one-item gimmicks;
- accidental mandatory stats;
- missing counterplay;
- map/content bias;
- over-concentrated synergies.

---

## 34. Content Ticket Questions

When authoring a new Discipline, item, Art, map, boss, enemy, Soulmark branch, Confluence or Mantle, consider:

1. Which existing stats naturally matter here?
2. Does this create a new build possibility or deepen an existing one?
3. Is the interaction more interesting than a flat coefficient?
4. What does the specialist give up?
5. How does an opponent answer it?
6. Does the UI forecast/explain it?
7. Can AI use it competently?
8. Does this make one stat universally mandatory?
9. Does the map/content library contain enough situations for the investment to matter?
10. Does this duplicate an existing interaction with a different name?

Do not force stat hooks into content where they add no value.

---

## 35. Player Manual / Codex

The public Manual should explain baseline stat rules and representative build ideas without prescribing one solved meta.

Good documentation:

- explains what Jump does;
- shows how elevation works;
- gives an example of a vertical ranged build;
- explains counters;
- links to Movement/elevation rules.

Bad documentation:

- says `you must have Jump 7 at level 60`;
- exposes hidden unreleased equipment;
- publishes a supposedly optimal build as official truth;
- duplicates balance values that should come from authoritative content data.

---

## 36. Master Panel / Balance Lab

As the Master Panel matures, stat/build operations should expose:

- stat distributions by level/Horizon/mode;
- common stat breakpoints;
- correlation with Discipline/loadout choices;
- item usage by stat profile;
- PvE/PvP performance by meaningful stat bands;
- map win/performance differences for vertical/mobility archetypes;
- Accuracy vs Evasion outcome distributions;
- Initiative opening advantage;
- Status Resistance/control interaction rates;
- Jump/elevation usage;
- Movement distance and objective contribution;
- build diversity indicators.

The panel may warn about suspicious outliers, but AI/statistics do not automatically rebalance production.

Owner/balance staff publish changes through versioned configuration/content.

---

## 37. Telemetry Questions

Useful questions include:

- Is a stat ignored across all successful builds?
- Is a stat mandatory above a specific level?
- Are players investing in Jump but rarely using elevation?
- Do high-Jump teams dominate specific maps?
- Does high Movement correlate with objective success without a meaningful damage/defense tradeoff?
- Does Evasion create frustrating miss rates?
- Does Accuracy have value outside countering Evasion?
- Are high-Initiative builds deciding PvP before opponents act?
- Does Status Resistance meaningfully change control outcomes?
- Are HP/MP conversion builds creating infinite loops?

Telemetry should support design judgment, not replace it.

---

## 38. Build Diversity Gate

Before mature alpha, representative testing should prove that players can create successful builds with visibly different tactical identities.

The target is not equal pick rate for every stat.

The target is that players can credibly say things like:

- `I built around vertical positioning.`
- `I built a fast objective skirmisher.`
- `I built a control-resistant anchor.`
- `I built a huge resource-pool support caster.`
- `I built around a specific Confluence instead of stats.`
- `I built a Rank III Mantle specialist and sacrificed flexibility.`

and those statements correspond to different decisions in battle.

---

## 39. Anti-Patterns

Reject designs where:

- every stat only means `+X% number`;
- one main damage stat is optimal for nearly every build;
- Jump exists but maps are flat;
- Movement is universally maxed because there is no opportunity cost;
- Evasion becomes passive invulnerability;
- Accuracy exists only as an Evasion tax;
- Initiative creates unavoidable first-turn wins;
- Status Resistance creates blanket immunity;
- Armor/Ward/HP stacking can ignore objectives/control;
- Critical Chance makes match outcomes primarily luck;
- one rare item is the only reason a stat matters;
- a stat interaction is invisible until a player reads a spreadsheet;
- PvE bosses simply disable every unusual build;
- buildcraft requires permanent irreversible stat mistakes.

AUREVANE explicitly rejects permanent build traps. Respec/loadout/progression rules should preserve meaningful choice without permanently ruining a long-lived character for experimenting.

---

## 40. Definition of Success

Stat-driven buildcraft succeeds when:

- derived stats visibly affect tactical possibility, not only coefficients;
- multiple credible archetypes exist without becoming mandatory classes;
- Jump/Movement/elevation create real spatial strategy;
- maps support specialization without giving specialists unanswerable safe zones;
- equipment and Arts create intentional stat synergies;
- Current + Legacy/Confluence/Soulmark/Mantle systems remain the broader build identity rather than being overshadowed by raw stats;
- players can understand important breakpoints and forecasts in-game;
- AI can use stat-led builds competently;
- PvP retains counterplay;
- PvE does not invalidate unusual builds by default;
- the Master Panel can measure and tune the ecosystem;
- no meaningful stat survives as dead filler.

The final experience should make the character sheet provoke tactical imagination:

> **“If I push this stat further, what new kind of play becomes possible?”**

That is the standard.