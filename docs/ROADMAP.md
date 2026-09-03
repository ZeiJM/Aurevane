# AUREVANE — Implementation Roadmap

**Authority:** Derived from `docs/GAME_MASTER_PLAN.md` and Owner-approved domain specifications. If conflict exists, the Master Game Plan and applicable canonical domain specification win.

**Synchronized:** 2026-09-03

This roadmap reflects the game that actually exists today. It formally credits early-delivered battle-platform work instead of pretending later phases must rebuild it.

A phase is a **development milestone**, not a calendar promise.

---

# 1. How to read status

- **Implemented** — capability exists at the required authority boundary.
- **Verified** — applicable automated/database/browser checks pass.
- **Owner testing / stabilization** — the Owner is actively testing player-facing behavior and contained fixes may still occur.
- **Validated / phase gate passed** — required human/product evidence has been reviewed and the next expensive layer may begin.

Automation does not equal human validation. Production deployment does not prove fun, clarity or balance.

## Early-delivered scope rule

If a later-phase capability is deliberately built early and remains reusable:

1. give it roadmap credit;
2. preserve compatible foundations;
3. audit it when the mature phase arrives;
4. close only real gaps;
5. do not rebuild it merely because an older plan scheduled it later.

This already applies to direct PvP, multi-combatant battles, spectation, battle communication, battle logs and responsive combat presentation delivered during Phase 2.

## Continuous performance/scaling rule

Performance and scaling are a **cross-cutting roadmap responsibility**, not work deferred only to Phase 15.

`docs/ROADMAP_PERFORMANCE_SCALING.md` is the detailed companion for behavior-preserving performance work. Its checkpoints must be run automatically at the roadmap boundaries defined below.

Performance work never authorizes a gameplay redesign, weakened server authority, weakened security, altered timers/rewards/progression, or speculative infrastructure complexity. Optimize only measured bottlenecks and preserve current game behavior unless a separate Owner-approved design explicitly changes it.

---

# 2. Current operating state

| Phase | Status | Interpretation |
|---|---|---|
| Phase 0 — Engineering Foundation | ✅ Substantially complete | Core technical/security/deployment foundations exist. |
| Phase 1 — Character & Progression Foundation | ✅ Substantially complete | Character/account/profile/progression/equipment foundations exist. |
| Phase 2 — Tactical Combat & Battle Platform | ✅ Closed / PV-1 passed | Mature combat, AI, direct PvP and spectation foundations are preserved for reuse. |
| Phase 3 — Signature Buildcraft Foundation | 🛠️ Active — P3.3 | P3.1 and P3.2 are validated stacked dependencies; P3.3 is the current implementation/validation ticket. |
| Phase 4+ | 🔜 Planned | Later phases inherit compatible early work rather than restarting. |

## Current decision boundary

AUREVANE is now in **Phase 3 — Signature Buildcraft Foundation**. Phase 2 is formally closed and its battle platform is a preserved dependency, not active redesign scope.

Active now:

- execute one canonical Phase-3 ticket at a time from `docs/PHASE_3_TICKETS.md`;
- preserve the validated P3.1 Discipline build authority + Primary profiles and P3.2 Secondary + independent attunement dependencies, then execute P3.3 mature Skill schema + generic cooldown authority;
- reuse compatible Phase-1 character/profile foundations and the mature Phase-2 battle platform;
- run behavior-preserving performance/security checks at the Phase-3 build-state boundaries.

Not allowed by default:

- reopening or redesigning Phase-2 systems without a genuine regression;
- pulling P3.4+ or Phase-4+ content into P3.3 without a tightly coupled prerequisite;
- Vercel deployment unless separately authorized by the Owner.

## Automatic performance/scaling checkpoints

Run a performance checkpoint automatically when any of these boundaries is reached:

1. the completed Phase-2 stabilization/PV-1 exit review, retained as the comparison baseline;
2. every phase boundary that materially changes persistent state, request volume, concurrency, realtime traffic or data growth;
3. before and after major multiplayer/social/economy scale steps, especially Phase 3 build snapshots, Phase 4 content expansion, Phase 6 co-op, Phase 7 Expeditions, Phase 8 competitive PvP, Phase 10 social systems and Phase 11 economy/trade;
4. whenever monitoring shows a sustained regression in latency, errors, connections/pool pressure, CPU, memory, disk I/O, network, rollback/deadlock/lock-wait trends or database growth;
5. Phase 15 full security/scale/exploit hardening before Closed Alpha readiness.

