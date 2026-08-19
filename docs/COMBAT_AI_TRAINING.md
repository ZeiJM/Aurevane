# AUREVANE — Combat Intelligence, Battle Hall & Practice Systems

**Status:** Authoritative feature specification subordinate to `docs/GAME_MASTER_PLAN.md`, `docs/GAME_MASTER_PLAN_BUILD_SYSTEM_ADDENDUM.md`, and the canonical combat rules in `docs/COMBAT.md`.

**Initial direction approved:** 2026-08-15.  
**Player-facing terminology synchronized:** 2026-08-19.

AUREVANE needs two closely related systems:

1. **high-quality combat intelligence** so NPCs, enemies, bosses, summons, and encounter teams make competent, fair, understandable tactical decisions; and
2. a player-facing **Battle Hall** where players can fight controlled AI opponents, test builds, learn mechanics, and improve without risking normal progression.

The Battle Hall is progression-aware. Players do **not** begin with every enemy brain, difficulty, level range, build, boss pattern, map, or scenario unlocked. They begin with a simple training opponent and gradually acquire additional **Tactical Records** through legitimate play.

The intended feeling is:

> “I learned how this kind of enemy thinks. Now I can practice against it, tune the challenge, and get better.”

not:

> “The AI cheats,” “the enemy is random,” or “the practice screen spoiled every enemy and build in the game on day one.”

The former player-facing name **Tactical Hall** is retired. Historical references may remain in old snapshots, but current UI, docs, tickets, and content should use **Battle Hall**.

Current build terminology also applies here:

- Primary Discipline;
- optional mastered Secondary Discipline;
- Skills;
- Resonance for mixed builds;
- Essence for pure builds;
- Soulmark or Soul-Severed/Mantle supernatural paths.

Do not restore Current/Legacy, Arts, Confluences, or separate Trait/Reaction/Movement Art/Ultimate slot assumptions through AI configuration.

---

## 1. Product Goals

Combat AI should make AUREVANE tactical combat feel:

- challenging without being unfair;
- learnable without becoming trivial;
- different across enemy roles and factions;
- capable of using terrain, facing, statuses, resources, positioning, focus fire, typed triggered effects, and team composition;
- capable of understanding released Skills and build interactions;
- consistent enough that players can recognize patterns and improve;
- adaptive enough that one simplistic exploit does not solve every encounter;
- deterministic/reproducible enough for debugging and balance testing;
- fast enough for a browser game;
- server-authoritative;
- versioned and tunable without rewriting every enemy individually.

The Battle Hall should let players:

- practice safely;
- choose a supported drill/opponent they have legitimately unlocked;
- change visible level/stat templates within unlocked ranges where the mode allows;
- select AI intelligence independently from raw stats;
- test positioning and terrain;
- repeat the same setup/seed;
- understand why they lost;
- gradually unlock more sophisticated opponents as their character grows.

The current preview begins more narrowly: Battle Hall opens with no mode preselected and **AI Sparring** is the first explicit full training duel. Future configuration depth is unlocked only as the relevant systems become real.

---

## 2. Terminology

### Battle Hall

The current player-facing practice-combat feature and navigation destination.

### AI Sparring

The first explicit full training duel inside Battle Hall. It uses the authoritative combat engine and released Recruit AI behavior.

### Practice drill / practice scenario

A controlled Battle Hall encounter intended for learning/testing rather than normal progression farming.

### Tactical Record

A server-authoritative record that grants access to a specific opponent family, behavior profile, scenario, or simulation capability.

### AI Profile

A versioned data definition describing how a non-player combatant evaluates tactical options. It may reference role, personality, risk tolerance, priorities, team behavior, and difficulty-grade parameters.

### Intelligence Grade

How well the AI reasons. This is intentionally separate from level, attributes, equipment, and other raw combat power.

Long-term player-facing grades may include:

- **Recruit**
- **Trained**
- **Veteran**
- **Elite**
- **Master**

