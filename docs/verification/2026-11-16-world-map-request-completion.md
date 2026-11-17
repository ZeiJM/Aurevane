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

- Status: Nick explicitly transferred all work to this November17 interactive
  conversation. This worker owns continuation from source `128e27d33d835513133c413b0af23cb11451e1f9`.
- Expires at: `2026-11-17T23:00:00Z`; renew at the next safe checkpoint.
- Nick requested cancellation of the other continuation. Recurring task
  `Automation_661d7a3712ec8191939d0104f5c5a773` is confirmed disabled.
  Older watchers remain paused; do not resume them or duplicate this worker.

## Continuous interactive work — November17

### Recovered candidate and Timing64 input correction

Continuation recovered frozen source `9906e0dd396a8fbd8fb82212fd7af8b2cbbadd0d`,
tree `c0083f8e8a818f129f1092335a85ad26cfa81354`. Its CI/database foundation,
UI layout and complete local `pnpm check` pass: 17,824 Vitest tests plus seven
Node tests, formatting, lint, all package types and production builds. This is
evidence for that exact source, not a pass for later corrections.

Timing64/run44170722223 passes all three mobile crowd cases and59/60 desktop
executions. Rapid-click repeat11 fails its first subsequent arrow tap at1443;
the exact requested rapid-click destination had already arrived successfully.
Artifact14368943195 is hash verified
`2a58cb13acf2e10893b594668f1d4e0b6dae37e197433164a0be3513dd727db9`.
Its trace records owned position X10 while visual catch-up trails that tile;
keydown sends X12 and release sends X10, cancelling the new step. This is an
input-origin defect, not evidence that the original peer-interpolation failure
recurred or that the renderer passes all performance requirements.

The existing regression covered the late550ms visual phase only. Its added450ms
phase fails on the frozen source (lookahead X10 instead of expected X11), then
passes when continuing input uses the farther approved point along its direction.
Visual interpolation, legal terrain/exits, cadence, command queue, server
validation, native assertions, deadlines, zero retries and all63 timing executions
remain unchanged. Renderer/motion/controller coverage passes362 cases. The
correction still requires final full quality and fresh exact-source native gates.
The obsolete candidate must not be merged or deployed; hourly tasks stay paused.

Nick explicitly stopped hourly continuation. Automation_9dd57abfa004819195b30acab8a54150
is confirmed disabled, as is the older Automation_661d7a3712ec8191939d0104f5c5a773.
Continue in this conversation through remaining scope and configured quality gates;
do not recreate/resume scheduled work. This supersedes older scheduled-continuation
wording. Same interactive worker retains branch ownership.

Current93fe885: Living Atlas816 PASSED real PG17, story and full configured Atlas
cases; CI, UI layout and Browser Smoke also pass on that older source. Timing63 passed
three mobile crowd executions and59/60 desktop cases; repeat4 peer0 recorded
7 positive deltas against unchanged >8. Its retained native trace shows expensive
canvas resource production with low JavaScript paint cost. Compact timing artifact
14359852488 SHA256670b42f18d30943a6c09e843caafcac0ccc1f2cc1fce68b40f7690091c723e70
and Atlas816 evidence/art bundles were hash verified. Release remains held.

Development verification map: reuse immutable cloud silhouettes and a padded,
translated consecutive dry-terrain composite while camera motion stays within
its128px halo. Preserve all liquid/coast ordering, the original minimum-phone
idle path, source geometry, shadows, foliage and animation cadence. The added
composite is capped4M pixels; existing8M sector and8M projection budgets stay.
Regressions fail against93fe885 for dry-composite reuse and Old Waystone marker,
then pass on the correction. Ground-art reload invalidates the composite.

The initial native Image shim could capture a source before its asynchronous
decode: those earlier whole-scene timings/pixel comparisons are rejected.
The corrected native Skia shim uses synchronous raw pixels until decode settles.
Three alternating, isolated movement comparisons measure median whole-stage
reductions15.8–17.9% (median17.7%); terrain drops roughly19–20ms to10ms.
The moving comparison has mean0.252/channel difference, maximum19 and86 channels
over8 in the whole904×754 frame, reflecting fractional bitmap filtering.
These are controlled native Skia results with stage readbacks, not Chromium,
GPU/physical-handset, network latency or frame-cadence acceptance. The clean
reproducer and exact measured-source hashes are retained in
`2026-11-17-map-lag-and-colosseum-review.json` and
`.github/scripts/probe-world-dry-translation.cjs`. A lighting-composite experiment
lacked reliable whole-scene benefit and was removed, not published.

