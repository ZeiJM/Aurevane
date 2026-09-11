# Phase 3 closeout and Phase 4 preparation

Date: 2026-09-11. Release: PR #445, following the performance/UI baseline in PR #444.

## Owner decision and boundary

The Owner approved closing Phase 3 once the requested page/popup presentation, mobile bottom-edge and performance corrections are complete and released for testing. This document records that conditional decision; closure takes effect after the release checks pass and production is READY. Phase 4 is **not activated** and requires the Owner's separate start command.

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

After the explicit start command, begin with the roadmap's four representative Disciplines, using the existing versioned Skill/cooldown engine, pure 8 + Essence / mixed 6 + Resonance legality, shared immutable AI/PvP snapshots and saved-loadout authority. Do not rebuild these foundations.

Before adding content, specify tactical identity, acquisition/mastery, AI use, counterplay, media needs and interaction-test coverage. Grow to 6–8, 12 and 16 only when the previous roster supports meaningful choices and sustainable authoring. Preserve the representative pure/mixed regression suite, security gates and desktop/mobile layout evidence. Collect broader human validation and route latency percentiles when a sufficient cohort exists; low-traffic database averages do not establish scale readiness.

No Phase-4 roster, Soulmark/Mantle, frontier or other future gameplay implementation is part of this release.
