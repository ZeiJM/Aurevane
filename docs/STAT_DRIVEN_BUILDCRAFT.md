# AUREVANE — Stat-Driven Buildcraft & Tactical Expression

**Status:** Authoritative buildcraft refinement subordinate to `docs/GAME_MASTER_PLAN.md` and `docs/GAME_MASTER_PLAN_BUILD_SYSTEM_ADDENDUM.md`, complementary to `docs/COMBAT.md`, `docs/ITEMS_INVENTORY_LOADOUTS.md`, `docs/PRODUCT_EXPERIENCE_CONTENT_SYSTEM.md`, `docs/COMBAT_AI_TRAINING.md`, `docs/PLAYER_MANUAL.md`, and `docs/MASTER_PANEL.md`.

**Initial direction approved:** 2026-08-16.  
**Synchronized to current build/attribute terminology:** 2026-08-19.

AUREVANE's statistics must not become decorative character-sheet numbers whose only purpose is to make a coefficient larger.

The governing rule is:

> **A meaningful stat earns its place by changing what a build can do, where it wants to stand, what risks it can take, what tactical problems it can solve, or which synergies it can exploit.**

A player investing heavily into Jump should be able to imagine plans another build cannot execute as easily. A player investing into Initiative should be able to build around tempo. A player investing into Maximum HP should gain possibilities beyond simply taking one more hit.

Stats are **build axes, not classes**.

They coexist with Primary/Secondary Discipline choices, Discipline Skills, Resonance or Essence, Soulmark/Mantle identity, equipment, team composition, terrain, objectives, encounters, and player strategy. None of those layers should make all the others irrelevant.

---

## 1. Current Attribute Foundation

The universal player-assigned attributes are:

- **Might** — physical force and strength-led expression;
- **Finesse** — precision, technique and critical-oriented expression;
- **Vitality** — endurance, Maximum HP and physical staying power;
- **Agility** — mobility, reflex, Evasion and Initiative-oriented expression;
- **Intellect** — Maximum MP, magical potency, healing and supernatural control;
- **Resolve** — defensive steadiness, Armor/Ward-facing resilience and status/control resistance.

This six-attribute model supersedes the older four-attribute preview.

Primary Discipline contributes a separate **base Discipline stat profile**. The player’s earned/assigned attribute investment remains independent of that profile. Changing Primary changes the Discipline profile; it does not silently redistribute the player's personal attribute points.

Secondary Discipline grants no second base-stat profile.

---

## 2. Derived-Stat Foundation

The established derived-stat framework includes:

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

Do not add a giant new list of base stats merely to manufacture buildcraft.

Depth should come from the interaction between these values and authored systems.

Current formulas are versioned development balance. This specification defines **how stats are allowed to matter**, not permanent numerical coefficients.

---

## 3. Stat Expression Contract

Every derived stat that remains prominent in production should eventually satisfy a **Stat Expression Contract**.

A healthy stat should provide:

1. **Baseline meaning** — the direct rule is understandable.
2. **At least one meaningful build path** — some coherent content makes investing strategically attractive.
3. **Multiple expression points over time** — more than one item or one gimmick interacts with it.
4. **Counterplay or opportunity cost** — specialization does not make a character universally superior.
5. **Relevant content frequency** — maps/encounters use the rule often enough that the stat is not a trap.
6. **Readable UI feedback** — the player can understand what changed and why it matters.
7. **AI understanding** — NPC AI can exploit stat-led builds and opponents can respond.
8. **Analytics** — the team can detect whether the stat is ignored, mandatory, overpowered, or accidentally useful only in one exploit.

A stat that cannot satisfy these requirements should be redesigned, merged, or removed rather than kept because RPGs traditionally have it.

---

## 4. Sources of Build Identity

AUREVANE should support multiple starting points for theorycrafting without forcing one to dominate.

### 4.1 Stat-led builds

The player begins from a tactical property they want to exploit.

Examples:

- high Jump + ranged pressure;
- high Initiative + setup/control;
- high Evasion + skirmishing;
- high Maximum HP + self-costing Skills;
- high Status Resistance + frontline reliability.

