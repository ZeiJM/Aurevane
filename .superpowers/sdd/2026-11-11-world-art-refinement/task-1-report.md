# Task 1 — Natural banks and private fringes

Implemented on `agent/world-art-refinement-20261111`, base `230b0870d8c237cd7c18b6c7524ad57dd9328032`. No commits or remote writes. Parent owns final freshness/integration and native evidence.

## Changes

Only the six assigned `map-coast`, `map-water`, and `map-warped-fog` source/test files were edited.

- Public coast: replaced the continuous dark nominal-raster-border face with pale inland sediment and seeded, tapered, separated dark wrack patches. Patches meet the nominal face only across their middles. Inland texture uses its own contour so the sea apron cannot push sediment/gravel outside legal ground. All public coast exports/signatures, apron, shelf fade, public overview/unknown handling and surf budgets are unchanged.
- Inland/private water: increased the bank face's visible scalloping, sampled with four cubic sections per cell. Phases use existing namespaces and world coordinates; position and tangent remain coherent at shared boundaries. Shallow control points leave the center third of a one-cell channel clear. No water/bridge/traversal authority changes.
- Private fog: twelve cached perpendicular gradient strips per exposed side produce varying fringe depths. Walkable fringes remain under .42 cell depth even at corners; exit centers remain clear. Painting stays inside the supplied cell, uses only its provided mask, and leaves the existing supplied-private-cell neighbor field unchanged.

## RED evidence

Before implementation:

`pnpm --filter @aurevane/web exec vitest run src/components/world/map-coast.test.ts src/components/world/map-water.test.ts src/components/world/map-warped-fog.test.ts`

Observed 6 failures / 22 passes: all four public sides had one continuous dark wrack face rather than separated patches; private and public pool banks were identical; private fog had only four constant-depth gradients. These were assertion failures, not setup/import errors.

## GREEN evidence

- Focused three-file suite after implementation: 28/28 passed; subsequently added budget, horizontal shared tangent, deterministic/masked fog and gravel containment guards.
- Final adjacent command: `pnpm --filter @aurevane/web exec vitest run src/components/world/map-coast.test.ts src/components/world/map-water.test.ts src/components/world/map-warped-fog.test.ts src/components/world/map-renderer.test.ts src/components/world/map-biome-transitions.test.ts src/components/world/map-settlement-edge.test.ts` — 6 files / 221 tests passed.
- Broad interim `pnpm --filter @aurevane/web exec vitest run src/components/world` — 33 files / 492 tests passed; one parent-owned in-flight RED test, `uses the decoded snowy hamlet sheet only in Frostmere and falls back while it loads` in map-renderer.test.ts:3527 (winter image not yet created). Parent confirmed this was deliberate; no parent files changed here. The final adjacent run above subsequently passed that renderer test.
- ESLint from `apps/web` on all six owned files: exit 0, no warnings. Initial root-level invocation ignored apps and emitted six ignored-file warnings; that invocation was not treated as lint evidence.
- Prettier applied only to the six owned files; `git diff --check` passes.

No old tests or thresholds were weakened. The new fog containment test allows 1e-12 arithmetic epsilon at rectangle far boundaries; centers remain strictly outside every fog-filled rectangle.

## Limits and remaining concerns

Native visual acceptance is pending. Specifically inspect ordinary-zoom coast texture breaks, private bank readability, and whether the twelve-strip fog contour appears smooth enough at actual render scale. Static terrain work remains cached; runtime surf/current budgets are unchanged. This report does not claim human or physical-handset acceptance. Parent must run final combined quality/type/build/native checks and reconcile fresh main for the completed multi-task branch.
