# Item, technique artwork and Range production release

Verified live for Owner testing at https://aurevane-rpg.com on November 6, 2026, 3:02 p.m. Trinidad time. The temporary admission/authoring hold is removed. Refresh an older open page. Human gameplay acceptance remains open.

## Application and verification

PR #1021 merged as `e6b63a9fe5803319a74c9242e0b4b76cc6f4a005`, tree `95c0ea4971336ec4afc6e0ac5d9d1d911ab4112a`, identical to fully tested head `a09c40a41c78e70629d997ad6f67728475136e6b`. All required PR and merged-main application gates pass, including final Browser Smoke, Quality, Database, review and authority. Complete Core7,167/Database646/Web8,935 tests and production build pass. Configured main reuse verified the exact tested tree. The separate Supabase Preview migration-history mismatch was retained, not repaired or represented as passing.

One production build `dpl_DCs9PefFRMAawAX8JbXEWjQVmAZ6` was staged READY, exact source verified and promoted without rebuilding. Canonical home/Manual identify this deployment. Git automatic deployment and domain auto-assignment locks remain.

Equipment slot captions, image-corner stock, Item Type/QP cost and Master editing, compact replacement stat comparisons, four unique editable imbued images, consistent manager Support cards/previews and technique-only names are included. Both editable delayed Range Up/Down tags affect eligible Basic/Discipline/weapon Support Attack/Utility/Recovery reach, preserving All/self-only/consumable/movement/area/minimum-range exclusions and literal historical captures.

## Guarded database and content cutover

The prior reviewed admission hold scope passed7positive/8negative path cases and left existing battle command/event/clock/chat routes outside its pattern. Retirement was verified by actual DB clock18:25:45.965590Z, with mandatory drain deadline18:58:15.965590Z. At18:58:33.457491Z the deadline had passed and zero older client transactions remained. Fresh audit found no target drafts or new sources/migrations.

Two reviewed additive migrations were installed: item technique media `20261106185845` and Range tags `20261106185855`. No old release operation was replayed or migration history broadly repaired.

The [guarded transaction](release-assets/2026-11-06-items-techniques-range-register-and-publish.sql), SHA256 `d3214f7b8583b879559b7d60b55a2a04723fe35e3b6a274dc19e4a93468aac9a`, registered exactly4 reviewed source8 successors and ordinarily committed3 necessary media-only publication9 successors: Emberbrand, Stormcaller Staff and Twinfang Blade. Their current publication bodies and explicit timing fields were retained. Tower Shield uses source8 fallback with no new publication. Catalogue/CAS guards, exact readback and all12 preservation digests passed. All prior sources/publications, other43 Items, drafts, characters/builds, inventory/stacks/grants, frozen battles and timing policy remain preserved.

Independent [SQL review](release-assets/2026-11-06-items-techniques-range-sql-review.md) found no blocking issues. Disposable baseline success and stale-revision rollback passed2/2 at unchanged60s limits; only the disposable in-memory deadline was advanced, with the production SQL's exact deadline intact.

## Reopening and postflight

Hosted readback verifies4 source8 rows,3 current publication9 pointers, Tower source fallback, all4 unique Support artwork IDs,2 Range tags, correct current versus historical Dispel classification, unchanged policy11/global authority, stock RLS and service-only seed authority. No real grants or stock consumption were used.

The temporary hold alone was removed, retaining all9 retirement guards and both custom hosts; final routing version `e66b8ef2-5afd-41f8-ac02-b668a459bcdf`. Twelve canonical probes plus3 header/cookie probes pass: correct new source on home/Manual, guest private API denial, unsupported battle GET405, www308, old unique host/cookie503, and old header/query pins200 only from exact new source. All4 technique assets return200 image/webp. The initial error/fatal scan18:59:00–19:02:25.016Z has no matching logs.

The [durable receipt](release-assets/2026-11-06-items-techniques-range-release-progress.json) records completed operations and exact probe results. Do not deploy or rerun migrations/registration/publications for this documentation-only integration.

These are source/full CI, safe hosted SQL/guest/read-only and asset checks. No signed-in hosted battle, human/device playtest, real grant/consumption, sustained-load acceptance or Phase5 closure is claimed.