Three registered native1536×1024 masonry crops now cover the colosseum rear and
both sides. Original selected master/runtime, floor ellipse, collision, saved
positions and actor-occlusion authority remain unchanged. Visible patches load
only above1536 backing pixels and use both complementary floor/wall clips.
Generated sources, fitted matrices and deterministic packer/manifests are retained.
Actual source normal/maximum/minimum and both lateral previews inspected; native
center and new independent lateral desktop/mobile120s cases remain mandatory.
Asset tests retain their existing hash/byte/alpha/matte thresholds. First source
asset validation failed saturated low-alpha matte, which the existing alpha≤32
normalization fixes. The manifest formatter was also corrected after the first
full check stopped at formatting; no later phase of that failed run is claimed.

The minimum source review also exposed Old Waystone artwork beneath the grand
rear wall. Keep a small gold map marker at each already-supplied occluded location,
even with labels off; no location is moved and no hidden identity is introduced.
A focused regression proves the exact Old Waystone coordinate and no ordinary
unobscured marker. The marker is UI presentation only; normal ground travel and
physical assets retain their authority. Final full local quality is required on the frozen combined candidate. Native timing still requires all63 executions unchanged.

Actual816 east/west globe captures expose a circular gold outline after native
keyboard rotation: it is the sphere group's50% border-radius focus outline,
not geography or a measuring overlay. Give the control a small rectangular focus
boundary while preserving its visible2px keyboard focus. Existing native globe
rotation case now checks focus visibility and shape on WebGL/software and both
viewports. Globe pixels, mask, public geometry and controls are unaffected.

Focused renderer, ambient, static-raster, spherical input and globe coverage,
scoped types/lint/format and fullpnpmcheck are required after this correction.
No DB/combat/content tests are needed during this rendering-only development
loop; configured final CI, Smoke/Edge, timing and Atlas remain mandatory.

## Native814 completion and interactive takeover — November17

- Fresh GitHub head is `128e27d33d835513133c413b0af23cb11451e1f9`, tree
  `4004c9e284e8a20ca9e676be193030edd50aee91`; main remains `2893076856e20bc64f00e94e132d26dd0d76b26d`.
- Native814 on older source `2c8cd8e0741988c9534433189626dbf1436c0061`
  completed FAILED: 109 Atlas cases pass, 129 configured skips, two detail-view
  failures (desktop/mobile `selfGhostPaints` expected0, observed1). Story15 pass,
  seven configured skips; real PG17 release transaction gate passes.
- Exact job134206735390 logs inspected. Compact artifact14353791270 downloaded
  and SHA256 verified `72c6fbe39c2088f35ce88d311d53bbf1b3b395e581a8d6cb6038cadd1b606fef`.
  Diagnose the identity observation/render path before a new native run. This
  older run excludes latest coast/border/marker work and is not current acceptance.
- No merge, deployment, migration, content publication or cron mutation occurred.

## Native815 startup diagnosis — November17

- Corrected source `b21fa9f9c368a043e17cc03d1f37a0c92f80f5dd`, tree
  `15aeca03fb13eab3f70f3eb186cc7de1343f618c`, is draft PR1043.
  Four affected workflows started automatically: Atlas44142508679,
  Browser Smoke44142508956, timing44142508698, CI44142508835.
- Atlas44142508679/job134248815715 fails BEFORE browser/PG cases: mail tests5
  pass, then Docker reports `failed to bind host port 0.0.0.0:54322/tcp:
  address already in use`. The step name is not evidence of a mail-test failure.
  No unchanged retry or passed acceptance is claimed.
- Reuse the existing disposable API/database/shadow port configurator in Atlas
  and export its selected API to the authenticated build. The real local PG17
  transaction verifier now requires config, loopback URI and the inspected
  running Aurevane container's actual5432 binding to agree. Missing/mismatched
  bindings, remote hosts, different containers and non-PG17 targets still reject.
  Production apply code, protected modes, migrations, rollback/locking/postflight
  SQL, individual deadlines/retries and all browser cases are unchanged.
- Failing-before workflow/selected-PG-binding regressions now pass:8 port tests,
  12 release-safety tests,5 mail tests and56 verification-runner tests. Fresh
  hosted execution must still prove the real PG17 and browser acceptance.
- Local full `pnpm check` is running separately; do not report its result early.
  The generated full-frame colosseum detail experiment returned1536x1024 again,
  so it does not resolve the backing-resolution deficit. It is NOT integrated;
  original selected runtime/master bytes remain intact. Continue exact native
  wall review rather than treating a generated thumbnail as final fidelity.

