# AUREVANE — Implementation Roadmap

**Authority:** Derived from `docs/GAME_MASTER_PLAN.md` and its owner-approved addenda. If any conflict exists, the Master Game Plan wins.

**Synchronized:** 2026-08-19

The roadmap exists to stop the final product specification from being mistaken for today's implementation scope.

A roadmap phase is a development milestone, **not a promised calendar window**. Work advances through acceptance gates, automated verification, and human player validation where required.

## Current Status Snapshot

- ✅ **Phase 0 — Engineering Foundation:** substantially complete.
- ✅ **Phase 1 — Character & Progression Foundation:** substantially complete and iterated through player feedback.
- 🚧 **Phase 2 — Tactical Combat Core:** current active validation/iteration focus.
- 🔜 **Phase 3+ — Planned:** architecture is anticipated now, but future systems are not presented as already playable.

Automated green tests do not equal a human PV PASS. A player-validation gate is complete only when the required human playtest actually passes.

---

## Canonical Build-System Vocabulary

The current player-facing terminology is:

- **Primary Discipline** — the character's principal active combat tradition and source of the active Discipline base-stat profile.
- **Secondary Discipline** — an optional mastered Discipline mixed into the active build; it does not grant a second base-stat profile.
- **Skill** — the player-facing umbrella term for usable combat abilities.
- **Resonance** — the passive mixed-Discipline interaction created by an eligible Primary + Secondary pairing.
- **Essence / Discipline Essence** — the pure-Discipline counterpart to Resonance; Primary-only builds gain one special Essence Skill outside the normal Discipline Skill capacity.
- **Soulmark** — persistent supernatural identity for the Soulmarked path.
- **The Severance / Soul-Severed** — the permanent alternative supernatural path that gives access to Mantles instead of Soulmarks.
- **Mantle** — a temporary manifested transformation available only to eligible Soul-Severed characters.

Retired player-facing terms include Current Discipline, Legacy Discipline, Art, Confluence, and separate Trait / Reaction / Movement Art / Ultimate slot systems. They may appear only in explicitly historical migration notes.

The mature build contract is:

```text
CHARACTER ATTRIBUTES
+
PRIMARY DISCIPLINE
+
OPTIONAL SECONDARY DISCIPLINE
+
DISCIPLINE SKILLS
+
RESONANCE OR PURE-DISCIPLINE ESSENCE
+
SOULMARK OR SOUL-SEVERED MANTLE PATH
+
EQUIPMENT + EQUIPMENT SKILLS
+
BOUNDED PRESTIGE / VETERAN EDGE
```

Pure build:

```text
Primary only
8 Discipline Skills
+ 1 Essence Skill
+ no Resonance
```

Mixed build:

```text
Primary + mastered Secondary
6 total Discipline Skills across the pair
+ Resonance passive
+ no pure-path Essence while Secondary is equipped
```

The detailed build-system contract is defined in `docs/GAME_MASTER_PLAN_BUILD_SYSTEM_ADDENDUM.md`.

---

## Cross-Cutting Direction — Character Building Inside a Living World

AUREVANE's personal hook is the permanent character: mastering Disciplines, choosing a Primary, deciding whether to remain pure or mix in a mastered Secondary, discovering Resonances or building around Essence, developing a supernatural identity, and refining equipment/Skill choices.

The world should continuously create new reasons to use and rethink that character. World events, story developments, seasonal changes, cooperative objectives, PvP rotations, guild/nation activity, Expeditions, economy activity, and live operations should make the shared world feel active rather than like a static quest catalog.

The central mythology reinforces that hook: **Aurevane is the imprisoned goddess of Becoming**, initially believed to be a wronged benevolent protector and eventually revealed as the principal antagonist whose desire to remove every limit from possibility would erase coherent identity and reality. The player's deliberate, bounded character growth becomes the thematic counterargument to her limitless Becoming.

See the authoritative addenda indexed by `AGENTS.md` for detailed rules covering lore, progression, natural pacing, Passive Training, combat, items/inventory/loadouts, combat AI, product experience, owner operations, media, monetization, and engineering execution.

---

## Universal Attribute Rule

AUREVANE now uses six universal character attributes:

- Might;
- Finesse;
- Vitality;
- Agility;
- Intellect;
- Resolve.

Primary Discipline supplies its own base Discipline stat profile. The player's separately assigned attribute investment remains independent. Secondary Discipline does not supply a second base-stat profile.

Do not reintroduce the older four-attribute model into new roadmap tickets or public documentation.

---

## Long-Horizon Progression Rule

The first full character journey must be designed around a **minimum approximately 180-day / six-calendar-month path** from character creation to first full endgame/Rekindling eligibility under production defaults.

This must not degrade into six months of waiting. The journey combines:

- Level 1–100 progression;
- Horizon Gate milestones;
- Discipline Mastery;
- Primary/Secondary build development;
- Resonance and pure-Discipline Essence development;
- Soulmark or Soul-Severed/Mantle progression;
- equipment/build refinement;
- world/story progression;
- Expeditions;
- PvP/seasonal participation;
- lore discovery;
- endgame qualification challenges.

Calendar age alone is insufficient, and grind alone cannot bypass the final long-horizon gate. Exact pacing is data-driven and Master Panel configurable.

---

## Urgency / FOMO Rule

AUREVANE intentionally uses **experiential urgency/FOMO** as part of its retention design:

- time-limited world events;
- seasons;
- first-witness recognition;
- rotating encounters/bosses/merchants/modifiers;
- community races and discoveries;
- server Chronicle history;
- limited-time prestige/cosmetic rewards;
- event aftermath that makes presence matter.

The target feeling is **"I want to be there while this is happening"**, not permanent competitive ruin for missing a short login window.

Important build-enabling power must recur or have alternate paths. Do not add destructive streak systems, mandatory daily energy, pay-to-avoid-loss mechanics, or one-time exclusive meta-defining combat power.

---

## Passive Training / Return Loop Rule

AUREVANE currently includes **Passive Training** as an explicit server-timed background progression system.

Simply being offline or idle does not generate new rewards.

Current foundation:

- player explicitly chooses Short / Medium / Extended before training begins;
- server owns start time, completion time, and reward;
- shorter plans are more efficient per hour;
- longer plans trade efficiency for convenience;
- unfinished training may be stopped without a partial reward;
- a completed block creates one bounded Training Report;
- current reward foundation is Character XP;
- active training blocks starting a new Battle Hall fight/live combat entry;
- browser clocks, tab state, logout state, and client-submitted elapsed time are not authority;
- claims are idempotent;
- normal social/profile/account surfaces may remain usable while training runs;
- legacy already-materialized Training Reports remain preserved safely.

Future dependent extensions may include eligible Discipline Mastery support and Rested Momentum, but Passive Training must remain weaker than engaged play and must never complete story, boss/Expedition clears, PvP rank, Resonance/Essence progression accomplishments, Soulmark/Mantle milestones, Horizon trials, rare-equipment acquisition, economy output, or endgame rites on the player's behalf.

Passive Training supports the six-month journey but does not become the reason the journey takes six months.

---

## Tactical Combat Rule

AUREVANE's combat is a core pillar equal in importance to character building and must follow `docs/COMBAT.md` plus approved combat addenda/tests.

The exact active action-economy implementation may evolve during validation, but the permanent principles are:

- server owns legal movement, action costs, targets and outcomes;
- board position, terrain, elevation, facing and timing matter;
- the player sees costs, legal/illegal targets and forecasts before committing where information is legitimately available;
- Skills, Basic actions, equipment effects, AI legality and authoring tools use shared typed definitions rather than separate copies;
- cooldowns/resources/requirements are authoritative;
- status setup/payoff, movement, terrain, summons, battle objects and objectives create tactical depth;
- PvP requires readable counterplay and fair information boundaries;
- live AI never receives hidden information it is not entitled to know;
- combat must remain readable on desktop and mobile/touch layouts.

The current player-facing practice destination is the **Battle Hall**. **AI Sparring** is the first explicit full practice option. Older Tactical Hall wording is retired from current player-facing documentation.

---

## Item / Effect / Inventory / Loadout Rule

AUREVANE's equipment and inventory systems follow `docs/ITEMS_INVENTORY_LOADOUTS.md` and reinforce theorycrafting rather than become stat-storage screens.

