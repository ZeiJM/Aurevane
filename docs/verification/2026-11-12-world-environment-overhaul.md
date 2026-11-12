# November12 environment graphics overhaul

Base: main16883ffd6951fe93d0b34a6b1aa3731ba0b05e4a, the completed1037 release. New branch: agent/world-environment-overhaul-20261112. Nick explicitly requested generation, corrections and implementation, including the complete environment/water reference direction. This record is an implementation checkpoint, not a production-release or visual-acceptance claim.

## Source changes and evidence

- Generated and inspected original8-region ground,8living-tree,4water and6Void-material panels. All masters, exact prompts, deterministic pack script and runtime hashes are recorded in content/art-requests/ART-WORLD-ENVIRONMENT-20261112.md. Runtime4sheets total1,173,512bytes. Living-tree source alpha is retained; all8packed sprites have transparent top/side gutters and floor bounds at488inside384x512cells. Native integration/scale acceptance is pending.
- The new ground replaces the main regional texture instead of only adding decals. Ordinary public foliage uses the new living family for each region; specialised seasonal scenic trees and decoded fallback stay available. Ember's default tree is alive. Rooted canopy motion, depth sorting/identity masking and bounded quality controls are reused. Phone raster cache keys now include source identity and support new living crops.
- Wilderness trail widths/opacity are reduced; legal port continuity and route data remain unchanged. Dry built-up yards/hamlet approaches gain paving while shore, gardens, trees, liquids, blocked ground and remote areas remain excluded. Geometry, movement authority and coordinates are unchanged.
- Water depth is cosmetic distance from supplied banks, capped at3known water cells, with shared corner samples. It does not invent bathymetry, movement rules or hidden shores. New texture/reflection material supports existing moving flow/ripple/rain paths and bridge underpasses. Public wrap is canonical; private namespaces remain isolated. Void ground uses six theme families inside supplied ground only; existing thirteen district landmarks/rare variants and legal exits remain.
- Loading defect: independent older hydration could withdraw public scenery from an earlier camera/viewport after a newer owned full scene had arrived. Existing stale guards checked route cells/exits but not viewport background. A real projectWorld delayed-reply regression failed coverage before the correction. The controller now rejects only older replacements that would lose currently complete viewport coverage; useful older ground can still fill an incomplete scene. No timing, navigation, PvP presence, server-projection, cache-budget or private-reveal change. Scoped commit850ea142885ab79a396d2bf98b2439fbe5fae56a passes14adjacent suites/290tests plus zero-warning scoped ESLint/Prettier/diff.

## Test progression

The first local test attempt could not collect because /tmp was full. Workspace storage remained available; using a task-local TMPDIR resolved that environment issue without deleting unrelated files.

Four new/changed renderer, paving and trail expectations failed against old behavior, then passed after implementation. The depth regression failed against missing depth data, then passed. A public-wrap depth regression and private Void-material renderer regression failed, then passed after canonical lookup and conditional source loading. The first stable affected group passed190tests/4files. Original fallback crop/anchor tests remain, explicitly exercising fallback; current living-tree tests retain floor anchoring, motion/reduced-motion, full dense coverage, snowline identity, raster reuse and growth checks with the new source contract. No timing/authority threshold was weakened.

Web TypeScript passed on the intermediate source before the final Void/wrap additions; final combined gates are pending. Full local/configured CI, Living Atlas, Browser smoke and actual image/artifact review are required on the published tree. Playwright discovery does not establish execution.

## Outstanding acceptance

Native authenticated collection is not available locally because Docker is unavailable. Require image-ready new-material captures for all eight towns,72hamlets,13Void districts and rare/refuge variants, water depths/shore/crossing, quiet remote paths, paving, weather and roof/tree walks. Human continuous-motion and physical-handset acceptance remain open. The loading correction proves one source withdrawal path; it does not establish that every live blue-gap report or crowded frame delay is resolved. No CPU/cache root cause or performance improvement is inferred from source presence. The previous intermittent paused-canvas finding remains visible; no unrelated runtime fix is claimed.

No migration, live content publication, player-data/history/pin/Owner-draft/Runeblade change, merge or deployment is included in this checkpoint. Automatic Git deployments remain disabled. Completed1037 and its paused watcher stay complete.

## Final source review and focused verification

Independent whole-branch source/asset review found one Important issue: shared vertex depth data was being collapsed into a diagonal gradient, producing unequal colour at shared tile edges. An actual painter-boundary regression reproduced RGB76.75/146.75/144 versus54.25/117.25/127. Cached2x2 corner-colour interpolation now aligns source pixel centres with shared vertices; the regression passes. The test sampler's bottom-row pixel order was corrected to actual row-major order. One2x2 scratch is reused per ground context, held weakly; no depth raster is rebuilt per animation frame. The bank-cache guard accounts explicitly for that tiny scratch and proves a warm frame allocates nothing further. The review's panel0 concern was already addressed by bank-clipped shallow-texture painting; a direct guard now proves sand-bottom material is used only in a supplied bank mask, never bankless water. No source finding is left unresolved.

Final loading review additionally reproduced the same stale-viewport withdrawal without any owned-version change. Coverage protection now also applies to older same-version server clocks, preserving the existing early newer-authority/blocking paths. The new case failed before the correction and then passed. This is one loading mechanism, not a general live latency or frame-rate claim.

