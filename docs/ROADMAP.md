# AUREVANE — Implementation Roadmap

**Authority:** Derived from `docs/GAME_MASTER_PLAN.md`. If any conflict exists, the Master Game Plan wins.

The roadmap exists to stop the final product specification from being mistaken for today's implementation scope.

## Cross-Cutting Direction — Character Building Inside a Living World

AUREVANE's personal hook is the permanent character: mastering Disciplines, combining Current + Legacy Disciplines, discovering Confluences, developing Soulmarks, and refining equipment/build choices.

The world should continuously create new reasons to use and rethink that character. World events, story developments, seasonal changes, cooperative objectives, PvP rotations, guild/nation activity, and live operations should make the shared world feel active rather than like a static quest catalog.

The central mythology reinforces that hook: **Aurevane is the imprisoned goddess of Becoming**, initially believed to be a wronged benevolent protector and eventually revealed as the principal antagonist whose desire to remove every limit from possibility would erase coherent identity and reality. The player's deliberate, bounded character growth becomes the thematic counterargument to her limitless Becoming.

See `docs/WORLD.md`, `docs/MASTER_PANEL.md`, `docs/LORE_BIBLE.md`, and `docs/PROGRESSION_RETENTION.md` for the authoritative feature, narrative, progression, prestige, retention, and lore-discovery expansions.

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

Calendar age alone is insufficient, and grind alone cannot bypass the final long-horizon gate. Exact pacing is data-driven and Master Panel configurable as defined in `docs/PROGRESSION_RETENTION.md`.

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

Do not expose late-story canon in early player-facing copy, filenames, public data, event metadata, or UI merely because developers know the twist.

## Progressive Operations Rule

The complete Master Panel remains Phase 13, but **operational tooling does not wait until Phase 13**.

Each major system should ship with the minimum safe owner/staff controls required to operate that system. In particular, when the world and continuing story arrive in Phase 5, AUREVANE also gains a safe Event/Story operations slice so authorized staff can make the world change without routine code deployments.

Role/permission architecture, auditability, versioning, staging/preview, rollback, narrative canon controls, progression configuration, Rekindling rules, Veteran Edge, lore publication, and player-support mutation commands must grow progressively and remain server-authoritative.

The Owner is the highest game-operations authority. The final Master Panel must provide broad operational control over game configuration, users, entitlements, staff roles, special permissions, progression corrections, economy/content corrections, story flags, events, PvP, Rekindling, lore, and emergency controls through validated and audited domain commands rather than exposing raw production credentials.

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
- character/account timestamps and auditability must not be designed in a way that blocks future minimum-age progression rules.

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
- initial inventory/equipment foundation where required;
- presentation hooks for early narrative identity without prematurely revealing the Aurevane mystery.

Do not implement full Rekindling yet, but do not hard-code progression in a way that makes Horizon pacing or later resets impossible.

**Gate:** a player can create and persist a valid character with server-authoritative state.

## Phase 2 — Tactical Combat Core

- deterministic battle state;
- grid/board representation;
- initiative/turn order;
- movement/path legality;
- targeting;
- damage/healing/resource effects;
- statuses;
- terrain/elevation/cover rules from the Master Plan;
- structured combat event log;
- battle UI and animation hooks;
- reconnect-safe persistence foundation;
- combat-event architecture capable of later supporting Unchosen/Possibility mechanics without bespoke rewrites.

**Gate:** two controlled units can complete a deterministic tactical battle with tests.

## Phase 3 — Discipline Framework

- Discipline content schema;
- Mastery progression;
- Current Discipline;
- mastered Legacy Discipline;
- Arts;
- Traits;
- Reactions;
- Movement Arts;
- reusable effect library;
- Confluence resolution framework;
- Soulmark framework;
- lore-aware but spoiler-safe metadata hooks for Soulmarks and Confluences where later story requires them;
- telemetry needed to understand Discipline/Soulmark/Confluence progression by character age;
- build snapshot concepts needed later by Hall of Selves/Rekindling history.