The item model is built around:

- stable Item Definitions plus owned Item Instances/stacks where needed;
- a reusable typed Effect Catalog shared with combat content;
- damage as one possible effect rather than a requirement;
- meaningful non-damage utility such as movement, reveal, cleanse, shields, displacement, terrain/zones, objective interaction, and resource/cooldown manipulation;
- clear inventory categories: Equipment, Consumables, Materials, Quest/Key Items, and later collection/relic views where justified;
- protected story/key items;
- manageable equipment slots;
- a small pre-battle combat-consumable kit rather than unrestricted backpack access in combat;
- central Character Profile / Armory build-management surfaces;
- saved combat loadouts once their dependent build systems exist;
- atomic server-authoritative activation;
- known acquisition paths/target farming;
- versioned loot, vendors, crafting, marketplace and PvP rules;
- Equipment Skills using the same combat framework as other Skills;
- safe overflow/recovery and destructive-action protections.

Saved loadouts may eventually store Primary, optional Secondary, Discipline Skill selection, resolved Resonance or Essence route, supernatural configuration, equipment, and approved combat-consumable configuration. Saved loadouts never bypass Primary/Secondary attunement cooldowns or other persistent legality.

---

## Combat AI / Battle Hall Rule

AUREVANE's tactical combat must be supported by fair, learnable, genuinely competent NPC combat intelligence and a progression-aware Battle Hall / practice system.

Combat AI must:

- choose only legal actions through the authoritative combat engine;
- use bounded deterministic game logic rather than remote generative-model/LLM calls in the live decision loop;
- obey explicit knowledge/fairness boundaries;
- separate AI intelligence from raw level/attribute/equipment power;
- become harder through better candidate generation, tactical evaluation, lookahead, coordination, objective play, and risk management rather than hidden stat cheating;
- use reusable versioned behavior profiles;
- remain reproducible enough for replays, regression tests and safe live tuning.

Practice content unlocks gradually through legitimate progression/Tactical Record concepts. Normal practice does not become a zero-risk XP/Mastery/loot/currency/PvP-rating farm and must not expose unreached bosses, hidden mechanics, unreleased content, or late-story spoilers.

---

## Rekindling Rule

The long-term prestige system is **Rekindling**.

After completing a full cycle and meeting endgame eligibility, a player may voluntarily rebuild the same long-lived character through another minimum approximately 180-day journey.

Rekindling preserves identity/history while resetting enough active progression to make rebuilding meaningful.

The supernatural choice persists across Rekindling unless an explicit future story rule says otherwise:

- Soulmarked remains Soulmarked;
- Soul-Severed remains Soul-Severed.

Rekindling may unlock additional **Veteran Edge choices**, but standard competitive play uses only one bounded Edge slot where allowed. More cycles broaden options rather than stack uncapped raw stat power.

---

## Lore Discovery & Narrative Reveal Rule

Lore is gameplay, not only exposition.

The world supports discoverable books, letters, reports, inscriptions, murals, relics, item descriptions, NPC testimony, hidden rooms, Expedition evidence, event aftermath, Great Vane sites, and other environmental sources.

Players build an **Archive** from source fragments, contradictory accounts, and reconstructed conclusions.

The implementation roadmap must preserve the long-form Aurevane mystery:

```text
Forgotten symbols / nameless protector
  ↓
Discovery of a lost goddess
  ↓
Aurevane appears sympathetic and helpful
  ↓
Historical contradictions / Closed Star warnings
  ↓
The Eight Great Vanes and Unmoored phenomena
  ↓
The City That Was Twice
  ↓
The Great Opening is revealed
  ↓
Aurevane becomes the Open Crown / primary antagonist
  ↓
Continuing War of Possible Worlds live-story arcs
```

Do not expose late-story canon in early player-facing copy, filenames, public data, event metadata, Battle Hall catalogs, or UI merely because developers know the twist.

---

## Progressive Operations Rule

The complete Master Panel remains Phase 13, but operational tooling does not wait until Phase 13.

