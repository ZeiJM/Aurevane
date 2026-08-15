# AUREVANE — Combat Intelligence, Tactical Hall & Practice Arena

**Status:** Authoritative feature specification subordinate only to `docs/GAME_MASTER_PLAN.md` and complementary to the tactical-combat, progression, player-manual, and Master Panel specifications.

**Direction approved:** 2026-08-15.

AUREVANE needs two closely related systems:

1. **high-quality combat intelligence** so NPCs, enemies, bosses, summons, and encounter teams make competent, fair, understandable tactical decisions; and
2. a player-facing **Tactical Hall** containing a controlled **Practice Arena** where players can fight configurable AI opponents, test builds, learn mechanics, and improve without risking normal progression.

The Practice Arena is itself progression-aware. Players do **not** begin with every enemy brain, difficulty, level range, build, boss pattern, map, or scenario unlocked. They begin with a simple weak training opponent and gradually acquire additional **Tactical Records** through legitimate play.

The intended feeling is:

> “I learned how this kind of enemy thinks. Now I can practice against it, tune the challenge, and get better.”

not:

> “The AI cheats,” “the enemy is random,” or “the practice screen spoiled every enemy and build in the game on day one.”

---

## 1. Product Goals

Combat AI should make AUREVANE tactical combat feel:

- challenging without being unfair;
- learnable without becoming trivial;
- different across enemy roles and factions;
- capable of using terrain, facing, status effects, resources, positioning, focus fire, reactions, and team composition;
- consistent enough that players can recognize patterns and improve;
- adaptive enough that one simplistic exploit does not solve every encounter;
- deterministic/reproducible enough for debugging and balance testing;
- fast enough for a browser game;
- server-authoritative;
- versioned and tunable without rewriting every enemy individually.

The Tactical Hall should let players:

- practice safely;
- configure an opponent they have legitimately unlocked;
- change visible level/stat templates within unlocked ranges;
- select AI skill independently from raw stats;
- test positioning and terrain;
- repeat the same setup/seed;
- understand why they lost;
- gradually unlock more sophisticated opponents as their character grows.

---

## 2. Terminology

### Tactical Hall

The player-facing training feature and navigation destination.

### Practice Arena

The controlled battle environment inside the Tactical Hall.

### Tactical Record

A server-authoritative record that grants access to a specific opponent family, behavior profile, scenario, or simulation capability.

### AI Profile

A versioned data definition describing how a non-player combatant evaluates tactical options. It may reference role, personality, risk tolerance, priorities, team behavior, and difficulty-grade parameters.

### Intelligence Grade

How well the AI reasons. This is intentionally separate from level, attributes, equipment, and other raw combat power.

Recommended player-facing grades:

- **Recruit**
- **Trained**
- **Veteran**
- **Elite**
- **Master**

Names may later receive setting-specific presentation, but their mechanical meaning must remain clear.

### Combat AI Lab

The protected Owner/staff Master Panel environment for unrestricted testing, batch simulation, AI-vs-AI analysis, profile tuning, version comparison, and regression review.

---

## 3. AI Is Not a Hidden Stat Multiplier

AI difficulty and unit power are two different controls.

Example:

```text
Opponent: Bastion Sparring Record
Level: 42
Attributes: Standard Level-42 Template
Equipment: Veteran Training Set
AI Intelligence: Recruit
```

is fundamentally different from:

```text
Opponent: Bastion Sparring Record
Level: 42
Attributes: Standard Level-42 Template
Equipment: Veteran Training Set
AI Intelligence: Master
```

The second opponent should be harder because it makes better decisions, not because it secretly gains damage, accuracy, health, action points, vision, or immunity.

Visible scenario modifiers may intentionally alter stats, but those are separate explicit settings.

---

## 4. Combat Fairness Contract

AUREVANE AI must obey a formal fairness boundary.

By default an AI may reason from:

- its own authoritative state;
- visible unit positions;
- visible terrain, height, hazards, cover, zones, and objectives;
- public/observable statuses;
- public combat rules;
- abilities and effects it has legitimately observed or is fictionally expected to know;
- public character information available in that encounter mode;
- its own team state;
- legal memory of actions already observed during the current battle;
- deterministic public or server-known battle facts that are also allowed by the encounter rules.

Normal AI must **not** gain unfair access to:

- the player's uncommitted selected action;
- future random rolls;
- hidden inventory or private loadout information that the encounter rules do not expose;
- unrevealed traps/stealth information it has no detection right to know;
- future player input;
- hidden server/debug metadata;
- unreleased content merely because the implementation knows it exists.

