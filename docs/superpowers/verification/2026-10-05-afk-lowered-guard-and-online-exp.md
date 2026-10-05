# AFK Lowered Guard and Online Users EXP verification

Base: `bd937ba8f2397dad2d9aa2473db081a992d38290`. Isolated branch: `agent/idle-lowered-guard-20261005`.

## Scope

Manual End Turn remains exempt. Current AI first-timeout grace is removed through the existing timing-policy gate; PvP, legacy rules, server clocks, stacking and tag timing remain intact. Default round-3 timeout queues Lowered Guard for round 4 for one completed affected turn. Real-engine tests exercise queue/activation/expiry and 25 versus 10 damage before/after vulnerability. Chronicle integration verifies the round-4 pending line and one-turn active exposure.

Online Users exposes only Owner-approved current Character EXP through the existing server-only identity projection. Desktop adds the EXP column beside Level; mobile shows EXP in compact identity text. Both views support numeric Level/EXP ascending and descending and keep Last Seen most recent as the initial sort. Unavailable EXP stays honest and sorts last. Existing auth, no-store responses and private-data exclusions remain.

## Evidence

- RED: current AI round-3 timeout produced no pending debuff, while current PvP passed; Chronicle showed idle narration with no outcome.
- GREEN: focused mechanics, idle-history and log projection checks pass after the one-line eligibility fix.
- Directory RED: missing comparator and EXP column/default-sort controls failed the new checks.
- Directory GREEN: numeric sort and public row checks pass; additional unavailable-value case added.
- Independent reviewer found no blockers in timeout mechanics or the presence/social/browser diff.
- Combined `pnpm check` passes: formatting, lint, types, 4,025 Vitest checks, seven Node checks and build. The final test count includes unavailable EXP coverage.
- Exact-head CI and responsive browser checks pending.
- Initial candidate `10d24afaeb6f101357f15467a75718904852c270` passed CI, Skill Engine, Desktop experience (48 cases) and Representative Buildcraft. UI review exposed an invalid direct-XP-write fixture; six directory cases failed before reaching layout assertions. The fixture now uses the existing authoritative XP-grant RPC for 10 EXP, below the level-up threshold. The live database read-only permission probe confirms existing EXP/portrait reads; clean installs lacked that column contract. Additive migration `20261005170919_online_character_experience_projection.sql` grants only SELECT on those two columns to the existing server role. Foundation checks execute the actual selection as service_role and verify reapplication leaves browser grants/RLS unchanged. No broad table read/write grants or new privileged functions.

## Release boundary

The existing deployment lock remains fully disabled during verification. The Owner's standing combined Production request covers this related battle/Online Users follow-up. Apply the verified additive read-column migration before the application release; it is idempotent for the already-permitted Production columns. No hosted Auth/content setting or Production-account mutation is required. Authenticated browser/API checks use disposable local Supabase; Production authenticated gameplay acceptance remains distinct from public smoke and runtime observations.