Each major system ships with the minimum safe owner/staff controls required to operate it. Role permissions, auditability, versioning, staging/preview, rollback, narrative canon controls, progression configuration, Passive Training configuration, item/effect/loadout/loot safety, combat-content versioning, AI profile versioning, PvP operations, Rekindling, lore publication and player-support commands grow progressively and remain server-authoritative.

The Owner is the highest game-operations authority. Normal operations should use validated, audited domain commands—not raw production credentials.

---

# PHASES

## ✅ Phase 0 — Engineering Foundation

**Goal:** establish a production-grade project skeleton before game mechanics multiply.

Scope includes:

- repository/documentation authority;
- application scaffold;
- TypeScript / formatting / lint / typecheck / tests / builds;
- CI;
- environment separation;
- database/migration foundation;
- authentication and RLS/security baseline;
- deployment pipeline;
- server-domain boundaries;
- transactional/idempotent service patterns;
- realtime adapter and worker foundations;
- design-system primitives;
- responsive shell;
- media registry / Audio Director foundation;
- logging/error conventions;
- security and audit boundaries;
- spoiler-safe documentation conventions.

**Gate:** clean build, automated checks, deployable environment, documented setup and production-style infrastructure.

**Status:** substantially complete.

---

## ✅ Phase 1 — Character & Progression Foundation

Scope includes:

- account/profile flow;
- three-character roster foundation;
- character creation;
- **six attributes:** Might, Finesse, Vitality, Agility, Intellect, Resolve;
- derived-stat framework;
- versioned Character XP / level progression shell;
- Level 1–100 configuration boundaries;
- character profile/build-headquarters foundation;
- starting Foundation Discipline choice;
- Discipline/Mastery data boundaries;
- Primary Discipline foundation;
- character/account switching controls and authoritative cooldowns;
- profile portrait/title/presence quality-of-life;
- Online Users surface;
- initial item-definition / ownership / equipment boundaries;
- core equipment slots;
- foundational equip/unequip commands;
- initial Armory/build presentation boundaries;
- **Passive Training:** Short / Medium / Extended server-timed plans, decreasing hourly efficiency for longer plans, completion report/reward, stop control, battle-start exclusion, idempotency and telemetry.

Do not force later build layers into Phase 1 before their combat systems exist.

**Gate:** a player can create, persist and return to a valid character; progression and foundational equipment are authoritative; the model safely anticipates later Mastery/build systems.

**Status:** substantially complete and iterated through player feedback.

---

## 🚧 Phase 2 — Tactical Combat Core

Phase 2 proves the smallest complete version of AUREVANE's tactical combat grammar before the future build system multiplies content.

Scope includes:

- deterministic battle state and rule/content versions;
- authoritative RNG state where required;
- tactical grid/board;
- round/turn lifecycle;
- initiative/action economy;
- movement/path legality;
- terrain/elevation/facing;
- legal targeting, range, occupancy and line-of-sight rules as released content requires;
- Basic Attack;
- Guard;
- Recover/heal baseline;
- finish/end-turn behavior;
- HP/MP/resource foundations;
- typed Target / Requirement / Effect foundations;
- initial statuses;
- deterministic effect ordering;
- authoritative command flow using intent + battle version rather than client-submitted outcomes;
- battle UI with board-first layout, forecasts and valid/invalid explanation;
- action-economy readability;
- compact actor information and combat log;
- combat VFX/audio hooks;
- reconnect-safe persistence;
- first legal deterministic Recruit AI;
- AI decision-reason/debug hooks;
- regression battle states;
- **Battle Hall**;
- **AI Sparring**;
- focused movement/strike/guard practice;
- mobile/touch usability;
- player feedback iteration.

Do not pull the complete future Skill library, Resonance matrix, Soulmark/Mantle catalog, PvP stack, full editors, or every targeting/effect primitive into this phase merely because the architecture anticipates them.

**Gate:** a human player can complete a deterministic, attractive, readable tactical fight where positioning and choices matter, AI uses the same legality, reconnect/state handling is safe, and actual player validation confirms the slice is understandable and fun.

**Status:** current active focus.

---

## 🔜 Phase 3 — Signature Buildcraft Identity

This phase replaces the older Current/Legacy/Confluence roadmap assumptions with the approved build model.

Scope includes:

- Primary Discipline rules and base-stat profiles;
- optional mastered Secondary Discipline;
- independent server-authoritative Primary and Secondary attunement cooldowns;
- Character Profile build configuration;
- mature Discipline Skill schema;
- **8 learnable Discipline Skills per mature Discipline**;
- pure build capacity: up to 8 Primary Discipline Skills;
- mixed build capacity: 6 total Discipline Skills across Primary + Secondary;
- Skill source labeling;
- Skill cooldown rules;
- typed combo/sequence passives;
- **Resonance framework** for mixed builds;
- first Resonance library;
- **Essence framework** for pure builds;
- first Essence Skills;
- Equipment Skill integration;
- saved loadout legality that respects persistent attunement cooldowns;
- Passive Training Discipline Focus/Mastery extensions only when dependency rules are ready;
- AI understanding of released Skills/Resonance/Essence interactions;
- first minimum safe authoring/validation tools for the increased content volume;
- supernatural-fork proof only when story/progression dependencies make it appropriate.

No separate player-facing Trait, Reaction, Movement Art or Ultimate slot systems are introduced.

**Gate:** players can make a meaningful pure-versus-mixed choice, configure it clearly, enter battle, and understand the difference between Primary-only + Essence and Primary + mastered Secondary + Resonance.

---

## 🔜 Phase 4 — First Playable Discipline Set / Core Content

Target roughly **16 playable Disciplines** before Closed Alpha rather than blocking testing on all 36.

Every released Discipline should include, as appropriate to the milestone:

- Primary base-stat profile;
- 8-Skill mature library or the validated portion required by the current gate;
- pure Essence coverage;
- relevant Resonance coverage;
- clear Mastery/acquisition requirements;
- distinct engagement/mobility/setup/terrain/objective/counterplay identity;
- authoritative Target/Requirement/Effect data;
- equipment interaction review;
- AI usage rules and regression scenarios;
- VFX/SFX requirements;
- PvE/PvP tests;
- analytics hooks.

Initial advanced identities include the Master Plan's first core group such as Bastion, Ravager, Edgedancer, Wildwarden, Cinderweaver, Frostweaver, Stormsinger, Chronist, Runeblade and Dawnshield alongside the six Foundations.

Introduce representative equipment/consumables that prove the item system creates real tactical decisions, including meaningful non-damage effects.

Build representative battle scenes/maps that test range, terrain, movement, objectives, equipment and positioning rather than carbon-copy layouts.

Expand Battle Hall opponents/scenarios and begin serious human fairness/readability/fun testing.

**Gate:** the initial buildcraft loop is genuinely fun; representative Disciplines, pure/mixed routes, gear and maps feel materially different; AI can use them legally and coherently.

---

## 🔜 Phase 5 — Living World, Story & Live Operations Foundation

Scope includes:

- world map / Atlas;
- movement/presence;
- towns/settlements;
- encounters;
- NPC/dialogue;
- quest engine;
- initial story;
- layered global/region/node/player state;
- data-driven world events;
- event scheduling / worker transitions;
- **World Pulse** / since-you-were-away context;
- announcements/world activity;
- event-linked encounters/quests/NPC states/modifiers/rewards/map markers;
- story-arc hooks and versioned narrative content;
- **Archive** lore-discovery foundation;
- Fragment Sets / source provenance / contradictions;
- protected Quest/Key Item rules;
- world vendors/known acquisition links where required;
- location-coherent battle scenes;
- battle-to-world reward/state return;
- legitimate Battle Hall/Tactical Record unlock sources without future-content leakage;
- owner/staff operations shell;
- safe Event/Story/Lore draft/preview/schedule/publish/rollback controls;
- initial Horizon/world progression gates;
- early mystery presentation without revealing late antagonist canon.

**Gate:** a character can explore, enter a location-appropriate battle, complete quests, handle protected story items, discover lore, persist progression, and experience an owner-operated scheduled world/story change without a routine code deployment.

---

## 🔜 Phase 6 — Party & Co-op

Scope includes:

- parties;
- party realtime;
- co-op battles;
- shared quests;
- party finder;
- live-ops cooperative objectives;
- player-specific story flags inside shared content where needed;
- pings/action visibility;
- multiplayer ownership/reconnect/flow;
- enemy-team coordination;
- allied NPC AI where required;
- multi-unit Battle Hall drills for legitimately unlocked profiles.

**Gate:** three people can complete a mission together in combat that remains readable, responsive and fair, with each player controlling their own character.

---

## 🔜 Phase 7 — Expeditions

Scope includes:

- Expedition template engine;
- deterministic seeded generation;
- progressive reveal;
- Easy Expeditions;
- Standard Expeditions;
- Threat/modifiers;
- suspension/reconnect;
- Deep Expeditions;
- multiphase bosses;
- personal loot/leaderboards;
- targeted item pools;
- approved bad-luck protection;
- Expedition consumables/tools where authored;
- deterministic inventory state across suspension/resume;
- temporary rotations/anomalies;
- lore rooms/records/relics;
- richer objectives and battle scenes;
- telegraphed boss mechanics;
- environmental battle objects / terrain transformations;
- objective-aware AI and boss directors;
- spoiler-safe boss practice records only after legitimate discovery;
- long-run performance/reconnect/version/replay verification.

**Gate:** a three-player roughly hour-scale Deep Expedition is fully playable, resumable and memorable, with meaningful loot, tactical variation, fair bosses and no reward duplication/soft locks.

---

## 🔜 Phase 8 — PvP

Scope includes:

- direct challenges;
- casual 1v1;
- ranked 1v1;
- Arena Tempering;
- casual 2v2;
- ranked 2v2;
- matchmaking;
- disconnect protection;
- turn/timing rules;
- seasons;
- tournament framework;
- competitive telemetry;
- map/spawn/side-bias testing;
- transparent PvP overrides using the same content definitions rather than duplicate PvP Skills/items;
- CC anti-lockout rules;
- equipment/consumable legality;
- Resonance/Essence/Soulmark/Mantle legality and balance controls as those systems exist;
- Veteran Edge queue configuration before competitive use;
- no undisclosed bots presented as human ranked opponents.

PvP AI practice may reproduce public/legal build rules but cannot inspect private uncommitted player choices or copy private real-player loadouts.

---

## 🔜 Phase 9 — Full Discipline Roster

Expand toward all **36 Disciplines** in controlled batches.

Every mature new Discipline requires:

- Primary base-stat profile;
- 8 learnable Discipline Skills;
- pure-path Essence Skill;
- Resonance coverage with the released roster;
- clear Mastery/acquisition rules;
- distinct tactical identity and counterplay;
- authoritative Target/Requirement/Effect data;
- representative equipment interaction review;
- AI usage rules;
- tactical regression scenarios;
- VFX/SFX;
- PvP tests;
- PvE tests;
- analytics and Master Panel authoring support.

This phase must create genuinely different build identities, not cosmetically renamed copies.

---

## 🔜 Phase 10 — Social World

Scope includes:

- guilds;
- friends;
- messages;
- guild quests;
- guild progression;
- social profiles;
- moderation;
- staff report/support tools with permissions and audit trails;
- optional player-controlled build share cards;
- social recognition / Chronicle hooks;
- prestige/Rekindling presentation;
- Hall of Selves presentation foundation where appropriate.

---

## 🔜 Phase 11 — Economy

Scope includes:

- stores/vendors;
- mature loot services;
- marketplace;
- crafting;
- materials inventory;
- binding/trading policies;
- safe bulk sell/salvage where approved;
- capacity/stack policies tuned for low friction;
- bounded overflow/recovery;
- item provenance/history;
- acquisition graph maturity;
- authoritative Equipment/Consumable Skill links;
- economy/support tooling;
- item/equipment/consumable telemetry;
- Rekindling reset/preserve safeguards;
- recurring paths for important competitive build components;
- Passive Training isolation from tradable/economic output;
- Battle Hall/practice reward isolation.

**Gate:** item acquisition, ownership, storage, equipment, crafting/trade/store loops are coherent and server-authoritative without duplication, key-item loss or inventory-management misery.

---

## 🔜 Phase 12 — Nations

Scope includes:

- allegiance;
- reputation;
- nation quests;
- campaigns;
- nation warfare;
- political rankings;
- nation event/campaign operations;
- multiple political interpretations of the central mythology;
- PvE and PvP contribution paths;
- nation/reputation item rewards using normal acquisition/effect definitions;
- no essential competitive build permanently locked behind one political choice.

---

## 🔜 Phase 13 — Complete Master Panel + Long-Horizon Operations

Some operational functionality exists earlier. This phase builds the complete owner/staff game operating system.

Scope includes:

- owner dashboard / Owner Command Center;
- staff roles/permissions;
- player lookup and audited corrections;
- content editors;
- Discipline / Skill editors;
- **Resonance editor**;
- **Essence editor**;
- Soulmark / Mantle editors;
- item/equipment/effect editors;
- quest/dialogue/story editor;
- Archive/lore editor;
- world-event editor/scheduler;
- Expedition editor;
- PvP/season/tournament operations;
- Audio Manager;
- Asset Studio;
- Balance Lab;
- Combat Content Studio using Skill terminology and the typed combat grammar;
- Item Studio / Effect Catalog;
- build/loadout analytics;
- combat analytics;
- Combat AI Lab;
- Battle Hall record/unlock configuration;
- Pacing Simulator;
- progression/Horizon/Passive Training configuration;
- Rekindling / Veteran Edge controls;
- economic analytics;
- support/moderation;
- feature flags;
- audit log;
- content diff/history;
- staging/publish/rollback;
- narrative spoiler/canon rights;
- break-glass Owner recovery actions with re-authentication and immutable audit.

**Gate:** normal operation, authoring, balance, repair, simulation and delegation can occur through validated audited tools rather than routine raw production access or code edits.

---

## 🔜 Phase 14 — Art & Audio Production Polish

This is a dedicated production pass, not permission to postpone all media until late development.

Scope includes:

- region artwork;
- character art;
- Discipline artwork;
- Soulmark/Mantle art;
- item icons/key art;
- Inventory / Character Profile / Armory polish;
- Legendary/important reward presentation;
- soundtrack;
- ambience;
- SFX;
- transitions;
- particles;
- animations;
- responsive/mobile polish;
- loading/error states;
- battle-scene environments;
- terrain/elevation readability;
- Skill / Equipment Skill / Resonance / Essence / Soulmark / Mantle VFX identity;
- impact audio / footsteps / blocks / item-use / telegraph / objective cues;
- readable action resolution;
- targeting/forecast/action-economy/timeline polish;
- reduced-motion / camera-shake / accessibility options;
- Aurevane/Open Crown and Closed Star visual language;
- evolving leitmotifs;
- Unmoored-world VFX readability;
- Rekindling/Hall of Selves presentation;
- Archive/document/relic presentation;
- Passive Training presentation;
- Battle Hall / AI Sparring / Battle Review presentation.

Media required to make earlier testing coherent should already enter through the media request pipeline during earlier phases.

---

## 🔜 Phase 15 — Hardening

Scope includes:

- security/penetration review;
- abuse testing;
- rate limiting;
- privileged access / Owner break-glass review;
- audit-log integrity;
- SQL/index optimization;
- load testing;
- matchmaking/realtime load;
- Expedition concurrency;
- economy exploit testing;
- inventory/equipment concurrency;
- migration/version tests;
- reward/idempotency duplication tests;
- destructive inventory safety;
- overflow/recovery;
- loadout legality and simultaneous-edit races;
- effect trigger/filter/order/recursion safety;
- combat-item rejected-use rollback;
- marketplace/equip/listing races;
- PvP regression;
- authoring permission/staging/diff/publish/rollback tests;
- live-event scheduling/recovery;
- spoiler/canon publication review;
- progression/Horizon boundary tests;
- Passive Training server-time/idempotency/multi-character/economy-isolation tests;
- combat movement/terrain/targeting/action/cooldown/status/summon/objective property tests;
- battle version/race/replay/reconnect/timeout/disconnect-abuse tests;
- map reachability/bias/performance/content-reference validation;
- AI legality/knowledge/determinism/load/pathfinding/fallback/boss-counterplay suites;
- Battle Hall authorization/unlock/spoiler/reward-isolation/reset/retry tests;
- Combat AI Lab audit/version/rollback validation;
- human combat playtests across skill levels;
- Rekindling preserve/reset integrity;
- Veteran Edge competitive regression;
- event recurrence/catch-up;
- player correction/idempotency.

