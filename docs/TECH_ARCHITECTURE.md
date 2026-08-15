# AUREVANE — Technical Architecture

**Status:** Foundation architecture aligned with the Master Game Plan

This document translates the Master Game Plan into implementation constraints. It does not supersede the game design.

## 1. Product Shape

AUREVANE is a persistent browser-based multiplayer tactical RPG with long-lived character state, deterministic tactical combat, co-op parties, procedural expeditions, PvP, social systems, economy, nations, world events, and a future owner Master Panel.

The architecture must support the full product without attempting to implement the full product at once.

## 2. Initial Technology Direction

The clean implementation should use a modern TypeScript web stack suitable for Vercel deployment.

Initial direction:

- Next.js + React + TypeScript;
- PostgreSQL-backed persistent data;
- Supabase may be used for PostgreSQL/Auth/Realtime/storage where it fits the design cleanly;
- schema migrations for every database change;
- server-only domain services for authoritative gameplay;
- validated server actions/API endpoints at the boundary;
- deterministic pure-domain modules for combat and generation where possible;
- automated unit/integration tests;
- Vercel as a convenient deployment target, not as the source of truth.

Exact package versions are selected deliberately during Sprint 0 rather than inherited blindly from the old prototype.

## 3. Source of Truth

Priority:

1. `docs/GAME_MASTER_PLAN.md`
2. feature-specific authoritative docs
3. `docs/ART_BIBLE.md`
4. `docs/AUDIO_BIBLE.md`
5. `docs/MEDIA_PIPELINE.md`
6. `docs/TECH_ARCHITECTURE.md`
7. current ticket acceptance criteria

Code must not silently redefine game rules.

## 4. Server Authority

The browser may request actions and render predicted/optimistic presentation, but the server owns authoritative outcomes.

Server authority includes at minimum:

- combat state and outcomes;
- turn order and legal actions;
- HP/MP/status changes;
- rewards;
- XP and Mastery;
- currencies;
- inventory/equipment;
- loot;
- progression;
- quest outcomes;
- expedition state;
- PvP rating/results;
- matchmaking state;
- trading/market actions;
- guild/nation privileged actions;
- cooldowns and timed persistent state.

Never trust a client-calculated reward, damage number, inventory mutation, or progression result.

## 5. Module Boundaries

Prefer feature-oriented modules with explicit boundaries.

Conceptual structure:

```text
src/
  app/                  # routes, layouts, server entry points
  components/           # reusable presentation primitives
  features/
    auth/
    character/
    disciplines/
    combat/
    world/
    quests/
    parties/
    expeditions/
    pvp/
    guilds/
    economy/
    nations/
    master-panel/
  game/
    rules/               # pure deterministic domain rules
    effects/             # reusable gameplay effects
    content/             # typed content definitions/loaders
  server/
    db/
    auth/
    services/
    realtime/
    validation/
  media/
    registry/
    audio/
  lib/
```

Avoid giant route handlers and `utils.ts` dumping grounds.

## 6. Game Content

Disciplines, Arts, Traits, Soulmarks, enemies, encounters, items, quests, modifiers, and similar content should be data-driven where practical.

Reusable effect primitives should implement common mechanics such as:

- damage;
- healing;
- shields/barriers;
- movement;
- forced movement;
- status application/removal;
- resource modification;
- summon/create terrain;
- trigger/reaction hooks;
- targeting rules.

Individual Arts should compose reusable effects instead of embedding unrelated bespoke logic throughout UI or route code.

## 7. Combat Engine

Combat should be deterministic when supplied with the same authoritative initial state, actions, content version, and random seed.

Separate:

- state;
- rules;
- targeting;
- action validation;
- effect resolution;
- random-number source;
- event log;
- persistence;
- presentation.

The combat engine should emit structured events the UI can animate rather than making animation logic part of outcome calculation.

## 8. Randomness

Authoritative randomness must originate server-side.

Seeded systems such as expedition generation require explicit seed handling and deterministic generation tests.

Do not use `Math.random()` directly inside authoritative domain rules without an injected deterministic RNG abstraction.

## 9. Persistence and Transactions

Multi-step state mutations that must succeed together require database transactions or an equivalent atomic design.