Each automatic checkpoint should:

- inspect current repository/runtime truth first;
- baseline Supabase and Vercel health;
- rerun Supabase performance/security advisors;
- inspect request/RPC volume and p50/p95/p99 latency where available;
- inspect duplicate/overlapping/in-flight reads before changing polling intervals;
- inspect connections/pool pressure, locks/deadlocks, rollback/commit trends, CPU, memory, I/O, network/WAL and table growth where relevant;
- apply only the smallest measured, behavior-preserving improvement;
- rerun the applicable database/automated/browser/human validation flow;
- stop when evidence no longer justifies added complexity.

Current Phase-2 performance credit as of 2026-08-26:

- Supabase baseline indicates healthy resource headroom and fast ordinary gameplay reads;
- authoritative combat mutation already preserves idempotency, expected-version checks and row locking;
- added the missing FK-supporting indexes for `app_private.pvp_lobby_members(user_id)` and `app_private.product_validation_events(character_id)`;
- the Supabase performance advisor no longer reports those unindexed foreign keys;
- polling/request-shape, historical rollback explanation and combat-write tail latency remain diagnosis/measurement items before any broader runtime optimization.

## Phase-2 exit — completed 2026-09-03

Phase 2 is formally closed. PV-1 reconciliation, repository cleanup, the performance/security checkpoint and the Phase-3 handoff were completed on `main` at `20ed23527695f5320345428587472be7248e7ac7`.

Phase 3 therefore inherits the existing combat/PvP/spectator platform. Phase activation still does **not** authorize a Vercel deployment.

---

# 3. Canonical build and combat direction

## Current build vocabulary

- **Primary Discipline** — principal active combat tradition and active Discipline base-stat profile.
- **Secondary Discipline** — optional mastered Discipline mixed into the build; contributes no second base profile.
- **Skill** — umbrella term for usable abilities.
- **Resonance** — passive interaction from an eligible Primary + Secondary pair.
- **Essence / Discipline Essence** — pure-build counterpart; a Primary-only build gains a special Essence Skill outside normal Discipline capacity.
- **Soulmark** — persistent supernatural identity on the Soulmarked branch.
- **The Severance / Soul-Severed** — permanent alternative supernatural branch.
- **Mantle** — temporary manifested transformation available to eligible Soul-Severed characters.
- **Battle Hall** — current player-facing practice destination.
- **Passive Training** — explicit server-timed background progression.

Retired player-facing terminology includes Current Discipline, Legacy Discipline, Art as the generic ability term, Confluence, separate Trait/Reaction/Movement Art/Ultimate slot systems and Tactical Hall.

## Mature normal build contract

```text
CHARACTER ATTRIBUTES
+
PRIMARY DISCIPLINE
+
OPTIONAL SECONDARY DISCIPLINE
+
DISCIPLINE SKILLS
+
RESONANCE OR PURE ESSENCE
+
SOULMARK OR SOUL-SEVERED / MANTLE
+
EQUIPMENT + EQUIPMENT SKILLS
+
BOUNDED PRESTIGE / VETERAN EDGE
```

Pure:

```text
Primary only
8 Discipline Skills
+ 1 Essence Skill
+ no Resonance
```

Mixed:

```text
Primary + mastered Secondary
6 total Discipline Skills across the pair
+ Resonance passive
+ no Essence while Secondary is equipped
```

## Universal attributes

- Might
- Finesse
- Vitality
- Agility
- Intellect
- Resolve

Primary supplies a base Discipline profile. Player-assigned attributes remain separately owned. Secondary contributes no second base profile.

## Current combat authority

`docs/COMBAT.md` is definitive.

Current combat uses one shared **Action Economy**, displayed as AP, normally 100 AP at turn start.

Current implemented baseline:

```text
Inspect                         0 AP
Move, normal traversal point   25 AP
Move, terrain cost 2           50 AP
Basic Attack                   30 AP
Guard                          30 AP
Recover                        50 AP
Final Facing                    0 AP and ends turn
```

The old Movement Budget + one Action model is retired.

---

# 4. Special long-horizon systems

## Rekindling

Rekindling is AUREVANE's prestige system, but later cycles must not be an identical level-1-to-100 replay.

The approved direction in `docs/REKINDLING_FRONTIER.md` uses:

- Memory Carryover;
- **Echo Routes** influenced by prior history;
- alternate mentors/challenges/routes;
- abbreviated already-mastered tutorials;
- history-aware NPC interactions;
- Hall of Selves;
- different build/progression questions;
- evolving frontier relationships.