## Native814 detail-view diagnosis and repair — November17

- The two failures are the same obsolete fixture expectation, not evidence of
  failed server movement or a newly broken player renderer. The legal detail
  viewpoint is `atlas:44:35` (0,6), deliberately behind the colosseum rear wall.
  The open arena-floor viewpoint remains clear. A new regression uses both exact
  native fixture positions through the real renderer and reproduces the wall's
  grayscale identity before correction (`rear wall: expected true to be false`).
- Mark the rear-wall detail expectation explicitly `occluded`. Native normal AND
  maximum detail checks now require a visible player and positive ghost paints;
  the existing floor checks still require zero ghost paints. Existing opacity,
  backing size, legal coordinates, actual decoded artwork and saved-position
  checks remain. No application/authority/art/migration code, case count, timeout,
  retry, color/frame threshold or skip changed.
- 252 renderer/fixture tests pass, including the failing-before exact-viewpoint
  regression and existing separate floor/wall composition guards. A missing
  `animate` option in the new test was caught by TypeScript and corrected;
  sparse-checkout provenance omissions are recovery issues, not product patches.
- Artifact14353801342 downloaded and SHA256 verified
  `0dfeaa4fa0cdec3633a87431a33e7502736ca74034534c8ff2c533d60c166791`.
  Directly inspected actual814 desktop valley normal/maximum and colosseum
  floor normal/minimum captures. The failed wall case had not reached its saved
  colosseum pair; do not claim that absent native view was reviewed. Offline
  exact-source rear-wall rendering confirms the legal viewpoint/ghost, but is
  not browser acceptance. Existing wall/detail fidelity limitation remains open.
- Restart configured checks on the corrected published source. Preserve one
  combined draft PR and release hold until the full final gate and remaining
  visual requirements pass. No old PR1040 migrations/cron/release replay.

## Global settlement-marker correction — November17

- Actual #812 desktop full-page globe uses the same20px castle for every town;
  current source confirms neither regional icon identity nor varied icon scale.
  Replaced that repeated glyph with8 distinct regional silhouettes: alpine
  Frostmere houses, Crown fortress, coastal beacon, desert dome and the other
  authored public settlement identities. Icon sizes24–34px now follow the same
  public9–14-district visible extents, with bounded scale and unchanged anchors.
- Larger town badges reserve a real gap to adjacent cycling Travel Points.
  Labels clear the variable badge height; current-position caption sits below
  the largest marker. Exact town/pin/Travel Point geography, labels toggle,
  selection-only behavior, confirmation authority and private omission remain.
- New existing-component regression fails on the prior fixed20px source and
  passes with all8 regional paths,6 extent-based sizes, exact town anchors,
  nonoverlapping Travel Point offsets and unchanged position/route/selection.
  **44 tests/7 globe/workspace/ferry/material/veil files pass**; scoped zero-warning
  lint, types, format and801-entry native discovery pass. Discovery is not execution.
- Inspected an actual-size SVG source contact sheet rendered from these exact
  component paths and public extent counts. Regional silhouettes and scale are
  legible there. This is source review only, not full-page/browser acceptance.
  Existing native presentation case now checks real symbol/size variation and
  Travel Point gaps. Active814 predates these changes; native full desktop/mobile
  layout, glyph/pin overlap, rotation and visual acceptance remain OPEN.
- Scope is global presentation; no public/private geometry, server/RPC/migration,
  selected master artwork, account data, progress/history or deployment changes.
  All corrections remain one combined update. Continue material seams/art and
  the existing native gate, then full final-candidate/configured verification.

## Continuing source diagnosis — November17 raster joins and art registration

- Native814 remains active on2c8cd8e (not the newer coast source5def45b).
  PG17 rollback/locking/success, optimized build and authenticated story steps
  pass; Atlas/multiplayer remains running. Do not duplicate/cancel the run.
- Independently opened #813 job134138931990's actual GitHub annotation table:
  **`The job has exceeded the maximum execution time of 1h0m0s`**.
  This is now explicit cancellation evidence, superseding the earlier timing-only
  inference. Its two native test failures are retained. The90-minute envelope
  lets the full unchanged per-test gates finish; it does not excuse those failures.
