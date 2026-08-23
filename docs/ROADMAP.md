# AUREVANE — Implementation Roadmap

**Authority:** Derived from `docs/GAME_MASTER_PLAN.md` and its Owner-approved addenda. If any conflict exists, the Master Game Plan and the applicable canonical domain specification win.

**Synchronized:** 2026-08-23

**Roadmap reconciliation:** This version replaces the older sequencing snapshot that treated direct PvP and spectation as wholly future work. The project deliberately implemented substantially more than the original Phase-2 minimum. This roadmap now treats that work as official delivered foundation instead of ignoring it, rebuilding it later, or pretending the project has skipped directly to a later mature phase.

A roadmap phase is a **development milestone**, not a calendar promise. Work advances through implementation gates, automated verification, Owner testing, structured human/player validation, and product-evidence gates where required.

---

# 1. How to read this roadmap

AUREVANE uses four different ideas that must not be confused:

- **Implemented** — the capability exists in the repository/runtime at the required authority boundary.
- **Verified** — applicable automated/database/browser/release checks have passed for the implementation candidate.
- **Owner testing / stabilization** — the Owner is actively testing real player-facing behavior and may still request contained correction/polish batches.
- **Validated / phase gate passed** — the required human/product evidence has been reviewed and the phase is formally allowed to expand into the next expensive layer.

Automated green checks do **not** equal a human PV PASS. Production deployment does **not** equal a fun/readable/balanced PASS. A feature may also exist early without making its later mature phase complete.

## Early-delivered scope rule

If later-phase capability is deliberately built early and proves reusable, it receives **roadmap credit**.

When the later phase arrives:

1. audit the existing implementation against the mature phase requirements;
2. preserve working compatible foundations;
3. close only the genuine gaps;
4. do not rebuild a system merely because the old roadmap originally scheduled it later.

This rule now explicitly applies to the direct PvP, multi-combatant battle, spectation, battle communication, battle-log, responsive combat-presentation, and related hardening work delivered during the extended Phase-2 cycle.

---

# 2. Current operating state

## Current status snapshot

| Phase | Status | Current interpretation |
|---|---|---|
| **Phase 0 — Engineering Foundation** | ✅ Substantially complete | Production-grade engineering/security/deployment foundations exist. |
| **Phase 1 — Character & Progression Foundation** | ✅ Substantially complete | Character/account/progression/profile/equipment foundations and Passive Training baseline exist and have received later feedback iteration. |
| **Phase 2 — Tactical Combat & Battle Platform** | 🧪 **Implementation mature; Owner testing / PV-1 validation open** | Original tactical-combat scope is delivered and substantially exceeded. Direct PvP and spectation foundations are now formally credited here. Owner is still testing features; no formal PV-1 PASS is inferred. |
| **Phase 3 — Signature Buildcraft Foundation** | 🔜 **Next major implementation phase after Phase-2 exit** | Primary/Secondary, Skills, cooldowns, Resonance, Essence, loadouts and build-authority expansion. |
| **Phase 4+** | 🔜 Planned with some early-delivered foundations | Later phases inherit existing infrastructure rather than starting from zero. |

## Current decision boundary

AUREVANE is currently at the **Phase-2 stabilization / validation boundary**.

The project is allowed to:

- continue Owner testing of the current battle, PvP, spectator, profile, training and related player-facing features;
- fix genuine regressions, authority defects, usability problems and contained presentation issues discovered during that testing;
- finish already-authorized coherent battle-platform correction/polish work;
- reconcile documentation and tests to the actual current product.

The project should **not** use the remaining Phase-2 validation window as permission to begin uncontrolled Phase-3/4 feature expansion.

The next major feature layer is Phase 3 only after the current combat/battle platform is stable enough for an explicit Phase-2/PV-1 decision.

## Phase-2 exit decision

Phase 2 is formally closed when:

- the current representative combat/battle-platform candidate is stable;
- no known high-severity authority or usability defect makes the combat proof invalid;
- Owner testing has completed the current correction cycle;
- the real PV-1 human/internal evidence is reviewed;
- players can understand the baseline battle without facilitator dependence;
- tactical decisions, positioning and outcome reasoning are more salient than interface confusion;
- repeat-play desire is sufficient to justify multiplying combat/build content;
- the result is explicitly recorded as PASS rather than inferred from automation.

A FAIL does not reopen the whole roadmap. It creates the smallest coherent correction ticket around the repeated failure and then reruns the affected evidence slice.

---

# 3. Canonical current terminology and combat rules

## Build-system vocabulary

Use current player-facing terms:

