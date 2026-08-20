# AUREVANE — Canonical Implementation Roadmap

**Authority:** `docs/GAME_MASTER_PLAN.md` remains the highest-level game-design authority. This file is the **single canonical implementation-sequencing roadmap** for AUREVANE.

**Consolidated:** 2026-08-19

A roadmap phase is a development milestone, **not a promised calendar window**. Work advances through acceptance gates, automated verification, and human player validation where required.

---

# 0. ROADMAP AUTHORITY & NO-DRIFT RULE

AUREVANE accumulated several `docs/ROADMAP_*.md` integration documents while individual systems were designed. Their useful detail remains available, but they no longer define independent phase ordering.

The permanent rule is:

> **`docs/ROADMAP.md` is the only roadmap that answers what phase a feature belongs to, what is currently active, what comes next, and which gate must be passed before expansion.**

Specialized `ROADMAP_*` documents are supporting implementation/history references only. If one conflicts with this file, this file wins unless the Game Owner explicitly approves a roadmap revision.

When a future design changes implementation sequencing:

1. update the relevant authoritative domain/design document;
2. update **this canonical roadmap in the same change**;
3. update `AGENTS.md` when future agents need a new permanent rule;
4. update player-facing Manual/News/Rules when the change affects information players should know;
5. do not create another independent roadmap addendum as the sole phase authority.

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
- Rekindling cycles;
- later frontier exploration.

## Server authority

Combat, rewards, XP, Mastery, inventory, equipment, currency, crafting, marketplace state, PvP, quests, event participation, Passive Training, Rekindling and other valuable state remain server-authoritative.

The browser submits intent; it does not decide valuable outcomes.

## Presentation is not postponed

Art, audio, responsiveness, accessibility, readable feedback, loading/error states and player-facing information are part of each phase. Phase 14 is the dedicated production polish pass, not permission to ship ugly placeholders until then.

## Permanent public information

AUREVANE maintains three public information surfaces:

```text
/news
/manual
/rules
```

They remain available before sign-in and after sign-in.

- **News** communicates official updates, patches, events and consequential changes.
- **Manual** explains released mechanics and current player guidance.
- **Rules** explains conduct, fair play, competitive/economy/social policy and enforcement expectations.

Manual owns mechanics. Rules owns conduct/integrity. News communicates material changes.

Public information must distinguish **playable now** from **planned roadmap direction** and must remain spoiler-safe.

## Healthy retention

AUREVANE should create “I want to return” rather than “I am punished for missing a day.”

Allowed drivers include world changes, build discovery, seasons, lore, prestige, social activity, target farming, Expeditions, rotating encounters and experiential urgency.

Avoid destructive streaks, mandatory daily energy, permanent one-time missable meta power and pay-to-avoid-loss systems.

## Anti-pay-to-win commerce

Premium commerce is permitted only as a tasteful support/identity/convenience system that does not sell dominant gameplay power.

Do not sell progression skips that invalidate the long character journey, stronger PvP gear, Mastery, Resonance/Essence power, Soulmark/Mantle power, extra competitive Veteran Edge power, rating, or cash-only meta-defining combat options.

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
- stable IDs and extensible schemas for later build/economy/social systems;
- future entitlement/payment/webhook architecture awareness without premature commerce implementation.

**Gate:** clean build, deployable environment, documented setup and production-style authority boundaries.

**Status:** substantially complete.

---

# ✅ Phase 1 — Character, Progression & Public Information Foundation

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
- Online Users foundation already present in the current product;
- initial item ownership/equipment boundaries;
- core equipment slots;
- Armory/build presentation foundations;
- current Passive Training Short / Medium / Extended flow;
- idempotent training/report/reward behavior;
- public **News** foundation;
- public **Manual / Adventurer's Guide** foundation;
- public **Rules** foundation;
- anonymous public access to `/news`, `/manual`, `/rules` with responsive/accessibility expectations;
- source-controlled/validated early editorial content rather than premature full CMS.

Public information should truthfully cover released Phase-1 systems and distinguish current features from future roadmap vision.

Future item Weight, professions, deeper presence, Friends, notifications, Rekindling and other systems should remain representable without being prematurely implemented.

