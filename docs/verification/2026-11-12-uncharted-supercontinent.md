# Uncharted supercontinent correction — source verification

Branch `agent/world-map-correction-20261112`; baseline `2c3c73d13f4c0cf1eb4ac5824deb8ae7b8b4760b` (PR1038). This is implementation/automated evidence, not a production or human visual-acceptance receipt. Parent release work owns final whole-branch review, configured checks, native app QA and deployment.

## Required change and scale ruling

The live ferry's thirteen legacy districts were the complete accessible Uncharted geography, while the newer named Void worlds were independent 32×24 sector planes. A globe label or larger cloud would not make that legacy destination a supercontinent.

Ruling: expand each private geography to 64×48 sectors (832×432 tiles; 359,424 addressable cells), with real connected playable land larger than all 1,870 public atlas sectors' 218,790 cells combined. The comparison uses **connected traversable area**, not a rectangle containing ocean. Each named realm retains its own old districts, landmarks, paths and geography, with characteristic lagoons, lava, broken coast, hollow, terraces, rivers or escarpments continuing into its extension. The legacy destination gains an actual inland continent through ordinary cardinal seam crossings. This is not the separately deferred ferry-to-selected-realm integration.

Flood measurements from the release-baseline comparison run:

| Private geography | Traversable cells | Landing-connected cells |
| --- | ---: | ---: |
| Legacy Uncharted | 285,559 | 285,559 |
| The Inverted Reach | 275,593 | 275,591 |
| The Drowned Meridian | 254,399 | 254,398 |
| The Ruined Sun | 260,102 | 260,099 |
| The Shattered Horizon | 253,580 | 253,580 |
| The Unremembered Orchard | 263,710 | 263,710 |
| The Fallen Firmament | 271,929 | 271,914 |
| The Violet Recess | 271,231 | 271,230 |
| The Hourless Waste | 272,668 | 272,668 |

All nine landings reach more than 218,790 cells and more than 99.99% of their respective traversable terrain. The permanent regression requires >99.9%, tests a distant interior tile, preserves all old landing addresses and checks the finite bounds. The existing realm suite continues to verify every focal site's connectivity and every cardinal seam's legal reciprocal crossing. The expansion exposed an old 90,000-node routing budget problem in The Fallen Firmament; the coverage/performance owner corrected the geographic A* path and its negatives separately. The resulting 473-step route is legal.

## Compatibility and bounded loading

A one-time direct comparison imported exact `git show 2c3c73d1` private authoring alongside the correction, then checked all old legal cells and existing roads. **373,058 old legal cells retain their exact terrain character, and 136,998 old roads remain present.** Legacy sector IDs, local positions, scene addresses, safe landing, fixed landmark footprints, phase behavior, archive observations and discovery namespaces remain intact. Only formerly blocked legacy boundary doors and former outer-sea joins gain passages/land. No saved position is translated or deleted.

The thirteen legacy sectors stay eager for compatibility. `resolveWarpedContinentSector` resolves strict `uncharted-expanse:<column>:<row>` addresses lazily, rejecting aliases for the old thirteen positions. Both private resolvers retain at most 192 sectors. `warpedContinentSceneIds` enumerates at most 25 nearby IDs without constructing terrain. The coverage owner integrated current/discovered/legal-route projection in `world-content.ts`; there is no eager 3,072-sector payload or world scan per walking confirmation. Existing named realm modules construct no sectors at import.

Ruling: display numbering follows the enlarged 64-column geography; retaining an old four-column alias would collide with other physical sectors. The old legacy landing now displays Sector 66 (formerly Sector 6); `void:ivory-veil:21:6` displays Sector 406 (formerly Sector 214). **Stored IDs/local X/Y are unchanged. Ordinary private X/Y stay `?`.** Privileged teleport geometry changes belong to the town/teleport owner's immutable version-2 successor and additive migration; version 1 is not overwritten.

## Globe correction and privacy

The original veil's dense area was only **2.545% of sphere area**. The corrected deliberate continental cover occupies **21.910%**, crosses the date line continuously, and is labelled **Uncharted supercontinent** in the globe label, orientation action and legend. Its illustrative focus is longitude 180 / latitude −45; this is not a private dock or game coordinate. The ferry globe marker's illustrative destination follows that focus; server ferry scheduling, landing and access are unchanged.

The veil remains completely independent of server geography, discovery, private IDs, names and encounters. Its source imports no private authoring. The public atlas texture uses charted overview cells only, and the mainland/off-realm projection regressions keep private discoveries out of public globe/payload data. Both WebGL and the software sphere consume the same cached veil pixels and prevent the veil from painting over charted land.