Later cycles should be **different and more self-directed**, not merely faster.

## The Unwritten Reach / Edge of the World

The known authored world eventually gives way to unstable frontier geography.

Core concepts:

- common phrase: **Edge of the World**;
- working canonical term: **The Unwritten Reach**;
- persistent authored **Anchors**;
- mutable deterministic connective **Driftspace**;
- server-seeded **Cartographic Drift**;
- **Frontier Acumen** as demonstrated knowledge rather than a generic XP bar;
- famous explorer/Chronicle identity;
- working far-inhabitant culture: **the Veyr**;
- long-term continuity threat: **the Inward Drift**.

The frontier should feel near-infinite without technically generating an uncontrolled infinite world.

## Anomalies — corrected canonical meaning

`docs/ANOMALIES.md` is authoritative.

An **Anomaly** is **not** frontier loot, a hidden quest reward, contraband, a rare class, a random rarity tier or something players grind toward.

An Anomaly is a protected **Owner-granted exceptional character state** that deliberately breaks normal supernatural exclusivity.

Initial forms:

```text
Soulmark + Mantle
Two Soulmarks
Two Mantles
```

Only the protected Owner may create/revoke these states through an audited Master Panel / Owner Override workflow by default.

Normal players continue to obey the ordinary Soulmarked versus Soul-Severed/Mantle rules.

Gameplay-affecting Anomalies are excluded from standard ranked PvP by default and must be identifiable in audit/analytics.

The Unwritten Reach is **not** their acquisition source.

---

# 5. PHASES

## ✅ Phase 0 — Engineering Foundation

**Goal:** production-grade technical foundation.

Delivered substantially:

- repository/document authority;
- Next.js/TypeScript application foundations;
- CI/test/typecheck/build baseline;
- environment separation;
- database/migrations;
- authentication/RLS/security boundaries;
- server-domain separation;
- transactions/idempotency;
- realtime/worker foundations;
- responsive design system/application shell;
- media/audio foundations;
- logging/error/security conventions;
- protected deployment controls.

**Status:** substantially complete.

---

## ✅ Phase 1 — Character & Progression Foundation

**Goal:** persistent authoritative character/account/progression base.

Delivered substantially:

- account/profile and verified-auth flow;
- three-character roster foundation;
- character creation;
- six attributes and derived stats;
- XP/level 1–100 boundaries;
- Character Profile foundation;
- starting Foundation Discipline;
- Discipline/Mastery boundaries;
- Primary Discipline foundation;
- switching/cooldown boundaries;
- portraits/titles/presence/Online Users;
- initial item/equipment ownership/equip boundaries;
- Armory presentation foundations;
- Passive Training / Training Report authority and telemetry;
- public News / Manual / Rules.

Later depth includes Secondary, mature Mastery, Skills, Resonance/Essence, supernatural identity, full loadouts, Horizons/Rekindling and mature equipment/economy progression.

**Status:** substantially complete.

---

## ✅ Phase 2 — Tactical Combat & Battle Platform

**Goal:** prove a readable deterministic server-authoritative tactical game and reusable battle platform before build/content volume multiplies.

### Tactical combat delivered

- deterministic/versioned battle state;
- 100-AP Action Economy;
- board/grid;
- movement/path/terrain/elevation/facing;
- Basic Attack / Guard / Recover;
- targeting/requirements/effects;
- statuses and deterministic ordering;
- authoritative intent + expected battle version;
- persistence/idempotency/concurrency safety;
- responsive board-first battle UI;
- previews/forecasts/Inspect;
- combatant rails/initiative/status presentation;
- shared streamlined battle logs;
- keybind/mobile foundations;
- larger-map/usability work;
- surrender/abort/results.

### AI / Battle Hall delivered

- deterministic legal Recruit AI;
- shared legality/fairness/knowledge boundaries;
- Battle Hall / AI Sparring;
- repeatable practice isolation;
- retry/recovery;
- AI/battle regression coverage.

### Direct PvP delivered early

- authoritative lobbies/participants;
- lobby keys;
- persisted shared PvP battles;
- multiple formats including 1v1, 2v2, 3v3, three-way and flexible teams;
- turn timing;
- surrender;
- reconnect/handoff/polling hardening;
- battle chat;
- desktop/mobile presentation;
- multi-combatant presentation;
- active-session safety.

### Spectation delivered early

