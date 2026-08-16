# AUREVANE — Implementation Roadmap

**Authority:** Derived from `docs/GAME_MASTER_PLAN.md`. If any conflict exists, the Master Game Plan wins.

The roadmap exists to stop the final product specification from being mistaken for today's implementation scope.

## Cross-Cutting Direction — Character Building Inside a Living World

AUREVANE's personal hook is the permanent character: mastering Disciplines, combining Current + Legacy Disciplines, discovering Confluences, developing Soulmarks, and refining equipment/build choices.

The world should continuously create new reasons to use and rethink that character. World events, story developments, seasonal changes, cooperative objectives, PvP rotations, guild/nation activity, and live operations should make the shared world feel active rather than like a static quest catalog.

The central mythology reinforces that hook: **Aurevane is the imprisoned goddess of Becoming**, initially believed to be a wronged benevolent protector and eventually revealed as the principal antagonist whose desire to remove every limit from possibility would erase coherent identity and reality. The player's deliberate, bounded character growth becomes the thematic counterargument to her limitless Becoming.

See `docs/WORLD.md`, `docs/MASTER_PANEL.md`, `docs/LORE_BIBLE.md`, `docs/PROGRESSION_RETENTION.md`, `docs/NATURAL_PACING.md`, `docs/OFFLINE_PROGRESSION.md`, `docs/COMBAT.md`, `docs/ITEMS_INVENTORY_LOADOUTS.md`, `docs/COMBAT_AI_TRAINING.md`, and `docs/PRODUCT_EXPERIENCE_CONTENT_SYSTEM.md` for the authoritative feature, narrative, progression, prestige, retention, offline-training, tactical-combat, item/inventory/loadout, combat-intelligence/training, product-experience, absence-protection, and lore-discovery expansions.

## Long-Horizon Progression Rule

The first full character journey must be designed around a **minimum approximately 180-day / six-calendar-month path** from character creation to first full endgame/Rekindling eligibility under production defaults.

This must not degrade into six months of waiting. The journey combines:

- Level 1–100 progression;
- Horizon Gate milestones;
- Discipline Mastery;
- Legacy/Confluence development;
- Soulmark progression;
- equipment/build refinement;
- world/story progression;
- Expeditions;
- PvP/seasonal participation;
- lore discovery;
- endgame qualification challenges.

Calendar age alone is insufficient, and grind alone cannot bypass the final long-horizon gate. Exact pacing is data-driven and Master Panel configurable as defined in `docs/PROGRESSION_RETENTION.md` and refined by `docs/NATURAL_PACING.md`.

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

## Offline Progression / Return Loop Rule

AUREVANE includes **Wayfarer's Practice**, a secondary offline-training and rested-progression system defined in `docs/OFFLINE_PROGRESSION.md`.

Time away should produce a modest Training Report containing bounded Character XP, eligible Discipline Mastery, and/or Rested Momentum so returning players feel that their permanent character kept moving forward.

The system must:

- help players who cannot play every day;
- create a satisfying “come back and claim” moment;
- use a generous multi-day direct bank rather than exact-hour login pressure;
- feed the player's next active session through Rested Momentum;
- remain weaker than engaged active progression;
- never complete story, quests, boss/Expedition clears, PvP rank, Confluence discovery, Soulmark milestones, Horizon trials, endgame rites, or other accomplishments that require actual play;
- never become a paid progression accelerator;
- calculate elapsed time and rewards server-side with idempotent claims;
- avoid continuous per-character background jobs when a deterministic timestamp calculation can do the work cleanly.

Wayfarer's Practice supports the six-month journey but does not become the reason the journey takes six months.

## Tactical Combat Rule

AUREVANE's combat is a core pillar equal in importance to character building and must follow `docs/COMBAT.md`.

The baseline turn economy is intentionally readable:

```text
MOVEMENT BUDGET
+
ONE ACTION
+
EQUIPPED REACTION / BOUNDED EXCEPTIONS
```

Depth comes from the interaction of:

- terrain and movement profiles;
- split movement before/after the Action;
- facing and position;
- targeting shapes/range/line of sight/height;
- HP/MP and temporary Discipline resources;
- costs, cooldowns, charges, and use requirements;
- status setup/payoff;
- Reactions;
- initiative/timeline manipulation;
- Current + Legacy Arts;
- Confluences;
- Soulmarks;
- equipment/weapon attack profiles;
- objectives, battle objects, summons, and map geometry;
- authored battle scenes and environmental transformation;
- fair AI and opponent prediction.

Do not replace this with a generic percentage Action Point economy, universal Stamina bar, giant element chart, or dozens of always-visible controls merely because another tactical/browser game uses them.

Combat capabilities must use a shared, server-authoritative typed grammar for targeting, costs, requirements, effects, statuses, terrain, and scenario rules where practical. Arts, Basic Attacks, combat items, AI legality, and authoring tools should reference the same combat definitions rather than separate copies.

Players learn combat progressively. Early battles teach movement, one Action, basic targeting, HP/MP, Guard, and obvious terrain before later systems introduce facing, Reactions, Movement Arts, Legacy Arts, Confluences, Soulmarks, advanced objectives, terrain transformations, and competitive timing.

Combat content is circular: the same stable action/status/terrain/map identities should feed gameplay, AI, Codex/manual, acquisition, art/audio, analytics, simulation, support, and Master Panel authoring.

## Item / Effect / Inventory / Loadout Rule

AUREVANE's equipment and inventory systems must follow `docs/ITEMS_INVENTORY_LOADOUTS.md` and reinforce theorycrafting rather than become stat-storage screens.

The item model is built around:

- stable Item Definitions plus owned Item Instances/stacks where needed;
- a reusable typed **Effect Catalog** shared with combat content;
- damage as one possible effect rather than a requirement;
- meaningful non-damage utility such as movement, reveal, cleanse, shields, displacement, terrain/zones, objective interaction, and resource/cooldown manipulation;
- clear player-facing inventory categories: Equipment, Consumables, Materials, Quest/Key Items, and later collection/relic views where justified;
- protected story/key items that cannot be accidentally sold, salvaged, discarded, or consumed outside authored quest rules;
- the existing manageable equipment slots rather than slot inflation;
- a small pre-battle combat-consumable kit rather than unrestricted backpack access in combat;
- one central **Build / Armory** experience for equipment + combat build configuration;
- **three saved combat loadout presets** as a baseline feature once their dependent build systems exist;
- atomic server-authoritative loadout activation;
- known acquisition paths/target farming for important gear;
- versioned loot, vendors, crafting, marketplace, PvP rules, and Master Panel operations;
- a battle **Turn Economy Tracker** showing Movement remaining, Action ready/spent, Reaction state, MP/resources, cooldown/charges, item quantity where relevant, and the projected cost of the selected action.

The three saved presets may eventually contain Current Discipline, Legacy Discipline, Current/Legacy Arts, Traits, Reaction, Movement Art, Soulmark, resolved Confluence, equipment, and combat consumables. They are convenience/strategy infrastructure — not additional combat power.

Inventory management should be safe and low-friction: key items do not create bag pressure, stackable goods compact cleanly, locked/favorite/loadout-used items are protected from destructive bulk actions, and overflow/recovery prevents important rewards from disappearing.

Do not introduce universal item durability/repair chores merely because another RPG has them. Durability remains optional only where a real system benefits.

## Combat AI / Tactical Hall Rule

AUREVANE's tactical combat must be supported by **fair, learnable, genuinely competent NPC combat intelligence** and a progression-aware **Tactical Hall / Practice Arena** as defined in `docs/COMBAT_AI_TRAINING.md`.

Combat AI must:

- choose only legal actions through the authoritative combat engine;
- use bounded deterministic game logic rather than remote generative-model/LLM calls in the live decision loop;
- obey explicit knowledge/fairness boundaries rather than reading uncommitted player input, future RNG, or hidden information it is not entitled to know;
- separate **AI Intelligence** from level, attributes, equipment, and other raw power;
- become harder primarily through better candidate generation, tactical evaluation, lookahead, coordination, objective play, and risk management rather than hidden stat cheating;
- use reusable versioned behavior profiles so enemy families feel distinct without creating unrelated one-off AI implementations;
- remain reproducible enough for replays, regression tests, benchmark scenarios, and safe live tuning.

The player begins the Tactical Hall with only a basic weak **Recruit** sparring opponent. Stronger intelligence grades, enemy families, bosses, level/stat ranges, maps, and scenario records unlock gradually through legitimate **Tactical Records** earned from encounters, mentors, Horizons, mastery, Expeditions, boss clears, and other progression.

Practice battles support controlled level/attribute/loadout/scenario configuration within unlocked permissions, but normal custom practice does not become a zero-risk XP/Mastery/loot/currency/PvP-rating farm and must not expose unreached bosses, hidden mechanics, unreleased content, or late-story spoilers.

## Rekindling Rule

The long-term prestige system is **Rekindling**.

After completing a full cycle and meeting endgame eligibility, a player may voluntarily rebuild the same long-lived character through another minimum approximately 180-day journey.

Rekindling preserves identity, history, cosmetics, Archive/lore discoveries, Chronicle record, achievements, social history, and prestige record while resetting enough active progression to make rebuilding meaningful.

Each Rekindling may unlock additional **Veteran Edge** choices. Standard competitive play allows only a bounded active Edge slot rather than uncapped stat stacking. Veteran Edge should provide tactical distinction that is especially useful in PvP while remaining measurable, disableable, queue-configurable, and Master Panel tunable.

## Lore Discovery Rule

Lore is gameplay, not only exposition.

The world must support discoverable books, letters, reports, inscriptions, murals, relics, item descriptions, NPC testimony, hidden rooms, Expedition evidence, event aftermath, Great Vane sites, and other environmental sources.

Players build an **Archive** from source fragments, contradictory accounts, and reconstructed conclusions. Major lore questions can use Fragment Sets and community discovery thresholds. Canon truth remains internally governed by `docs/LORE_BIBLE.md`.

## Narrative Reveal Rule

The implementation roadmap must preserve the long-form Aurevane mystery rather than rushing it simply because the final lore is already documented internally.

Narrative development should progress broadly through:

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

Do not expose late-story canon in early player-facing copy, filenames, public data, event metadata, Tactical Hall catalogs, or UI merely because developers know the twist.

## Progressive Operations Rule

The complete Master Panel remains Phase 13, but **operational tooling does not wait until Phase 13**.

Each major system should ship with the minimum safe owner/staff controls required to operate that system. In particular, when the world and continuing story arrive in Phase 5, AUREVANE also gains a safe Event/Story operations slice so authorized staff can make the world change without routine code deployments.

Role/permission architecture, auditability, versioning, staging/preview, rollback, narrative canon controls, progression configuration, Wayfarer's Practice configuration, item/effect/loadout/loot version safety, combat-content version safety, combat-AI profile/version safety, Rekindling rules, Veteran Edge, lore publication, and player-support mutation commands must grow progressively and remain server-authoritative.

The Owner is the highest game-operations authority. The final Master Panel must provide broad operational control over game configuration, users, entitlements, staff roles, special permissions, progression corrections, inventory/equipment/effects/loot/acquisition, economy/content corrections, story flags, events, combat actions/statuses/terrain/maps/scenarios, combat-AI profiles/testing, PvP, Rekindling, lore, and emergency controls through validated and audited domain commands rather than exposing raw production credentials.

## Phase 0 — Foundation

Goal: establish a production-grade project skeleton before game mechanics multiply.

- repository/documentation authority;
- application scaffold;
- dependency/version policy;
- formatting/lint/typecheck/test/build commands;
- CI;
- environment separation;
- database/migration foundation;
- authentication foundation;
- authorization/security baseline that does not block future owner/staff roles;
- design-system primitives;
- media registry/audio-runtime skeleton;
- logging/error handling conventions;
- authoritative lore documentation and spoiler-safe implementation guidance;
- architecture boundaries for data-driven progression configuration, Horizon Gates, Rekindling, live urgency settings, lore discovery state, and privileged player correction commands;
- character/account timestamps and auditability must not be designed in a way that blocks future natural pacing, offline progression, or minimum-age safety rules.