Current preview difficulty/profile labels may be narrower while the framework is validated.

### Combat AI Lab

The protected Owner/staff Master Panel environment for unrestricted testing, batch simulation, AI-vs-AI analysis, profile tuning, version comparison, and regression review.

---

## 3. AI Is Not a Hidden Stat Multiplier

AI difficulty and unit power are different controls.

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

The second opponent should be harder because it makes better decisions, not because it secretly gains damage, Accuracy, HP, Action Economy, vision, or immunity.

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
- Skills/effects it has legitimately observed or is fictionally expected to know;
- public character information available in that encounter mode;
- its own team state;
- legal memory of actions already observed during the battle;
- deterministic facts allowed by the encounter rules.

Normal AI must **not** gain unfair access to:

- the player's uncommitted selected action;
- future random rolls;
- hidden inventory or private loadout information not exposed by the mode;
- unrevealed traps/stealth state it has no detection right to know;
- future player input;
- hidden debug metadata;
- unreleased content merely because implementation code knows it exists.

Special enemies can have supernatural senses or scripted knowledge only when explicit rules grant that capability and players can reasonably learn/counter it.

---

## 5. No Live Generative-Model Dependency

Core combat decisions should **not** depend on a remote generative AI/LLM call.

Production decision logic should be deterministic, bounded, testable game logic such as:

- legal-action enumeration;
- utility scoring;
- behavior/state machines;
- limited tactical lookahead;
- role/personality weights;
- team coordination;
- scripted boss-phase rules where required.

Reasons include predictable latency, reproducibility, no vendor dependency during battles, no hallucinated illegal actions, clearer security, deterministic testing, lower operating cost, and better balance visibility.

A future learned/ML component may be evaluated offline if it demonstrably improves the game, but it must still output through the same legal-action boundary and pass fairness, reproducibility, performance, security, and regression standards before production use.

---

## 6. Core AI Decision Pipeline

A combatant decision conceptually follows:

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
COMMIT LEGAL SERVER COMMAND(S) WITHIN CURRENT ACTION ECONOMY
  ↓