- **Primary Discipline** — principal active combat tradition and source of the active Discipline base-stat profile.
- **Secondary Discipline** — optional mastered Discipline mixed into the active build; it contributes no second base-stat profile.
- **Skill** — player-facing umbrella term for usable combat abilities.
- **Resonance** — passive interaction produced by an eligible Primary + Secondary pairing.
- **Essence / Discipline Essence** — pure-Discipline counterpart to Resonance; Primary-only builds gain one special Essence Skill outside the normal Discipline Skill capacity.
- **Soulmark** — persistent supernatural identity for the Soulmarked path.
- **The Severance / Soul-Severed** — permanent alternative supernatural path.
- **Mantle** — temporary manifested transformation available to eligible Soul-Severed characters.
- **Battle Hall** — current player-facing battle/practice destination.
- **Passive Training** — current explicit server-timed background progression system.

Retired player-facing terms include Current Discipline, Legacy Discipline, Art as the generic ability term, Confluence, separate Trait/Reaction/Movement Art/Ultimate slot systems, and Tactical Hall as the current player-facing practice name. Historical documents may retain old terminology only when clearly historical.

The mature build contract remains:

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

## Universal attributes

AUREVANE uses six universal player-assigned attributes:

- Might;
- Finesse;
- Vitality;
- Agility;
- Intellect;
- Resolve.

Primary Discipline supplies its own base Discipline stat profile. Player-assigned attribute investment remains separate. Secondary Discipline supplies no second base profile.

## Current combat authority

`docs/COMBAT.md` is the canonical current combat source of truth.

The former Phase-2 validation model of **Movement Budget + one Action** is superseded. Current combat uses one shared **Action Economy**, displayed as AP, normally beginning at 100 AP.

Current implemented baseline costs are:

```text
Inspect                         0 AP
Move, normal traversal point   25 AP
Move, terrain cost 2           50 AP
Basic Attack                   30 AP
Guard                          30 AP
Recover                        50 AP
Final Facing                    0 AP and ends the turn
```

Multiple legal commands may occur while AP remains. Do not restore the obsolete one-action-per-turn model merely because older Phase-2 ticket history contains it.

---

# 4. Cross-cutting product rules

## Permanent character inside a living world

AUREVANE's personal hook is the permanent character: mastering Disciplines, choosing a Primary, deciding whether to remain pure or mix in a mastered Secondary, discovering Resonance or building around Essence, developing a supernatural identity, refining equipment/Skill choices, and accumulating history across a living shared world.

The world should continuously create reasons to use and rethink that character through story developments, world events, cooperative objectives, PvP rotations, Expeditions, guild/nation activity, economy participation and live operations.

## Long-horizon progression

The approximately **180-day / six-calendar-month** first-cycle target remains the current production planning default for full first-Horizon/Rekindling eligibility, subject to the evidence/change-control rules in the canonical pacing documents.

This must be months of meaningful progression rather than months of waiting. Serious combat, story, PvP, Expeditions, buildcraft and advanced equipment must matter well before final Rekindling eligibility when gameplay progression supports them.

## Experiential urgency / FOMO

AUREVANE may create the feeling **“I want to be there while this is happening”** through live events, seasons, first-witness recognition, rotating encounters/merchants/modifiers, Chronicle history and limited-time prestige/cosmetic rewards.

Do not create destructive daily streaks, mandatory energy chores, pay-to-avoid-loss mechanics, or one-time exclusive meta-defining combat power.

## Passive Training

Passive Training remains an optional server-timed background progression system. Browser clocks, logout state and client-submitted elapsed time are never authority.

The exact current stop/reward semantics are governed by the canonical Passive Training specification and any explicit Owner-approved reconciliation. If tested runtime behavior and the canonical document disagree, reconcile that contradiction before treating either as a permanent roadmap rule.

Passive Training must remain weaker than engaged play and must never complete meaningful story/boss/Expedition/PvP/Resonance/Essence/Soulmark/Mantle/Horizon/economy/endgame accomplishments on the player's behalf.

## Progressive operations

The complete Master Panel remains a later phase, but every major system should ship with the minimum safe operational controls required to run it. Owner/staff authority, auditability, versioning, rollback, configuration and support surfaces grow progressively rather than appearing for the first time at the end.

---

# 5. PHASES

## ✅ Phase 0 — Engineering Foundation

### Goal

Establish a production-grade project skeleton before game mechanics multiply.

### Delivered foundation

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

### Remaining work

No large Phase-0 feature backlog. Engineering/security/performance improvements continue inside the phases that need them and culminate in Phase 15 hardening.

### Gate

Clean build, automated checks, deployable environments, documented setup and production-style infrastructure.

### Status

**Substantially complete.**

---

## ✅ Phase 1 — Character & Progression Foundation

### Goal

Create a persistent authoritative character/account/progression base that every later build, world and social system can safely extend.

### Delivered foundation

