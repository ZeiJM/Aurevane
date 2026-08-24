# AUREVANE — Canonical Implementation Roadmap

**Authority:** Derived from `docs/GAME_MASTER_PLAN.md` and Owner-approved canonical domain specifications/addenda. If a conflict exists, the Master Game Plan and applicable canonical domain specification win.

**Synchronized:** 2026-08-23

This roadmap reflects **what AUREVANE has actually built**, the current validation boundary, and the remaining development sequence. It deliberately credits compatible systems delivered earlier than originally planned.

A phase is a **development milestone**, not a calendar promise.

---

# 1. Roadmap status language

- **Implemented** — capability exists at the required authority boundary.
- **Verified** — applicable automated/database/browser/release checks have passed.
- **Owner testing / stabilization** — the Owner is actively testing player-facing behavior and may request contained fixes.
- **Validated / phase gate passed** — required human/product evidence has been reviewed and the project may expand into the next expensive layer.

Automated green tests or a production deployment never imply a human validation PASS.

## Early-delivered scope rule

If a later-phase capability is deliberately delivered early and proves reusable, it receives roadmap credit.

When the mature phase arrives:

1. audit the existing implementation;
2. preserve compatible working foundations;
3. build only the genuine gaps;
4. do not rebuild a system merely because an older roadmap originally placed it later.

This already applies to direct PvP, multi-combatant battle infrastructure, spectation, battle communications, battle logs and significant responsive battle-platform work delivered during the extended Phase-2 cycle.

---

# 2. Current project state

| Phase | Status | Meaning |
|---|---|---|
| **0 — Engineering Foundation** | ✅ Substantially complete | Core architecture/security/database/deployment foundations exist. |
| **1 — Character & Progression Foundation** | ✅ Substantially complete | Character/account/progression/profile/equipment/training foundations exist. |
| **2 — Tactical Combat & Battle Platform** | 🧪 **Implementation mature; Owner testing / PV-1 exit open** | Combat core plus major early PvP/spectation foundation is delivered. Testing is still active. |
| **3 — Signature Buildcraft Foundation** | 🔜 **Next major phase** | Starts only after explicit Phase-2 closure. |
| **4–15** | 🔜 Planned | Several phases inherit early foundations rather than starting from zero. |

## Current operating boundary

AUREVANE is at the **Phase-2 stabilization / validation boundary**.

Allowed now:

- Owner testing of existing battle/PvP/spectator/profile/training flows;
- contained bug, authority, usability and presentation corrections found during testing;
- documentation/test reconciliation;
- finishing already-authorized coherent battle-platform corrections.

Do not turn the testing window into uncontrolled Phase-3/4 expansion.

## Phase-2 exit

Phase 2 closes when:

- the representative battle-platform candidate is stable;
- no high-severity authority/usability defect invalidates the combat proof;
- the Owner finishes the current testing/correction cycle;
- required PV-1 human/internal evidence is reviewed;
- players understand the baseline fight without facilitator dependence;
- tactical choices dominate feedback more than interface confusion;
- replay desire is sufficient to justify build/content expansion;
- the decision is explicitly recorded.

If the Owner explicitly says wording equivalent to **“Phase 2 is done; code Phase 3”**, follow the transition protocol in `docs/PHASE_3_TICKETS.md`, reconcile repository truth, and start **P3.1**. Do not ask the Owner to restate the authorization merely because an old issue/document still says Phase 2 is open.

A Phase-3 coding authorization is **not** deployment authorization.

---

# 3. Canonical build/combat direction

Current player-facing terminology:

- Primary Discipline;
- optional mastered Secondary Discipline;
- Skill;
- Resonance;
- Essence / Discipline Essence;
- Soulmark;
- The Severance / Soul-Severed;
- Mantle;
- Battle Hall;
- Passive Training.

Retired current-facing terms include Current Discipline, Legacy Discipline, Art as the generic ability term, Confluence, separate Trait/Reaction/Movement Art/Ultimate loadout systems, and Tactical Hall.

## Mature build contract

```text
PLAYER-ASSIGNED ATTRIBUTES
+
PRIMARY DISCIPLINE BASE PROFILE
+
OPTIONAL MASTERED SECONDARY DISCIPLINE
+
DISCIPLINE SKILLS
+
PURE ESSENCE OR MIXED RESONANCE
+
SOULMARK OR SOUL-SEVERED MANTLE PATH
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
+ no pure Essence while Secondary is equipped
```