Ruling: retain the public atlas's existing longitude-circumnavigating dry countryside band, because deleting it would change legal saved routes and known geography. Its northern rim remains visible when viewing Uncharted. The veil was placed southward to avoid making that existing public band appear through the middle of the private continental cover. This correction does not silently remove the public navigation contract.

The Owner's later blurry/blocky-globe request broadened this task to the whole depiction. The old detailed texture forced each supplied sector into an opaque rectangle, sharply changed regional colours and town borders at cell edges, repeated a high-frequency relief lattice, and used a fixed 420-pixel nearest-sampled fallback. The correction:

- reconstructs an antialiased, slightly irregular coast inward from public neighbours; unknown sectors remain transparent and charted sector centres remain opaque;
- blends public regional colours and relief continuously, removes rectangular town borders and replaces the regular dot lattice with coherent multiscale terrain shading;
- preserves exact atlas coordinates, centre picking, town positions and public water/lava/walkable shallows;
- uses quieter deep-ocean currents and a shallow coastal band in WebGL, with bilinear software sampling;
- caches one public detailed texture across equivalent deserialized 200ms confirmations, invalidating for actual water/geography/painting changes;
- uses a 320-pixel software moving preview, then refines after 120ms idle to a viewport/DPR-aware 420–768-pixel image; stale refinements are cancelled and resize updates the settled resolution.

Direct software-renderer output was generated from the actual shipped illustration and current public atlas data, then inspected. Temporary PNGs and reproduction script are in `.local-validation/world-globe-qa/`; these are **direct renderer output, not native browser screenshots**. A local measurement gave 495ms cold texture construction, 222–233ms for a settled 768-pixel software sphere, and 45ms for a 320-pixel moving frame. These are one local CPU sample, not physical-device or WebGL frame-rate claims. Stable confirmations reuse the image rather than paying that cold cost repeatedly.

Native QA is still required: installed Chromium launch failed at `socket(): Operation not permitted`; the cloud browser could not reach the local QA server (`ERR_CONNECTION_REFUSED`). No bypass or stronger native claim was made. The parent's native app/CI gate must judge the actual WebGL and fallback mainland/Uncharted views, desktop/mobile sizing and rotation. The cosmetic depiction remains constrained by real public geography rather than replacing it with unrelated illustrated islands.

## RED → GREEN and final focused checks

New scale/extent/scene-ID/realm-continuation tests were observed failing before implementation. Globe regressions failed on 2.545% coverage, the old waters label, square opaque corners, a 129-channel biome-edge jump, nearest-only fallback sampling and repeated texture reconstruction before their fixes. Coordinate tests failed on the old four-column landing and missing distant-sector number. Existing privacy, phase/archive, bridges, true town positions, water/lava, navigation and actor projection coverage remains.

Final command:

```text
pnpm --filter @aurevane/web exec vitest run src/components/world/globe-atlas.test.ts src/components/world/globe-fallback.test.ts src/components/world/globe-veil.test.ts src/components/world/globe-ferry.test.ts src/components/world/world-globe.test.tsx src/components/world/spherical-view.test.tsx src/components/world/world-workspace.test.tsx src/world/coordinate-label.test.ts src/server/world/uncharted-supercontinent.test.ts src/server/world/warped-continent.test.ts src/server/world/void-realms.test.ts src/server/world/world-service.test.ts
```

Actual result: **12 files passed; 119 tests passed; 48.43s**. `pnpm --filter @aurevane/web exec tsc --noEmit` passes after the shared worktree's restored art provenance files. Changed-file application ESLint (`pnpm --filter @aurevane/web exec eslint … --max-warnings=0`), changed-file Prettier and `git diff --check` all exit0. The initial root ESLint invocation selected the root config, which intentionally ignores application files; the corrected application-scoped command performed the actual check. No tests were removed, skipped or weakened to suppress a defect. Temporary baseline imports and measurement tests were removed after producing evidence. No commit, push, database mutation or deployment was performed by this task worker.

## Subsequent Owner globe-quality review — supersedes the first globe depiction above

The parent inspected the first direct-renderer PNGs and rejected their remaining cauliflower/rubber relief, rectangular inlets and opaque purple Uncharted cloud. The next implementation replaces that depiction with two generated **ground-material-only** masters and a deterministic packed runtime atlas, retaining all server geography, legacy/private compatibility proofs and public-ring navigation above. No private authoring or story data was used to generate the art.

