# Persistent Roaming Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep AUREVANE's existing authenticated roaming shell mounted across normal game-page navigation so navigation feels faster without changing layouts, visual presentation, gameplay behavior, or server-authoritative session rules.

**Architecture:** Move only normal roaming routes into a URL-transparent Next.js route group, `app/game/(roaming)`, whose layout owns the existing `AuthenticatedShellFrame` exactly once. Character selection/creation and all Battle routes remain outside that route group so identity/session changes force fresh server state. Existing page data loaders and battle/spectator redirects remain page-owned and authoritative.

**Tech Stack:** Next.js 16 App Router, React 19 Server/Client Components, TypeScript 6, Playwright, Vitest, Supabase, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-23-persistent-roaming-shell-design.md`

## Global Constraints

- Character, Arsenal, Passive Training, Online Users, Titles/Profile, and Controls must retain their current layouts and responsive behavior.
- No existing visible shell element may be removed, restyled, resized, repositioned, or replaced.
- Existing page-specific content, controls, copy, animations, audio controls, presence UI, identity rail, footer, and navigation behavior remain functionally equivalent.
- Existing server-authoritative battle, spectator, selected-character, persistence, and authentication checks remain authoritative.
- Switching characters must force a fresh authoritative shell state.
- Entering or leaving battle/spectator state must cross out of the persistent roaming boundary and create fresh authoritative shell state on return.
- Existing `router.refresh()` behavior for title/profile-display mutations must continue to refresh shared identity presentation.
- Do not enable broad authenticated-user caching or Cache Components in this change.
- Do not change Supabase schema/data.
- Do not change battle runtime behavior.
- Production Vercel remains locked until exact-head verification is complete and the owner explicitly authorizes release.
- Start implementation from the latest `main` after the low-risk navigation pass (#618) is reconciled and landed.

## Review Focus

1. **Same-route-group navigation:** Character → Arsenal → Passive Training → Controls → Titles → Online must retain the exact same authenticated-shell DOM instance; Task 5 adds an authenticated Playwright identity test.
2. **Character switch boundary:** Account → Switch Character → Play must destroy the prior roaming shell and create a fresh one; Task 5 tests node identity before and after the boundary.
3. **Battle boundary:** entering Battle Hall/active battle must leave the roaming route group and returning to roaming must create a fresh shell; Task 5 exercises a real Recruit Sparring battle and surrender flow.
4. **Profile-display mutation:** saving a custom portrait on Titles must keep the roaming shell mounted while `router.refresh()` refreshes the header portrait; Task 5 uses a Playwright-intercepted HTTPS image.
5. **Persistence failure:** roaming-page persistence recovery must render the same recovery body exactly once inside the shared shell rather than nesting a second shell; Tasks 2 and 4 add source/unit contracts.

---

### Task 1: Reconcile and land navigation performance pass 2

**Files:**
- Existing PR: `#618`
- Existing branch: `agent/navigation-performance-pass2-20260923`
- Modified by #618:
  - `apps/web/src/app/game/character/page.tsx`
  - `apps/web/src/app/game/arsenal/page.tsx`
  - `apps/web/src/components/character/character-profile-shell.tsx`
  - `apps/web/src/components/shell/navigation-performance.test.ts`

**Interfaces:**
- Consumes: current `main`, currently ahead of the original #618 base.
- Produces: latest `main` containing the already-verified pass-2 behavior that removes the unused PV2 tester RPC and overlaps current Skill resolution with other workspace reads.

- [ ] **Step 1: Refresh refs and verify overlap before merging main**

Run:

```bash
git fetch origin
git diff --name-only 41f2c5607bccff779e3915a926e69d50ce218e5a..origin/main --   apps/web/src/app/game/character/page.tsx   apps/web/src/app/game/arsenal/page.tsx   apps/web/src/components/character/character-profile-shell.tsx   apps/web/src/components/shell/navigation-performance.test.ts
```

Expected at plan-writing time: no output. If any of the four paths now appear because `main` advanced again, stop and manually reconcile those exact files; do not overwrite newer main changes.

- [ ] **Step 2: Merge latest main into the existing pass-2 branch**

Run:

```bash
git switch agent/navigation-performance-pass2-20260923
git merge --no-edit origin/main
```

Expected: a clean merge, because none of the four pass-2 files were touched by the 44 newer main commits at plan-writing time.

