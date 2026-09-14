# UI Shell and Passive Training Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize the authenticated shell and simplify Passive Training while preserving all game mechanics and then deploy the verified result to Vercel Production.

**Architecture:** Make shared-shell changes at the shared presentation/navigation/CSS layers so removed controls cannot reappear on individual pages. Keep Passive Training changes confined to its presentation components and CSS modules; do not touch server training services or APIs.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS Modules, Vitest, Playwright, pnpm/Turbo, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-14-ui-shell-training-cleanup.md`

## Global Constraints
- Preserve server-authoritative training, XP, timing, battle restrictions, online-directory behavior, and routes.
- Do not remove `/game/online`; only remove the redundant Adventurers rail entry.
- Do not use transform scaling, clipping, or hidden overflow merely to suppress scrolling.
- Footer shape must be consistent across authenticated desktop pages.
- Deploy only after tests and build verification pass.

---

### Task 1: Lock the shell contract with failing tests

**Files:**
- Modify: `apps/web/src/components/shell/game-rail.test.tsx`
- Create: `apps/web/src/components/shell/authenticated-shell-presentation.test.tsx`

**Interfaces:**
- Consumes: `GameRail`, `AuthenticatedShellPresentation`.
- Produces: regression coverage asserting the rail has exactly Profile/Battle Hall/Passive Training, and the shared shell contains Online Users but no back-arrow control or footer Navigation menu.

- [ ] **Step 1: Write the failing rail test**

Update the existing destination assertion to require only `/game/character`, `/game/battle`, and `/game/training`; assert `/game/online` and `Adventurers` are absent from the rail.

- [ ] **Step 2: Write the failing shared-shell test**

Render `AuthenticatedShellPresentation` with `backHref` supplied. Mock `next/link`, the world image registry, shell dependencies as needed, and assert the static markup does not contain the back-button aria label or `Navigation`, while Online Users remains present.

- [ ] **Step 3: Run the targeted tests and verify RED**

Run: `pnpm --filter @aurevane/web exec vitest run src/components/shell/game-rail.test.tsx src/components/shell/authenticated-shell-presentation.test.tsx`

Expected: FAIL because Adventurers, the back button, and footer Navigation still exist.

- [ ] **Step 4: Commit the red tests**

Commit message: `test: define streamlined authenticated shell contract`

---

### Task 2: Implement shared-shell cleanup

**Files:**
- Modify: `apps/web/src/components/shell/game-navigation.ts`
- Modify: `apps/web/src/components/shell/authenticated-shell-presentation.tsx`
- Modify: `apps/web/src/components/shell/authenticated-game-shell.module.css`
- Modify: `apps/web/src/app/desktop-page-fit.css`

**Interfaces:**
- Consumes: regression contract from Task 1.
- Produces: shared authenticated shell with no back-arrow, no footer Navigation button, a three-item primary rail, square desktop portrait, and one standardized desktop footer size.

- [ ] **Step 1: Remove the redundant rail entry**

Delete the `/game/online` Adventurers item from `gameNavigation`; leave the route and `OnlinePresenceLink` untouched.

- [ ] **Step 2: Remove shared back/footer navigation controls**

In `AuthenticatedShellPresentation`, remove the conditional back-arrow Link and remove `NavigationMenu` from the footer. Keep `OnlinePresenceLink`.

- [ ] **Step 3: Make the portrait square**

Set `.screenPortrait` desktop height to `3rem` to match its width.

- [ ] **Step 4: Standardize footer dimensions**

Use one authenticated desktop footer minimum height/padding. Remove page-specific 3rem/3.25rem overrides in `desktop-page-fit.css` that change footer size by route; preserve sticky real-grid-row behavior.

- [ ] **Step 5: Run targeted tests and verify GREEN**

Run the Task 1 Vitest command. Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `fix: streamline authenticated shell navigation`

---

### Task 3: Lock Passive Training presentation with failing tests

**Files:**
- Create: `apps/web/src/components/wayfarers-practice/offline-training-shell.test.tsx`
- Create: `apps/web/src/components/wayfarers-practice/practice-plan-card.test.tsx`

**Interfaces:**
- Consumes: `OfflineTrainingShell`, `PracticePlanCard`.
- Produces: regression coverage for retained/removed copy and reward-box semantics.

- [ ] **Step 1: Write the failing hero-copy test**

Render `OfflineTrainingShell` with minimal valid practice data and assert `Passive Training` remains while `Background progression`, `Start a timed training block`, and `Simple rule` are absent.

- [ ] **Step 2: Write the failing plan-card copy test**

Render an idle `PracticePlanCard`; assert `Choose a training duration.` remains while `Training Plan` and `Training does not start automatically` are absent. Assert Rate and Complete values still render.

- [ ] **Step 3: Run targeted tests and verify RED**

Run: `pnpm --filter @aurevane/web exec vitest run src/components/wayfarers-practice/offline-training-shell.test.tsx src/components/wayfarers-practice/practice-plan-card.test.tsx`

Expected: FAIL because the removed copy is still present.

- [ ] **Step 4: Commit the red tests**

Commit message: `test: define simplified passive training presentation`

---

### Task 4: Implement Passive Training cleanup and centering

**Files:**
- Modify: `apps/web/src/components/wayfarers-practice/offline-training-shell.tsx`
- Modify: `apps/web/src/components/wayfarers-practice/offline-training-shell.module.css`
- Modify: `apps/web/src/components/wayfarers-practice/practice-plan-card.tsx`
- Modify: `apps/web/src/components/wayfarers-practice/practice-plan-card.module.css`

**Interfaces:**
- Consumes: regression contract from Task 3.
- Produces: compact training hero, simplified plan heading, centered reward-box content, unchanged training controls/mechanics.

- [ ] **Step 1: Simplify the hero markup**

Keep the background artwork, shade, and `h1`; remove the Kicker, descriptive paragraph, and entire Simple rule element. Remove now-unused `characterName` from `OfflineTrainingShell` if it is no longer rendered and update the page call site accordingly.

- [ ] **Step 2: Collapse hero layout naturally**

Change the hero from the two-column copy/rule layout to a single-content layout and reduce its minimum height/padding enough to reclaim the removed content space while keeping the artwork/title readable.

- [ ] **Step 3: Simplify the plan heading**

Remove the `Training Plan` Kicker and idle intro paragraph. Keep the active-training panel behavior intact and keep `Choose a training duration.` plus the Idle/Training active state chip.

- [ ] **Step 4: Center reward boxes**

In `practice-plan-card.module.css`, center both the Rate/Complete labels and values within each reward box using alignment/text-align rules; do not alter reward calculations.

- [ ] **Step 5: Run targeted tests and verify GREEN**

Run the Task 3 Vitest command. Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `fix: simplify passive training layout`

---

### Task 5: Verify desktop fit and full quality gates

**Files:**
- Modify only if needed: `apps/web/src/components/wayfarers-practice/offline-training-shell.module.css`, `apps/web/src/app/desktop-page-fit.css`
- Modify/add browser test only if needed: `apps/web/e2e/desktop-page-fit.pw.ts` or a focused training-shell E2E regression.

**Interfaces:**
- Consumes: Tasks 2 and 4.
- Produces: verified desktop page fit without scale transforms or hidden content.

- [ ] **Step 1: Run focused browser/layout tests**

Run relevant existing desktop page-fit and training/browser tests in CI-capable environment.

- [ ] **Step 2: If unnecessary page scrolling remains, adjust only spacing/height**

Make the smallest CSS-only correction; do not use `transform: scale`, content clipping, or blanket `overflow: hidden`.

- [ ] **Step 3: Run full quality gates**

Run: `pnpm check`

Expected: formatting, lint, typecheck, unit tests, and build all PASS.

- [ ] **Step 4: Commit any final fit/test adjustment**

Commit message: `test: verify shell and training desktop fit`

---

### Task 6: Integrate and deploy Production

**Files:**
- No source changes expected.

**Interfaces:**
- Consumes: fully green feature branch.
- Produces: main containing the verified patch and a Vercel Production deployment for testing.

- [ ] **Step 1: Re-check main freshness**

Compare `agent/ui-shell-training-cleanup` against current `main`; reconcile without force-pushing or resetting shared history.

- [ ] **Step 2: Merge through the repository workflow**

Create/merge a PR or fast-forward through the approved GitHub workflow only after CI is green.

- [ ] **Step 3: Verify main CI/status**

Confirm the integrated commit has green required checks.

- [ ] **Step 4: Deploy Vercel Production**

Deploy the integrated production source to the existing Aurevane Vercel project with production target enabled.

- [ ] **Step 5: Report production deployment URL and commit SHA**

Include the exact deployed commit and production deployment result.