Special enemies can have supernatural senses or scripted knowledge only when the game rules explicitly grant that capability and players can reasonably learn/counter it.

---

## 5. No Live Generative-Model Dependency

Core combat decisions should **not** depend on a remote generative AI/LLM call.

The production decision engine should be deterministic, bounded, testable game logic such as a combination of:

- legal-action enumeration;
- utility scoring;
- behavior/state machines;
- limited tactical lookahead;
- role and personality weights;
- team coordination;
- scripted boss-phase rules where required.

Reasons:

- predictable latency;
- reproducibility;
- no vendor dependency during battles;
- no hallucinated illegal actions;
- clear security boundary;
- deterministic testing;
- lower operating cost;
- better balance visibility.

A future learned/ML component may be evaluated offline if it demonstrably improves the game, but it must still output through the same legal-action boundary and pass the same fairness, reproducibility, performance, security, and regression standards before production use.

---

## 6. Core AI Decision Pipeline

A combatant decision should conceptually follow:

```text
AUTHORITATIVE BATTLE STATE
  ↓
AI KNOWLEDGE FILTER
  ↓
ENUMERATE LEGAL ACTIONS / MOVEMENT
  ↓
BUILD TACTICALLY MEANINGFUL CANDIDATES
  ↓
SCORE IMMEDIATE OUTCOMES
  ↓
OPTIONAL BOUNDED LOOKAHEAD
  ↓
TEAM / ROLE COORDINATION ADJUSTMENT
  ↓
RISK / PERSONALITY / DIFFICULTY WEIGHTS
  ↓
DETERMINISTIC SEEDED TIE-BREAK
  ↓
COMMIT ONE LEGAL SERVER ACTION
  ↓
RECORD DECISION REASON TAGS FOR DEBUG/REPLAY
```

The browser never chooses authoritative NPC actions.

---

## 7. What Strong AI Should Understand

Depending on intelligence grade and profile, combat AI should be capable of reasoning about:

### Positioning

- reachable tiles;
- attack ranges;
- line of sight;
- line/area shapes;
- facing;
- rear/flank opportunities;
- elevation;
- cover;
- chokepoints;
- escape routes;
- threat zones;
- hazards;
- objective zones;
- ally spacing;
- enemy clustering.

### Damage and survival

- expected damage rather than only maximum tooltip damage;
- kill confirmation;
- avoiding wasteful overkill;
- armor/Ward interactions;
- healing value;
- defensive cooldown value;
- whether disengaging creates a better next turn;
- protecting low-health or strategically important allies.

### Resources

- MP and other combat resources;
- cooldowns;
- Ultimate timing;
- consumable/scenario resources where allowed;
- whether to conserve or spend based on encounter state.

### Status and control

- status application value;
- status duration;
- immunity/resistance where known;
- combo setup;
- cleanse value;
- displacement value;
- diminishing-control systems in PvP-like rules where relevant.

### Build interactions

- Current + Legacy behavior when relevant;
- Arts;
- Traits;
- Reactions;
- Movement Arts;
- Confluences that the AI profile is actually permitted to know/use;
- Soulmark effects;
- equipment effects.

### Tempo

- initiative order;
- which unit acts next;
- whether a target can be removed before it acts;
- whether committing now exposes the AI to a stronger counter-turn;
- delaying, repositioning, baiting, or holding resources when tactically sound.

### Objectives

Not every encounter is deathmatch. AI should understand scenario goals such as:

- hold/capture an area;
- protect an NPC/object;
- escape;
- interrupt a ritual;
- survive a number of rounds;
- escort;
- deny access;
- destroy a priority object;
- boss-specific phase goals.

---

## 8. Distinct Behavior Archetypes

Enemies should not all feel like the same calculator with different skins.

Reusable profile families can include:

### Recruit

Simple baseline opponent. Understands obvious attacks and basic movement but has shallow planning and limited combo recognition.

This is the first Tactical Record available to a new player.

### Vanguard

Presses forward, contests space, favors reliable pressure and forcing reactions.

### Bulwark

Protects allies, holds chokepoints, values cover/guarding, and punishes reckless approach.

### Hunter

Looks for isolated, wounded, exposed, or high-value targets and uses mobility to create finishing opportunities.

### Skirmisher

Values movement, disengagement, ranged spacing, hit-and-run patterns, and terrain.

### Controller