**Gate:** a player can create, persist and return to a valid authoritative character; public News/Manual/Rules are usable and spoiler-safe; the model safely anticipates later progression/build layers.

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
- retreat/surrender/exit behavior where approved combat addenda require it;
- battle VFX/audio hooks;
- stable media descriptors and replaceable battle-scene/audio assets;
- reconnect-safe persistence;
- deterministic legal Recruit AI;
- AI debug/reason hooks and regression states;
- **Battle Hall**;
- **AI Sparring** and focused practice;
- desktop/mobile/touch validation;
- combat Manual expansion and meaningful combat News/Rules updates;
- human player-feedback iteration.

### Equipment Load compatibility

If representative Phase-2 equipment makes a real Weight/Load proof useful, test a small light-versus-heavy tradeoff. Do not delay the combat proof to manufacture an unfinished weight ecosystem.

### Future compatibility only

Do not build full Resonance/Essence libraries, player-facing Soulmark/Mantle systems, multiplayer PvP, frontier generation, full economy or mature social systems here.

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
- AI Skill/passive metadata using current terminology and information-concealment rules;
- first safe content-authoring/validation tools;
- supernatural data compatibility without forcing player-facing awakening before the world/story can support it;
- public Manual buildcraft guidance using current Primary/Secondary/Resonance/Essence terminology.

No separate Trait, Reaction, Movement Art or Ultimate slot systems return.

**Gate:** players can understand and enjoy meaningful pure-versus-mixed choices and equipment/load tradeoffs without requiring the later supernatural system to make the buildcraft interesting.

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
- AI Profiles/Skill Packages/passive/objective metadata;
- VFX/SFX;
- PvE/PvP validation;
- analytics;
- stable media relationships rather than scattered hard-coded asset URLs.

Representative content should include:

- meaningful equipment/consumables;
- Light/Standard/Heavy build archetypes where Load is active;
- varied battlefields/objectives;
- enemy families using genuinely different tactical patterns;
- larger Battle Hall scenario coverage;
- spoiler-safe possibility/echo-like combat primitives that can later support supernatural enemies without bespoke engine hacks.

**Gate:** representative Disciplines, pure/mixed routes, equipment and maps feel materially different and fun.

---

# 🔜 Phase 5 — Living World, Supernatural Awakening, Events, Navigation & Early Operations

**Goal:** connect character/combat/build systems into a persistent inhabited world and introduce the first story-supported supernatural choice.

## Living world & story

- World Atlas/map;
- regions, settlements, roads and travel/presence;
- NPCs/dialogue;
- encounter system;
- quest engine;
- initial story;
- global/region/node/player world-state layers;
- initial Horizon/world progression gates;
- location-coherent battle scenes;
- battle-to-world state/reward return;
- protected quest/key-item rules;
- known acquisition/vendor links.

## Persistent events & World Pulse

- data-driven world events;
- event templates/runs/phases/objectives;
- scheduling;
- restart recovery/idempotency;
- map/NPC/quest/encounter/reward/media effects through typed approved systems;
- community objectives;
- aftermath;
- World Pulse / since-you-were-away context;
- Chronicle history.

## Archive & lore discovery

- Archive foundation;
- Fragment Sets;
- source provenance;
- contradictions;
- Great Vane/Unmoored foreshadowing appropriate to story stage;
- no late antagonist truth exposed merely because the data exists.

## Strategic navigation

- map layers/persisted filters;
- quest/event/service/travel/lore/combat-location filtering;
- coordinate/compass guidance;
- exact tracked objectives;
- approximate search areas;
- clue-led hidden objectives;
- no client delivery of undiscovered markers merely to hide them visually.

## Presence & notifications

Phase 5 grows the existing early Online Users foundation into a meaningful shared-world presence system:

- authenticated presence/lease model;
- trustworthy visible online count;
- responsive Adventurers Online roster;
- safe search/browse;
- coarse activity/region where appropriate;
- Online/Away/Busy and Appear Offline/privacy boundaries;
- no private account identity leakage.

Notification foundation begins here because the world now creates real things worth notifying about:

- typed notification domain;
- persistent unread state;
- restrained authenticated alerts control;
- News unread state;
- important world/event/system alerts;
- deep links that re-authorize against source systems.

Friends do **not** need to wait until Phase 10; they arrive in Phase 6.

## Supernatural fork & first proof set

Phase 5 is the first player-facing supernatural milestone because the world/story can now support it.

Implement:

```text
UNAWAKENED
SOULMARKED
SOUL_SEVERED
```

with:

- server-authoritative permanent fork;
- strong confirmation;
- Character Profile Supernatural section;
- story/Horizon/level/mastery/rite requirement grammar;
- first varied Soulmark proof set;
- Soulmark Skills outside 6/8 Discipline Skill capacity;
- meaningful Soulmark strengths/weaknesses;
- **The Severance**;
- at least one ordinary Mantle acquisition route;
- **Mantle I — Tempered Manifestation**;
- Mantles amplify/modify the equipped build and grant no new active Skills;
- readable invocation/Afterstrain state.

Initial level/Horizon numbers remain data-driven and domain-doc governed; reaching a level alone never automatically grants supernatural content.

## Quiet-world / Tavern proof

Introduce one small authored Tavern/Common Room/social-hearth experience and first **Roadwright** proof after a representative settlement exists.

Roadwright is optional low-intensity play for lore texture, Rumor Leads, social atmosphere and communal state—not an AFK/progression/Crown farm.

## Resource Site foundation

Introduce a small authoritative world-side Resource Site model so later professions can reuse the same map/world framework.

## Referral foundation — feature flagged

Build referral attribution/qualification infrastructure only after the living world and return-loop telemetry exist:

- opaque account-linked referral identity;
- one-referrer attribution boundary;
- composite active-play qualification;
- anti-self-referral/fraud risk state;
- notification compatibility;
- independent feature flag.

The **rewarded public referral program remains disabled until the Retention Loop / PV-3 evidence says the product is ready to ask players to recruit friends.**

## Early owner/staff operations

The protected `/master` shell gains only the slices needed for Phase 5:

- fixed approved role/security boundaries;
- event/story/lore operations;
- Public Communications MVP for News/Manual/Rules drafting, preview and controlled publication;
- safe event-linked AI composition using approved AI Profiles/Skill Packages/Objective Profiles;
- minimum useful media operations: search, upload/import, preview, provenance, approve/publish/replace/rollback and content-reference lookup;
- representative world/story art/audio replaceable without editing application source.

## Known-world frontier foundation

The authored Atlas should visibly end rather than pretending the whole world is already mapped.

Phase 5 may establish:

- distant frontier regions;
- rumors of missing roads/survey parties;
- unstable cartography;
- future Verge crossing locations;
- event hooks for threats originating beyond mapped territory.

Do **not** build the mature shifting Uncharted here.

**Gate:** explore → encounter → battle → quest/reward → persistent progress works as one coherent loop; supernatural choice feels story-earned and understandable; the world looks inhabited; and staff can safely operate a real event/public communication/media replacement without routine code deployment.

---

# 🔜 Phase 6 — Friends, Party & Co-op

**Goal:** make playing with real people a dependable part of AUREVANE before the mature social world arrives.

## Core Friends system

Friends move here rather than waiting until Phase 10.

Implement:

- Send / Accept / Decline / Cancel Friend Request;
- Remove Friend;
- block/safety override;
- request limits/cooldowns;
- dedicated Friends surface: Online / All Friends / Requests / Recent Players;
- presence integration;
- friend-request/acceptance notifications;
- privacy-safe friend presence;
- no social relationship authority based on mutable character-name strings.

## Parties & co-op

- parties up to 3 players;
- realtime party state;
- co-op tactical battles;
- shared quests/objectives;
- party finder;
- friend/presence-origin party invites;
- pings/action visibility;
- player-specific story flags in shared content where necessary;
- reconnect/ownership flow;
- coordinated enemy AI;
- allied NPC AI where required;
- multi-unit Battle Hall drills;
- party-compatible map waypoints without leaking hidden knowledge;
- future frontier-session version compatibility.

There is no mandatory MMO trinity.

## Party communication

Add appropriate Party chat/communication with authoritative membership, bounded history/reconnect, moderation/block safety and responsive UI. Mention notifications may be added here if they do not delay co-op; otherwise preserve compatibility for Phase 10.

## Referral program launch — product gated

If Retention Loop / PV-3 evidence is strong enough, Phase 6 may launch the public referral program:

- Invite Friends/referral surface;
- referral code/link;
- qualified/pending recruit counts without private recruit telemetry;
- milestone rewards;
- cosmetic/account-service reward classes only;
- no combat/progression/economy power;
- Friends integration;
- qualification/reward notifications;
- anti-fraud review.