- account/profile flow and verified-auth boundary;
- three-character roster foundation;
- character creation;
- six attributes and derived-stat framework;
- versioned Character XP / Level 1–100 boundaries;
- Character Profile/build-headquarters foundation;
- starting Foundation Discipline choice;
- Discipline/Mastery data boundaries;
- Primary Discipline foundation;
- character/account switching controls and authoritative cooldown boundaries;
- profile portrait/title/presence quality-of-life;
- Online Users foundation;
- initial item-definition / ownership / equipment boundaries;
- core equipment slots;
- foundational equip/unequip commands;
- initial Armory/build presentation boundaries;
- Passive Training / Training Report authority, idempotency and telemetry foundations;
- public News / Manual / Rules foundation.

### Remaining work

Most progression depth intentionally belongs to Phase 3+:

- mature Discipline Mastery;
- Secondary Discipline;
- Skills/cooldowns;
- Resonance/Essence;
- full loadouts;
- supernatural identity;
- Horizons/Rekindling;
- mature equipment/economy progression.

### Gate

A player can create, persist, return to and safely progress a valid character; foundational equipment/progression authority is server-owned and extensible.

### Status

**Substantially complete and iterated through Owner/player feedback.**

---

## 🧪 Phase 2 — Tactical Combat & Battle Platform

### Goal

Prove a readable, deterministic, server-authoritative tactical combat game and a reusable battle platform strong enough to support AI, direct multiplayer combat and read-only spectation before buildcraft/content volume multiplies.

This phase now **formally includes the deliberate above-and-beyond battle-platform work already delivered**. That scope is no longer treated as accidental or ignored merely because older roadmap versions scheduled all PvP/spectation later.

### A. Tactical combat core — delivered

- deterministic battle state and rule/content versions;
- authoritative RNG where required;
- tactical grid/board;
- round/turn lifecycle;
- 100-AP shared Action Economy;
- movement/path legality;
- terrain/elevation/facing;
- legal targeting/range/occupancy/LOS where current content requires it;
- Basic Attack;
- Guard;
- Recover;
- HP/MP/resources;
- typed Target / Requirement / Effect foundations;
- initial statuses and deterministic effect ordering;
- server-authoritative intent + expected-version command flow;
- reconnect-safe persistence and idempotency;
- board-first responsive battle UI;
- legal/illegal previews and forecasts;
- combatant rails / status / facing / initiative presentation;
- shared streamlined battle logs;
- combat VFX/audio hooks;
- desktop/laptop/mobile/touch behavior;
- remappable combat keybind foundations;
- safe surrender/abort/terminal-result foundations;
- representative larger battlefield proof beyond the original micro training board.

### B. AI / Battle Hall — delivered foundation

- deterministic legal Recruit AI;
- same-legality player/AI rule usage;
- bounded decision making and fairness/knowledge boundary;
- Battle Hall;
- AI Sparring;
- guided/focused fundamentals;
- repeatable practice and no-normal-progression-farm boundary;
- retry/recovery and battle-result presentation;
- AI/battle regression coverage.

### C. Direct PvP battle platform — delivered early and now credited to Phase 2

The project already has meaningful direct multiplayer battle infrastructure, including:

- server-authoritative PvP lobbies;
- participant mapping/authority;
- lobby keys;
- shared persisted PvP battle sessions;
- multiple selectable formats currently supporting 1v1, 2v2, 3v3, three-way and flexible-team variants;
- configurable battle setup parameters already implemented in the current battle-platform slice;
- server-authoritative PvP turn timing foundations;
- surrender/forfeit foundations;
- battle-state handoff/reconnect/polling hardening;
- shared PvP combat presentation across desktop/mobile;
- active-session mutation/navigation protections;
- PvP battle chat / communication foundation;
- participant identity/title presentation;
- multi-combatant presentation work suitable for up to six combatants in the current tested interface direction.

This does **not** mean mature competitive PvP is complete. Ranked systems, matchmaking, population safety, seasons, tournaments and competitive build legality remain Phase 8.

### D. Spectation — delivered early foundation and now credited to Phase 2

Current reusable foundation includes:

- keyed read-only spectation;
- server-authoritative spectator join/leave boundary;
- spectator presence/roster/count;
- read-only committed battle projection;
- shared spectator battle log;
- spectator chat/communications foundation;
- responsive spectator battlefield presentation;
- spectator combatant/terrain Inspect foundation;
- no participant mutation controls for spectators;
- active-spectation gameplay-mutation/navigation protections;
- spectator authorization/security regression coverage.

Mature public discovery, visibility policy, competitive delay, Colosseum listings, tournament integration and large-scale fanout remain Phase 8+.

### E. Current testing / stabilization scope

The Owner is still testing selected player-facing features. Therefore Phase 2 remains intentionally open for **contained correction**, including:

- battle readability and scale;
- multi-combatant rails/inspection;
- PvP turn handoff;
- mobile and desktop parity;
- spectator clarity;
- battle log quality;
- timing/communication regressions;
- profile/training/session interactions that materially affect the current test flow;
- defects discovered in real usage.

