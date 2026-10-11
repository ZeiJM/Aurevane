# Facing arrow corner refinement — October 8

Owner live feedback requests a neat arrow farther into the tile corner to obscure less of the character portrait. The shared facing indicator reduces its equal top/left inset from **3px to 1px**, moving the badge 2px toward each edge. Its size, circular backing, identity color, rotation, pointer passthrough and portrait/meters remain unchanged across desktop/mobile PvE, PvP and spectator views.

Base Main: **33c7f6a23f28a49c2253278f9359138f77d3beab**. Only the shared stylesheet, existing browser geometry assertions and this verification/task evidence change. No mechanics, hosted Auth, SMTP or database changes are needed.

## Verification

- Tightened existing geometry bounds require the badge to sit within 3px of the tile corner while preserving its in-bounds, readable-size, rotation, color and pointer checks. The pre-change matrix fails that bound as expected; the updated shared CSS passes all **72 production-component targeting cases**.
- All six desktop/mobile PvE/PvP/spectator corner screenshots were visually inspected: consistent placement, less portrait overlap and no clipping at board edges. Representative [desktop](2026-10-08-facing-corner-assets/desktop.png) and [mobile](2026-10-08-facing-corner-assets/mobile.png) evidence is retained.
- Full **pnpm check** exits 0: format, lint, eight-package types, **4,401 Vitest tests + seven Node checks**, and build. Existing React prefetch fixture and PostCSS warnings remain; they are not new failures.
- Vercel Git deployment remains fully locked. The already-live combat/auth release is unchanged until the refinement's exact-head CI and explicit production release complete.

## Release boundary

All three exact-head workflows passed for b6cb99bf5663218bbe5471ff55e9b0a1dc20e072; PR #851 merged at d9fec991de40d7bf85553f6a7413d678c308fc91. Combined production deployment evidence follows the Ground/Airborne continuation. Do not confuse this verified local candidate with the previously deployed 3px inset or claim human acceptance of the refined appearance before the Owner tests it.