They then choose Primary/Secondary Disciplines, Skills, equipment and other systems that reward that investment.

### 4.2 Mechanic-led builds

The player begins from an interaction.

Examples:

- Bleeding setup/payoff;
- terrain creation;
- Barrier/overheal interactions;
- a particular Resonance;
- pure-Discipline Essence play;
- summon coordination;
- Mantle timing;
- triggered counterplay;
- displacement/objective control.

Stats support the plan, but the mechanic is the identity.

### 4.3 Hybrid builds

Most sophisticated builds combine both.

Example:

```text
High Movement
+ high Evasion
+ mobility-focused Primary Discipline
+ equipment rewarding distance moved
+ a Discipline Skill that Marks after flanking
+ a Resonance that rewards displacement
```

That is richer than either `stack Movement` or `equip one combo` alone.

---

## 5. Jump & Verticality — Reference Archetype

Jump is a reference example of the intended philosophy.

### Baseline meaning

Jump represents vertical movement capability before movement-profile, terrain and temporary modifiers.

It may affect authored rules such as:

- maximum height difference a normal path can traverse;
- access to ledges, balconies, rooftops, cliffs, ruins and platforms;
- eligibility for jump/vault interactions;
- safe landing/fall rules where used;
- Skill or equipment requirements that explicitly reference verticality.

Exact thresholds are balance data.

### Example: Ridge Marksman

A player might combine:

- strong Jump;
- Accuracy/range support;
- a ranged Primary Discipline;
- a movement-capable Discipline or Equipment Skill;
- equipment rewarding higher elevation;
- defensive tools for disengaging if enemies reach the perch.

The tactical identity is:

> **Reach firing positions inconvenient for ordinary melee builds, exploit sight-lines and range, then manage the risks of isolation and displacement.**

A melee unit that cannot legally reach an elevation cannot make an ordinary adjacent melee attack from below merely because the UI selected the target.

### Counterplay

Vertical specialization must not create untouchable nests.

Counterplay can include:

- sufficient Jump;
- climb/vault/jump Skills;
- ranged attacks;
- line-of-sight blocking;
- pull/push/displacement;
- teleport/blink;
- destructible/transformable terrain;
- alternate routes;
- objectives that force movement;
- summons/zones that contest the perch;
- hazards;
- pressure on teammates.

High ground creates advantage, not immunity.

### Map quality rule

If Jump is prominent, a healthy portion of maps must contain meaningful but fair elevation decisions.

Avoid:

- dozens of flat maps where Jump does nothing;
- one mandatory rooftop on every map;
- unreachable sniper ledges with no counterplay;
- cosmetic elevation the rules ignore.

---

## 6. Maximum HP & Vitality-Led Expression

Maximum HP should support more than surviving raw damage.

Possible identities:

- attrition bruiser;
- self-cost / blood-price build;
- interceptor/protector;
- threshold manipulation;
- equipment or supernatural effects that convert health state into another tactical resource.

Higher Maximum HP can expand a tactical budget without making self-damage free.

Counterplay can include burst, healing denial where appropriate, percentage effects, displacement/objective pressure, or attacking weaker defenses/resources.

Do not make Maximum HP universally better than Armor/Ward or vice versa.

---

## 7. Maximum MP & Intellect-Led Resource Expression

Maximum MP should create a different resource rhythm from simply increasing Mystic Power.

Possible identities:

- reservoir caster;
- long-horizon controller/support;
- resource conversion;
- deep-channel/high-commitment Skills requiring an unusually large pool.

Counterplay can include pressure that forces inefficient spending, cooldown timing, explicit resource disruption, or attacking before the resource advantage compounds.

Do not let large MP plus cost reduction create effectively infinite casting.

---

## 8. Physical Power

Physical Power is a baseline physical-effectiveness rating, but builds should express it through more than one weapon coefficient.

Potential interactions include:

- physical Discipline Skills;
- weapon scaling;
- heavy-impact payoff;
- bounded break/Guard interactions;
- explicitly authored physical displacement contribution;
- execution-style effects that trade speed/range/flexibility for force.

Do not globally scale every push distance with Physical Power; that would destroy map predictability. Non-damage scaling must be explicit, bounded and forecastable.

