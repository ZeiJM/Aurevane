# Corrective map update progress

## Producer-bound ground coverage correction — November 13

The exact `51cf477f` Atlas run disproved the second external-collector hypothesis: both desktop and phone again recorded zero coverage frames, while the previously intermittent peer-motion and legal-attack cases passed. The renderer canvas is stable through the tested movement path. Both the earlier `MutationObserver` and replacement `requestAnimationFrame` helper were still consumers outside the completed paint that publishes `data-painted-ground-ids`; neither is a reliable frame ledger under the authenticated native run.

The smallest correction moves only the opt-in coverage history to the renderer's existing `renderDiagnostics=coverage` producer boundary, after identity and ground painting complete. Normal gameplay does not populate or serialize the ledger. The helper now only enables and resets that producer-owned diagnostic; the existing strict `>20` frame, no-missing-public-ground, authority and displaced-sector assertions are unchanged. A renderer regression failed before the producer ledger existed, then the renderer/helper pair passed 221 tests across two files. Web TypeScript, scoped zero-warning ESLint, formatting and diff checks pass. Authenticated native GREEN is not yet claimed; the original exact-head Browser run remains undisturbed while the successor is preserved off the PR ref.

## Final Atlas contract diagnosis — November 12, 19:58 UTC

The preserved `fd1668c` native Atlas run completed far enough to retain all split art evidence, then failed five strict contracts. Exact logs show two desktop/mobile stage-coverage failures (`frames.length` was zero), two desktop/mobile globe water mismatches (`w` versus the stale expected `.`), and one Verdant water-review scene whose 104 shallow cells were entirely bridge-connected and therefore had no visible bank. These were deterministic source/test-contract defects, not a runner retry case.

Two new unit regressions failed before the correction: the coverage installer did not register a frame observer, and the Verdant selector returned a bankless water field. The minimum correction observes the stage's `data-frame-now` mutation after completed paints, retains the strict no-hole checks, selects only a water field with an actual bank, and recognizes the already-authoritative `w` overview symbol. All six focused helper tests and 277 combined World/server/renderer tests pass. Web TypeScript, scoped zero-warning ESLint, formatting and diff checks pass. Runtime geography, rendering, assets, authority, migrations and thresholds are unchanged.

The digest-verified split native artifact was reviewed at normal size on desktop and phone. It contains the globe's Uncharted supercontinent, the Owner-selected elemental waterfall valley, open colosseum interior/minimum view, fortress, abandoned town, grand bridge, lava cascade, ocean arch/coast, snowy relief and private/Void scenes. The artifacts also preserve a limitation: lake, river and moat outlines still visibly follow their supplied tile geometry, with several narrow channels. Source tests and contact sheets do not close full reference fidelity, human motion, physical-handset or live-load acceptance.

Plan: `docs/superpowers/plans/2026-11-12-world-map-correction.md`
Base/main: `2c3c73d13f4c0cf1eb4ac5824deb8ae7b8b4760b` (PR1038 live).
Branch/workspace: `agent/world-map-correction-20261112`, `/workspace/scratch/aurevane-map-correction-20261112`.

## Current checkpoint — November12, 14:35 Trinidad

**Not yet live. Do not replay PR1038.** Owner explicitly authorizes this corrective release live for testing once review/quality/native smoke pass. Preserve the separate ferry/inherited82-row backlog. Full scope and newest art selection/HQ refinements are in the spec; it supersedes earlier town-topology limits.

Implemented and integrated in source: real25th-sector receipt withdrawal fix (actual Frostmere49→48loss reproduced; fixed49 retained), square rock plate removal, legacy shrine/camp/waystone contact pivots, stronger coherent terrain contours, new eight-town canonical layouts/Crown walls/moat bridges/walkablew water, geometryv2/new service-only RPC,64×48 private supercontinents and efficient safe private A*, cache-proved giant public discoveries60×40valley/48×36colosseum, exact Owner-selected original avatar source, two-pass arena and normal identity in open floor, new architecture/wall segmentation, weather-linked shallow ripples, organic water/lava/depth/lake art and open-sea background.

Latest whole renderer test before three additional contact regressions:208/208PASS. Five targeted contact/contour regressions subsequently pass. Earlier independent focused checks:208town/atlas web +73DB source/authority,226coverage/private routing/service,119private globe and15ripple tests; these are not a final exact-tree gate. Latest parent combined318test run had317PASS +1 agent's then-new lavaRED still being implemented; water owner now reports69water/coastPASS and is running adjacent checks. Final parent full suite has not run.

Still active: actual new remote grand-bridge rendering hook, rare large HQ ocean feature, source-detail treatment at giant-landmark zoom, final globe HQ material iteration/provenance, native20-slot desktop/phone scene matrix/CI registration, final full quality gate/review/remote PR/CI and controlled migration/deployment/postflight. Root is integrating, not at release-complete state.

Local native Chromium is blocked by socketEPERM; no bypass attempted. Exact-candidate hosted CI browser evidence is required. Direct globe fallback rendering was inspected twice: new material/coast version is substantially clearer; source geography/privacy remain authoritative.

Final selected avatar artwork: `sources/elemental-waterfall-valley-owner-selected-v01.png`, copied from Owner upload image(20261112-175551). Never use rejected muscular or robed alternatives. Colosseum selected `remote-colosseum-v03.png` emphasizes open arena. Do not regenerate finished artwork or repeat source recovery.

Supabase migration generated via CLI as `20261112183130_town_and_continent_teleport_geometry.sql`, containing the reviewed successor SQL; the earlier manually named134000file was removed before any hosted application. No hosted DB mutation or production build has happened for this update.