- keyed read-only spectation;
- join/leave authorization;
- presence/roster/count;
- committed read-only projection;
- spectator logs/chat;
- responsive battlefield;
- Inspect;
- mutation/security protections.

### Performance hardening delivered during stabilization

- baseline Supabase resource/RPC diagnosis;
- verified separation of active game-session lease semantics from character presence;
- verified battle-write idempotency/version/row-lock protections;
- additive FK-supporting indexes for PvP lobby user lookups and product-validation character references;
- no speculative removal of unused indexes and no weakening of authoritative combat/session behavior.

### Closeout

Phase 2 is formally closed and PV-1 is reconciled. Genuine regressions may still be fixed, but the delivered combat/battle platform is not reopened for redesign by default.

Performance diagnosis continues only through the behavior-preserving checkpoint contract above.

**Status:** ✅ Closed; mature reusable platform for Phase 3.

---

## 🛠️ Phase 3 — Signature Buildcraft Foundation

**Goal:** turn the battle platform into AUREVANE's distinctive build game.

Exact execution is defined in `docs/PHASE_3_TICKETS.md`:

```text
P3.1 Discipline build authority + Primary profiles
P3.2 Secondary + independent attunement cooldowns
P3.3 Mature Skill schema + cooldown engine
P3.4 Profile Skill configuration + pure/mixed capacity
P3.5 Resonance framework + mixed proof
P3.6 Essence framework + pure proof
P3.7 Shared AI / PvP / saved-loadout snapshots
P3.8 Representative buildcraft slice + PV-2 readiness
```

Phase outcome:

- Primary base profiles;
- optional mastered Secondary;
- independent server-owned attunement cooldowns;
- mature Skill schema;
- generic cooldown system;
- pure 8 + Essence versus mixed 6 + Resonance;
- Profile as build headquarters;
- legal saved-loadout foundation;
- AI and existing PvP consuming the same build snapshots;
- first minimum safe authoring/validation tooling.

No Soulmark/Mantle or frontier implementation is required here.

**Current ticket:** P3.1 is implemented and validated in dependency PR #368 (`28c00c92f242b4344f8dae80ef8c32e05774a694`). P3.2 is the active ticket; P3.3 remains deferred until P3.2 closeout unless the Owner explicitly authorizes parallel work.

**Gate:** players understand and voluntarily experiment with Primary/Secondary, Skills, cooldowns and pure-vs-mixed identity.

---

## 🔜 Phase 4 — First Playable Buildcraft Roster & Core Combat Content

**Goal:** prove the Phase-3 grammar across genuinely different builds before roster scale.

Staged roster:

```text
4 representative Disciplines
→ 6–8
→ 12
→ 16 mature Closed Alpha target
```

Each expansion must justify:

- Skill quality;
- Essence coverage;
- Resonance coverage;
- Mastery/acquisition;
- tactical identity/counterplay;
- equipment interactions;
- AI behavior;
- PvE/PvP coverage;
- VFX/SFX/media cost;
- interaction/content linting.

**Gate:** multiple builds/routes/maps materially change strategy and content production remains sustainable.

---

## 🔜 Phase 5 — Living World, Story, Supernatural Identity & Frontier Threshold

**Goal:** make AUREVANE a living world and introduce the supernatural identity fork plus the first outer-world mystery.

Scope:

- strategic Atlas/world map;
- settlements/locations;
- NPC/dialogue;
- quests;
- layered world state;
- world events/World Pulse;
- Archive/Fragment Sets/lore provenance;
- protected key items;
- vendors/acquisition links where needed;
- location-coherent battle scenes;
- minimum Event/Story/Lore operations tooling;
- early Horizon/world gates.

### Supernatural fork

```text
UNAWAKENED
→ SOULMARKED
OR
→ SOUL_SEVERED
```

Ship a small high-quality Soulmark proof and at least one valid Mantle route so Severance has a meaningful payoff.

Normal characters obey strict branch exclusivity.

The data model should remain capable of safely representing future Owner-created Anomalies, but **normal gameplay does not grant them**.

### Frontier threshold

- known-world cartography fades into uncertain territory;
- deliberate crossing prompt;
- small outer-Reach vertical slice;
- first Anchor;
- first controlled Cartographic Drift proof;
- Field Observation → Archive integration;
- early evidence of far inhabitants.

**Gate:** players understand the living-world loop, supernatural fork and frontier mystery without confusion or procedural-filler feeling.

---

## 🔜 Phase 6 — Party & Co-op Foundation