If the product is not retaining new players well, **do not launch rewarded referrals just because the backend exists.**

**Gate:** three humans can complete a mission together, each controlling their own character; two players can become/remove/block friends safely; party communication is dependable; reconnect/state handling is authoritative.

---

# 🔜 Phase 7 — Expeditions & Deeper Supernatural Progression

**Goal:** deliver AUREVANE's repeatable dungeon/adventure pillar and prove advanced supernatural timing in longer encounters.

## Expeditions

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
- advanced AI/boss phase profiles;
- long-run replay/version/performance verification;
- profession Resource Sites where appropriate later.

Expeditions establish reusable seeded-content technology for the future Uncharted, but the systems remain distinct: Expeditions are bounded runs; the Uncharted is a shared shifting outer-world layer.

## Mantle II & deeper Soulmarks

Introduce **Mantle II — Full Manifestation** after appropriate advanced progression/rite requirements exist.

- stronger temporary manifestation;
- serious Afterstrain;
- no new Mantle Skills;
- player who has II may still choose I;
- server snapshots chosen invocation level;
- reconnect cannot reset manifestation/Afterstrain.

Expand Soulmark design into more complex authored mechanics such as summons, teleport/spatial control, AoE mutation, elemental conversion, poison/DoT, terrain/zones, healing/defensive mutation and combo/risk-reward identities where combat readability supports them.

**Gate:** a roughly hour-scale three-player Deep Expedition is fully playable, resumable and memorable without reward duplication/soft locks; advanced supernatural mechanics remain understandable and fair.

---

# 🔜 Phase 8 — PvP, Colosseum & Spectation

**Goal:** make AUREVANE tactical combat competitive, social and watchable.

## Core competitive foundation

- direct challenges;
- friend Challenge/Spar actions;
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

## Supernatural competitive safety

- Soulmark branch/state pinned before battle;
- Mantle identity/attained invocation cap pinned;
- invocation level authoritative;
- queue rules can normalize/disable specific supernatural content;
- reconnect cannot restore Mantle or erase Afterstrain;
- standard ranked rejects Owner-only anomaly overrides by default.

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
- Friends Fighting discovery where privacy permits;
- completed-match/replay continuity;
- later featured/tournament presentation.

## Public Rules expansion

Before serious ranked/tournament play, publish competitive-integrity rules for issues such as win trading, rating manipulation, queue collusion, match fixing, timer/disconnect abuse and exploit use.

**Gate:** competitive matches are authoritative/fair, queue health is measurable, multi-format architecture is sound, and spectation cannot leak hidden information or grant mutation authority.

---

# 🔜 Phase 9 — Full Discipline & Supernatural Catalog Scale

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

## Soulmark catalog

Grow only when quality warrants it:

- proof set: small/diverse;
- broad catalog: approximately 24–36;
- mature catalog: approximately 48–72;
- architecture supports 100+ over the lifetime only if additions remain genuinely distinct.

Support 1-branch focused Soulmarks, 2 branches for most, and 3 branches for rare/complex marks.

## Six ordinary Mantles

Mature high-level target: **six distinct ordinary Mantles**, each supporting earned Level I and II invocation where attained.

Mantles grant no additional active Skills.

Do not create 36 Disciplines or dozens of Soulmarks as shallow reskins merely to satisfy catalog numbers.

---

# 🔜 Phase 10 — Mature Social World, Tavern, Identity & Community

**Goal:** make players recognizable people inside a persistent community.

Scope includes:

- mature Friends experience;
- richer Recent Players;
- privacy/presence preferences;
- blocking and safety boundaries;
- direct messages / Whispers;
- notification/attention expansion;
- guilds;
- guild quests/progression;
- social profiles;
- moderation/report tooling;
- social recognition / Chronicle hooks;
- build-share cards where approved;
- richer Colosseum friend/replay integration;
- Homestead visit-permission foundations;
- Rekindling/Hall-of-Selves presentation foundations.

## Common Room / Tavern social layer

Mature general social communication begins here:

- Common Room/local social-hearth chat;
- Guild chat;
- Whispers/DMs;
- server-authorized channel membership;
- bounded history/reconnect;
- block/report/mute/DND;
- rate limiting/anti-flood;
- responsive non-reflowing chat UI;
- no paid chat priority.