---

## 9. Mystic Power

Mystic Power is a baseline magical/supernatural effectiveness rating.

Possible expressions include:

- Skill damage;
- healing/support magnitude where authored;
- barrier potency;
- zone/terrain effect strength;
- summon/support scaling;
- bounded supernatural debuff potency.

Do not let Mystic Power automatically improve duration, range, accuracy, healing, damage and every supernatural property at once. Individual content definitions decide what scales.

---

## 10. Armor & Ward

### Armor

Armor supports physical-anchor identities such as:

- frontline anchor;
- interceptor/protector;
- contact-seeking counter build;
- objective holder;
- physical attrition specialist.

Weaknesses may include Mystic pressure, displacement, mobility objectives, Armor-breaking effects, resource pressure, or mixed-damage teams.

Raw Armor does not solve every physical mechanic.

### Ward

Ward is supernatural defense but must not be merely “blue Armor.”

Possible identities include:

- anti-caster anchor;
- support who can operate inside hostile magical zones;
- spell-bait/trigger build;
- protector against Mystic area pressure;
- equipment effects triggered after resisting/absorbing supernatural damage.

Ward remains distinct from Status Resistance.

---

## 11. Accuracy & Evasion

### Accuracy

Accuracy should matter to builds that ask harder targeting questions:

- long-range precision;
- anti-skirmisher play;
- high-payoff techniques with reliability tradeoffs;
- Mark/setup patterns.

Ordinary combat should not make baseline characters feel incompetent through constant misses. Accuracy specialization opens harder shots and counters Evasion rather than fixing deliberately miserable defaults.

### Evasion

Evasion should represent skirmishing/positioning identity rather than coin-flip invulnerability.

Possible expressions:

- mobile skirmisher;
- flanker;
- fragile duelist;
- equipment that rewards an eligible evade with a bounded reposition/resource effect.

Guardrails:

- some effects may be non-evadable;
- diminishing returns/caps may apply;
- Accuracy counters Evasion;
- zones, terrain, guaranteed utility, objectives and positioning can pressure evasive builds;
- PvP should not become repeated low-information misses.

Forecast UI communicates hit reliability.

---

## 12. Critical Chance

Critical Chance may support burst builds, but the best strategy should not depend on uncontrolled lucky streaks.

Useful patterns:

- Marked/Exposed setup;
- Skills whose crit behavior is valuable but bounded;
- equipment converting a crit into a limited secondary benefit;
- packages that trade consistency/defense for burst;
- deliberate setup that guarantees or strongly improves a critical opportunity.

The strongest crit archetypes should feel like **engineering an opening**, not pulling a slot-machine lever.

---

## 13. Initiative & Agility-Led Tempo

Initiative supports players who care about **when** actions occur, not merely who goes first once.

Possible identities:

- opening setup specialist;
- fast interrupter through authored triggered behavior;
- ally-enabling tempo support;
- objective racer;
- combo sequencing;
- Chronist-like timeline manipulation where the Discipline owns advanced rules.

Guardrails:

- high Initiative does not grant endless extra turns;
- timeline manipulation remains bounded and forecastable;
- speed advantage must not create unavoidable first-turn kills;
- PvP opening rules may normalize extreme values.

---

## 14. Movement

Movement should be one of AUREVANE's most tactically expressive build axes even though the current combat baseline uses one shared Action Economy pool rather than a separate generic Movement Budget.

Possible identities:

- kiting ranged attacker;
- objective runner;
- melee engager/chaser;
- flanker/back-line diver;
- mobile support;
- terrain specialist;
- equipment/Skills that reward distance, route, or positional change.

Movement should not simply mean “more is always better.” Opportunity costs can include defense, output, equipment tradeoffs, terrain restrictions, enemy zones or other pressure.

Maps must provide enough space and objectives for Movement to matter without forcing every build to maximize it.

---

## 15. Jump

Jump's primary production identity is **vertical access and vertical tactical options**.

Potential archetypes include:

- Ridge Marksman;
- Rooftop Skirmisher;
- Diving Striker through authored Skills;
- Vertical Support;
- Ruin Runner.