**Goal:** reuse multiplayer battle technology for cooperative play.

Scope:

- parties/invites;
- availability/realtime;
- party finder;
- co-op battles;
- shared quests/objectives;
- each player owns only their character;
- reconnect/rejoin ownership;
- pings/action visibility;
- allied/enemy-team coordination;
- multi-unit Battle Hall where useful;
- frontier party entry/extraction/shared route state where useful.

The Reach retains meaningful solo content.

**Gate:** three players can complete a readable fair cooperative mission together.

---

## 🔜 Phase 7 — Expeditions, Boss PvE & Deep Frontier

**Goal:** stress buildcraft/co-op/AI/persistence through long-form PvE and deepen exploration.

Scope:

- deterministic seeded Expeditions;
- Easy / Standard / Deep;
- modifiers/threat;
- progressive reveal;
- suspension/reconnect;
- multiphase bosses;
- loot/anti-duplication/bad-luck protections;
- environmental battle objects/terrain transformation;
- objective/boss AI;
- long-run reliability.

Deep Reach expansion:

- Reach-discovered Expedition entrances;
- deeper drift states;
- stronger hazards;
- named phenomena;
- meaningful Frontier Acumen;
- first substantial Veyr interactions when story timing supports them;
- deep Anchor/boss interactions.

There is **no Anomaly acquisition loop** here.

**Gate:** a long Deep Expedition is memorable/resumable and frontier exploration creates comprehensible mystery rather than arbitrary randomness.

---

## 🟡 Phase 8 — Competitive PvP, Colosseum, Seasons & Tournaments

**Goal:** mature the existing direct PvP/spectator platform into a competitive product.

Inherited rather than rebuilt:

- direct lobbies/battle sessions;
- multiple formats;
- timing;
- surrender;
- spectation;
- battle communication/logs;
- multi-combatant presentation.

Remaining scope:

- casual/ranked queues;
- rating/matchmaking;
- queue population safety;
- Arena Tempering;
- disconnect/abandonment protection;
- seasons;
- tournaments;
- build snapshot/lock;
- Skill/Resonance/Essence/equipment/Soulmark/Mantle/Veteran Edge legality;
- map/side-bias testing;
- competitive telemetry;
- spectator visibility/delay;
- Colosseum public discovery;
- featured matches/replays where appropriate.

### Anomaly policy

Gameplay-affecting Owner-created Anomalies are **DISALLOWED in standard ranked PvP by default**.

Special modes may explicitly normalize or allow them under transparent rules.

---

## 🔜 Phase 9 — Roster, Soulmark, Mantle & Content Expansion

**Goal:** scale only systems already proven fun and sustainable.

- expand Disciplines in controlled batches toward the long-term roster;
- mature eight-Skill libraries;
- complete Essence/Resonance coverage;
- expand Soulmarks based on quality/data;
- progress toward six distinct Mantles;
- expand enemies/maps/equipment interactions;
- broaden AI/PvP regression coverage;
- scale Reach Anchors/phenomena only if exploration evidence supports it.

Anomalies remain Owner-created exceptional states, not a content catalog players farm.

---

## 🔵 Phase 10 — Social World & Explorer Identity

Existing foundations include profiles, presence, Online Users and battle-scoped communication.

Mature scope:

- friends;
- messages;
- guilds;
- guild quests/progression;
- social profiles;
- moderation/reporting;
- build sharing;
- Chronicle recognition;
- Hall of Selves/Rekindling presentation;
- public Frontier Ledger excerpts;
- route/map sharing where appropriate;
- guild frontier organization;
- first-discovery attribution and famous explorer identity.

---

## 🔜 Phase 11 — Economy, Crafting & Trade

Scope:

- mature stores/vendors/loot;
- materials;
- crafting/professions;
- enchantment where approved;
- Trade House;
- binding/trading;
- safe sell/salvage;
- capacity/overflow/recovery;
- item provenance;
- acquisition graph;
- economy telemetry/support tooling.

**Anomalies are not tradable commodities and are not part of the normal economy.**

---

## 🔜 Phase 12 — Nations & Large-Group Identity

Scope:

- allegiance/reputation;
- nation quests/events;
- campaigns;
- political rankings;
- warfare only when population supports it;
- PvE/PvP contribution paths.

Nations may interpret the Reach, Veyr and Great Vane mysteries differently.

Do not permanently lock essential competitive power behind one political choice.

Anomalies are not a nation acquisition system.

