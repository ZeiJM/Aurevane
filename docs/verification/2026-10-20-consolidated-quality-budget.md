# Consolidated release quality-job budget

The first consolidated release brings forward the already approved Task10B aggregate quality-job headroom: `jobs.quality.timeout-minutes` increases from15 to25. This is the only workflow behavior change. Database foundation retains20 minutes; commands, order, runner, concurrency, individual test timeouts/assertions and the Vercel Git deployment lock remain unchanged.

CI run39524363881, quality job118975439930, was cancelled at `2026-10-21T01:12:03Z` on candidate `179a68d0` (PR958). All12,101 Vitest tests plus7 Node checks had passed. The test stage consumed12minutes32seconds, in addition to setup and preceding quality work. Worker build completed; web build had just started at01:11:42. The retained job log reports generic cancellation around the configured15-minute job budget. Budget exhaustion is consistent with this chronology, but the generic message does not explicitly prove the cancellation cause.

The interrupted job does not establish a successful web build or complete quality gate. Original failed evidence is retained. The new final head still requires the complete native gate; an increased budget is not a substitute for that result. No application source, UI, migration, dependency or test assertion changes accompany this repair.

Local validation is limited to YAML parsing, a structural comparison proving the quality timeout is the only workflow delta, Prettier and `git diff --check`. No additional broad suite is run for this CI-only repair.