RECORD DECISION REASON TAGS FOR DEBUG/REPLAY
```

The browser never chooses authoritative NPC actions.

Because PV-1F uses a shared 100 AE turn economy, AI may need to select a legal sequence of commands within one turn rather than assume exactly one action. It must use the same AE, movement, target, facing, effect, and turn-end rules as players.

---

## 7. What Strong AI Should Understand

Depending on intelligence grade/profile, combat AI should reason about:

### Positioning

- reachable tiles;
- traversal/AE cost;
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
- Armor/Ward interactions;
- healing value;
- defensive cooldown value;
- whether disengaging creates a better next turn;
- protecting low-health or strategically important allies.

### Resources

- Action Economy;
- HP/MP;
- temporary Discipline resources;
- cooldowns;
- consumable/scenario resources;
- whether to conserve or spend based on encounter state.

There is no separate universal Ultimate timing subsystem. High-impact Skills use their authored cooldown/resource/AE rules like other Skills.

### Status and control

- status application value;
- duration;
- immunity/resistance where known;
- setup/payoff;
- cleanse value;
- displacement;
- diminishing-control systems in PvP-like rules where relevant.

### Build interactions

Where legitimately known and released, AI can understand:

- Primary Discipline base profile and Skill library;
- optional mastered Secondary Discipline;
- mixed-build six-Skill capacity;
- pure-build eight-Skill capacity;
- Resonance passives;
- Essence Skills;
- Soulmark/Mantle effects;
- Equipment Skills/passives;
- typed triggered/passive effects;
- approved bounded Veteran Edge effects.

### Tempo

- initiative order;
- which unit acts next;
- whether a target can be removed before acting;
- whether spending AE now exposes the actor to a stronger counter-turn;
- delaying, repositioning, baiting, or conserving resources when tactically sound.

### Objectives

AI must understand scenario goals beyond deathmatch:

- hold/capture an area;
- protect an NPC/object;
- escape;
- interrupt a ritual;
- survive rounds;
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

### Vanguard

Presses forward, contests space, favors reliable pressure and forcing responses.

### Bulwark

Protects allies, holds chokepoints, values defensive play, and punishes reckless approach.

### Hunter

Looks for isolated, wounded, Exposed, or high-value targets and uses mobility to create finishing opportunities.

### Skirmisher

Values movement, disengagement, ranged spacing, hit-and-run patterns, and terrain.

### Controller

Uses zones, displacement, slows, roots, terrain denial, and sequencing to limit options.

### Duelist

Reads one-on-one spacing, baiting, counters, and commitment windows.

### Support Captain

Prioritizes team survival, buffs/debuffs, setup, focus-fire opportunities, and coordinated turns.

### Opportunist

Looks aggressively for status combinations, exposed targets, low-resource enemies, and temporary advantages.

### Objective Specialist

Optimizes the encounter objective rather than mindlessly chasing damage.

### Boss Director

Combines scripted phase identity with bounded tactical choice. Bosses should feel authored without becoming completely rigid.

Enemy factions/creatures can compose/modify these families rather than requiring one bespoke AI implementation per enemy.

---

## 9. Intelligence Grades

### Recruit

- narrow candidate set;
- short/no lookahead;
- recognizes obvious attacks and danger;
- limited baiting;
- limited coordination;
- may choose a merely reasonable action over the best action.

### Trained

- competent positioning;
- basic focus selection;
- common status combos;
- reasonable resource use;
- avoids obvious hazards/suicidal exposure.

### Veteran

- anticipates near-future turns;
- recognizes stronger combos;
- values initiative and kill windows;
- coordinates with allies;
- adapts to observed battle-local player patterns.

### Elite

- stronger candidate generation;
- deeper bounded lookahead;
- better counter baiting;
- stronger objective play;
- sophisticated resource/positioning decisions.

### Master

- strongest production reasoning budget;
- evaluates complex turn sequences/team interactions;
- uses advanced tactical traps/counterplay;
- still obeys the same information/rules boundary.

Lower grades should not behave like deliberate nonsense.

---

## 10. Human-Like Imperfection Without Coin-Flip Stupidity

Difficulty should not mean “roll a die to decide whether the enemy makes a stupid move.”

Prefer:

- narrower planning horizon;
- fewer candidate lines;
- less accurate threat evaluation;
- conservative/aggressive weighting differences;
- incomplete combo recognition;
- reduced ally coordination;
- different risk tolerance;
- different target priorities.

Use randomness only for legitimate variation among similarly valued options, with deterministic server-seeded tie-breaking for reproducibility.

---

## 11. Tactical Memory and Adaptation

Higher-grade AI may maintain battle-local memory of observable behavior such as:

- repeated openings;
- a triggered/passive response already revealed;
- a common retreat direction;
- repeated dependence on one damage type or zone;
- a protected high-value support unit.

Memory resets or follows explicit encounter rules. It does not become secret global spying on private behavior.

Persistent faction adaptation can exist only as an explicit gameplay system with clear rules and privacy-safe telemetry.

---

## 12. Team Intelligence

Team AI should support:

- target reservation to reduce overkill;
- focus-fire opportunities;
- protecting/supporting priority allies;
- formation spacing;
- coordinated control chains within fairness rules;
- avoiding friendly obstruction;
- setup + payoff sequences;
- role-aware sequencing;
- objective assignment;
- retreat/rally behavior.

A lightweight team coordinator can suggest shared priorities while each unit still executes legal authoritative commands.

Coordination intensity varies by identity: trained soldiers coordinate more than feral creatures.

---

## 13. Boss Intelligence

Boss AI combines authored encounter design with tactical intelligence.

Use:

- explicit phase state;
- telegraphed signature mechanics;
- scripted transitions;
- phase-specific legal Skill/action pools;
- utility-based choice where appropriate;
- anti-stall rules;
- deterministic/replayable behavior;
- clear learnable counters.

Boss difficulty cannot rely on reading player input before commit or silently breaking rules.

---

## 14. Failure-Safe AI

AI must never soft-lock battle because it cannot find a perfect move.

Fallback hierarchy:

1. valid high-score command/sequence;
2. valid lower-score command/sequence;
3. legal reposition/defend behavior;
4. legal facing/turn completion or wait/pass behavior where rules permit.

Decision work is bounded. If advanced search exceeds its budget, fall back safely rather than hanging the turn.

---

# PART II — BATTLE HALL

## 15. Player-Facing Purpose

Battle Hall is where players deliberately learn combat rather than only through costly live encounters.

Long-term it supports:

- learning enemy patterns;
- practicing a new Primary Discipline;
- testing pure Essence builds;
- testing Primary + mastered Secondary + Resonance interactions;
- practicing movement/facing/terrain;
- testing supported level/stat bands;
- rehearsing boss mechanics after legitimate discovery;
- learning AI archetypes;
- repeating scenarios with the same seed;
- comparing build changes.

The Hall begins simple and grows with progression.

---

## 16. Starting Access

A new character begins with a small safe set of training tools.

Current preview:

```text
BATTLE HALL

