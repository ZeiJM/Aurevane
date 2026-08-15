# AUREVANE — Implementation Roadmap

**Authority:** Derived from `docs/GAME_MASTER_PLAN.md`. If any conflict exists, the Master Game Plan wins.

The roadmap exists to stop the final product specification from being mistaken for today's implementation scope.

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
- authorization/security baseline;
- design-system primitives;
- media registry/audio-runtime skeleton;
- logging/error handling conventions.

**Gate:** clean build, automated checks, deployable preview, documented local setup.

## Phase 1 — Character Foundation

- account/profile flow;
- character creation;
- four attributes;
- derived-stat framework;
- level/progression shell;
- character profile presentation;
- initial inventory/equipment foundation where required.

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
- reconnect-safe persistence foundation.

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
- Soulmark framework.

**Gate:** multiple meaningful builds can be configured and validated server-side.

## Phase 4 — First Playable Discipline Set

Implement the initial subset defined in the Master Plan, targeting roughly 16 playable Disciplines before alpha rather than blocking testing on all 36.

Every Discipline ticket includes gameplay data, tests, art requests/assets, audio requests/assets, and AI-usage rules where applicable.

**Gate:** the initial build-combination loop is genuinely fun to test.

## Phase 5 — World

Per the Master Plan sprints:

- world map;
- movement/presence;
- towns;
- encounters;
- NPC/dialogue;
- quest engine;
- initial story.

**Gate:** a character can leave a hub, explore, encounter content, complete quests, and return with persistent progression.

## Phase 6 — Party & Co-op

- parties;
- party realtime;
- co-op battles;
- shared quests;
- party finder.

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
- personal loot/leaderboards.

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
- tournament framework.

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

## Phase 10 — Social World

- guilds;
- friends;
- messages;
- guild quests;
- guild progression;
- social profiles;
- moderation.

## Phase 11 — Economy

- stores;
- loot;
- marketplace;
- crafting;
- economic telemetry.

## Phase 12 — Nations

- allegiance;
- reputation;
- nation quests;
- campaigns;
- nation warfare;
- political rankings.

## Phase 13 — Master Panel

Build the complete owner/admin experience only after enough systems exist to justify it:

- content editors;
- Confluence editor;
- quest editor;
- expedition editor;
- event editor;
- audio manager;
- Asset Studio;
- balance dashboards;
- simulation;
- economy analytics;
- moderation;
- version rollback.

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
- loading/error-state polish.

Media required to make earlier testing coherent should already be introduced through the request pipeline during prior phases.

## Phase 15 — Hardening

- security/penetration review;
- abuse testing;
- rate limiting;
- SQL/index optimization;
- load testing;
- matchmaking load;
- realtime load;
- expedition concurrency;
- economic exploit testing.

## Closed Alpha Target

From the Master Plan:

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
- Master Panel;
- full audio;
- strong visual presentation.

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
