# World page replacement (V37 concept) — release receipt, 2026-10-11

**Status: LIVE for testing. Human gameplay acceptance is pending.**

## What shipped
- `/game/world` content is the scenic map stage (same-origin iframe at `/world-stage/index.html`, vanilla JS/SVG). The React parent keeps every server call, the sync timer and battle redirect; the shared character rail, header and footer are unchanged.
- Server-seeded environment: day/night, hourly weather, Master Panel controls (time offset/freeze, forced weather) via migration `20261011030821_world_environment_controls.sql` (applied to production, immutable audit).
- All characters (online or not) appear at their saved position (default starting town); Attack only for recently seen characters in open territory; Talk is visible but disabled.
- Journal drawer holds every previous sidebar feature: quests, auto-path, local interactions, World Pulse, archive, frontier anchors, roads and crossings, cross-the-map confirmation, plus View 360°.
- Biomes per region (forest, desert, volcanic lava, ice, coast sea, march, highlands, plains), rivers with bridges, waterfalls from river sources, blocked water, ghost avatar behind scenery.

## Release path
- PR #859 merged as `ca4b97fd319b0af41585b274b13aefe4f680aee4` (Owner-authorized merge while the long Responsive browser smoke was still running).
- First deploy `dpl_4DQhCiAbS8Fr5hgLUyCC3XXG7Vhs` ERRORED: a stray absolute self-referencing symlink `public/world-stage/assets/assets` broke the build step. PR #860 removed it.
- Production `dpl_GsAXXuJHjExtACRk3gRHUruk85xU` (`d5dcbc26`) went READY first. The Atlas browser test then found Stop/travel clicks dropped while a tick was in flight and the Journal drawer overlapping the travel bar; PR #861 fixes both.
- **Current production:** `dpl_Cisi5yRoXsfW5A724hxBkc8t1YB7` READY at https://aurevane.vercel.app for `b3ddffd00cc7dbff8265be834138cd73576a8acc`.
- Supabase security advisors show only the existing INFO pattern (new private tables with RLS and no policies, service-only) and the pre-existing leaked-password WARN. Bounded runtime log window: no warning/error/fatal entries.

## Verification
- Local: format, lint, eight-package typecheck, Vitest plus Node checks, production build.
- CI exact head `f18cba85`: Quality gates, Database foundation, Atlas browser, desktop-experience, representative-buildcraft and authority workflows passed. The Atlas browser test passes on the final head (PR #861). The long Responsive browser smoke was still running at release; any failure there will be fixed and redeployed.
- Atlas e2e (`apps/web/e2e/atlas-world.pw.ts`) was rewritten for the frame, Journal and stage intents.

## Final status
- Responsive browser smoke passed on the released commit `b3ddffd0` (and on the PR head). Atlas browser test passes.
- Supabase Preview shows "Remote migration versions not found in local migrations directory". It is long-standing: production records each migration under its apply time (for example `20261011030821` for this release's `20261011030821_world_environment_controls.sql`), so versions never match local filenames, and earlier main commits fail the same way. Not changed here; resolving it means a deliberate migration-history repair or disabling the check in the Supabase integration, both Owner decisions.
- Human gameplay acceptance is pending.

## Open decisions / notes
- Sectors remain the authored 13×9 boards (not an endless procedural world).
- Weather/time come from Master settings when set, otherwise real UTC.
- Static stage files are excluded from Prettier and ESLint (`public/world-stage`).

## Pace, instant start and arrival (branch agent/world-pace-arrival)

- `STEP_MS` 275 → 200 ms (server authority; stage preview `WALK_STEP_MS` and minimum glide speed raised to match). In-flight 275 ms routes at deploy time are discarded by `isCurrentWorldRoute` and simply replanned; no migration is required (the DB rules use each step's recorded duration).
- Stage now previews the shortest path immediately on every click, including mid-walk and while an earlier command is still confirming; the preview hands over at the next committed version (`version` added to the stage state).
- If a walk settles on a tile other than the clicked one, the stage retries that click once.
- Verified: world Vitest (150), DB travel migration tests (19), eslint/tsc/prettier, headless stage simulation (20 random destinations, with and without replans, 300 ms mean latency: 0 short). Human gameplay acceptance pending.

## Square map, right-hand panel and continuous surface (branch agent/world-continuous-surface, stacked on #868)

- Map is a 1:1 square filling the screen height; the location header, Character / Points of interest / Missions tabs and a detail view (POI, player, mission) live in a right-hand panel. The page bar (coordinates, Stop travel, Journal, settings) sits under the panel. Missions are passed from the page to the stage (`objectives`), with an `autopath` message back.
- Continuous surface (P6-W1 first slice): adjacent areas whose road gates align are placed in one shared frame (two rings deep), the camera follows across the seam and crossing a gate re-homes without a reload. Clicks, keys, pathing preview and other players use the shared frame; neighbours connect only through authored gates. The server still owns routes and crossings. Unknown ground stays unrendered (no discovery leakage).
- Verified headless (real sector data): placement stable across a crossing, no reload on crossing, random walk simulations 0 short, vitest 150, tsc/eslint/prettier. Not verified: real browser at production scale, mobile layout, e2e (CI-only). Human acceptance pending.
