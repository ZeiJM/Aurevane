# October 13 World nameplate clarity

Status: implemented on `agent/world-nameplate-clarity-20261013`, based on `7302f248d7591c36ec842864d897d65153396dfb`. Released for testing through PR #888, merge `bdde80f7db60b18e253e4fcdd26aabd326fca90c`, Production `dpl_GBkC3e35ePSydEVT62MAt991ouUA`, READY at `2026-10-13T19:21:56.939Z` (15:21:56 Trinidad). The later #889 release preserves this behavior. No database migration or release configuration change.

## Trigger and diagnosis

The Owner supplied a close crop showing soft Noir, Sellophina and You labels. The previous identity layer already renders at native DPR, but labels use small/fractional Georgia sizes with a7px floor, centered text and `fillText` maxWidth compression for capped names. CSS100% dimensions can also stretch the integer native backing buffer slightly within fractional grid tracks, and a fractional page origin places that bitmap between display pixels. Increasing backing density or repainting the whole scene would not address these layout/text causes.

## Resulting behavior

- Use600-weight Arial/sans-serif at rounded whole CSS sizes, with an11px minimum, and a higher-opacity teal backing; retain the self gold/peer ivory colors and thin frame.
- Snap the left glyph origin and alphabetic baseline to native device pixels. Keep normal names intact. Fit unusually long names by bounded binary-search/code-point ellipsis; never pass a maxWidth argument that squashes glyphs. Full identity names remain in Nearby/player actions.
- Size the identity CSS surface exactly to backing pixels divided by native DPR, and translate its origin to the nearest display pixel on resize/zoom. The maximum origin shift is half a display pixel. Preserve the existing absolute overlay, clipping, picking tolerance and server authority. No extra canvas, image cache or per-frame layout measurement is added.
- Keep portrait diameter proportional to terrain, scenery density capped at1.5 and the existing native identity signature/bitmap reuse. Labels deliberately keep a readability floor when zoomed out, while portraits retain their proportional size.

## Verification

Four new regression cases fail on the original source for maxWidth condensation and missing native surface scale/origin. After the fix, the focused renderer/map run passes97 cases. Expanded renderer verification passes108 cases: DPR1/2/2.625/3 × zoom35/100/140 for You, Sellophina and a long name; fractional847×750 layout/origin checks at each density; existing portrait scaling, picking, identity bitmap reuse and terrain-memory/animation tests remain.

An initial full root `pnpm check` exits0 (formatting/lint/eight-package types,5,177 Vitest plus seven Node checks, production build). Tests were subsequently expanded; the fresh frozen-source full `pnpm check` also exits0 with formatting/lint/eight-package types,5,189 Vitest plus seven Node checks and production build (web2,253). All three exact-head native workflows pass; their receipts are below. New desktop/mobile native browser cases intercept actual label draws and check readable font, no compression, device-aligned glyph/surface origins and backing/CSS scale at35/100/140%, attaching metrics and actual screenshots. Existing zoom/lock/portrait browser coverage remains.

Original-renderer native Canvas raster comparisons at35/100/140% were inspected before/after. Local Arial/Georgia are explicitly substituted by registered Nimbus Sans/DejaVu Serif fonts, so these demonstrate layout/legibility and are not browser font/compositing evidence. Local browser launch was unavailable; completed native checks establish actual CSS compositing. At35%, close packed identities can overlap existing landmark labels; this fix does not introduce a label decluttering system. Code-point ellipsis can cut a combining grapheme in unusually long Unicode names; full names remain available in Nearby.

Independent read-only review found no blocking or important issue and prompted broader density/mobile checks. Origin alignment is recomputed at resize/zoom; an unrelated position-only container move could invalidate alignment, though the fixed game layout does not routinely move the map surface.

Owner gameplay/visual acceptance remains pending. No phase closeout is implied.

## Exact-source release receipt

Tested head `50412c65e77b1bdc100a89c73545f85865bee795` and merged source have the identical tree `a07e46c1ae3b370f863418a990c6e666420ca40c`. CI `38443416707` passes, including all31 pgTAP assertions. Atlas `38443416722` passes46 enabled cases with77 project-specific skips; actual desktop/mobile draws and screenshots pass at35/100/140%. Full Responsive Browser `38443416728` passes344 Chromium cases (262 project-specific skips),10 Edge cases (2 skips), and all earlier focused suites. Early-closed development response streams appear during navigation; the suites and job exit successfully.

Compact native artifact11837968478 SHA256 `fb135f798e13b6400bd488fac0d1ee064102b2bc6be26cb91c711d9923e906fe` was verified and inspected. Synthetic100-portrait mobile p95 is15ms, frames60→240 and identity paints5→5; disposable CI peer delivery is420ms with fallback polling blocked. Neither is hosted peer timing or live100-player evidence.

Manual Production source/configuration and canonical READY alias are verified. Promotion returns409 because the deployment is already current. Signed-in checks inspect sharper You/peer names at35/100/140, then restore100%, ambient on and lock off. The identity backing/CSS dimensions are847×750 at integral page origin(204,132), replacing the stretched846.796875×749.71875 surface at(204.46875,131.8125). S69-29 E894/N320 and HP153/153,MP102/102,XP96 remain unchanged. No travel or player-directed action is used for this nameplate release.

The captured live screenshot SHA256 is `e050ddeb0d2c48da78176b4872d3845768827a3e7f87e6cb49037d89a8c2f427`; that transient file was lost when the workspace disconnected/restarted. Fresh #889 proof below preserves the released nameplates with the final compact panel. Initial deployment-scoped warning/error/fatal query is empty. No migration or configuration change; Git automatic deployments remain disabled. Human acceptance remains pending.
