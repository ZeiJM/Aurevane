# AUREVANE — Canonical Implementation Roadmap

**Authority:** `docs/GAME_MASTER_PLAN.md` remains the highest-level game-design authority. This file is the **single canonical implementation-sequencing roadmap** for AUREVANE.

**Consolidated:** 2026-08-19

A roadmap phase is a development milestone, **not a promised calendar window**. Work advances through acceptance gates, automated verification, and human player validation where required.

---

# 0. ROADMAP AUTHORITY & NO-DRIFT RULE

AUREVANE previously accumulated several `docs/ROADMAP_*.md` integration documents while individual systems were being designed. Their useful detail is preserved, but they no longer define independent phase ordering.

The rule from this point forward is:

> **`docs/ROADMAP.md` is the only roadmap that answers what phase a feature belongs to, what is currently active, and what comes next.**

Specialized `ROADMAP_*` documents are supporting implementation/history references only. If one conflicts with this file, this file wins unless the Game Owner explicitly approves a roadmap revision.

When a future design changes implementation sequencing:

1. update the relevant authoritative domain/design document;
2. update **this canonical roadmap in the same change**;
3. update `AGENTS.md` when future agents need a new permanent rule;
4. update player-facing Manual/News/Rules only when the change affects information players should know;
5. do not create another independent roadmap addendum as the sole source of phase placement.

Older roadmap modules may contain retired terms such as Current/Legacy Discipline, Confluence, Art, four-attribute assumptions, Tactical Hall, or obsolete Wayfarer's Practice behavior. Those terms do **not** override the current model.

---

# 1. CURRENT STATUS

- ✅ **Phase 0 — Engineering Foundation:** substantially complete.
- ✅ **Phase 1 — Character & Progression Foundation:** substantially complete and iterated through player feedback.
- 🚧 **Phase 2 — Tactical Combat Core:** current active validation/iteration focus.
- 🔜 **Phase 3+ — Planned:** future architecture may be anticipated, but those systems are not presented as already playable.

**Current execution rule:** finish and validate Phase 2 rather than pulling attractive Phase 3–16 features forward merely because they are now planned.

Automated green tests do **not** equal a human PV PASS. A player-validation gate is complete only when the required human playtest actually passes.

---

# 2. CANONICAL GAMEPLAY VOCABULARY

Current player-facing build terminology:

- **Primary Discipline** — principal active combat tradition and source of the active Discipline base-stat profile.
- **Secondary Discipline** — optional mastered Discipline mixed into the active build; no second base-stat profile.
- **Skill** — player-facing umbrella term for usable authored combat abilities.
- **Resonance** — passive interaction produced by an eligible Primary + Secondary pairing.
- **Essence / Discipline Essence** — pure-Discipline counterpart to Resonance; a Primary-only build gains one special Essence Skill outside normal Discipline Skill capacity.
- **Soulmark** — persistent supernatural identity on the Soulmarked path.
- **The Severance / Soul-Severed** — permanent alternative supernatural path.
- **Mantle** — temporary transformation available to eligible Soul-Severed characters.
- **Battle Hall** — current player-facing practice-combat destination.
- **Passive Training** — deliberate server-timed background training, currently Short / Medium / Extended.
- **Veteran Edge** — bounded prestige option associated with Rekindling; not infinite stacked stats.

Retired player-facing terminology includes Current Discipline, Legacy Discipline, Art as the generic ability term, Confluence, Tactical Hall, and separate Trait / Reaction / Movement Art / Ultimate loadout slots.

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

The exact Primary/Secondary split inside the mixed six is tunable and must not be hardcoded as the retired 4/2 assumption.

---

# 3. UNIVERSAL CHARACTER ATTRIBUTES

AUREVANE uses six universal player attributes:

- Might;
- Finesse;
- Vitality;
- Agility;
- Intellect;
- Resolve.

Primary Discipline contributes its own base Discipline stat profile. Secondary does not add a second base profile.

Do not restore the older four-attribute model.

---

# 4. CROSS-CUTTING PRODUCT RULES

## Permanent character inside a living world

The personal hook is a long-lived character whose build, history, relationships and reputation accumulate over months and years.

The world should continually create new reasons to rethink that character through:

- story;
- live world events;
- Disciplines;
- Resonance/Essence;
- Soulmarks/Mantles;
- equipment;
- Expeditions;
- PvP metas;
- guild/nation activity;
- economy/professions;
- Archive/lore discoveries;
- later Rekindling cycles;
- later frontier exploration.

## Server authority

Combat, rewards, XP, Mastery, inventory, equipment, currency, crafting, marketplace state, PvP, quests, event participation, Passive Training, Rekindling and other valuable state remain server-authoritative.

The browser submits intent; it does not decide valuable outcomes.

## Presentation is not postponed

Art, audio, responsiveness, accessibility, readable feedback, loading/error states and player-facing information are part of each phase. Phase 14 is the dedicated production polish pass, not permission to ship ugly placeholders until then.

## Healthy retention

AUREVANE should create “I want to return” rather than “I am punished for missing a day.”

