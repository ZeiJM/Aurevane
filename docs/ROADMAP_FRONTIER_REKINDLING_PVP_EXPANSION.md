# AUREVANE — Roadmap Addendum: Frontier, Rekindling Replayability & Expanded PvP

**Authority:** Binding roadmap integration for `docs/GAME_MASTER_PLAN_FRONTIER_REKINDLING_PVP_ADDENDUM.md`, subordinate to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/ROADMAP.md`, `docs/WORLD.md`, `docs/PROGRESSION_RETENTION.md`, `docs/PVP_SPECTATION_COLOSSEUM.md`, and `docs/LORE_BIBLE.md`.

**Direction approved:** 2026-08-19.

This roadmap addendum integrates the following owner-approved direction without expanding the current Phase-2 implementation scope prematurely:

- Rekindling cycles must differ materially in route/content emphasis;
- a stable known-world boundary eventually opens into **The Verge** and a shifting outer map, **The Uncharted** (working names);
- the Uncharted uses shared deterministic world-cycle seeds, persistent discovery/renown, anchored landmarks and shifting connective geography;
- deep frontier lore is tied to existing Unchosen / Unmoored / Closed Horizon mythology;
- a distant supernatural people/host, working name **The Horizonless**, becomes a long-running threat without replacing Aurevane as the principal antagonist;
- mature PvP supports 1v1, 2v2, 3v3, flexible 1–3 vs 1–3 Clash formats, and 1v1v1, while 1v1 remains the standard competitive baseline;
- permanent queue count remains population-gated.

The complete mature Uncharted system is **not** a Closed Alpha requirement unless a later owner-approved milestone explicitly moves part of it earlier.

---

# Current Phase 2 — Tactical Combat Core

Do **not** implement the mature frontier, Rekindling-variance or expanded PvP stack during the current combat-core validation phase.

Only preserve compatibility where it naturally follows existing combat architecture:

- battle state should not assume every future encounter must contain exactly two participants;
- team/faction identity should avoid unnecessary binary assumptions where practical;
- deterministic seed/version handling should remain reusable for later generated content;
- Battle Review/Hall-of-Selves-friendly history should not be blocked by throwaway state models;
- combat targeting/effect rules should remain generic enough for multiple allies/enemies later without implementing multi-team PvP now.

No Phase-2 ticket should be widened merely to build these future systems.

---

# Phase 3 — Signature Buildcraft Identity

No mature frontier implementation is required.

Compatibility requirements:

- rare future frontier Discipline acquisition must use the normal Discipline/Mastery model;
- frontier-earned combat options should enter through existing channels such as Discipline Skills, Equipment Skills, Soulmarks or Veteran Edge—not create an unbounded parallel Skill economy;
- GAME OWNER-only Anomaly Character rules remain exceptional and are not repurposed as ordinary frontier progression.

---

# Phase 4 — First Playable Discipline Set / Core Content

Use representative combat content to prove that future unusual enemies can express possibility/identity mechanics through typed combat rules rather than bespoke hacks.

Possible non-spoiler prototype shapes include:

- enemies with controlled alternate states;
- terrain with authored multi-state transitions;
- echo-like temporary units;
- formation-based enemy behavior.

Do not reveal the Horizonless or late Unchosen truth merely to test these primitives.

---

# Phase 5 — Living World, Story & Live Operations Foundation

Phase 5 establishes the **known world side** of the future frontier.

Add to Phase-5 world planning:

- visibly incomplete outer cartography / authored map boundary;
- one or more stable far-frontier regions/roads that can later lead to Verge crossings;
- spoiler-safe folklore about unreliable maps, vanished roads and distant supernatural danger;
- world-state/event support for threats originating beyond ordinary mapped regions;
- Archive categories capable of recording disputed frontier reports;
- World Pulse support for warnings/discoveries originating at the edge of mapped territory;
- narrative hooks that can later connect Great Vane / Unmoored instability to the frontier;
- transition architecture capable of opening a separate outer exploration layer later.

Do **not** require the mature daily-shifting Uncharted map for the Phase-5 gate.

The Phase-5 story should be able to foreshadow that the known world is not the full world without explaining why.

---

# Phase 6 — Party & Co-op

Preserve future frontier party compatibility:

- party travel can transition all eligible members into a separate world/exploration layer;
- party state can remain tied to a world/content version;
- party reconnect can restore the correct seeded content version;
- survey/rescue/escort objectives can be shared;
- one player's disconnect cannot silently regenerate the party's active frontier layout.

No full frontier implementation is required yet.

---

# Phase 7 — Expeditions

Phase 7 creates technology and content patterns that can later be reused by the Uncharted without making the two systems identical.

Relevant reusable capabilities:

- deterministic seeded layout composition;
- authored modular rooms/sectors;
- progressive reveal;
- version-pinned active sessions;
- reconnect/resume;
- temporary modifiers;
- rare authored landmarks inside generated structure;
- long-run performance testing;
- procedural variety backed by authored content rather than uncontrolled generation.

Important distinction:

- **Expeditions** are bounded dungeon/run experiences;
- **The Uncharted** is a shared outer-world exploration layer whose daily macro-layout can change.

Do not merge them into one feature just because they share generation primitives.

---

# Phase 8 — PvP: Flexible Format Foundation

Phase 8 remains the primary PvP implementation phase.

Expand the mature PvP scope from fixed 1v1/2v2 assumptions to a **participant/team framework**.

## Required baseline

- direct challenges;
- casual 1v1;
- ranked 1v1;
- Arena Tempering;
- matchmaking;
- disconnect protection;
- seasons;
- tournament framework;
- competitive telemetry;
- mode-aware spectator/Colosseum metadata;
- server-authoritative team/faction membership.

**1v1 remains the first standard ranked reference mode.**

## Team formats

Support architecture for:

- 2v2;
- 3v3;
- each player controlling their own character;
- mode-specific rating/records;
- multi-participant reconnect/forfeit handling;
- team-aware victory conditions.

2v2/3v3 permanent ranked queues only activate when concurrency data supports them.

## Clash — 1–3 vs 1–3

Working player-facing name: **Clash**.

Allow custom/casual/direct battles such as:

```text
1v1
1v2
1v3
2v2
2v3
3v3
```

Uneven team sizes are initially challenge/custom/event formats, not ordinary fair ranked matchmaking.

If a future event adds handicap rules, the handicap is explicit, public, deterministic and versioned.

## Three-way format — 1v1v1

Support a battle membership model capable of three mutually hostile participants.

Initial use:

- casual;
- custom;
- rotating event;
- tournament exhibition after validation.

Do not launch ranked 1v1v1 until kingmaking/scoring/rating behavior has been validated.

Candidate victory models include last-standing or transparent score/objective rules.

## Phase-8 expanded-PvP gate

Before the flexible format framework is considered mature:

- friend/foe legality works for more than two teams;
- AoE/status/summon/objective rules understand team identity;
- battle UI remains readable up to the planned six-character 3v3 ceiling;
- disconnect/forfeit logic works for teams and free-for-all;
- spectator/replay output handles every participant;
- mode-specific rankings do not contaminate 1v1 rating;
- asymmetric matches are clearly labeled;
- queue activation remains population-gated.

---

# Phase 9 — Full Discipline Roster

As build variety grows:

- 2v2/3v3 balance review becomes part of released-Discipline validation when those modes are active;
- do not balance every Discipline only around 1v1 damage output;
- test team utility, setup, support, control, summon and terrain interactions;
- preserve 1v1 viability without requiring every build to excel equally in every mode.

Rare frontier-origin Disciplines may eventually enter the roster in controlled batches after the Uncharted exists. They remain sidegrades and follow normal 8-Skill / Essence / Resonance requirements.

---

# Phase 10 — Social World

Add future hooks for:

- sharing daily frontier discoveries;
- friend/guild expedition planning toward the Verge;
- recent-player recognition from frontier groups;
- public titles/badges for frontier achievements;
- Hall-of-Selves presentation becoming useful for later Echo Encounters;
- social profile PvP records by meaningful mode rather than one universal rating.

No mature frontier map required solely because social hooks exist.

---

# Phase 11 — Economy

When the frontier arrives later, it uses the normal economy/item pipeline.

Plan compatibility for:

- frontier-origin materials;
- rare equipment;
- target-farmable frontier enemies/landmarks;
- provenance showing where rare discoveries came from;
- recurring acquisition paths for important build options;
- no one-day-only permanent meta-defining power;
- safe trading/binding rules for frontier rewards.

The Uncharted must not become an inflation faucet that bypasses the normal loot/economy services.

---

# Phase 12 — Nations

Nations create a strong narrative bridge to the frontier.

Future scope may include:

- nation-sponsored surveys;
- frontier defense objectives;
- different nation interpretations of unexplained outer threats;
- competitive/cooperative charting initiatives;
- nation campaigns responding to incursions;
- public recognition for major discoveries;
- authored Verge gates/routes associated with different regions/nations where world geography supports it.

Do not let one nation permanently monopolize access to essential frontier progression.

---

# Phase 13 — Master Panel / Operations

Add future operational capability for the expanded systems when they exist.

## Rekindling operations

- Cycle Focus definitions;
- veteran shortcut configuration;
- cycle-specific objective pools;
- Echo Encounter templates;
- Hall-of-Selves projection/version controls;
- Rekindling anti-fatigue telemetry;
- kill switches for problematic veteran advantages.

## Frontier operations

- frontier cycle/seed version controls;
- authored sector/POI pools;
- anchored vs drifting location definitions;
- depth-band rules;
- reset cadence;
- event overlays;
- rare discovery tables;
- renown/legend milestones;
- frontier threat stage configuration;
- emergency pin/freeze/rollback of a bad frontier cycle;
- spoiler/canon controls;
- safe support tools for stranded sessions.

## PvP operations

- enable/disable modes by population/event;
- 1v1/2v2/3v3 queue configuration;
- Clash custom-rule templates;
- 1v1v1 event configuration;
- ratings/season policy per mode;
- tournament format controls;
- spectation policy per mode;
- emergency queue shutdown.

---

# Phase 14 — Art & Audio Production Polish

Future presentation should make the far frontier immediately feel unlike ordinary regions.

Potential direction:

- known-world Atlas visually fading into incomplete/uncertain cartography;
- Verge crossing presentation;
- shifting map transitions;
- anchored landmark visual identity;
- Unmoored geography that remains readable rather than visual noise;
- unique ambient soundscape that changes with depth/instability;
- distant Horizonless motifs introduced before full visual reveal;
- explorer/Legend presentation on profiles and Homesteads;
- Echo Encounter visual treatment that distinguishes historical self from a real second character;
- mode-readable PvP presentation for 1v1, teams and 1v1v1.

The frontier should feel mysterious because of controlled art/audio/narrative design, not because the player cannot understand the interface.

---

# Phase 15 — Hardening

Add dedicated future verification for:

## Rekindling

- second-cycle progression route integrity;
- shortcut authorization;
- no duplicate rewards from alternate routes;
- Hall-of-Selves/Echo projection correctness;
- old-cycle state cannot corrupt current-cycle authority;
- veteran advantages remain bounded in ranked play.

## Frontier

- deterministic daily seed reproducibility;
- seed/version rollback;
- anchored locations remain stable where promised;
- active sessions pin the correct frontier version across reset;
- reconnect/resume across daily rollover;
- no reward duplication during shift;
- no forced loss/death due solely to reset;
- reachability and impossible-sector validation;
- generation performance under many simultaneous explorers;
- spoiler-safe payloads;
- economy/reward idempotency;
- stale-session extraction/support flow.

## Expanded PvP

- 3v3 load/realtime tests;
- 1v1v1 friend/foe/targeting property tests;
- multi-team AoE/status/summon/objective regressions;
- uneven-match labeling/rules;
- rating separation;
- disconnect/forfeit edge cases;
- spectator/replay correctness for 3+ teams/participants;
- queue-fragmentation telemetry and kill switches.

---

# Phase 16 — The Uncharted Frontier & Continuing Threat

**Phase 16 is a long-term/post-core expansion milestone.** The project may prototype pieces earlier only when a preceding gate genuinely needs them.

## Goal

Turn the edge of AUREVANE's known world into an enduring exploration/endgame system that can continue expanding without requiring the authored core Atlas to become physically enormous.

## Core scope

- **The Verge** as a stable authored world boundary;
- explicit crossing into **The Uncharted**;
- deterministic shared daily frontier seed/cycle;
- sector/node generation from authored modules;
- progressive reveal;
- anchored and drifting locations;
- depth bands;
- safe camps/extraction/return rules;
- reconnect/version pinning;
- frontier-specific hazards and encounter families;
- rare lore sites;
- world-event overlays;
- temporary Expedition entrances;
- community mapping/discovery objectives;
- frontier Archive provenance;
- Frontier Familiarity / Verge Renown progression;
- public legendary exploration recognition;
- Homestead trophies and social identity rewards;
- rare balanced frontier-origin Disciplines/equipment/Soulmarks where authored;
- frontier Veteran Edge options where appropriate;
- no ordinary-player Anomaly Character bypass;
- deep Horizonless contact/threat content;
- incursions that can feed the known-world live-event system;
- later guild/nation frontier campaigns.

## Phase-16 gate

A mature frontier slice is ready when:

- two consecutive frontier cycles produce meaningfully different but coherent navigable maps;
- multiple players share the same authoritative cycle truth;
- active sessions survive a world-cycle rollover safely;
- anchored landmarks remain narratively usable;
- exploration provides reasons beyond raw loot;
- experienced explorers gain useful recognition/knowledge advantages;
- rare build rewards are sidegrades or explicitly bounded;
- the area feels vast without meaningless empty generation;
- lore discoveries connect naturally to existing Unchosen/Unmoored canon;
- Horizonless presence creates intrigue/dread without immediately dumping their full origin;
- the system can expand by authoring more modules instead of redesigning its database every season.

---

# Rekindling Expansion Gate

Before the second full production Rekindling cycle is treated as a solved retention loop, add to the existing Rekindling gate:

- at least several viable Cycle Focus/route variants exist;
- a veteran can skip/compress proven beginner instruction;
- alternate qualification paths are genuinely different rather than renamed checklists;
- prior-cycle Hall-of-Selves history is visible/useful;
- at least one Echo Encounter or equivalent prior-self interaction is proven;
- recurring NPC/story presentation acknowledges continuity;
- later cycles still require active accomplishment;
- player testing specifically asks whether repeating the journey feels exciting or exhausting.

---

# Mature PvP Target

The mature PvP target is now broader than only 1v1/2v2:

```text
STANDARD COMPETITIVE BASELINE
1v1

TEAM FORMATS
2v2
3v3

FLEXIBLE CLASH
1–3 vs 1–3
including intentionally uneven custom/event matches

MULTI-SIDED EVENT FORMAT
1v1v1
```

This does **not** mean all are permanent ranked queues.

Queue health remains evidence-driven. 1v1 is the standard persistent competitive anchor; team and alternate modes expand through rotation, events, direct challenges and permanent queues only when real population supports them.

---

# Closed Alpha Impact

The existing Closed Alpha target does not need the mature Uncharted or Horizonless campaign.

Recommended Alpha impact is limited to:

- known-world geography that does not block future Verge expansion;
- spoiler-safe hints that civilization does not fully understand the outer world;
- PvP data structures that do not need a rewrite to add 3v3/multi-team later;
- Rekindling/Hall-of-Selves persistence shapes that do not make later replay variance impossible.

Do not delay proving the core tactical RPG because the eventual frontier is ambitious.
