# Item refinements production release

Verified live for Owner testing at https://aurevane-rpg.com on November 6, 2026 (04:12 Trinidad time). New battles, character/World operations, equipment and Master authoring are reopened. Refresh an older open page. Human gameplay acceptance remains open.

## Application and source

PR #1019 merged as `a841b6bf39e4e59e6c0b2373d23f2635db9a359d`, tree `8de31980a118fa4eb1244d7ae205f60ee49aca2c`, equal to tested head `3dc080bd175b02fc168cc372927df0ac5a50bf77`. Required PR/main application checks pass, including Quality, Database, Browser and Review. The earlier external Supabase migration-history mismatch was not repaired or represented as passing; its latest observed check is skipped.

One production build `dpl_6pGx1VaoJydfdtbRBe9M13DkQcGC` was built, verified READY and promoted. No second build, Preview or later promotion was needed. Canonical home and Manual identify this deployment. Git automatic deployment and custom-domain auto-assignment locks remain.

Equipment fits all8 positions with shared artwork size and avatar gutters. Popup facts read Tier/QP/Maximum stack, then Class/Position/Type; Uses per battle is seventh. Weapons have Manual attacks and optional imbued techniques without held passives; armor/gloves are passive-only. Current reports use global tag timing, readable stats and equipment-only contribution hover lists.

## Guarded content installation

Retirement DB clock was2026-11-06T01:02:38.425949Z; the1950-second drain ended01:35:08.425950Z. At01:54:18.338008Z the deadline had passed and zero older client transactions existed. All20 current predecessors matched the reviewed audit; target Owner drafts were absent.

The exact independently reviewed transaction registered20 immutable source6 bodies and committed only Emberbrand through ordinary fresh-CAS Commit, revision8/floor6 producing publication7. All12 table preservation guards and exact readback passed. Existing source versions, historical publications, unrelated records/publications, all drafts, inventory, grants, characters, builds, frozen battles and timing policy were preserved. No new migration, real grant or stock consumption was issued.

The [guarded SQL](release-assets/2026-11-05-items-polish-register-and-publish.sql) SHA256 is `26f154763757a6655abe1cc3eec9001da2cca0545ab451d3b9e37783cb8e2b0f`. Disposable validation passed2 cases at unchanged limits: a stale predecessor rolled back without new sources/versions, and the unchanged SQL registered20 sources and ordinary Emberbrand7 successfully. Hosted execution returned `guarded-source20-emberbrand7-preservation12`.

Safe hosted postflight passes20 exact sources, exact Emberbrand7, Wardstone passive-only, Tower Shield without held passive, unchanged global timing policy11, pure synthetic stock capture schema2/policy1/quantity3, stock RLS/settlement trigger, browser seed denial/service allowance and configured equip requirements failing closed.

## Retirement diagnosis and final reopening

The initial16-case smoke passed14 and failed2: custom-domain old query/header pins returned200 with the retired D79 source. The temporary hold was restored. Two ineffective experimental routes were removed. A reviewed Skew Protection cutoff was rejected404 `Skew Protection not found`; a read-only firewall lookup returned404 `Seawall Config not found`. No plan upgrade, deployment deletion, broad security change or test weakening occurred.

On the resumed release, fresh primary and independent probes found both old pins returning the exact new deployment. No further configuration change was needed. This is observed recovery; no unsupported claim about the provider's internal cause is made. Only the temporary hold was removed, preserving the original9 retirement rules and both custom hosts. Final routing version: `683ea355-d1a5-481a-ab58-ca0dad760c17`.

All16 final probes pass at2026-11-06T08:12:02.656222Z. Canonical home/Manual and new pins identify the new deployment; guest pages redirect and private APIs deny access; unsupported battle GET is405; old unique host/cookie are503; old query/header pins return200 only from the exact new deployment; www redirects308. The error/fatal scan08:11:00–08:12:11.086Z has no matching logs.

The [durable receipt](release-assets/2026-11-05-items-polish-release-progress.json) contains exact probe results and completed-operation flags. Do not rerun registration/publication or deploy this documentation-only receipt. Automatic release checks are disabled after verified completion.

These are source/CI, safe guest/read-only and pure-capture checks. No signed-in hosted battle, physical-device playtest, sustained-load acceptance, real test grant/consumption or Phase5 closure is claimed.
