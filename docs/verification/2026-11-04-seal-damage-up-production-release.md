# Seal and Damage Up production release

Verified live for Owner testing on November 4, 2026 at https://aurevane.vercel.app. Refresh the game before editing and start a new battle for newly authored/captured tags. The Master Panel hold is removed. This is automated release evidence; Owner gameplay acceptance remains open.

## Release identity

PR [#1015](https://github.com/ZeiJM/Aurevane/pull/1015) merges both tags as `dc6ba0349dc127018044fd59dcc78ed9316f9d61`. All 19 configured workflows passed on source head `c632198c075e365ec431a52845cb8c516acc38be`; the merge has the identical tested tree `7d88851e41518c374ce384df8c7be99d6f791f82`. Main stayed unchanged through cutover.

One staged Production deployment, `dpl_E9j4htHeNBGb5a385ea3H5TuhxJT`, was built from that merge and promoted without rebuilding. Build logs confirm checkout `dc6ba03`; canonical lookup confirms that same READY deployment and commit. Git automatic deployments remain disabled and automatic domain assignment was explicitly disabled after promotion. No second application deployment is needed for these receipt changes.

## Behavior and verification

Seal restricts selected Attack/Recovery/Utility discipline categories for ordinary Turns while keeping exempt sources usable. Rejected activations spend no costs and committed effects continue. Damage Up supports All Damage or a nonempty combination of Pierce, Fire, Water, Ice and Storm; matching identities apply each application once. Copy, stacking, delayed hits, Ground, reload, ordinary lifecycle, historical captures and concealed projections preserve their scopes.

The complete combat suite passes 7,121 tests and the web suite passes 8,791 tests plus seven Node checks. Native controls/save/reload tests cover 192 cases with 384 actual kernel resolutions, alongside focused overlap/copy/Ground/delayed/lifecycle/privacy coverage. All exact-source configured CI passed, including Browser smoke and UI layout. See the source receipts for full development evidence and independent review corrections.

Ten staged probes, ten protected-cutover probes and all 12 final canonical probes pass: public entry/Manual, guest redirects, unauthorized API denial, current deployment pins, obsolete header/query/cookie pins and old-host retirement. These are public/guest production probes, not an authenticated hosted authored-battle or human playtest claim. The bounded deployment-specific error/fatal scan from 23:10:42 through 23:11:28.600 UTC is empty.

## Database and protected cutover

Master authoring alone was held while the application was promoted and old readers retired. Retirement was verified at 22:16:41.294834 UTC; the conservative 1,950-second deadline was 22:49:11.294834 UTC. At 23:09:27 UTC the live database confirmed the deadline passed and zero pre-retirement client transactions.

Only source migration `20261104145206_seal_tag_identity.sql` was applied, recorded as hosted migration `20261104231024_seal_tag_identity`. Its unchanged source SHA256 is `dea18741af5a03cbe15b6b269c3b3c11930e58fdab137b3509d4e1d49d089ce7`; the guarded wrapper SHA256 is `bc26c36b2a8734465bcabcea1b7d344032a902fc38a7bb9b121a78fbc756a80b`. Transaction-local guards verify exact predecessor functions, preserve nine durable tables, all existing function owners/ACLs and unrelated function bodies, and require the new identity, presentation list and both finite timing writers. Independent before/after hashes also match for all nine protected tables.

Preserved: all 428 prior content records, 1,485 immutable versions, 317 publications, three Owner drafts, 11 timing history rows, 60 Item source rows, two inventory records, 94 Item stacks and two grant receipts. Only the additive Seal identity and finite vocabulary were installed. No content publication, Item republication, Owner draft overwrite or inventory/history rewrite occurred. Damage Up requires no schema migration.

Postflight confirms Seal is active, both timing writers include Seal with unchanged postgres-only ACLs, and the private presentation helper denies anon/authenticated/service_role execution. Only the temporary hold was removed; all nine retirement rules remain under routing version `fc781f28-7619-4bc0-85ae-6ecc7d4cc3fd`.

## Owner checklist

Use the [Damage Up battle checklist](2026-11-04-damage-up-types.md#owner-battle-checklist-after-release) and [Seal checks](2026-11-04-seal.md#release-boundary-and-owner-checks). Verify selected and unselected damage types, overlap once, per-application copy/stacking, save/reload, delayed/Ground hits and ordinary expiry/Dispel. Check selected Seal categories, exempt actions, no costs on rejection, Controlled cancellation, Cleanse and committed effects in PvE/PvP.

Machine evidence: [release receipt](release-assets/2026-11-04-seal-damage-up-progress.json). [Guarded registration](release-assets/2026-11-04-seal-guarded-registration.sql). Previous Items release/publications remain intact. Human acceptance and Phase 5 closure are not claimed.