Allowed drivers include world changes, build discovery, seasons, lore, prestige, social activity, target farming, Expeditions, rotating encounters and experiential urgency.

Avoid destructive streaks, mandatory daily energy, permanent one-time missable meta power and pay-to-avoid-loss systems.

## Product-validation rule

Large scope is earned through progressively larger playable proof:

1. **Combat Proof** — smallest polished tactical fight.
2. **AUREVANE Identity Proof** — small but genuine Primary/Secondary + Resonance/Essence + supernatural/build set.
3. **Retention Loop Proof** — progression/world loop that demonstrates players want to return.
4. **Co-op / Population Proof** — party experience and healthy matchmaking/population behavior.
5. **Mature Closed Alpha** — substantial content only after the smaller thesis is working.

Failure of a proof gate means iterate the weak layer, not hide it beneath more content.

---

# 5. LONG-HORIZON PROGRESSION & REKINDLING RULE

The first complete character era targets a minimum approximately **180 days / six calendar months** before first full endgame/Rekindling eligibility under production defaults.

This is not a six-month lock before interesting content. Challenging PvE, PvP, advanced buildcraft and high-level regions can arrive earlier when the player's legitimate progression qualifies them.

The journey combines:

- Level 1–100;
- Horizon Gates;
- Discipline Mastery;
- Primary/Secondary build development;
- Resonance/Essence;
- Soulmark or Soul-Severed/Mantle progression;
- equipment refinement;
- world/story progress;
- lore/Archive progress;
- Expeditions;
- PvP/seasonal participation;
- guild/nation activity when available;
- final qualification rites/challenges.

Calendar age alone is insufficient. Grind alone cannot bypass the final journey gate.

## Rekindling must not be a repeated checklist

Rekindling is AUREVANE's prestige system, but future cycles must feel like another era of the **same person**, not the same leveling path replayed verbatim.

Mature Rekindling should include a controlled mix of:

- alternate progression routes;
- veteran-only quest variants;
- different regional emphasis;
- cycle-specific objectives;
- alternate Expedition/boss qualification;
- different lore paths;
- optional PvP/co-op/exploration emphasis;
- safe compression/skipping of beginner instruction already proven mastered;
- prior-cycle NPC/story recognition;
- Hall of Selves history;
- optional Echo Encounters based on safe prior-cycle snapshots;
- later frontier objectives.

A future **Cycle Focus** system may let a Rekindled character emphasize paths such as Champion, Explorer, Delver, Scholar, Challenger or Steward. These are route emphases, not permanent classes.

Rekindling can unlock additional Veteran Edge choices, but standard competitive modes use bounded Edge rules rather than uncapped stacked prestige stats.

The Soulmarked versus Soul-Severed supernatural fork persists through Rekindling unless a future explicit story rule changes it.

---

# 6. LORE & PERSISTENT SUPERNATURAL THREAT RULE

Lore is gameplay, not only exposition.

Players build an Archive from books, letters, testimony, records, relics, inscriptions, environmental evidence, event aftermath, Great Vane sites, Expeditions and contradictory sources.

The central long-form mystery remains tied to Aurevane, goddess of Becoming, the Unchosen, the Closed Horizon, Eight Great Vanes, Unmoored phenomena, the City That Was Twice, the Great Opening and eventually the War of Possible Worlds.

A later far-frontier threat must extend that mythology rather than create a disconnected second apocalypse.

Working long-term concepts introduced for future development:

- **The Verge** — stable authored outer boundary of mapped civilization;
- **The Uncharted** — shifting territory beyond the Verge;
- **World's Edge** — acceptable colloquial in-world wording;
- **The Horizonless** — working name for a distant supernatural people/host encountered in the deepest frontier.

These names remain subject to a dedicated lore/naming pass. Their **system purpose** is approved; do not prematurely expose late-story explanations to players.

The Horizonless are not simple generic Aurevane minions. Their cultures/factions may have contradictory relationships with Aurevane, the Great Opening, stable reality and the known world.

---

# 7. PASSIVE TRAINING RULE

The current system is **Passive Training**.

Current foundation:

- explicit Short / Medium / Extended server-timed plans;
- server owns start/completion time and reward;
- shorter plans are more efficient per hour;
- longer plans trade efficiency for convenience;
- unfinished plans may be stopped without partial reward under current rules;
- completed blocks create bounded Training Reports;
- current reward foundation is Character XP;
- active training blocks entering a new Battle Hall fight/live combat entry;
- client/browser clocks are never authority;
- claims are idempotent.

Future Mastery/Discipline Focus or rested/catch-up extensions may be added when their dependencies exist, but Passive Training must remain weaker than engaged play and must not complete story, rare-item acquisition, PvP rank, Expedition clears, Horizon rites, supernatural milestones or endgame qualification for the player.

Older roadmap modules describing automatic Balanced fallback or obsolete Wayfarer's Practice windows do not override this rule.

---

# 8. EQUIPMENT LOAD & BUILD PHYSICS RULE

When mature enough to be fun, relevant equipped gear gains authored **Weight** contributing to **Equipped Load**.

Equipped Load can create visible tradeoffs involving:

- Movement;
- Jump/vertical legality;
- selected terrain interactions;
- stability/displacement interactions;
- equipment/Skill conditions.

This is **not inventory encumbrance**. Owning loot/materials/quest items does not automatically slow ordinary travel.

Heavy equipment must buy meaningful benefits. Load penalties and breakpoints must be previewed before commitment. Light, standard, heavy and unusual hybrid builds should all have viable reasons to exist.

Might/load-handling interactions, exact thresholds and balance remain data-driven and must use the six-attribute model.

---

# 9. PvP FORMAT RULE

AUREVANE's mature PvP architecture must not assume only one fixed team size.

Planned supported format family:

```text
STANDARD COMPETITIVE BASELINE
1v1

TEAM FORMATS
2v2
3v3

FLEXIBLE CLASH
1–3 players vs 1–3 players
including intentionally uneven custom/event matches

MULTI-SIDED FORMAT
1v1v1
```

**1v1 remains the default competitive reference and first persistent ranked anchor.**

2v2/3v3 permanent ranked queues open only when population supports healthy matchmaking.

Uneven 1v2 / 1v3 / 2v3 matches begin as direct challenge, custom, guild/social or explicit event/exhibition formats—not secretly “fair” ranked matchmaking.

1v1v1 begins as casual/custom/event content until kingmaking, scoring and rating behavior are proven.

A healthy single queue is better than five empty queues.

---

# PHASES

# ✅ Phase 0 — Engineering Foundation

**Goal:** establish production-grade foundations before game mechanics multiply.

Scope includes:

- repository/documentation authority;
- TypeScript/build/lint/test/format CI;
- authentication;
- Supabase/database/migration foundation;
- RLS/security baseline;
- deployment/environment separation;
- server-domain boundaries;
- transaction/idempotency patterns;
- realtime and worker foundations;
- responsive shell/design system;
- media registry / Audio Director foundation;
- audit/logging/error conventions;
- protected future privileged-route boundaries;
- stable IDs and extensible schemas for later build/economy/social systems.

**Gate:** clean build, deployable environment, documented setup and production-style authority boundaries.

**Status:** substantially complete.

---

# ✅ Phase 1 — Character & Progression Foundation

Scope includes:

- accounts/profiles;
- three-character roster foundation;
- character creation;
- six attributes;
- derived-stat framework;
- Level 1–100 configuration boundaries;
- Character XP authority;
- Character Profile/build-headquarters foundation;
- starting Foundation Discipline;
- Discipline/Mastery data boundaries;
- Primary Discipline foundation;
- authoritative character switching/cooldowns;
- portraits/titles/presence foundations;
- Online Users;
- initial item ownership/equipment boundaries;
- core equipment slots;
- Armory/build presentation foundations;
- current Passive Training Short / Medium / Extended flow;
- idempotent training/report/reward behavior.

Future item Weight, professions, titles, social relationships, Rekindling and other systems should remain representable without being prematurely implemented.

**Gate:** a player can create, persist and return to a valid authoritative character and the model safely anticipates later progression/build layers.

**Status:** substantially complete and iterated through player feedback.

---

# 🚧 Phase 2 — Tactical Combat Core

**Goal:** prove the smallest complete version of AUREVANE's tactical combat grammar.

Scope includes:

- deterministic/versioned battle state;
- server-authoritative RNG where required;
- tactical grid/board;
- round/turn lifecycle;
- current shared Action Economy/AP model;
- movement/path legality;
- terrain/elevation/facing;
- targeting/range/occupancy/line-of-sight as released content requires;
- Basic Attack;
- Guard;
- Recover;
- HP/MP/resource foundations;
- typed Target / Requirement / Effect foundations;
- initial statuses and deterministic effect ordering;
- command flow using intent rather than client-submitted outcome;
- board-first battle UI;
- target/action forecasts and clear invalid-action reasons;
- compact actor information/timeline/log;
- battle usability, camera/inspection/control work;
- retreat/surrender/exit behavior where the approved combat addenda require it;
- battle VFX/audio hooks;
- reconnect-safe persistence;
- deterministic legal Recruit AI;
- AI debug/reason hooks and regression states;
- **Battle Hall**;
- **AI Sparring** and focused practice;
- desktop/mobile/touch validation;
- human player-feedback iteration.

### Equipment Load compatibility

If representative Phase-2 equipment makes a real Weight/Load proof useful, test a small light-versus-heavy tradeoff. Do not delay the combat proof to manufacture an unfinished weight ecosystem.

### Future compatibility only

Do not build full Resonance/Essence libraries, complete Soulmark/Mantle catalogs, multiplayer PvP, frontier generation, full economy or social systems here.

**Gate:** a human player can complete a deterministic, attractive, readable tactical fight where positioning and choices matter, AI uses the same legality, reconnect/state handling is safe, and actual player validation confirms the slice is understandable and fun.

**Status:** current active focus.

---

# 🔜 Phase 3 — Signature Buildcraft Identity

**Goal:** prove what makes an AUREVANE character build distinct.

Scope includes:

- mature Primary Discipline rules/base profiles;
- optional mastered Secondary Discipline;
- independent authoritative Primary/Secondary attunement cooldowns;
- Character Profile build configuration;
- mature Discipline Skill schema;
- 8 learnable Discipline Skills per mature Discipline;
- pure build: up to 8 Primary Skills + Essence;
- mixed build: 6 total Discipline Skills + Resonance;
- Skill source labels/cooldowns;
- combo/sequence passive grammar;
- first Resonance library;
- first Essence Skills;
- Equipment Skill integration;
- saved loadout legality;
- explicit Equipment Weight / Equipped Load / Load State integration once ready;
- load previews in Armory/build comparison;
- Passive Training Discipline Focus/Mastery extension only if dependency-safe;
- AI understanding of released build interactions;
- first safe content-authoring/validation tools;
- first supernatural-fork proof when story/progression timing supports it.

No separate Trait, Reaction, Movement Art or Ultimate slot systems return.

**Gate:** players can understand and enjoy meaningful pure-versus-mixed choices, gear/load tradeoffs and early supernatural/build identity.

---

# 🔜 Phase 4 — First Playable Discipline Set / Core Content

**Goal:** convert systems into enough varied content to prove buildcraft is genuinely fun.

Target roughly **16 playable Disciplines** before mature Closed Alpha rather than waiting for all 36.

Each released Discipline should include as appropriate:

- Primary base-stat profile;
- mature or milestone-appropriate Skill library;
- Essence coverage;
- relevant Resonance coverage;
- Mastery/acquisition requirements;
- distinct tactical identity;
- typed combat data;
- equipment/load interaction review;
- AI usage rules/regression states;
- VFX/SFX;
- PvE/PvP validation;
- analytics.

Representative content should include:

- meaningful equipment/consumables;
- Light/Standard/Heavy build archetypes where Load is active;
- varied battlefields/objectives;
- enemies using different tactical patterns;
- larger Battle Hall scenario coverage;
- diverse but spoiler-safe possibility/echo mechanics to prove future supernatural enemies can use typed systems.

**Gate:** representative Disciplines, pure/mixed routes, equipment and maps feel materially different and fun.

---

# 🔜 Phase 5 — Living World, Story, Events, Navigation & Early Operations

**Goal:** connect character/combat/build systems into a persistent authored world.

Scope includes:

- World Atlas/map;
- regions, settlements, roads and travel/presence;
- NPCs/dialogue;
- encounter system;
- quest engine;
- initial story;
- global/region/node/player world-state layers;
- data-driven persistent world events;
- event phases/objectives/rewards/aftermath;
- scheduling/restart recovery/idempotency;
- World Pulse / since-you-were-away context;
- Chronicle history;
- Archive lore-discovery foundation;
- Fragment Sets / contradictions / source provenance;
- Great Vane/Unmoored foreshadowing appropriate to story stage;
- location-coherent battle scenes;
- battle-to-world state/reward return;
- protected quest/key-item rules;
- known acquisition/vendor links;
- initial Horizon/world progression gates;
- safe Event/Story/Lore owner/staff operations shell.

### Strategic navigation

Add:

- map layers/persisted filters;
- quest/event/service/travel/lore/combat-location filtering;
- coordinate/compass guidance;
- exact tracked objectives;
- approximate search areas;
- clue-led hidden objectives;
- no client delivery of undiscovered markers merely to hide them visually.

### Gathering/resource foundation

Introduce a small world-side Resource Site model so later professions can reuse the same authoritative map/world framework.

### Known-world frontier foundation

The authored Atlas should visibly end rather than pretending the whole world is already mapped.

Phase 5 may establish:

- distant frontier regions;
- rumors of missing roads/survey parties;
- unstable cartography;
- future Verge crossing locations;
- event hooks for threats originating beyond mapped territory.

Do **not** build the mature shifting Uncharted here.

**Gate:** explore → encounter → battle → quest/reward → persistent progress works as one coherent loop, and staff can safely operate a real world/story event without routine code deployment.

---

# 🔜 Phase 6 — Party & Co-op

Scope includes:

- parties up to 3 players;
- realtime party state;
- co-op tactical battles;
- shared quests/objectives;
- party finder;
- pings/action visibility;
- player-specific story flags in shared content where necessary;
- reconnect/ownership flow;
- coordinated enemy AI;
- allied NPC AI where required;
- multi-unit Battle Hall drills;
- party-compatible map waypoints without leaking hidden knowledge;
- future frontier-session version compatibility.

There is no mandatory MMO trinity.

**Gate:** three humans can complete a mission together, each controlling their own character, with readable/fair combat and safe reconnect/state handling.

---

# 🔜 Phase 7 — Expeditions

**Goal:** deliver AUREVANE's repeatable dungeon/adventure pillar.

Scope includes:

- authored Expedition templates;
- deterministic seeded generation;
- authored modular rooms/sectors;
- progressive reveal;
- Easy / Standard / Deep Expeditions;
- Threat/modifier system;
- sanctuary/rest/suspension/reconnect;
- multiphase bosses;
- personal loot/leaderboards;
- target farming and bad-luck protection where approved;
- Expedition tools/consumables;
- lore rooms/records/relics;
- environmental objects/terrain transformations;
- objective-aware AI/boss directors;
- long-run replay/version/performance verification;
- profession Resource Sites where appropriate later.