**Gate:** clean build, automated checks, deployable preview, documented local setup.

## Phase 1 — Character Foundation

- account/profile flow;
- character creation;
- four attributes;
- derived-stat framework;
- level/progression shell;
- Level 1–100 configuration boundaries;
- persistent character creation time / progression-cycle metadata;
- initial XP/progression telemetry hooks;
- character profile presentation;
- stable item-definition identity/schema boundary;
- owned item-instance/stack model sufficient for first character items;
- core equipment slots: Main Hand, Off Hand, Armor, Accessory I, Accessory II;
- basic Equipment inventory and authoritative equip/unequip command;
- player-facing category boundary for future Consumables, Materials, and protected Quest/Key Items without implementing their full later loops prematurely;
- derived-stat recalculation from equipped content;
- initial Build / Armory experience as required by current character scope;
- initial Discipline/Mastery data boundaries that can later express Art Curriculum/acquisition requirements without implementing the combat engine early;
- presentation hooks for early narrative identity without prematurely revealing the Aurevane mystery;
- Wayfarer's Practice foundation after normal Character XP exists: authoritative activity/accrual timestamps, Balanced Practice, deterministic elapsed-time calculation, direct Character XP Training Report, Rested Momentum representation, idempotent claim command, basic Training Report UI, and telemetry.

Do not implement full Rekindling yet, but do not hard-code progression in a way that makes Horizon pacing or later resets impossible.

Do not force complete three-preset loadouts in Phase 1 if Arts/Traits/Soulmarks do not exist yet; establish clean boundaries and complete the presets once the dependent build systems arrive.

Wayfarer's Practice is a focused Phase 1 progression ticket and is **not part of F0.4**.

**Gate:** a player can create and persist a valid character, own and equip foundational gear through authoritative state, and the progression/inventory model has the boundaries needed for later rested/offline progression, item categories, and complete saved builds without trusting client state/time.

## Phase 2 — Tactical Combat Core

Phase 2 proves the smallest complete version of the combat grammar defined in `docs/COMBAT.md`; it does not implement every future shape/editor/mechanic at once.

- deterministic battle state, rule/content versions, and RNG seed/state;
- grid/board representation;
- explicit round/turn lifecycle;
- initiative/turn order;
- baseline **Movement Budget + one Action** economy;
- split movement before/after the Action where legal;
- final facing selection and front/side/rear legality/preview;
- movement/path legality;
- first movement profiles;
- terrain/elevation/cover/hazard rules needed by the vertical slice;
- typed Target Spec foundation shared by player validation and AI;
- initial target kinds such as self/unit/ground/empty tile as scoped;
- initial reusable shapes such as Single, Circle, and Line;
- range, minimum range, line-of-sight, height, occupancy, and friendly-fire validation as required by the released actions;
- Basic Attack using a weapon/unarmed attack profile rather than bespoke UI-only logic;
- Guard, Wait, End Turn, and Interact where the test scenario needs it;
- HP/MP and first temporary combat-resource hooks;
- initial action cost and use-requirement grammar;
- shared typed Effect Catalog primitives required by the vertical slice, with damage treated as one effect type rather than a mandatory assumption;
- damage/healing/resource effects plus at least one meaningful utility effect where the vertical slice benefits;
- initial statuses and duration/stack timing;
- deterministic effect ordering;
- item/equipment combat effects required by the vertical slice use the same effect/target grammar;
- combat-item Action Cost Class foundation only if a released test item genuinely needs active use;
- **Turn Economy Tracker** showing Movement remaining, Action ready/spent, Reaction readiness when applicable, MP/temporary resource, cooldown/charges, item quantity where relevant, and projected selected-action cost;
- first terrain/zone creation or transformation only where a vertical-slice Art/item genuinely needs it;
- structured combat event log suitable for replay/debug/Battle Review later;
- authoritative command flow using intent + expected battle version rather than client-submitted outcomes;
- stale-version/idempotent retry safety appropriate to the action endpoint;
- battle UI with board-first layout, path/target/shape preview, forecast, valid/invalid explanation, concise actor state, turn order, Turn Economy Tracker, and responsive controls;
- battle-scene/environment foundation with readable world-quality background/material/terrain presentation;
- combat audio/VFX hooks that restore board readability quickly;
- reconnect-safe persistence foundation;
- combat-event architecture capable of later supporting Unchosen/Possibility mechanics without bespoke rewrites;
- server-authoritative combat-AI decision interface built on the same legality/path/range/target/effect/terrain/item rules as player actions;
- AI knowledge filter so decision logic only receives information permitted by the encounter/profile;
- baseline utility/candidate evaluation with deterministic seeded tie-breaking;
- bounded decision budget and safe legal fallback hierarchy;
- first weak **Recruit** AI profile;
- structured AI decision-reason tags for debugging/replays;
- deterministic developer/QA practice harness;
- golden tactical regression states for core movement/targeting/terrain/facing/action/effect cases;
- first player-facing Tactical Hall slice only after the normal battle loop is stable: Recruit Tactical Record, basic unlocked level/stat presets, one training floor, instant retry, and no normal repeatable progression rewards.

Do **not** implement every targeting shape, full Reaction framework, complete Combat Content Studio, full Item Studio, giant consumable catalog, final map editor, full PvP timing, every weapon profile, or every future status/effect in the first vertical slice merely because the architecture anticipates them.

**Gate:** two controlled units can complete a deterministic, visually readable tactical battle in which movement, terrain/position, targeting, one Action, resources, effects, and at least a few genuinely different choices matter; the Turn Economy Tracker makes costs obvious; the same legality is respected by the first Recruit AI; reconnect/replay-critical state is stable; and the fight is fun enough to justify extending the grammar.

## Phase 3 — Discipline Framework

