# AUREVANE — Active Task Ledger

This file tracks the current implementation boundary. The Master Game Plan defines the final product; the Roadmap defines sequence; this file defines the active work.

## Current status

**Stage:** Phase 1 — Character Foundation / P1.6 Wayfarer's Practice checkpoint

Authoritative documents established:

- `docs/GAME_MASTER_PLAN.md`
- `docs/ART_BIBLE.md`
- `docs/AUDIO_BIBLE.md`
- `docs/MEDIA_PIPELINE.md`
- `docs/TECH_ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `docs/RESPONSIVE_EXPERIENCE_STANDARD.md`
- `AGENTS.md`

Legacy prototype code has intentionally not been imported.

## Completed

### SPRINT-0-PLAN — Break Phase 0 into implementation tickets

Phase 0 is defined in `docs/PHASE_0_TICKETS.md` as four independently verifiable tickets aligned to Master Plan Sprints 0–3.

### F0.1 — Repository + Runnable Web Foundation

Completed with:

- pnpm/Turborepo monorepo foundation;
- pinned dependency policy and committed lockfile;
- Next.js/React/TypeScript `apps/web` application;
- first responsive AUREVANE development screen;
- Prettier, ESLint, strict TypeScript, Vitest, and production-build gates;
- GitHub CI with frozen dependency installs and clean-working-tree verification;
- local-development and Vercel monorepo documentation.

**Verification:** formatting, lint, typecheck, tests, production build, and clean-source CI gate all pass.

### F0.2 — Infrastructure + Persistence Baseline

Completed with:

- explicit local/staging/production environment identity and validation;
- pinned Supabase client, SSR, and CLI dependencies;
- browser, server, and elevated server-only Supabase client boundaries;
- SSR cookie/session refresh, verified-claims auth boundary, callback, and server-side sign-out routes;
- version-controlled Supabase configuration, migration, and seed workflow;
- server-only `app_private` schema baseline with browser-role access revoked;
- migration security policy that rejects disabled RLS, broad browser grants, and public/unqualified application tables without same-migration RLS;
- CI that reconstructs the database from migrations, verifies schema privileges, and performs real local signup/sign-in through Supabase Auth;
- documented Vercel monorepo root and environment separation conventions;
- staging foundation migration applied and migration-history version reconciled with the committed migration filename.

**Verification:** final F0.2 quality gates, production build, migration rebuild, private-schema privilege checks, and local authentication checks pass. No gameplay schema or future-system implementation was introduced.

### F0.3 — Server Architecture Skeleton

Completed with:

- pure `packages/game-core` actor/command and stable server-error primitives with no React/browser dependencies;
- reusable transactional-command and durable idempotency contracts;
- server-only `app_private.idempotency_records` persistence plus an atomic PostgreSQL authority-probe transaction;
- strict shared request/persistence validation for the non-game authority probe;
- thin authenticated Next.js route, server service, persistence adapter, and safe HTTP-error translation boundaries;
- realtime invalidation interfaces that carry identifiers for authoritative refetch rather than owning game state;
- runnable `apps/worker` lifecycle with structured startup/shutdown/crash logging and deterministic CI boot mode;
- documented server command, transaction, idempotency, realtime, logging, error, and worker conventions;
- CI coverage for browser-role denial, conflicting idempotency keys, first execution versus replay, real Supabase authentication, and a real authenticated Next.js authority-probe request end to end;
- no new external runtime framework/dependency and no gameplay schema or future gameplay feature implementation.

**Verification:** final F0.3 formatting, lint, all workspace typechecks/tests, production build, worker boot, database rebuild, private-schema checks, transactional idempotency checks, local authentication, and authenticated web-route replay checks pass.

### F0.4 — Design System + Media/Audio Core

Completed with:

- real `packages/ui` workspace with centralized semantic typography, color, spacing, focus, surface, motion, and reusable game-UI primitives;
- polished responsive AUREVANE application shell with deliberate desktop/mobile layouts, keyboard focus, skip navigation, and reduced-motion handling;
- stable image/media registry plus reusable image component that renders traceable requested-media fallbacks instead of broken or random placeholder assets;
- traceable `ART-UI-001`, `AUDIO-MUS-001`, `AUDIO-AMB-001`, and `AUDIO-UI-001` production request records;
- real `packages/audio` workspace with versioned settings, validated asset registry, and a central Web Audio `AudioDirector` that initializes only after explicit player interaction;
- independent Master, Music, SFX, Ambience, and UI channels, mute that preserves channel levels, and versioned pre-login local persistence;
- dev-only Playwright browser verification covering desktop/mobile layout, horizontal-overflow protection, keyboard reachability, media fallback, gesture-gated audio initialization, and persisted mute/volume behavior;
- dedicated browser-smoke CI plus the existing F0.1–F0.3 quality, worker, database, authentication, and idempotency regression gates;
- successful Git-linked Vercel preview of the canonical F0.4 branch;
- no gameplay schema, combat, progression, world, economy, Master Panel, or other future gameplay system implemented early.

**Verification:** F0.4 passed its implementation-branch quality/database gates and real Chromium acceptance, then the squash-merged `main` checkpoint passed the same CI, database/security regressions, and responsive browser-smoke verification.

**Concurrency audit:** a separately created competing F0.4 implementation was inspected and rejected as incomplete/conflicting. Canonical PR #18 was merged; the competing branch was force-aligned to the approved `main` checkpoint and its audit-marker PR #17 was closed without merge. No divergent duplicate F0.4 implementation remains.

### P1-PLAN — Break Character Foundation into implementation tickets

Phase 1 is defined in `docs/PHASE_1_TICKETS.md` as six independently verifiable tickets:

- P1.1 Account Entry + Player Profile Boundary;
- P1.2 Character Domain Rules + Creation Contract;
- P1.3 Authoritative Character Creation + Persistence Experience;
- P1.4 Character Profile + Derived Stat Framework;
- P1.5 Level 1–100 XP Progression + Telemetry Foundation;
- P1.6 Wayfarer's Practice: Balanced Practice Foundation.

The first major player milestone is P1.3: an authenticated player can create and permanently persist a valid character. Phase 1 explicitly preserves later Discipline, combat, world, inventory/equipment, Horizon, Rekindling, premium-slot and Master Panel scope for their roadmap phases rather than implementing them early.

### P1.1 — Account Entry + Player Profile Boundary

Implementation checkpoint:

- existing Supabase Auth/session/verified-claims architecture reused with no second auth system;
- authored AUREVANE sign-in/sign-up account-entry experience implemented;
- exactly one minimal durable player profile is automatically provisioned from authoritative `auth.users` identity;
- authenticated profile reads are RLS-isolated to the verified account and direct browser mutation is denied;
- authenticated `/game` entry and stable explicit **No character bound** state implemented without premature character/gameplay schema;
- account identity remains separate from future public character identity;
- Account & Security manual/contextual help added;
- existing title-media request/fallback and gesture-gated audio settings preserved;
- phone inputs render only when authentication is actually configured and active inputs are mobile-friendly/focusable;
- utility audio is a non-reflowing popover with outside-click, Escape, and explicit-close dismissal;
- Account & Security expansion no longer stretches the hero/title;
- compact phone title sizing, safe-area insets, explicit laptop-height behavior, and desktop/laptop/mobile browser coverage are established;
- `docs/RESPONSIVE_EXPERIENCE_STANDARD.md` makes responsive/touch/keyboard/overlay behavior a permanent player-facing implementation requirement;
- no new runtime dependency or future gameplay system introduced.

**Production gate at merge:** the promoted Production descendant containing the Phase 0 environment hotfix was READY, returned HTTP 200, and had no error/fatal runtime logs in the verification window. Phase 0 issue #20 was closed.

**Environment policy:** `SUPABASE_SECRET_KEY` is the only Vercel warning-listed secret explicitly passed to the web build because AUREVANE has a defined server-only use for it. Unused Postgres/service-role/JWT integration secrets remain intentionally unavailable to the web build rather than being whitelisted merely to silence a warning.

**Verification:** P1.1 branch acceptance passed quality, database/security, and real Chromium desktop/laptop/mobile checks; PR #30 merged and issue #28 closed.

### P1.1-PROD — Production Account/Profile Readiness Hardening

Completed with:

- a central server-side account-services readiness policy rather than treating public Supabase variable presence as end-to-end readiness;
- explicit `AUREVANE_ACCOUNT_SERVICES_READY=true` required before Production account entry can be exposed;
- Vercel Production-host detection that rejects a staging-configured promoted Preview instead of silently using staging as the live account backend;
- current unprovisioned Production kept in the authored account-unavailable state, so a player cannot begin a login flow whose profile dependency is not ready;
- authenticated `PERSISTENCE_UNAVAILABLE` profile failures converted into an authored AUREVANE recovery screen with Retry and Sign out rather than a generic server-error page;
- safe structured outage logging through the stable `player_profile.persistence_unavailable` event without tokens, user IDs, raw SQL, or database error detail;
- existing profile provisioning, RLS, verified-actor, and no-client-selected-user security boundaries preserved;
- responsive recovery treatment with phone-safe actions and safe-area handling;
- Production readiness and migration verification procedure documented in infrastructure guidance and Account & Security player help;
- no Production Supabase project provisioned, no Production migration applied, no staging fallback introduced, and no character/gameplay scope implemented.

**Current Production acceptance mode:** intentionally unavailable. The public Production shell is healthy and clearly reports account services unavailable; sign-in/create-account controls are not exposed until a dedicated Production Supabase environment is provisioned, migrated, security-verified, and explicitly enabled.

**Verification:** quality/build/worker, local Supabase reconstruction, profile/RLS/idempotency/auth regressions, readiness/recovery tests, responsive Chromium, and the post-merge Vercel/main release checks passed. Issue #32 is closed as completed.

### P1.2 — Character Domain Rules + Creation Contract

Completed with:

- normalized public-character naming rules with Unicode compatibility normalization, stable comparison keys, length/separator policy, and reserved-name rejection;
- structured presentation and pronoun identities separated from gameplay power;
- stable typed portrait and starter-appearance content references rather than arbitrary URLs;
- the exact four core attributes: Might, Finesse, Intellect, Resolve;
- one versioned starting balance configuration with shared baseline, exact bonus budget, and per-attribute cap;
- exactly six Foundation Disciplines from the Master Plan as creation metadata only;
- deterministic Level 1 / XP 0 / progression-cycle 1 seed construction and versioned creation contracts;
- semantic character rules owned by pure `packages/game-core`, with strict transport shape owned separately by `packages/validation`;
- deterministic manipulation tests covering names, identity, attribute budgets, Foundation Disciplines, media-reference categories, initial progression and command versions;
- spoiler-safe Character Creation Foundations manual content;
- traceable P1.3 media requirements: `ART-CHR-001`, `ART-CHR-002`, `ART-ENV-001`, and `AUDIO-MUS-002`, all retained as requested assets until approved through the media pipeline;
- no persistence, creation UI, combat, progression, inventory, world, premium-slot, or Master Panel systems implemented early.

**Verification:** exact-head formatting/lint/type/tests/build, local Supabase regressions, responsive Chromium, and Vercel Preview passed; PR #37 merged into `main` and issue #31 closed as completed.

### P1.3 — Authoritative Character Creation + Persistence Experience

Completed with:

- private persistent character rows with account ownership, base slot index, globally unique normalized name key, core attributes, Foundation Discipline, creation rules version, progression seed and server-owned timestamps;
- browser read-only ownership RLS with direct browser mutation denied;
- one service-role-only atomic `create_base_character_v1` transaction using the existing durable idempotency record boundary;
- retry/double-submit replay safety, conflicting-fingerprint rejection, occupied-base-slot rejection, and global normalized-name collision handling;
- server reconstruction of canonical P1.2 creation state rather than trusting browser-selected level, XP, timestamps, extra attributes, invented Disciplines, or arbitrary media references;
- allow-listed official starter portrait and gameplay-neutral appearance references;
- authenticated create/read server boundary and recovery-safe character loading;
- responsive Identity → Foundation → Confirm character-creation experience with phone-safe input, touch controls, keyboard focus, laptop-height compaction, desktop scale, and requested-art fallbacks;
- permanent created-character state that reloads from authoritative persistence rather than local browser state;
- requested `AUDIO-MUS-002` character-creation music context registered without shipping an unapproved audio source;
- dedicated local-Supabase regression coverage for slot/name/idempotency/RLS/direct-mutation security;
- browser acceptance covering account creation, character creation, refresh, sign-out, sign-in, and same-character recovery across desktop, laptop and mobile.

**Verification:** exact-head quality/build/worker, full database/security, responsive Chromium desktop/laptop/mobile lifecycle, and Vercel Preview passed before merge. PR #39 squash-merged; issue #38 closed as completed. The merged `main` checkpoint `9a5a38adbd2593cabf7e4687eb78b66b6b6d250a` then passed the same quality, database/security, responsive Chromium, and Vercel release checks.

### P1.4 — Character Profile + Derived Stat Framework

Completed with:

- one pure versioned `packages/game-core` derived-stat calculator for Maximum HP, Maximum MP, Physical Power, Mystic Power, Armor, Ward, Accuracy, Evasion, Critical Chance, Initiative, Movement, Jump, and Status Resistance;
- integer-only deterministic arithmetic with percentage-like stats represented internally as basis points;
- centralized first-pass Phase 1 coefficients explicitly treated as development balance rather than a launch-balance promise;
- rule/config validation for complete stat identity, safe divisors, integer coefficients, bounds, and character input ranges;
- explicit base/Level/attribute calculation provenance plus a typed future modifier contribution category without implementing equipment, Discipline, effect, or combat systems early;
- server-built character profile read model that excludes private account linkage and normalized-name internals;
- authenticated `/game/character` profile route reusing the existing owner-isolated persisted-character read boundary and recovery state;
- responsive character profile presentation for public identity, requested portrait, Foundation Discipline, Level/XP/cycle, four core attributes, grouped derived stats, ruleset version, and contextual stat explanations;
- keyboard-focusable profile navigation, phone-safe single-column treatment, laptop-height compaction, desktop scale, and horizontal-overflow protection;
- spoiler-safe Character Profile & Derived Stats manual content that explains meanings, Movement-stat → Movement Budget semantics, configuration versioning, provenance, security, and future modifier boundaries without duplicating coefficients into prose;
- deterministic calculator/config/provenance tests, safe read-model projection tests, and expanded desktop/laptop/mobile Playwright lifecycle coverage.

**Verification:** exact-head quality/build/worker, full database/security regressions, responsive Chromium profile acceptance, and Vercel Preview passed before merge. PR #41 squash-merged; issue #40 closed as completed. The merged `main` checkpoint `34c01fa0180dcaa2ce41e136b2c09d656e353ac0` then passed the same quality, database/security, responsive Chromium, and Vercel release checks.

### P1.5 — Level 1–100 XP Progression + Telemetry Foundation

Canonical work is issue #42 / branch `agent/ticket-1-5-xp-progression`.

Current implementation scope includes:

- one pure deterministic Level/XP resolver with a configurable Level 1–100 cap, exact-boundary handling, within-Level progress and safe cap behavior;
- one versioned server-only cumulative XP curve mapped to progression cycle 1, explicitly labeled Phase 1 development balance rather than permanent launch pacing;
- no elapsed-time, calendar, Horizon, daily-energy, AFK-timer or other generic wait gate inside the XP resolver;
- an explicit server-side `character.xp.grant` permission boundary with stable provenance tags and no browser XP-award route;
- service-role-only atomic `grant_character_xp_v1` persistence that locks the character row, verifies persisted Level/XP consistency, resolves multi-Level awards, caps XP at the configured maximum, and updates Level + XP together;
- durable idempotency using the existing authoritative command record boundary, including same-request replay and conflicting-fingerprint rejection;
- a private append-only XP-grant ledger with source category/id/reason, requested/applied XP, before/after XP and Level, reached-Level milestone, curve version, cycle and seconds-since-cycle-start telemetry;
- private server-only curve/telemetry tables and service-role-only curve/grant RPCs, while browser roles retain only owner-isolated character reads and cannot PATCH Level/XP directly;
- profile read-model validation that recomputes Level from cumulative XP and rejects persisted Level drift;
- responsive character profile XP presentation showing Level, cumulative XP, next threshold, within-Level progress, curve version and maximum-Level state without duplicating the curve in UI constants;
- identifier-only Level-change invalidation contract for authoritative profile refetch rather than broadcasting character state;
- player-manual guidance distinguishing Level/Character XP from Discipline Mastery and explaining that long-form pacing comes from layered meaningful progression rather than visible or hidden day gates;
- deterministic domain/service tests plus local-Supabase attack coverage for curve privacy, authenticated RPC denial, browser mutation denial, negative grants, replay/conflict behavior, concurrent grants, provenance telemetry and Level-100 capping;
- desktop/laptop/mobile browser regression coverage for the real Level-1 profile progress presentation.

**Verification:** P1.5 passed its exact-head quality/build/worker, progression/database-security and responsive Chromium gates; PR #44 merged. Mobile release hardening followed through PR #46, and the owner production account/game/profile/sign-out smoke is green on the later verified production baseline.

## ACTIVE

### P1.6 — Wayfarer's Practice: Balanced Practice Foundation

Canonical work is issue #48 / draft PR #51 / branch `agent/ticket-1-6-wayfarers-practice`.

Current implementation scope includes:

- one pure versioned deterministic Balanced Practice calculator with server-supplied timestamps, a short-reconnect threshold, full/reduced direct-XP windows, a multi-day direct bank cap, and bounded Rested Momentum accrual;
- Phase 1 reward types restricted by construction to Character XP and Rested Momentum, with Discipline Mastery, story/quest/boss/Expedition/PvP/economy/Horizon/Rekindling/premium scope explicitly deferred;
- private versioned Wayfarer configuration, per-character activity/accrual state, frozen Training Reports and append-only claim telemetry;
- lazy first-return materialization with at most one pending report per character, no per-character background timers/jobs, no retroactive reward before the feature initializes, and no reward from short reconnect loops;
- one service-role-only atomic `claim_training_report_v1` transaction reusing the P1.5 progression curve/resolver and XP-grant ledger while applying bounded Rested Momentum, marking the report claimed and advancing the claim boundary together;
- durable replay/conflict idempotency, ownership validation, row locking and concurrent-claim safety;
- authenticated server-only materialize/claim adapters and a thin claim route in which the browser supplies only character/report/idempotency identifiers, never authoritative timestamps or reward amounts;
- a restrained responsive Training Report return card with Balanced Practice summary, credited duration, Character XP, Rested Momentum, cap explanation and retry-safe Claim training action;
- authoritative post-claim refetch through the existing server-rendered `/game` flow rather than broadcasting mutable reward state;
- spoiler-safe player guidance in `docs/player-manual/wayfarers-practice.md`;
- dedicated local-Supabase authority coverage for private access, frozen reports, ownership denial, short reconnects, replay/conflict behavior, atomic Level/XP/Rested changes, Level-100 and Rested caps, provenance and concurrent claims;
- desktop/laptop/mobile Playwright coverage for controlled absence → frozen report → refresh stability → keyboard claim → Level/XP refresh → no duplicate report.

**Current verification:** exact-head quality/build/worker, the existing full database/security suite, the dedicated Wayfarer authority suite and responsive Chromium acceptance are green on the implementation branch. Production remains unchanged until the tested migration is merged and deliberately applied.

## Next

Finish PR #51 review and Vercel Preview verification, merge P1.6, apply the tested versioned Wayfarer migration to the correct production Supabase project, and complete post-merge production smoke before closing #48. Only then advance roadmap sequencing; Phase 2 — Tactical Combat Core is the next roadmap phase, but no Phase 2 implementation begins while P1.6 remains ACTIVE.

## Rule

Only one implementation ticket is ACTIVE at a time. Every future player-facing ticket must follow `docs/RESPONSIVE_EXPERIENCE_STANDARD.md` and explicitly consider phone width, laptop height, desktop scale, touch, keyboard focus, and transient-overlay behavior during implementation.
