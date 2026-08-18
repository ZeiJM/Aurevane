# AUREVANE deployment runbook

## Canonical release path

AUREVANE is a pnpm/Turborepo monorepo and the Vercel project Root Directory is `apps/web`.

Use Vercel's Git integration for application deployments. Do not use a minimal file-upload/API bootstrap that downloads and reconstructs the repository during the Vercel install step. That fallback does not preserve Vercel's normal monorepo checkout layout and can place the workspace root/lockfile outside the expected build path.

Automatic Git deployments are intentionally restricted by `apps/web/vercel.json`:

- `preview/*` branches may deploy automatically to Preview.
- `main`, `agent/*`, and all other branches do not deploy automatically.
- Normal implementation work should rely on CI and repository checks rather than Vercel builds.

This keeps Preview deployments deliberate and prevents development commits from exhausting Vercel deployment/build quotas.

## Preview release flow

1. Finish and merge the implementation to `main` only after repository quality gates pass.
2. Create or update one `preview/*` release branch at the exact `main` commit intended for testing.
3. If the branch already points at that commit and a fresh Preview is required, use an empty commit with the same tree rather than adding a runtime source file solely to trigger Vercel.
4. Wait for the Vercel deployment to reach `READY` and inspect build logs for errors.
5. Smoke-test the deployed URL and check runtime logs for warnings/errors.
6. Verify account services are enabled before treating the Preview as a full gameplay test candidate.
7. Promote only the verified Preview to Production.

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