Uses zones, displacement, slows, roots, terrain denial, and sequencing to limit player options.

### Duelist

Reads one-on-one spacing, reactions, baiting, counters, and commitment windows.

### Support Captain

Prioritizes team survival, buffs/debuffs, setup, focus-fire opportunities, and coordinated turns.

### Opportunist

Looks aggressively for status combinations, exposed reactions, low-resource targets, and temporary advantages.

### Objective Specialist

Optimizes the actual encounter objective rather than mindlessly chasing damage.

### Boss Director

Combines scripted phase identity with utility decisions inside each phase. Bosses should feel authored without becoming completely rigid.

Enemy factions and creatures can compose/modify these families rather than requiring one bespoke AI implementation per enemy.

---

## 9. Intelligence Grades

Difficulty should improve decision quality in understandable layers.

### Recruit

- narrow candidate set;
- short/no lookahead;
- recognizes obvious attacks and danger;
- limited reaction baiting;
- limited team coordination;
- occasionally chooses a merely reasonable action over the best action.

### Trained

- competent positioning;
- basic focus selection;
- common status combos;
- reasonable resource use;
- avoids obvious hazards and suicidal exposure.

### Veteran

- anticipates near-future turns;
- recognizes stronger combos;
- values initiative and kill windows;
- coordinates with allies;
- adapts to observed player patterns within the fight.

### Elite

- stronger candidate generation;
- deeper bounded lookahead;
- good reaction/counter baiting;
- stronger objective play;
- sophisticated resource and positioning decisions.

### Master

- strongest production reasoning budget;
- evaluates complex turn sequences and team interactions;
- uses advanced tactical traps and counterplay;
- still obeys the exact same information and rules boundary as the player-facing encounter permits.

Lower grades should not behave like deliberate nonsense. The goal is a believable learning curve, not random self-sabotage.

---

## 10. Human-Like Imperfection Without Coin-Flip Stupidity

AI variety can include bounded personality/risk differences, but difficulty should not be implemented as “roll a die to decide whether the enemy makes a stupid move.”

Prefer:

- narrower planning horizon;
- fewer candidate lines considered;
- less accurate threat evaluation;
- more conservative/aggressive weighting;
- incomplete combo recognition;
- reduced ally coordination;
- different risk tolerance;
- different target priorities.

Use randomness only for legitimate variation among similarly valued options, with deterministic server-seeded tie-breaking for reproducibility.

---

## 11. Tactical Memory and Adaptation

Higher-grade AI may maintain battle-local memory of observable behavior such as:

- the player repeatedly using the same opening;
- a Reaction already revealed;
- a common retreat direction;
- repeated dependence on one damage type or zone;
- a high-value support unit repeatedly protected by the team.

This memory resets or follows explicit encounter rules. It must not become secret global spying on private player behavior.

Persistent enemy/faction adaptation can exist only as an explicit live-world/gameplay system with clear rules and privacy-safe telemetry.

---

## 12. Team Intelligence

Groups need coordination so three competent units do not behave like three isolated bots.

Team AI should support concepts such as:

- target reservation to reduce pointless overkill;
- focus-fire opportunities;
- protecting/supporting priority allies;
- formation spacing;
- coordinated control chains within fairness rules;
- avoiding friendly obstruction;
- setup + payoff sequences;
- role-aware turn ordering;
- objective assignment;
- retreat/rally behavior.

A lightweight **team coordinator** can suggest shared priorities while each unit still chooses a legal individual action.

Coordination intensity should vary by enemy type. A disciplined military squad should coordinate more than a pack of feral creatures.

---

## 13. Boss Intelligence

Boss AI should combine authored encounter design with tactical intelligence.

Use:

- explicit phase state;
- telegraphed signature mechanics;
- scripted phase transitions;
- phase-specific legal action pools;
- utility-based choice among legal attacks/movement where appropriate;
- anti-stall rules;
- deterministic/replayable behavior;
- clear counters that players can learn.

Boss difficulty should not rely on reading player inputs before they commit or silently breaking combat rules.

A boss may have unique rules, but those rules belong to the boss encounter and must be communicated through gameplay/telegraphing.

---

## 14. Failure-Safe AI

An AI system must never soft-lock the battle because it cannot find its perfect move.

Every profile needs a safe fallback hierarchy such as:

1. valid high-score action;
2. valid lower-score action;
3. legal reposition/defend action;
4. legal wait/pass action if combat rules allow it.

Decision computation also needs a bounded time/work budget. If an advanced search exceeds its budget, fall back safely rather than hanging the turn.