- Discipline content schema;
- Mastery progression;
- Current Discipline;
- mastered Legacy Discipline;
- Arts;
- Traits;
- Reactions;
- Movement Arts;
- reusable effect library expansion only as real released content requires it;
- Confluence resolution framework;
- Soulmark framework;
- enforce 4 Current Arts + 2 Legacy Arts + 2 Traits + 1 Reaction + 1 Movement Art;
- dedicated presentation/integration for the unlocked Current Ultimate, Soulmark Signature, and Confluence Art where present;
- Art Curriculum/acquisition metadata: Core/Mastery/Trial/Discovery/Apex patterns without JP-like skill currency;
- typed actor/target/environment use-requirement composition;
- cooldown/charge/once-per-X rules;
- Discipline temporary resource patterns;
- Reaction triggers and deterministic ordering/loop safety required by released content;
- additional target shapes and multi-stage selection patterns only when an implemented Art needs them;
- automatic secondary-target policies for chain/bounce/follow-up effects where required;
- weapon/Art/equipment modifiers through stable tags/hooks rather than duplicate combat logic;
- effect triggers/filters required by real equipment interactions with deterministic loop safety;
- complete **three saved combat loadout presets** once the build systems they reference exist;
- saved presets store/validate Current + Legacy, Arts, Traits, Reaction, Movement Art, Soulmark, resolved Confluence, equipment, and the allowed combat-consumable kit;
- one authoritative atomic loadout-activation command with loadout/build versioning;
- central Armory build comparison and warnings for missing weapon/item/Art/requirements;
- initial small combat-consumable kit and inventory link where real content requires it;
- PvE/PvP mode-override representation without separate duplicate Art/item objects;
- lore-aware but spoiler-safe metadata hooks for Soulmarks and Confluences where later story requires them;
- telemetry needed to understand Discipline/Soulmark/Confluence progression by character age;
- build snapshot concepts needed later by Hall of Selves/Rekindling history;
- extend Wayfarer's Practice with Discipline Focus, eligible offline Mastery accrual, configurable offline Mastery ceiling, mastery-trial guardrails, and Mastery-source telemetry;
- make combat AI understand reusable effects, item effects, target rules, statuses, resources, Arts, Traits, Reactions, Movement Arts, engagement range, terrain, basic setup/payoff combinations, and legal build interactions;
- add versioned behavior archetype/profile data and stronger intelligence grades where the combat engine supports them cleanly;
- extend Tactical Hall records to Discipline-aware sparring opponents and let players select their legal saved loadouts without exposing locked/unreleased builds;
- begin minimum safe combat/item-content validation/preview tooling when authoring volume justifies it rather than waiting for Phase 13.

**Gate:** multiple meaningful builds can be configured, saved into three presets, and atomically activated/validated server-side; the combat grammar expresses real Current/Legacy/Reaction/Movement/Soulmark/Confluence/equipment interactions without one-off code for each ability/item; offline practice can assist Discipline development without independently granting true mastery; and representative AI profiles can use the same systems competently without illegal or obviously wasteful default behavior.

## Phase 4 — First Playable Discipline Set

Implement the initial subset defined in the Master Plan, targeting roughly 16 playable Disciplines before alpha rather than blocking testing on all 36.

Every Discipline ticket includes gameplay data, tests, art requests/assets, audio requests/assets, and **AI usage rules/tests** where applicable: preferred ranges, resource/defensive thresholds, setup/payoff logic, mobility intent, Reaction/Ultimate conditions, and obvious waste cases to avoid.

Every released Discipline must also establish a distinct combat identity across some combination of engagement range, mobility, defense, resource rhythm, setup/payoff, terrain, facing, objective value, team contribution, vulnerabilities/counterplay, and visual/audio motion language. Do not fill the roster with cosmetically renamed copies.

Combat-content tickets must use the authored targeting/cost/requirement/effect system, include player-readable acquisition/Mastery rules, and prove that important Arts create actual tactical decisions rather than only higher coefficients.

Introduce representative equipment and consumables that prove the item system can create strategic build choices, including worthwhile **non-damage** effects such as mobility/terrain/counterplay/defense/reveal/resource/objective utility. Reject same-item-plus-5%-number filler and effect soup.

Build representative battle scenes/maps that exercise different terrain, range, movement, objective, equipment, and positioning questions while reusing environment systems rather than carbon-copy layouts.

Character-building content should reinforce the theme that players can grow and combine identities through deliberate mastery without turning every Discipline into secret Aurevane lore.

Begin validating progression pacing against expected six-month targets rather than tuning only for short-term vertical slices. Include Wayfarer's Practice and Rested Momentum in pacing simulations so offline assistance does not accidentally trivialize the journey.

Expand the Tactical Hall with Recruit/Trained/Veteran representative opponents, progression-gated Tactical Records, useful scenario presets, saved/repeatable drills, terrain/facing/targeting/loadout exercises, and the first Battle Review foundation. Establish curated AI/combat/item-effect benchmark board states and begin human fairness/readability/fun testing.

**Gate:** the initial build-combination loop is genuinely fun to test; combat and equipment feel materially different across representative Disciplines/maps; normal actions/costs are readable despite system depth; and representative opponents can challenge those builds through recognizable tactical behavior rather than hidden cheating or random action selection.

## Phase 5 — Living World, Story & Live Operations Foundation

Per the Master Plan sprints:

- world map;
- movement/presence;
- towns;
- encounters;
- NPC/dialogue;
- quest engine;
- initial story.

Expand this phase with the minimum systems required for a genuinely living online world:

- layered global/region/node/player world state;
- data-driven world-event definitions and lifecycle;
- event scheduling and worker-driven transitions;
- **World Pulse** showing what is happening now and what changed since the last login;
- integrate Training Report / Rested Momentum into the “Since you were away” return summary without claiming live-event attendance for absent players;
- returning-player objectives and event-aftermath links that complement Wayfarer's Practice;
- announcements/world activity feed;
- event-linked encounters, quests, NPC states, objectives, modifiers, rewards, and map markers;
- urgency/recurrence metadata for time-limited events, rotating encounters, first-witness recognition, and aftermath;
- continuing story-arc hooks and versioned narrative content;
- **Archive** foundation for books, letters, reports, relics, inscriptions, environmental evidence, NPC testimony, and other discoverable lore;
- Fragment Sets, source provenance, unresolved contradictions, and reconstruction thresholds;
- activate protected **Quest & Key Item** inventory rules: non-sellable/non-salvageable by default, explicit retain/consume/transform semantics, no ordinary bag pressure, and safe quest references;
- story item variants can evolve name/art/description/state without breaking stable identity;
- physical quest items can unlock persistent Archive knowledge that remains after the physical item is handed in;
- first ordinary world vendors/known acquisition links where world services require them;
- item discovery/Codex state connects known items to their legitimate acquisition paths without leaking hidden catalogs;
- world/encounter context selects coherent versioned battle scenes rather than sending every encounter to a generic arena;
- region/location terrain, weather, ambience, background art, encounter objects, and event-state variants can feed battle presentation through approved scene/scenario definitions;
- battle completion/escape/defeat returns cleanly to authoritative world/inventory/reward state;
- connect Tactical Record acquisition to legitimate encounters, enemy-family defeats, mentors/training quests, region/Horizon progress, Archive/training discoveries, and other spoiler-safe world progression;
- make new Tactical Record unlock messaging restrained and useful rather than a second intrusive checklist;
- present the Tactical Hall as a believable world service/location or equivalent UI destination while keeping future enemy/boss records hidden until legitimately known;
- protected owner/staff Master Panel shell;
- initial granular permission framework for live-ops/story/lore actions;
- Event/Story/Lore operations MVP with draft, preview, schedule, publish, stop, archive, and rollback where applicable;
- audit logging of privileged world/story/lore operations;
- staging/preview workflow before production publication;
- first meaningful Horizon/world progression gates where playable content requires them;
- main-story implementation for the **Quiet Name / Kindly Horizon** era of the Aurevane mystery;
- ancient horizon, open-circle, road, and Closed Star motifs;
- the forgotten-protector mythology;
- first meaningful contradictions in accepted history;
- first controlled clues that the word **Aurevane** is a name rather than simply a title/world label;
- narrative data structures that can later gate deeper reveal stages without rewriting the quest engine.

**Gate:** a character can leave a hub, explore, enter an encounter whose battle scene actually belongs to that location, receive/consume protected quest items safely, complete combat/quests, discover lore/items, and return with persistent progression **and** an authorized owner/event/story staff member can safely publish a scheduled world/story event that changes what players see and can do without a code deployment. The main story has a compelling mystery without prematurely exposing the antagonist reveal. Tactical Records can unlock from legitimate world experience without leaking future encounters.

## Phase 6 — Party & Co-op

- parties;
- party realtime;
- co-op battles;
- shared quests;
- party finder;
- live-ops integration for cooperative event objectives where required;
- co-op narrative encounters capable of preserving player-specific story flags inside shared world events;
- group/community event participation should feed Chronicle and urgency systems where appropriate;
- multi-player battle ownership, reconnect, timers/flow, pings, and action visibility;
- verify Reactions/multi-target/item effects do not create prompt spam or unreadable sequencing in three-player fights;
- add a lightweight enemy-team coordinator for role-aware focus, protection, formations, setup/payoff sequences, objective assignment, and overkill avoidance;
- tune coordination by enemy identity so disciplined squads behave more coherently than creatures that should be disorganized;
- add allied NPC AI where required and multi-unit Tactical Hall drills for legitimately unlocked profiles.

**Gate:** three people can complete a mission together in a battle that remains readable and responsive, against enemy groups whose coordination is challenging but understandable and does not depend on hidden player information.

## Phase 7 — Expeditions

- dungeon template engine;
- seeded generation;
- progressive reveal;
- Easy Expeditions;
- Standard Expeditions;
- threat/modifiers;
- suspension/reconnect;
- Deep Expeditions;
- multiphase bosses;
- personal loot/leaderboards;
- targeted item pools with known source presentation for important gear;
- bad-luck protection for approved rare chase groups;
- Expedition consumables/tools where authored;
- suspended runs preserve run-owned/consumed inventory state deterministically and do not duplicate items on resume;
- Expedition-event hooks and operator controls;
- temporary Expedition rotations/anomalies for live urgency;
- lore rooms, records, relics, and Fragment Set sources;
- architecture for late-story Unmoored/possibility-themed Expeditions while preserving deterministic seeded generation;
- richer objective/scenario rules and authored modular battle scenes;
- telegraphed/windup/interrupt mechanics as real boss content requires them;
- environmental battle objects, terrain transformations, reinforcements, and phase-state rules where authored;
- objective-specific Expedition AI and stronger team coordination where encounter identity requires it;
- boss AI directors combining authored phase/telegraph rules with bounded tactical choices inside each phase;
- boss Tactical Records/practice simulations only after the required legitimate encounter/clear, with unreached phases and hidden mechanics spoiler-gated;
- validate long encounter combat/AI/item-state performance, reconnect behavior, content/rules version pinning, and replay reproducibility.

**Gate:** a three-player, hour-scale Deep Expedition is fully playable, with meaningful targeted loot, memorable battle scenes, mechanics, terrain/objective variation, and bosses/enemy groups that use authored, fair, learnable tactical intelligence with no combat/AI/inventory soft locks or reward duplication.

## Phase 8 — PvP

- direct challenges;
- casual 1v1;
- ranked 1v1;
- Arena Tempering;
- casual 2v2;
- ranked 2v2;
- matchmaking;
- disconnect protection;
- seasons;
- tournament framework;
- server-owned competitive decision clocks based around the Master Plan's configurable 30–45 second starting target;
- resolution animations must not consume the next player's decision time;
- explicit timeout/Guard-or-End/forfeit/reconnect behavior;
- explicit ranked loadout/equipment/combat-consumable validation and banned/disabled-content handling;
- equipment uses the same definitions with transparent versioned Arena Tempering/PvP overrides rather than a duplicate PvP item catalog;
- combat consumable allowlist/slot/charge rules for ranked where needed;
- transparent versioned PvP coefficients/control-duration/summon/other mode overrides rather than separate duplicate ability definitions;
- CC anti-lockout/diminishing-effectiveness system;
- 1v1/2v2 map side-bias, range, terrain, objective, equipment-archetype, and spawn testing;
- PvP rotation, tournament, season, and event operations in the Master Panel as those systems become real;
- lore-themed special PvP rotations may use unstable-world presentation/rules later without secretly changing permanent ranked balance;
- collect Edge-relevant baseline matchup/win-rate telemetry before Rekindling combat rewards are enabled;
- queue configuration must eventually be able to disable/normalize Veteran Edge;
- allow unlocked Tactical Hall opponents to rehearse PvP-like legal builds/rules where useful without copying private real-player loadouts;
- never silently populate standard ranked queues with bots presented as human opponents; any future bot-enabled queue must explicitly support/disclose that rule;
- PvP-like practice AI obeys the same public-information boundary and cannot inspect private/uncommitted player choices.

