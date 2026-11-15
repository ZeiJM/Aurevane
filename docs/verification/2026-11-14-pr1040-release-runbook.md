# PR1040 — Conditional production release

Nick authorizes fixes, restarted quality checks and one live release for testing **after all required gates pass**. This is the unified World Map / World Atlas patch in `ZeiJM/Aurevane#1040`, branch `agent/world-mountain-weather-visuals-20261113`. Keep automatic Git deployment disabled. Do not replay PR1038 or PR1039, create a Preview, republish combat content, reset progress, or replace historical migration entries.

## Known production baseline

Read-only inspection confirmed these targets while preparing this release; refresh them before mutation:

| Item                       | Value                                                              |
| -------------------------- | ------------------------------------------------------------------ |
| Main / live PR1039 source  | `d32cabd7f626b650df5c5eacf6a85a4457fc1f85`                         |
| Supabase production        | `luazfeupwfgnilohfsya`                                             |
| Installed migration ledger | 259 entries, latest `20261112183130`                               |
| Ledger source digest       | `60aa72680eee7146cdc39bbed56f4890c7c91e8c893516f7094e9b41fe59ad4b` |
| Vercel project             | `prj_ZmH66I1zyOARUt8OXdTl7CN9r18d` (`aurevane`)                    |
| Vercel team                | `team_oZRrN2ckoy5ge7NgZfp1B6de`                                    |
| Previous READY production  | `dpl_2qcM7NQf7u2UEWZ32ZRKJ8RrKUUu`                                 |

## Required release evidence

Use the actual current PR head, not an earlier chat SHA. Require all configured checks on that exact candidate, including Browser Smoke's complete Chromium selection and final Edge gate, Living Atlas, all database checks, and the timing workflow's three mobile crowd cases plus sixty desktop repetitions. The new atomic release-wrapper test must prove both forced-postflight rollback and successful migration on disposable PostgreSQL 17. Intentional non-dispatched production/staging jobs do not count as executed acceptance tests.

Review the native evidence for the requested art, movement, saved-position safety, Uncharted return and staff teleport. Source tests alone do not close visual/FPS acceptance. The consolidated implementation and evidence history is in [the PR1040 verification record](2026-11-14-world-map-pr1040.md). Preserve the Owner's remaining human playtesting as a distinct acceptance step.

Refresh main immediately before merge. If it advanced, inspect/reconcile overlaps and rerun affected checks. Merge only the verified candidate, confirm the resulting main tree equals its tested tree, and keep `apps/web/vercel.json` Git deployment lock intact. A ready-for-review transition is allowed as part of this authorized release; do not merge a red or pending candidate.

## Production sequence

The `living-atlas-browser.yml` manual production modes execute reviewed main only and require `expected_candidate` to equal the full main commit SHA. The guarded tools use the existing `AUREVANE_PRODUCTION_DB_URL` environment secret; never retrieve or print its value.

1. Run `production_dry_run=true`, with all mutation/staging flags false. Require its observed ledger and ordered inventory to match exactly the four Nov14 files: geometry v3, saved-geometry recovery, durable pre-rotation return, geometry v4.
2. Run `production_world_map_apply=true`, other mode flags false, on the same exact source. The reviewed script obtains nonblocking account/table locks, rechecks accounts under the World lock, executes all four hash-pinned bodies and ledger additions in one transaction, and asserts preservation before commit. Any lock, SQL or postflight error rolls back the whole batch; inspect its result before retrying. No general write-pause attestation substitutes for those actual locks. The cron remains disabled.
3. Verify successful migration receipts, four source statement hashes, service-only public RPCs, private ACLs, preserved v1/v2 geometry/RPCs and inactive return cron. New geometry rows are registered by the deployed staff adapter; do not fabricate registrations or replace old rows.
4. Create **one staged Production build** from the verified main commit without assigning canonical domains. Confirm the Vercel project/team, target `production`, source commit and READY status through the authenticated connector. Smoke the controlled production URL and relevant public assets/health responses. Reuse this same build for promotion; do not promote a Preview or rebuild an unverified branch.
5. Promote that verified Production build. Verify the canonical domain/alias, source metadata, normal public response and accessible authorized flows, then scan the new deployment's runtime errors. Do not claim authenticated playtest coverage if the available session cannot perform it.
6. Independently verify the READY canonical deployment's full source SHA through Vercel. Run `production_void_cron_activate=true`, all other mode flags false, with both `expected_candidate` and `deployment_ready_sha` equal to that source. The script checks installed source/ACL/trigger invariants and activates only `aurevane-void-pre-rotation-return-v1`: once per minute, batch 250, postgres database/role. Require its postflight to pass.
7. Check the actual cron state/execution and canonical runtime after activation, record the deployment ID, source/tree, migration/postflight evidence and outstanding Owner acceptance, then stop the release follow-through task. If a stage already completed, verify and resume from its receipt; do not blindly apply or build it again.

Do not release around an unresolved native failure, partial migration, changed baseline, unverified deployment source, or failed preservation assertion. Stop and report the concrete blocker if it cannot be repaired within this authorized patch. Preserve additive database state and historical ledger during any app rollback; never improvise a destructive migration reversal.