No mode preselected on entry
AI Sparring: first explicit full duel
Recruit AI foundation
Focused movement / strike / guard drills where released
Practice rewards isolated from normal progression
```

Long-term progression can expand Tactical Records, opponent families, intelligence grades, level/stat ranges, maps, objectives and saved drills.

The player should **not** see every boss, Discipline, secret enemy, Soulmark/Mantle, Resonance, late-game AI profile, or unreleased encounter on day one.

---

## 17. Tactical Record Progression

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

Opponent/profile does not appear in normal player catalog.

### Observed

Player has legitimately encountered enough for a spoiler-safe hint but may not have full simulation access.

### Recorded

Player can fight the standard simulation.

### Studied

Higher intelligence grades, advanced scenarios, expanded ranges, or behavior variants become available.

Not every record needs all four stages.

---

## 18. Tactical Record Unlocks

Records may unlock through:

- encountering an enemy family;
- defeating that enemy legitimately;
- mentor/training quests;
- Horizon milestones;
- studying/mastering related Disciplines;
- tactical challenges;
- Archive/training records;
- Expedition clears;
- boss defeat before boss simulation;
- region/faction training;
- event participation;
- higher training certification.

Acquisition is data-driven per record.

The premium shop must not sell stronger Tactical Records, AI grades, boss practice access, or competitive training capability.

---

## 19. Boss & Spoiler Protection

Boss simulations generally unlock only after the player legitimately encounters/clears the required version.

Battle Hall must not reveal:

- unreached phases;
- secret mechanics;
- unreleased enemies;
- hidden story identities;
- undiscovered Resonance/Essence/Soulmark/Mantle mechanics;
- late-game builds merely because internal AI definitions exist.

A record can represent only the portion the player has legitimately learned.

---

## 20. Player Practice Configuration

Within unlocked permissions, future drills may configure:

### Opponent

- Tactical Record;
- intelligence grade;
- level;
- legal attribute preset/custom allocation under an unlocked budget;
- equipment preset;
- Primary/Secondary/Skill profile;
- Resonance/Essence and supernatural configuration only when legitimately unlocked for that simulation;
- number of opponents where supported.

### Player side

- current character;
- current legal build;
- saved legal loadout snapshot;
- optional normalized practice state when a drill requires it.

Practice representation does not grant persistent ownership of equipment, Disciplines, Skills, Resonances, Essence, Soulmarks, Mantles, or other content.

### Arena

- unlocked map/template;
- starting positions;
- terrain/elevation/hazards;
- objective;
- starting HP/MP/resource percentages;
- initiative mode;
- repeatable seed;
- turn/round limit where relevant.

UI clearly distinguishes **AI Intelligence** from **Level / Attributes / Equipment**.

---

## 21. Level and Attribute Controls

Players may eventually make known opponents weaker, equal, or stronger within unlocked training ranges.

Examples:

- Level 20 Recruit with normal Level-20 attributes;
- Level 40 Recruit;
- Level 40 Elite;
- Level 60 Elite with a durable preset;
- equalized-level practice against a known Discipline archetype.

Freeform high-level values unlock gradually. Practice values remain isolated from persistent ownership/progression.

---

## 22. Scenario Presets

Useful drills include:

- basic duel;
- ranged approach;
- hold the chokepoint;
- escape control zone;
- survive three rounds;
- protect a fragile ally;
- defeat support first;
- fight from low resources;
- elevation;
- facing/rear attacks;
- baiting triggered effects;
- control-diminishing practice;
- boss mechanic rehearsal;
- 1v2 pressure;
- squad coordination.

Presets should teach actual mechanics and link to relevant Manual content.

---

## 23. Practice Rewards & Anti-Farming

Normal custom practice is not the most efficient persistent-power farm.

Default:

- no normal Character XP farm;
- no repeatable Mastery farm;
- no Crowns/economy output;
- no loot;
- no PvP rating;
- no quest/event attendance credit;
- no boss/world-clear credit;
- no first-witness/Chronicle credit intended for live content.

Specific authored tutorial/mentor drills may give one-time configured rewards.

Practice also cannot bypass Passive Training, Primary/Secondary attunement cooldowns, Mastery requirements, or content acquisition.

---

## 24. Fast Iteration Features

Battle Hall should minimize friction:

- instant restart;
- repeat same seed;
- swap allowed intelligence grade;
- adjust allowed level/stat preset;
- change one legal loadout choice and retry;
- save named drill presets;
- copy previous configuration;
- accelerated animation speed where readability remains intact;
- surrender/reset without normal penalty.

---

## 25. Battle Review

After practice, provide a useful **Battle Review** rather than only WIN/LOSE.

Possible information:

- turns/rounds;
- damage dealt/taken;
- healing;
- status application/cleansing;
- resource/AE spending;
- movement distance;
- hazard damage;
- objective progress;
- key triggered effects;
- kill windows;
- action timeline;
- position heatmaps later;
- AI decision reason tags;
- links to relevant Manual sections.

Decision explanations come from structured reason tags, not ungrounded invented prose.

Example:

```text
Veteran Hunter moved to Tile H7 because:
- rear attack became available
- target was below 30% HP
- tile remained outside the defender's threat zone
- expected finishing probability increased
```

---

## 26. Optional AI Intent Reveal

Normal PvE does not expose internal scoring.

Practice may provide post-battle/advanced-training information such as:

- selected target priority;
- major threat considered;
- objective priority;
- why a tile/Skill/action was chosen;
- candidate actions rejected for legality.

Never reveal hidden story/boss information not unlocked by the player's Tactical Record.

---

# PART III — PRODUCTION AI QUALITY

## 27. One Core AI Framework, Many Profiles

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

Do not build unrelated AI implementations for every enemy.

---

## 28. Data-Driven AI Profiles

A profile may version values such as:

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
trigger_bait_weight
lookahead_budget
candidate_budget
team_coordination_level
knowledge_policy
fallback_policy
```