## Phase 9 — Full Discipline Roster

Expand toward all 36 Disciplines in controlled batches.

Every new Discipline requires at minimum:

- Innate;
- 5+ Arts;
- Ultimate;
- Traits;
- Reaction where appropriate;
- Movement Art where appropriate;
- clear Art Curriculum/acquisition rules;
- distinct engagement/mobility/setup/terrain/objective/counterplay identity;
- authoritative target/cost/requirement/effect data;
- representative equipment/item interaction review so the Discipline does not accidentally have no viable or one mandatory gear path;
- AI usage rules;
- AI tactical regression scenarios appropriate to the Discipline;
- VFX requirement;
- SFX requirement;
- Confluence definitions;
- PvP tests;
- PvE tests.

Complete AI behavior coverage for released Disciplines and expand advanced Tactical Records/Confluence/Soulmark/item-aware decision quality without exposing unreleased content.

This phase also expands late-cycle build depth so the first 180-day journey has enough meaningful mastery targets.

## Phase 10 — Social World

- guilds;
- friends;
- messages;
- guild quests;
- guild progression;
- social profiles;
- moderation;
- staff moderation/report/support tools with explicit permissions and audit trails;
- optional later build/loadout share cards that expose only information the player chooses and game rules allow;
- social recognition and Chronicle hooks for major server-wide narrative/world-event participation;
- prestige/Rekindling presentation on character profiles and social surfaces;
- Hall of Selves presentation foundation where appropriate.

## Phase 11 — Economy

- stores/vendors;
- complete loot-service foundation;
- marketplace;
- crafting;
- materials inventory maturity;
- binding/trading policies;
- safe bulk sell/salvage if salvage is approved;
- inventory capacity/stack policies tuned for low-friction use;
- bounded overflow/recovery stash so important rewards are not silently lost;
- item history/provenance sufficient for support/economy analysis;
- acquisition graph maturity across loot, quests, vendors, crafting, events, PvP/nation where relevant;
- combat items/equipment acquisition connects to the same authoritative combat definitions rather than duplicating action logic;
- controlled owner/balance/economy configuration and support workflows rather than raw production-data editing;
- item/equipment/consumable/economy telemetry;
- Rekindling reset/preserve rules must not accidentally delete purchases, permanent cosmetics, or account ownership;
- recurring acquisition paths for important competitive build components that previously appeared in limited-time content;
- verify Wayfarer's Practice remains non-tradable/non-inflationary by default and does not become a passive marketplace-resource farm;
- verify Practice Arena custom battles remain isolated from normal loot/currency/economy output and cannot become a zero-risk farming route.

**Gate:** normal item acquisition, ownership, storage, equipment, crafting/trade/store loops are coherent and server-authoritative, and the economy can move meaningful items without creating duplication, key-item loss, or inventory-management misery.

## Phase 12 — Nations

- allegiance;
- reputation;
- nation quests;
- campaigns;
- nation warfare;
- political rankings;
- nation campaign/event operations integrated with the living-world framework;
- political interpretations of the Aurevane/Binding mystery without reducing any nation to the singular objectively correct lore faction;
- nation/world seasons become another major late-cycle activity pillar;
- nation/reputation item rewards use the same acquisition/effect/item definitions and must not permanently gate essential competitive builds behind one political choice;
- first complete six-month progression loop should be content-complete enough to validate before public-scale Rekindling launch.

## Phase 13 — Complete Master Panel + Long-Horizon Operations

Some operational functionality exists earlier alongside the systems it controls. This phase builds the complete owner/staff game operating system:

- owner dashboard;
- **Owner Command Center** with final operational authority over game-controlled state;
- staff and role/permission administration;
- custom roles and granular special account capabilities/entitlements;
- player lookup and audited authoritative correction tools for progression, inventory, equipment, saved loadouts, currency, story flags, titles, cosmetics, event eligibility, stuck quests/sessions, and Rekindling state;
- content editors;
- Confluence editor;
- quest/dialogue/story editor;
- Archive/Fragment Set/lore-source editor;
- world-event editor and scheduler;
- expedition editor;
- PvP/season/tournament operations;
- audio manager;
- Asset Studio;
- Balance Lab and safe quick edits;
- **Combat Content Studio** with authorized Art/Trait/Reaction/Movement/Ultimate/Confluence/Soulmark combat editing, weapon attack profiles, statuses, terrain/movement profiles, battle objects/summons, scenarios/objectives, map/scene data, typed Target/Requirement/Effect builders, visual targeting preview, test-character battle launch, content completeness validation, dependency/impact preview, mode overrides, staged publish, rollback, emergency disable, permissions, and audit;
- **Item Studio / Effect Catalog** with item/equipment/consumable/material/key-item definitions, typed triggers/effects, Action Cost Classes, item target previews, sets, binding/unique rules, acquisition graph, loot/vendor/crafting relationships, PvP overrides, test equip/test battle, effect/power-budget warnings, dependency/impact preview, live ownership/loadout/listing impact, staged publish, retirement/migration, rollback, emergency disable, permissions, and audit;
- item/loadout analytics for ownership/equip rates, build pairings, effect trigger/value, combat-item use, replacement behavior, acquisition sources, loadout invalidity/switching, marketplace economy, and map/matchup context;
- combat analytics for slot/cast/use/effect efficiency, map/terrain heatmaps, objective performance, matchup/build data, Reaction trigger/value, timer/timeout behavior, battle length, and other balance evidence;
- **Combat AI Lab** with authorized profile inspection/editing, profile-to-enemy assignment inspection, deterministic seed replay, unrestricted supported QA scenarios, AI-vs-AI/team-vs-team, batch simulations, matchup matrices, benchmark-suite runner, decision/performance analytics, staged publish, version diff/rollback, and per-profile emergency fallback/disable controls;
- Tactical Record configuration for unlock requirements, intelligence-grade caps, level/stat ranges, scenario access, and spoiler visibility;
- **Pacing Simulator** for XP/Horizon/180-day projections, including different Wayfarer's Practice absence patterns and Rested Momentum use;
- progression configuration for XP/Mastery curves, level cap, Horizon age/milestone gates, rested/catch-up rules, Wayfarer's Practice focus/accrual/caps/Mastery ceilings, Rested Momentum, Art Curriculum/acquisition requirements where content-controlled, and endgame qualification;
- offline-progression analytics for claim rate, claim-to-session conversion, direct-vs-active XP/Mastery share, cap frequency, return rate, and Horizon impact;
- retention/urgency configuration for event cadence, recurrence, first-witness rewards, rotations, World Pulse priority, and aftermath;
- Rekindling configuration for eligibility, reset/preserve rules, Memory Carryover, cycle length, and support corrections;
- Veteran Edge editor, analytics, kill switches, queue enable/disable/normalization, and balance rollback;
- economic analytics;
- player support/moderation;
- feature flags and maintenance controls;
- searchable audit log;
- content diff/history;
- scheduling;
- version rollback;
- narrative arc/stage metadata;
- canon/spoiler tags and controlled publication rights for major reveal content;
- protection against ordinary Event Staff accidentally publishing unreleased central-story material;
- break-glass Owner actions for exceptional high-risk recovery operations, requiring re-authentication, reason, confirmation, and immutable audit records.

