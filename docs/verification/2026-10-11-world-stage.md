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

## Layout: square map with right-hand panel (agent/world-layout-panel)

- The World map is a 1:1 square filling the viewport height; the header, Character / POI / Missions tabs and the detail view live in a right-hand panel; a bottom bar holds coordinates and settings.
- Layout only: no pace, pathing or continuous-world changes.
- Headless check: map 900x900, panel 700 wide, tabs switch, mission auto-path message posted, no page errors. Human acceptance pending.
## Pace, instant start and arrival (branch agent/world-pace-arrival)

- `STEP_MS` 275 → 200 ms (server authority; stage preview `WALK_STEP_MS` and minimum glide speed raised to match). In-flight 275 ms routes at deploy time are discarded by `isCurrentWorldRoute` and simply replanned; no migration is required (the DB rules use each step's recorded duration).
- Stage now previews the shortest path immediately on every click, including mid-walk and while an earlier command is still confirming; the preview hands over at the next committed version (`version` added to the stage state).
- If a walk settles on a tile other than the clicked one, the stage retries that click once.
- Verified: world Vitest (150), DB travel migration tests (19), eslint/tsc/prettier, headless stage simulation (20 random destinations, with and without replans, 300 ms mean latency: 0 short). Human gameplay acceptance pending.

## Layout: panel is a quarter of the window (agent/world-panel-quarter)

- The right-hand panel is `max(20rem, 25%)` of the window width; the map fills all remaining width and height (no longer forced square). The page bar under the panel uses the same width. The header is a fixed 76px with the title wrapping to two lines; the Journal opens below it.
- Headless check at 1585x780, 1440x900 and 1000x700: map flush to the left edge, panel 25% wide, e2e selectors visible, no horizontal scroll. Human acceptance pending.
- The workspace has no inner padding, so the coordinates/Journal/settings bar sits flush under the panel as its bottom edge (measured in a parent-shell harness at 1667x857: bar and panel share left/right edges and the bar top equals the panel bottom).
- The first panel tab is "Nearby" (zone badge in the tab); the player card and the "Character" label are removed. Tab ids (`#tab-nb`, `#zone-badge`) are unchanged for the e2e.
- The Safe/PvP zone badge sits beside the area name in the panel header (`#zone-badge` stays in the stage frame). The settings popout opens above the page bar (bottom offset = `--bar-h` + 8px, scrollable) so the bar no longer covers it.
- The Journal button is removed. The Missions tab in the panel shows the former Journal content (Accept/Report back/Training/Local interaction/Cross into uncharted) in an overlay aligned under the tabs and above the bar; the stage reports its active tab to the host via a `tab` message. Mobile (<=760px) layout not human-verified.
- Header polish: the zone badge and the UTC time share one row (weather aligns with the area name on the row above). The first tab is "Nearby Characters". Tabs are a slim 38px flat strip.
- The coordinates/settings bar and the Missions overlay are now positioned inside the same box as the map frame (not the outer workspace), so their edges always match the panel regardless of any page frame or padding. The Missions overlay is opaque with compact type and the same gold/teal borders as the panel. Verified headlessly only; human acceptance pending.
- Performance pass (headless, software rendering, so absolute numbers are pessimistic): the world scene now lives in its own SVG layer that the compositor pans, instead of an SVG group transform that repainted the whole map (about 2,500 nodes) on every step. The tint rectangles moved to their own static layer; tree sway steps a few times a second instead of repainting each frame; plains trees no longer carry a per-tree filter; cloud shadows use 9 cells instead of 15; walking tolerates slow frames (frame cap 100ms, minimum speed 5.6 tiles/s) so the character no longer falls behind the authored 5 tiles/s clock when the machine is busy. Checked headlessly: pixel-identical rendering apart from rain/sway, the character stays at the viewport centre at DPR 1 and 2, click-to-tile mapping unchanged. Measured walk frame time on a 1400x800 viewport went from about 66ms to about 50ms average in this software renderer; the real GPU gain is expected to be larger but is not measured. POI grid rows no longer overlap.
- Tree sway is sparser and varied: about 40% of trees sway, each with its own speed (0.78x to 1.26x) and reach (1.5 to 3.3 degrees), derived from the tree's palette value so it is stable across rebuilds. Checked headlessly (118 of 289 swaying, 9 distinct speeds); human acceptance pending.
- Cloud shadows drift at half speed and move in small steps (about 8 a second, 2-3px each; the shadows are soft-edged) instead of a continuous per-frame drift, to cut repaint work. Not separately measurable in the headless software renderer; human acceptance pending.