Exact schema belongs to implementation tickets. Behavior tuning is explicit/versioned/testable rather than spread through arbitrary UI conditionals.

---

## 29. Discipline AI Coverage

Every playable Discipline eventually defines how AI uses it.

Each Discipline implementation should identify:

- preferred engagement range;
- high-value Skills;
- AE/resource thresholds;
- setup/payoff combos;
- mobility intent;
- typed triggered/passive considerations;
- defensive conditions;
- high-impact Skill conditions;
- Resonance-aware behavior where applicable;
- Essence-aware behavior for pure profiles where applicable;
- Soulmark/Mantle/equipment interactions where allowed;
- bad/wasteful use cases;
- AI test scenarios.

A technically legal Skill is not enough. AI should know when it is sensible.

---

## 30. Enemy Identity Through AI

AI reinforces fiction.

Examples:

- soldiers coordinate focus/formations;
- predators isolate weak targets;
- undead may value self-preservation less;
- cautious scholars avoid exposure/use control;
- fanatics accept dangerous objective trades;
- elite duelists bait commitments;
- bosses enforce authored phase identity.

Do not make all enemies equally omniscient or equally optimized.

---

## 31. Counterplay Must Exist

Strong AI should have habits/priorities players can learn.

A fair difficult opponent becomes satisfying when players recognize patterns such as:

- Hunter values isolated wounded units;
- Bulwark refuses to abandon protected objectives easily;
- Controller prefers a particular zone setup;
- Duelist preserves resources for predictable commitment windows.

If the only solution is “have larger numbers,” AI design has failed.

---

## 32. Avoid Perfect-Solver Monotony

The strongest AI should be very good, but ordinary encounters should not become exhausting chess engines.

Encounter difficulty varies through:

- intelligence grade;
- composition;
- map;
- objectives;
- level/stat power;
- special mechanics;
- boss rules;
- resource state.

Routine enemies can use cheaper/lower grades while elite/boss content receives stronger reasoning budgets.

---

## 33. Performance Budgets

Measure:

- candidate commands/sequences evaluated;
- pathfinding calls;
- search/lookahead nodes;
- average/p95/p99 decision latency;
- memory allocation where useful;
- worker/server CPU;
- worst-case crowded boards.

Do not use unbounded search. Prefer intelligent candidate pruning and domain-specific evaluation.

---

## 34. Determinism & Replays

Given the same:

- battle state;
- content versions;
- AI profile version;
- rules version;
- seed;

AI decisions should be reproducible unless an explicit feature documents nondeterminism.

Battle/replay records store enough version metadata to reproduce historical decisions after tuning.

A battle starting under AI profile version X does not silently switch to version Y mid-battle.

---

## 35. Testing Standard

Use layered validation:

### Legal-action tests

AI never commits commands the combat engine declares illegal.

### Determinism tests

Same state/version/seed produces the same decision/replay.

### Knowledge-boundary tests

AI cannot use information excluded by its policy.

### Tactical regressions

Curated states verify obvious concepts such as:

- guaranteed kill;
- lethal hazard avoidance;
- heal critical ally;
- protect objective;
- avoid overkill;
- use known setup/payoff;
- escape unavoidable threat when possible.

### Random/property tests

Generate many valid states and verify safety invariants.

### Performance tests

Pathological boards stay within decision budgets.

### Matchup simulation

Batch AI-vs-AI runs detect behavior/balance regressions.

### Human playtests

Numbers cannot determine whether AI feels readable, fair, surprising, repetitive, or annoying.

---

## 36. AI Quality Metrics

Track:

- AI turn latency;
- illegal attempts caught before commit;
- fallback frequency;
- repeated-action loops;
- movement oscillation;
- wasted healing/overkill;
- objective neglect;
- resource waste;
- win/loss by profile/content tier;
- encounter duration;
- player surrender/abandon;
- damage/resource efficiency;
- boss mechanic failures;
- practice retries;
- Tactical Record unlock/use rates.

Win rate alone is insufficient.

---

# PART IV — COMBAT AI LAB / MASTER PANEL

## 37. Owner and Staff AI Lab

Authorized Owner/QA/balance staff may eventually access:

- all live profiles;
- unpublished/internal profiles;
- supported level/stat templates;
- hidden/test equipment/builds;
- arena maps/scenarios;
- AI-vs-player;
- AI-vs-AI;
- team-vs-team;
- boss-phase testing;
- exact seed replay;
- batch simulation.