Testing feedback may produce one coherent correction batch at a time. It does not authorize uncontrolled new content systems.

### Explicitly not required to close Phase 2

Do **not** wait for:

- mature Discipline Skill libraries;
- Secondary Discipline buildcraft;
- Resonance/Essence;
- Soulmark/Mantle catalogs;
- ranked matchmaking;
- seasons/tournaments;
- Colosseum public discovery;
- world/quest content;
- co-op Expeditions;
- full Master Panel editors;
- production-complete art/audio.

### Phase-2 gate

A representative player can complete and understand the baseline tactical game; positioning and decisions matter; AI obeys the same legality; battle authority/reconnect/retry behavior is safe; the current direct-PvP/spectator platform is stable enough not to undermine testing; and actual human evidence shows the core fight is understandable and sufficiently enjoyable to justify multiplying build/content complexity.

### Status

**Implementation mature and substantially beyond the original minimum. Owner testing and formal PV-1 validation remain open.**

---

## 🔜 Phase 3 — Signature Buildcraft Foundation

### Goal

Turn the proven battle platform into the distinctive AUREVANE character-build game.

This is the **next major feature phase after Phase 2 exits**.

### Scope

#### Discipline identity

- versioned Primary Discipline base-stat profiles;
- optional mastered Secondary Discipline;
- authoritative Primary/Secondary selection legality;
- independent server-owned Primary and Secondary attunement cooldowns;
- clear before/after stat/build preview;
- no loss/duplication of player-assigned attributes when Primary changes.

#### Skill framework

- mature typed Discipline Skill schema;
- stable Skill IDs and versions;
- exactly eight learnable Skills per mature Discipline target;
- AE/AP cost integration through the canonical combat economy;
- target/requirement/effect integration;
- server-authoritative cooldown engine;
- source labeling;
- AI legality/valuation metadata;
- PvE/PvP override hooks;
- media hooks.

#### Pure versus mixed builds

- Primary-only capacity: up to 8 Discipline Skills;
- mixed Primary + Secondary capacity: 6 total Discipline Skills across the pair;
- authoritative loadout validation;
- source/readability presentation in Profile and battle.

#### Resonance and Essence

- first Resonance framework/library for mixed builds;
- first pure-Discipline Essence framework/Skills;
- typed combo/sequence interactions;
- testable balance between pure and mixed identity.

#### Character Profile build headquarters

- Attributes;
- Disciplines;
- Skills;
- Resonance/Essence;
- Equipment;
- saved loadout foundation;
- future Supernatural/Prestige slots prepared without prematurely implementing their catalogs.

#### Integration

- Equipment Skill compatibility where current item foundations allow it;
- AI understanding of released Skills/cooldowns/build state;
- direct-PvP snapshot/legality compatibility using the already-built battle platform;
- first safe authoring/validation tooling required by the increased content volume;
- Passive Training Discipline Focus/Mastery extension only after active Mastery behavior is ready and proven.

### Gate

Players understand Primary versus Secondary, can configure legal Skills, understand cooldowns and source labels, and can make a meaningful **pure + Essence** versus **mixed + Resonance** choice that materially changes play without the Profile/build UI becoming a study exercise.

---

## 🔜 Phase 4 — First Playable Buildcraft Roster & Core Combat Content

### Goal

Prove that the Phase-3 system produces multiple genuinely different ways to play before scaling toward the mature roster.

### Staged roster rule

Do not jump blindly to 16.

```text
4 representative Disciplines
  ↓ buildcraft identity proof
6–8 Disciplines
  ↓ balance/content-production proof
12 Disciplines
  ↓ broader meta proof
16 Disciplines
  ↓ mature Closed Alpha target
```

### Scope

- representative advanced Disciplines plus Foundations;
- meaningful eight-Skill libraries at the maturity level required by each roster band;
- pure Essence coverage;
- relevant Resonance coverage;
- clear Mastery/acquisition rules;
- distinct tactical roles and counterplay;
- representative equipment/consumables that alter decisions rather than only coefficients;
- first deliberate stat-expression archetypes;
- equipment Load/Weight interactions where canonical dependencies are ready;
- varied battle scenes/maps testing range, movement, terrain, elevation, objectives and positioning;
- enemy-family archetypes;
- stronger Battle Hall records/AI profiles;
- first interaction/content-linting needed before combination count becomes difficult to reason about;
- representative VFX/SFX hooks and readable media requirements;
- PvE and direct-PvP regression coverage for released content.

### Gate

Multiple representative builds feel materially different, pure and mixed routes both have reasons to exist, gear changes decisions, maps create different tactical questions, AI uses released content coherently, and content production cost appears sustainable enough to expand.

---

## 🔜 Phase 5 — Living World, Story & Supernatural Identity Foundation

### Goal

Give the persistent character a real world, story and supernatural identity so combat/buildcraft has meaningful context and return reasons.

