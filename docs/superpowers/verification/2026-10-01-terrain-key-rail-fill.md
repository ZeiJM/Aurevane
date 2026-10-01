# Terrain Key rail fill — 2026-10-01

Owner asks the Terrain Key to fill the empty rail space like the Battle Log, leaving a tiny gap above the cockpit and room for additional terrains. Base: `11f199c72d02e2b2d9b8705b7c94437611b25b52`; branch: `agent/terrain-key-rail-fill-20261001`. Existing UI-maintenance merge/deploy authorization applies.

The playable shared layout aligned the key to the start of an already allocated flexible row. Replace that alignment with stretch; make the shared desktop key a fixed-heading grid with top-aligned, bounded terrain samples. No new fixed rail height, gameplay rule, asset, dependency, migration or content activation is introduced. Mobile remains intrinsic-height.

## Rendered evidence

- Before the fix, the actual-component fixture reproduced unused rail space in 22 of 42 states (up to 241.6px at 1917×987).
- After the fix, all 42 cases passed: AI/PvP/spectator × ordinary/all-six-terrain dense states × 1917×987, 1440×900, 1366×768, 1536×614, 1024×576, 821×768 and 390×844. Desktop key bottoms match their rail bottoms within 1px, with 5.59–7.19px above the cockpit. All six current terrain kinds fit without meaningful list scrolling, no desktop page/card overflow, and opening final facing preserves board height.
- Six oversized-list probes (AI/PvP/spectator at 1440×900 and 1024×576) added sixty sample buttons to the real component DOM. The heading remains visible, the last button is keyboard-accessible through internal list scrolling, and key/board height and page containment remain unchanged. This validates capacity, not new authored terrain content.
- Durable server-backed E2E geometry assertions now require rail fill and a small cockpit gap in `battle-forecast-layout-regression.pw.ts`. Local rendered checks use real presentation components with fixture transport; authenticated execution belongs to disposable CI.
- Independent review found no blocking issue. The spectator fixture omits optional participant titles; that unchanged parent-layout edge was not exercised.

## Quality and release

Format, lint, typecheck, the fresh uncached suite (3,098 Vitest tests and seven Node checks) and fresh Production builds passed. Exact-head CI/release evidence will be recorded after completion. Normal branch deployments remain disabled.
