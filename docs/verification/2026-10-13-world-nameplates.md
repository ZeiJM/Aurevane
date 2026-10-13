# October 13 World nameplate clarity

Status: implemented on `agent/world-nameplate-clarity-20261013`, based on `7302f248d7591c36ec842864d897d65153396dfb`. Not live; Production remains #886 / `dpl_GPybRk7WcPjTQ38QEvAVSjDSuQi5`. No database migration or release configuration change.

## Trigger and diagnosis

The Owner supplied a close crop showing soft Noir, Sellophina and You labels. The previous identity layer already renders at native DPR, but labels use small/fractional Georgia sizes with a7px floor, centered text and `fillText` maxWidth compression for capped names. CSS100% dimensions can also stretch the integer native backing buffer slightly within fractional grid tracks, and a fractional page origin places that bitmap between display pixels. Increasing backing density or repainting the whole scene would not address these layout/text causes.

## Resulting behavior

- Use600-weight Arial/sans-serif at rounded whole CSS sizes, with an11px minimum, and a higher-opacity teal backing; retain the self gold/peer ivory colors and thin frame.
- Snap the left glyph origin and alphabetic baseline to native device pixels. Keep normal names intact. Fit unusually long names by bounded binary-search/code-point ellipsis; never pass a maxWidth argument that squashes glyphs. Full identity names remain in Nearby/player actions.
- Size the identity CSS surface exactly to backing pixels divided by native DPR, and translate its origin to the nearest display pixel on resize/zoom. The maximum origin shift is half a display pixel. Preserve the existing absolute overlay, clipping, picking tolerance and server authority. No extra canvas, image cache or per-frame layout measurement is added.
- Keep portrait diameter proportional to terrain, scenery density capped at1.5 and the existing native identity signature/bitmap reuse. Labels deliberately keep a readability floor when zoomed out, while portraits retain their proportional size.

## Verification

Four new regression cases fail on the original source for maxWidth condensation and missing native surface scale/origin. After the fix, the focused renderer/map run passes97 cases. Expanded renderer verification passes108 cases: DPR1/2/2.625/3 × zoom35/100/140 for You, Sellophina and a long name; fractional847×750 layout/origin checks at each density; existing portrait scaling, picking, identity bitmap reuse and terrain-memory/animation tests remain.

An initial full root `pnpm check` exits0 (formatting/lint/eight-package types,5,177 Vitest plus seven Node checks, production build). Tests were subsequently expanded; the fresh frozen-source full `pnpm check` also exits0 with formatting/lint/eight-package types,5,189 Vitest plus seven Node checks and production build (web2,253). Exact-head native CI, Living Atlas and full Responsive Browser smoke remain required before release. New desktop/mobile native browser cases intercept actual label draws and check readable font, no compression, device-aligned glyph/surface origins and backing/CSS scale at35/100/140%, attaching metrics and actual screenshots. Existing zoom/lock/portrait browser coverage remains.

Original-renderer native Canvas raster comparisons at35/100/140% were inspected before/after. Local Arial/Georgia are explicitly substituted by registered Nimbus Sans/DejaVu Serif fonts, so these demonstrate layout/legibility and are not browser font/compositing evidence. Local browser launch is unavailable; native checks must establish actual CSS compositing. At35%, close packed identities can overlap existing landmark labels; this fix does not introduce a label decluttering system. Code-point ellipsis can cut a combining grapheme in unusually long Unicode names; full names remain available in Nearby.

Independent read-only review found no blocking or important issue and prompted broader density/mobile checks. Origin alignment is recomputed at resize/zoom; an unrelated position-only container move could invalidate alignment, though the fixed game layout does not routinely move the map surface.

Owner gameplay/visual acceptance remains pending. No phase closeout is implied.