Universal attributes:

- Might;
- Finesse;
- Vitality;
- Agility;
- Intellect;
- Resolve.

`docs/COMBAT.md` governs current combat. The old Movement Budget + one Action model is historical. Current combat uses a shared 100-AP Action Economy unless explicitly superseded later.

---

# 4. Long-horizon product pillars

AUREVANE is built around a **permanent character inside a living world**.

The long-term journey combines:

- levels and Horizon progression;
- Discipline Mastery;
- Primary/Secondary experimentation;
- Resonance/Essence;
- supernatural identity;
- equipment refinement;
- world/story discovery;
- Expeditions;
- PvP;
- social history;
- Archive/lore reconstruction;
- Rekindling;
- frontier exploration.

The approximately **180-day / six-calendar-month** first-cycle target remains the current production planning default for full first-Horizon/Rekindling eligibility, subject to evidence-based tuning. This is not six months of waiting.

## Rekindling direction

Rekindling is AUREVANE's prestige system.

Later cycles must not feel like replaying the identical level/quest checklist with larger numbers.

Rekindling should create a **different journey** through:

- Memory Carryover;
- alternate progression routes;
- history-aware NPC/mentor interactions;
- optional **Echo Routes** created by prior-cycle achievements/knowledge;
- ability to abbreviate already-mastered tutorial content;
- different Discipline/build goals;
- live-world variation;
- Archive reinterpretation;
- frontier history and deeper exploration;
- new Veteran Edge choices;
- Hall of Selves history.

Later cycles remain meaningful long-form journeys, but should be more self-directed and less mentally repetitive.

## The Edge of the World / Unwritten Reach

The known authored world is surrounded by territory commonly called the **Edge of the World**.

Its canonical working lore/system name is **the Unwritten Reach**: geography destabilized by pressure from the Unchosen, where ordinary maps stop being reliable.

The Reach is designed to feel near-infinite without technically generating an unbounded world.

Core model:

- authored **Anchors** persist as real discoveries;
- mutable **Driftspace** changes routes and connective geography;
- deterministic server-seeded **Cartographic Drift** can re-resolve parts of the frontier, normally on a broad daily cadence;
- layouts/encounters/weather/hazards/lore traces can change under authored constraints;
- the same Anchor may remain known even when its route disappears;
- generation/versioning is reproducible for QA/support and protected against unreachable layouts/reward duplication.

The Reach connects directly to the Unchosen, Unmoored phenomena, Closed Horizon, Great Vanes and eventually deeper Heart-Lock mysteries. It is not a generic procedural wasteland.

## Frontier mastery

Working concept: **Frontier Acumen**.

Frontier expertise comes from proven discoveries/competencies rather than a simple grind bar.

It may reward:

- route knowledge;
- hazard prediction;
- recognition of false landmarks;
- better extraction options;
- additional frontier interactions;
- deeper access;
- specialist contacts;
- Chronicle/Archive recognition.

The veteran explorer should feel powerful because they **understand the Reach**, not because it grants a universal damage multiplier.

## Legendary explorer identity

Rare frontier achievements may make a character socially famous through:

- first Anchor discovery;
- exceptional mapping;
- surviving named phenomena;
- solving major cartographic mysteries;
- discovering Anomalies;
- Chronicle attribution;
- explorer epithets/titles;
- public map/Archive history;
- rare investigations and recognition.

Working umbrella language is **Horizon Legend**, but final titles should often be deed-specific rather than one generic rank.

## The Veyr — working far-inhabitant concept

The Reach can contain a supernatural culture/people under the working name **the Veyr**.

They are not a monolithic evil army.

Their continuity may differ from ordinary mortal history: contradictory ancestries, memories of incompatible pasts and survival practices developed for unstable reality.

They can include allies, guides, antagonists, scholars, zealots, traders and refugees.

Their thematic question is:

> Are they evidence of what happens when ordinary continuity fails, or evidence that another form of existence can survive beyond it?

Do not answer quickly.

## The Inward Drift

The looming frontier threat is not simply an army marching toward civilization.

**The Inward Drift** is Reach-like instability appearing progressively inside previously stable geography.

Examples:

- roads changing from official maps;
- incompatible ruins appearing together;
- people remembering someone who never existed;
- frontier creatures appearing impossibly far inland;
- Anchors forming inside known territory;
- objects with provenance from histories that never happened.

The fear becomes:

> The distinction between "out there" and "here" may be disappearing.

This can become a long-lived story/live-ops escalation tied to Aurevane and the weakening/interpretation of the Closed Horizon.

## Anomalies

**Anomaly** is a formal irregular-origin concept, not a normal rarity tier.

An Anomaly is something that should not normally be obtainable through sanctioned ordinary progression.

Possible forms:

- Anomaly Skill/Technique;
- anomalous item/effect property;
- impossible learned memory;
- frontier traversal capability;
- forbidden/irregular combat interaction;
- effect/object from an unrealized history;
- exceptionally rare alternate acquisition path;
- only in exceptional future cases, a fully authored Anomalous Discipline.

Anomalies may involve in-world unsanctioned or illegal acquisition: forbidden rites, contraband research, clandestine frontier networks, rare Veyr dealings, sealed locations, hidden markets, dangerous narrative choices, or recovery of impossible objects.

“In-world illegal” never means exploiting bugs, cheating, real-money black markets or breaking actual game rules.

### Anomaly philosophy

Anomalies should be rare because **the circumstances are rare**, not merely because a table rolls 0.001%.

The desired reaction is:

> “You got that? How?”

not:

> “You farmed the same boss 3,000 times.”

They must remain sidegrade/identity oriented enough that standard competitive viability never requires ultra-rare possession.

Specific Anomalies may be allowed, normalized, disabled or restricted by PvP/tournament rules.

No cash-only Anomaly combat power.

A secret Anomalous Discipline is permitted only as a rare, separately approved story-grade exception because a full Discipline creates enormous Skill/Essence/Resonance/AI/PvP/media obligations.

Detailed frontier/Rekindling/Anomaly authority lives in `docs/REKINDLING_FRONTIER_ANOMALIES.md`.

---

# 5. PHASES

## ✅ Phase 0 — Engineering Foundation

**Goal:** production-grade technical foundation.

Delivered substantially:

- repository/document authority;
- application/TypeScript/CI/test/build foundations;
- environment separation;
- database/migrations;
- authentication/RLS/security;
- server-domain boundaries;
- transactions/idempotency;
- realtime/worker foundations;
- design system/responsive shell;
- media/audio foundations;
- logging/error/security conventions;
- deployment controls.

**Status:** substantially complete.

---

## ✅ Phase 1 — Character & Progression Foundation

**Goal:** persistent authoritative character/account/progression base.

Delivered substantially:

- account/profile/verified-auth flow;
- three-character roster foundation;
- character creation;
- six attributes/derived stats;
- XP/level boundaries;
- Character Profile foundation;
- Foundation Discipline/start progression boundaries;
- Primary Discipline foundation;
- switching/cooldown boundaries;
- portraits/titles/presence/Online Users;
- initial item/equipment ownership/equip boundaries;
- Passive Training/Training Report authority;
- public News/Manual/Rules foundation.

Deeper Mastery, Secondary, Skills, Resonance/Essence, supernatural identity, full loadouts and mature economy belong later.

**Status:** substantially complete.

---

## 🧪 Phase 2 — Tactical Combat & Battle Platform

**Goal:** prove a readable deterministic tactical game and reusable battle platform before build/content volume multiplies.

### Delivered tactical combat

- deterministic/versioned server-authoritative battle state;
- 100-AP Action Economy;
- tactical board;
- movement/path/terrain/elevation/facing;
- Basic Attack / Guard / Recover;
- target/requirement/effect grammar foundations;
- status/effect ordering;
- intent + expected-version command flow;
- reconnect/idempotency/concurrency safety;
- responsive board-first battle UI;
- forecasts/Inspect/combatant state;
- shared streamlined battle logs;
- keybind/mobile foundations;
- larger battlefield/usability work;
- surrender/abort/result foundations.

### Delivered AI/Battle Hall

- legal deterministic Recruit AI;
- fairness/knowledge boundaries;
- Battle Hall / AI Sparring;
- guided fundamentals;
- practice reward isolation;
- regression coverage.

### Direct PvP foundation delivered early