Roadwright may expand with richer friend/guild/community presentation, finished-table sharing and regional flavor only if real usage supports the production cost.

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

## Public communications maturity

News/Manual/Rules gain scheduled publishing, revisions/supersession, stale-content detection, richer preview and role/capability-aware review flows.

**Gate:** players can build persistent relationships and recognizable identities without sacrificing privacy, safety or competitive integrity.

---

# 🔜 Phase 11 — Economy, Professions, Trade House & Premium Commerce Foundation

**Goal:** create an understandable player economy around useful items rather than many token currencies, while introducing real-money commerce only through safe non-P2W boundaries.

Primary tradable currency remains **Crowns**.

## Player economy

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

## Premium commerce foundation

When account/economy systems are mature enough:

- Premium Shop catalog/content model;
- purchase ledger;
- non-P2W entitlement fulfillment service;
- initial PayPal provider adapter direction;
- sandbox checkout;
- verified webhook processing;
- idempotency/reconciliation;
- player Purchase History;
- initial Premium Commerce `/master` operations;
- understated Support AUREVANE / premium entry rather than intrusive sales prompts.

Real production payments remain disabled until Phase-15 commerce/security/operational acceptance is complete.

## Public Rules expansion

Publish relevant economy/trading policy before abuse opportunities become real, including scams/deception, prohibited RMT/account sales/market abuse where the final policy requires it.

**Gate:** acquisition, ownership, storage, crafting, professions, trade and commissions are coherent/server-authoritative without duplication, trust scams, key-item loss or inventory-management misery; premium sandbox fulfillment cannot grant gameplay power or duplicate entitlements.

---

# 🔜 Phase 12 — Nations, Sovereign Territory, Homesteads & Nation Social Layer

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

## Nation Hearth & Open Road

Introduce mature large-scale social channels only when Nations and the economy exist.

**Nation Hearth:** nation-wide chat tied to authoritative allegiance with moderation/privacy controls and no hidden war-state leakage.

**Open Road:** optional cross-nation/world chat with server-authoritative time allowance rather than a permanent unlimited global spam channel.

Current design direction supports a limited free daily allowance and an ordinary in-game **Roadspeaker Writ** Crown sink for bounded extra time. Open Road time is not sold for real money.

**Gate:** nation territory feels coherent; an eligible player can own, decorate, use, visit and safely relocate a persistent home; nation social channels are safe/scalable; none of these systems create P2W power or world-land scarcity.

---

# 🔜 Phase 13 — Complete Master Panel & Long-Horizon Operations

**Goal:** make AUREVANE safely operable without routine raw production edits.

Some tooling exists earlier; Phase 13 consolidates the complete operating system.

Scope includes:

- Owner Command Center;
- approved staff role model and granular permissions;
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
- **complete Asset Studio** with versioning/provenance/approval/replacement/rollback and optional approved generation-provider connectors;
- Balance Lab;
- Combat Content Studio;
- **AI Content Studio**;
- **Combat AI Lab** with AI-vs-AI/batch/version benchmark tooling;
- Battle Hall record/unlock configuration;
- Pacing Simulator;
- Horizon/Passive Training/Rekindling/Veteran Edge controls;
- title/badge/Vowbond/referral support;
- Public Communications complete: News / Manual / Rules editors, calendar, revision history, dependency/drift warnings and safe rollback;
- build/combat/economy/social telemetry;
- feature flags;
- diff/history/staging/publish/rollback;
- narrative canon/spoiler publication rights.

## GAME OWNER-only supernatural anomaly operations

Phase 13 is also the home for exceptional Anomaly Character controls that ordinary players cannot earn, buy, receive from referrals or access through generic staff permissions.

Supported owner-only exceptional concepts include approved combinations such as:

- Dual Soulmark;
- Dual Mantle access;
- Soulmark + Mantle;
- **Mantle III — Transcendent Manifestation** eligibility.

Mantle III has no ordinary acquisition path. Standard ranked/tournaments reject anomaly overrides by default.

These controls require exact target resolution, warnings, reason/audit, safe revocation and strong Owner-only authorization.

## Premium Commerce complete operations

Add/polish:

- product editor;
- scheduled publish/retirement;
- grant validation;
- transaction/refund/dispute search;
- reconciliation dashboard;
- revenue/product analytics;
- commerce permissions;
- checkout/provider kill switches;
- audit history.

## Future Rekindling operations

Add Cycle Focus definitions, alternate qualification pools, veteran shortcut configuration, Hall-of-Selves/Echo templates and anti-fatigue telemetry before repeated cycles are broadly live.

## Future frontier operations

When Phase 16 exists, add frontier seed/cycle controls, authored sector/POI pools, anchored/drifting locations, depth bands, threat-stage controls, safe rollback and stranded-session support.

**Gate:** normal operation, authoring, balance, simulation, delegation, publication and repair occur through validated audited tools rather than direct production credentials.

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
- Mantle I/II and owner-only III intensity/readability differences;
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
- Tavern/Roadwright presentation;
- professions/Trade House/premium-shop presentation;
- Rekindling/Hall of Selves presentation;
- future Verge/Uncharted visual/audio language.

Target: a beautiful browser RPG, not a database website wearing fantasy art.

---

# 🔜 Phase 15 — Security, Scale, Commerce & Systems Hardening

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
- spectator privacy/delay/Battle-Key security;
- Expedition concurrency/suspension;
- economy/item/marketplace/crafting duplication races;
- inventory/equipment/Weight/loadout races;
- event scheduling/restart/cleanup;
- progression/Horizon/Passive Training boundaries;
- Rekindling preserve/reset correctness;
- AI legality/determinism/pathfinding/boss regression;
- Battle Hall reward/spoiler isolation;
- Soulmark/Mantle invocation/reconnect/Afterstrain exploits;
- Owner-only Anomaly authorization/ranked isolation;
- Homestead privacy/storage/relocation;
- professions/resource-site abuse;
- referral fraud/alt-farming/household false positives;
- title/badge/identity spoofing;
- public-information/spoiler/publication leaks;
- chat/moderation/block/privacy abuse;
- rollback/recovery drills;
- human playtests across skill levels.

## Premium commerce hardening before real-money production launch

Validate:

- provider sandbox/production separation;
- payment/webhook authenticity;
- duplicate-delivery idempotency;
- captured-but-unfulfilled recovery;
- refunds/disputes;
- rate limits/fraud cases;
- purchase-history accuracy;
- no P2W grants in production catalog;
- cosmetic PvP readability;
- applicable merchant/tax/refund/privacy/age/consumer/regional requirements with appropriate professional guidance where needed.

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
- guild/nation sponsored exploration;
- Rekindling/Cycle Focus objectives.

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
- at least a representative Soul-Severed/Mantle proof path;
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
- core Friends/party foundation;
- guild foundation;
- world-event/story capability;
- World Pulse;
- Archive/lore discovery;
- public News / Manual / Rules;
- Battle Hall/AI Sparring/Battle Review foundation;
- competent reusable combat AI;
- safe owner/staff operations foundation;
- strong visual presentation;
- full audio coverage for the Alpha experience;
- telemetry sufficient to calibrate long-horizon progression.

The mature Uncharted/Horizonless campaign is **not** required for Closed Alpha. Alpha should preserve the architectural/lore seams that allow it later.

The rewarded referral program and real-money premium checkout are also not mandatory Alpha gates if product/commerce validation says they should remain disabled.

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
→ CHARACTER / PUBLIC INFORMATION
→ COMBAT
→ SIGNATURE BUILDCRAFT
→ CORE CONTENT
→ LIVING WORLD / SUPERNATURAL AWAKENING
→ FRIENDS / CO-OP
→ EXPEDITIONS / DEEPER SUPERNATURAL
→ PvP / COLOSSEUM
→ FULL DISCIPLINE & SUPERNATURAL DEPTH
→ MATURE SOCIAL WORLD
→ ECONOMY / PROFESSIONS / COMMERCE FOUNDATION
→ NATIONS / HOMESTEADS
→ COMPLETE OPERATIONS
→ PRODUCTION POLISH
→ HARDENING
→ UNCHARTED FRONTIER & CONTINUING LONG-TERM EXPANSION
```

Rekindling is the long-horizon loop threading through those systems once the game has enough real content to make another character era worth beginning.

The core rule remains:

> **Make the core game genuinely good before making it enormous — but build the foundations so AUREVANE can eventually become enormous without losing coherence.**