- [ ] **Step 3: Re-run focused pass-2 contracts**

Run:

```bash
pnpm --filter @aurevane/web exec vitest run   src/components/shell/navigation-performance.test.ts   src/server/combat/combat-content-resolver.test.ts
```

Expected: all tests pass with zero failures.

- [ ] **Step 4: Re-run full quality gates on the reconciled exact head**

Run:

```bash
pnpm check
```

Expected: formatting, lint, typecheck, unit tests, and production build all pass.

- [ ] **Step 5: Push the reconciled branch and let PR #618 rerun**

Run:

```bash
git push origin agent/navigation-performance-pass2-20260923
```

Require exact-head success for: CI, Browser Smoke, UI Layout Review, Desktop Experience, Desktop Page Fit, Representative Buildcraft, Profile Skill Build, Attribute Allocation, Essence Build, and Resonance Build.

- [ ] **Step 6: Merge #618 only after exact-head green**

Use the repository's normal merge method and record the resulting `main` SHA. Do not deploy production solely for this merge if the persistent-shell implementation will immediately follow; keep Vercel locked.

- [ ] **Step 7: Create the implementation branch from the resulting latest main**

Run:

```bash
git switch main
git pull --ff-only origin main
git switch -c agent/persistent-roaming-shell-20260923
```

Commit: none yet; this establishes the correct base.

---

### Task 2: Split persistence-recovery content from shell ownership

**Files:**
- Modify: `apps/web/src/components/shell/authenticated-game-shell.tsx`
- Modify test: `apps/web/src/components/shell/authenticated-shell-presentation.test.tsx`

**Interfaces:**
- Consumes: existing `AuthenticatedShellFrame(props)`.
- Produces:
  - `AuthenticatedGameRecoveryContent(): JSX.Element` — recovery body only, safe inside the future shared layout.
  - `AuthenticatedGameRecovery(): JSX.Element` — existing framed behavior retained for routes outside the roaming layout.

- [ ] **Step 1: Write the failing recovery-content test**

Add to `authenticated-shell-presentation.test.tsx`:

```tsx
import {
  AuthenticatedGameRecoveryContent,
} from './authenticated-game-shell'

it('keeps persistence recovery content separable from shell ownership', () => {
  const markup = renderToStaticMarkup(<AuthenticatedGameRecoveryContent />)

  expect(markup).toContain('data-testid="persistence-recovery"')
  expect(markup).toContain('Your session is safe. The road is briefly closed.')
  expect(markup).not.toContain('data-testid="authenticated-shell"')
})
```

If the existing test file mocks dependencies needed by `authenticated-game-shell.tsx`, extend those mocks rather than weakening the assertion.

- [ ] **Step 2: Run the test to prove it fails**

Run:

```bash
pnpm --filter @aurevane/web exec vitest run   src/components/shell/authenticated-shell-presentation.test.tsx
```

Expected: FAIL because `AuthenticatedGameRecoveryContent` is not exported.

- [ ] **Step 3: Extract the body without changing markup or copy**

Change `authenticated-game-shell.tsx` to this shape:

```tsx
export function AuthenticatedGameRecoveryContent() {
  return (
    <Surface className={styles.primaryCard} tone="elevated">
      <Kicker marker="◇">Game service interruption</Kicker>
      <h1>Your session is safe. The road is briefly closed.</h1>
      <p className={styles.lead}>
        AUREVANE verified your sign-in, but it could not safely load the private account and
        character state required to continue. No character or progression state was changed.
      </p>
      <div className={styles.characterState} data-testid="persistence-recovery">
        <span>Private game state unavailable</span>
        <strong>Retry when account services are ready.</strong>
        <p>
          Retry the private-state load, or use Account to sign out. AUREVANE will not create
          partial character state to bypass the problem.
        </p>
        <form action="/game" method="get">
          <button type="submit">Retry private-state load</button>
        </form>
      </div>
    </Surface>
  )
}

export function AuthenticatedGameRecovery() {
  return (
    <AuthenticatedShellFrame sessionLabel="Service Recovery">
      <AuthenticatedGameRecoveryContent />
    </AuthenticatedShellFrame>
  )
}
```

Do not modify the existing recovery CSS or user-visible strings.

- [ ] **Step 4: Run the focused test**

Run:

```bash
pnpm --filter @aurevane/web exec vitest run   src/components/shell/authenticated-shell-presentation.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add   apps/web/src/components/shell/authenticated-game-shell.tsx   apps/web/src/components/shell/authenticated-shell-presentation.test.tsx
git commit -m "refactor: separate authenticated recovery content"
```

---

### Task 3: Add the roaming route-group architecture contract and move complete route units

**Files:**
- Create test: `apps/web/src/components/shell/persistent-roaming-shell.test.ts`
- Create: `apps/web/src/app/game/(roaming)/layout.tsx`
- Create: `apps/web/src/app/game/(roaming)/loading.tsx`
- Move directory: `apps/web/src/app/game/character` → `apps/web/src/app/game/(roaming)/character`
- Move directory: `apps/web/src/app/game/arsenal` → `apps/web/src/app/game/(roaming)/arsenal`
- Move directory: `apps/web/src/app/game/training` → `apps/web/src/app/game/(roaming)/training`
- Move directory: `apps/web/src/app/game/online` → `apps/web/src/app/game/(roaming)/online`
- Move directory: `apps/web/src/app/game/account/titles` → `apps/web/src/app/game/(roaming)/account/titles`
- Move directory: `apps/web/src/app/game/settings/controls` → `apps/web/src/app/game/(roaming)/settings/controls`
- Modify: `apps/web/src/components/shell/navigation-performance.test.ts`

**Interfaces:**
- Consumes: `AuthenticatedShellFrame({ children })`.
- Produces: URL-transparent persistent layout for the six roaming route families; public URLs remain unchanged.

- [ ] **Step 1: Write the failing route-ownership contract**

Create `persistent-roaming-shell.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const roamingPages = [
  'src/app/game/(roaming)/character/page.tsx',
  'src/app/game/(roaming)/arsenal/page.tsx',
  'src/app/game/(roaming)/training/page.tsx',
  'src/app/game/(roaming)/online/page.tsx',
  'src/app/game/(roaming)/account/titles/page.tsx',
  'src/app/game/(roaming)/settings/controls/page.tsx',
] as const

describe('persistent roaming shell architecture', () => {
  it('owns the shared shell at the roaming route-group boundary', () => {
    const layout = source('src/app/game/(roaming)/layout.tsx')
    expect(layout).toContain('AuthenticatedShellFrame')
    expect(layout).toContain('{children}')

    for (const pagePath of roamingPages) {
      expect(existsSync(resolve(process.cwd(), pagePath))).toBe(true)
    }
  })

  it('keeps identity-changing and battle routes outside the persistent boundary', () => {
    for (const path of [
      'src/app/game/page.tsx',
      'src/app/game/create',
      'src/app/game/select',
      'src/app/game/battle/page.tsx',
      'src/app/game/battle/[battleSessionId]/page.tsx',
      'src/app/game/battle/spectate/[battleKey]/page.tsx',
    ]) {
      expect(existsSync(resolve(process.cwd(), path))).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run the contract to prove it fails**

Run:

```bash
pnpm --filter @aurevane/web exec vitest run   src/components/shell/persistent-roaming-shell.test.ts
```

Expected: FAIL because `(roaming)/layout.tsx` and grouped route paths do not exist.

- [ ] **Step 3: Move complete route units with Git history preserved**

Run:

```bash
mkdir -p   'apps/web/src/app/game/(roaming)/account'   'apps/web/src/app/game/(roaming)/settings'

git mv apps/web/src/app/game/character 'apps/web/src/app/game/(roaming)/character'
git mv apps/web/src/app/game/arsenal 'apps/web/src/app/game/(roaming)/arsenal'
git mv apps/web/src/app/game/training 'apps/web/src/app/game/(roaming)/training'
git mv apps/web/src/app/game/online 'apps/web/src/app/game/(roaming)/online'
git mv apps/web/src/app/game/account/titles 'apps/web/src/app/game/(roaming)/account/titles'
git mv apps/web/src/app/game/settings/controls 'apps/web/src/app/game/(roaming)/settings/controls'
```

This deliberately moves local files together:
- Character's `page.test.ts`;
- Online Users' `online-users.module.css`;
- Controls' `page.module.css`.

Do not move `app/game/page.tsx`, `create`, `select`, or any `battle` directory.

- [ ] **Step 4: Create the persistent roaming layout**

Create `apps/web/src/app/game/(roaming)/layout.tsx`:

```tsx
import type { ReactNode } from 'react'

