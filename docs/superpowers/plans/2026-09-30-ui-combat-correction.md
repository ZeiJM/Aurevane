# UI and Combat Correction Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for implementation; independent file domains may follow superpowers:dispatching-parallel-agents. Track each task and its verification.

**Goal:** Implement Nick's accepted full UI correction and refined combat concept without losing existing gameplay or authoring operations.

**Architecture:** Replace oversized page composition inside existing routes/components. Keep combat preview/commit server authority and express shared battle presentation through the existing bundle. Components own layout rather than accumulating a new global override layer.

**Tech Stack:** Node 24, pnpm 11, Next 16.3.3, React 19.2.8, TypeScript 6, CSS modules, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-30-ui-combat-correction.md`

## Global Constraints

- No dependency upgrades, production state changes or deployment.
- Preserve pinned historical battles, all parameters/effects, permissions and server authority.
- Shared PvE/PvP/spectator geometry and deliberate mobile composition.
- 1:1 crisp artwork; desktop 100% fit without scaling/clipping/tiny fonts.
- Source concepts are the visual acceptance authority; automated checks alone are insufficient.

## Review Focus

- Skill selection never commits; stale previews and repeated keys cannot issue duplicate commands.
- Empty/partial/mixed loadouts and summons retain correct command slots and current runtime state.
- Short desktop windows and all three arena widths preserve usable board/control scale.
- Long effect descriptions, logs and privileged forms stay fully accessible.
- Concurrent main changes and mode-specific interactions preserve unrelated functionality.

---

### Task 1: Shared shell, rail and viewport ownership

**Files:** shell components/CSS; non-battle shell sections of `approved-adventure.css`; shell tests.
**Interfaces:** Existing GameRail/AuthenticatedGameShell props remain compatible; no server contracts change.

- [x] Inspect existing rail/frame/identity DOM and original board proportions.
- [x] Replace orb field with slow flowing wisps; enlarge portrait near 144px; compact stats/navigation.
- [x] Remove main/rail incidental desktop scroll through actual geometry; preserve responsive reachability.
- [x] Run focused shell tests and capture rendered frame at required dimensions.

### Task 2: Account, character, Profile, Nexus and Haven compositions

**Files:** account and character components/CSS; Haven/Loadout routes and page-owned styles.
**Interfaces:** Existing service/data props/detail renderers/actions remain mounted.

- [x] Inspect concept images 01–06 and relevant labelled boards before changes.
- [x] Rebuild artwork/panel hierarchy and layouts, including larger square build artwork.
- [x] Keep creation portraits/legacy references and complete parameter/effect/reset operations.
- [ ] Verify focused tests, empty/locked/error states and visual fit.

### Task 3: World, Training, public, Settings and Master compositions

**Files:** world, wayfarers-practice, public-information, master components/CSS and matching routes.
**Interfaces:** Existing authoring/travel/training permissions and server projections unchanged.

- [x] Inspect relevant labelled original boards 07–10, 12–16, 19.
- [x] Replace old composition with referenced collection/detail/workspace geometry.
- [x] Preserve all operations and honest future-feature states; no P5 logic changes.
- [ ] Verify focused tests and actual page screenshots.

### Task 4: Arena widths

**Files:** `packages/game-core/src/combat/tactical-hall-arenas.ts`, its tests and current arena consumers as needed.
**Interfaces:** Existing arena IDs remain stable; new sessions use widths 9/12/15, seven rows.

- [x] Add regressions for dimensions, tile count, spawn bounds and historical arena resolution; observe failure.
- [x] Update arena definitions and relevant presets without modifying historical snapshots.
- [x] Run game-core arena/board/scenario tests.

### Task 5: Shared battle presentation

**Files:** battle CSS modules and presentation components; shared bundle; new focused layout components if justified.
**Interfaces:** Root `battle-experience.tsx` integrates explicit layout hooks; presentation must not own command state.

- [x] Inspect accepted image and existing battle CSS/render paths.
- [x] Implement compact cards, side log/key, target preview strip, larger portrait tokens, matching accents and full-width cockpit.
- [x] Integrate responsive/spectator shared geometry and effects/parameter inspection.
- [x] Verify existing parity/geometry/focus/summon tests and actual screenshots.

### Task 6: Combat selection, hotkeys and single-input execution

**Files:** `battle-experience.tsx`, preview selection helpers/tests, command/skill cockpit components/tests.
**Interfaces:** Existing `BattleIntent`, requestPreview and submitIntent authority remain; deterministic preview selection is informational.

- [x] Add failing tests for automatic legal unit/self/ground selection and keyboard command boundaries.
- [x] Replace duplicate command/loadout paths with ordered 4-slot cockpit, [1–9] and facing Space behavior.
- [x] Single click/WASD executes chosen intent through authoritative submission; retain Recover and summon commands.
- [ ] Verify target/area/self/empty casts, stale/busy/modals/key repeats, PvE/PvP parity and no-input/terminal boundaries.

### Task 7: Production terrain/background artwork

**Files:** media registry and versioned battle assets/provenance; terrain presentation/key.
**Interfaces:** Stable media IDs map only to existing terrain semantics.

- [x] Generate separate crisp terrain assets and backgrounds matching accepted art.
- [x] Inspect and integrate versioned assets with exact registry/provenance.
- [x] Verify media resolution and readable actual board composition.

### Task 8: Whole-branch acceptance and publication

**Files:** focused regression browser tests and verification documentation.
**Interfaces:** Exact tested tree is the PR candidate; no release trigger.

- [ ] Run focused regressions, required visual comparisons and `pnpm check`; inspect outputs.
- [x] Refresh main, reconcile overlap, inspect diff and reverify if changed.
- [x] Obtain independent whole-branch code review; resolve material findings with regression guards.
- [x] Publish non-deploying branch/PR and report exact evidence and remaining limitations.

Third-candidate local quality gate passed with 3,028 tests and production builds. Representative browser checks passed; all-subview visual acceptance and authenticated CI remain open. See the verification record for exact boundaries.

Fourth-candidate follow-up: the third published head passed seven workflows and failed six. Corrected real mobile footer/dock overlap, Hall scroll alignment/clipping and spectator pill sizing; reconciled downstream assertions with the accepted structures while retaining authoritative gameplay checks. Next.js/eslint-config-next 16.3.6 is a narrow compatible security exception under Technology Policy §5. Local production audit and the 3,028-test quality gate pass. Fresh authenticated CI and full visual acceptance remain required.

Fifth-candidate follow-up: fourth head passed nine workflows and failed four. Restored current-snapshot terrain inspection and selected-card/full-detail access, contained mobile resource meters, aligned Creation's Gender header and complete gallery with reference 13, and corrected downstream state/history assertions and footer-resize synchronization. Fresh local quality and focused browser fixtures pass. Fresh authenticated CI remains required.