- Reproduced the inspected Frostmere dark sector joins in the actual source
  renderer at the native dry-town former-lake position. Disabling projected-cache
  reuse reduced but did not remove the lines; a boundary-coverage ablation
  removed the dark join. Current implementation copies only the outermost source
  texels into the filtered half-device-pixel fringe, then paints the original
  interior at its exact unchanged coordinates. Cached projection, direct ground
  and stationary-mobile paths share this coverage; no texture/grid scaling.
  All pixel/cache budgets stay fixed; cached projection is still built only once.
  Native performance and seam acceptance remain OPEN pending the affected gate.
  Actual normal/maximum/minimum source outputs inspected; faint material/tile
  joins remain open. Receipt:`2026-11-17-ground-border-source-review.json`.
  Existing-cache API regression fails on the prior source, then all5 projection
  cases pass. Across the focused/adjacent runs438 tests/8 renderer/projection/
  water/coast/surface/motion files pass; scoped zero-warning lint, types, format
  and diff pass. Final native frame/cache budgets remain mandatory.
- Added the exact saved former-lake dry-town positions to the existing offline
  source renderer (`frostmere-dry-town`, `emberreach-dry-town`). No live SQL, API,
  dependencies or runtime image bytes changed. Compare actual normal/min/max
  source output; these are not browser or handset acceptance.
- Generated colosseum rear-wall detail improved isolated maximum-zoom masonry,
  but real minimum/normal source renders exposed rectangular contrast and
  shifted architectural registration. Rejected context overlays; a frequency-
  separation prototype preserved structure but still exposed unequal contrast.
  No candidate or enlarged master is in runtime. Upsampled preview backgrounds
  are diagnostic context only and NEVER claimed as new fidelity. Selected
  colosseum and elemental master bytes, geometry, IDs and saved state are intact.
  Further artwork work is required rather than closing the fidelity row.

## Native814 and continuing coastline source correction — November17 16:52UTC

- Dispatched exactly one fresh Living Atlas run on source
  `2c8cd8e0741988c9534433189626dbf1436c0061`, tree
  `a8f03c212f11fbca4b35d00382ad2829ad98fd7d`:
  <https://github.com/ZeiJM/Aurevane/actions/runs/44130723106> (#814),
  verify job134206735390. UI independently confirms that SHA, verify running,
  staging/production jobs skipped. All5 protected flags false, deployment SHA
  blank, expected candidate exactly the source above. No duplicate while active.
  This run includes water-slab repair, current-position/detail cases and native
  fixture/frame observation corrections. It does NOT include later coastline
  source work or newly generated artwork. Dispatch is never passing evidence.
- Broad-coast regression proves previous contour variation only8 texels, less
  than one16-texel public district. Added a stricter independent broad-shore case
  requiring >16 texels while preserving deep public support and transparent
  unknown ground. It failed before and passes after unequal domain-warped inlets.
  Deep cuts fade inland; small-island/corridor gating preserves existing support.
  All original island/settlement/liquid/privacy/shore/longitude assertions retained.
  Stronger erosion and narrower blur prototypes were rejected after support
  failures, without weakening those guards.
- Inspected actual shared600px center and320px east source projections: more
  unequal inlets are visible, but inherited macro topology/longitude corridor
  remain. Owner-requested natural-coast acceptance is still OPEN; source metrics
  and projections cannot close native visual rows. Added center/east/west captures
  to the existing native WebGL/software case on desktop/mobile, restoring the
  original geographic camera before existing veil/privacy assertions.
  Receipt: `2026-11-17-globe-inlet-source-review.json`; recipe unchanged.
- Scope: shared globe presentation only; no server/schema/authoritative geometry,
  content publication, positions/progress or selected master artwork changes.
  Development checks: globe-atlas/fallback/materials/veil, globe/workspace/Travel
  Point UI, scoped lint/format/types and native discovery. Full quality/configured
  exact-head/native gates remain due on the final combined candidate. Database/
  combat suites excluded from this small loop because their sources are unchanged.
- Two generated colosseum detail candidates remain unaccepted: architecture
  shifts cannot be registered cleanly over the chosen master. Continuing exact
  source-framing detail generation/review; no generated candidate is in runtime.
- Development evidence:43 tests/7 globe/material/fallback/veil/workspace/Travel
  Point files pass, including all8 canonical town-marker land supports. Scoped
  zero-warning ESLint/format, web TypeScript and801-entry native discovery pass.
  Discovery is not execution. A root-cwd lint invocation ignored web paths; it
  was rerun from the web package with the proper configuration.
  Original colosseum and selected fire/ice master bytes remain unchanged.

## Native job envelope — November17