This is QA/balance tooling, not player progression.

---

## 38. AI Profile Operations

Depending on permission:

- inspect profile;
- duplicate as draft;
- edit weights/config;
- preview/stage;
- run benchmark suite;
- compare with live;
- publish version;
- rollback;
- disable/replace broken profile;
- assign profiles to enemy definitions;
- inspect encounter dependencies;
- audit changes.

Owner retains override authority; staff receive least privilege.

---

## 39. Batch Simulation

Example:

```text
10,000 matches
Bastion Veteran AI vs Riftwalker Veteran AI
Level 60 normalized template
Map pool: 5 arena maps
Seed set: recorded
```

Outputs can include:

- win rate;
- side/map bias;
- average rounds;
- damage/healing;
- resource/AE use;
- first-move advantage;
- Skill/action frequency;
- position heatmaps;
- fallback/error rates;
- performance timing;
- matchup outliers.

Simulation informs balance; it does not replace human testing.

---

## 40. AI Version Comparison

Before publishing major changes, compare live vs candidate across the same corpus.

Flag:

- major win-rate changes;
- slower decisions;
- increased fallbacks;
- changed target selection;
- objective neglect;
- loops;
- resource hoarding;
- matchup spikes.

---

## 41. Production Safety

AI configuration uses:

- versioning;
- validation;
- permissions;
- staged preview;
- audit history;
- rollback;
- per-profile kill/fallback controls;
- immutable battle pinning to the version active at creation.

Invalid drafts cannot become production merely because an editor saved.

---

# PART V — PROGRESSION, UI, MANUAL & ROADMAP

## 42. Battle Hall Progression Must Feel Earned

Unlocking Tactical Records should reinforce the main game.

Example feeling:

> “I finally defeated that Frostmere Controller, so now its training record is available. I can practice the matchup before going deeper.”

The Hall can become a collection/learning system alongside the Archive without becoming a second giant checklist.

---

## 43. No Pay-to-Win Training Access

The normal premium shop must not sell:

- stronger AI grades;
- unreached boss simulations;
- hidden Tactical Records;
- stat ranges providing material competitive preparation;
- advanced analysis unavailable through gameplay;
- faster Tactical Record unlocks.

Cosmetic arena themes/banners/decoration may be premium if they provide no preparation advantage.

---

## 44. Player Manual Requirements

The Adventurer's Guide eventually explains:

- Battle Hall access;
- AI Sparring;
- Tactical Records;
- unlock rules;
- AI Intelligence versus level/stats;
- practice rewards/limits;
- repeatable seeds;
- Battle Review;
- represented practice content is not persistent ownership;
- why stronger AI is harder without secretly cheating;
- spoiler restrictions.

Contextual help links directly from relevant Battle Hall and Battle Review screens.

---

## 45. Accessibility & UX

Battle Hall supports normal battle accessibility plus:

- clear separation of stat power and AI intelligence;
- spoiler-safe explanations for locked records where appropriate;
- no color-only intelligence-grade indicator;
- keyboard/screen-reader navigable review timelines;
- text alternatives for heatmaps/diagrams where practical;
- obvious reset/retry controls;
- no accidental normal-progression loss from entering practice.

---

## 46. Implementation Timing

### Phase 2 — Tactical Combat Core

- server-authoritative AI interface;
- knowledge filter;
- legal-command enumeration from combat engine;
- baseline utility evaluation;
- deterministic tie-breaking;
- safe fallback;
- first Recruit AI;
- decision-reason tags;
- developer/QA harness;
- current player-facing Battle Hall / AI Sparring slice after normal battle flow is stable;
- no normal repeatable progression rewards.

Phase 2 gate includes a complete human-vs-AI tactical battle where AI behaves legally and reproducibly and the human tester can understand what happened.

### Phase 3 — Signature Buildcraft

