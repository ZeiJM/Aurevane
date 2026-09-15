# AUREVANE Sitewide Layout v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the AUREVANE layout unmistakably different across major surfaces by replacing the remaining wide/generic shell geometry with a compact, full-height game frame while preserving every real route and mechanic.

**Architecture:** Reuse the current approved page interiors and media. Concentrate the redesign in shared shell components and the few standalone shell surfaces so the change propagates broadly without duplicating page logic. Preserve server/domain code entirely.

**Tech Stack:** Next.js 16, React, TypeScript, CSS Modules, Vitest, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-15-sitewide-layout-v2-design.md`

## Global Constraints

- Keep the permanent authenticated navigation exactly `Profile -> Battle Hall -> Passive Training`.
- Keep Online Users as a surrounding shell destination, not a new permanent gameplay page.
- Do not invent Inventory, World, Shop, Guild, Quests, Mail, Friends, Dashboard, or other unavailable systems.
- Preserve all server-authoritative gameplay and state paths.
- Preserve Character Creation `01 Identity -> 02 Discipline -> 03 Confirm`, 40 starter portraits, and hidden pronoun compatibility.
- Environmental backgrounds remain scenery; character/unit art stays in identity slots.
- Desktop target is 100% browser zoom with body scrolling minimized where practical.
- Do not alter battle-grid authority, AP rules, PvP/spectator semantics, training rewards, progression, or privacy boundaries.
- Keep `apps/web/vercel.json` deployment locking restored except during the one-shot authorized production release.

---

### Task 1: Lock the new shell structure with regression tests

**Files:**
- Modify: `apps/web/src/components/shell/authenticated-shell-presentation.test.tsx`
- Modify: `apps/web/src/components/shell/game-rail.test.tsx`

**Interfaces:**
- Consumes: `AuthenticatedShellPresentationProps`, `GameRailProps`
- Produces: test contract requiring a dedicated screen-context strip while preserving the three real game destinations and active-session restrictions.

- [ ] **Step 1: Add the failing authenticated-shell assertions**

Add assertions that rendered markup contains `data-av-context-strip="true"`, the current `sessionLabel`, and selected-character identity when supplied, while still containing Online Users and omitting redundant back/navigation controls.

- [ ] **Step 2: Add the failing rail assertions**

Require every primary rail destination to expose its label through an explicit `aria-label`, allowing desktop text to be visually collapsed without losing accessibility. Preserve current route/disabled-session assertions.

- [ ] **Step 3: Run CI and confirm the new assertions fail for the missing context strip/labels**

Expected: existing tests remain green; the new structural assertions fail for the intended reason.

- [ ] **Step 4: Commit the red tests**

Commit message: `test: define compact game frame contract`

---

### Task 2: Implement the compact authenticated game frame

**Files:**
- Modify: `apps/web/src/components/shell/authenticated-shell-presentation.tsx`
- Modify: `apps/web/src/components/shell/game-rail.tsx`
- Modify: `apps/web/src/components/shell/authenticated-game-shell.module.css`
- Modify: `apps/web/src/components/public-information/public-header-rail.module.css`

**Interfaces:**
- Consumes: existing `sessionLabel`, `character`, `characterPortrait`, `activeSessionHref`, `activeSessionLabel` props.
- Produces: a shared compact desktop frame with slim masthead, narrow icon-first rail, context strip, bounded workspace, and compact online-status footer.

- [ ] **Step 1: Add a context strip below the masthead**

Render a dedicated element with `data-av-context-strip="true"`. Show the current screen label on the left. On the right, show selected-character portrait/name/level when available and the active-session return control when present.

- [ ] **Step 2: Make rail links explicitly labelled**

Add `aria-label={item.label}` to link/button variants. Keep visible `<span>` labels in the DOM for mobile and accessibility fallback.

- [ ] **Step 3: Re-grid the shell**

Desktop CSS target:
- rail width about `4.75rem`;
- masthead about `4rem`;
- context strip about `3rem`;
- footer about `2.5rem`;
- main workspace owns the remaining viewport;
- standard layouts scroll inside `.main` when needed;
- battlefield layouts keep overflow constrained so the tactical board controls sizing.

- [ ] **Step 4: Collapse desktop rail labels visually**

Keep icons centered and enlarge active/hover affordances. Labels remain visible on mobile. Keep `aria-current`, disabled states, active-session return behavior, and character accessibility intact.

- [ ] **Step 5: Tighten the shared masthead**

Update the one shared masthead authority so authenticated, public, and account surfaces use the same compact proportions and border rhythm.

- [ ] **Step 6: Run focused shell tests**

Expected: Task-1 tests pass with no weakened assertions.

- [ ] **Step 7: Commit**

Commit message: `feat: introduce compact authenticated game frame`

---

### Task 3: Bring standalone roster/public/account surfaces into the same frame language

**Files:**
- Modify: `apps/web/src/components/character/character-select-shell.module.css`
- Modify: `apps/web/src/components/public-information/public-information-shell.module.css`
- Modify: `apps/web/src/components/account/account-entry-shell.module.css`

**Interfaces:**
- Consumes: existing markup and handlers only.
- Produces: matching compact masthead, framed canvas, viewport-height desktop behavior, and denser spacing without changing account/roster/public behavior.

- [ ] **Step 1: Update Character Select desktop geometry**

Keep three slot cards and all deletion/select/create actions intact. Reduce excess hero/chrome height and let the slot grid consume the viewport.

- [ ] **Step 2: Update public information canvas geometry**

Keep News/Manual/Rules routes and article content unchanged. Use the same inset frame, masthead height, and content width rhythm as the authenticated shell.

- [ ] **Step 3: Update account gateway geometry**

Preserve sign-in/create-account behavior and security copy. Reduce desktop chrome/hero waste so account entry reads like the same product shell.

- [ ] **Step 4: Run existing account/roster/public tests through full CI**

Expected: no behavioral test changes required.

- [ ] **Step 5: Commit**

Commit message: `feat: align account roster and public shells`

---

### Task 4: Reclaim desktop viewport for the major gameplay hubs

**Files:**
- Modify: `apps/web/src/components/character/character-profile-shell.module.css`
- Modify: `apps/web/src/app/game/battle/battle-hall.module.css` if present, otherwise the existing Battle Hall CSS module discovered from current source
- Modify: `apps/web/src/components/wayfarers-practice/offline-training-shell.module.css`
- Modify: `apps/web/src/components/social/online-users-directory.module.css`

**Interfaces:**
- Consumes: existing page markup/state.
- Produces: denser desktop compositions that use the space reclaimed by the narrow rail and context strip.

- [ ] **Step 1: Profile**

Preserve the current portrait / profile sheet / combat loadout three-column composition. Reduce unnecessary minimum heights and allow the central profile/build regions to use bounded scrolling instead of elongating the document.

- [ ] **Step 2: Battle Hall**

Preserve AI Battles, Player vs Player, Spectate, and the PvP lobby modal. Use the available width for a tighter workspace and keep setup controls visible without desktop zoom-out.

- [ ] **Step 3: Passive Training**

Preserve idle, active, and completed/report states. Fit the state card and planner into the reclaimed viewport with bounded detail scrolling where needed.

- [ ] **Step 4: Online Users**

Preserve online/all directory modes, filters, sorting, public profile modal, and privacy omissions. Let roster/list content own the available height instead of expanding the whole page.

- [ ] **Step 5: Run full CI**

Expected: formatting, lint, typecheck, all tests, build, worker boot, and database foundation checks pass.

- [ ] **Step 6: Commit**

Commit message: `feat: densify primary game workspaces`

---

### Task 5: Fresh-main reconciliation, release, and smoke verification

**Files:**
- No gameplay/source file changes unless current-main reconciliation requires them.
- Temporary authorized release-only modification: `apps/web/vercel.json`, then restore the deployment lock immediately after Production is READY.

**Interfaces:**
- Produces: current-main-compatible release with verified Production alias.

- [ ] **Step 1: Compare `agent/sitewide-layout-v2` with fresh `main`**

Confirm branch is not behind or reconcile any new overlapping work before integration.

- [ ] **Step 2: Inspect every changed file**

Confirm no server/game-rule files changed and no debug/temp files remain.

- [ ] **Step 3: Require green repository CI on the final branch head**

Do not integrate on partial checks.

- [ ] **Step 4: Fast-forward/merge the verified result into current `main` without force-push**

- [ ] **Step 5: Follow the repository's one-shot Vercel production release pattern**

Temporarily allow `main` in `apps/web/vercel.json`, wait for the exact Production deployment to become `READY`, then immediately restore `"**": false`.

- [ ] **Step 6: Smoke-check Production**

Verify `https://aurevane.vercel.app` returns HTTP 200 and the Vercel project reports the intended deployment as the current Production deployment. Check recent runtime errors.
