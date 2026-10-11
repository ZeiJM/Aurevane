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

- Superseded by the follow-up below: the world is no longer limited to the authored boards, and weather/time no longer use real UTC.
- Static stage files are excluded from Prettier and ESLint (`public/world-stage`).

## Follow-up: PR #864 — endless wilds, spaced towns, in-game clock, speed, water, idle timeout

**Status: LIVE for testing. Human gameplay acceptance is pending.**

Released through PR #864, merge `e15479d1407f4d6160479465acd655db8c61fafc`; production `dpl_C86qVaXhvXLPD9fTUA9WW3pumNit` READY at https://aurevane.vercel.app. Production serves the new `stage.js` (POI art and walk prediction present); the first 30-minute runtime window shows no warning/error/fatal entries. All PR checks passed except the long Responsive browser smoke, which was still running at the time of writing. Supabase Preview reports skipped on this PR.

- **Walking pace:** `advanceWorldRoute` keeps the authored schedule through network lag (2 s allowance, up to 8 steps per tick); a client absent longer than the allowance advances one step and reschedules from now, so there is still no offline catch-up. The stage previews already-due steps (`predictedTarget`) so walking never waits for a round trip; the server stays authoritative.
- **Smoothness:** removed endless SVG dash/foam/grass animations; the stage no longer rebuilds POIs/route on every state post; the page no longer toggles `busy` for tick requests.
- **Water:** the beaded river came from round-capped dashed strokes (3 px dashes at 35 px width). Streaks are now thin butt-capped strokes. Checked river, lava and sea in the harness.
- **Expanded map:** every authored link now passes through 3 generated trail sectors (`trail:<a>:<b>:<n>`, charted, with rivers/bridges/ponds and 1–2 points of interest). Authored boards and roads are unchanged; the authored Crown sector cluster is untouched.
- **Endless map:** every region edge without an authored road opens onto generated wilds (`wild:<region>:<dir>:<k>:<b>`, 17 doors). Ground is a pure function of the id (same for everyone), the biome continues from the nearest region, rivers run along whole lattice lines, and a sector is revealed whole when entered; discoveries are saved per character. Unvisited generated sectors stay unknown (routes need known ground). Dijkstra now uses a binary heap with a 30 000-node / 600-step bound.
- **Points of interest:** shrine, ruin, camp, grove, spring, hamlet, waystone — composed from the painted prop kit, each reachable by a short carved trail, listed in the stage's POI strip.
- **In-game clock:** one real hour is one in-game day (`WORLD_DAY_REAL_MS`); weather changes in six-hour in-game blocks. Master offset (in-game minutes), freeze and forced weather are unchanged; the header reads "in-game".
- **Idle timeout:** migration `20261011115701_world_open_ground_idle_timeout.sql` (applied to production) hides characters idle for 10 minutes on open (PvP) ground; characters on safe settlement tiles stay on the map. Attackability still needs the 40 s presence window.
- **Footer/Journal:** footer now carries coordinates (left, always visible) and the settings button beside them; the WASD hint, View 360° and walking status text are removed; the Journal drops the location and roads panels.
- **Migration history repair:** 14 local migration files renamed to the versions production recorded, no-op files added for the two remote-only versions (`20260919125734`, `20260923220111`); tests/docs/scripts that name files updated. The package DB tests pass against the renamed history.
- **Tests:** terrain/wild generation (connectivity, determinism, seams, coast), end-to-end server walk through an open edge and onward, environment clock, journey e2e rewritten for the new distances. The browser end-to-end tests could not be run locally; CI is their first run.

## Follow-up: PR #866 — smooth walking, UTC clock, lighter map

**Status: LIVE for testing. Human gameplay acceptance is pending.**

- Merge `e20c8fe6b045ea76896ea96d0cda753fadc1cdec`; production `dpl_6kABK76EiRa7LnqPPUTw6fYnW7pN` READY at https://aurevane.vercel.app. Production serves the new `stage.js`; the first 15-minute runtime window shows no warning/error/fatal entries. Quality gates, Database foundation and verify (Atlas browser) passed; Responsive browser smoke was still running at merge.
- **Rubberbanding:** a walk/auto-path replan first applies the steps already due and keeps the step under way (regression test in `world-service.test.ts`); the stage never retargets backwards on a late reply.
- **Path trail:** removed; a click simply walks the character there.
- **Performance:** chunk/cloud/viewBox work only when changed, ambient animations rest while walking, grass no longer sways. No frame-rate measurement was taken.
- **Clock:** the World clock is real UTC (`WORLD_DAY_REAL_MS` = one day), displayed `HH:MM UTC`; Master offset/freeze/forced weather unchanged. This reverses the one-real-hour-per-day pace from PR #864.
- **Footer:** the settings gear sits after Journal; its popup opens on the right.

## Follow-up: PR #867 — walking pace, instant start, no walk-back, rotating shared tiles

**Status: LIVE for testing. Human gameplay acceptance is pending.**

- Merge `e1bfbbdfd23eb264b75ef3af02d4168747b0f65c`; production `dpl_E6HSPrzq47o8YA2BquQcRKe6f22n` READY at https://aurevane.vercel.app. First 15-minute runtime window: no warning/error/fatal entries. Supabase security advisors: only the existing INFO/WARN patterns. CI on the PR head: Quality gates, Database foundation and verify (Atlas browser test) passed; the long Responsive smoke was still running at merge.
- **Root cause of the walk-back loop and start delay:** `commit_world_state_v1` confirmed one step per tick and rewrote every deadline to at least 1.1 s, while the map plans/previews the authored 275 ms step. The stage ran ahead, was pulled back, and waited.
- **Migration `20261011161830_world_multistep_pacing.sql`** (applied to production on Owner approval): a tick or replan may confirm up to 40 due steps along the saved route; deadlines are bounded by the authored durations (never earlier than the running schedule, never later than one step from now). Moves off the saved route or not yet due remain rejected (`WORLD_INVALID_STEP`, `WORLD_STEP_NOT_DUE`). New PGlite tests cover multi-step confirmation, rejected skips/premature steps and replans.
- **Server/client:** a walk from a standstill makes the first step due at once; replans start from the tile reached; confirmations every 600 ms and exactly on arrival; the stage walks its own shortest path at the authored pace until the reply, never walks backwards along the server route, and hotkeys step from the heading tile; Stop confirms due steps first; portrait/environment lookups cached briefly.
- **Shared tiles:** tiles with several characters show each in turn (flip, count badge); clicks act on the displayed character. The local hero is not part of the rotation.
- Verification of speed was by a headless-browser simulation with injected latency (old rules: first move 2–2.5 s, ~2 tile walk-back; new rules: movement starts within a frame, no walk-back); no live frame-rate measurement.