Fresh main at last preflight remains2c3c73d1. Git automatic deployments remain disabled. No user state/history/draft rewrite is authorized.

## Critical HQ integration checkpoint, 14:50 Trinidad

The first three isolated HQ avatar/cascade detail generations FAILED technical composite registration (double hair/shifted faces/feet). Parent REMOVED their renderer load/overlay code immediately; exact selected macro remains active. The removed integration snippets are in ignored `.local-validation/valley-hq-pending/` for adapting only after QA. Asset agent is validating ONE context-preserving rectangular source-crop HQ repair; do not enable old isolated mask overlays. The new source regression for close-view detail loads is intentionally RED until the approved repair is integrated. Do not exclude it from final release checks.

Other progress: root combined seven-suite313/313PASS before later bridge/HQ additions. New packed grand bridge rendering regression is RED→GREEN. Native arena material and ocean-grain motion are integrated; rare large ocean placement now receives the complete public atlas. All actual source-native scene captures and exact-candidate full gates still required before release. Source migration renamed via CLI to20261112183130. All direct globe HQ materials were visually accepted for native review.

## Conversation recovery and resumed implementation

Recovered the linked `Old 4` conversation (`6af5b161-326c-83e9-ada7-a3344b4af720`) directly in the signed-in browser, walking from its final messages back to its first message. Reconciled that primary record with the current recovery workbook, this intact dirty worktree, fresh remote main and PR1038's release receipt. Main remains `2c3c73d13f4c0cf1eb4ac5824deb8ae7b8b4760b`; no corrective remote branch existed at recovery. No earlier successful workflow is reused as final corrective validation.

The browser confirms the latest refinements: exact final re-uploaded original avatars, animated valley water, genuinely larger-than-town valley/arena grounds, open readable arena floor, smooth actual sea/river/lake/lava surfaces, a rebuilt crisp global map and occasional large HQ ocean discoveries. The original `image(20261112-175551)` selection supersedes all muscular/icicle and robed revisions. All twelve corrective outcomes in the active spec remain in this one authorized corrective release. The separate ferry, deferred Void gameplay and inherited82-row/all70-original-ID backlog remain in `2026-11-12-recovery-and-release-split.md` and `unified-upgrade/requirements.csv`; no rows are silently closed.

Resumed at the real outstanding failure. The existing close-view loading regression and a new actual-paint registration regression both failed before repair (2RED). Integrated the already-generated context-preserving rectangular crops using their measured exact-master targets and feathered perimeter, without restoring the rejected isolated silhouette masks. Both regressions now pass (2GREEN), including no arena material at the valley/no valley detail at the arena and actual draw coordinates/transforms. The selected macro remains unchanged; detail loads are site-scoped and begin only above their projected resolution threshold. Water/spray animation remains in the ordinary existing motion pass, including static reduced motion.

Inspected the new fire, ice and cascade sources, a full composite and native-scale face/cascade seam samples. The context-preserving repair avoids the earlier duplicate heads/shifted feet in these inspected composites. This technical registration evidence is not a substitute for the final actual gameplay-scale desktop/phone scene review. The complete quality command `pnpm check` has been started on the resumed source, and a fresh read-only whole-branch review is active. Final counts, native evidence, remote candidate and any review corrections must be recorded below before release.

## Compact continuation and final review repairs

Direct browser recovery confirmed Old5's interrupted quality/native gate, Old4's corrective mandate/final art choices and Old6's intervening lava repair. The intact160-file candidate was retained; fresh GitHub/main still matches2c3c73d1. `docs/CONTINUE.md` now indexes the exact spec, evidence, next actions and separate82-row backlog without repeatedly importing full histories.

A fresh independent whole-branch review found two Important defects. The globe acceptance assertion matched both its orientation button and legend/caption; it now selects the unique button, with7existing globe/matrix tests passing. The real renderer also culled grand land/ocean discoveries after an unwrapped camera crossed the world seam: canonical discovery X was not projected to the camera's longitude copy. The extended actual-paint regression failed4wrapped cases while2canonical cases passed before repair; `wrappedMapX(discovery.worldx,camera.x)` repairs the common land/ocean insertion. All6canonical/west/east cases and the full renderer/land/ocean suites then pass229/229. The reviewer separately passed36terrain/privacy/placement/matrix checks and found no other verified Critical/Important defect. These checks do not establish native scene/performance acceptance.

The resumed complete `pnpm check` log is `.local-validation/continuation-quality.log`. Initial format/lint/typecheck passed; its terminal result and affected final-edit checks must still be recorded. Local quality, source review and preserved artwork alone do not authorize declaring this release complete. No hosted migration or production deployment has occurred for this correction.

## Old8 recovery — implementation first, hourly checks paused

Read the exact linked Old8 conversation directly on November12. Its last completed milestone was30/30focused checks after restoring one omitted tracked audio file and updating five obsolete map-related fixtures; the historical baseline and route guards remain. The restarted broad check (`.local-validation/continuation-quality-resumed.log`) reached typecheck after successful formatting/lint but has no terminal result and no surviving process. Do not infer success or relaunch repeated broad checks during implementation.

Nick's current sequencing is implementation first, then combined quality checks. The existing map source/art integration is retained; no new missing implementation was established by recovery. All hourly checks are paused: disabled the sole enabled Update2 task;24other tasks were already disabled. Preserve this complete candidate remotely before the next validation stage. Native acceptance, controlled migration and release remain pending; ferry/inherited requirements remain a separate next update.

Recovery checkpoint verification:305/305 tests pass across seven affected integration suites (water/coast/renderer/settlement/compatibility/privileged NPC route/audio). Full combined quality, browser/native performance and release gates remain pending. Log: `.local-validation/recovery-implementation-checkpoint.log`.
