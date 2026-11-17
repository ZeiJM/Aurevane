# World Map request completion — one combined update

Nick requested implementation of the omissions identified after PR #1040,
developed piece by piece to conserve conversation context, with everything
delivered together as one update. Do not merge or deploy individual pieces.

Base: main `2893076856e20bc64f00e94e132d26dd0d76b26d`, tree
`24308f36a0445c7ab998953a414094c1049e60d4`.
Branch: `agent/world-map-request-completion`.
PR #1040 and its production migrations/cron are already released. Do not replay
them. Keep automatic Vercel Git deployments disabled and older watchers paused.

## Active worker lease

- Status: active combined verification; source remains stable while native/quality runs finish.
- Expires at: `2026-11-17T14:30:00Z`.
- Hourly continuation: enabled by Nick on November 17; one recurring task,
  **Finish Aurevane map corrections**. Older watchers remain paused.
- A scheduled run before lease expiry inspects only. Release or renew this lease
  at each safe checkpoint; after expiry a fresh worker may resume from the branch.

## Native combined-candidate run — November17

Dispatched Living Atlas browser once on the one task branch, source
`dcec8f98e539246aa767ea99740e68db21905983`, tree
`4f443578d504204a6336983bb7784ce7f28bf7cf`.
Run: <https://github.com/ZeiJM/Aurevane/actions/runs/44088314266> (#812).
Verify job134056564087; all five staging/production flags false,
`deployment_ready_sha` blank, `expected_candidate` set to the source above.
The UI confirms verify running and every staging/Production job skipped.
Independent job-step read confirms checkout, source-tree recording, frozen
installation and hosted Chromium installation succeeded; disposable-stack setup
completed. A subsequent job-step read confirms the real PG17 rollback/success
gate, disposable-service configuration and optimized build all passed.
Authenticated story checks are running. This run has NOT yet passed; native screenshots, traces and
runtime evidence must be inspected after completion. Do not dispatch a duplicate
while it is queued/running, or count this dispatch as native acceptance.

Full local `pnpm check` reached passing formatting/lint, then stopped because
the sparse checkout had omitted the worker workspace dependency links (TS2688,
missing Node types). Restored the unchanged checked-in worker directory and
ran frozen installation across all9 workspace projects; lockfile remains exact.
Resumed typecheck/test/build without repeating unaffected lint; all8 package
typechecks pass and tests are running. The original log is
`/workspace/scratch/fe85b46db5f8/combined-quality-20261117.log`; build output from
the resumed command is `combined-quality-resume-20261117.log`. Package Turbo
test logs retain individual results. Tool session90725 is the resumed command.
Its final outcome must be inspected; no whole-gate pass is yet claimed. No application source, deployment,
Production database, cron, content publication or acceptance criteria changed.
Next worker: inspect this existing run, download bounded art/timing artifacts,
review actual native colosseum/valley/globe/water/seams/grounding, and repair any
real failures before rerunning affected gates. Retain separate physical-handset
and human-playtesting limitations. Main remains2893076856e20bc64f00e94e132d26dd0d76b26d.

### Continuing verification — November17

- Authenticated story/World NPC admission passed in native run44088314266;
  Atlas/multiplayer is still running. Original source remains unchanged.
- The local DB suite passed765/768 cases; the remaining three failures were
  missing checked-in Python scripts, not SQL assertions. Restored `scripts` and
  `content` from the same commit, then all27 tests in those three files passed.
  Together this supplies passing coverage for all768 DB cases on unchanged code.
- The local web suite found four missing-artwork assertions and one battle case
  requiring inspection. Restored all checked-in `apps/web/public` assets; await
  full failure detail and focused reruns. Do not classify the battle failure or
  claim full web acceptance until its cause is resolved. Current log
  `combined-web-tests.log`, tool session56897, in the scoped scratch directory.
- Full `pnpm build` passes both worker and optimized Next16.4.5 web build, logged
  in `combined-build.log`. All8 workspace typechecks and scoped recovered-worker
  format check pass. No acceptance threshold or application source changed.