---

# PART II — TACTICAL HALL / PRACTICE ARENA

## 15. Player-Facing Purpose

The Tactical Hall is where a player can learn combat deliberately rather than only through costly live encounters.

It supports:

- learning enemy patterns;
- practicing a new Discipline;
- testing Current + Legacy interactions;
- practicing movement/facing/terrain;
- testing against different level/stat bands;
- rehearsing boss mechanics after legitimate discovery;
- learning how a specific AI archetype behaves;
- repeating a difficult scenario with the same setup;
- comparing build changes.

The Hall is useful from the earliest game but grows substantially through progression.

---

## 16. Starting Access

A new character begins with only a small safe set of training tools.

Recommended starting access:

```text
TACTICAL HALL

Tactical Record: Recruit Sparring Partner
Intelligence: Recruit
Level range: early-game training band
Attributes: Standard / Durable / Agile beginner presets
Map: Basic Training Floor
Mode: 1v1 defeat opponent
```

This first AI should be intentionally weak but still obey core combat rules correctly.

The new player should **not** see a menu containing every boss, Discipline, secret enemy, Soulmark, Confluence, late-game AI profile, or unreleased encounter.

---

## 17. Tactical Record Progression

Practice access is part of character/world progression.

A Tactical Record may move through states such as:

```text
UNKNOWN
  ↓
OBSERVED
  ↓
RECORDED
  ↓
STUDIED
```

### Unknown

The opponent/profile does not appear in the normal player catalog.

### Observed

The player has legitimately encountered enough of the enemy/archetype for a spoiler-safe record hint, but may not yet have full simulation access.

### Recorded

The player can fight the standard simulation.

### Studied

Higher intelligence grades, advanced scenario variations, expanded level ranges, or additional behavior variants become available.

Not every record needs all four stages, but the model prevents instant full-catalog access.

---

## 18. Ways to Unlock New AI Opponents

Tactical Records can unlock through meaningful play such as:

- encountering an enemy family;
- defeating that enemy legitimately;
- completing a mentor/training quest;
- reaching a Horizon milestone;
- mastering or substantially studying a related Discipline;
- completing a tactical challenge;
- finding an Archive/manual/training record where appropriate;
- clearing an Expedition tier;
- defeating a boss before its practice simulation becomes available;
- completing a region/faction training requirement;
- participating in an event that introduced a temporary enemy;
- earning a higher training certification by beating the lower intelligence grade.

The exact acquisition route is data-driven per record.

The premium shop must not sell stronger Tactical Records, AI grades, boss practice access, or training capabilities that materially improve competitive preparation.

---

## 19. Boss and Spoiler Protection

Boss simulations should generally unlock only **after** the player has legitimately encountered/cleared the required version.

The Tactical Hall must not reveal:

- unreached phases;
- secret mechanics;
- unreleased enemies;
- hidden story identities;
- undiscovered Confluences/Soulmark mechanics;
- late-game loadouts merely because the AI definition exists internally.

A practice record can deliberately represent only the portion of an encounter the player has learned so far.

---

## 20. Player Practice Configuration

Within their unlocked permissions, the player can configure a drill using settings such as:

### Opponent

- Tactical Record;
- intelligence grade;
- level;
- legal attribute preset or custom allocation under an unlocked budget;
- equipment preset;
- Discipline/loadout profile;
- Soulmark/Confluence configuration only when legitimately unlocked for that simulation;
- number of opponents where the scenario supports it.

### Player side

- current character;
- current build;
- saved legal loadout snapshot;
- optional normalized practice state when a drill requires it.

Practice mode must not grant ownership of equipment, Disciplines, Confluences, Soulmarks, or other content merely because the simulator temporarily represents them.

### Arena

- unlocked map/template;
- starting positions;
- terrain;
- elevation;
- hazards;
- objective;
- starting HP/MP/resource percentages;
- initiative mode;
- repeatable seed;
- turn/round limit where relevant.

The UI should clearly distinguish **AI Intelligence** from **Level/Attributes/Equipment**.

---

## 21. Level and Attribute Controls

The player should be able to make a known opponent weaker, equal, or stronger within unlocked training ranges.

Examples:

- Level 20 Recruit AI with normal Level-20 attributes;
- Level 40 Recruit AI;
- Level 40 Elite AI;
- Level 60 Elite AI with a durable attribute preset;
- equalized-level practice against a known Discipline archetype.

