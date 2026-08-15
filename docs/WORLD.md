# AUREVANE — Living World & Story Operations

**Status:** Authoritative feature specification subordinate only to `docs/GAME_MASTER_PLAN.md`.

**Direction approved:** 2026-08-15.

This document expands the Master Plan's world-event, story, persistent-world, live-service, and retention requirements. It does not authorize early implementation outside the roadmap.

## 1. Core World Thesis

AUREVANE is not a static collection of quests surrounding a combat system.

The personal hook is **building, mastering, and expressing a permanent character**. The world exists to continually give that character new reasons to matter: new threats, discoveries, social situations, story developments, build challenges, competitive metas, and cooperative opportunities.

The desired feeling is:

> I have a character who belongs to an online world that keeps moving even when I am not logged in, and when I return there is something worth understanding, reacting to, preparing for, or participating in.

The world should therefore feel **persistent, shared, reactive, authored, and operationally alive** without becoming a punishing FOMO machine.

## 2. Living World Principles

The world should support:

- visible changes in regions, settlements, encounter pools, NPC state, quests, Expeditions, PvP rotations, and global threats;
- scheduled and staff-triggered events;
- multi-stage narrative arcs that can unfold over days or weeks;
- short spontaneous events that make the world feel active;
- player and community contribution toward shared goals;
- different participation paths for solo, party, PvE, PvP, guild, and later nation players;
- a persistent history of important world outcomes;
- realtime presentation of active changes while keeping the server authoritative;
- character-build relevance, so events create interesting reasons to try Disciplines, Confluences, Soulmarks, equipment, and team compositions.

The world must not depend on a constantly rendered MMO map. AUREVANE's strategic map, nodes, encounters, instances, UI, event feed, and realtime presence can create the feeling of a living world efficiently.

## 3. World-State Layers

World state should be modeled at several scopes instead of one giant mutable object.

### Global state

Examples:

- current season;
- major story arc stage;
- global invasion;
- world-wide modifier;
- official tournament period;
- global announcement state.

### Region state

Examples:

- active Arcane Storm in Frostmere;
- temporary boss appearance;
- altered encounter pool;
- regional merchant or NPC arrival;
- increased Expedition activity;
- temporary danger or reward modifier.

### Node / location state

Examples:

- town under siege;
- bridge closed or reopened;
- special vendor present;
- local quest chain available;
- temporary dungeon entrance exposed.

### Player-specific state

Examples:

- personal story decisions;
- quest progress;
- event eligibility;
- discovered information;
- narrative flags;
- claimed rewards.

Global events may influence a player's available content, but must not overwrite legitimate player-specific story history.

## 4. Event Types

The system should support reusable event definitions rather than one-off code for every event.

Examples include:

- **World Crisis** — invasions, migrations, supernatural disasters;
- **Regional Event** — local storms, hunts, outbreaks, discoveries;
- **Narrative Event** — story chapters, NPC movements, faction developments;
- **Community Objective** — shared thresholds reached by player participation;
- **Legendary Hunt** — temporary elite/boss availability;
- **Expedition Event** — modifier pools, special rooms, increased activity, temporary bosses;
- **PvP Event** — special rulesets, queues, tournament windows;
- **Guild Event** — guild objectives or competitions;
- **Nation Event** — later campaign and warfare operations;
- **Seasonal Event** — themed content and presentation;
- **Micro Event** — shorter staff-triggered moments such as merchant visits, bonus encounters, roaming enemies, or temporary local objectives.

## 5. Event Lifecycle

Every managed event follows an explicit lifecycle:

```text
DRAFT
  ↓
PREVIEW / STAGING
  ↓
SCHEDULED
  ↓
LIVE
  ↓
RESOLVING
  ↓
ENDED
  ↓
ARCHIVED
```

Events may also be **CANCELLED** before going live or **EMERGENCY STOPPED** while live.

Publishing an event is a server-authoritative operation. The browser never decides that an event has started or that a reward is eligible.

## 6. Event Definition

A reusable event should be able to define, where applicable:

- stable ID and version;
- title and player-facing summary;
- internal staff notes;
- event type;
- start and end rules;
- manual, scheduled, or condition-based activation;
- affected global/region/node scopes;
- eligibility rules;
- recommended level or progression band;
- encounter additions/removals/weights;
- quest and dialogue activation;
- NPC/location changes;
- Expedition modifiers;
- PvP rotation changes;
- objective definitions;
- community progress thresholds;
- reward tables;
- announcement/feed entries;
- map markers;
- art/audio references;
- music state or ambience overrides where appropriate;
- feature-flag dependencies;
- rollback/cleanup behavior;
- analytics tags.

Events should compose existing systems. They should not become a second parallel quest, reward, combat, or economy engine.

## 7. Event Participation and Character Building

Events should regularly create meaningful build questions, for example:

- a roaming enemy family that rewards different status interactions;
- an Arcane Storm that changes terrain or encounter modifiers;
- a Legendary Hunt that encourages mobility or control builds;
- an Expedition Surge that makes a normally niche Confluence especially useful;
- a regional threat that rewards coordinated three-player compositions;
- PvP event rules that alter the current meta without permanently changing ranked balance.