The corrected public mask uses a broader Gaussian field and adaptive thresholds, clipped strictly to supplied charted sectors, rather than preserving square sector centres as an unrequested visual rule. Known thin islands and the public circumnavigation land remain supported. Public coast distance supplies a fading shallow-water shelf independently of land alpha; beaches and actual public water/lava/walkable shallows remain readable. Material swatches blend continuously across regional neighbours and retain canonical regional colour exposure. The old repeated whole-world illustration luminance is removed. Coherent painted mountains and forest patches replace isotropic procedural bumps. The Uncharted cover now shows a separate generic pale/ochre dry continent beneath broken pale clouds, with no canonical private locations or identities. Its dense silhouette measures **20.493% of sphere area** in this version.

The two generated masters are **1774×887**, not 4K. The packed runtime is **2048×2048**: eight 512×512 public-biome plates above one 2048×1024 Uncharted plate. Packing modestly upsamples the masters and does not invent source resolution. Runtime bytes: **1,397,452**. Source/runtime paths, hashes, actual dimensions, exact generation prompts and regeneration command are recorded in `content/art-requests/ART-WORLD-GLOBE-MATERIALS-20261112.md` and the adjacent runtime provenance JSON. The parent accepted the new direct-renderer mainland/Uncharted PNG direction for the combined native gate; it did not grant completed native or physical-device acceptance.

Quality guards operate on actual output: broad inlet-strip alpha removal, directional range relief, earthy ground/pale cloud composition, material decoding/hash/dimension consistency, real rendered luminance detail, public-only shallow-shelf fade, unchanged exact town picking and private omission. Ruling: replace the provisional exact corner-pixel test with an area-based six-pixel coastal-strip test (>280 of360 pixels inset), because the parent accepted the actual rounded-bay shape and the feature-level guard better rejects the old straight square wall without encoding a single arbitrary curve point. Existing private negative guards remain intact.

The shader now waits for its material image before constructing/uploading the latest public surface; a RED→GREEN renderer test proves that early atlas confirmations do not build unrenderable temporary textures or drop the latest water metadata. One retained public image still handles equivalent confirmations. A direct local CPU measurement before that upload deferral recorded ~1,214ms cold material/mask/shelf construction, ~299–310ms settled 768-pixel software frames and ~57ms moving320-pixel preview. These cold/CPU figures are not WebGL frame rates or physical-mobile claims; the native release gate must assess the combined result. No additional private geometry tests were rerun merely for this visual/material iteration.

Final visual/material-focused run: `vitest run` over globe atlas/veil/materials/fallback/ferry/component/spherical input/spherical renderer/workspace/coordinate-label suites → **10 files passed, 45 tests passed, 2.34s**. Changed-file application ESLint, Prettier and diff checks pass. Fresh TypeScript reported only the separate in-progress ocean-discovery fixture's new `large`/`waterFootprint`/signature changes; no globe/material/type errors were reported. Parent owns resolving that concurrent fixture and the final whole-branch quality/native gates. Globe/material implementation is frozen for that gate. Previous 119-test private-geography/authority evidence is retained; this material iteration did not touch private geography or rerun those expensive unchanged floods.

## Legacy scene-domain integration guard

Final integration review found that the old thirteen sectors and `uncharted-expanse` extension still used individual sector IDs as their client scene domains. Consequently supplied neighbors could not share water banks/depths or other domain-keyed scene indexes. `map-scene-domain.ts` now recognizes exactly the thirteen legacy identities and strict bounded `uncharted-expanse:<0..63>:<0..47>` IDs, requires valid local scene coordinates and matching extension ID metadata, and assigns one legacy continental domain. It imports no private server authoring and constructs no geometry. Public atlas, other named Void realms, survey, sealed realm, ferry and unrecognized/future prefixes retain their isolation.

The regression used actual projected `uncharted-geodes` / `uncharted-expanse:4:2` neighbors and was observed failing for both domain equality and supplied-water continuity before the fix. Minimal supplied seam cells prove a real known bank propagates depth across the boundary, while withheld `?` cells and foreign maps cannot invent a channel, bank or depth. All thirteen server identities and inconsistent extension metadata are guarded. Final focused/adjacent result: **5 files passed; 111 tests passed; 1.55s**, covering scene domains, water, coasts, biome transitions and shallow ripples. Changed-file application ESLint and diff checks pass. Globe/material and private-authoring files remained frozen.