High-level freeform values should unlock gradually so a new player does not gain a spoiler-rich endgame laboratory immediately.

A later advanced sandbox can permit broader stat editing for players who have earned it, but practice values remain isolated from persistent ownership/progression.

---

## 22. Scenario Presets

Useful drills can include:

- basic duel;
- ranged approach;
- hold the chokepoint;
- escape a control zone;
- survive three rounds;
- protect a fragile ally;
- defeat the support unit first;
- fight from low resources;
- practice elevation;
- practice facing/rear attacks;
- reaction baiting;
- control-diminishing practice;
- boss mechanic rehearsal;
- 1v2 pressure;
- squad coordination.

Presets should teach actual game concepts and can be tied to tutorial/manual articles.

---

## 23. Practice Rewards and Anti-Farming

Normal custom Practice Arena battles should not become the most efficient way to gain persistent power.

Default:

- no normal Character XP farm;
- no repeatable Mastery farm;
- no Crowns/economy output;
- no loot drops;
- no PvP rating;
- no quest/event attendance credit;
- no boss-clear/world-clear credit;
- no first-witness/Chronicle credit meant for real events.

Specific tutorial/mentor/training quests may award a one-time configured reward for completing an authored drill, but repeated custom practice is primarily for **player learning**.

This prevents low-risk simulation farming from undermining natural progression or Wayfarer's Practice.

---

## 24. Fast Iteration Features

The Practice Arena should minimize friction:

- instant restart;
- repeat same seed;
- swap intelligence grade;
- adjust level/stat preset;
- change one loadout choice and retry;
- save named drill presets;
- copy previous configuration;
- optional accelerated animation speed where readability remains intact;
- surrender/reset without penalty.

Players should spend time testing tactics, not rebuilding the form after every fight.

---

## 25. Battle Review

After practice, provide a useful **Battle Review** rather than only WIN/LOSE.

Possible information:

- turns/rounds;
- damage dealt/taken;
- healing;
- status application/cleansing;
- resource spending;
- movement distance;
- hazard damage;
- objective progress;
- key reaction triggers;
- kill windows;
- timeline of actions;
- heatmap/position history later;
- AI decision reason tags after the battle;
- links to relevant manual sections.

Decision explanations should be generated from structured reason tags, not invented prose from an ungrounded model.

Example:

```text
Veteran Hunter moved to Tile H7 because:
- rear attack became available
- target was below 30% HP
- tile remained outside Bastion threat zone
- expected finishing probability increased
```

This is valuable both for learning and for proving the AI is acting fairly.

---

## 26. Optional AI Intent Reveal

Normal PvE does not need to expose the AI's internal scoring.

Practice mode may offer post-battle or advanced-training visibility such as:

- selected target priority;
- major threat considered;
- objective priority;
- why a tile/action was chosen;
- candidate actions rejected for legality.

Do not expose hidden story/boss information the player's Tactical Record has not unlocked.

---

# PART III — PRODUCTION AI QUALITY

## 27. One Core AI Framework, Many Profiles

Do not build unrelated AI code separately for every enemy.

Prefer:

```text
CORE LEGAL-ACTION / TACTICAL EVALUATION ENGINE
+
AI PROFILE
+
ENEMY / DISCIPLINE CAPABILITIES
+
INTELLIGENCE GRADE
+
ENCOUNTER / OBJECTIVE RULES
+
OPTIONAL BOSS PHASE DIRECTOR
```

This gives us consistency, easier testing, and safer balance iteration while still allowing distinctive enemies.

---

## 28. Data-Driven AI Profiles

A profile may contain/version values such as:

```text
profile_id
profile_version
role_tags
intelligence_grade_cap
risk_tolerance
aggression_weight
survival_weight
objective_weight
focus_fire_weight
finish_kill_weight
ally_protection_weight
resource_conservation_weight
control_weight
mobility_weight
hazard_avoidance_weight
reaction_bait_weight
lookahead_budget
candidate_budget
team_coordination_level
knowledge_policy
fallback_policy
```

Exact schema belongs to implementation tickets. The important rule is that behavior tuning is explicit, versioned, and testable rather than spread through arbitrary component conditionals.

---

## 29. Discipline AI Coverage

Every playable Discipline must eventually define how AI uses it.

Each Discipline implementation should identify:

- preferred engagement range;
- high-value Arts;
- resource thresholds;
- setup/payoff combos;
- mobility intent;
- Reaction considerations;
- defensive triggers;
- Ultimate conditions;
- Confluence-aware behavior where applicable;
- bad/wasteful use cases to avoid;
- AI test scenarios.