import { AuthenticatedShellFrame } from '@/components/shell/authenticated-game-shell'

export default function RoamingLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <AuthenticatedShellFrame>{children}</AuthenticatedShellFrame>
}
```

Do not add wrapper DOM, CSS classes, backgrounds, spacing, or sizing here.

- [ ] **Step 5: Create a zero-visual-change loading boundary**

Create `apps/web/src/app/game/(roaming)/loading.tsx`:

```tsx
export default function RoamingLoading() {
  return null
}
```

This gives the route group an explicit transition boundary without introducing a spinner, skeleton, geometry change, or new visual treatment.

- [ ] **Step 6: Update source-string tests for the new filesystem paths**

In `navigation-performance.test.ts`, change only the source paths used to inspect Character and Arsenal:

```ts
for (const path of [
  'src/app/game/(roaming)/character/page.tsx',
  'src/app/game/(roaming)/arsenal/page.tsx',
]) {
  const page = source(path)
  // existing expectations stay unchanged
}
```

Then scan for any other path-sensitive source contracts:

```bash
git grep -n -E   'src/app/game/(character|arsenal|training|online|account/titles|settings/controls)'   -- apps/web packages
```

Update only references that represent repository filesystem paths. Do not change public URL strings such as `/game/character`.

- [ ] **Step 7: Run route/type generation immediately**

Run:

```bash
pnpm --filter @aurevane/web typecheck
```

Expected: PASS; typed public routes remain `/game/character`, `/game/arsenal`, `/game/training`, `/game/online`, `/game/account/titles`, and `/game/settings/controls`.

- [ ] **Step 8: Commit**

Run:

```bash
git add apps/web/src/app/game apps/web/src/components/shell
git commit -m "refactor: group roaming routes under persistent shell"
```

The architecture contract may still fail at this point because page-level shell wrappers have not yet been removed; Task 4 owns that behavior.

---

### Task 4: Remove nested shell ownership while preserving page markup and recovery behavior

**Files:**
- Modify: `apps/web/src/components/character/character-profile-shell.tsx`
- Modify: `apps/web/src/components/character/character-arsenal-shell.tsx`
- Modify: `apps/web/src/components/wayfarers-practice/offline-training-shell.tsx`
- Modify moved page: `apps/web/src/app/game/(roaming)/online/page.tsx`
- Modify moved page: `apps/web/src/app/game/(roaming)/account/titles/page.tsx`
- Modify moved page: `apps/web/src/app/game/(roaming)/settings/controls/page.tsx`
- Modify moved page: `apps/web/src/app/game/(roaming)/character/page.tsx`
- Modify moved page: `apps/web/src/app/game/(roaming)/arsenal/page.tsx`
- Modify moved page: `apps/web/src/app/game/(roaming)/training/page.tsx`
- Modify test: `apps/web/src/components/shell/persistent-roaming-shell.test.ts`

**Interfaces:**
- Consumes: the route-group `AuthenticatedShellFrame` from Task 3 and `AuthenticatedGameRecoveryContent` from Task 2.
- Produces: page/body components with identical internal markup but no second authenticated shell.

- [ ] **Step 1: Tighten the architecture contract before implementation**

Extend `persistent-roaming-shell.test.ts`:

```ts
it('does not re-wrap roaming page bodies in another authenticated shell', () => {
  for (const pagePath of roamingPages) {
    const page = source(pagePath)
    expect(page).not.toContain('<AuthenticatedShellFrame')
  }

  for (const componentPath of [
    'src/components/character/character-profile-shell.tsx',
    'src/components/character/character-arsenal-shell.tsx',
    'src/components/wayfarers-practice/offline-training-shell.tsx',
  ]) {
    const component = source(componentPath)
    expect(component).not.toContain('<AuthenticatedShellFrame')
  }
})

