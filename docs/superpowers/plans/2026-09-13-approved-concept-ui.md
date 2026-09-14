# AUREVANE Approved Concept UI Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to execute this plan in the current session.

**Goal:** Implement the approved 29-screen visual direction throughout the existing RPG for Owner review.
**Spec:** `docs/superpowers/specs/2026-09-13-approved-concept-ui.md`
**Architecture:** Keep the Next.js App Router, actual components and server handlers. Update shared design tokens/shell and each owning CSS module/semantic layout. Use registered compressed original illustrations. Do not create another game, duplicate gameplay state, or pile up additional client-injected global style patches.
**Stack:** Next.js 16, React 19, pnpm workspace, shared UI, CSS modules, Vitest, Playwright.

## Global Constraints

- The approved concepts govern presentation; current source governs real content and behavior.
- Preserve all authorization, data, handlers, routes, privacy, and game rules. No future or invented features.
- Four ordinary skill slots; pure Essence is separate, mixed Resonance is passive and separate.
- Shared battle presentation must serve AI, PvP, and spectator at desktop and mobile sizes.
- Use original art, registry IDs, WebP derivatives, meaningful alt text, keyboard focus and reduced motion.
- No production deployment. Work on `agent/approved-concept-ui` from fresh main.
- No subagents launched by workers. Only commit owned task files; never include another worker's pending changes.
- Existing legacy global overrides may be removed or scoped only when their owning layouts have a replacement; avoid brittle selectors against CSS-module hashes.

## Reference directory

`/workspace/scratch/2f9e50570cca/generated_images/` contains all approved images. Main anchor `exec-4ed85919-66d4-406d-a718-ee54ca956e38.png`. Each worker must inspect relevant images with view_image.

### Task 1: Shared shell, design system and asset registration

**Own:** `packages/ui/src/tokens.css`, `styles.css`, `primitives.css`; `apps/web/src/app/layout.tsx`, `globals.css` and existing global shell/readability CSS as necessary; `components/shell/`; shared `public-information/public-header-rail.module.css`; `media/registry.ts`; new shared UI icons/brand components as needed.

Read root AGENTS, Engineering Execution Standard, Concurrent Agent Workflow and the spec. Read current shared components before editing. Inspect profile anchor plus `exec-c5356207-d9f3-42d1-b0be-32a629716add.png` (login), `exec-8bb2410f-8f2c-4b24-b74e-0270a399682d.png` (battle).

Implement the ink header, original wind-vane emblem, clean typography, fine gold borders, teal focus/primary controls, moonstone surface tokens, and authenticated four-link left rail with active state and character identity. Preserve Account menu, battle/session links, navigation restrictions and skip link. Mobile must have usable compact navigation and no horizontal overflow. Keep the battle shell flexible; expose a semantic hook so battlefield pages can prioritize board space. Do not globally make every nested dark panel's text charcoal. Use explicit light/dark surface contracts.

Register these soon-to-be-generated assets (controller supplies files): `/media/art/concept-ui/world-v01.webp` (1536×1024); `world-mobile-v01.webp` (768×1024); `training-v01.webp` (1536×1024); `battle-hall-v01.webp` (1536×1024); `archive-v01.webp` (1536×1024); `portrait-01-v01.webp` through `portrait-04-v01.webp` (768×1152). Existing `ui.foundation.vista`, creation threshold/appearance and four starter portrait IDs must become real runtime descriptors. Add environment IDs as appropriate and document final IDs in report so later tasks consume them. Controller may report actual dimension adjustments. Master images are not runtime imports.

Verify typecheck and focused shell/media tests. Preserve existing interaction tests; update assertions that intentionally expected requested/missing media. Self-review changed surfaces/contrast. Record exact commands, limitations, asset IDs and CSS interface in task report. Commit only owned files.

### Task 2: Character headquarters and character/account flows

**Own:** `components/character/`, `components/account/character-title-settings*`, `components/settings/`, and corresponding route markup only as needed. Do not alter server actions or game core. Character roster, creation, all build modals, Atlas/mastery, attributes, profile, portrait/title and controls must adopt the approved design.

Inspect profile anchor plus concept files 02 `exec-9d79dec1-9bb3-48c5-b919-7a0ea7fe161e.png`, 03 `exec-eed6b913-acc0-4231-bb1a-fceffd8c7e89.png`, 04 `exec-996e2bca-0b15-4c48-9b16-64c904166e25.png`, 05 `exec-aafcaa4d-33a6-4651-b500-4f266f0bb6a1.png`, 06 `exec-ab919042-923d-4286-ac50-cbb99af4120e.png`, 18 `exec-162ec724-f62e-4324-8123-d8c43dc71df3.png`, 19–21 `exec-b05cbc74-23c1-4d46-8b65-147906065c23.png`, `exec-3cd0f408-7de3-49f1-a5bf-6aa06d72a770.png`, `exec-fd3d9edf-2fdd-41d9-9c02-7bffaaef55fc.png`, 22 `exec-82394a20-d69a-4585-b81d-c4f9ba3ee7d1.png`, 23 `exec-85c3623e-e980-45f4-934b-aab14a1170e8.png`.

