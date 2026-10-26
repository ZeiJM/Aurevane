# October 26 Music library — local verification

Task 6 on the shared `agent/master-panel-refinements-20261026` worktree. Local implementation only; no commit, push, hosted SQL mutation or deployment by the music agent.

## Behavior

- Named reusable songs persist independently of global/page selections in `song_library`, inside the existing configuration singleton and revision compare-and-swap transaction.
- Historical settings without a library derive it from existing assigned songs. The additive migration backfills existing global and page tracks, including retained silent selections, without changing selections or revision.
- Add URL/upload songs for later, save/reload them, choose songs globally or per page, update a song and its references together, and remove unused library entries. Deletion of any still-referenced song is rejected in the UI and server parser. Stored audio objects are retained.
- Existing direct selection editors remain. Their unfinished URL keystrokes stay out of the library; only complete saved replacements join it.
- The public playback endpoint returns assignment fields only; unused library entries remain in the Owner editor response.
- Three desktop panes fit the existing bounded Master shell. Page and song lists keep natural row heights and scroll independently; the detail pane scrolls independently. Mobile/short viewports stack the panes with bounded lists. Useful looping/upload/inheritance/deletion guidance uses shared accessible `MasterHelp`.
- Preview uses the real native audio element. Previewing pauses background playback and pausing resumes it; replacements load and play the replacement URL.

## Migration

CLI-created identity: `supabase/migrations/20261026062136_reusable_site_music_library.sql` from `pnpm exec supabase migration new reusable_site_music_library`.

Adds JSONB array column (maximum 200 songs) and deterministic URL-deduplicated backfill. Existing RLS and service-role-only SELECT/UPDATE grants are unchanged. No new client grants or privileged RPCs.

## Observed RED → GREEN

- Parser initially dropped saved unused songs and accepted removing assigned songs; 2 new tests failed, then passed.
- Actual component interaction initially lacked Add song; new save/reload/assign/delete interaction failed, then passed.
- Public playback endpoint initially exposed the unused song library; focused test failed, then passed after explicit playback response projection.
- Direct assignment editing initially retained invalid intermediate URL keystrokes and blocked save; focused replacement-input regression failed, then passed after collecting completed selections at the save boundary.

## Passing checks

- `pnpm --filter @aurevane/web exec vitest run src/components/master/music src/lib/site-music.test.ts src/server/music src/app/api/master/site-music src/app/api/site-music` — 6 files, 33 tests.
- `pnpm --filter @aurevane/db exec vitest run src/site-music-access.test.ts` — 2 physical PGlite tests. Existing assigned-track migration backfill/deduplication; unassigned song persistence; stale revision no-op; invalid array rejection; preserved service-role-only read/update; browser role read/update denial; delete denial; RLS retained.
- `pnpm --filter @aurevane/web exec eslint src/components/master/music src/lib/site-music.ts src/lib/site-music.test.ts src/server/music src/app/api/master/site-music src/app/api/site-music scripts/panel-music-browser-regression.mjs` — exit 0.
- `git diff --check` for changed music files — clean.
- `node apps/web/scripts/panel-music-browser-regression.mjs` — Chromium 153.0.8010.0, desktop 1366×768, mobile 390×844 and desktop CSS 200% zoom. Each passed 32 page rows and 121 song rows without overlapping/clipped row content; unused save/reload, page reassignment, in-use deletion rejection, unused deletion, native audio preview, replacement playback, background preview handoff, help Escape/focus return and no horizontal overflow. Desktop music root remains bounded. Screenshots and `music-results.json`: `/tmp/panel-music-evidence/`.

The rendered fixture mounts production components and styles. Session storage models reload transport; API authorization, durable storage and SQL are verified separately. It does not certify hosted sessions or actual hosted uploads.

## Integration boundary

A whole-web `pnpm --filter @aurevane/web exec tsc --noEmit` attempt saw only concurrent Staff test fixture typing errors in `staff-focus-interaction.test.tsx:189`, `staff-access-handler.test.ts:117/120` and `staff-access.test.ts:118/119/121`; these were reported to the coordinating agent. No music errors were reported. Final whole-branch typecheck, full `pnpm check`, core browser smoke and cross-system release verification belong to final integration. Heavy World/combat suites were excluded from this focused music development loop because no gameplay authority or shared runtime player behavior changed.

Apply the additive migration before the new store reads `song_library`; source/hosted rollout is not performed here. Human signed-in, hosted upload, physical-device and audible quality acceptance remain open.

## Independent review I3 — legacy write omission

Omitting `songLibrary` on a save previously let the historical parser derive only assigned tracks, silently replacing saved unused songs. New route/store regressions observed that failure before the fix. Writes now require the explicit complete library at both the raw HTTP boundary (before parsing can synthesize it) and the store boundary (before any update). Legacy saves receive INVALID_REQUEST/400 with refresh guidance; the stored unused song remains readable and no update occurs. Historical read parsing retains its assignment-derived fallback. Current Owner UI saves already include the complete library. This adds no migration or authority change.

Final I2/I3/I4 combined focused verification passes 8 files / 76 tests (including music and adjacent Game Content interaction checks); scoped route/store lint, exact-source whole-web typecheck, Prettier and diff checks pass. Native E2E integration remains compiled/discovered rather than executed by this agent.