it('uses recovery content instead of a nested recovery shell on roaming pages', () => {
  for (const pagePath of [
    'src/app/game/(roaming)/character/page.tsx',
    'src/app/game/(roaming)/arsenal/page.tsx',
    'src/app/game/(roaming)/training/page.tsx',
    'src/app/game/(roaming)/account/titles/page.tsx',
  ]) {
    const page = source(pagePath)
    expect(page).not.toContain('<AuthenticatedGameRecovery />')
  }
})
```

- [ ] **Step 2: Run the contract to prove nested ownership still fails**

Run:

```bash
pnpm --filter @aurevane/web exec vitest run   src/components/shell/persistent-roaming-shell.test.ts
```

Expected: FAIL on current nested `AuthenticatedShellFrame` usage.

- [ ] **Step 3: Remove only the outer shell from the three page-shell components**

For `CharacterProfileShell`, preserve the existing inner root exactly:

```tsx
export function CharacterProfileShell(props: CharacterWorkspaceProps) {
  // existing calculations unchanged
  return (
    <div className={styles.layout} data-profile-workspace data-character-concept="profile">
      {/* existing CharacterIdentityCard, profile Surface, and Current Path markup unchanged */}
    </div>
  )
}
```

Delete only the `AuthenticatedShellFrame` import and wrapper.

Apply the same rule to `CharacterArsenalShell`:

```tsx
export function CharacterArsenalShell(props: CharacterWorkspaceProps) {
  // existing calculations unchanged
  return (
    <div className={styles.layout} data-arsenal-workspace data-character-concept="arsenal">
      {/* existing Arsenal markup unchanged */}
    </div>
  )
}
```

Apply the same rule to `OfflineTrainingShell`:

```tsx
export function OfflineTrainingShell({
  identity,
  practicePlan,
  trainingReport,
}: OfflineTrainingShellProps) {
  return (
    <div className={styles.layout} data-training-concept="true">
      {/* existing Passive Training markup unchanged */}
    </div>
  )
}
```

Do not change CSS modules or any child markup.

- [ ] **Step 4: Remove direct shell wrappers from Online, Titles, and Controls pages**

Online page should return its existing section directly:

```tsx
return (
  <section
    className={styles.page}
    data-character-directory
    data-av-surface="ink"
    data-online-concept="true"
    data-directory-stage="true"
  >
    <OnlineUsersDirectory characters={online} />
  </section>
)
```

Titles page should return its existing `CharacterTitleSettings` directly.

Controls page should return its existing `Surface` directly.

Remove only now-unused `AuthenticatedShellFrame` imports and wrapper props; do not change page loaders or public URLs.

- [ ] **Step 5: Switch roaming persistence fallbacks to body-only recovery**

In Character, Arsenal, Training, and Titles grouped pages import:

```ts
import { AuthenticatedGameRecoveryContent } from '@/components/shell/authenticated-game-shell'
```

Replace only roaming fallbacks:

```tsx
return <AuthenticatedGameRecoveryContent />
```

Do not change `AuthenticatedGameRecovery` usages on routes outside `(roaming)`, especially Battle Hall.

- [ ] **Step 6: Run focused unit/source contracts**

Run:

```bash
pnpm --filter @aurevane/web exec vitest run   src/components/shell/persistent-roaming-shell.test.ts   src/components/shell/authenticated-shell-presentation.test.tsx   'src/app/game/(roaming)/character/page.test.ts'
```

Expected: PASS.

- [ ] **Step 7: Run formatting, lint, and typecheck before browser work**

Run:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
```

Expected: all PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add   apps/web/src/app/game   apps/web/src/components/character   apps/web/src/components/wayfarers-practice   apps/web/src/components/shell
git commit -m "perf: persist authenticated roaming shell"
```

---

### Task 5: Prove shell persistence, boundary freshness, and mutation refresh in the browser

**Files:**
- Create: `apps/web/e2e/persistent-roaming-shell.pw.ts`

**Interfaces:**
- Consumes: real authenticated local-Supabase flows from `pv1f-test-helpers.ts`.
- Produces: end-to-end regression coverage for the exact persistence/freshness contract.

- [ ] **Step 1: Write helper functions that compare actual DOM-node identity**

Start `persistent-roaming-shell.pw.ts` with:

```ts
import { Buffer } from 'node:buffer'

import { expect, test, type Page } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

async function rememberRoamingShell(page: Page, key: string) {
  await page.evaluate((memoryKey) => {
    const shell = document.querySelector('[data-testid="authenticated-shell"]')
    if (!shell) throw new Error('Authenticated shell is missing.')
    ;(window as unknown as Record<string, unknown>)[memoryKey] = shell
  }, key)
}

