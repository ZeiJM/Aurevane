# AUREVANE — Roadmap Addendum: Training Backfill, Live Events, Homesteads & Navigation

**Authority:** Roadmap integration for `docs/GAME_MASTER_PLAN_LIVE_EVENTS_STAFF_ADDENDUM.md` and `docs/HOMESTEAD_WORLD_NAVIGATION.md`, subordinate to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/ROADMAP.md`.

**Direction approved:** 2026-08-17.

This module resolves the current implementation position (already in Phase 2) while integrating newly approved offline-training, staff, event, Homestead, safe-territory, map-layer, and compass/coordinate systems.

---

## Immediate insert while implementation is in Phase 2

### P1 backfill — Wayfarer's Practice foundation

Do this **now as one targeted backfill ticket**, then continue Phase 2. Do not restart or redo completed Phase 1 work.

Implement:

- authoritative activity/practice timestamps;
- server-side offline threshold;
- Balanced Practice;
- planned windows exactly `Short`, `Overnight`, `Extended`;
- legacy `Until I Return` is removed and must not be implemented;
- initial data-driven targets around 3h / 8h / 24h;
- `Set Practice` applies to the next meaningful offline absence;
- early return credits only legitimate elapsed time;
- after the selected window expires, eligible remaining absence falls back to Balanced Practice;
- low-rate deterministic Character XP;
- initial Rested Momentum representation;
- idempotent Training Report generation/claim;
- basic Character → Training UI;
- explicit-plan vs fallback telemetry;
- no direct attribute training, profession XP, Crowns, materials, items, or event participation.

Discipline Focus and mature Recovery & Study remain Phase 3.

**Backfill gate:** browser clock cannot accelerate rewards, reconnect cannot duplicate a claim, and the system integrates cleanly with existing character progression and current Phase 2 combat work.

---

# Phase 2 — Tactical Combat Core

Continue current combat implementation after the backfill.

Only preserve compatibility:

- future events reference existing authoritative encounters/rewards rather than creating a second combat engine;
- official badges remain presentation only;
- event combat modifiers later use typed/versioned rules, never arbitrary staff scripting;
- future Homestead/Vault state never changes battle carried-item limits or snapshots.

Do not pull full Events, Nations, Homesteads, professions, Vowbond, or staff operations into Phase 2.

---

# Phase 3 — Discipline Framework

Extend Wayfarer's Practice with:

- Discipline Focus;
- eligible unlocked Discipline selection;
- bounded offline Mastery;
- active proof/trial requirement;
- planned-focus expiry to Balanced fallback;
- mature Recovery & Study / Rested Momentum tuning;
- no profession progression while offline.

---

# Phase 4 — First Playable Discipline Set

Validate that:

- active play is materially stronger than passive progress;
- Overnight is a satisfying before-bed hook rather than mandatory optimization;
- Extended does not materially shorten the six-month journey;
- offline Mastery cannot replace learning and using a Discipline.

---

# Phase 5 — Living World, Story, Map & First Real Staff Operations

Phase 5 is the primary foundation for persistent events, Event Staff, early Content Staff operations, map layers, and quest navigation.

## Protected `/master` + fixed roles

Implement exactly four authority classes:

```text
GAME OWNER
MODERATOR
CONTENT STAFF
EVENT STAFF
```

Requirements:

- stable account-principal authorization;
- Owner character `Zei` is presentation only;
- WORLDWRIGHT Owner badge;
- simple role grant/revoke;
- multiple delegated roles may coexist;
- Owner may grant explicit special capabilities without creating new role names;
- current server-side permission check on every privileged command;
- prompt revocation/access versioning;
- complete audit;
- no raw DB credentials in browser;
- no self-escalation or staff-created Owner.

Phase 5 emphasis: Event Staff and only the Content Staff surfaces needed by living-world/story/media work. Full Moderator tooling waits for Phase 10.

## Persistent Event foundation

Implement:

- Event Template;
- versioned Event Definition;
- Event Run;
- Event Phase;
- Event Objective;
- typed Event Effect references;
- Reward Package references;
- Participant Ledger;
- explicit scope;
- authoritative clock/state;
- restart recovery.

Lifecycle supports `DRAFT`, `PREVIEW`, `SCHEDULED`, `LIVE`, optional `PAUSED`, `RESOLVING`, `ENDED`, `ARCHIVED`, `CANCELLED`, and `EMERGENCY_STOPPED`.

## Event Builder MVP

Event Staff can compose approved building blocks:

- title/summary/internal notes;
- global/region/node/cohort scope;
- timings;
- phases;
- quests/encounters;
- objectives/community thresholds;
- map markers/nodes;
- announcements;
- approved rewards within permission/budget;
- art/audio references;
- aftermath.

No arbitrary script/SQL editor.

## Safe Event Effect Catalog

Initial typed effects may activate/deactivate:

- map markers/event nodes;
- approved encounter-pool additions;
- quests/dialogue packages;
- NPC presentation state;
- temporary vendors;
- World Pulse announcements;
- ambience/music;
- bounded reward/loot modifiers;
- approved region presentation variants.

Permanent canon/world mutations remain Owner-gated.

## Event Calendar, conflicts & preview

Implement:

- schedule/unschedule;
- calendar/timeline;
- overlap/conflict display;
- feature/content dependency validation;
- exclusive-location/state conflict detection;
- story/spoiler-stage validation;
- preview/staging with a test clock and phase jumping;
- reward/map/announcement/cleanup preview.

Unsafe publication is blocked unless a future Owner-only override is explicitly designed.

## Live Event dashboard

Show:

- current phase/time;
- participants;
- community progress;
- objective status;
- claims;
- errors/rejections;
- active effects;
- staff action history;
- permitted advance/pause/stop controls.

Prove restart recovery, idempotent transitions/contributions/claims, safe cleanup, and Chronicle/participant-history persistence.

## Strategic Map Layers

Implement current-system layers such as:

- Tracked Objectives;
- Quests;
- Events;
- Settlements & Services;
- Travel Routes;
- Expeditions / Combat Locations;
- Lore / Discoveries when relevant.

Requirements:

- per-player persisted toggles;
- sensible defaults;
- Clean Map/reset control;
- zoom-aware clustering;
- enabling a layer never reveals undiscovered/ineligible content;
- hidden markers are not sent to unauthorized player clients merely to be hidden with CSS.

## Compass / Coordinates / Quest Guidance

Implement stable region-local N/S + E/W coordinates and authorable guidance modes:

```text
TRACKED / BASIC
SEARCH AREA / APPROXIMATE
HIDDEN / CLUE-LED
```

Basic objectives may show exact markers/routes/coordinates. Search objectives may show an approximate area/bearing. Hidden objectives use journal clues and intentionally omit exact tracking until discovery when designed.

The journal clearly states when a location is intentionally untracked.

**Phase 5 gate addition:** Event Staff can run a real persistent multi-phase event without a routine code deployment; events survive restart and clean up safely; map complexity is controllable; basic, approximate, and hidden navigation all work without leaking secret content.

---

# Phase 6 — Party & Co-op

Add:

- party event objectives;
- party/shared waypoint convenience where allowed;
- party members in Social map layer;
- shared waypoints never grant hidden knowledge/access;
- event contribution remains authoritative;
- social permissions remain compatible with later Homestead visiting.

---

# Phase 7 — Expeditions

Extend persistent events with Expedition scope:

- approved temporary modifiers/rooms/bosses;
- content-version pinning;
- contribution/reward deduplication;
- reconnect/restart safety.

Expand Expedition map filtering as needed.

---

# Phase 8 — PvP

Add PvP Event scope:

- temporary approved queues/rulesets;
- tournaments/windows;
- event rewards/titles;
- strict separation from ordinary ranked defaults;
- emergency stop and audit.

Event Staff cannot directly rewrite unrestricted combat balance.

---

# Phase 9 — Full Discipline Roster

Mature event combat building blocks and regression coverage so recurring events create build variety without making one event modifier or crafted effect mandatory.

---

# Phase 10 — Social World

## Full Moderator tools

Implement:

- reports queue;
- relevant player/context lookup;
- warnings;
- chat/message restrictions;
- temporary suspension;
- permanent-ban capability according to Owner policy;
- moderation notes/history;
- escalation/audit.

Moderator receives no event/content/economy authority by default.

## Staff badges

Implement official badge presentation:

- WORLDWRIGHT — Game Owner;
- MODERATOR — sapphire/aether blue + silver;
- CONTENT STAFF — teal/emerald + pearl/soft gold;
- EVENT STAFF — amber/ember gold + aether-blue accent.

Authorization never comes from badge data.

## Homestead social permission foundation

Prepare visit modes such as Private, Vowbond Partner, Friends, Guild, Invite Only, Public Visit. Visitors do not gain storage/ownership rights.

---

# Phase 11 — Economy & Professions

Keep the main profession/Trade House plan unchanged, but prepare Homestead integration:

## Vault-compatible inventory

- future Vault is another authoritative item location;
- atomic carried ↔ storage transfer;
- no simultaneous equipment/Trade House/Vault ownership;
- Materials search/stack/filter works in storage;
- Vault never expands combat-item limits.

## Workshop compatibility

Homestead Workshop will later launch the same Crafting service. It grants no recipes, power, XP multiplier, fee bypass, passive queue, or resource generation.

## Gathering map layer

Add `Gathering & Resource Sites` layer with profession/level/discovery gating and a Gathering preset that reduces unrelated clutter.

## Event + economy integration

Persistent events may safely activate approved Resource Sites, accept craft/gather contributions, grant bounded materials, and award future Homestead trophies/decor through normal reward services.

---

# Phase 12 — Nations + Full Homestead System

Phase 12 is the primary Homestead launch because the home belongs to a nation/capital territory.

## Sovereign safe territory

For each nation author:

- capital core;
- sovereign-safe boundary;
- Homestead Belt / residential outskirts;
- frontier transition.

Rules:

- no normal hostile monster spawns inside sovereign nation territory;
- never spawn normal monsters on Homestead plots/instances;
- no player Homestead raiding/destruction;
- any siege/invasion/training combat near capitals uses explicit authored nodes/instances/event rules;
- spawn validation rejects ambient hostile tables overlapping sovereign-safe territory.

## Homestead eligibility

Unlock through data-driven nation/character progress such as allegiance + introductory housing quest + modest nation reputation/progression milestone. Housing should arrive well before endgame.

## One active nation Homestead

Implement:

- one active Homestead per character;
- nation ownership;
- authored district/parcel-anchor selection within Homestead Belt;
- personal `My Homestead` map marker;
- instanced persistent property;
- no scarce one-house-per-world-tile real-estate system.

## Layout, expansion & decoration

Provide modular spaces such as Main Hall, Rest/Training room, Vault, Workshop, Trophy/Display area, and optional Courtyard/Garden.

A small expansion/tier system may grant:

- more storage;
- more decoration budget;
- more rooms/display space;
- cosmetic architecture/convenience.

No direct combat stats or offline-training-rate bonuses.

## Homestead Vault

Implement substantial non-combat storage with search/filter/sort, smart material deposit, favorites/locks, loadout/equipped/listed protection, and atomic deposit/withdraw.

No shared Vowbond/guild inventory by default. No effect on combat inventory rules.

## Workshop

Launch the normal authoritative Crafting panel from the home. No extra recipes, power, passive production, or tax bypass.

## Trophy / display system

Display boss/event/profession/nation/PvP/Expedition/Rekindling/Vowbond/Chronicle prestige without duplicating usable item ownership.

## Visiting

Use owner-selected social permissions. Visitors cannot steal Vault items, damage the home, claim rewards, or alter ownership.

## Nation switching / relocation

On legitimate allegiance change:

- old active Homestead becomes Packed / Relocation Pending;
- layout snapshot is preserved;
- decoration and Vault ownership remain safe;
- Packed Storage remains recoverable;
- old home ceases to function as an active outpost;
- player establishes a new home in the new nation;
- compatible layout may restore;
- system cannot create two active homes/Vault capacities.

## Homestead map layer

Add Homestead to Social map filtering. Owner sees `My Homestead`; other homes appear only when privacy/social context permits. Never show every server home.

## Nation Event maturity

Persistent events gain Nation scope, campaign objectives, safe capital/outskirts presentation, authored defense nodes if needed, nation rewards/titles/decor, and Chronicle outcomes while preserving Homestead safety.

**Phase 12 gate addition:** nation territory feels controlled and safe; an eligible player can establish one decorated persistent home near their capital, use secure expanded storage, visit permitted homes, relocate after nation change, and do all of this without world-map land scarcity or combat/economy advantage.

---

# Phase 13 — Complete Master Panel

Consolidate:

- only Game Owner / Moderator / Content Staff / Event Staff role classes;
- multi-role assignment;
- direct Owner-granted special capabilities;
- effective-permission preview and revocation;
- mature Persistent Event Studio with templates, phase/objective builder, safe effects, recurrence, conflict graph, test clock, analytics, rollback/cleanup validation, and all world/Expedition/PvP/Nation/economy integrations;
- Homestead Studio for safe-territory, districts/anchors, layouts/tiers, decor catalogs, storage configuration, relocation policy, preview, and support recovery;
- Content Staff Homestead visual editing only within granted domains;
- map/navigation authoring for layer, visibility prerequisites, guidance mode, reveal radius/search area, coordinate exposure, clustering, and spoiler validation.

---

# Phase 14 — Art & Audio Polish

Polish:

- nation-specific Homestead architecture/interiors;
- furniture/decor/trophies;
- lighting/ambience/music;
- Wayfarer's Practice home presentation;
- official staff badges;
- event banners/World Pulse/media;
- map icon family/layer UX/clustering;
- compass/coordinate UI;
- strong visual distinction between exact marker, approximate search area, and hidden/clue-led objectives.

Prioritize readability over decorative map noise.

---

# Phase 15 — Hardening

Explicitly test:

### Wayfarer's Practice

- Short/Overnight/Extended boundaries;
- no `Until I Return` execution path;
- focus expiry to Balanced fallback;
- early return;
- client clock manipulation;
- duplicate claim/reconnect.

### Staff security

- multi-role combinations;
- grant/revoke/stale-session behavior;
- badge spoofing;
- staff self-escalation;
- cross-role unauthorized actions.

### Persistent events

- restart at every phase;
- duplicate transition/contribution/claim;
- recurrence isolation;
- conflict/dependency validation;
- pause/resume/emergency stop;
- cleanup idempotency;
- economy/reward limits;
- spoiler leak prevention;
- large community concurrency;
- Event Staff permission boundaries.

### Homestead

- Vault/equipment/Trade House races;
- relocation with full storage;
- nation switching concurrency;
- two-active-home prevention;
- visitor permission attacks;
- decor ownership/recovery;
- no normal hostile spawn inside safe territory;
- no passive resource-generation path.

### Map/navigation

- layer preference persistence;
- clustering/performance;
- hidden markers absent from unauthorized APIs;
- gathering visibility;
- social/Homestead privacy;
- event-preview isolation;
- exact/search-area/hidden objective rules;
- coordinate stability;
- server access still enforced even if players share a coordinate.

---

# Locked roadmap decisions

1. Do the small Wayfarer's Practice backfill now, then continue Phase 2; do not restart Phase 1.
2. Planned training is `Short`, `Overnight`, `Extended` only.
3. Staff stays simple: Game Owner, Moderator, Content Staff, Event Staff.
4. Extra powers are direct Owner grants, not extra role names.
5. Persistent Event tooling begins in Phase 5 with the living world.
6. Map layers and compass/coordinate quest guidance begin in Phase 5.
7. Full nation-linked Homesteads launch in Phase 12.
8. Normal hostile monsters do not spawn inside sovereign nation territory.
9. Homestead storage/decor/workshop are convenience/identity systems, not mandatory power.
10. Map toggles filter known information; they never reveal undiscovered content.
11. Basic quests can use exact tracking, exploration quests can use search areas, and genuine secrets can remain clue-led and untracked.