# AUREVANE deployment runbook

## Canonical release path

AUREVANE is a pnpm/Turborepo monorepo and the Vercel project Root Directory is `apps/web`.

Use Vercel's Git integration for application deployments. Do not use a minimal file-upload/API bootstrap that downloads and reconstructs the repository during the Vercel install step. That fallback does not preserve Vercel's normal monorepo checkout layout and can place the workspace root/lockfile outside the expected build path.

Automatic Git deployments are intentionally restricted by `apps/web/vercel.json`:

- The current lock disables automatic deployment for every branch (`"**": false`). Inspect the actual configuration before publication; do not assume `preview/*` is enabled.
- Enable only the Owner-authorized release target for its release, then restore the lock after verification.
- Normal implementation work should rely on CI and repository checks rather than Vercel builds.

This keeps Preview deployments deliberate and prevents development commits from exhausting Vercel deployment/build quotas.

## Preview release flow

1. Finish and merge the implementation to `main` only after repository quality gates pass.
2. Create or update one `preview/*` release branch at the exact `main` commit intended for testing.
3. To force a fresh Preview for an otherwise unchanged tree, make one preview-only marker commit that creates or updates `apps/web/.vercel-release-trigger`. Vercel/Turborepo may cancel an empty commit as an unaffected web project, so do not rely on empty commits as release triggers.
4. Wait for the Vercel deployment to reach `READY` and inspect build logs for errors.
5. Smoke-test the deployed URL and check runtime logs for warnings/errors.
6. Verify account services are enabled before treating the Preview as a full gameplay test candidate.
7. Promote only the verified Preview to Production.

When the Owner authorizes a direct Production release and no dedicated Preview account environment is available, use the verified Git revision with the Production environment. Record the source commit and resulting deployment, verify the application and account flows, and restore the deployment lock. Do not copy Production secrets into Preview to work around the environment boundary.

## Staged combat-content publication

The Phase-4 gameplay interaction continuation requires application code to support new authored Skill versions before the database selects them. The main-branch database workflow can apply migrations while application deployments remain locked.

1. Run the repository, database-authority and authenticated browser gates on the final candidate revision.
2. Merge the additive staging migration. Confirm it leaves the current Skill catalog, learned Skills and selected builds on the previously supported versions.
3. Deploy the new application and wait for `READY`. Confirm its source revision and that existing build/account routes remain healthy.
4. Invoke the release-specific service-role activation RPC named in the migration, using its reviewed fixed contract. Record the result and verify the catalog, learned/current build versions and preserved earned Mastery. Never accept arbitrary client-selected content versions.
5. Verify new battles use the current versions and existing frozen battles still resolve their stored versions; complete the live targeting and Atlas checks.
6. Restore the deployment lock and record the application revision, migration, activation and test evidence.

If `activate_phase4_combat_interactions_v2()` returns SQLSTATE `55P03` with `PHASE4_COMBAT_PUBLICATION_BUSY`, a competing parent-row or dependent-table writer prevented safe activation. The failed call leaves publication state unchanged. Let that transaction finish, then retry the same no-argument service-role RPC and record its successful receipt before proceeding. Do not bypass the guards or change release IDs/versions.

Before activation, a failed application deployment leaves the previous catalog usable. After activation, do not roll the application back to a revision that cannot resolve the newly published versions. Prefer a compatible forward repair; any rollback must retain support for already-created frozen battle snapshots. Staging and activation tests belong in the disposable CI database, not hosted Production.

The release-trigger marker is not application runtime state. It exists only on the temporary `preview/*` branch and should contain the source `main` SHA or another concise release identifier so the candidate remains auditable.

## Environment policy

Preview must use a dedicated AUREVANE Supabase test environment before authenticated gameplay testing. Do not copy privileged Production database credentials into Preview merely to make sign-in work.

Production credentials remain Production-only. The application should continue to fail closed when required account configuration is absent.

## Build expectations

The normal Vercel Git build must use the repository checkout and workspace metadata directly:

- Node: 24.x
- Package manager: `pnpm@11.17.0`
- Install: pnpm workspace install from the Git checkout
- Web build: the existing Turborepo/Next.js build for `@aurevane/web`

A release is not considered clean merely because Vercel reports `READY`; the relevant build, runtime, authentication, and gameplay smoke gates must also pass.