A technically usable ability is not enough. The AI must know when that ability is sensible.

---

## 30. Enemy Identity Through AI

AI behavior should reinforce fiction.

Examples:

- trained soldiers coordinate focus and formations;
- predators isolate weak targets;
- undead may value self-preservation less;
- cautious scholars avoid unnecessary exposure and use control;
- fanatics may accept dangerous trades for objectives;
- elite duelists bait reactions;
- bosses enforce authored phase identity.

Do not make all enemies equally omniscient or equally optimized.

---

## 31. Counterplay Must Exist

Strong AI should have habits and priorities that players can learn.

A fair difficult opponent often becomes satisfying when the player realizes:

- the Hunter strongly values isolated wounded units;
- the Bulwark refuses to abandon a protected objective easily;
- the Controller prefers a certain zone setup;
- the Duelist saves a Reaction for predictable commitment windows.

Difficulty should reward observation, adaptation, build decisions, and execution.

If the only solution is “have larger numbers,” the AI design has failed.

---

## 32. Avoid Perfect-Solver Monotony

The strongest AI should be very good, but the game should not become an exhausting chess engine every ordinary trash encounter.

Encounter difficulty can vary through:

- intelligence grade;
- enemy composition;
- map design;
- objectives;
- level/stat power;
- special mechanics;
- boss rules;
- resource state.

Routine enemies can use cheaper/lower grades while elite/boss content receives stronger reasoning budgets.

---

## 33. Performance Budgets

Combat AI must remain efficient enough for production concurrency.

Measure:

- candidate actions evaluated;
- pathfinding calls;
- search/lookahead nodes;
- average decision latency;
- p95/p99 decision latency;
- memory allocation where useful;
- worker/server CPU cost;
- worst-case crowded-board scenarios.

Do not solve quality by using unbounded search.

Prefer intelligent candidate pruning and domain-specific tactical evaluation.

---

## 34. Determinism and Replays

Given the same:

- battle state;
- content versions;
- AI profile version;
- rules version;
- seed;

AI decisions should be reproducible unless a feature explicitly documents nondeterminism.

Battle/replay records should store enough version metadata to reproduce historical decisions after AI tuning changes.

A battle that begins under AI profile version X should not silently switch to version Y halfway through because an operator published an update.

---

## 35. Testing Standard

Combat AI requires more than a few example unit tests.

Use layers such as:

### Legal-action tests

AI never commits an action the combat engine declares illegal.

### Determinism tests

Same state/version/seed produces the same decision/replay.

### Knowledge-boundary tests

AI cannot use information excluded by its knowledge policy.

### Tactical regression scenarios

Curated board states verify that an AI recognizes obvious concepts such as:

- guaranteed kill;
- lethal hazard;
- heal a critical ally;
- protect objective;
- avoid friendly overkill;
- use a known combo;
- escape an unavoidable threat when possible.

### Random-state/property tests

Generate many valid battle states and verify safety invariants.

### Performance tests

Pathological boards stay inside decision budgets.

### Matchup simulation

Batch AI-vs-AI runs detect major balance/behavior regressions.

### Human playtests

Numbers cannot determine whether an AI feels readable, fair, surprising, repetitive, or annoying.

---

## 36. AI Quality Metrics

Track production/QA metrics such as:

- AI turn latency;
- illegal-action attempts caught before commit;
- fallback frequency;
- repeated-action loops;
- movement oscillation;
- wasted healing/overkill;
- objective neglect;
- resource waste;
- win/loss by AI profile and content tier;
- encounter duration;
- player surrender/abandon rate;
- damage/resource efficiency;
- boss mechanic failures;
- practice retry patterns;
- Tactical Record unlock/use rates.

Win rate alone is not enough. An AI can win often and still feel terrible.

---

# PART IV — COMBAT AI LAB / MASTER PANEL

## 37. Owner and Staff AI Lab

The protected Master Panel should eventually include a **Combat AI Lab**.

Unlike the player Tactical Hall, authorized Owner/QA/balance staff may access:

- all registered live profiles;
- unpublished/internal test profiles;
- arbitrary supported level/stat templates;
- hidden/test equipment and builds;
- any arena map/scenario;
- AI-vs-player;
- AI-vs-AI;
- team-vs-team;
- boss phase testing;
- exact seed replay;
- batch simulation.

This is a QA/balance tool, not a player progression surface.

---

## 38. AI Profile Operations

