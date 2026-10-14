# Ability foundation release checkpoint

Status: LIVE for testing through PR #896, merge
`128f7add15aefed3384310a5f138466b1ff5b625`. Production
`dpl_3pgy6TV6Z9zUfbCgnMfjwykQX7xv` is READY at
`2026-10-14T04:54:47.255Z` (October 14, 00:54:47 Trinidad), with
https://aurevane.vercel.app assigned to that exact source.
Tested candidate `d7e489a3dc80b4114dea93d1999d3510a9476e8d` and merge
share tree `e38080bc77182a4d496f25ac4432ff0bbd6b7f87`.

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
native schema/trigger/concurrency and responsive browser CI subsequently passed.
The inherited Vite native-loader advisory is visible and deferred to full-overhaul
integration; it has not been suppressed or treated as a test failure.

Hosted additions are applied as `20261014045202_captured_ability_startup_events`
and `20261014045207_world_captured_ability_startup`. Source SHA-256 values:
`00764e9c2caaf9cccf8fb3855373cb395dbeb01c98ccbd1f81a9c4f2a1b26f39`
and `8584820738ea5f42fb32a1a8f85735b5b3a96a42d87cc6a4e1f35236a2980a69`.
Creation remains service-only; private append is denied even to service_role.
All three predecessor v1 function-body hashes are unchanged.
The current generic publication/version/draft tables are empty. No new roster,
Master editor, Move/Controlled mechanics or unfinished targeting is published
by this foundation. Hosted performance and human gameplay remain separate
testing outcomes. Later Owner requests are preserved in
`docs/superpowers/specs/2026-10-14-overhaul-owner-followups.md`.


## Release acceptance evidence

All fourteen workflows pass on the exact final candidate. The native startup
fixture passes 20 pgTAP assertions after a full migration reset, along with
existing real persistence/ownership/concurrency/privacy/HTTP checks. The first
native attempt exposed missing RNG in the test fixture; loading the actual
snapshot-guard migration reproduced 16 local failures, then corrected fixtures
pass 32/32. Production code was not weakened to accommodate the fixture.

Full browser smoke passes 345 Chromium and 10 Edge cases; its existing 264 / 2
project-specific skips remain. Earlier focused 73, recovery 6, training 3 and
Master/WASD checks pass. The serial full Chromium run takes 52.3 minutes.
Living Atlas passes 47 enabled cases. These are disposable CI gameplay checks,
not production player mutations or human playtest acceptance.

Live public root, Manual, Rules, News and both recovery pages return 200. The
protected World route returns the ordinary anonymous home redirect. The initial
warning/error/fatal scan scoped to this deployment has no matching groups;
it does not establish indefinite runtime health or hosted gameplay latency.
Security-advisor groups/counts match the pre-migration baseline. Git deployment
configuration remains locked, and this documentation receipt does not redeploy.

## Owner testing checklist

- Start new AI Sparring, a standard PvP lobby and a World encounter; check entry,
  AP/MP costs, cooldowns, turn handoff and genuine no-input timeout behavior.
- Reload an existing encounter and inspect its recorded outcomes/history.
- Check ordinary hit/miss, Summon and Resonance behavior in normal play.
- Custom modular definitions and deeper new mechanics receive their complete
  authoring/readers/roster delivery in the remaining overhaul.

The broader secondary-heal-on-miss report remains a pending follow-up; the
release correction here specifically protects native hit-dependent Resonance
payoffs when modular sources coexist. Account portrait relocation, weather/
day-night/Master controls and movement-time map loading are also pending.