Expeditions establish reusable seeded-content technology for the future Uncharted, but the systems remain distinct: Expeditions are bounded runs; the Uncharted is a shared shifting outer-world layer.

**Gate:** a roughly hour-scale three-player Deep Expedition is fully playable, resumable and memorable without reward duplication or soft locks.

---

# 🔜 Phase 8 — PvP, Colosseum & Spectation

**Goal:** make AUREVANE tactical combat competitive, social and watchable.

## Core competitive foundation

- direct challenges;
- casual 1v1;
- ranked 1v1;
- Arena Tempering;
- matchmaking;
- disconnect/forfeit protection;
- competitive timing rules;
- seasons;
- tournaments;
- telemetry;
- map/spawn/side-bias testing;
- transparent PvP overrides using shared content definitions;
- CC anti-lockout rules;
- equipment/consumable/build/supernatural legality controls;
- Veteran Edge queue configuration;
- no undisclosed bots presented as human ranked opponents.

**1v1 is the competitive baseline.**

## Team formats

Architecture supports:

- 2v2;
- 3v3;
- each human controlling their own character;
- mode-aware ratings/records;
- participant/team/faction identifiers rather than permanent binary-team assumptions.

Permanent ranked team queues activate only when population supports them.

## Flexible Clash

Working label **Clash** supports custom/casual/event two-team configurations from 1–3 players per side, including 1v2, 1v3 and 2v3.

Uneven formats are clearly labeled and are not ordinary fair ranked matchmaking unless a future explicit ruleset proves a transparent handicap/scoring model.

## 1v1v1

Support three mutually hostile participants through the same general battle membership model.

Initial use is casual/custom/event/exhibition. Ranked 1v1v1 waits for credible solutions to kingmaking/scoring/rating issues.

## Colosseum & spectation

Implement:

- Colosseum live-battle discovery;
- public / unlisted / private-key / closed visibility;
- opaque shareable spectator links;
- private Battle Keys;
- viewer-safe read-only spectator projections;
- delayed ranked/tournament spectation;
- casual live spectation with appropriate consent;
- spectator cockpit using the battle renderer without Command Deck authority;
- friend/public match discovery where privacy permits;
- completed-match/replay continuity;
- later featured/tournament presentation.

**Gate:** competitive matches are authoritative/fair, queue health is measurable, multi-format architecture is sound, and spectation cannot leak hidden information or grant mutation authority.

---

# 🔜 Phase 9 — Full Discipline Roster

Expand toward **36 Disciplines** in controlled batches.

Every mature Discipline requires:

- Primary base-stat profile;
- 8 learnable Discipline Skills;
- Essence Skill;
- Resonance coverage with released roster;
- acquisition/Mastery rules;
- distinct tactical identity/counterplay;
- authoritative combat data;
- equipment/load review;
- AI usage/regression;
- VFX/SFX;
- PvE/PvP/team-mode tests;
- analytics;
- Master Panel support.

Do not create 36 cosmetically renamed versions of the same role.

---

# 🔜 Phase 10 — Social World, Tavern, Identity & Community Growth

**Goal:** make players recognizable people inside a persistent community.

Scope includes:

- Friends and friend requests;
- Recent Players;
- privacy/presence preferences;
- blocking and safety boundaries;
- direct messages;
- notification/attention system;
- guilds;
- guild quests/progression;
- social profiles;
- Tavern/Common Room social destination and appropriate social activities;
- moderation/report tooling;
- social recognition / Chronicle hooks;
- build-share cards where approved;
- richer Colosseum friend/replay integration;
- Homestead visit-permission foundations;
- Rekindling/Hall-of-Selves presentation foundations.

## Titles & badges

Add:

- earned titles;
- one controlled Personal Title entitlement/design where approved;
- selected Display Title;
- Official Badge separate from ordinary titles;
- WORLDWRIGHT Owner identity;
- Moderator / Content Staff / Event Staff official presentation;
- no authority derived from visible badge data.

## Vowbond

Mature social phase may include consensual Vowbond/marriage-style relationship mechanics with:

- explicit proposal/acceptance;
- privacy/block safety;
- partner profile links;
- Shared Hearth/social conveniences;
- optional ceremony/anniversary/Chronicle hooks;
- **no launch combat/XP/Mastery/PvP/economy power**.

## Referrals / recruitment

Implement account-linked referral codes/links where commercially appropriate.

A signup alone is not a rewarded recruit. Qualification should prove genuine early play through multiple signals and anti-abuse controls. Referral rewards must not become P2W or alt-account farming.

**Gate:** players can build persistent relationships and recognizable identities without sacrificing privacy, safety or competitive integrity.

---

# 🔜 Phase 11 — Economy, Professions, Crafting & Trade House

**Goal:** create an understandable player economy around useful items rather than many token currencies.

Primary tradable currency remains **Crowns**.

Scope includes:

- mature stores/vendors/loot;
- materials inventory;
- item provenance;
- crafting;
- marketplace / Trade House;
- atomic listings/purchases/cancellations;
- commissions/escrow;
- binding/trading policies;
- safe bulk sell/salvage where approved;
- overflow/recovery;
- acquisition graph/target farming;
- economy telemetry and exploit controls;
- Equipment/Consumable Skill integration;
- Rekindling preserve/reset safeguards;
- no Passive Training economic-output farm;
- no Battle Hall reward farm.

## Professions

Current approved specialization shape:

**One Craft specialization:**

- Weaponwright;
- Outfitter;
- Enchanter.

**One Gathering specialization:**

- Prospector;
- Forager;
- Tracker.

Profession tracks use bounded independent progression and should take meaningful active time rather than being passively completed offline.

Gathering uses the world Resource Site framework and map filters. Crafting/enchantment uses the same typed item/effect rules as the rest of the game.

Crafted gear should create authored sidegrades/build identities rather than simply invalidating all world/Expedition/PvP gear.

## Equipment Load at economy scale

Mature item authoring validates sensible Weight ranges and marketplace/crafting presentation of Weight. A lighter strategic item may be better for a mobility build even when another item has larger raw defenses.

**Gate:** acquisition, ownership, storage, crafting, professions, trade and commissions are coherent/server-authoritative without duplication, trust scams, key-item loss or inventory-management misery.

---

# 🔜 Phase 12 — Nations, Sovereign Territory & Homesteads

**Goal:** deepen world allegiance and personal ownership without turning housing into mandatory combat power.

## Nations

- allegiance arrives later in character progression, not at creation;
- reputation;
- nation quests;
- seasonal campaigns;
- nation warfare;
- political rankings;
- PvE and PvP contribution paths;
- multiple political interpretations of the central mythology;
- no essential competitive build permanently locked behind one nation.

## Sovereign safe territory

Nation capitals and authored sovereign territory should feel controlled and civilized.

Normal hostile monsters do not simply spawn throughout capitals, residential districts or Homesteads. Siege/invasion/training combat uses explicit authored locations/event rules.

## Homesteads

Eligible characters can establish one active nation-linked Homestead.

Planned capabilities:

- authored residential districts/parcel anchors;
- persistent private space rather than scarce world-tile land grabbing;
- modular rooms/expansion;
- decoration;
- trophy/display systems;
- substantial non-combat Vault storage;
- normal Crafting panel access through a Workshop;
- visitors governed by privacy/social permissions;
- safe nation-relocation flow preserving ownership/storage;
- Homestead map/social integration;
- no raiding/destruction;
- no passive resource farm;
- no direct mandatory combat-stat advantage.

Later frontier achievements can create Homestead trophies/maps/display relics without turning the home into a frontier defense base.

**Gate:** nation territory feels coherent, and an eligible player can own, decorate, use, visit and safely relocate a persistent home without world-land scarcity or P2W advantage.

---

# 🔜 Phase 13 — Complete Master Panel & Long-Horizon Operations

**Goal:** make AUREVANE safely operable without routine raw production edits.

Some tooling exists earlier; Phase 13 consolidates the complete operating system.

Scope includes:

- Owner Command Center;
- fixed/approved staff role model and granular permissions;
- player lookup/support corrections;
- audit and break-glass recovery;
- content editors;
- Discipline / Skill / Resonance / Essence editors;
- Soulmark / Mantle editors;
- Item / Effect / Equipment / Weight editors;
- quest/dialogue/story/Archive editors;
- World Event Studio/scheduler;
- Expedition editor;
- PvP queue/season/tournament/format operations;
- Colosseum/spectator operations;
- profession/recipe/resource-site/economy tools;
- Homestead/nation operations;
- Audio Manager;
- Asset Studio;
- Balance Lab;
- Combat Content Studio;
- Combat AI Lab;
- Battle Hall record/unlock configuration;
- Pacing Simulator;
- Horizon/Passive Training/Rekindling/Veteran Edge controls;
- title/badge/Vowbond/referral support where applicable;
- build/combat/economy/social telemetry;
- feature flags;
- diff/history/staging/publish/rollback;
- narrative canon/spoiler publication rights.

## Future Rekindling operations

Add Cycle Focus definitions, alternate qualification pools, veteran shortcut configuration, Hall-of-Selves/Echo templates and anti-fatigue telemetry before repeated cycles are broadly live.

## Future frontier operations

When Phase 16 exists, add frontier seed/cycle controls, authored sector/POI pools, anchored/drifting locations, depth bands, threat-stage controls, safe rollback and stranded-session support.

**Gate:** normal operation, authoring, balance, simulation, delegation and repair occur through validated audited tools rather than direct production credentials.

---

# 🔜 Phase 14 — Art, Audio & Presentation Production Polish

This is the dedicated production-quality pass, not the first time media appears.

Scope includes:

- region/settlement art;
- character/Discipline art;
- Soulmark/Mantle presentation;
- item/equipment/profession art;
- Homestead/nation identity;
- soundtrack;
- ambient audio;
- combat SFX;
- Skill/Equipment/Resonance/Essence/Soulmark/Mantle VFX identity;
- terrain/elevation readability;
- impact feedback;
- transitions/animations;
- responsive/mobile polish;
- accessibility/reduced-motion/readability;
- loading/error states;
- Archive/document/relic presentation;
- Passive Training presentation;
- Battle Hall/Review presentation;
- Colosseum/spectator polish;
- Staff/Owner badge identity;
- Rekindling/Hall of Selves presentation;
- future Verge/Uncharted visual/audio language.

Target: a beautiful browser RPG, not a database website wearing fantasy art.

---

# 🔜 Phase 15 — Security, Scale & Systems Hardening

Before broad release, attack every system from adversarial and failure perspectives.

Scope includes:

- security/penetration review;
- rate limits/abuse;
- privileged-access auditing;
- database/index/load performance;
- realtime/matchmaking load;
- combat concurrency;
- reconnect/version/replay races;
- PvP/multi-team regression;
- spectator privacy/delay/battle-key security;
- Expedition concurrency/suspension;
- economy/item/marketplace/crafting duplication races;
- inventory/equipment/Weight/loadout races;
- event scheduling/restart/cleanup;
- progression/Horizon/Passive Training boundaries;
- Rekindling preserve/reset correctness;
- AI legality/determinism/pathfinding/boss regression;
- Battle Hall reward/spoiler isolation;
- Homestead privacy/storage/relocation;
- professions/resource-site abuse;
- referral fraud/alt-farming;
- title/badge/identity spoofing;
- public-information/spoiler leaks;
- rollback/recovery drills;
- human playtests across skill levels.

Future frontier hardening adds deterministic seed reproducibility, daily-cycle rollover/reconnect, anchored-location integrity, generation reachability/performance and reward idempotency.

---

# 🔜 Phase 16 — The Uncharted Frontier & Continuing Threat

**Phase 16 is a long-term/post-core expansion milestone.** It must not delay proving the core tactical RPG.

## Goal

Make the edge of the known world an enduring exploration/endgame system that can keep expanding without requiring the stable authored Atlas to become physically enormous.

## The Verge

The known Atlas eventually reaches a stable authored frontier boundary, working name **The Verge**.

At an eligible crossing, players deliberately enter a separate exploration layer rather than infinitely scrolling the ordinary world map.

## The Uncharted

Working name **The Uncharted**.

It should feel vast and near-infinite through **shared deterministic recombination of authored content**, not uncontrolled meaningless random generation.

Core structure:

- server-authoritative frontier cycle/seed;
- daily as the initial shift target;
- same active cycle shared by players on the same world/server;
- authored terrain sectors/nodes;
- hazards;
- encounters;
- camps;
- ruins;
- lore sites;
- rare landmarks;
- battlefields;
- event overlays;
- temporary Expedition entrances;
- progressive reveal;
- depth bands.

A shared daily truth means players can discuss today's routes, coordinate discoveries and form a real exploration community.

## Anchored vs drifting locations

**Anchored locations** persist as meaningful long-form authored destinations even if routes change.

**Drifting locations** are temporary/reconfigured points generated by the active frontier cycle.

This lets geography feel unstable without making storytelling impossible.

## Lore integration

The mature explanation ties the frontier to existing Unchosen/Unmoored/Closed Horizon mythology.

The deepest outer territories are less stable and more vulnerable to possibility pressure. Players should discover this explanation gradually rather than receiving it on entry.

## Why players go there

Motivations can include:

- charting routes;
- discovering anchored landmarks;
- Archive evidence;
- rare equipment/materials;
- elites/bosses;
- supernatural rites;
- rare sidegrade Disciplines;
- breach stabilization;
- rescue/escort/survey work;
- temporary Expeditions;
- community mapping;
- predicting known-world threats;
- social prestige;
- later Rekindling/Cycle Focus objectives.

## Frontier familiarity / legendary explorer status

Persistent exploration renown should come from varied accomplishments such as depth, discoveries, distinct frontier cycles, hard extractions, lore, bosses and community first-witness achievements.

Highest recognition may use a future title such as **Legend of the Verge** or another final name.

Good advantages include:

- better route/anomaly forecasts;
- additional map interpretation;
- safer extraction knowledge;
- retained useful cartographic information;
- access to advanced frontier content;
- bounded Veteran Edge choices;
- balanced frontier Disciplines;
- Equipment Skills/equipment;
- rare Soulmark opportunities where lore supports them;
- cosmetics/titles/profile/Homestead trophies.

Do **not** create ordinary-player “Anomaly Skills” as a new unrestricted power layer. The existing Anomaly Character concept remains exceptional GAME OWNER-only supernatural state.

## Daily-shift safety

A world-cycle rollover must never delete active effort.

- active sessions pin to their current frontier version until safe transition;
- reconnect restores the correct version;
- earned rewards persist;
- no death/inventory loss merely because the clock changed;
- stale-session extraction is safe;
- client clock is never authority.

## The Horizonless — working threat concept

A distant supernatural people/host, working name **The Horizonless**, can be encountered first through signs and rare deep contact.

They should feel like a civilization/threat shaped by unstable possibility rather than generic monsters.

Possible escalation:

1. **Signs** — missing surveys, contradictory maps, impossible tracks, altered ruins.
2. **Contact** — scouts, artifacts, hostile/ambiguous encounters, evidence of culture.
3. **Incursions** — outer-region crises, migrations, Great Vane instability.
4. **Persistent conflict** — campaigns, guild/nation objectives, frontier Expeditions, commanders and War of Possible Worlds arcs.

They are **not automatically simple servants of Aurevane**. Some may worship her, oppose her, fear her, flee deeper collapse or pursue their own incompatible goals.

Aurevane remains the principal mythic antagonist.

## Phase-16 gate

A mature frontier slice is ready when:

- consecutive cycles produce meaningfully different but coherent maps;
- multiple players share the same authoritative cycle truth;
- sessions survive rollover/reconnect safely;
- anchored landmarks remain narratively usable;
- exploration offers purpose beyond raw loot;
- expert explorers gain useful recognition/knowledge advantages;
- rare combat rewards are sidegrades or bounded;
- the space feels vast without empty procedural noise;
- lore connects naturally to existing canon;
- the distant threat creates intrigue/dread without dumping its full origin;
- future expansion is mostly authoring new modules rather than redesigning the system.

---

# FIRST FULL ENDGAME / REKINDLING GATE

Before Rekindling becomes a normal production feature, validate:

- engaged players cannot reach complete first-cycle eligibility before the configured long-horizon minimum;
- real gameplay milestones are required;
- progression remains rewarding throughout Levels 1–100;
- equipment/build discovery remains meaningful;
- Passive Training stays modest;
- Battle Hall does not become a progression/economy shortcut;
- enough PvE/PvP/world/story/lore content exists that the journey is not filler;
- endgame rite genuinely tests mastery;
- Rekindling preserves identity/history while resetting enough to create a new era;
- later cycles have multiple route/focus variants rather than one repeated checklist;
- beginner instruction can be safely compressed for veterans;
- prior-cycle Hall-of-Selves history has visible value;
- at least one prior-self/Echo-style interaction is proven before claiming the loop is meaningfully different;
- Veteran Edge has analytics/tests/kill switches/queue rules;
- human testing specifically asks whether the next cycle feels exciting or mentally exhausting.

---

# MATURE CLOSED ALPHA TARGET

Closed Alpha is a **quality/content gate, not a date promise**.

Target shape includes:

- roughly 16 playable Disciplines;
- initial Soulmark set around 8;
- meaningful Resonance coverage;
- pure-Discipline Essence coverage;
- representative equipment/Equipment Skills/Load buildcraft;
- 4 world regions;
- 20–30 enemies;
- 4–6 bosses;
- 50+ authored-role items;
- 20+ quests;
- Easy Expedition;
- Standard Expedition;
- 1 Deep Expedition;
- 1v1 PvP;
- 2v2 when population/test cohort supports it;
- PvP architecture that does not require a rewrite for 3v3/multi-team later;
- guild foundation;
- world-event/story capability;
- World Pulse;
- Archive/lore discovery;
- Battle Hall/AI Sparring/Battle Review foundation;
- competent reusable combat AI;
- safe owner/staff operations foundation;
- strong visual presentation;
- full audio coverage for the Alpha experience;
- telemetry sufficient to calibrate long-horizon progression.

The mature Uncharted/Horizonless campaign is **not** required for Closed Alpha. Alpha should preserve the architectural/lore seams that allow it later.

---

# TICKET RULE

Every implementation ticket must state:

- purpose;
- exact scope;
- files/modules affected;
- implementation approach;
- automated tests;
- acceptance criteria;
- manual verification;
- dependencies;
- which roadmap phase/gate it advances.

Build tickets use current Primary / Secondary / Skill / Resonance / Essence terminology.

Combat tickets identify the approved combat-grammar portion they implement.

Items/equipment tickets identify relevant effect/load/loadout/economy impact.

World/story tickets identify canon/spoiler impact.

PvP tickets identify supported participant/team/mode assumptions.

Player-facing changes identify Manual/News/Rules impact.

Only the assigned/current phase scope is implemented unless an explicit owner-approved execution mandate authorizes a wider verified workflow.

---

# FINAL ROADMAP PRINCIPLE

AUREVANE is intentionally ambitious, but development remains sequential:

```text
FOUNDATION
→ CHARACTER
→ COMBAT
→ SIGNATURE BUILDCRAFT
→ CORE CONTENT
→ LIVING WORLD
→ CO-OP
→ EXPEDITIONS
→ PvP / COLOSSEUM
→ FULL DISCIPLINE DEPTH
→ SOCIAL WORLD
→ ECONOMY / PROFESSIONS
→ NATIONS / HOMESTEADS
→ COMPLETE OPERATIONS
→ PRODUCTION POLISH
→ HARDENING
→ UNCHARTED FRONTIER & CONTINUING LONG-TERM EXPANSION
```

Rekindling is the long-horizon loop threading through those systems once the game has enough real content to make another character era worth beginning.

The core rule remains:

> **Make the core game genuinely good before making it enormous — but build the foundations so AUREVANE can eventually become enormous without losing coherence.**