Final combined focused/adjacent command passed596tests/38files, including all World components plus presence, movement receipts and server projection. Scoped zero-warning ESLint and formatting passed; Atlas discovery includes201case/project entries, not execution. Source changes preserve all movement/authority thresholds; original fallback crop/anchor coverage remains, while current normal paths validate the new living art.

The full local `pnpm check` did not pass: format/lint/package types passed on its intermediate tree, but Turbo's strict environment omitted the task-local TMPDIR and test workers failed ENOSPC before collection. Later broad attempts encountered unexpected worker exits and a lint exit137; separate package runs were cancelled before completing. No full-test success is inferred from partial results and no kernel OOM attribution is claimed. On the final graphics tree, all519World tests passed; the final loading extension plus adjacent consumers passed596tests. Web TypeScript passed separately. Worker build passed; optimized web compilation succeeded in12.8s, then Next's TypeScript subprocess was killed137. The application build therefore did not pass. Do not repeat unchanged broad suites locally; exact-head configured CI must establish the complete required gate.

Review image delivery is split into hamlets, northern towns, southern towns and Void/water/occlusion artifacts; metadata/timing remains in living-atlas-evidence and the original full screenshot/trace artifact is retained. This avoids relying on a single near512MiB archive after adding richer textures. YAML parses, artifact names are unique and all12filename categories are covered exactly once. The new water review case intends three additional desktop bank/depth views; expected art still count247must be checked against actual execution, not discovery.

Native reference fidelity, paving readability, bridge/depth compositing, continuous motion, physical-handset performance and complete resolution of blue gaps remain required evidence, not waived by the source review. New assets/runtime hashes and exact tree will be recorded in the draft PR. No deployment was made.

## First hosted result and water fixture correction

Exact source fd98b5f2/tree62592aaa passed CI43147177747, establishing the configured full quality gate. Atlas43147177951 attempt1 recorded83passed/116intentional project skips/2failed. Browser43147177927 attempt1 also failed the new water-review case. Neither is a demonstrated transient setup failure and no unchanged-source retry was used.

Water selection excluded all town sectors. The actual atlas has no Frostmere wilderness bank satisfying the fixture, so its third intended capture failed at candidate existence. Extracting the real selector and asserting all three regions reproduced Frostmere RED (two regions passed). The fixture now prefers wilderness but may use an existing settlement bank; shared terrainWalkable retains legal positions. All three regions pass, with an additional wilderness-preference/unknown-region guard. No runtime terrain or water rules change. Fresh native execution must establish the missing Frostmere view.

The independent Atlas mutual-attack case failed its existing10second lock-waiter assertion: expected2, observed0. Full Browser execution passed that case. Cause is unconfirmed; no speculative runtime fix, timeout change or blind retry. The existing helper now records only transport rejection/status/error code after releasing its gate, and always restores original SQL definitions in finally. A bounded artifact retains mutual-attack and water-case traces/error context; the prior full758696004byte archive exceeds the connected downloader536870912byte cap. These diagnostics do not claim to fix intermittent contention.

## First native image review

Downloaded exact-head/attempt1 metadata13914065743 and all four split image archives. Each digest matched the API and archive integrity passed:

| Artifact                        |     Bytes | SHA256                                                           |
| ------------------------------- | --------: | ---------------------------------------------------------------- |
| Metadata13914065743             |  58496279 | 2d79ced388f6fef8d2ec2e2c2760a1b73925569956304626b2b75fb3a5ce3695 |
| North13914236049                | 154921037 | 793a817af38d035aef105fb0a798dbd39a90e7c2e4617efd975c2c4d7a7a4ac2 |
| South13913726813                | 150614228 | 82afa689b31030a0dc31cd7922e17fe41f9dee3efd79b4b60074fd84f8c2e006 |
| Hamlets13913507000              | 119271560 | db88deefaf8155ecf9565fdc2d88fe75e146b14f8f5852b71034661b105318b5 |
| Void/water/occlusion13913701710 |  43787520 | f30f2ca56db29558049f15123869c93460cebb98a09eef637dcebcceab0393fd |

Actual246art PNGs:244previously intended views plus Verdant/Hollow water views; Frostmere water view and final water JSON are missing.27other scene JSONs are present. Contact sheets covering all246views were inspected, with native-resolution Frostmere town and Hollow water samples. Eight towns/weather/phone views,72hamlets and20Void/rare/refuge views are present. Broader ground replacement, regional living foliage, snowy trees, paving and quiet wilderness are visibly integrated; bridge and player remain readable in sampled views. This is contact-sheet/sample review, not247-view completion or continuous-motion/handset acceptance.

Further visual refinement remains supported: Frostmere has conspicuous straight diamond snow/paving borders and repetitive snow texture; public banks remain long/angular; water still reads as a relatively uniform turquoise strip/pool rather than the reference's deep natural lake; settlements retain repeated functional arrangements and hamlets four shared families. Void materials/landmarks vary, but geometric overall silhouettes/pools remain. Do not call reference transformation complete. Loading continuity under real delayed delivery and crowded frame timing remain open; new green code/metadata would not close them. Continue review/corrections after the fixture successor's native evidence, preserving topology/reveal and all existing thresholds.
