# Varied settlement extents implementation plan

> For agentic workers: implement natively in the current task branch, one verified piece of the combined update. Read the active checklist and preserve its lease.

**Goal:** Give the eight visible settlements asymmetric, unequal built-up extents while preserving their existing safe cores, navigation, saved progress and teleport geometry.

**Architecture:** Public `settlementOutskirtsOf` metadata identifies authored existing countryside districts that support a town's visible outskirts. It is separate from authoritative `townId`. Local working-yard composition and both globe rendering paths consume this metadata; no collision, safety or geography is generated in the browser.

**Tech stack:** Existing TypeScript World projection, Canvas terrain and shared globe texture; no dependency or schema change.

**Spec:** `docs/verification/2026-11-16-world-map-request-completion.md`, next piece and final combined gate; current map correction design.

## Constraints and review focus

- Existing nine-district safe cores, canonical rows/roads/buildings/landmarks, IDs, progression and immutable v4 teleport registration remain exact.
- Use only already-charted land; private worlds, sea, other realms and undiscovered names receive no metadata.
- Outskirts remain ordinary countryside for PvP and navigation. Presentation must not imply a safe-zone grant.
- Crown14, Verdant12, Emberreach10, Frostmere9, Glasswind11, Hollow Coast13, Starfall10 and Umbral12 visible districts; distinct connected shapes. The largest union stays below the existing48×36 colosseum reserved area.
- Keep existing prop separation, legal dry-ground constraints, native image density and bounded per-sector counts. Keep water/lava and coastal alpha authoritative.
- Actual normal/minimum/maximum rendered review remains required; counts alone do not establish naturalness or source resolution.

## Task 1 — public extent projection and compatibility

- [ ] Add failing coverage in `apps/web/src/world/town-extents.test.ts`: expected counts/shapes/connectivity, unchanged safe cores, public-only metadata, exact teleport rows/safety and unchanged World state.
- [ ] Add authored offset data in `apps/web/src/world/town-extents.ts`; attach metadata after existing atlas terrain generation. Never use it for town terrain generation, route selection or `isSafe`.
- [ ] Carry metadata through `WorldSector`, public atlas, compact scenery expansion and terrain cache identity. Test both normal scenes and distant minimum-zoom scenery.
- [ ] Run focused extent, compatibility, town topology, projection, teleport and recovery tests. The archived canonical digest must remain unchanged.

## Task 2 — render the extents

- [ ] Add failing composition/globe cases for outskirts with no hamlet, hidden/private metadata, prop clearance and changed texture-cache identity.
- [ ] Allow the existing bounded working-yard composer on public outskirts. Retain natural dressing and existing placement reservations; never infer new solid buildings.
- [ ] Blend restrained built-up fabric into dry globe land using a continuous public-neighbour field. Water/lava colors, supplied-land alpha and private omission remain unchanged; WebGL and fallback share the same texture.
- [ ] Add desktop/mobile native review captures across the compact Frostmere and larger asymmetric Crown outskirts and their globe. Retain unchanged saved state and zero-command assertions.

## Task 3 — verify and publish the source piece

- [ ] Run World/client/server and globe/composition coverage, types, scoped lint/format, discovery and optimized build. Exclude combat/economy/database suites from this development loop because their rules/schema are unchanged; retain final combined `pnpm check` and configured specialist/native workflows.
- [ ] Review actual diff, refresh main and branch, update the checked-in checklist and publish with the expected parent. Release the work lease at the durable safe boundary.
- [ ] Continue major-source art and representative water/coast/grounding/runtime review, then all final gates and the authorized combined release. No partial merge/deploy or old migration/cron replay.

## Execution receipt

Tasks1–2 are implemented. The extent tests failed at the old9-district result,
and the texture test failed at the old metadata-insensitive cache. Both now pass.
All1340 World/auth/adjacent cases across110files, TypeScript, scoped lint/format,
native case discovery and the optimized production build pass. Ordinary, maximum,
minimum/reduced-motion and globe captures are wired for desktop/mobile; native
execution and human/physical-handset review remain pending. The offline texture
and source hashes are recorded in the active verification file. The publication
boundary is the guarded task branch, with no partial merge/deployment.