Depending on permissions, the Master Panel should support:

- inspect AI profile;
- duplicate as draft;
- edit profile weights/config;
- preview/stage;
- run benchmark suite;
- compare against current live version;
- publish a new version;
- rollback;
- disable/replace a broken profile;
- assign profile to enemy definitions;
- inspect which encounters use a profile;
- audit changes.

The protected Owner retains override authority. Ordinary balance staff receive least privilege.

---

## 39. Batch Simulation

The Combat AI Lab should support reproducible simulations such as:

```text
10,000 matches
Bastion Veteran AI vs Riftblade Veteran AI
Level 60 normalized template
Map pool: 5 arena maps
Seed set: recorded
```

Outputs can include:

- win rate;
- side/map bias;
- average rounds;
- damage/healing;
- resource usage;
- first-move advantage;
- action frequency;
- position heatmaps;
- fallback/error rates;
- performance timing;
- matchup outliers.

Batch simulations inform balance. They do not replace human testing.

---

## 40. AI Version Comparison

Before publishing a major AI change, the Lab should be able to compare:

```text
LIVE PROFILE v12
vs
CANDIDATE PROFILE v13
```

across the same seed/scenario corpus.

Flag meaningful changes such as:

- much higher/lower win rate;
- slower decision time;
- increased fallback use;
- changed target selection;
- objective neglect;
- new loops;
- excessive resource hoarding;
- unusual matchup spikes.

---

## 41. Production Safety

AI configuration is live game configuration and must use:

- versioning;
- validation;
- permission checks;
- staged preview where appropriate;
- audit history;
- rollback;
- per-profile kill/fallback controls;
- immutable battle pinning to the version active at battle creation.

Do not allow an invalid AI draft to become production merely because the editor saved successfully.

---

# PART V — PROGRESSION, UI, MANUAL & ROADMAP

## 42. Tactical Hall Progression Must Feel Earned

Unlocking additional Tactical Records should reinforce the main game.

A player might think:

> “I finally defeated that Frostmere Controller, so now its training record is available. I can practice the matchup before going deeper.”

This is useful progression without raw stat inflation.

The Hall can become a collection/learning system alongside the Archive, but it should not overwhelm the player with a second giant checklist.

---

## 43. No Pay-to-Win Training Access

The normal premium shop must not sell:

- stronger AI grades;
- unreached boss simulations;
- hidden enemy Tactical Records;
- additional stat ranges that provide meaningful competitive preparation;
- advanced practice analysis unavailable through gameplay;
- faster Tactical Record unlocks.

Cosmetic arena themes, banners, training-room decoration, or harmless presentation may be premium if they provide zero combat/preparation advantage.

---

## 44. Player Manual Requirements

The Adventurer's Guide must eventually explain:

- how Tactical Hall access works;
- what Tactical Records are;
- how records unlock;
- AI Intelligence versus level/stats;
- what practice battles do/do not reward;
- how to repeat the same seed;
- how Battle Review works;
- that practice simulations do not grant ownership of represented items/builds;
- why stronger AI is difficult without secretly cheating;
- boss/spoiler restrictions.

Contextual help should link directly from the Practice Arena configuration screen and Battle Review.

---

## 45. Accessibility and UX

The Practice Arena should support the same battle accessibility standards as normal combat.

Additionally:

- settings must clearly label stat power and intelligence separately;
- locked records should explain spoiler-safe unlock direction when appropriate;
- color must not be the only indicator of AI grade;
- Battle Review timelines must be keyboard/screen-reader navigable;
- heatmaps/diagrams need text alternatives where practical;
- reset/retry controls should be easy to find;
- no accidental normal-progression loss should occur from entering practice.

---

## 46. Implementation Timing

### Phase 2 — Tactical Combat Core

Build the architectural foundation alongside deterministic combat:

- server-authoritative AI decision interface;
- AI knowledge filter;
- legal-action enumeration reuse from the combat engine;
- baseline utility evaluation;
- deterministic seeded tie-breaking;
- safe fallback behavior;
- first **Recruit** AI;
- decision reason tags/logging;
- developer/QA deterministic practice harness;
- first player-facing Tactical Hall slice only after the normal battle flow is stable: Recruit record, basic level/stat presets, one training floor, instant reset, no normal progression rewards.

The Phase 2 gate should include at least one complete human-vs-AI tactical battle where the AI behaves legally and reproducibly.

### Phase 3 — Discipline Framework

