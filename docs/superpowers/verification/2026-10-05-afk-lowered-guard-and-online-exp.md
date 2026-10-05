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
- Combined `pnpm check` passes: formatting, lint, types, 4,027 Vitest checks, seven Node checks and build. The final test count includes unavailable EXP coverage.
- All eleven exact-head CI workflows and responsive browser checks pass candidate `989d84ae0d1063e0cea3ecd8f131f75423c6311a`, tree `2d9ee9675bda59641b022deacc58052c04c35117`.
- Initial candidate `10d24afaeb6f101357f15467a75718904852c270` passed CI, Skill Engine, Desktop experience (48 cases) and Representative Buildcraft. UI review exposed an invalid direct-XP-write fixture; six directory cases failed before reaching layout assertions. The fixture now uses the existing authoritative XP-grant RPC for 10 EXP, below the level-up threshold. The live database read-only permission probe confirms existing EXP/portrait reads; clean installs lacked that column contract. Additive migration `20261005170919_online_character_experience_projection.sql` grants only SELECT on those two columns to the existing server role. Foundation checks execute the actual selection as service_role and verify reapplication leaves browser grants/RLS unchanged. No broad table read/write grants or new privileged functions.
- Candidate `01036185fdc463c30dafc37b3fbf6c934594f07e` passes Foundation Security DB, Wayfarer's Practice DB and Attribute Allocation. The newly triggered legacy battle HTTP journey still expected the player to act first with Agility 4 against recruit Agility 5 under current Initiative rules. Its 36-Core fixture was changed to Agility 7, retaining the first-actor and every authority/replay/stale-version assertion. Added a safe failing-line diagnostic; no credential or request-token output.

## Release boundary

The existing deployment lock remains fully disabled during verification. The Owner's standing combined Production request covers this related battle/Online Users follow-up. Apply the verified additive read-column migration before the application release; it is idempotent for the already-permitted Production columns. No hosted Auth/content setting or Production-account mutation is required. Authenticated browser/API checks use disposable local Supabase; Production authenticated gameplay acceptance remains distinct from public smoke and runtime observations.

## Large-roster follow-up

Candidate `e525bd4e5c20b52ab279a8b5471d6b5d21573646` passes nine workflows, including 110 UI layout cases plus the directory scenario and Desktop experience. Battle HTTP fixture validation rejected Vitality 4 below Vanguard’s base 7; the corrected tuple is 9/4/7/7/3/6 (36 Core), with all base minima and first-actor assertions intact. Full browser runs passed 315 cases but EXP was null in two later roster scenarios. Large-roster request-limit regression tests reproduce the missing projection and pass with sequential 100-ID batches, preserving complete identity, portraits and EXP across the supplied IDs without broadening public fields. The 1,001-ID unit input tests hydration under gateway/row limits; existing base-list RPC result limits remain unchanged. The final bounded-batch candidate passes the full exact-head rerun before release.

## Final CI and Production receipts

All eleven workflows pass: CI, Skill Engine, Foundation Security DB, Battle Session DB, Discipline Build DB, Attribute Allocation, Wayfarer’s Practice DB, Representative Buildcraft, UI layout review, Desktop experience and Browser smoke. Browser passes6 real-mail recovery,3 training,71 focused,317 full Chromium and10 Edge cases; the two previously failing later-roster EXP reads now pass. Layout passes native mobile Profile swiping,110 responsive scenarios and the directory check; Desktop48 and Buildcraft24. Existing project-specific skips remain unchanged. Source review and full local quality (4,027 Vitest, seven Node, format/lint/types/builds) have no blockers.

PR #836 merges the identical tested tree as `6d0b6101b1f7ab3a310a637aa0b1c8a6016787d8`. Production migration `20261005194142` (`online_character_experience_projection`) applies the exact verified SQL. XP/portrait reads remain permitted, actual service-role selection succeeds, browser grants/RLS/policy hash remains `25ee1e7784a17b7c4f9418b553a00d0f`, and the two pre-existing security notices are unchanged. No hosted Auth/content or Production-account mutation.

Configuration/docs-only PR #837 releases source `ca0348cbd9433a506ff1bb011166c252e0321752` as READY deployment `dpl_2A6Wb7Qvwpx1TcPmxKhuL9UoMvor` at `2026-10-05T19:44:02.923Z`. The primary https://aurevane.vercel.app/ alias resolves to that exact source. Eight public checks pass: entry, reset-password, Manual/index/search/resource article, Rules, News and VS WebP. The existing HP/MP article values remain present. Deployment-scoped warning/error/fatal logs are empty from READY through `2026-10-05T19:45:02.838Z`. This configuration/documentation-only closeout restores the full lock with identical application bytes and no second application release. Authenticated browser/API/mail checks use disposable CI; authenticated Production gameplay and Owner visual acceptance remain separate outcomes. Earlier approved releases remain included.
