# AUREVANE — Technical Architecture

**Status:** Foundation architecture aligned with the Master Game Plan

This document translates the Master Game Plan into implementation constraints. It does not supersede the game design.

## 1. Product Shape

AUREVANE is a persistent browser-based multiplayer tactical RPG with long-lived character state, deterministic tactical combat, co-op parties, procedural expeditions, PvP, social systems, economy, nations, world events, continuing live story, delegated game operations, and a future complete owner Master Panel.

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
2. feature-specific authoritative docs, including `docs/WORLD.md` and `docs/MASTER_PANEL.md`
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
- world-event state and transitions;
- published story/content state;
- staff/admin privileged actions;
- cooldowns and timed persistent state.

Never trust a client-calculated reward, damage number, inventory mutation, progression result, event transition, or privileged content change.

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
    live-ops/
    story/
    quests/
    parties/
    expeditions/
    pvp/
    guilds/
    economy/
    nations/
    master-panel/
    staff/
  game/
    rules/               # pure deterministic domain rules
    effects/             # reusable gameplay effects
    content/             # typed content definitions/loaders
  server/
    db/
    auth/
    authorization/
    services/
    realtime/
    validation/
    audit/
  media/
    registry/
    audio/
  lib/
```

Avoid giant route handlers and `utils.ts` dumping grounds.

## 6. Game Content

Disciplines, Arts, Traits, Soulmarks, enemies, encounters, items, quests, dialogue, NPC state, world events, event objectives, modifiers, and similar content should be data-driven where practical.

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

Live events should compose existing quest, encounter, reward, world-state, Expedition, PvP, and announcement systems rather than creating duplicate parallel engines.

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
- expedition completion + personal reward grants;
- event objective completion + reward grant;
- privileged publish operations that update several active content pointers together.

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

## 10A. Staff Roles, Permissions, and Owner Authority

AUREVANE must support ordinary players, the protected owner identity, and delegated staff without turning every staff member into a super-admin.

Use role templates backed by granular permissions. Business logic should check permissions such as `liveops.events.publish` or `balance.edit`, not hard-coded presentation roles.

Requirements:

- staff identity is associated with an authenticated account;
- permission evaluation is server-side;
- permissions can be scoped by environment and later by content domain where useful;
- Owner authority is explicitly protected;
- role/permission changes are audited;
- revocation takes effect promptly;
- no service-role credential is exposed to staff browsers;
- ordinary staff cannot mutate their own privileges;
- high-risk operations may require re-authentication or stronger approval as the project grows.

The current Phase 0 infrastructure should avoid architectural choices that make future staff separation difficult, but the complete staff schema/UI is not required until its assigned tickets.

See `docs/MASTER_PANEL.md`.

## 11. Database Security

Every sensitive table requires an explicit access model.

When Supabase is used:

- RLS decisions must be deliberate;
- service-role credentials remain server-only;
- direct client access is limited to data that is safe under policy;
- authoritative game mutations route through trusted server code;
- privileged staff mutations route through trusted server code and permission checks rather than broad browser database access.

## 12. Realtime

Realtime is a transport/notification mechanism, not the authority.

Likely use cases later include:

- party presence;
- lobby/match updates;
- tactical battle event delivery;
- guild/social events;
- world event state;
- announcement/event-feed invalidation;
- operator dashboards receiving status updates.

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

World events, quests, dialogue, story arcs, reward tables, balance configuration, and other live-operated content should also support versioned publication where changes can affect active players.

## 14A. Publishing Architecture

Important operational content should use an explicit publishing service instead of arbitrary direct table edits.

Conceptually:

```text
DRAFT CONTENT
  ↓
Validate references/schemas
  ↓
Preview / staging
  ↓
Permission check for publish
  ↓
Create immutable/recoverable version
  ↓
Atomically update active version/pointer where required
  ↓
Write audit record
  ↓
Notify/invalidate affected clients/services
```

Rollback preserves history. It does not erase the existence of the failed version.

## 14B. Living World / Event Architecture

World events should be data-driven orchestration over existing systems.

Model distinct scopes such as:

- global world state;
- region state;
- node/location state;
- player-specific story/quest state.

The event engine should own event lifecycle and references, while existing domain services remain responsible for quests, encounters, rewards, PvP, Expeditions, economy, and progression.

Scheduled event transitions belong in durable server/worker processing rather than relying on a staff member's browser remaining open.

Event lifecycle actions must be idempotent so a worker retry does not start or resolve the same event twice.

See `docs/WORLD.md`.

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

Live events/story content reference stable approved media IDs rather than arbitrary uploaded URLs in player-facing definitions.

## 16. Responsive Presentation

Desktop is important for tactical play, but all ordinary account/profile/world/social flows should remain intentionally usable on mobile.

Combat mobile UX must be designed rather than achieved by shrinking desktop controls.

Master Panel operations are primarily desktop-oriented, but critical emergency controls and status views should remain usable at reasonable smaller widths where practical.

## 17. Testing Strategy

Required layers as the project grows:

- pure unit tests for game rules;
- data validation tests for content;
- database/service integration tests;
- API/server-action authorization tests;
- staff permission tests, including privilege-escalation denial;
- event lifecycle/idempotency tests;
- publishing/version/rollback tests;
- deterministic generation snapshots/property tests where appropriate;
- combat scenario regression tests;
- browser smoke tests for critical flows;
- performance/load testing before alpha.

Every significant combat behavior requires automated coverage.

Privileged operations require negative authorization tests, not only successful owner cases.

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

Master Panel permissions may be environment-scoped so a staff member can safely prepare/test content in staging without automatically receiving the same production publication rights.

## 20. Observability

Before closed alpha, the server should support structured logging and useful telemetry for:

- errors;
- authorization failures;
- combat/session failures;
- matchmaking;
- economy changes;
- expedition generation/completion;
- world-event transitions and worker failures;
- privileged publish/rollback failures;
- suspicious abuse patterns.

Never log secrets, authentication tokens, or unnecessary sensitive data.

## 20A. Administrative Audit Trail

Privileged operations require a durable audit trail containing appropriate actor/action/target/result metadata and old/new version or values where practical.

Audit records must be protected from ordinary staff modification. Owner actions are audited too.

A support correction, event publication, role change, balance edit, feature-flag change, moderation action, or production rollback should be explainable after the fact.

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
- deterministic and bounded procedural generation;
- bounded event-feed/history queries;
- worker-based scheduling instead of expensive client polling.

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

The new living-world and Master Panel direction changes future architecture and roadmap expectations; it does **not** authorize the current Phase 0 ticket to implement Phase 5/13 features prematurely.