### World/story scope

- Atlas/world map;
- movement/presence;
- towns/settlements;
- location-coherent encounters;
- NPC/dialogue;
- quest engine;
- initial story arcs;
- layered global/region/node/player world state;
- world vendors / known acquisition links;
- battle-to-world reward/state return;
- World Pulse / since-you-were-away context;
- data-driven world events;
- event scheduling/worker transitions;
- announcements/world activity;
- story-arc hooks and versioned narrative content;
- Archive/lore-discovery foundation;
- protected Quest/Key Item rules;
- initial Horizon/world progression gates;
- safe owner/staff Event/Story/Lore operations slice.

### Supernatural identity scope

Implement the first story-appropriate proof of:

```text
UNAWAKENED
SOULMARKED
SOUL_SEVERED
```

Then prove a deliberately small, high-quality supernatural slice:

- first Soulmarks with meaningfully different package shapes;
- Soulmark branch/readability foundation;
- Soulmark Skills outside the Discipline Skill capacity where authored;
- irreversible/authoritative Severance state;
- first valid Mantle route so Soul-Severed characters are not stranded;
- manual Mantle manifestation, duration, temporary power/rules, temporary Skills where authored and Afterstrain;
- explicit server rejection of invalid Soulmark/Mantle ownership combinations.

### Gate

A character can explore, quest, fight in coherent world locations, discover lore, experience an operator-controlled scheduled world/story change, and understand the distinction between Resonance, Essence, Soulmark, Severance and Mantle.

---

## 🔜 Phase 6 — Party & Co-op Foundation

### Goal

Prove that the existing multiplayer battle platform can support cooperative ownership, teamwork and social grouping rather than only direct PvP.

### Scope

- parties;
- invites and availability;
- party realtime/fanout;
- party finder;
- cooperative battles using the authoritative battle platform;
- shared quests/objectives;
- each player controls only their own character;
- disconnect/rejoin ownership rules;
- public build summaries where appropriate;
- party-visible cooldown/readiness information only where legitimately useful;
- pings/action visibility;
- allied NPC AI where required;
- enemy-team coordination;
- multi-unit Battle Hall drills for legitimately unlocked profiles;
- co-op exit/retreat policy;
- typed cross-ally combo interactions where authored.

### Gate

Three people can form a party and complete a cooperative mission whose combat remains readable, responsive, fair and clearly owned, with no progression dependency on an unusable party finder.

---

## 🔜 Phase 7 — Expeditions, Boss PvE & Deep Build Interaction

### Goal

Use long-form PvE to prove build depth, cooperative play, boss intelligence and deterministic/reconnect-safe run state.

### Scope

- Expedition template engine;
- deterministic seeded generation;
- progressive reveal;
- Easy / Standard / Deep Expedition bands;
- Threat/modifiers;
- suspension/reconnect;
- multiphase bosses;
- personal loot/leaderboards;
- targeted item pools and approved bad-luck protection;
- deterministic inventory/run state;
- temporary rotations/anomalies;
- lore rooms/records/relics;
- richer objectives;
- environmental battle objects/terrain transformations;
- objective-aware AI and boss directors;
- telegraphed fair boss mechanics;
- tactical extraction rules;
- Expedition equipment Skills and build interactions;
- broader Mantle catalog progression toward the mature target where appropriate;
- spoiler-safe Battle Hall boss records only after legitimate discovery;
- long-run performance/reconnect/version/reward-duplication verification.

### Gate

A three-player roughly hour-scale Deep Expedition is memorable, resumable and tactically varied, with meaningful loot/build interaction, fair bosses and no reward duplication or soft locks.

---

## 🔜 Phase 8 — Competitive PvP, Colosseum, Seasons & Tournaments

### Goal

Mature the **already-built direct PvP/spectation foundation** into a sustainable competitive product layer.

This phase does **not** rebuild Phase-2 PvP. It audits and extends it.

### Already delivered and inherited

- direct PvP lobby/battle runtime;
- participant authority;
- multiple battle formats;
- PvP timing foundations;
- surrender foundation;
- Battle/Spectator Keys;
- read-only spectation;
- spectator presence/roster;
- battle-scoped communication;
- shared battle logs;
- responsive PvP/spectator presentation;
- significant PvP concurrency/polling/session hardening.

### Remaining mature competitive scope

- direct challenge policy refinement;
- formal casual queues;
- ranked 1v1;
- ranked 2v2 where population supports it;
- matchmaking/rating;
- queue abandonment/disconnect protections;
- Arena Tempering;
- versioned competitive rulesets;
- build snapshot/lock rules;
- Skill/Resonance/Essence/equipment/Soulmark/Mantle/Veteran Edge legality controls as those systems exist;
- CC/lockout safety;
- map/spawn/side-bias testing;
- competitive telemetry;
- seasons;
- tournament framework;
- queue population-safety rules;
- no undisclosed bots presented as human ranked opponents.