- Continue existing native run; do not duplicate dispatch. Final configured PR
  workflows and inspected native/physical-handset limits remain outstanding.

## Piece 6 — major-art source review and dense-display detail correction

- Inspected the actual Owner-selected1536×1024 valley master, selected1536×1024
  colosseum v03 master and registered generated valley detail sources. Kept all
  artwork bytes, source selection and geometry unchanged. The superseded local
  canonical-lake/v5 experiment was archived, not restored over Pieces4–5.
- Added `.github/scripts/report-major-art.cjs`; it decodes/hashes originals and
  runtime images, checks both canonical placements and records supported
  desktop/mobile minimum/normal/maximum sizes. Reproduce with
  `node .github/scripts/report-major-art.cjs <receipt.json>`.
  Receipt: `2026-11-17-major-art-source-review.json`.
- At desktop normal zoom the valley macro spans4736 CSS pixels and the colosseum
  4096; their backing widths at the capped1.5 density are4.625× and4× their
  1536-pixel masters. At maximum those scales rise to6.475× and5.6×. Existing
  valley detail frames improve selected regions but do not establish unlimited
  fidelity. Colosseum floor grain does not add detail to its masonry walls.
  This is a demonstrated source-resolution limitation, not native acceptance.
- Found and repaired a separate density bug: detail loading/blending compared
  CSS width with the1536-pixel macro threshold, ignoring the actual backing
  store. Minimum-zoom mobile could therefore enlarge the macro to1865 backing
  pixels while withholding the available detail. Both loading and blending now
  use the actual capped canvas ratio. Low quality retains its1× path; no larger
  backing canvas, new image, frame budget, source transform or network endpoint.
- The three DPR/quality regressions cover1× balanced (no unnecessary detail),
  dense balanced (detail loaded AND painted), and dense Low (lighter path).
  The dense-balanced case failed before the fix. All268 renderer/asset/placement
  tests pass; scoped ESLint, Prettier and TypeScript pass. These are source/mock
  renderer tests, not native browser or physical-handset execution.
- Open next: native gameplay-scale review of the exact selected originals and
  detail registrations; generate/register genuinely new masonry close-detail
  patches if the colosseum wall deficit remains visible. Never upscale the same
  1536 master and label it new detail, shrink reserved gameplay geometry, replace
  the selected elemental figures or claim floor texture fixes all architecture.
  Native coast/flat-mask steps, water/seams/grounding and runtime acceptance also
  remain open. No PR merge, Production operation or migration/cron replay.

## Piece 4 — dry fire and ice town surfaces (source implemented)

The unwanted lakes come from the nine-district Frostmere and Emberreach shallow
basins in `atlas.ts`. Those rows also form the immutable v4 staff-teleport
registration, and shallow cells are already walkable. Replacing their canonical
rows would change the registration hash even though navigation is equivalent.
Instead, one cached `worldSurfaceRows` projection renders those public town
shallows as ordinary regional dry ground. Local scenes, movement receipts,
minimum-zoom scenery and globe water masks all use that same projection.

- Frostmere and Emberreach lake surfaces are removed across all nine districts.
  Emberreach's eight lava-rift cells, its bridge, every building, landmark,
  canonical row, route, step time, safety cell and saved position are retained.
  Other towns, wilderness rivers, private worlds and selected source art are
  unaffected. This is a surface change; no geometry migration or history rewrite.
- The two new lake regressions fail against the old projection. Both now pass,
  including exact cell-by-cell walkability/safety, unchanged saved progress,
  ordinary read/tick position, staff-teleport rows/safety and distant scenery.
  The unchanged world compatibility digest also passes.
- **1,272 tests across101 World/client/server/adjacent files pass**, including
  water rendering, movement, recovery, privacy and staff teleport. TypeScript,
  scoped zero-warning ESLint, Prettier and diff checks pass. The original build
  compiled, completed TypeScript/static generation, then exited with
  `SecurityFatalError` for Next.js16.4.1. See the dependency correction below.
