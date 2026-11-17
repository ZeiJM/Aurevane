# World Map request completion — one combined update

Nick requested implementation of the omissions identified after PR #1040,
developed piece by piece to conserve conversation context, with everything
delivered together as one update. Do not merge or deploy individual pieces.

Base: main `2893076856e20bc64f00e94e132d26dd0d76b26d`, tree
`24308f36a0445c7ab998953a414094c1049e60d4`.
Branch: `agent/world-map-request-completion`.
PR #1040 and its production migrations/cron are already released. Do not replay
them. Keep automatic Vercel Git deployments disabled and older watchers paused.

## Piece 1 — location labels and map-switch affordance

Implemented in source, pending combined release:

- A pressed Labels control immediately beside the existing map-settings gear.
- The same setting applies to local landmark names and globe location names,
  survives local/globe switching, and defaults to visible on page entry.
- Icons, accessible destination names, current-position indication, player
  identities, click targets and server-authoritative movement remain available.
- A circular arrow inside the existing location-title button indicates map
  switching. The title truncates separately so the arrow can remain visible.

Verification map:

- Changed: WorldWorkspace state/controls, WorldMap settings bridge, globe label
  rendering, canvas landmark-label pass and local workspace CSS.
- Four regressions first failed on the unmodified implementation, then passed.
  The renderer regression covers hide/show, retained player identity and map input.
- Focused/adjacent command: `pnpm --filter @aurevane/web exec vitest run src/components/world/world-workspace.test.tsx src/components/world/world-globe.test.tsx src/components/world/map-renderer.test.ts src/components/world/globe-atlas.test.ts src/components/world/world-motion.test.ts` — **341 passed**.
- Native desktop/mobile coverage added to the existing World presentation case:
  control placement, visible arrows, off/on globe names, mode persistence,
  retained markers and unchanged saved position.
- Local Chromium could not launch: the execution environment denied its
  singleton socket (`Operation not permitted`). No native visual pass is claimed.
  This new browser coverage must run on the final combined candidate.
- TypeScript (`pnpm --filter @aurevane/web exec tsc --noEmit`), scoped ESLint
  with zero warnings, scoped Prettier and `git diff --check` pass. Initial
  typecheck encountered two provenance JSON imports excluded by the sparse
  checkout; restoring those unchanged source directories resolved the errors.
  Broader gameplay/browser/release gates remain pending.
- Development excludes database, combat/economy and catalogue-publication suites:
  this piece adds no authoritative rule, server endpoint, schema or content write.
  Full applicable quality and configured checks remain required for the combined
  candidate; a passing piece is not a passing release.

## Piece 2 — shared Travel Points and Uncharted control cleanup

Implemented in source, pending native acceptance and the combined release:

- Both sidebar and globe derive the same ordered, deduplicated map-destination
  list and cycle from the selected destination, including wraparound.
- The original list had only the mainland stop in a real new-character view:
  its survey anchors were not charted public destinations. The cycle now also
  includes the eight already-charted towns, so the feature works on actual
  server projections, not only synthetic fixtures.
- Known public anchors remain eligible; private, absent and unmapped entries
  stay excluded. These are map selection targets, with ordinary server-approved
  confirmed travel. No new ferry route, teleport grant or private access exists.
- All visible Travel Point copy drops the old Ferry dock name. Shared selection
  owns the sidebar caption, removing the independent stale cursor. Town icons
  retain their ordinary selection behavior; adjacent Travel Point icons cycle.
- Removed the redundant Uncharted focus button and its unused styles. The globe
  still names Uncharted Lands when visible and location labels are enabled.
- Regression tests first demonstrated the one-marker bug, retained focus button,
  missing list/cycle behavior and missing real public-town destinations. **353
  tests across nine focused/adjacent files pass**, including the prior renderer
  and map-motion coverage, globe/fallback input and unchanged ferry timing.
- TypeScript, scoped ESLint with zero warnings and formatting pass. Playwright
  successfully discovers the new case across the configured projects; it runs
  on desktop/mobile and explicitly omits the duplicate laptop project. Discovery
  is not execution. Native checks remain pending because of the recorded local
  Chromium startup restriction.
- The new native case cycles through the real public towns, wraps to Mainland,
  continues through the other control, checks unchanged position/route and
  asserts that no World mutation was submitted. The existing art review now
  requires the removed button to be absent while retaining the landmass label.
- No database schema/state, generated terrain, content publication, transport
  authority, migration ledger or release workflow is changed by this piece.

## Checklist

| Request                                                                   | Current status / required evidence                                                                                                                                                           |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Travel Point cycling on the globe and complete display-name cleanup       | Implemented in Piece 2; native acceptance and combined release pending.                                                                                                                      |
| Remove the redundant Uncharted focus/selection control                    | Implemented in Piece 2; native acceptance and combined release pending.                                                                                                                      |
| Remove Uncharted fog of war                                               | Pending execution-path review and implementation; distinguish requested visibility from weather fog, preserve discoveries/history, isolate other private realms and retain server authority. |
| Remove lakes from fire/ice towns                                          | Pending; inspect rendered liquid composition and saved-position/route/teleport compatibility before changing canonical terrain.                                                              |
| Natural territory and town-size variation                                 | Pending; separate territorial boundaries from equal town-district footprints and verify actual rendered variation.                                                                           |
| Crisp older major artwork at gameplay zoom                                | Open visual acceptance; inspect native sources and rendered minimum/ordinary/maximum zoom. Upscaling alone does not establish new detail.                                                    |
| Water/coast blending, tile seams, grounded assets and handset performance | Open representative visual/runtime acceptance. Do not classify uninspected scenes as passing or missing solely from source tests.                                                            |

The recovered latest wording about replacing travel popups/location information
was incomplete. The current travel-confirmation dialog was not established as a
confirmed omission; reconcile original user instructions before changing it.

## Final combined gate

Refresh main and reconcile overlaps, review the complete diff, run `pnpm check`
and configured affected native/workflow gates on the final candidate. Record
each requirement's implementation and actual evidence. Keep one combined PR and
release; no Preview or partial Production deployment, migration replay, account
reset, content republication or invented human/physical-handset acceptance.