---

## First Full Endgame / Rekindling Gate

Before Rekindling becomes a normal production feature, validate:

- engaged players cannot reach complete first-cycle eligibility before the configured approximately 180-day minimum;
- real gameplay milestones are required, not only character age;
- levels 1–100 and build progression remain rewarding;
- equipment/item discovery continues creating build options rather than numerical replacement churn;
- returning-player support helps recovery without bypassing the endpoint;
- Passive Training remains a modest contributor rather than a substitute for active accomplishment;
- Battle Hall practice does not become an economy/progression shortcut;
- enough PvE/PvP/world/story/lore content exists that the journey is not filler;
- combat keeps introducing meaningful tactical questions;
- the endgame rite is a genuine mastery challenge;
- Rekindling preserves identity/history while resetting enough progression to make rebuilding meaningful;
- Veteran Edge has telemetry, tests, kill switches, queue rules and Master Panel controls before ranked use.

---

## Closed Alpha Target

Closed Alpha is a **quality/content gate, not a date promise**.

Target shape:

- 16 playable Disciplines;
- 8 Soulmarks for the initial Alpha supernatural set;
- meaningful **Resonance coverage** for mixed builds;
- pure-Discipline **Essence coverage** for the playable roster;
- 4 world regions;
- 20–30 enemies;
- 4–6 bosses;
- 50+ items with authored roles rather than stat-reskin filler;
- Equipment / Consumables / Materials / protected Quest-Key inventory boundaries;
- stable item-definition / item-instance ownership model;
- core equipment slots and polished build-management experience;
- saved combat loadouts once dependencies exist;
- representative non-damage equipment/consumables;
- known acquisition / target-farming foundation;
- 20+ quests;
- Easy Expedition;
- Standard Expedition;
- 1 Deep Expedition;
- 1v1 PvP;
- 2v2 PvP;
- Guild foundation;
- readable server-authoritative tactical action economy;
- representative targeting/requirement/effect grammar with clear forecasts;
- meaningful terrain/elevation/facing/status/Skill/item interactions;
- world-linked authored battle scenes/maps;
- Primary/Secondary + Resonance/Essence build rules sufficiently complete for Alpha buildcraft;
- Discipline Mastery / Skill acquisition foundation with no JP-like skill currency;
- reliable shared combat-AI framework with representative difficulty/behavior profiles;
- distinct enemy-family archetypes;
- AI usage/regression coverage for the initial Discipline/item set;
- competent enemy-squad coordination where fiction requires it;
- fair learnable boss AI;
- Battle Hall foundation with AI Sparring, progression-gated practice content, repeatable drills and Battle Review foundation;
- QA benchmark scenarios with no common illegal-action/effect-loop/inventory/combat/AI soft locks;
- continuing world-event/story capability;
- World Pulse foundation;
- Archive/lore discovery foundation;
- owner + delegated staff permission foundation;
- usable Event/Story/Lore operations tooling;
- safe content validation/preview controls for released systems;
- auditability and rollback;
- Master Panel core;
- full audio coverage for the Alpha experience;
- strong visual presentation;
- coherent early Aurevane mystery and foreshadowing;
- enough telemetry to begin calibrating long-horizon pacing.

Closed Alpha itself does not need to run for six months before individual systems can be tested.

---

## Ticket Rule

A ticket must state:

- purpose;
- exact scope;
- files/modules affected;
- implementation approach;
- automated tests;
- acceptance criteria;
- manual verification;
- dependencies.

Build-system tickets must use Primary / Secondary / Skill / Resonance / Essence terminology and explicitly state which source systems and loadout capacities they affect.

Combat tickets must identify which approved combat-grammar portion they implement and which later capabilities are out of scope.

Item/inventory/loadout tickets must identify which item classes, effect primitives, loadout fields and economy links are in scope.

Only the assigned ticket is implemented unless the active execution mandate explicitly authorizes a wider verified release workflow. Future roadmap systems may influence boundaries, but they are not implemented early merely because they are known.