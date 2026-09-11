# Phase 3 closeout and Phase 4 preparation

Date: 2026-09-11. Release: PR #445, following the performance/UI baseline in PR #444.

## Owner decision and boundary

The Owner approved closing Phase 3 once the requested page/popup presentation, mobile bottom-edge and performance corrections are complete and released for testing. This document records that conditional decision; closure takes effect after the release checks and relevant production interactions are verified. Production READY alone is not interaction evidence. Phase 4 is **not activated** and requires the Owner's separate start command.

P3.1–P3.8 are already implemented and deployed. This is an Owner phase-exit decision, not evidence of an independent multi-tester PV-2 study. No tester counts, satisfaction scores, retention results or PvP human-playtest results are inferred.

## Presentation and interaction checkpoint

The route audit covers account entry, character selection/creation, Profile, Battle Hall, Passive Training, Titles/portrait settings, controls, the character directory, News, Manual and Rules. The shared reading tiers now use stable desktop sizes and balanced headings. Public reading headers use less vertical space. Longer reference articles and narrow/zoomed screens may scroll rather than hide text.

Battle Hall uses a content-sized panel with a bounded reading width, left-aligned explanatory copy, and centered category buttons without numbers or arrows. The selected category is exposed through `aria-pressed`. Compact laptop layouts preserve the setup controls and readable text.

The authenticated mobile footer occupies its real grid row, including safe-area padding. Browser regression coverage checks Profile, Battle Hall and Training at two phone heights and with extra footer padding. The final panel border and inner spacing remain above the navigation bar at the end of scrolling.

The popup audit covers Discipline Management, Techniques, attributes, Profile details, public character profiles, character/account deletion confirmations, audio settings and the PvP lobby. Shared desktop copy/label tiers include portal-rendered dialogs. The Techniques sidebar can scroll inside a short dialog instead of losing its lower cards; mobile retains the full scrolling sheet. Battle inspection, chat, settings and completion surfaces retain the shared PvE/PvP/spectator presentation validated in PR #444 and are covered by the inherited browser suite.

PR #444 delivered navigation prefetch/feedback, non-blocking supplementary presence, faster battle transition read paths and build-editor loading improvements. These remain in place; this closeout adds no gameplay polling, animation loops, client authority or new runtime services.

## Background health and security checkpoint

Read-only production sampling at 09:57–09:59 UTC:

- Supabase reports `ACTIVE_HEALTHY`; 11 database connections (one active), zero deadlocks and zero waiting locks at the sample.
- The cumulative rollback count remained 118,323,265 across the sample, while commits increased from 2,283,615 to 2,283,678. This preserves the historical rollback investigation as context rather than claiming an active rollback storm.
- Historical statement averages: battle-session reads 1.16 ms; active-build reads 4.11 ms; committed-build snapshot reads 13.72 ms; the most-used battle-intent commit statement 27.39 ms. These are database averages, **not** end-to-end latency or p95/p99 measurements. Historical maxima remain recorded in Supabase statistics.
- No Vercel runtime error clusters were returned for the preceding hour. This does not prove that every client interaction was error-free.
- Security advisor: five informational RLS-without-policy notices. All five tables were checked: RLS is enabled and neither `anon` nor `authenticated` has direct table access. Preserve their service-authorized access pattern; do not add permissive policies to silence the advisor.
- The existing [leaked-password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains a service-plan/configuration follow-up. No paid plan or auth-policy change was made during this UI release.
- Performance advisor: 14 [unindexed foreign-key notices](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), primarily small versioned build/audit tables, and 11 unused-index notices. Active builds currently have 11 rows; the largest sampled build-related table has 120 rows. Retain current indexes and reassess covering indexes with Phase-4 catalog/query growth; current evidence does not justify changing authority SQL or adding speculative infrastructure.

The production dependency audit identified advisories affecting Next.js, Sharp and PostCSS. The closeout upgrades Next.js and its lint integration to the patched 16.3.3 release, with patched transitive image/CSS dependencies in the committed lockfile. See the [Next.js security release](https://github.com/vercel/next.js/releases/tag/v16.3.3). CI now audits production dependencies and blocks high/critical advisories.

## Release gates

The candidate must pass formatting, lint, typecheck, unit/service tests and the production build; applicable database/buildcraft/browser workflows; rendered desktop/phone review; and the production dependency audit. PR #445 holds the exact candidate SHA, workflow results and screenshot artifacts. Never label queued or failed checks as passed. Production publication is restricted to the verified release, followed by restoring the deployment lock.

## Phase 4 handoff

After the explicit start command, begin by validating the five already-authored Disciplines and assessing the incomplete sixth Foundation, Ironfist, using the existing versioned Skill/cooldown engine, pure 8 + Essence / mixed 6 + Resonance legality, shared immutable AI/PvP snapshots and saved-loadout authority. Do not rebuild these foundations.

Before adding content, specify tactical identity, acquisition/mastery, AI use, counterplay, media needs and interaction-test coverage. Grow to 6–8, 12 and 16 only when the previous roster supports meaningful choices and sustainable authoring. Preserve the representative pure/mixed regression suite, security gates and desktop/mobile layout evidence. Collect broader human validation and route latency percentiles when a sufficient cohort exists; low-traffic database averages do not establish scale readiness.

No Phase-4 roster, Soulmark/Mantle, frontier or other future gameplay implementation is part of this release.


## Pre-Phase-4 readiness audit — 2026-09-11

This is a bounded follow-up audit requested by the Owner. Phase 4 remains **not activated**.

### Observed release and concurrency boundary

- Inspected `main` at `f7248dcf20a6ee0ff74ed630308317890dd65979`.
- Vercel production alias points to release commit `9da6c4684f99b0617cdccab019a38f90f56795b0`, deployment `dpl_6kaqfDcjSkT7qbJ9EnKt8CaNpweJ`, READY. The subsequent main commit restores the deployment lock.
- PR #446 merged during this audit as `b3989ada`, followed by release `0df098e8`. The audit branch was reconciled with those changes; its release interactions remain separate evidence.
- Open PRs #441, #438, #404 and #373 also exist. Do not merge stale branches wholesale. Compare each against current main and retain only proven unresolved differences; no branches were deleted or closed by this audit.

### Findings and disposition

| Finding | Evidence / disposition |
|---|---|
| Published rules drift | Live Manual index still advertises Level 1–100. Source guide/control hints still say 25 AP movement and describe direct PvP/buildcraft as future. Corrected to current rules and delivery status; movement and level copy now read existing game-core constants. |
| Governing-document drift | Reconciled AP costs, Movement allowance, Level 50 and the roster sequence in AGENTS, Master Plan, Combat, Player Manual and Roadmap. Historical snapshots remain historical. |
| Creation documentation drift | Current creation code at `26941286` supplies five personal points over a fixed Primary base; the older addendum still described six bonus points. The synchronization note in that addendum records the shipped boundary without changing allocation runtime. |
| Roster scope already exceeded | Five authored eight-Skill libraries, five enabled Essences and ten enabled unordered Resonance pairs. Ironfist is enabled in both slots but has no mature library/signature coverage. Credit the existing five and complete Ironfist after phase activation. |
| Production account verification gap | This audit's browser reaches account entry and is not authenticated. No new production Profile/build-save/battle/reconnect/result interaction PASS is claimed. Existing PR #445 browser/DB evidence is inherited, not a substitute for this missing production flow. |
| Mobile polish handoff | PR #446 merged during the audit. Preserve its phone portrait, Technique labels, buttons and tags, and use its exact-release browser evidence. |
| Operational follow-ups | Leaked-password protection configuration, catalog-growth indexing and meaningful latency percentiles remain tracked below. No paid services or speculative database changes were introduced. |

### Current read-only production checkpoint

At approximately 11:36–11:39 UTC:

- Supabase project reports ACTIVE_HEALTHY. Sample: 10 database connections, zero deadlocks and zero waiting locks. Cumulative rollbacks remain 118,323,265, matching the earlier closeout sample; this is historical evidence, not an active rollback storm.
- The previous hour returned no error/fatal Vercel runtime-log groups. Absence of returned logs does not prove every client interaction succeeded.
- Security advisor remains at five informational RLS-without-policy notices and the leaked-password-protection warning. Direct privilege checks confirm neither browser role can access those five tables.
- A broader privilege check confirms neither browser role has USAGE on `app_private`, and zero private tables grant either role SELECT/INSERT/UPDATE/DELETE. The generic table-list warning that no-RLS private tables are publicly exposed is contradicted by these actual grants. Preserve the server-only access model.
- Performance advisor remains at 14 unindexed-FK and 11 unused-index informational notices. Small versioned catalogs do not justify speculative index churn. Reassess with measured query/catalog growth.
- Production progression cycle 1 points to curve version 2, maximum Level 50. Historical version 1 remains stored; do not delete it to tidy the table.
- Production catalog: six enabled Primary/Secondary Disciplines; five enabled Essences; ten enabled Resonance pairs, all among the five authored Disciplines; one enabled private PV-2 tester.
- Current production dependency audit: no known vulnerabilities reported by `pnpm audit --prod --audit-level=high` for the checked lockfile.

These are bounded observations, not a penetration test, capacity certification, balance study or independent human PV-2 result.

### Migration-history blocker and repair

The current-main Supabase Preview check failed because remote migration versions did not match Git filenames. A name/content comparison found 73 migrations on both sides, with 28 timestamp differences. The affected SQL was equivalent after accounting for comments/whitespace/outer transaction wrappers. A guarded transaction repaired only those 28 history version values, preserving recorded SQL and all game data. A fresh hosted migration listing now matches all 73 Git names/versions exactly, with zero missing or extra entries. See `MIGRATION_HISTORY_RECONCILIATION_20260911.md` for the reversible mapping. The old failed check remains historical; a subsequent integration check must establish its own result.

### Verification and limits

The initial and final pre-reconciliation `pnpm check` runs passed formatting, lint, typecheck, 544 Vitest tests plus six report-script tests, and production build. Four new Manual consistency tests cover current cap, creation pool, terrain AP and delivered/future content boundaries. No gameplay tests were weakened. Post-reconciliation `pnpm check` also passed after incorporating PR #446. The subsequent main change `e680998c` only restored the deployment lock and was fast-forwarded before finalization.

The cloud browser cannot open the local preview (`ERR_BLOCKED_BY_CLIENT`). Local server/HTTP preview attempts do not establish rendered-layout evidence. The live public Manual was inspected, but a signed-in production Profile → configure/save → battle → reconnect → results check remains pending secure sign-in. No production deployment was initiated by this audit.

### Battle-map disposition

The shared arena source retains the 5×3 Basic Training Floor and 9×7 Duel Yard; server battle services consume the arena definitions and authoritative movement evaluation. No geometry change is justified solely by roster growth. Before adding/expanding maps, exercise each playable format with Level-1 Movement 2 / Jump 0 and higher-mobility builds, checking legal routes, time to engage, ranged opening pressure, rough-terrain cost, elevation access, side bias and mobile readability. Map balance remains a playtest question; existing legality/arena/AI regression tests do not prove balanced matchups.

### First Phase-4 ticket, prepared but inactive

**P4 preparation — inherited roster acceptance matrix.** Purpose: determine the smallest remaining content work before roster expansion. Reuse the current Skill/effect/cooldown engine, shared AI/PvP snapshots, saved-loadout authority and current media contracts.

| Discipline | Authored Skills | Pure Essence | Mixed-pair coverage |
|---|---:|---|---|
| Vanguard | 8 | Present | Other four authored Disciplines |
| Lifebinder | 8 | Present | Other four authored Disciplines |
| Aetherist | 8 | Present | Other four authored Disciplines |
| Farstrider | 8 | Present | Other four authored Disciplines |
| Shadehand | 8 | Present | Other four authored Disciplines |
| Ironfist | 0 mature library | Missing | Missing |

Acceptance work: verify every existing Skill's legality/cooldown, pure-vs-mixed exclusion, reverse Primary pair behavior, AI use, counterplay, acquisition/testing-entitlement distinction, signature presentation and media coverage. Review battle maps alongside those matchups. Then define the focused Ironfist content ticket (eight Skills, one Essence and five pair relationships) under existing approved design authority. Do not invent new mechanics or start implementation during this audit.

The next roster target is six complete Foundations, then 6–8, 12 and 16 validated Disciplines. Authored count alone never advances a quality gate.