**Gate:** the owner can safely operate, author, rebalance, preview, simulate, repair, and delegate the live game through audited, server-authorized tools without routine database access or code edits for normal content operations. Every major combat, item/effect/inventory/loadout, six-month pacing, offline-progression, combat-AI/Tactical Hall, urgency, Rekindling, Veteran Edge, lore-discovery, and player-support control has an operational surface.

## Phase 14 — Art & Audio Production Polish

This is a dedicated production pass, not permission to postpone all media until late development.

- region artwork;
- character art;
- Discipline artwork;
- Soulmark art;
- item icons/key art for major weapons, Legendaries, quest relics, sets, and signature consumables;
- polished Inventory and Build/Armory presentation;
- Legendary/important item acquisition feedback;
- responsive/touch inventory filters, compare views, loadout preset controls, and protected key-item presentation;
- soundtrack;
- ambience;
- SFX;
- transitions;
- particles;
- animations;
- responsive polish;
- loading/error-state polish;
- battle-scene backgrounds/parallax/environment kits;
- combat map material/terrain/elevation readability polish;
- weapon/Art/item/Reaction/Movement/Soulmark/Confluence/Ultimate animation and VFX identity;
- impact audio, footsteps, blocks/parries, item-use sounds, telegraphs, objective cues, and combat ambience;
- fast/readable action resolution with special treatment reserved for earned signature moments;
- responsive/touch battle action bar, targeting, forecast, **Turn Economy Tracker**, timeline, and contextual inspection polish;
- reduced-motion/camera-shake/accessibility combat polish;
- Aurevane/Open Crown visual identity and recurring motifs;
- Closed Star visual language;
- Aurevane leitmotif progression from warm/hopeful to unstable/antagonistic arrangements;
- Unmoored-world VFX that remain readable rather than becoming visual noise;
- Rekindling/Hall of Selves presentation;
- Archive/document/relic presentation that makes lore discovery feel premium rather than like plain database text;
- Training Report / Wayfarer's Practice return presentation polished to feel like character growth rather than a mobile-game claim box;
- Tactical Hall, Practice Arena configuration, intelligence-grade presentation, Battle Review, and training-environment visuals/audio polished to feel like an integrated game feature rather than a developer debug screen.

Media required to make earlier testing coherent should already be introduced through the request pipeline during prior phases.

## Phase 15 — Hardening

- security/penetration review;
- abuse testing;
- rate limiting;
- privileged staff-access security review;
- Owner break-glass security review;
- audit-log integrity review;
- SQL/index optimization;
- load testing;
- matchmaking load;
- realtime load;
- expedition concurrency;
- economic exploit testing;
- inventory ownership/quantity/equip concurrency tests;
- item-definition/instance migration/version tests;
- reward/loot/idempotency duplication tests;
- bulk sell/salvage safety and locked/favorite/loadout/key-item protection tests;
- overflow/recovery tests for full-inventory/unique/Legendary/quest reward cases;
- atomic three-loadout activation, stale loadout/build version, missing item, disabled content, and simultaneous edit tests;
- effect trigger/filter/ordering/recursion/loop-safety property tests;
- combat-item Action Cost, target, quantity/charge, cooldown/resource, and rejected-use rollback tests;
- marketplace/equip/listing races and crafting consume/output atomicity tests;
- PvP item/Arena Tempering/consumable-rule regression tests;
- Item Studio/Effect Catalog permission/validation/staging/diff/publish/rollback/retirement/impact-preview tests;
- inventory performance with large but realistic long-lived character collections;
- live-event scheduling/recovery testing;
- spoiler/canon publication-path review for production narrative operations;
- progression/Horizon boundary tests;
- Wayfarer's Practice server-time, accrual-cap, focus-change, Mastery-ceiling, idempotency/double-claim, reconnect, long-absence, multi-character, and economy-isolation tests;
- verify offline progression is calculated efficiently without unnecessary continuous per-character jobs or client polling;
- combat movement/path/terrain/elevation property tests and worst cases;
- target-kind/shape/range/LoS/height/filter/friendly-fire/multistage/secondary-target-policy tests for implemented grammar;
- action cost/requirement/cooldown/charge/resource atomicity and rejected-action rollback tests;
- effect ordering/status duration/terrain transformation/summon/objective tests;
- Reaction priority/response-window/loop-recursion safety tests;
- initiative/extra-action/refund/infinite-turn prevention tests;
- battle command idempotency, stale-version race, seed replay, version pinning, reconnect, timer/timeout, and disconnect-abuse tests;
- map spawn/objective reachability, side bias, terrain/range archetype balance, performance, camera/readability, and content-reference validation;
- Combat Content Studio permission/validation/staging/diff/publish/rollback/emergency-disable/impact-preview tests;
- combat-AI legal-action/property tests, configured knowledge-boundary tests, deterministic version/seed replay, decision-budget/load testing, pathfinding worst cases, fallback/loop/oscillation checks, boss telegraph/counterplay review, and representative tactical regression suites;
- Tactical Hall authorization, Tactical Record progression/spoiler gating, level/stat/configuration legality, practice reward isolation, saved-loadout selection, reset/retry, and boss-record unlock tests;
- Combat AI Lab permission/audit/versioning/staged-publish/rollback validation;
- human combat playtests across skill levels to confirm battle depth feels exciting, learnable, varied, readable, and fair rather than cluttered, omniscient, random, or mechanically shallow;
- Rekindling reset/preserve integrity tests;
- Veteran Edge competitive regression tests;
- event recurrence/catch-up tests;
- player correction/idempotency tests.

