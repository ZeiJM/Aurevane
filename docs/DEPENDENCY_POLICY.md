# AUREVANE — Dependency Policy

## Purpose

Dependencies are selected deliberately. AUREVANE does not inherit package versions from the discarded prototype and does not upgrade major versions automatically.

## Runtime baseline

- Node.js: 24.x LTS
- Package manager: pnpm 11.17.0
- Monorepo task runner: Turborepo 2.10.7
- Web framework: Next.js 16.3.6
- UI runtime: React / React DOM 19.2.8
- TypeScript: 6.0.3
- ESLint: 9.39.5 with `eslint-config-next` 16.3.6
- Shared TypeScript lint configuration: `typescript-eslint` 8.65.0
- Prettier: 3.9.6
- Unit tests: Vitest 4.1.10
- Browser smoke tests: Playwright 1.62.0
- Runtime validation: Zod 4.4.3
- Supabase JavaScript client: 2.112.3
- Supabase SSR helpers: 0.12.4
- Supabase CLI: 2.114.0

TypeScript 6 is intentionally selected instead of the newly released TypeScript 7 major during the foundation ticket. Major toolchain upgrades require deliberate review and a passing full quality gate.

Supabase package and CLI versions are pinned because authentication cookie behavior, API key guidance, local service images, migration tooling, and generated output can change over time. Infrastructure upgrades require deliberate verification rather than automatic major-version drift.

Playwright is pinned as a development-only browser verification dependency so desktop/mobile shell behavior, keyboard reachability, media fallback, and gesture-gated audio persistence can be exercised in real Chromium. It is not shipped in the player browser bundle.

## Rules

1. Direct dependencies use explicit versions in committed package manifests.
2. Security patches and compatible patch/minor updates are reviewed regularly.
3. Major upgrades receive their own ticket when they can affect build/runtime behavior.
4. No dependency is added solely for convenience if a platform or language primitive is sufficient.
5. Browser-side dependencies are scrutinized for bundle cost.
6. Server-only libraries must not leak into browser bundles.
7. Production secrets are never stored in package scripts, source files, or committed environment files.
8. The committed lockfile is authoritative for reproducible installs; CI uses frozen-lockfile installs.
9. Supabase publishable and secret credentials must remain in their intended browser/server trust boundaries.

## Verification

Every dependency change must keep formatting, linting, type checking, tests, and production build passing. Infrastructure dependency changes must also keep the local Supabase configuration and migrations reproducible.

## 30 September 2026 security patch

The UI/combat candidate's production dependency audit reported GHSA-vcvr-r3jv-pc5j in pinned Next.js 16.3.3. The official Next.js advisory identifies 16.3.6 as patched. Next.js and its matching ESLint configuration are pinned to 16.3.6; the committed lockfile is regenerated. This is a compatible patch under the urgent-security-fix rule in `TECHNOLOGY_POLICY.md`, not a framework migration. No `next/og` ImageResponse use was found in application/package source, but the production dependency gate remains enforced. Production deployment is separate and is not authorized by this candidate.

Source: https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j
