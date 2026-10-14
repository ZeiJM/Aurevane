# Ability foundation release checkpoint

Status: implementation verified locally; CI, hosted migration and Production
release pending. This document does not claim the foundation is live yet.

The Owner authorized releasing accepted modular Ability definitions and the
shared execution foundation first, then continuing the remaining overhaul.
Accepted source is `930a5b94a226b2a6a66bc4647e684bea0073be5e`.
Current-main gameplay baseline is `0bf7958f37dba19092ce435b9e963b39e5facb95`;
documentation-only roadmap changes through `a5069763` are preserved.
Incomplete targeting checkpoint `91fca778` is excluded from this release.

## Delivered scope

- Structured Ability behaviors with typed costs, Requirements, supported-tag
  compatibility validation and strict historical-definition handling.
- Captured Skill, Essence and Resonance sources; Manual actions/modifiers,
  supported Automatic reactions, source-owned Ongoing damage contributions,
  atomic AP/MP/HP payment, limits, interruption and battle/AI integration.
- Current standard PvP and World attack constructors now use the same exact
  source capture and startup authority as AI and the original PvP service.
  Native-only encounters retain the existing v1 creation boundary.
- Startup snapshots, real receipts and private provenance persist together.
  World v2 delegates existing admission locks/checks and rolls back the entire
  encounter, lobby and route interruption if startup persistence fails.
- Current extension and pinned capture reads run in bounded concurrent waves;
  current Skills retain the existing batch resolver and deterministic ordering.

## Independent review corrections

Three independently reproduced coexistence findings are covered by regressions:

1. Automatic defeat during AI/PvP timeout settlement preserves the terminal
   result and does not try to face or finish an unavailable original turn.
2. An interrupted native Summon cast cannot spawn or schedule a summon after
   its actor is defeated; paid command and child outcomes are retained.
3. Native hit-dependent Resonance payoffs retain the confirmed-hostile-hit
   gate when modular sources coexist, including missed and interrupted targets.
   Independent actor effects retain their own settlement rules.

## Verification

Fresh full local `VITEST_MAX_WORKERS=2 pnpm check` passes formatting, lint,
eight-package types, 5,582 Vitest tests, seven Node checks and production build.
Focused coverage passes 86 engine checks, 38 current-entry/build checks and 32
PGlite startup/migration checks, with failing baseline regressions recorded.
Production dependency audit reports no known vulnerabilities; worker boot passes.

`supabase/tests/captured_ability_startup.sql` runs through the Battle Session DB
workflow after a complete native migration reset. Docker is unavailable locally;
native schema/trigger/concurrency and responsive browser CI remain release gates.
The inherited Vite native-loader advisory is visible and deferred to full-overhaul
integration; it has not been suppressed or treated as a test failure.

Hosted inspection finds old creation functions and the original `> 1` receipt
constraints; the two additive startup migrations are required before release.
The current generic publication/version/draft tables are empty. No new roster,
Master editor, Move/Controlled mechanics or unfinished targeting is published
by this foundation. Hosted performance and human gameplay remain separate
testing outcomes. Later Owner requests are preserved in
`docs/superpowers/specs/2026-10-14-overhaul-owner-followups.md`.