## First Full Endgame / Rekindling Gate

Before Rekindling becomes a normal production feature, validate:

- engaged players cannot reach complete first-cycle endgame/Rekindling eligibility before the configured approximately 180-day minimum;
- reaching the gate requires real gameplay milestones, not only character age;
- levels 1–100 and build progression remain rewarding throughout the journey;
- equipment/item discovery continues creating useful new build options rather than only numerical replacement churn;
- returning-player catch-up and Wayfarer's Practice help recovery without bypassing the long-horizon endpoint;
- offline XP/Mastery remains a modest contributor and cannot replace accomplishment-based progression;
- Practice Arena battles do not provide a low-risk shortcut around active progression or economy acquisition;
- enough PvE/PvP/world/story/lore content exists that the six-month journey is not filler;
- combat across the journey continues introducing meaningful build/terrain/objective/opponent questions rather than becoming the same fight with larger numbers;
- the endgame rite is a genuine mastery challenge;
- Rekindling preserves identity/history while resetting enough progression to make rebuilding meaningful;
- Veteran Edge has sufficient telemetry, tests, kill switches, queue rules, and Master Panel controls before use in ranked PvP.

## Closed Alpha Target

From the Master Plan, expanded with the operational, combat, item, and narrative requirements needed to keep the alpha world alive:

- 16 Disciplines;
- 8 Soulmarks;
- dozens of Confluences;
- 4 world regions;
- 20–30 enemies;
- 4–6 bosses;
- 50+ items with actual authored roles rather than 50 stat-reskin fillers;
- Equipment / Consumables / Materials / protected Quest-Key inventory boundaries;
- stable Item Definition + Item Instance ownership model;
- core equipment slots and polished central Armory/build experience;
- three saved combat loadouts once the dependent systems exist;
- representative strategic non-damage equipment/consumables;
- known acquisition/target-farming foundation;
- Turn Economy Tracker with selected action/item cost preview;
- 20+ quests;
- Easy Expedition;
- Standard Expedition;
- 1 Deep Expedition;
- 1v1 PvP;
- 2v2 PvP;
- Guild foundation;
- stable Movement Budget + one Action combat economy with bounded action manipulation;
- representative targeting grammar covering unit/ground targeting, several shapes, range/LoS/height/friendly-fire rules, requirements/costs/effects, and clear forecasts;
- meaningful terrain/elevation/facing/status/Reaction/Movement-Art/item interactions;
- world-linked authored battle scenes/maps with several genuinely different tactical layouts rather than reskins;
- combat loadout rules for Current/Legacy Arts, Traits, Reaction, Movement Art, Soulmark, Confluence, Current Ultimate, equipment, and approved combat-item kit;
- Art Curriculum/Mastery/trial/discovery acquisition foundation with no JP-like skill currency;
- reliable shared combat-AI framework with representative Recruit/Trained/Veteran behavior;
- distinct AI archetypes across representative enemy families;
- AI usage rules/regression coverage for the initial Discipline/item set;
- competent enemy-squad coordination where fiction/content requires it;
- authored, fair, learnable boss AI behavior;
- player Tactical Hall foundation with progression-gated Tactical Records, basic level/stat/opponent configuration, saved-loadout testing, repeatable practice seeds, terrain/targeting drills, and Battle Review foundation;
- QA benchmark scenarios with no common illegal-action/effect-loop/inventory/combat/AI soft-lock failures;
- continuing world-event/story capability;
- World Pulse foundation;
- Archive/lore discovery foundation and Fragment Sets;
- owner + delegated staff role/permission foundation;
- usable Event/Story/Lore operations panel;
- minimum safe combat/item-content validation/preview controls required by released systems;
- auditability and content rollback for live operations;
- Master Panel core;
- full audio;
- strong visual presentation;
- coherent early Aurevane mystery and foreshadowing;
- forgotten-protector mythology and Closed Star motifs;
- at least one meaningful historical contradiction;
- optional late-alpha reveal that **Aurevane is the lost goddess's name**;
- **no requirement to reveal the City That Was Twice, Great Opening, or full antagonist twist during Closed Alpha**;
- enough progression telemetry to begin calibrating the six-month target, including offline/rested contribution, but Closed Alpha itself does not need to run for six months before testing individual systems.

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

Combat tickets must additionally identify which part of the approved combat grammar they implement and which later mechanics are explicitly out of scope so future target/effect/editor capabilities are not accidentally pulled into one ticket.

Item/inventory/loadout tickets must additionally identify which item classes/effect primitives/loadout fields/economy links are in scope and which future inventory/economy/editor capabilities are explicitly out of scope, so a basic equipment ticket does not become the entire marketplace/crafting/Item Studio.

Only the assigned ticket is implemented. Future roadmap systems may influence interfaces and boundaries, but they are not implemented early merely because they are known.