Profile: prominent real portrait identity on left, pale center statistics with six attribute tiles and grouped vitals/offense/defense/mobility, dark build headquarters on right with actual sigils/skills and manage controls. Keep title/portrait edit, XP, cycles, allocated points and all current data. Modal/build surfaces use strong title and tab hierarchy, readable rows/cards and a persistent action area. Preserve all selection, unlock, reset, save, error, keyboard and cancellation flows. Keep real slots and privacy. Creation uses its real three steps, choices, points, summaries and validation, with artwork and responsive layouts. Roster uses actual slot/deletion/enter logic. Controls and portrait settings retain current capabilities.

Use Task 1's shared CSS variables/components/media IDs. Replace owning module layouts rather than hiding old markup beneath an unrelated mockup. Verify typecheck and focused component tests; do not add mirror tests for CSS. Supply report, screenshots if available, and commit only owned files.

### Task 3: Battle Hall, lobby, shared battlefield, spectating and results

**Own:** `components/battle/` and corresponding route layout markup if needed. Read scoped battle AGENTS first. No combat/core/server/network mutations. Inspect concepts 08–14: `exec-0d0e5ec3-b43b-4660-879a-3f468ba6b647.png`, `exec-be615832-72ec-4c81-88d3-895882ee5844.png`, `exec-1af8567d-6c11-47e6-a500-3ecbef018fb9.png`, `exec-8bb2410f-8f2c-4b24-b74e-0270a399682d.png`, `exec-95c3a65a-ff91-4310-9288-882f4f35ed06.png`, `exec-83209fb1-3991-44a8-9462-8c5144902fc4.png`, `exec-ff5210f5-bdc4-453b-9364-fd776aa6bc86.png`.

Battle Hall uses broad moonstone planning panel and dark atmospheric arena/committed-build companion area. Existing modes and exact current arena/difficulty/team/key choices are authoritative. Keep lobby ready/team/host/join mechanics. Battlefield is board-first: square cells, readable turn/AP, compact actor rails, actual selection/target states, real ordered skill slots, adjacent command controls, readable logs and results. Apply the same shared visual contract to PvE, PvP and spectator through BattlefieldPresentationBundle. Retain mobile panel toggle and all terrain/key/log behavior; never render a generated static grid over the playable grid. Art is ambient background only. Avoid extra client-injected CSS patch layers; modify shared owning modules/contracts.

Verify focused battle presentation tests, typecheck and applicable browser fixtures if possible; explicitly report verification gaps. Commit owned files and report layout/semantic interfaces.

### Task 4: Login, public information, training and adventurers

**Own:** `components/account/account-entry-shell*`, `account-access-panel*`; `components/public-information/` except shared header rail from Task 1; `components/wayfarers-practice/`; `components/social/`; corresponding page markup where necessary. No mutations/core changes.

Inspect concepts 07 `exec-5c656e99-3127-4e06-94f5-4b5d7017fe73.png`; 15–17 `exec-a29ea118-9224-493a-92c1-38154aedf9f1.png`, `exec-dac96f01-8f06-4377-85ff-d7548d618199.png`, `exec-f661fe15-5e13-467d-b4eb-9e866f77f931.png`; 24–29 `exec-c5356207-d9f3-42d1-b0be-32a629716add.png`, `exec-bbbea48e-1d59-4131-80d8-c2ec436d3923.png`, `exec-dcd34b03-4439-4adf-b146-be1d60377176.png`, `exec-1327f02d-9007-47f2-bd17-41355613e716.png`, `exec-8a9feff2-0bbc-46b4-a2d7-bdf27c7872e3.png`, `exec-dc348c14-6d5c-45f0-8b8f-adb7a175c461.png`.

Login: moonlit city hero and strong brand/story identity, readable pale login/create account panel with actual auth controls, audio and help. Public pages: readable moonstone article region, atmospheric dark frame, clear section navigation, original archive art, search/navigation where already supported. News remains empty; article template ready but no invented news. Training: atmospheric cloister art, clear real duration choices, current activity/report and earned values, no invented queue. Adventurers: readable portrait-led directory, live/all toggle, real filter/sort and online indicator; public profile reveals only currently public fields and respects disabled future actions. Preserve actual handlers, labels, content, keyboard, error/loading/empty states. Use shared tokens/assets, replace relevant module/inline styling coherently.

Verify focused tests and typecheck, provide report and commit owned files.

### Task 5: Integrated verification and review package

Controller-owned integration: inspect every screen group at desktop/mobile, run `pnpm check`, focused meaningful Playwright flows available locally, fix concrete remaining regressions through scoped follow-up tasks. Record environment limitations. Refresh main, reconcile overlap, inspect full branch diff. Collect final screenshots and concise review notes in repository docs. Obtain independent full-branch review. Commit and create reviewable branch/draft PR if authenticated write access is available; otherwise provide source patch/bundle and screenshots. No deployment.
