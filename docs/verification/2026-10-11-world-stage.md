# World page replacement (V37 concept) — release receipt, 2026-10-11

**Status: LIVE for testing. Human gameplay acceptance is pending.**

## What shipped
- `/game/world` content is the scenic map stage (same-origin iframe at `/world-stage/index.html`, vanilla JS/SVG). The React parent keeps every server call, the sync timer and battle redirect; the shared character rail, header and footer are unchanged.
- Server-seeded environment: day/night, hourly weather, Master Panel controls (time offset/freeze, forced weather) via migration `20261011010000_world_environment_controls.sql` (applied to production, immutable audit).
- All characters (online or not) appear at their saved position (default starting town); Attack only for recently seen characters in open territory; Talk is visible but disabled.
- Journal drawer holds every previous sidebar feature: quests, auto-path, local interactions, World Pulse, archive, frontier anchors, roads and crossings, cross-the-map confirmation, plus View 360°.
- Biomes per region (forest, desert, volcanic lava, ice, coast sea, march, highlands, plains), rivers with bridges, waterfalls from river sources, blocked water, ghost avatar behind scenery.

## Release path
- PR #859 merged as `ca4b97fd319b0af41585b274b13aefe4f680aee4` (Owner-authorized merge while the long Responsive browser smoke was still running).
- First deploy `dpl_4DQhCiAbS8Fr5hgLUyCC3XXG7Vhs` ERRORED: a stray absolute self-referencing symlink `public/world-stage/assets/assets` broke the build step. PR #860 removed it.
- Production `dpl_GsAXXuJHjExtACRk3gRHUruk85xU` READY at https://aurevane.vercel.app for `d5dcbc26b37ab57c80d4e7b1d491d199475b52de`.
- Supabase security advisors show only the existing INFO pattern (new private tables with RLS and no policies, service-only) and the pre-existing leaked-password WARN. Bounded runtime log window: no warning/error/fatal entries.

## Verification
- Local: format, lint, eight-package typecheck, Vitest plus Node checks, production build.
- CI exact head `f18cba85`: Quality gates, Database foundation, Atlas browser, desktop-experience, representative-buildcraft and authority workflows passed. The long Responsive browser smoke and review were still running at release and are tracked below.
- Atlas e2e (`apps/web/e2e/atlas-world.pw.ts`) was rewritten for the frame, Journal and stage intents.

## Open decisions / notes
- Sectors remain the authored 13×9 boards (not an endless procedural world).
- Weather/time come from Master settings when set, otherwise real UTC.
- Static stage files are excluded from Prettier and ESLint (`public/world-stage`).