### Spectation / Colosseum maturity

- explicit PUBLIC / UNLISTED / PRIVATE_KEY / CLOSED visibility policy;
- shareable opaque spectator handles where appropriate;
- competitive spectator delay that cannot be bypassed by reconnect/replay paths;
- Colosseum public discovery;
- featured/live/tournament listings;
- privacy-safe Friends Fighting discovery later where appropriate;
- completed-match replay behavior;
- tournament bracket → battle integration;
- large-fanout/load verification;
- operational spectator controls.

### Gate

Competitive queues are fair, population-safe and readable; ranked results cannot be manipulated through disconnect/build/spectator loopholes; public/private visibility is correct; and the Colosseum creates social value without compromising competitors.

---

## 🔜 Phase 9 — Roster, Soulmark & Mantle Catalog Expansion

### Goal

Scale content only after the buildcraft and combat-production pipeline proves it can sustain the interaction cost.

### Scope

- expand toward all 36 Disciplines in controlled batches;
- eight high-quality Skills per mature Discipline;
- complete pure Essence coverage;
- complete required Resonance coverage across released pairs;
- mature Mastery/acquisition paths;
- broaden equipment interactions;
- broad Soulmark catalog growth in quality-driven stages;
- 1/2/3-branch Soulmark support where justified;
- six mature Mantles or explicit later-content deferral;
- AI usage rules and regression scenarios for released content;
- PvE/PvP tests;
- VFX/SFX/media requirements;
- interaction-graph/content-linting maturity;
- analytics and Master Panel authoring support.

### Gate

New roster/catalog additions continue creating real build diversity without collapsing content quality, balance, AI coverage, media production or testing throughput.

---

## 🔜 Phase 10 — Social World & Community

### Goal

Turn existing online presence and battle-scoped communication into durable player relationships and community systems.

### Already-delivered foundation inherited

- Online Users/presence foundation;
- battle participant/spectator chat foundation;
- public character identity/profile foundations;
- active-session awareness.

### Remaining scope

- friends;
- messages;
- guilds;
- guild progression/quests;
- social profiles;
- privacy/availability controls;
- block/mute/report;
- moderation/support tooling;
- repeat-group shortcuts;
- richer build-share cards where privacy permits;
- Chronicle/social recognition hooks;
- social spectation features where moderation is ready;
- prestige/Rekindling/Hall-of-Selves social presentation.

### Gate

Players can safely form repeat relationships and communities, communication has adequate moderation/privacy controls, and social systems support rather than obstruct combat/world play.

---

## 🔜 Phase 11 — Economy, Crafting & Trade

### Goal

Create a coherent player economy around authoritative items and build choice without turning inventory into friction or opening duplication/exploit paths.

### Scope

- mature stores/vendors;
- loot services;
- materials inventory;
- crafting professions;
- gathering professions;
- enchantment integration;
- marketplace / Trade House;
- binding/trading policies;
- safe bulk sell/salvage;
- tuned capacity/stack policies;
- overflow/recovery;
- item provenance/history;
- acquisition graph maturity;
- Equipment/Consumable Skill links;
- deterministic crafting/enchantment previews;
- economy/support tooling;
- source/sink/inflation/liquidity telemetry;
- Rekindling reset/preserve safeguards;
- recurring paths for important competitive build components;
- Passive Training and Battle Hall isolation from tradable/economic output.

### Gate

Acquisition, ownership, storage, equipment, crafting, trade and stores are coherent and server-authoritative with no duplication, key-item loss, ghost-equipped/listed items or inventory-management misery.

---

## 🔜 Phase 12 — Nations & Large-Group Identity

### Goal

Add political identity and large-group conflict only when the social/player population can support it.

### Scope

- allegiance;
- reputation;
- nation quests;
- campaigns;
- nation events;
- political rankings;
- PvE/PvP contribution paths;
- nation warfare only when population evidence supports it;
- nation/reputation item rewards using normal acquisition/effect definitions;
- nation-specific narrative interpretations of the central mythology;
- no essential competitive build permanently locked behind one political choice;
- arena/Colosseum presentation may vary by nation without fragmenting the underlying competitive population.

### Gate

Nation identity creates meaningful community/story value without dividing a small population into empty factions or creating mandatory political build power.

---

## 🔜 Phase 13 — Complete Master Panel & Long-Horizon Operations

### Goal

Consolidate progressively delivered owner/staff controls into the complete audited game operating system.

### Scope

