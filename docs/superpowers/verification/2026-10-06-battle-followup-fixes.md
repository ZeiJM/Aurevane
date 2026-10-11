# Battle follow-up fixes — 2026-10-06

Owner authorized the collected corrections and elevations 1–3 at 60%/30%/10%. Owner selected complete global rounds for non-instant status durations. One agent, Medium. Owner explicitly authorized publishing and making this completed, verified batch live on 2026-10-06, then gave standing permission for completed tasks.

## Behavior verified

- Newly queued non-instant statuses activate next round and cover complete rounds. Guard, Defenseless and Vulnerable damage multipliers are tested with both initiative positions. Round counters survive reload; instant overrides and previously stored lifetimes retain their timing. Status copies retain round metadata.
- Manual End Turn stays exempt from Defenseless. First AI/PvP AFK timeout queues it; six-participant boundaries and terminal/idle history remain tested.
- Basic Attack uses the higher committed offensive stat, Physical on ties. Canonical preview and commit use the matching Defense. The existing reference duel pool naturally averages 11.425 rounds after this family correction, without damage formula changes.
- Chronicle order follows recorded turn/action/end-turn numbers per round, including histories lacking the first turn-start entry.
- Red paths require a legal canonical damage forecast with a living recipient. Empty, blocked, defeated and non-damaging areas do not glow.
- New standard and teaching map instances draw seeded raised platform heights at 60/30/10, preserving flat ground/geometry/terrain and saved maps. Connected raised tiles remain level.
- Essence explanatory tags, power description, concise Move parameters from committed stats, paper Effects styling, removed arm-action hints and shared lobby VS artwork/flames use the shared presentation paths.

## Evidence

`pnpm check` passed after final changes: formatting, lint, typecheck, tests and production build. Game core: 2,262 passing tests. Web: 1,554 passing tests and seven passing Node checks. Other package suites passed in the same gate. `git diff --check` passed.

Local Chromium launch was unavailable; its download returned an invalid archive. Browser verification is not claimed locally. Existing responsive browser CI includes updated popup transparency/hint assertions. Main was refreshed before publication and remained `e86555d35dd5219166381c02284c40819c1af0cd`.

No database migration or live production mutation. Vercel Git deployment remains locked. PR and CI results belong in the PR release record; this document does not claim deployment.

## CI follow-up

The first PR run reproduced a stale browser expectation for the removed black Effects block. The palette regression now verifies transparent Effects and the readable paper palette in pinned readers while preserving the existing inline dark palette checks. CI also reported GHSA-wq5f-xc86-pv6w, newly indexed on 2026-10-06; the lockfile updates Sharp 0.35.4 to patched 0.35.5 and its bundled native libraries. The targeted pnpm refresh also deduplicated source-map-js to the already locked 1.2.2. `pnpm audit --prod --audit-level=high` then passed with no known vulnerabilities. Full quality gates and browser CI are rerun before release.

A targeted CI run also exposed a legacy authority test that assumed an authored raised tile always had height 1. It now accepts exactly 1–3 and explicitly checks map generation leaves combat RNG draws at zero. Distribution and seeded geometry remain covered by the dedicated map regressions.

Browser smoke exposed a target-highlight race introduced by coupling Basic Attack target markers to asynchronous path forecasts. Immediate candidates now come from the shared range/team/HP selector; only the red path depends on a legal canonical damage forecast. Guided Fundamentals aborts informational previews before its final attack and verifies an eligible target remains selectable, no unconfirmed path glows, and the native gesture commits successfully.