---

## 🔵 Phase 13 — Complete Master Panel & Long-Horizon Operations

Earlier phases ship minimum safe operational tools. Phase 13 consolidates the complete operating system.

Scope:

- Owner Command Center;
- staff roles/permissions;
- audited player correction;
- Discipline/Skill/Resonance/Essence/Soulmark/Mantle tools;
- item/effect/loot/economy tools;
- quest/dialogue/story/Archive tools;
- event scheduling;
- Expedition controls;
- PvP/season/tournament operations;
- Audio Manager / Asset Studio;
- Balance Lab;
- Combat Content Studio / AI Lab;
- Pacing Simulator;
- progression/Horizon/Passive Training/Rekindling/Veteran Edge controls;
- feature flags;
- staging/diff/history/rollback;
- canon/spoiler controls;
- break-glass recovery.

### Reach operations

- drift seeds/versions;
- Anchor authoring;
- route/frontier-state inspection;
- Reach events;
- Frontier Ledger/support inspection;
- generation simulation/validation.

### Owner-only Anomaly Console

Per `docs/ANOMALIES.md`:

- create Cross-Fork, Dual-Soulmark and Dual-Mantle exceptional states;
- select valid registered components;
- preview rules being bypassed;
- require Owner reason/re-authentication/confirmation;
- atomic grant/revoke/repair;
- immutable audit/provenance;
- visibility/PvP/analytics inspection;
- no ordinary staff access by default.

---

## 🔵 Phase 14 — Art, Audio & Production Presentation

Complete production-quality presentation across world, characters, Disciplines, Soulmarks, Mantles, items, battle environments, VFX, audio, transitions, responsive/mobile behavior, accessibility, Archive/Rekindling/Hall of Selves and spectator/competitive presentation.

### Reach identity

The Unwritten Reach needs a distinct language based on:

- uncertain distance;
- contradictory geography;
- familiar objects in impossible context;
- continuity errors;
- beauty mixed with unease;
- shifting but readable navigation cues.

Avoid generic purple-corruption/void-fog presentation.

---

## 🔵 Phase 15 — Security, Scale, Exploit Hardening & Closed-Alpha Readiness

Phase 15 is the **full hardening pass**, not the first time performance is considered. It consumes the baselines and incremental checkpoints accumulated throughout earlier phases.

Scope:

- security/penetration/abuse review;
- privileged access/audit integrity;
- database/index/realtime/load performance;
- combat/reward/idempotency races;
- PvP/loadout/economy exploits;
- migration/versioning;
- AI/property tests;
- authoring permissions/rollback;
- progression/Rekindling integrity;
- live-event recovery;
- human cross-skill playtests.

### Reach hardening

- deterministic drift reproduction;
- unreachable-layout rejection;
- route/version migration;
- reconnect/extraction;
- reward duplication/reroll abuse;
- spoiler leakage;
- community discovery load;
- generation performance.

### Anomaly hardening

- Owner-only authorization;
- re-authentication/audit integrity;
- atomic grant/revoke;
- duplicate/conflicting component handling;
- battle snapshot correctness;
- migration/content-version repair;
- standard-ranked exclusion;
- telemetry isolation;
- no client/support-staff privilege escalation.

---

# 6. Endgame / Rekindling maturity

Before Rekindling becomes a normal recurring loop, prove:

- the first character era is meaningful throughout its long progression;
- later cycles offer Echo Routes and self-directed choices rather than repeated chores;
- Memory Carryover creates strategy without trivializing the cycle;
- Hall of Selves preserves identity/history;
- Frontier history creates new questions without becoming the only reason to Rekindle;
- Veteran Edge remains bounded horizontal prestige rather than infinite raw-stat inflation.

The approximate **180-day** first-cycle planning default remains subject to validation and pacing evidence.

---

# 7. Immediate execution sequence

```text
PHASE 2 CLOSED / PV-1 RECONCILED
        ↓
PHASE 3 ACTIVE
        ↓
P3.1 Discipline build authority + Primary profiles
        ↓
P3.2–P3.8 in canonical ticket order
```

The immediate development priority is therefore:

> **Complete P3.1 on the preserved Phase-2 platform, then proceed one canonical Phase-3 ticket at a time.**

Automatic performance/scaling checkpoints continue at the defined future boundaries; they are maintenance/hardening work, not permission to expand feature scope.

The frontier, Rekindling replay systems and Owner-created Anomalies remain approved long-horizon direction, not active P3.1 scope.