- make AI understand reusable effects, resources, statuses, Arts, Traits, Reactions, Movement Arts, and basic build interactions;
- define per-Discipline AI usage metadata;
- add initial behavior archetypes;
- add stronger intelligence grades where the combat engine can support them cleanly;
- expand Tactical Hall to Discipline-aware sparring records.

### Phase 4 — First Playable Discipline Set

- every initial Discipline receives AI usage rules/tests;
- expand Recruit/Trained/Veteran practice opponents;
- add Tactical Record unlock progression;
- add useful scenario presets;
- begin human fairness/readability playtesting;
- establish benchmark tactical scenarios for regression.

### Phase 5 — Living World

- connect Tactical Record acquisition to encounters, mentors, regions, Horizons, Archive/training discoveries, and progression;
- present the Tactical Hall as a believable world service/location or equivalent UI destination;
- keep records spoiler-safe;
- integrate “new Tactical Record learned” into restrained progression messaging.

### Phase 6 — Party & Co-op

- add team coordinator behavior;
- validate enemy squads against three-player groups;
- add allied NPC AI where required;
- add multi-unit practice drills.

### Phase 7 — Expeditions

- add Expedition enemy coordination;
- multiphase boss AI directors;
- boss practice records after legitimate clears;
- objective-specific AI;
- stress-test long encounters and reconnect/replay consistency.

### Phase 8 — PvP

- use AI practice opponents to rehearse legal PvP-like builds/rules where appropriate;
- do not silently populate ranked queues with bots presented as human players;
- if bots are ever used in a queue, the mode/rules must explicitly support and disclose that behavior;
- benchmark AI against PvP tactical patterns without granting it private opponent information.

### Phase 9 — Full Discipline Roster

- complete AI usage rules and regression coverage for all released Disciplines;
- expand advanced Tactical Records without exposing unreleased content;
- validate Confluence/Soulmark-aware decision quality.

### Phase 13 — Complete Master Panel

Build the full **Combat AI Lab**:

- AI profile editor;
- profile assignment inspection;
- versioning/diff/rollback;
- unrestricted authorized practice setup;
- AI-vs-AI;
- batch simulation;
- matchup matrices;
- decision/performance analytics;
- benchmark-suite runner;
- staged publish;
- per-profile emergency fallback/disable controls;
- Tactical Record unlock/config editor.

### Phase 15 — Hardening

Validate:

- legal-action correctness;
- knowledge-boundary fairness;
- deterministic reproduction;
- AI decision performance under load;
- pathfinding worst cases;
- fallback behavior;
- no loops/oscillation soft locks;
- boss telegraph/counterplay fairness;
- Tactical Record authorization/spoiler safety;
- practice reward isolation;
- version pinning and rollback;
- AI profile permission/audit controls;
- human playtests across skill levels.

---

## 47. Closed Alpha AI Target

Before Closed Alpha is considered combat-quality complete, aim for:

- a reliable shared combat AI framework;
- Recruit/Trained/Veteran grades for representative enemies;
- distinct archetype behavior across several enemy families;
- AI usage rules for the initial playable Discipline set;
- competent squad coordination for relevant encounters;
- bosses with authored, fair, learnable AI behavior;
- a useful player Tactical Hall with progression-gated records;
- basic level/stat/opponent configuration;
- repeatable practice seeds;
- Battle Review foundation;
- a QA benchmark suite showing no common illegal-action/soft-lock failures.

Not every final Master-level AI profile or full Combat AI Lab feature must exist before early alpha testing, but the architecture must already support them cleanly.

---

## 48. Definition of Success

This system succeeds when:

- enemies make tactically sensible choices;
- different enemy roles genuinely feel different;
- stronger AI is harder because it reasons better, not because it secretly cheats;
- players can learn patterns and counter them;
- combat remains fair enough that losses usually feel explainable;
- a new player begins with only a basic weak practice opponent;
- additional AI opponents/grades unlock naturally through progression;
- players can tune level/attributes independently from intelligence;
- practice battles are useful without becoming a zero-risk progression farm;
- boss practice does not spoil undiscovered encounters;
- the same AI framework powers real PvE and the Practice Arena;
- AI decisions are server-authoritative, bounded, reproducible, and efficient;
- every released Discipline has meaningful AI usage rules;
- team AI coordinates without becoming omniscient;
- the Owner can inspect, simulate, tune, stage, publish, rollback, and benchmark AI through the Master Panel;
- automated tests catch illegal actions and major regressions;
- human playtests confirm that the battle system feels challenging, learnable, and fair.