The complete #813 source log spans15:13:06–16:13:17 and stopped partway through
mobile coverage, after setup/build,7.9minutes of authenticated story checks and
about48.5minutes of serial Atlas. Its two failed cases account for seconds rather
than the missing several-minute tail. The current matrix also adds legal
normal/maximum large-art views. Raised ONLY the verify job's overall envelope
60→90minutes to allow that full serial matrix to finish and retain evidence.
No test assertion, colour bound, FPS/frame-count target,15-second performance
window, per-test timeout, retry, project skip, worker count, production job,
protected release implementation or acceptance requirement changed. A completed
run still must pass all cases; this budget adjustment never converts #813 into a
pass. Final combined-candidate configured checks remain mandatory.

## Continuing source repair — November17 water slabs and native fixture failures

- **Implemented the photographed water-slab repair.** Used an existing installed
  Skia Canvas2D binding to execute the real `createMapRenderer`, public projection
  and unchanged local source assets at the exact Verdant native-review position.
  Reproduced the photographed dark diamonds. Flat-depth and texture-removal
  ablations retained them; disabling only the broad per-cell channel strokes
  removed them. Removed those three clipped dark strokes from `paintWaterGround`.
  Shared depth, bank/texture detail, all19 fine filaments and animated flow remain.
  This is separate from the earlier mixed shallow-corner bug, which was NOT the
  cause in this fixture. No geometry, motion/step timing or saved state changed.
- Regression failed before repair with three broad clipped strokes, then passed.
  **443 tests/6 water/renderer/surface/coast/motion/travel files pass**; scoped
  formatting/lint, web TypeScript and diff checks pass. All native gates still due.
- Added `.github/scripts/render-world-source-review.cjs`, a no-network/no-DB
  source-render recipe using an existing optional canvas binding. It loads actual
  local image bytes and records hashes. Example: `node .github/scripts/render-world-source-review.cjs
<output-directory> verdant-expanse 1`; supported detail scenes are
  `remote-colosseum-detail` and `elemental-valley-detail`, zoom0.35–1.4.
  `WORLD_SOURCE_REVIEW_CANVAS` can point at the installed binding; the managed
  runtime binding is detected automatically. No application dependency added.
  Scope is offline source review, NEVER browser/auth/handset/performance acceptance.
- Fair before/after renders use the exact934cf0 baseline water module through an
  isolated read override, same viewport, position and identical loaded asset
  hashes, with zero missing assets. Actual reviewed output removes the dark slabs.
  Receipt: `2026-11-17-water-channel-source-review.json`. Native confirmation stays
  open. Software maximum-zoom legal detail views show remaining blurry masonry
  and waterfall/stone detail; do not call older-art fidelity accepted.
- #813 is **completed CANCELLED**, sourceadc7d42/tree40f2f925 independently bound
  in checkout/source logs. PG17/build/story15 passed; Atlas had two failures before
  cancellation: four-biome colour minimum75 received65 and synthetic mobile frame
  progress expected>199 received199 at the final poll. Final metrics reached217
  frames from79 in15.939s; that out-of-window sample is NOT passing evidence.
  Elapsed15:13→16:13 matches the configured60-minute job envelope, but logs do not
  explicitly prove the cancellation initiator. Retain all observed failures.
- Downloaded compact artifact14346107615 (54,867,870bytes), verified SHA256
  `5563766731c98d6bf0ddf9683bf362bb1667d9f7939a6ea87a4b3c710b645256`.
  Its four-biome image still displays real15:42 Overcast, contradicting intended
  clear12:00 fixture. Source route also intercepts `/api/world/presence`; a counted
  receipt is not proof that a scene was applied. Narrowed to actual World pathname,
  requested normal visibility scene refresh, set the fixture frozen and required
  visible12:00/Day/Clear/Frozen BEFORE pausing the light and sampling pixels.
  Independent colour/material/order bounds are unchanged. Offline exact scene
  at noon samples[88–91,101,85–87], inside existing bounds. Native proof is pending.
- Changed the mobile frame condition to in-page RAF observation with the SAME
  > 120 additional frames,15,000ms timeout,4xCPU, DPI and existing budget assertions.
  > Cross-process polling can miss its final one-second interval; new artifact
  > records the actual in-page crossing time. This is a measurement repair pending
  > native verification, NOT a claim that mobile performance now passes. No added
  > retry, skip, sleep or relaxed limit. Discovery/types/lint/format pass.
- Existing immutable #813 contains neither this repair nor the newer934cf marker,
  water-corner and detail-view additions. The next native candidate must include
  them, resolve any recurring failures, and complete every applicable gate.
  Do not replay any PR1040 database, cron, publication or Production operation.

## Current repairs — November17 position marker and water continuity