- Owner Command Center;
- staff roles/permissions;
- player lookup and audited corrections;
- Discipline / Skill Studio;
- Resonance / Essence Studio;
- Soulmark / Mantle Studio;
- item/equipment/effect editors;
- quest/dialogue/story/Archive editors;
- world-event scheduler;
- Expedition editor;
- PvP/season/tournament/Colosseum operations;
- Audio Manager;
- Asset Studio;
- Balance Lab;
- Combat Content Studio;
- battle-log text/template authoring and safe presentation configuration;
- Item Studio / Effect Catalog;
- build/loadout/combat analytics;
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
- break-glass Owner recovery with re-authentication and immutable audit.

### Gate

Normal operation, authoring, balance, repair, simulation and delegation occur through validated audited tools rather than routine raw production access or ad-hoc code edits.

---

## 🔜 Phase 14 — Art, Audio & Production Presentation

### Goal

Bring the proven systems/content to production presentation quality without waiting until this phase to begin all media work.

### Early credit

Substantial combat UI/UX/presentation work has already occurred and is preserved. Phase 14 refines rather than discards good proven interaction patterns.

### Scope

- region/environment artwork;
- character/Discipline art;
- Soulmark/Mantle art;
- item icons/key art;
- Inventory/Profile/Armory polish;
- major reward presentation;
- soundtrack;
- ambience;
- SFX;
- transitions/particles/animations;
- responsive/mobile polish;
- loading/error states;
- battle-scene environments;
- terrain/elevation readability;
- Skill / Equipment Skill / Resonance / Essence / Soulmark / Mantle VFX identity;
- impact audio / footsteps / blocks / item-use / telegraph / objective cues;
- readable action-resolution timing;
- targeting/forecast/AP/timeline/log polish;
- spectator/Colosseum event presentation;
- reduced-motion / camera-shake / accessibility options;
- evolving Aurevane/Open Crown/Closed Star visual/audio language;
- Rekindling/Hall-of-Selves presentation;
- Archive/document/relic presentation;
- Passive Training presentation;
- Battle Hall / AI Sparring / Battle Review presentation.

### Gate

The representative product experience is visually/audibly coherent, responsive and readable enough for mature Closed Alpha rather than feeling like a functional prototype.

---

## 🔜 Phase 15 — Security, Scale, Exploit Hardening & Closed-Alpha Readiness

### Goal

Turn accumulated per-feature hardening into a deliberate whole-product launch-readiness program.

### Early credit

The project already performs substantial authority/security/database/browser/concurrency regression work throughout development. Preserve that work; Phase 15 broadens it across the complete system.

### Scope

- security/penetration review;
- abuse/rate-limit testing;
- privileged access / Owner break-glass review;
- audit-log integrity;
- SQL/index optimization;
- load testing;
- realtime/matchmaking/spectator fanout load;
- Expedition concurrency;
- economy exploit testing;
- inventory/equipment/listing concurrency;
- migration/version tests;
- reward/idempotency duplication tests;
- destructive inventory safety;
- overflow/recovery;
- loadout simultaneous-edit races;
- effect trigger/filter/order/recursion safety;
- marketplace/equip/listing races;
- PvP competitive regression;
- spectator hidden-info/delay/privacy regression;
- authoring permission/staging/diff/publish/rollback tests;
- live-event scheduling/recovery;
- spoiler/canon publication review;
- progression/Horizon boundaries;
- Passive Training server-time/idempotency/multi-character/economy isolation;
- movement/terrain/targeting/AP/cooldown/status/summon/objective property tests;
- battle version/race/replay/reconnect/timeout/disconnect abuse;
- map reachability/bias/performance/content-reference validation;
- AI legality/knowledge/determinism/load/pathfinding/fallback/boss-counterplay;
- Battle Hall unlock/spoiler/reward-isolation/reset/retry;
- Master Panel audit/version/rollback;
- human combat/build/world playtests across skill levels;
- Rekindling preserve/reset integrity;
- Veteran Edge competitive regression;
- event recurrence/catch-up;
- player correction/idempotency;
- closed-alpha operational runbooks.

### Gate

No known systemic exploit, authority flaw, scaling blocker, common soft lock or operational-recovery gap prevents controlled Closed Alpha.

---

# 6. First full endgame / Rekindling gate

Before Rekindling becomes a normal production feature, validate:

- complete first-cycle eligibility respects the configured long-horizon minimum plus required gameplay milestones;
- levels 1–100 and build progression remain rewarding;
- equipment/item discovery continues creating options rather than pure replacement churn;
- returning-player support helps recovery without bypassing accomplishment;
- Passive Training remains a modest contributor;
- Battle Hall does not become an economy/progression shortcut;
- enough PvE/PvP/world/story/lore exists that the journey is not filler;
- combat continues introducing meaningful tactical questions;
- the endgame rite is a genuine mastery challenge;
- Rekindling preserves identity/history while resetting enough progression to make rebuilding meaningful;
- Veteran Edge has telemetry, tests, kill switches, queue rules and Master Panel controls before ranked use.

---

# 7. Mature Closed Alpha target

Closed Alpha is a **quality/content gate, not a date promise**.

