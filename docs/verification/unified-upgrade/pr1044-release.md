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