- Actual desktop/native and dense-mobile #812 globe captures show a tiny current
  position dot and text overlapping a town icon. Enlarged the dot8→12px and text
  to12px, added a dark backed label below the exact dot, and kept its geographic
  centre and pointer transparency unchanged. Removed the mobile9/11px overrides
  for this marker only. Location-label hiding still retains current position.
- Existing globe markup regression failed before the new label span and passed
  after it. Added native computed-size/viewport guards plus unobscured desktop/
  mobile screenshot `art-surfaces-world-current-position-globe.png` to the
  existing presentation case. The compact art bundle already includes this name.
  **Native execution of this newer change remains pending**, not covered by #813.
- Inspected #812 native valley normal/minimum and mobile Crown globe images.
  Valley shows the selected statue-side waterfall/rock detail and basin; this is
  not maximum-zoom/registration acceptance. The native colosseum centre showed
  mostly floor. Added distinct legal viewpoints derived from actual artwork
  projection for statue-side cascade/rear masonry, with canonical walkability
  and footprint guards. The new source guard failed before adding those poses,
  then passed. Added one bounded desktop/mobile native normal/maximum capture
  case; full discovery is801 entries/102 files, not a claim of native execution.
- Native #812 Verdant water frame shows tile-shaped colour patterns; Frostmere
  normal frame shows dry snow surface, with faint ground joins still requiring
  review. Traced water depth/material/cache painting. Reproduced a separate shared
  vertex bug: a shallow cell caps a shared depth at0.45 while its deep neighbour
  uses1. Removed that per-cell corner cap; the shallow cell still seeds zero
  depth, shared vertices now agree, and collision/footsteps/geometry are unchanged.
  The new regression failed0.45 versus1 before repair and passes afterward.
- **Important diagnostic limit:** analytic probes of all canonical public views
  and the three actual regional-water fixture sectors found no mixed-corner
  discontinuity under the old cap. Thus this general supported-input repair is
  NOT established as the cause of the photographed Verdant pattern. Keep the
  native water/material/seam requirement OPEN; obtain actual newer native frames
  and trace remaining material/compositing causes rather than claiming it solved.
- A stronger inward globe-inlet experiment failed settlement-fabric coverage and
  looked rounder in source projection. Investigated small-island headroom and
  rejected the experiment after review. **No experimental coast code remains**;
  retained adc7d42's first contour correction. Owner coast acceptance stays open.
- **466 tests across9 renderer/water/coast/motion/travel/workspace/fixture files
  pass**, including shared-depth/private-boundary and unchanged legal movement
  regressions. A separate focused fixture/art/globe run passed30 tests/4 files.
  These counts overlap and must not be added together. Web TypeScript, scoped
  zero-warning ESLint, Prettier and diff checks pass. Original full quality below
  remains historical; full final-candidate/configured/native gates are still due.
- Local Chromium exists but still fails its startup singleton socket with
  `Operation not permitted`; no local native pass, escalation or bypass claimed.
- Existing #813/job134138931990 is still running on adc7d42: PG17 rollback/success,
  production build and authenticated story/NPC checks pass; Atlas is running.
  Protected jobs remain skipped. Do not cancel or duplicate it. New pin, shared
  water vertex and detail-view capture changes require their own later native
  verification after this existing run completes. Continue inspection/repairs
  on the one branch; one combined final PR/release only, no Production replay.

## Active native verification — corrected candidate #813

