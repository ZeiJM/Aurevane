# Item refinements production cutover — blocked final retirement gate

The application and reviewed Item content are installed, but the release is **not verified complete**. New admission, equipment/character changes and Master authoring remain held. Existing battle command routes do not match the hold. Do not rebuild, republish or replay the successful transaction.

## Verified source and completed work

PR #1019 merged as `a841b6bf39e4e59e6c0b2373d23f2635db9a359d`, tree `8de31980a118fa4eb1244d7ae205f60ee49aca2c`, equal to tested head `3dc080bd175b02fc168cc372927df0ac5a50bf77`. Required PR and main application checks passed. The external Supabase integration originally reported the preexisting remote/local migration-history mismatch; the latest observed check is skipped. No history repair or integration success is claimed.

Exactly one new Production build, `dpl_6pGx1VaoJydfdtbRBe9M13DkQcGC`, was verified READY and promoted. Canonical home/Manual identify that deployment. Git deployment and automatic domain assignment locks remain. No new migration was required.

Retirement DB clock was 2026-11-06T01:02:38.425949Z; the 1,950-second deadline was 01:35:08.425950Z. At 01:54:18.338008Z the deadline had passed, zero older client transactions existed, and no new sources/publications existed. All20 predecessors matched the tracked audit and no candidate Owner drafts existed.

The exact reviewed transaction registered20 immutable source6 bodies and committed only Emberbrand through normal fresh-CAS Commit, revision8/floor6 producing publication7. All12 table preservation guards and exact readback passed. Existing sources/versions, unrelated publications, drafts, inventory, grants, characters, builds, frozen battles and timing policy were preserved. No real grants or stock consumption were issued.

Independent SQL review found no blocking issues. Disposable validation subsequently passed2 cases at unchanged limits: stale-predecessor rollback left zero new sources/versions; the exact unchanged SQL registered20 sources and ordinary Emberbrand7. Hosted execution returned `guarded-source20-emberbrand7-preservation12`. The [SQL](release-assets/2026-11-05-items-polish-register-and-publish.sql) SHA256 is `26f154763757a6655abe1cc3eec9001da2cca0545ab451d3b9e37783cb8e2b0f`.

Safe hosted postflight passes:20 exact sources, exact Emberbrand7, Wardstone passive-only, Tower Shield no held passive, unchanged global timing policy11, pure synthetic stock capture schema2/policy1/quantity3, stock RLS/settlement trigger, browser seed denial/service allowance, and configured equip requirements failing closed. No signed-in hosted battle, real stock mutation or human acceptance is claimed. An initial deployment error/fatal scan from01:54:18 to01:58:39.529Z found no matching logs.

## Unresolved retirement failure and current hold

The final16-case smoke at01:59:12.850080Z passed14 cases but **failed2**: custom-domain `?dpl=dpl_D79wgdgrFWWjf3kom6sfypujPk6F` and `x-deployment-id: dpl_D79wgdgrFWWjf3kom6sfypujPk6F` returned200 with the **old** deployment source. This violates the gate, which accepts503 or200 only when the source is the new deployment. Normal canonical home/Manual, guest redirects/auth denials, unsupported battle GET405, old unique host503, old cookie503, new pins and www308 passed.

The temporary hold was restored immediately. Two experimental exact old-pin project routes did not change the result and were removed. The original9 retirement rules remain intact, together with only temporary hold `45a07761-caca-49ad-9017-a665fb051019`, under final routing version `b756f9fc-842b-4992-9cb5-eb2f95d082e4`.

Vercel documents `skewProtectionBoundaryAt` as a millisecond cutoff disabling older deployments' Skew Protection. The narrow proposed boundary1793922776186 was independently reviewed, but the API rejected it with404 `Skew Protection not found`. It was **not applied**. A read-only active firewall lookup also returned404 `Seawall Config not found`. No plan upgrade, broad security change, deployment deletion, new build or test weakening was attempted.

Vercel project configuration/support must make old-pin retirement possible before reopening. Automatic retries are paused because this provider blocker cannot be resolved by unchanged polling. Resume from the [durable receipt](release-assets/2026-11-05-items-polish-release-progress.json); do not repeat any completed operation. After a working retirement control is available, prove old pins return503 or the verified new source, remove only the temporary hold, repeat final source/authority/retirement probes, finalize this receipt PR and notify verified live.

Official API reference: https://vercel.com/docs/rest-api/projects/update-an-existing-project