Jump must not become a universal damage multiplier merely because verticality exists.

---

## 16. Status Resistance & Resolve-Led Reliability

Status Resistance matters to builds whose role requires reliability under pressure.

Possible identities:

- frontline anchor who must remain functional;
- support who cannot afford repeated control;
- anti-control duelist;
- objective holder;
- equipment granting bounded payoff after resisting a hostile status.

Guardrails:

- resistance is not universal immunity;
- boss mechanics may use explicit categories;
- some statuses may use guaranteed application with other counterplay if authored;
- formulas must remain understandable enough for forecast/debugging.

---

## 17. Compound Stat Archetypes

Strong builds often combine several stats rather than stacking one indefinitely.

### Ridge Marksman

```text
Jump
+ Accuracy
+ enough Movement/Agility
+ ranged Primary Discipline
+ elevation-aware equipment
```

### Mobile Duelist

```text
Movement
+ Evasion
+ Initiative
+ close-range mobility Skills
+ triggered payoff / Resonance where relevant
```

### Iron Anchor

```text
Maximum HP
+ Armor
+ Status Resistance
+ Guard/intercept tools
+ objective-control identity
```

### Reservoir Support

```text
Maximum MP
+ Mystic Power
+ Initiative or durability
+ sustained support/control Skills
+ equipment rewarding efficient long fights
```

### Blood-Price Bruiser

```text
Maximum HP
+ physical offense
+ self-costing Skills
+ threshold interactions
+ careful healing timing
```

These are examples, not mandatory classes or official named archetypes that every player must choose.

---

## 18. Primary / Secondary / Resonance / Essence Interaction

Stats are one layer of build identity, not the replacement for Discipline choice.

### Primary Discipline

Primary determines the active base Discipline stat profile. This creates meaningful directionality between two otherwise identical learned Discipline pairs.

For example:

```text
Skywarden Primary + Stormsinger Secondary
```

and:

```text
Stormsinger Primary + Skywarden Secondary
```

may share a core Resonance pair but still produce different base profiles and Skill emphasis.

### Secondary Discipline

Secondary grants no second base-stat profile. It contributes access to its learned Skill library under mixed-build capacity rules and enables Resonance with the Primary.

### Resonance

A Resonance may reward stat-relevant tactical behavior such as:

- moving an authored distance;
- intercepting damage;
- acting in a timing window;
- attacking from elevation;
- displacement;
- status setup/payoff.

Do not build an `every Resonance × every stat` matrix. Only authored interactions that create real gameplay deserve to exist.

### Essence

A pure Primary build may gain an Essence Skill whose effectiveness can interact with relevant stats through normal typed Skill scaling, but Essence must remain a signature expression of the Discipline rather than merely “gain +X to your best stat.”

---

## 19. Skills, Equipment & Supernatural Systems

### Discipline Skills

A Discipline ticket should ask:

- Which stats naturally support this Skill?
- Is the Skill still usable without min-maxing one exact stat?
- Does scaling alter tactical possibility, only magnitude, or both?
- Is any positional/resource/status interaction forecastable?
- What is the counterplay/opportunity cost?

### Equipment

Equipment is a major bridge between stats and tactics.

Healthy examples include:

- high-ground attacks gaining a bounded authored benefit;
- movement-distance triggers;
- teleport/displacement interactions;
- defensive payoff after resisting a status;
- resource conversion;
- Equipment Skills that create new positioning decisions.

Avoid same-item-plus-5%-number filler as the primary source of variety.

### Soulmarks

A Soulmark branch may create unusual stat relationships where appropriate, but a Soulmark should remain supernatural identity rather than “the Jump Soulmark” or “the Crit Soulmark.”

### Mantles

Mantles scale meaningfully from the character's fundamental attributes/derived stats rather than granting disconnected fixed power. Their temporary peak must be balanced by timing, duration, opportunity cost and Afterstrain.

Do not restore the superseded universal Rank I/II/III Mantle ladder unless a future explicit Owner decision reintroduces it.

### Veteran Edge

Veteran Edge should prefer bounded tactical texture and situational utility rather than uncapped raw stat inflation. Standard modes use only the approved bounded active Edge slot where enabled.