Examples:

- purchase + currency deduction + inventory grant;
- quest completion + reward grant;
- match result + rating updates;
- item trade between players;
- expedition completion + personal reward grants.

Rewards and externally retried actions must be idempotent where duplicate execution would be harmful.

## 10. Authentication and Authorization

Authentication answers who the user is. Authorization answers what that user may do.

Every privileged server operation performs authorization server-side.

Do not rely on:

- hidden buttons;
- client role flags alone;
- route visibility;
- disabled inputs.

Admin/Master Panel functions require explicit role/permission checks and auditability.

## 11. Database Security

Every sensitive table requires an explicit access model.

When Supabase is used:

- RLS decisions must be deliberate;
- service-role credentials remain server-only;
- direct client access is limited to data that is safe under policy;
- authoritative game mutations route through trusted server code.

## 12. Realtime

Realtime is a transport/notification mechanism, not the authority.

Likely use cases later include:

- party presence;
- lobby/match updates;
- tactical battle event delivery;
- guild/social events;
- world event state.

Every realtime message referencing authoritative state must be recoverable by refetching authoritative server state after disconnect.

## 13. Reconnect and Long Activities

Co-op missions, Expeditions, and PvP require reconnect-aware state.

Design toward:

- durable session identifiers;
- last acknowledged event/version;
- resumable authoritative state;
- clear timeout/forfeit rules;
- idempotent command handling where retries are expected.

## 14. Content Versioning

Long-running combat/expedition sessions should be protected from arbitrary mid-session content changes.

Content used by authoritative simulations should eventually have stable identifiers and versioning so a balance edit does not corrupt an existing session.

## 15. Media Runtime

UI code consumes approved media through a stable registry/component layer.

Audio is controlled through a central service that owns:

- browser initialization;
- music context;
- stem/layer transitions;
- SFX priority and concurrency;
- ambience;
- persistent volume settings.

No scattered provider-specific generation calls belong in gameplay.

## 16. Responsive Presentation

Desktop is important for tactical play, but all ordinary account/profile/world/social flows should remain intentionally usable on mobile.

Combat mobile UX must be designed rather than achieved by shrinking desktop controls.

## 17. Testing Strategy

Required layers as the project grows:

- pure unit tests for game rules;
- data validation tests for content;
- database/service integration tests;
- API/server-action authorization tests;
- deterministic generation snapshots/property tests where appropriate;
- combat scenario regression tests;
- browser smoke tests for critical flows;
- performance/load testing before alpha.

Every significant combat behavior requires automated coverage.

## 18. CI and Deployment

`main` should remain deployable.

Before merging implementation work, run applicable:

- formatting/lint;
- TypeScript typecheck;
- unit/integration tests;
- production build.

GitHub Actions will enforce these once the application scaffold is established.

Vercel deployments are useful playable checkpoints. Secrets belong in deployment environment configuration, never the repository.

## 19. Environment Separation

Design for at least:

- local development;
- preview/staging;
- production.

Production data must not be casually reused for development experiments.

Database migration strategy must distinguish deployable schema changes from local reset/seed operations.

## 20. Observability

Before closed alpha, the server should support structured logging and useful telemetry for:

- errors;
- authorization failures;
- combat/session failures;
- matchmaking;
- economy changes;
- expedition generation/completion;
- suspicious abuse patterns.

Never log secrets, authentication tokens, or unnecessary sensitive data.

## 21. Performance

Performance budgets matter because the product is browser-based.

Architect toward:

- code splitting;
- bounded client bundles;
- image optimization;
- controlled animation/particle cost;
- efficient DB indexes;
- query pagination;
- no N+1 query patterns in hot paths;
- efficient realtime subscriptions;
- deterministic and bounded procedural generation.

## 22. Architectural Decision Rule

For major irreversible choices, create a short ADR or update this architecture before implementation.

The decision should state:

- problem;
- options considered;
- selected approach;
- tradeoffs;
- migration/escape path.

## 23. Implementation Discipline

The Master Plan defines the destination.

The Roadmap defines sequence.

The current ticket defines allowed implementation scope.

That distinction is mandatory for keeping AUREVANE coherent as it grows.