The goal is not temporary raw-power buffs for their own sake. The goal is to create **reasons to experiment with the character-building system**.

## 8. Story as an Ongoing Service

The initial story is not the end of narrative implementation.

AUREVANE should support continuing authored story through:

- chapters;
- event chains;
- regional developments;
- recurring NPCs;
- faction and nation developments;
- discoveries that unlock new locations or encounters;
- server-wide milestones;
- player-specific decisions inside shared world events;
- post-event aftermath content.

A story arc can progress through multiple world states without requiring a code deployment for every text, dialogue, quest, encounter, or scheduling change.

## 9. Story State and Safety

Narrative content should be data-driven and versioned.

A story operation may reference:

- global story flags;
- player story flags;
- prerequisite quests;
- account/character progression;
- event state;
- region state;
- date/time window;
- faction/nation state later;
- explicit branching choices.

Changes to published story content must avoid corrupting players already inside a quest or instance. Long-running content may pin an appropriate content version until completion.

## 10. Community Consequences

Selected events may have shared outcomes.

Examples:

- community defeats enough invaders to reopen a route;
- players fail to prevent a siege, causing a temporary altered settlement state;
- a discovered ruin becomes a new Expedition location;
- a nation campaign changes a seasonal border state;
- a world boss defeat unlocks an aftermath quest chain.

Consequences should be meaningful but reversible or season-bounded where necessary. Avoid permanently destroying access to core gameplay because players missed an old event.

## 11. World Chronicle

Major events should leave visible history.

A future **World Chronicle** can record:

- event name;
- dates;
- participating regions;
- outcome;
- major community milestones;
- winning guild/nation where appropriate;
- unlocked aftermath;
- commemorative art or title where appropriate.

This gives the server history and social identity without forcing players to have participated in every past event.

## 12. Player-Facing Live World Surface

The game shell should eventually surface a concise **World Activity / Events** area showing:

- what is happening now;
- where it is happening;
- how long it lasts;
- why the player may care;
- recommended level/party size;
- primary rewards or discoveries where appropriate;
- community progress;
- relevant map shortcut;
- related story update;
- whether the player has participated.

Do not turn the home screen into an advertisement wall. Prioritize a small number of relevant active events and allow deeper browsing in a dedicated Events/Chronicle view.

## 13. Realtime Behavior

When an event starts, progresses, or ends:

- authoritative state changes on the server;
- affected clients may receive a realtime notification;
- clients refetch authoritative event/world state;
- map markers, feeds, quests, ambience, and other presentation update from that state.

Realtime messages are notifications, not proof of eligibility or rewards.

## 14. Rewards and Economy

Event rewards use the normal reward/economy services and idempotency rules.

Staff should not need to directly edit player currency or inventory to run an event.

Event definitions should reference controlled reward tables or approved reward entries. High-impact reward changes may require elevated permissions or owner approval as defined in `docs/MASTER_PANEL.md`.

## 15. Healthy Live-Service Rules

Living does not mean manipulative.

Avoid:

- mandatory daily attendance;
- streak punishment;
- important permanent combat power that can never return;
- surprise events that require players to remain online constantly;
- staff events that secretly alter ranked balance;
- arbitrary reward inflation;
- unannounced destructive world-state changes.

Prefer:

- advance notice for major events;
- multiple participation windows;
- catch-up or recurrence for important gameplay content;
- cosmetic/prestige exclusivity more often than permanent power exclusivity;
- short events as delightful opportunities rather than obligations.

## 16. Operations Integration

Authorized staff operate events and story through the Master Panel rather than editing production data directly.

The panel must eventually support:

- event creation from templates;
- event scheduling;
- story/quest/dialogue editing;
- preview/staging;
- targeted announcements;
- event start/stop;
- realtime status;
- objective progress monitoring;
- reward configuration through controlled data;
- post-event resolution;
- rollback;
- audit history.

See `docs/MASTER_PANEL.md` for roles, permissions, approval boundaries, and owner controls.

## 17. Implementation Timing

The living-world architecture is anticipated early, but operational features are delivered progressively.

- **Phase 0:** authentication/authorization and server boundaries must not block future staff roles; no full live-ops UI yet.
- **Phase 5:** world-state model, event engine foundation, announcements/event feed, story integration, and a safe minimum Event/Story operations panel become part of the world milestone.
- **Phases 6–8:** co-op, Expedition, PvP, tournament, and seasonal event controls expand as those systems exist.
- **Phases 10–12:** social, economy, guild, nation, and campaign operations expand with those systems.
- **Phase 13:** the complete owner/staff operating system is consolidated and polished.

The world should become operationally alive as soon as the world exists; Phase 13 is the full control-center phase, not the first time staff can run an event.

## 18. Definition of Success

The living-world direction is successful when:

- players regularly have new reasons to revisit their character builds;
- the world can change without a code deployment for ordinary content operations;
- authorized event/story staff can safely run content without database access;
- players can see and understand meaningful world activity;
- events integrate with existing quests, encounters, rewards, parties, Expeditions, PvP, and later nations rather than duplicating them;
- important changes are versioned, auditable, previewable, and reversible;
- the game feels inhabited and evolving rather than like a finished single-player campaign with a chat box.