**Gate:** multiple meaningful builds can be configured and validated server-side.

## Phase 4 — First Playable Discipline Set

Implement the initial subset defined in the Master Plan, targeting roughly 16 playable Disciplines before alpha rather than blocking testing on all 36.

Every Discipline ticket includes gameplay data, tests, art requests/assets, audio requests/assets, and AI-usage rules where applicable.

Character-building content should reinforce the theme that players can grow and combine identities through deliberate mastery without turning every Discipline into secret Aurevane lore.

Begin validating progression pacing against expected six-month targets rather than tuning only for short-term vertical slices.

**Gate:** the initial build-combination loop is genuinely fun to test.

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
- announcements/world activity feed;
- event-linked encounters, quests, NPC states, objectives, modifiers, rewards, and map markers;
- urgency/recurrence metadata for time-limited events, rotating encounters, first-witness recognition, and aftermath;
- continuing story-arc hooks and versioned narrative content;
- **Archive** foundation for books, letters, reports, relics, inscriptions, environmental evidence, NPC testimony, and other discoverable lore;
- Fragment Sets, source provenance, unresolved contradictions, and reconstruction thresholds;
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

**Gate:** a character can leave a hub, explore, encounter content, complete quests, discover lore in the actual world, and return with persistent progression **and** an authorized owner/event/story staff member can safely publish a scheduled world/story event that changes what players see and can do without a code deployment. The main story has a compelling mystery without prematurely exposing the antagonist reveal.

## Phase 6 — Party & Co-op

- parties;
- party realtime;
- co-op battles;
- shared quests;
- party finder;
- live-ops integration for cooperative event objectives where required;
- co-op narrative encounters capable of preserving player-specific story flags inside shared world events;
- group/community event participation should feed Chronicle and urgency systems where appropriate.

**Gate:** three people can complete a mission together.

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
- Expedition-event hooks and operator controls;
- temporary Expedition rotations/anomalies for live urgency;
- lore rooms, records, relics, and Fragment Set sources;
- architecture for late-story Unmoored/possibility-themed Expeditions while preserving deterministic seeded generation.

**Gate:** a three-player, hour-scale Deep Expedition is fully playable.

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
- PvP rotation, tournament, season, and event operations in the Master Panel as those systems become real;
- lore-themed special PvP rotations may use unstable-world presentation/rules later without secretly changing permanent ranked balance;
- collect Edge-relevant baseline matchup/win-rate telemetry before Rekindling combat rewards are enabled;
- queue configuration must eventually be able to disable/normalize Veteran Edge.

## Phase 9 — Full Discipline Roster

Expand toward all 36 Disciplines in controlled batches.

Every new Discipline requires at minimum:

- Innate;
- 5+ Arts;
- Ultimate;
- Traits;
- Reaction where appropriate;
- Movement Art where appropriate;
- AI usage rules;
- VFX requirement;
- SFX requirement;
- Confluence definitions;
- PvP tests;
- PvE tests.

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
- social recognition and Chronicle hooks for major server-wide narrative/world-event participation;
- prestige/Rekindling presentation on character profiles and social surfaces;
- Hall of Selves presentation foundation where appropriate.

## Phase 11 — Economy

- stores;
- loot;
- marketplace;
- crafting;
- economic telemetry;
- controlled owner/balance/economy configuration and support workflows rather than raw production-data editing;
- Rekindling reset/preserve rules must not accidentally delete purchases, permanent cosmetics, or account ownership;
- recurring acquisition paths for important competitive build components that previously appeared in limited-time content.

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
- first complete six-month progression loop should be content-complete enough to validate before public-scale Rekindling launch.

## Phase 13 — Complete Master Panel + Long-Horizon Operations

Some operational functionality exists earlier alongside the systems it controls. This phase builds the complete owner/staff game operating system:

- owner dashboard;
- **Owner Command Center** with final operational authority over game-controlled state;
- staff and role/permission administration;
- custom roles and granular special account capabilities/entitlements;
- player lookup and audited authoritative correction tools for progression, inventory, currency, story flags, titles, cosmetics, event eligibility, stuck quests/sessions, and Rekindling state;
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
- **Pacing Simulator** for XP/Horizon/180-day projections;
- progression configuration for XP/Mastery curves, level cap, Horizon age/milestone gates, rested/catch-up rules, and endgame qualification;
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

**Gate:** the owner can safely operate, rebalance, repair, and delegate the live game through audited, server-authorized tools without routine database access or code edits for normal content operations. Every major six-month pacing, urgency, Rekindling, Veteran Edge, lore-discovery, and player-support control has an operational surface.

## Phase 14 — Art & Audio Production Polish

This is a dedicated production pass, not permission to postpone all media until late development.

- region artwork;
- character art;
- Discipline artwork;
- Soulmark art;
- soundtrack;
- ambience;
- SFX;
- transitions;
- particles;
- animations;
- responsive polish;
- loading/error-state polish;
- Aurevane/Open Crown visual identity and recurring motifs;
- Closed Star visual language;
- Aurevane leitmotif progression from warm/hopeful to unstable/antagonistic arrangements;
- Unmoored-world VFX that remain readable rather than becoming visual noise;
- Rekindling/Hall of Selves presentation;
- Archive/document/relic presentation that makes lore discovery feel premium rather than like plain database text.

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
- live-event scheduling/recovery testing;
- spoiler/canon publication-path review for production narrative operations;
- progression/Horizon boundary tests;
- Rekindling reset/preserve integrity tests;
- Veteran Edge competitive regression tests;
- event recurrence/catch-up tests;
- player correction/idempotency tests.

## First Full Endgame / Rekindling Gate

Before Rekindling becomes a normal production feature, validate:

- engaged players cannot reach complete first-cycle endgame/Rekindling eligibility before the configured approximately 180-day minimum;
- reaching the gate requires real gameplay milestones, not only character age;
- levels 1–100 and build progression remain rewarding throughout the journey;
- returning-player catch-up helps recovery without bypassing the long-horizon endpoint;
- enough PvE/PvP/world/story/lore content exists that the six-month journey is not filler;
- the endgame rite is a genuine mastery challenge;
- Rekindling preserves identity/history while resetting enough progression to make rebuilding meaningful;
- Veteran Edge has sufficient telemetry, tests, kill switches, queue rules, and Master Panel controls before use in ranked PvP.

## Closed Alpha Target

From the Master Plan, expanded with the operational and narrative requirements needed to keep the alpha world alive:

- 16 Disciplines;
- 8 Soulmarks;
- dozens of Confluences;
- 4 world regions;
- 20–30 enemies;
- 4–6 bosses;
- 50+ items;
- 20+ quests;
- Easy Expedition;
- Standard Expedition;
- 1 Deep Expedition;
- 1v1 PvP;
- 2v2 PvP;
- Guild foundation;
- continuing world-event/story capability;
- World Pulse foundation;
- Archive/lore discovery foundation and Fragment Sets;
- owner + delegated staff role/permission foundation;
- usable Event/Story/Lore operations panel;
- auditability and content rollback for live operations;
- Master Panel core;
- full audio;
- strong visual presentation;
- coherent early Aurevane mystery and foreshadowing;
- forgotten-protector mythology and Closed Star motifs;
- at least one meaningful historical contradiction;
- optional late-alpha reveal that **Aurevane is the lost goddess's name**;
- **no requirement to reveal the City That Was Twice, Great Opening, or full antagonist twist during Closed Alpha**;
- enough progression telemetry to begin calibrating the six-month target, but Closed Alpha itself does not need to run for six months before testing individual systems.

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

Only the assigned ticket is implemented. Future roadmap systems may influence interfaces and boundaries, but they are not implemented early merely because they are known.