- Added actual desktop/mobile dry-town review cases at ordinary/maximum/minimum
  zoom, with reduced motion, saved state and zero-mutation assertions. All six
  project entries are discovered (two applicable desktop, two mobile, two
  duplicate-laptop skips); they have not run natively. Regional water-bank review
  now uses the still-existing Glasswind oasis in place of the deliberately removed
  Frostmere lake. Negative fire/ice lake coverage is added rather than silently
  dropping those towns from review.
- The compact art bundle now includes dry-town and Piece3 no-fog screenshots,
  avoiding dependence on the oversized full trace archive. This changes artifact
  inclusion only, not workflow assertions, timeouts, retries or timing gates.
- Local browser installation failed with a truncated Chromium ZIP response. The
  source checks and discovery above are not rendered acceptance. Required native
  checks will run on the combined candidate; no partial deployment occurred.

Verification selection: develop against the focused surface/projection/teleport
tests and adjacent World suites; omit combat/economy/catalogue database runs from
this local loop because their source, schema and authority are untouched. The
final combined `pnpm check`, required database specialists and native workflows
remain mandatory.

### Build-discovered framework security correction

The official Next.js advisory
[GHSA-mfr8-8qww-v76h](https://github.com/vercel/next.js/security/advisories/GHSA-mfr8-8qww-v76h)
affects16.3.0–16.4.4 and is patched in16.4.5. It concerns root-parameter cache
disclosure when a `use cache` function is called through `unstable_cache()`.
The application source does not use that combination; this is not evidence of
an observed disclosure. The installed vulnerable version nevertheless stopped
the build. Next.js and eslint-config-next are pinned to16.4.5, with only their
own matching packages/integrities changed in the lockfile. Worker and unrelated
dependency importers are retained. No security-warning bypass or retry is used.
The post-patch build, adjacent World/auth tests and production-dependency audit
are recorded in the final checkpoint. Other development-tool audit findings are
not silently claimed resolved by this targeted framework correction.

### Verified Piece4 safe checkpoint — November17

- Next.js16.4.5 optimized production build **passes**, including TypeScript and
  all83 static pages. No warning bypass, upgrade-nudge retry or configuration
  suppression was used.
- Post-patch World/auth/proxy/Next configuration/teleport tests: **1,336 passed
  across109 files**. The earlier1272 World/adjacent cases are included. Scoped
  ESLint/Prettier and diff checks pass; the generated lockfile retains all nine
  workspace importers and frozen installation succeeds.
- `pnpm audit --prod --json`: zero reported production dependency advisories.
  This does not claim a clean development-tool audit or prove live exploit
  absence. No production dependency was otherwise upgraded.
- Main was refreshed and remains `2893076856e20bc64f00e94e132d26dd0d76b26d`.
  Publication must use the refreshed expected parent on the one task branch.
- Native dry-town/Uncharted review and final combined gates are still pending.
  No PR merge, migration, cron change, content publication or deployment occurred.
  The next work is the town-size/art review below, on this same combined branch.

## Piece 5 — varied built-up settlement extents (source implemented)

The approved delta is visible settlement size and composition, not expanding safe
zones. Investigation first considered a geometry successor, then showed it was
unnecessary: a distinct public presentation field can extend working outskirts
while leaving the existing nine-district safe cores and v4 registration exact.
No migration, new RPC or production database operation is included.

- Nineteen already-charted countryside districts receive `settlementOutskirtsOf`.
  Visible extents now have eight distinct connected shapes, from9 to14 districts:
  Crown14, Verdant12, Emberreach10, Frostmere9, Glasswind11, Hollow Coast13,
  Starfall10 and Umbral12. The largest union is1638 cells, below the colosseum's
  existing1728-cell reserved footprint. Existing territorial geography is intact.
- The existing bounded working-yard composer now uses these outskirts and keeps
  natural dressing, dry-ground legality, landmark clearance, prop separation and
  existing hamlet counts. There are no new solid buildings or collision holes.
  Outskirts retain their ordinary countryside/PvP rules; they are not safe-zone
  grants. Actual rendered appearance remains subject to native review.
- Public atlas metadata, normal scenes, movement/scenery retention and cache
  identity carry the same field. Private realm projections omit it. Globe texture
  blending uses a continuous supplied-public-neighbour field, so WebGL and
  fallback share the same built-up fabric. Water/lava colors and coast alpha are
  unchanged; changed metadata invalidates the cached texture.
- The extent regressions first fail against the old nine-district presentation;
  the texture regression first fails because metadata did not invalidate pixels.
  **1340 tests across110 World/auth/adjacent files pass**, including exact archived
  authority/safety/route digests and staff-teleport row preservation. TypeScript,
  scoped zero-warning ESLint/Prettier and the optimized production build pass.
- Native desktop/mobile review is wired for large Crown outskirts and compact
  Frostmere at normal/maximum/minimum zoom, reduced motion and globe. It retains
  saved state and zero-command assertions. Three project entries are discovered
  (desktop/mobile applicable; duplicate laptop omitted); execution is pending.
- Offline source review uses `.github/scripts/report-town-extents.cjs`; its
  source hashes, exact extent offsets and generated2048×1024 globe texture hash
  are retained in `2026-11-17-town-extents-source-review.json`. The generated
  texture was inspected directly. This is shared texture output, not browser,
  gameplay-scale silhouette, continuous-motion or physical-handset acceptance.
  The inherited land/coast mask still shows conspicuous sector steps and the
  narrow longitude corridor in this flat texture. Inspect the native globe
  before deciding its corrective rendering boundary; this observation is not
  silently accepted as satisfying the natural-coast request.
- Main refreshed unchanged at `2893076856e20bc64f00e94e132d26dd0d76b26d`.
  One combined release remains pending; no merge, deployment, content publication
  or PR1040 migration/cron replay occurred.

Next: native-resolution source and gameplay-zoom review of older major artwork,
the actual globe/coast presentation, representative water/seams/grounding and
runtime evidence. Prepare the combined PR and full `pnpm check`/configured native
gates once that source review identifies and repairs demonstrated defects. Do
not mark naturalness or major-art quality accepted from the source counts alone.

### Original measurement before Piece5

Fresh source measurement at `acd7172` (unchanged by Piece4) separates the two
issues: territories already contain199–326 sectors, while every town still has
exactly nine districts. Equal administrative footprints should not be confused
with differing road/building arrangements. The next worker should inspect real
rendered extents and choose authored, non-uniform settlement extents while
preserving saved origins, public approaches and immutable teleport registration.
Do not mark visual naturalness accepted from the following counts alone.

| Region             | Territory sectors | Town districts | Paved cells | Building area (cells, excluding Crown walls) |
| ------------------ | ----------------: | -------------: | ----------: | -------------------------------------------: |
| Aureth Crown       |               199 |              9 |         296 |                                           60 |
| Verdant Expanse    |               207 |              9 |         232 |                                           74 |
| Emberreach         |               214 |              9 |         262 |                                           72 |
| Frostmere          |               222 |              9 |         261 |                                           64 |
| Glasswind Desert   |               303 |              9 |         258 |                                           66 |
| Hollow Coast       |               216 |              9 |         200 |                                           70 |
| Starfall Highlands |               238 |              9 |         155 |                                           70 |
| Umbral March       |               326 |              9 |         180 |                                           66 |

## Piece 3 — Uncharted terrain without exploration fog (source implemented)

Implementation boundary: expose a compact, bounded rendering buffer for the
current entered Uncharted landscape, including legacy and selected Void worlds.
The buffer contains terrain/style/scene offsets only, without private location
names, encounters, objectives, exits or peer identities. It is separate from the
navigation/presence scene and saved discoveries. The client expands this buffer
for painting; it must never feed optimistic navigation, rewards or presence.
Remove the exploration-fringe fog pass while preserving weather fog, warped
terrain detail and already-authorized scenery. Mainland/other realms cannot
receive or render the private buffer. Frame the buffer for the supported viewport
at minimum zoom, with a bounded halo for movement; do not scan a whole world.

Keep current server movement/discovery rules and stored exploration history.
Before closing this piece, prove canonical terrain painting, viewport coverage,
no hidden-name/foreign-realm leakage, unchanged navigation and saved progress,
cache/reference stability, reduced motion and weather behavior. Native acceptance
and the full combined release gate remain pending until actually executed.

Piece3 implementation and evidence (November17):

- Added `unchartedTerrain`, a compact geometry/style buffer for the entered
  legacy/current Void world. Viewport culling runs before terrain generation;
  the payload and expansion are bounded, with no whole-world construction.
- Navigation/presence scenes, surveyed landmark names, exits and stored progress
  are unchanged. The render buffer cannot submit private walk intents and is
  withdrawn on realm/mainland transitions, including retained movement scenes.
- Removed the exploration-fringe fog painter and its obsolete fog-paint tests.
  Kept the terrain-edge index and grounded scree in `map-warped-ground`.
  The new regression rejects the old fog gradients; existing weather fog tests
  remain and pass. This does not remove atmospheric weather fog.
- **1,252 tests across98 World/client/server files pass**, including all eight
  Void worlds, legacy phase geometry, viewport corners, renderer input,
  private identity isolation and progress/reference preservation. The initial
  broad run found14 missing-source-art failures from the sparse checkout and
  one conflicting three-tree fixture. Restoring unchanged checked-in source
  artwork and isolating that authored fixture resolved these without relaxing
  its tree counts or any quality threshold.
- TypeScript, scoped zero-warning ESLint, formatting and diff checks pass.
  Playwright discovers the added native case (desktop/mobile applicable,
  duplicate laptop omitted). Native execution remains pending because the local
  Chromium startup socket is denied; discovery is not native acceptance.
- The native case seeds only a disposable character's25 surveyed cells, then
  checks full117-cell landscape, minimum zoom/reduced motion, absence of
  exploration fog, unchanged progress/position and zero World mutation commands.
- A local five-repeat projection profile across all eight entered Void worlds
  measured78–82 buffered sectors,7,844–13,255 extra JSON bytes, cold projection
  15.70–64.81ms and warm medians3.92–8.97ms. This measures local projection only,
  not network latency, frame timing or physical-device acceptance.
- No migration, collision topology, account state, reward, content publication,
  privileged RPC or production deployment changed. The active map specification
  now distinguishes entered-world visual geometry from private identities.

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

| Request                                                                   | Current status / required evidence                                                                                                        |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Travel Point cycling on the globe and complete display-name cleanup       | Implemented in Piece 2; native acceptance and combined release pending.                                                                   |
| Remove the redundant Uncharted focus/selection control                    | Implemented in Piece 2; native acceptance and combined release pending.                                                                   |
| Remove Uncharted fog of war                                               | Implemented visually in Piece 3; navigation/discovery rules retained. Native acceptance and combined release pending.                     |
| Remove lakes from fire/ice towns                                          | Implemented in Piece4 as shared dry surfaces with unchanged saved/teleport geometry; native acceptance and combined release pending.      |
| Natural territory and town-size variation                                 | Piece5 adds distinct9–14-district built-up extents with unchanged safe cores/geography; native naturalness/coast review remains pending.  |
| Crisp older major artwork at gameplay zoom                                | Open visual acceptance; inspect native sources and rendered minimum/ordinary/maximum zoom. Upscaling alone does not establish new detail. |
| Water/coast blending, tile seams, grounded assets and handset performance | Open representative visual/runtime acceptance. Do not classify uninspected scenes as passing or missing solely from source tests.         |

The recovered latest wording about replacing travel popups/location information
was incomplete. The current travel-confirmation dialog was not established as a
confirmed omission; reconcile original user instructions before changing it.

## Final combined gate

Refresh main and reconcile overlaps, review the complete diff, run `pnpm check`
and configured affected native/workflow gates on the final candidate. Record
each requirement's implementation and actual evidence. Keep one combined PR and
release; no Preview or partial Production deployment, migration replay, account
reset, content republication or invented human/physical-handset acceptance.