async function isRememberedShellCurrent(page: Page, key: string) {
  return page.evaluate(
    (memoryKey) =>
      (window as unknown as Record<string, unknown>)[memoryKey] ===
      document.querySelector('[data-testid="authenticated-shell"]'),
    key,
  )
}
```

- [ ] **Step 2: Add the roaming-persistence test**

Add:

```ts
test('normal roaming navigation preserves the authenticated shell DOM instance', async ({
  page,
}, info) => {
  test.setTimeout(180_000)
  const now = Date.now()
  const characterName = `Roamer ${now}`

  await provisionAccountAndEnterCharacter({
    page,
    email: `persistent-roaming-${info.project.name}-${now}@example.test`,
    password: 'Persistent-roaming-2026!',
    characterName,
  })

  await rememberRoamingShell(page, '__aurevaneRoamingShell')

  const rail = page.getByRole('navigation', { name: 'Primary game navigation', exact: true })

  await rail.getByRole('link', { name: 'Arsenal', exact: true }).click()
  await expect(page).toHaveURL(/\/game\/arsenal$/)
  expect(await isRememberedShellCurrent(page, '__aurevaneRoamingShell')).toBe(true)
  await expect(rail.getByRole('link', { name: 'Arsenal', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )

  await rail.getByRole('link', { name: /Passive Training/ }).click()
  await expect(page).toHaveURL(/\/game\/training$/)
  expect(await isRememberedShellCurrent(page, '__aurevaneRoamingShell')).toBe(true)

  await page.getByRole('button', { name: 'Account', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Controls & Keybinds' }).click()
  await expect(page).toHaveURL(/\/game\/settings\/controls$/)
  expect(await isRememberedShellCurrent(page, '__aurevaneRoamingShell')).toBe(true)

  await page.getByRole('button', { name: 'Account', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Titles & Profile Display' }).click()
  await expect(page).toHaveURL(/\/game\/account\/titles$/)
  expect(await isRememberedShellCurrent(page, '__aurevaneRoamingShell')).toBe(true)

  await page.getByRole('link', { name: /Online Users/ }).click()
  await expect(page).toHaveURL(/\/game\/online$/)
  expect(await isRememberedShellCurrent(page, '__aurevaneRoamingShell')).toBe(true)
})
```

- [ ] **Step 3: Add the character-switch freshness test**

Add:

```ts
test('switching characters crosses the persistent-shell boundary', async ({ page }, info) => {
  test.setTimeout(180_000)
  const now = Date.now()
  const characterName = `Boundary ${now}`

  await provisionAccountAndEnterCharacter({
    page,
    email: `persistent-switch-${info.project.name}-${now}@example.test`,
    password: 'Persistent-switch-2026!',
    characterName,
  })

  await rememberRoamingShell(page, '__beforeCharacterSwitch')

  await page.getByRole('button', { name: 'Account', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Switch Character' }).click()
  await expect(page).toHaveURL(/\/game$/)
  await expect(page.getByTestId('authenticated-shell')).toHaveCount(0)

  await page.getByRole('link', { name: `Play ${characterName}`, exact: true }).click()
  await expect(page).toHaveURL(/\/game\/character$/)
  await expect(page.getByTestId('authenticated-shell')).toBeVisible()
  expect(await isRememberedShellCurrent(page, '__beforeCharacterSwitch')).toBe(false)
})
```

- [ ] **Step 4: Add the battle-boundary freshness test**

Add a real Recruit Sparring flow:

```ts
test('battle transitions leave roaming persistence and return with fresh shell state', async ({
  page,
}, info) => {
  test.setTimeout(180_000)
  const now = Date.now()

  await provisionAccountAndEnterCharacter({
    page,
    email: `persistent-battle-${info.project.name}-${now}@example.test`,
    password: 'Persistent-battle-2026!',
    characterName: `Battler ${now}`,
  })

  await rememberRoamingShell(page, '__beforeBattle')

  await page
    .getByRole('navigation', { name: 'Primary game navigation', exact: true })
    .getByRole('link', { name: /Battle Hall/ })
    .click()
  await expect(page).toHaveURL(/\/game\/battle$/)
  expect(await isRememberedShellCurrent(page, '__beforeBattle')).toBe(false)

  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)
  await expect(page.getByTestId('authenticated-shell')).toHaveCount(0)

  await page.getByRole('button', { name: 'Surrender', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm Surrender' }).click()
  await page.getByRole('button', { name: 'Return to Battle Hall' }).click()
  await expect(page).toHaveURL(/\/game\/battle$/)

  await page
    .getByRole('navigation', { name: 'Primary game navigation', exact: true })
    .getByRole('link', { name: 'Character', exact: true })
    .click()
  await expect(page).toHaveURL(/\/game\/character$/)
  expect(await isRememberedShellCurrent(page, '__beforeBattle')).toBe(false)
})
```

- [ ] **Step 5: Add the profile-display refresh test**

Use a fake HTTPS host fulfilled entirely by Playwright so no external network is required:

```ts
test('profile display refresh updates the persistent shell without remounting it', async ({
  page,
}, info) => {
  test.setTimeout(180_000)
  const now = Date.now()
  const portraitUrl = 'https://assets.example.test/aurevane-test-portrait.png'
  const onePixelPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl7e2cAAAAASUVORK5CYII=',
    'base64',
  )

  await page.route(portraitUrl, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng }),
  )

  await provisionAccountAndEnterCharacter({
    page,
    email: `persistent-profile-${info.project.name}-${now}@example.test`,
    password: 'Persistent-profile-2026!',
    characterName: `Portrait ${now}`,
  })

  await rememberRoamingShell(page, '__beforeProfileRefresh')

  await page.getByRole('button', { name: 'Account', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Titles & Profile Display' }).click()
  await expect(page).toHaveURL(/\/game\/account\/titles$/)

  await page.getByLabel('Direct image URL').fill(portraitUrl)
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/account/profile-display') &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Save Profile Image' }).click()
  expect((await saved).status()).toBe(200)
  await expect(page.getByText('Profile image saved.', { exact: true })).toBeVisible()

  expect(await isRememberedShellCurrent(page, '__beforeProfileRefresh')).toBe(true)
  await expect(
    page
      .getByTestId('authenticated-shell')
      .locator('header .character-portrait-media')
      .first(),
  ).toHaveAttribute('src', portraitUrl)
})
```

- [ ] **Step 6: Run the new browser file against local Supabase**

Run the same disposable local-Supabase setup used by existing browser workflows, then:

```bash
pnpm --filter @aurevane/web exec playwright test   e2e/persistent-roaming-shell.pw.ts   --config=playwright.config.ts
```

Expected: all projects selected by the config pass; no page errors and all DOM-identity assertions hold.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/web/e2e/persistent-roaming-shell.pw.ts
git commit -m "test: verify persistent roaming shell boundaries"
```

---

### Task 6: Run exact-head regression verification with no visual expectation changes

**Files:**
- No product-code changes expected.
- Existing workflows and regression files remain unchanged unless they contain filesystem-path references caused by the route move.

**Interfaces:**
- Consumes: exact implementation head from Tasks 2–5.
- Produces: evidence that layout, behavior, authority, and build output remain compatible.

- [ ] **Step 1: Run the full repository quality gate**

Run:

```bash
pnpm check
```

Expected: PASS with zero formatting, lint, type, unit-test, or build failures.

- [ ] **Step 2: Run the targeted shell/navigation tests again from the exact head**

Run:

```bash
pnpm --filter @aurevane/web exec vitest run   src/components/shell/persistent-roaming-shell.test.ts   src/components/shell/navigation-performance.test.ts   src/components/shell/authenticated-shell-presentation.test.tsx   'src/app/game/(roaming)/character/page.test.ts'
```

Expected: PASS.

- [ ] **Step 3: Push and open a draft implementation PR**

Run:

```bash
git push -u origin agent/persistent-roaming-shell-20260923
```

Open a draft PR against the latest `main` with a summary that explicitly says:
- URL-transparent route grouping;
- no visual/CSS changes;
- page authority checks retained;
- Character Select/Create and Battle excluded from persistence;
- no schema changes;
- production deployment remains locked.

- [ ] **Step 4: Require all existing layout and behavior workflows without updating expected visuals**

Require exact-head success for:
- CI / Database foundation
- Browser Smoke
- UI Layout Review
- Desktop Page Fit
- Desktop Experience
- Representative Buildcraft
- Profile Skill Build
- Attribute Allocation
- Essence Build
- Resonance Build
- Battle Session DB if triggered
- any additional workflow automatically selected by the changed files

If a layout or screenshot expectation fails, investigate the implementation. Do not update expected geometry merely to make the persistent-shell refactor pass.

- [ ] **Step 5: Inspect browser artifacts for visual parity**

Compare Character, Arsenal, Training, and mobile navigation artifacts with the pre-refactor baseline. Verify:
- identical shell width/height and rail/header/footer placement;
- no duplicated shell;
- no missing world backdrop;
- no unexpected loading UI;
- no additional horizontal/vertical clipping;
- mobile dock and Online Users footer remain reachable.

- [ ] **Step 6: Verify no authority regression**

Confirm the exact-head browser/database evidence covers:
- active battle redirect from roaming pages;
- active spectator redirect from roaming pages;
- character switch boundary;
- battle boundary;
- title/profile-display refresh;
- persistence recovery body;
- sign out.

- [ ] **Step 7: Commit only if verification itself required path-only test fixes**

If route moves require updating a filesystem-path assertion, commit only those path corrections:

```bash
git add apps/web
git commit -m "test: align shell regressions with roaming route group"
```

Do not change CSS or page presentation to satisfy this task.

---

### Task 7: Preview verification and release handoff

**Files:**
- Production lock file remains `apps/web/vercel.json` with `"**": false` at the final branch head.
- No persistent preview-enable commit remains in the final PR diff.

**Interfaces:**
- Consumes: exact-head green implementation PR.
- Produces: verified release candidate; production deployment still requires explicit owner authorization.

- [ ] **Step 1: Reconcile any newer main changes before release**

Run:

```bash
git fetch origin
git merge --no-edit origin/main
```

If `main` advanced, rerun Task 6 exact-head verification. Never reset the branch to an older SHA.

- [ ] **Step 2: Build a Vercel preview without leaving production unlocked**

If Git-based previews remain disabled by `apps/web/vercel.json`, use the established temporary branch-specific preview rule only:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": {
    "deploymentEnabled": {
      "agent/persistent-roaming-shell-20260923": true,
      "**": false
    }
  }
}
```

After the preview reaches READY, restore the file to:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": {
    "deploymentEnabled": {
      "**": false
    }
  }
}
```

The restored lock must be the final branch state.

- [ ] **Step 3: Use preview only for build/public smoke**

Because Aurevane preview account services are not provisioned for authenticated gameplay, preview verification is limited to:
- successful Next/Vercel build;
- public route smoke;
- absence of unexpected runtime build errors.

Authenticated shell persistence is proven by the disposable local-Supabase Playwright workflows from Task 5/6, not by preview.

- [ ] **Step 4: Mark the PR ready only after exact-head verification**

Record:
- PR head SHA;
- latest main SHA;
- exact workflows passed;
- preview deployment ID;
- confirmation that `apps/web/vercel.json` is relocked.

- [ ] **Step 5: Stop before production unless explicitly authorized**

Do not merge/deploy production merely because the branch is green. Present the verified PR and ask the owner for release authorization.

If the owner authorizes production:
1. merge using the exact verified head;
2. enable the one-shot `main` Vercel production gate;
3. wait for the production deployment to reach READY;
4. immediately relock Vercel;
5. verify `aurevane.vercel.app`, authenticated navigation traffic, and runtime errors;
6. compare post-release Character/Arsenal/Training request behavior against the pre-release baseline.

---

## Self-review

### Spec coverage

- Persistent roaming shell: Tasks 3–4.
- No visual/layout redesign: Global Constraints + Task 6 artifact parity.
- Battle/character boundaries stay fresh: Task 3 placement + Task 5 browser tests.
- Page-level authority stays intact: Task 4 explicitly leaves loaders/redirects unchanged; Task 6 verifies.
- Recovery shell nesting avoided: Tasks 2 and 4.
- Mutation freshness: Task 5 profile-display test.
- No broad authenticated caching: Global Constraints.
- URL stability: route group design and Task 3 typecheck.
- Rollback remains schema-free: no database work in any task.
- Safe rollout/relock: Task 7.

### Placeholder scan

No TBD/TODO/implement-later placeholders remain. All code-bearing steps include exact target code or commands.

### Type consistency

- `AuthenticatedGameRecoveryContent` is created in Task 2 and consumed in Task 4.
- `RoamingLayout` consumes the existing `AuthenticatedShellFrame`.
- Public route strings remain unchanged because `(roaming)` is a route group.
- Browser tests use existing `provisionAccountAndEnterCharacter` and real public routes.

### Review Focus coverage

All five Review Focus conditions have an owning test in Task 2, Task 4, or Task 5.