- AI understands released Skills, statuses, resources and build interactions;
- Primary/Secondary profile awareness;
- Resonance/Essence awareness;
- per-Discipline AI metadata;
- initial behavior archetypes;
- stronger intelligence grades where clean;
- Discipline-aware Battle Hall records.

### Phase 4 — First Playable Discipline Set

- every initial Discipline receives AI usage rules/tests;
- expand representative Recruit/Trained/Veteran opponents;
- Tactical Record progression;
- scenario presets;
- human fairness/readability playtests;
- benchmark tactical states.

### Phase 5 — Living World

- connect record acquisition to encounters, mentors, regions, Horizons, Archive/training discoveries and progression;
- present Battle Hall as a believable world service/location or equivalent game destination;
- keep records spoiler-safe;
- restrained record-unlock messaging.

### Phase 6 — Party & Co-op

- team coordinator;
- validate squads against three-player groups;
- allied NPC AI where required;
- multi-unit practice drills.

### Phase 7 — Expeditions

- Expedition coordination;
- multiphase boss directors;
- boss records after legitimate clears;
- objective-specific AI;
- long-encounter/reconnect/replay stress tests.

### Phase 8 — PvP

- AI practice may rehearse legal PvP-like builds/rules;
- never silently populate normal ranked queues with bots presented as humans;
- any bot-enabled mode explicitly discloses that rule;
- AI receives no private opponent information.

### Phase 9 — Full Discipline Roster

- complete AI usage/regression coverage for released Disciplines;
- advanced Tactical Records without unreleased-content leakage;
- Resonance/Essence/Soulmark/Mantle/equipment-aware decision quality as those systems release.

### Phase 13 — Master Panel

Complete Combat AI Lab:

- profile editor;
- assignment inspection;
- version diff/rollback;
- authorized unrestricted test setup;
- AI-vs-AI;
- batch simulation;
- matchup matrices;
- analytics;
- benchmark runner;
- staged publish;
- emergency fallback/disable;
- Tactical Record configuration.

### Phase 15 — Hardening

Validate:

- legality;
- fairness/knowledge boundaries;
- deterministic reproduction;
- decision performance under load;
- pathfinding worst cases;
- fallback behavior;
- no loops/oscillation soft locks;
- boss telegraph/counterplay;
- record authorization/spoiler safety;
- practice reward isolation;
- version pinning/rollback;
- permissions/audit;
- human playtests across skill levels.

---

## 47. Closed Alpha AI Target

Aim for:

- reliable shared combat-AI framework;
- representative Recruit/Trained/Veteran behavior;
- distinct archetypes across several enemy families;
- AI usage rules for the initial playable Discipline set;
- competent squad coordination where required;
- authored fair learnable bosses;
- useful Battle Hall with AI Sparring and progression-gated practice content;
- supported level/stat/opponent configuration appropriate to Alpha;
- repeatable practice seeds;
- Battle Review foundation;
- QA benchmark suite with no common illegal-action/soft-lock failures.

Not every final Master-grade profile or complete Combat AI Lab feature must exist before early Alpha testing, but architecture must support them cleanly.

---

## 48. Definition of Success

This system succeeds when:

- enemies make tactically sensible choices;
- enemy roles genuinely feel different;
- stronger AI is harder because it reasons better, not because it secretly cheats;
- players learn patterns and counter them;
- losses usually feel explainable;
- new players begin with approachable practice;
- additional opponents/grades unlock naturally through progression;
- level/attributes remain distinct from intelligence;
- practice is useful without becoming a zero-risk progression farm;
- boss practice does not spoil undiscovered encounters;
- the same AI framework powers real PvE and Battle Hall;
- decisions are server-authoritative, bounded, reproducible, and efficient;
- every released Discipline has meaningful AI usage rules;
- team AI coordinates without omniscience;
- Owner/staff can inspect, simulate, tune, stage, publish, rollback, and benchmark AI safely;
- automated tests catch illegal actions and major regressions;
- human playtests confirm combat feels challenging, learnable, and fair.