---

## 20. Map / Encounter Contract

A stat-led build only matters if content gives it opportunities and counters.

Every mature map/encounter library should collectively test different questions:

- vertical access;
- long vs short sight lines;
- narrow vs open movement;
- terrain cost;
- objectives requiring repositioning;
- physical vs Mystic pressure;
- control resistance;
- burst vs attrition;
- summons/zones;
- displacement;
- environmental hazards.

Do not make every map equally good for every build. Do avoid entire stat families being irrelevant across most released content.

---

## 21. AI Contract

AI must understand stat-led opportunities through the same legal combat rules players use.

Examples:

- high-Jump AI recognizes legal high-ground routes;
- high-Movement AI can value objectives/flanks without suiciding;
- Evasion-focused AI does not stand motionless in obvious kill zones;
- Armor/Ward anchors understand when to hold space;
- high-Initiative setup profiles value sequence timing;
- resource-heavy casters do not waste expensive Skills when a lower-cost legal action dominates.

AI never receives hidden stat bonuses or illegal information merely to simulate intelligence.

---

## 22. PvP Contract

PvP should preserve build expression while retaining counterplay.

Requirements:

- no stat creates practical immunity;
- extreme raw item differences may be normalized through transparent Arena Tempering where approved;
- build identity remains meaningful after normalization;
- forecasts expose important reliability/cost information;
- maps test more than one range/movement archetype;
- Resonance, Essence, Soulmark/Mantle, equipment and stats are measured separately enough to identify the actual source of imbalance;
- queue rules can disable/normalize exceptional prestige effects when required.

---

## 23. Analytics & Master Panel

The game should be able to answer questions such as:

- Which attributes are most/least invested in by level band?
- Which derived stats correlate with win rate or Expedition success?
- Is Jump only useful on one map?
- Is Evasion mandatory in one PvP bracket?
- Does a Primary Discipline's base profile dominate its reverse pairing?
- Are mixed builds or pure Essence builds globally outperforming the other route?
- Which Resonances create unintended stat breakpoints?
- Which equipment pieces turn one stat into a mandatory choice?
- Do AI profiles use their stat strengths competently?

Master Panel tuning must be versioned, audited and reversible.

---

## 24. Content Ticket Questions

When authoring a new Discipline, Skill, item, map, boss, enemy, Soulmark branch, Resonance, Essence, Mantle, or Veteran Edge, ask:

1. Which existing stats naturally matter here?
2. Does this create a new build possibility or deepen an existing one?
3. Is the interaction more interesting than a flat coefficient?
4. What does the specialist give up?
5. What counters it in PvE and PvP?
6. Is the rule forecastable/readable?
7. Can AI understand it through the same rules?
8. Can analytics measure whether it is healthy?
9. Is the interaction using current Primary/Secondary/Skill/Resonance/Essence terminology and capacity rules?

---

## 25. Acceptance Criteria for the Mature Stat Ecosystem

The stat system is healthy when:

- six universal attributes produce understandable but different build directions;
- derived stats visibly affect tactical possibility, not only coefficients;
- multiple credible archetypes exist without becoming mandatory classes;
- Jump/Movement/elevation create real spatial strategy;
- maps support specialization without unanswerable safe zones;
- equipment and Skills create intentional stat synergies;
- Primary/Secondary + Resonance/Essence + supernatural identity remain broader build layers rather than being overshadowed by raw stats;
- players understand important breakpoints and forecasts in-game;
- AI can use stat-led builds competently;
- PvP retains counterplay;
- PvE does not invalidate unusual builds by default;
- Master Panel analytics can measure and tune the ecosystem.

Players should be able to say things like:

- `I built around vertical positioning.`
- `I built a fast objective skirmisher.`
- `I built a control-resistant anchor.`
- `I built a huge resource-pool support caster.`
- `I built around this Resonance rather than raw stats.`
- `I stayed pure because this Essence Skill completes the plan.`
- `My Soulmark changes how this stat package behaves.`
- `My Mantle gives me a dangerous timed peak, but I have to survive the Afterstrain.`

…and those statements should correspond to visibly different decisions in battle.