Target shape remains approximately:

- 16 playable Disciplines;
- meaningful mature Skill libraries for the Alpha roster;
- meaningful Resonance coverage;
- pure-Discipline Essence coverage;
- 8 representative Soulmarks;
- at least one valid Soul-Severed/Mantle path with broader Mantle progression appropriate to the milestone;
- 4 world regions;
- 20–30 enemies;
- 4–6 bosses;
- 50+ authored-role items;
- Equipment / Consumables / Materials / protected Quest-Key boundaries;
- stable item-definition / owned-item model;
- polished equipment/build-management experience;
- saved combat loadouts;
- representative non-damage equipment/consumables;
- known acquisition / target-farming foundation;
- 20+ quests;
- Easy Expedition;
- Standard Expedition;
- 1 Deep Expedition;
- direct/casual PvP foundation retained from Phase 2;
- 1v1 and 2v2 competitive forms ready where population/rules allow;
- Guild foundation;
- server-authoritative readable AP combat;
- representative targeting/requirement/effect grammar;
- meaningful terrain/elevation/facing/status/Skill/item interactions;
- world-linked authored battle scenes;
- Primary/Secondary + Resonance/Essence build rules;
- Discipline Mastery / Skill acquisition foundation;
- reliable shared combat AI with representative profiles;
- distinct enemy-family archetypes;
- competent squad AI where fiction requires it;
- fair learnable boss AI;
- Battle Hall with AI Sparring, progression-gated practice and Battle Review foundation;
- spectator foundation retained and hardened from Phase 2, with mature privacy/competitive rules as required;
- continuing world-event/story capability;
- World Pulse foundation;
- Archive/lore discovery foundation;
- owner + delegated staff permission foundation;
- usable Event/Story/Lore operations tooling;
- safe content validation/preview controls;
- auditability and rollback;
- Master Panel core;
- full audio coverage for the Alpha experience;
- strong visual presentation;
- coherent early Aurevane mystery and foreshadowing;
- telemetry sufficient to begin calibrating long-horizon pacing.

Closed Alpha itself does not need to run for six months before individual systems can be tested.

---

# 8. Immediate execution sequence from the current state

```text
CURRENT OWNER TESTING / FEATURE STABILIZATION
  ↓
Finish only the coherent battle-platform fixes already justified by testing
  ↓
Freeze a representative Phase-2 candidate
  ↓
Run/complete real PV-1 human/internal validation
  ↓
Explicit Phase-2 decision
  ├── FAIL → smallest repeated combat/usability correction → retest
  └── PASS
        ↓
PHASE 3 — SIGNATURE BUILDCRAFT FOUNDATION
        ↓
Primary/Secondary + Skills + cooldowns
        ↓
Resonance / Essence + Profile build headquarters
        ↓
PV-2 buildcraft identity proof
        ↓
PHASE 4 staged playable roster/content expansion
        ↓
PHASE 5 living world/story/supernatural identity
        ↓
PHASE 6 co-op
        ↓
PHASE 7 Expeditions/boss PvE
        ↓
PHASE 8 mature competitive PvP/Colosseum using the Phase-2 foundation
        ↓
PHASE 9+ catalog/social/economy/nations/operations/polish/hardening
```

The immediate planning principle is therefore:

> **Finish testing what we already built, prove the combat/battle platform, then invest the next major development effort in AUREVANE's signature buildcraft—not in more unrelated Phase-2 breadth.**

---

# 9. Phase-boundary reconciliation rule

Before opening the first substantial ticket of a new phase:

1. inspect current `main` and recent merged implementation;
2. reconcile `TASKS.md`;
3. reconcile the current phase ticket/history document;
4. confirm the canonical domain docs use current terminology/rules;
5. list early-delivered capability that the new phase inherits;
6. identify only genuine remaining gaps;
7. confirm the required prior human/product gate has actually passed;
8. open one coherent implementation ticket.

Historical phase-ticket documents may preserve how the system was originally built, but they must not override newer canonical rules such as the current 100-AP Action Economy.

---

# 10. Ticket rule

Every implementation ticket must state:

- purpose;
- exact scope;
- files/modules affected;
- implementation approach;
- automated tests;
- acceptance criteria;
- manual/Owner verification;
- dependencies;
- early-delivered systems reused;
- explicit later systems left out of scope.

Build-system tickets must use Primary / Secondary / Skill / Resonance / Essence terminology and identify source systems/loadout capacity.

Combat tickets must follow the current `docs/COMBAT.md` Action Economy and identify the approved combat-grammar portion they change.

Item/inventory/loadout tickets must identify item classes, effect primitives, loadout fields and economy links in scope.

PvP tickets must distinguish **direct battle-platform functionality already delivered** from **mature competitive systems still being implemented**.

Only the assigned ticket is implemented unless the Owner explicitly authorizes a broader verified release batch.
