# PR 1044 release verification

## November 18 candidate checkpoint

The original candidate `7ed43fc57c464daa476fd6c020e4096504b0d3a6` and the proposed merge against `d214507b9a2f09cd415c239c4f6d2eef4be35b6b` both have tree `d87f449a5a7efb2093ecea19ed02b7f4330f93d4`.

- [Living Atlas](https://github.com/ZeiJM/Aurevane/actions/runs/44389322979) passed 117 authenticated Atlas cases. The simultaneous attacks returned 409 and 200, with one shared encounter and zero equipment read errors. Desktop and mobile Chromium passed the seeded active-refuge arrival, exploration and return to the dock, and the Farwater Span walk and Lanternward Tower reload. The disposable PG17 setup applied the two successor migrations in order.
- [World timing](https://github.com/ZeiJM/Aurevane/actions/runs/44389323069) passed three mobile and 60 desktop cases. [CI](https://github.com/ZeiJM/Aurevane/actions/runs/44389322926) passed on the retry after the initial quality job reached its runner time limit during the build.
- The native evidence and water archive digests match GitHub. Desktop and mobile captures were reviewed for Willow Cascades, Emberreach, the valley, the colosseum and World controls. The smaller Atlas artifact now includes the refuge, tower and long-route captures for review on the successor revision. The earlier full archive exceeded the download limit.
- [Browser Smoke](https://github.com/ZeiJM/Aurevane/actions/runs/44389323384) was still running at this checkpoint. Check the exact successor revision after the release tooling change. Physical handset and human playtesting remain separate from authenticated browser evidence. The [82-row matrix](requirements.csv) retains open acceptance.

## Production preflight

The live baseline is PR #1043 at source `6216bff7a8c1ab6432d223159eabbfd91278e2b1`, Vercel project `prj_ZmH66I1zyOARUt8OXdTl7CN9r18d` and deployment `dpl_7wFcLjXVCagiAvH5jLwV8oc7MaZ5`. The Production ledger contains 263 entries through `20261114114000`. Its fingerprint is `0ed8ed8e65bd4cff3a1c75bd675d749dba3f8dfaedfdcd0bfeefb68f73eb905f`. The existing return cron is active.

The only approved pending migration sources are:

| File | SHA-256 |
| --- | --- |
| `20261118170000_world_ferry_active_uncharted.sql` | `11a0561b8d5ff36d111959433300b43c283ac9e5850a639883e341fb6dbf3422` |
| `20261118171500_offshore_and_water_teleport_geometry.sql` | `e8619fbd04071a9fcd5453cffbc57cd1cc67125a7ad78cc168a4a40958588451` |

The exact-file transaction was rehearsed on a reduced local PostgreSQL 17.5 fixture. It applied in order, rejected replay, rolled back an intentional postflight failure, and preserved the ledger, world state, original trip modes, geometry, privileges and cron. The full disposable hosted test also needs to pass before release.

After the successor checks and native review, refresh main and verify the merge tree. Verify the exact merged source and applicable main checks. Dispatch **PR 1044 Production migrations** in plan mode from main with the full merged SHA. The existing GitHub Production environment controls access. Stage one READY Production build from that same SHA with automatic domain assignment disabled. Verify its project, source, and health before dispatching apply. Apply requires the confirmed staged SHA and rechecks the live ledger and both file hashes. A partial ledger or changed prerequisite requires inspection. A fully installed matching ledger skips replay. Keep the existing retirement rules and Git deployment lock.

Confirm application compatibility before alias promotion. The preceding application projects the legacy return station, so test its behavior against the migrated schema and verify recovery of newly admitted refuge/geometry state before relying on a prior-build rollback. Retain additive data and the existing cron. Record the checks, staged and canonical deployment identity, migration receipts and applicable runtime health here after promotion.

## November 18, 2026 Production checkpoint

PR #1044 merged at `ef46423c5e4c88566f4970607943efc12157eead` with the tested tree `99c5f9ae4e19c639b11a9adb710a12fd844e5690`. All 14 PR workflows and all nine applicable main workflows passed. The exact-source [Living Atlas run](https://github.com/ZeiJM/Aurevane/actions/runs/44411100346) passed 117 authenticated cases, including one shared encounter from simultaneous attacks and desktop/mobile refuge and offshore crossing cases. The ordered and atomic PostgreSQL 17 migration rehearsal passed, including rollback on forced postflight failure. [World timing](https://github.com/ZeiJM/Aurevane/actions/runs/44411100280) passed all 63 cases. The authenticated browser captures were reviewed. Physical-device and human playtesting remain open.

| Role | Production deployment | Source |
| --- | --- | --- |
| Canonical #1043 | `dpl_7wFcLjXVCagiAvH5jLwV8oc7MaZ5` | `6216bff7a8c1ab6432d223159eabbfd91278e2b1` |
| READY staged #1044 | `dpl_4N3VcdK8tjJU24gXUJ6ST89WXW2K` | `ef46423c5e4c88566f4970607943efc12157eead` |
| READY staged rollback | `dpl_4EHizugf4VTcB435me2Y6kPQA8FV` | `b0b1a87a1e45a57767fbaf3659d33821b90684c7` |

The approved recovery build keeps the previous app with compatible offshore/refuge projections, saved route continuation and the candidate v5 staff teleport adapter. Its tree is `0da45bf505248779af729d79e8720d96c0b1cd27`. Its 201 focused tests and typecheck passed. The initial fallback `dpl_2p9it3iWbWXffMe1NFArnoU9mtq8` was retired before migration or alias movement to protect the immutable v4 registry. The replacement and release build passed World shell, signed-out auth status and World API authorization smoke before migration. Signed-in staged play and physical-device acceptance remain unverified.

The [protected plan](https://github.com/ZeiJM/Aurevane/actions/runs/44442135076) verified the installed ledger and the two ordered hashes above against the merged source. GitHub displayed a request acknowledgment for apply, but its workflow run list and API exposed only the completed plan after a retry and polling. At 10:21 p.m. AST the Production ledger still held the original 263 rows and zero #1044 rows. There is no confirmed apply run or migration receipt. The canonical alias still serves #1043. Neither staged build was promoted. The temporary staging host and pin allowances were restored to the previous nine-rule policy, version `fbaa7c14-46dc-4559-9090-8e250d81f929`. Git auto-deploy remains disabled.

Resume by reading the workflow and ledger before submitting an apply or creating a build. The guarded workflow targets `main`, mode `apply`, with both source fields set to `ef46423c5e4c88566f4970607943efc12157eead`. Require its successful receipt, verify the exact ledger additions and use the already staged release and rollback deployments. Restore only their exact compatible host and pins for staged smoke and cutover, preserve all retirement rules, then promote the already verified release deployment. Do not promote the retired first fallback.