Source candidate `adc7d42af27a68b49c59768411985b39af7bebd7`, tree
`40f2f925145820d50475db21a39baf00b188b0f9`, is published on the one task branch.
Living Atlas [#813](https://github.com/ZeiJM/Aurevane/actions/runs/44111749720),
verify job134138931990, is now running. The UI confirmed the requested branch,
exact `expected_candidate` above, blank `deployment_ready_sha` and all five
staging/Production flags false. Independent job API confirms checkout/source-tree
recording/frozen installation passed, Chromium installation running, protected
staging/Production jobs skipped. Logs are not yet downloadable; recheck recorded
source before accepting completed results. No overall or native visual pass yet.
Do NOT dispatch another run while this one is active. Next continuation: inspect
this existing run and bounded art/runtime evidence; further irregular-coast
correction, pin prominence, large-art registration/detail, sea/seams/grounding and
all final configured gates remain open. Lease released at this durable boundary.

## Current continuation — November17 coastline and native failure repair

This section supersedes the earlier running-status notes below. Living Atlas
[#812](https://github.com/ZeiJM/Aurevane/actions/runs/44088314266) completed on
application source `dcec8f98e539246aa767ea99740e68db21905983`: **106 Atlas passes,
3 failures**, plus15 authenticated story/NPC passes. No overall native pass.
Real disposable PG17 rollback/locking/success preservation and build passed;
all Production modes were disabled and protected jobs skipped.

- Both desktop/mobile Uncharted-label failures came from exact text matching a
  parent containing a decorative diamond. The visible name now has its own text
  span; the original native assertion is retained. Strengthened source regression
  failed before correction and now passes. No private geography is exposed.
- Mobile Travel Point failure was real pointer interception by the open Details
  drawer. The native case now closes that actual drawer before globe taps and
  reopens it for sidebar interaction. Complete nine-stop wrap/shared cursor,
  unchanged position/route and zero mutation checks remain. No forced click,
  increased timeout, skip, retry or product travel-rule change.
- Nick reviewed the actual native desktop globe and rejected the rounded land
  edges. Added multi-scale periodic contour relief to the shared globe atlas,
  affecting WebGL and software geography together. Thin public strips retain
  their contour support; unknown/private cells remain transparent. Canonical
  sector geometry, movement, saved progress and selected fire/ice art are intact.
- New broad-shore regression failed before the repair (only3px contour variation)
  and passes after it; added narrow-strip/longitude-boundary support regression.
  **40 tests across6 globe/material/fallback/veil/workspace files pass**. Web
  TypeScript, scoped zero-warning ESLint and Prettier pass after formatting.
  Existing full local quality evidence below is historical, not a new final-head
  or native pass. Database/combat/catalogue suites are excluded from this small
  presentation loop: no server authority/schema/content changes. All final
  configured/full quality/native gates remain mandatory for the combined patch.
- Extended the existing source recipe: `node .github/scripts/report-town-extents.cjs
<output-directory>` now emits real software-projector renders at320/600px and
  longitudes -45/0/45 as well as the flat2048x1024 texture. Inspected the actual
  flat texture, 600px front/east and320px west outputs. The contour now has uneven
  small inlets; inherited coarse large-scale lobes and the narrow longitude land
  strip remain visible. **Owner-requested natural-coast visual acceptance stays
  OPEN** until native desktop/mobile WebGL/fallback review and any further repair.
  Receipt: `2026-11-17-globe-coast-source-review.json`. These are source renders,
  never described as native browser/physical-handset acceptance.
- Inspected native artifact14334087287's desktop colosseum normal/minimum pair:
  normal view shows floor around the player, minimum view shows stands and entry.
  This does not establish close masonry fidelity. Keep edge-camera/native detail,
  valley registration, global pin prominence, sea/seams/grounding/runtime and
  actual handset acceptance open. Do not generate/upscale and claim fidelity.

Native artifact archives were SHA256 verified: evidence14332968666,
`7230f816e52c20c525451a9636dd7c948bc76e9d3e88dbaee0ac34e1e63473b1`;
art14334087287,
`655cf9da32ad0463ce1dbee5af9a5d6a189ab9be5f716a6a21cf1f03ab1ecd04`.
Next: native verification of this corrected candidate, inspect actual desktop/mobile
coasts at rotation and other outstanding visual rows, then repair demonstrated
remaining defects. No partial PR merge/deployment; no PR1040 migration/cron replay.

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

### Passing local component gate — November17 13:35UTC

- Restored missing checked-in artwork; all23 tests in the two affected web files
  pass without source or timeout changes. The battle failure was an explicit
  5000ms timeout during concurrent build/type work; retain that observed failure.
  A focused pass alone was not accepted as closing it. Repeated the full web
  suite after asset restoration, with the competing build completed: **9691
  tests/699 files pass**, followed by all7 standalone Node checks. Log:
  `combined-web-tests-restored.log` (zero failures, no skips/retries added).
- All package coverage now passes: web9691, game-core7211, DB768 (765 in the full
  run plus the3 formerly missing-script failures resolved by all27 focused
  cases), validation110, audio19, realtime3, worker2: **17804 Vitest tests plus7
  Node tests**. DB768 is combined unchanged-source evidence across the original
  run and recovered files, not a falsely claimed new single full-DB invocation.
- Formatting, lint, all8 package typechecks and full worker/web build pass in
  staged runs after restoring checkout/dependency omissions. Initial `pnpm
check` failures are preserved above; do not rewrite them into a claimed clean
  original command. Final exact-candidate configured CI remains required.
- Main remains2893076856e20bc64f00e94e132d26dd0d76b26d. Application source still
  matches the existing native run's dcec8f98 tree except later documentation.
  Native Atlas run44088314266 remains the next gate; inspect it and bounded
  screenshots/runtime evidence before artwork or coast fixes and combined PR.
  Do not replay or duplicate active native/Production operations. Lease released
  so the next continuation can inspect the existing run without a stale lock.

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

## Global World Atlas — explicit acceptance scope

Nick reaffirmed on November17 that the global map belongs in this SAME combined
update. Local map passes must not silently close global requirements. Review the
full page on desktop and mobile, not just a cropped terrain canvas.

| Global requirement                                     | Source/review boundary and remaining evidence                                                                                                                                                                                          |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atlas placement and responsive layout                  | `world-workspace.tsx` and `workspace.module.css` globe body/sidebar layout; verify the right-hand area, useful sizing and mobile containment.                                                                                          |
| Cosmic backdrop, no measuring ring or bottom legend    | Review the actual globe scene and WebGL/fallback presentation; absence of a longitude grid in source alone is not visual acceptance. Keep obsolete Known Lands/Uncharted Supercontinent controls absent.                               |
| Strong current position and distinct settlement icons  | `world-globe.tsx` current-position pin, actual public town coordinates/icons and `globe-atlas.ts` shared extents; verify contrast, overlap, orientation, readable scale and zoom.                                                      |
| Map-switch arrow and shared Labels control             | Piece1 native presentation case switches to globe, hides/shows town names, retains icons and returns with state intact; inspect actual desktop/mobile layout.                                                                          |
| Travel Points and Uncharted naming/control cleanup     | Piece2 shared cycling/selection and globe markers; test the complete real public-town cycle, wraparound, ordinary confirmed travel authority and removal of the redundant Uncharted focus control.                                     |
| Natural territory/coast shapes and crisp terrain/ocean | Piece5 extents vary; the underlying flat shared texture still exposes inherited sector steps/corridor. Inspect native globe before deciding the correction; do not claim the natural-coast request passed from counts or source tests. |
| WebGL/fallback, seams, zoom and privacy                | Both globe render paths must agree on public geography/water/style, remain aligned while rotating/zooming, preserve selection and withhold foreign private identities. Physical-handset acceptance remains separately open.            |

The existing native run includes global control checks and
`art-surfaces-town-extent-*-globe` images. Its compact art bundle includes these
via `art-surfaces-*.png`. Use those actual images plus the broader globe/native
cases for review. If they do not prove a row above, obtain the missing evidence
or repair it before closing that row. No partial global/local deployment.

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

Recovered original November13 instructions and November17 safeguard refinement:
remove Surveyor’s Collection; move the globe footer facts into its existing Your
position card; replace the travel confirmation popup with nicer inline destination
review/close controls, preserving separate confirmation before travel. Implemented
by WorldDestinationCard and the shared confirmed-position facts. Local sector
footer/nearby presentation is retained; the globe owns the moved position card.
Selecting a town/sector does not travel or arm confirmation. Travel here opens
inline review; only Confirm travel submits the existing authoritative walk intent.
Cancel, Escape and changing destination disarm review. Native selection/review
coverage requires zero mutation commands before explicit confirmation, while
actual confirmed routes still use the original World service. Native presentation
checks verify the facts move into the globe card, not duplicate at the footer.
No modal shade or aria-modal dialog remains. Header has one World Atlas title in
the sidebar, with an accessible Atlas region around the globe itself.

## Final combined gate

Refresh main and reconcile overlaps, review the complete diff, run `pnpm check`
and configured affected native/workflow gates on the final candidate. Record
each requirement's implementation and actual evidence. Keep one combined PR and
release; no Preview or partial Production deployment, migration replay, account
reset, content republication or invented human/physical-handset acceptance.

## Frozen continuous-work candidate — November17

All hourly tasks remain disabled. The active interactive worker retains the lease.
Final scoped ESLint and Prettier checks pass, TypeScript passes, and destination,
workspace and globe tests pass23 cases. Focused renderer/asset/scene guards also
pass. Earlier full checks are not final evidence: attempt1 stopped on manifest
formatting (fixed); attempt2 has no completed result; attempt3 was interrupted
before the recovered destination UI changes to avoid mixed-source evidence.
The new final full check will run against the frozen combined source.

The material lag correction follows the failed unchanged Timing63 run; no
unchanged retry, timing threshold reduction or authority bypass is requested.
Fresh configured CI, Smoke/Edge, Atlas, UI layout and timing results are required
on the new candidate before integration. Native lateral colosseum coverage adds
a separate120s case without changing the existing central case deadline.
Local measurements remain controlled source experiments and do not substitute
for actual Chromium performance or final rendered visual inspection.