- authoritative lobbies/participants;
- lobby keys;
- persisted shared PvP battles;
- supported format configurations including 1v1, 2v2, 3v3, three-way and flexible-team variants;
- turn-timing foundation;
- surrender;
- reconnect/handoff/polling hardening;
- chat/communications;
- desktop/mobile presentation;
- multi-combatant presentation;
- active-session mutation protections.

### Spectation foundation delivered early

- keyed read-only spectation;
- authorization/join/leave;
- spectator presence/roster/count;
- committed read-only battle projection;
- spectator logs/chat;
- responsive battlefield;
- Inspect;
- mutation/security protections.

### Current remaining work

Owner testing and formal PV-1 exit validation.

Contained fixes discovered in testing may still address battle readability, PvP handoff, spectator clarity, timing, logs, mobile/desktop parity, session safety and directly related flows.

Do **not** wait for buildcraft, world content, ranked matchmaking, seasons, Colosseum, Soulmarks/Mantles or full media production to close Phase 2.

**Status:** implementation mature and substantially above original scope; Owner testing/PV-1 still open.

Historical implementation detail remains in Git and `docs/PHASE_2_TICKETS.md`, which must not override current combat authority.

---

## 🔜 Phase 3 — Signature Buildcraft Foundation

**Goal:** turn the battle platform into AUREVANE's distinctive build game.

Canonical ticket sequence is defined in `docs/PHASE_3_TICKETS.md`:

```text
P3.1 Discipline build authority + Primary profiles
P3.2 Secondary + independent attunement cooldowns
P3.3 mature Skill schema + cooldown engine
P3.4 Profile Skill configuration + pure/mixed capacity
P3.5 Resonance framework + mixed proof
P3.6 Essence framework + pure proof
P3.7 shared AI/PvP/loadout build snapshots
P3.8 representative buildcraft slice + PV-2 readiness
```

Phase-3 outcome:

- Primary base profiles;
- optional mastered Secondary;
- independent server-owned attunement cooldowns;
- mature eight-Skill Discipline schema;
- generic Skill cooldowns;
- pure 8-Skill + Essence versus mixed 6-Skill + Resonance;
- Character Profile as build headquarters;
- saved-loadout legality foundation;
- AI and existing PvP consuming the same build snapshots;
- first safe authoring/validation tooling.

No Soulmark/Mantle catalog and no frontier implementation are required here.

**Gate:** representative players understand and voluntarily experiment with Primary/Secondary, Skills, cooldowns and pure-vs-mixed identity.

---

## 🔜 Phase 4 — First Playable Buildcraft Roster & Core Combat Content

**Goal:** prove the Phase-3 build grammar produces genuinely different play before roster scale.

Staged roster:

```text
4 representative Disciplines
→ 6–8
→ 12
→ 16 for mature Closed Alpha
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
- VFX/SFX/media burden;
- analytics;
- interaction linting/content-production cost.

Representative equipment/consumables and battle scenes must create real tactical decisions rather than stat reskins.

**Gate:** multiple Disciplines, pure/mixed routes, gear and maps materially change strategy; production remains sustainable.

---

## 🔜 Phase 5 — Living World, Story, Supernatural Identity & Frontier Threshold

**Goal:** establish the living world and first meaningful supernatural/world mystery systems.

Scope includes:

- strategic world map / Atlas;
- settlements/locations/presence;
- encounters;
- NPC/dialogue;
- quest engine;
- layered global/region/node/player state;
- scheduled/data-driven world events;
- World Pulse;
- story arcs and versioned narrative content;
- Archive/Fragment Sets/lore provenance;
- protected quest/key items;
- world vendors/acquisition links as needed;
- location-coherent battle scenes;
- owner/staff Event/Story/Lore operational shell;
- early Horizon/world progression gates.

### Supernatural fork

Introduce the first real:

```text
UNAWAKENED
→ SOULMARKED
OR
→ SOUL-SEVERED
```

with a small high-quality Soulmark proof and at least one valid Mantle path so Severance has meaningful payoff.

### Frontier threshold

Introduce the **concept and outer edge** of the Unwritten Reach:

- known-world cartography visibly gives way to uncertain territory;
- first deliberate crossing/entry prompt;
- one small authored outer-Reach vertical slice;
- first Anchor;
- first controlled Cartographic Drift proof;
- Field Observation → Archive integration;
- early rumors/evidence of far inhabitants;
- no giant Anomaly catalog.

The Phase-5 frontier target is **mystery and coherence**, not endless content.

**Gate:** players can explore a coherent living region/world loop, experience operated story/world change, understand the supernatural fork, and encounter the frontier as a compelling mystery rather than random filler.

---

## 🔜 Phase 6 — Party & Co-op Foundation

**Goal:** convert existing multiplayer battle technology into real cooperative play.

Scope:

- parties/invites;
- party realtime;
- party finder;
- co-op battles;
- shared quests/objectives;
- each player owning their character;
- reconnect/ownership flow;
- pings/action visibility;
- allied coordination;
- enemy-team coordination;
- multi-unit practice where appropriate;
- frontier party entry/extraction/shared route state where useful.

The Reach must retain meaningful solo content; co-op is an option, not universal entry tax.

**Gate:** three people can complete a readable fair mission together with each controlling their own character.

---

## 🔜 Phase 7 — Expeditions, Boss PvE & Deep Frontier

**Goal:** stress buildcraft/co-op/AI/persistence through deep repeatable PvE and make the Reach a serious endgame exploration layer.

Scope:

- deterministic Expedition templates/seeds;
- progressive reveal;
- Easy / Standard / Deep Expeditions;
- modifiers/threat;
- suspension/reconnect;
- multiphase bosses;
- personal/targeted loot;
- anti-duplication/bad-luck rules;
- environmental battle objects/terrain transformation;
- objective/boss AI;
- long-run performance/version/replay tests.

### Deeper Reach

- Reach-discovered Expedition entrances;
- deeper drift states;
- stronger hazards;
- named phenomena;
- meaningful Frontier Acumen advantages;
- first Veyr interaction where story timing permits;
- first tightly controlled **Anomaly acquisition proof**;
- deep Anchor/boss interactions.

**Gate:** a roughly hour-scale three-player Deep Expedition is memorable/resumable and frontier exploration produces understandable mystery, not arbitrary randomness.

---

## 🟡 Phase 8 — Competitive PvP, Colosseum, Seasons & Tournaments

**Goal:** mature the already-built direct PvP/spectator platform into a competitive product.

**Inherited rather than rebuilt:** lobbies, shared battles, multiple formats, timing foundation, direct challenge infrastructure, spectation, battle chat/logs, multi-combatant presentation.

Remaining mature scope:

- casual/ranked 1v1;
- casual/ranked 2v2;
- ratings/rank;
- matchmaking;
- population-safe queue policy;
- Arena Tempering;
- competitive disconnect/abandon rules;
- seasons;
- tournaments;
- build snapshots/locks;
- map/side bias testing;
- competitive telemetry;
- PvP overrides through shared definitions;
- Skill/Resonance/Essence/Soulmark/Mantle/equipment/Veteran Edge legality;
- public/private spectator policy;
- competitive spectator delay;
- Colosseum/public battle discovery;
- featured matches/replays where approved.

### Anomaly competitive policy

Every relevant Anomaly must be explicitly classified as:

- allowed;
- normalized;
- disabled;
- special-event only;
- tournament restricted.

No ordinary competitive player should require ultra-rare frontier possession to be viable.

---

## 🔜 Phase 9 — Roster, Soulmark, Mantle & Frontier Catalog Expansion

**Goal:** scale only systems already proven fun and sustainable.

- expand toward the long-term 36-Discipline target in controlled batches;
- mature eight-Skill libraries;
- complete Essence/Resonance coverage;
- expand Soulmarks based on quality/data;
- progress toward six distinct Mantles;
- scale enemy/maps/equipment interactions;
- increase AI/PvP regression coverage;
- scale Reach Anchors/phenomena/Anomaly pool only if earlier evidence supports it.

Anomalous Disciplines, if ever used, require separate Owner approval and a complete normal-quality content/balance package.

---

## 🔵 Phase 10 — Social World & Explorer Identity

Existing foundations include Online Users, profiles, presence and battle-scoped communication.

Mature scope:

- friends;
- guilds;
- messages;
- guild quests/progression;
- social profiles;
- moderation/reporting;
- build sharing;
- Chronicle/social recognition;
- Rekindling/Hall of Selves presentation;
- mature explorer identity;
- public Frontier Ledger excerpts;
- route/map sharing where appropriate;
- guild frontier expedition organization;
- first-discovery attribution and famous explorer recognition.

---

## 🔜 Phase 11 — Economy, Crafting & Trade

Scope:

- stores/vendors;
- mature loot;
- marketplace/Trade House;
- crafting/professions;
- materials;
- enchantment where approved;
- binding/trading policies;
- safe sell/salvage;
- overflow/recovery;
- item provenance/history;
- acquisition graph;
- economy telemetry/support tools.

### Frontier/Anomaly economy

If frontier resources or Anomalies can be traded, define strict:

- provenance;
- bind/transfer rules;
- contraband presentation;
- market legality;
- anti-duplication/anti-laundering behavior;
- support/audit history.

Not every Anomaly should be tradable.

---

## 🔜 Phase 12 — Nations & Large-Group Identity

Scope:

- allegiance/reputation;
- nation quests;
- campaigns;
- warfare;
- political rankings;
- national world-event operations;
- PvE/PvP contribution paths.

Nations/factions may disagree over:

- the Reach;
- Veyr contact;
- Anomaly possession;
- forbidden frontier research;
- Great Vane policy.

Do not permanently lock essential competitive power behind one national choice.

---

## 🔵 Phase 13 — Complete Master Panel & Long-Horizon Operations

Earlier phases ship minimum operational tools. Phase 13 consolidates the full operating system.

Scope:

- Owner Command Center;
- roles/permissions;
- audited player corrections;
- Discipline/Skill/Resonance/Essence/Soulmark/Mantle editors;
- item/effect/loot/economy tools;
- quest/dialogue/story/Archive editors;
- event scheduling;
- Expedition editor;
- PvP/season/tournament operations;
- Audio Manager/Asset Studio;
- Balance Lab;
- Combat Content Studio/AI Lab;
- Pacing Simulator;
- progression/Horizon/Passive Training/Rekindling/Veteran Edge controls;
- feature flags;
- content diff/history/staging/rollback;
- narrative canon/spoiler controls;
- break-glass Owner recovery.

### Reach/Anomaly operations

- drift seeds/versions;
- Anchor authoring;
- route/frontier-state inspection;
- Reach events;
- Anomaly definitions/legality;
- acquisition provenance;
- emergency disable/rollback;
- Frontier Ledger/support inspection;
- generation simulation/validation.

---

## 🔵 Phase 14 — Art, Audio & Production Presentation

Earlier phases already require sufficient media for coherent testing. Phase 14 is the complete production pass.

Scope includes world/region/character/Discipline/Soulmark/Mantle/item art, soundtrack/ambience/SFX, battle environments, VFX/animation, responsive/mobile polish, accessibility, Archive/Rekindling/Hall of Selves presentation and complete combat feedback.

### Reach identity

The Unwritten Reach requires a distinct visual/audio language based on:

- uncertain distance;
- contradictory geography;
- familiar objects in impossible context;
- continuity errors;
- beauty mixed with unease;
- shifting but readable navigation cues.

Avoid generic purple corruption, generic void fog or obvious imitation of other fantasy frontiers.

---

## 🔵 Phase 15 — Security, Scale, Exploit Hardening & Closed-Alpha Readiness

Hardening includes:

- security/penetration/abuse review;
- rate limiting;
- privileged access/audit integrity;
- database/index/load/realtime performance;
- combat/reward/idempotency races;
- PvP/loadout/economy exploits;
- migration/versioning;
- AI/property tests;
- content-authoring permission/rollback;
- progression/Rekindling integrity;
- live-event recovery;
- human cross-skill playtests.

### Reach/Anomaly hardening

- deterministic drift reproduction;
- unreachable-layout rejection;
- route/version migration;
- reconnect/extraction;
- reward duplication/reroll abuse;
- Anomaly provenance;
- trade/economy exploits;
- spoiler leakage;
- community discovery load;
- generation/content performance.

---

# 6. Endgame / Rekindling maturity gate

Before Rekindling becomes a normal production loop, validate:

- first-cycle eligibility still represents a meaningful long journey;
- time alone and grind alone cannot complete it;
- serious PvE/PvP/build/world content matters before day 180;
- later cycles do not feel like identical chores;
- Echo Routes/Memory Carryover/history-aware progression create meaningful variation;
- mastered tutorials can be abbreviated without trivializing the journey;
- Hall of Selves makes prior cycles feel accumulated rather than deleted;
- Veteran Edge remains bounded and PvP-safe;
- the Reach creates new long-term questions without becoming mandatory for every build;
- frontier mastery emphasizes knowledge/access over global raw power;
- Anomalies create stories and identity without becoming mandatory meta items.

---

# 7. Product-validation ladder

`docs/ROADMAP_PRODUCT_VALIDATION.md` governs evidence details.

High-level sequence:

- **PV-1:** tactical combat proof — Phase 2 exit.
- **PV-2:** Signature Buildcraft proof — Phase 3 before roster scaling.
- **PV-3:** first-session / return-loop proof — Phase 5 before large world-production scale.
- **PV-4:** co-op / Expedition proof — Phases 6–7.
- **PV-5:** PvP population safety — Phase 8+.
- **PV-6/7:** monetization/unit economics before scale.
- **PV-8:** sustainable live operations before major live-service cadence.

Future Rekindling/frontier validation must additionally prove:

- later cycles feel different rather than repetitive;
- drift feels mysterious rather than arbitrary;
- Anchors create memorable persistent discoveries;
- frontier expertise feels earned/intelligent;
- Anomalies remain rare, story-rich and non-mandatory.

---

# 8. Mature Closed Alpha target

Closed Alpha is a **quality/content gate, not a date promise**.

Target shape includes:

- 16 playable Disciplines;
- representative Soulmark set;
- meaningful Resonance/Essence coverage;
- 4 strong regions;
- 20–30 enemies;
- 4–6 bosses;
- 50+ purposeful items;
- 20+ quests;
- Easy/Standard/Deep Expedition coverage;
- 1v1 + 2v2 PvP;
- guild foundation;
- readable tactical battle platform;
- competent combat AI;
- continuing world/story/event capability;
- Archive/lore discovery;
- owner/staff operations foundation;
- strong visual/audio presentation;
- telemetry for long-horizon tuning.

The Reach does **not** need to be enormous for Closed Alpha. A small excellent frontier proof is more valuable than hundreds of generated empty nodes.

---

# 9. Permanent ticket rules

Every implementation ticket states:

- purpose;
- exact scope;
- dependencies;
- authoritative docs;
- files/modules affected;
- implementation approach;
- automated tests;
- acceptance criteria;
- manual verification;
- relevant product evidence.

Build tickets use Primary / Secondary / Skill / Resonance / Essence terminology.

Combat tickets follow `docs/COMBAT.md`.

Frontier tickets follow `docs/REKINDLING_FRONTIER_ANOMALIES.md` and must distinguish authored Anchors from deterministic Driftspace.

Anomaly tickets must define provenance, acquisition, power tradeoffs, competitive legality and exploit/duplication protection.

Only the assigned ticket is implemented unless the Owner explicitly authorizes a wider coherent batch.

---

# 10. Core development sequence from today

```text
PHASE 2 OWNER TESTING / PV-1 EXIT
        ↓
PHASE 3 SIGNATURE BUILDCRAFT
        ↓
PHASE 4 FIRST BUILDCRAFT ROSTER
        ↓
PHASE 5 LIVING WORLD + SUPERNATURAL FORK + FIRST REACH
        ↓
PHASE 6 PARTY / CO-OP
        ↓
PHASE 7 EXPEDITIONS + DEEP REACH + FIRST ANOMALY PROOF
        ↓
PHASE 8 MATURE COMPETITIVE PvP / COLOSSEUM
        ↓
PHASE 9 CONTROLLED CATALOG SCALE
        ↓
PHASE 10 SOCIAL WORLD / EXPLORER IDENTITY
        ↓
PHASE 11 ECONOMY / CRAFTING / TRADE
        ↓
PHASE 12 NATIONS
        ↓
PHASE 13 COMPLETE OPERATIONS
        ↓
PHASE 14 FULL PRODUCTION PRESENTATION
        ↓
PHASE 15 HARDENING / CLOSED-ALPHA READINESS
        ↓
MATURE ENDGAME / REKINDLING / CONTINUING LIVE WORLD
```

The objective is not to check boxes fastest. It is to preserve AUREVANE's ambition while proving each expensive layer before multiplying it.