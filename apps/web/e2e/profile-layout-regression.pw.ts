import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

// Exercise real authentication, character creation, production CSS and existing dialogs.
// Only disposable accounts in the local Supabase instance are used.
test('profile identity, sheet and loadout remain readable without overlap', async ({
  page,
}, info) => {
  test.setTimeout(180_000)
  const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid')
  expect(['127.0.0.1', 'localhost']).toContain(api.hostname)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const suffix = `${Date.now()}${info.workerIndex}`.replace(/\d/g, (digit) =>
    String.fromCharCode(65 + Number(digit)),
  )
  const characterName = `Wayfarer ${suffix}`
  await provisionAccountAndEnterCharacter({
    page,
    email: `layout-${suffix.toLowerCase()}@example.com`,
    password: 'Disposable-layout-review-2026!',
    characterName,
  })

  const viewports =
    info.project.name === 'mobile-chromium'
      ? [
          { width: 390, height: 844 },
          { width: 320, height: 740 },
        ]
      : info.project.name === 'laptop-chromium'
        ? [
            { width: 1366, height: 768 },
            { width: 980, height: 1000 },
          ]
        : [
            { width: 1728, height: 887 },
            { width: 1440, height: 900 },
          ]

  const output = process.env.LAYOUT_REVIEW_OUTPUT
  if (output) await mkdir(output, { recursive: true })

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.goto('/game/character')
    await expect(page.getByTestId('character-profile')).toBeVisible()
    await expect(page.locator('[data-profile-loadout]')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Identity', exact: true })).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Character Overview', exact: true }),
    ).toHaveCount(0)
    await expect(page.getByTestId('current-path-coming-soon')).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'Primary game navigation' }).getByRole('link', {
        name: 'Arsenal',
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'Primary game navigation' }).getByRole('button', {
        name: 'Items',
        exact: true,
      }),
    ).toHaveCount(0)
    await expect(page.locator('[data-character-resource="hp"]')).toBeVisible()
    await expect(page.locator('[data-character-resource="mp"]')).toBeVisible()

    const shell = page.getByTestId('authenticated-shell')
    const masthead = shell.locator('header').first()
    const headerIdentity = masthead.locator('[aria-label^="Current character:"]')
    await expect(shell.locator('[data-av-context-strip]')).toHaveCount(0)
    await expect(shell.locator('[data-av-game-rail] .character-portrait-media')).toHaveCount(0)
    await expect(headerIdentity).toHaveCount(1)
    await expect(headerIdentity.locator('.character-portrait-media')).toHaveCount(1)
    await expect(headerIdentity.getByText(characterName, { exact: true })).toHaveCount(0)
    await expect(headerIdentity.getByText(/^Level /)).toHaveCount(0)
    const separatorMetrics = await headerIdentity.evaluate((element) => {
      const identity = getComputedStyle(element)
      const utility = getComputedStyle(element.parentElement!)
      return {
        identityLeft: identity.borderLeftWidth,
        identityRight: identity.borderRightWidth,
        utilityLeft: utility.borderLeftWidth,
      }
    })
    expect(separatorMetrics.identityLeft).toBe('0px')
    expect(separatorMetrics.identityRight).toBe('0px')
    expect(separatorMetrics.utilityLeft).toBe('1px')
    const accountButton = masthead.getByRole('button', { name: /Account/ })
    await expect(accountButton).toBeVisible()
    await accountButton.click()
    await expect(
      page.getByRole('menu', { name: 'Account menu' }).getByText(`Welcome back, ${characterName}.`),
    ).toBeVisible()
    await accountButton.click()

    if (viewport.width > 760) {
      const rail = shell.locator('[data-av-game-rail]')
      const railAnimation = await rail.evaluate(
        (node) => getComputedStyle(node, '::before').animationName,
      )
      expect.soft(railAnimation, 'desktop game rail has subtle aether motion').not.toBe('none')
      const railStart = await rail.evaluate((node) => getComputedStyle(node, '::before').transform)
      await page.waitForTimeout(500)
      const railAfter = await rail.evaluate((node) => getComputedStyle(node, '::before').transform)
      expect.soft(railAfter, 'game rail aether physically advances').not.toBe(railStart)
    }

    await page.evaluate(async () => {
      await document.fonts.ready
    })
    await expect
      .poll(() =>
        page
          .locator('[data-testid="character-profile"] img')
          .first()
          .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
      )
      .toBe(true)

    const metrics = await page.evaluate(() => {
      const required = (selector: string): HTMLElement => {
        const element = document.querySelector<HTMLElement>(selector)
        if (!element) throw new Error(`Missing profile element: ${selector}`)
        return element
      }
      const rect = (element: Element) => {
        const r = element.getBoundingClientRect()
        return {
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          right: r.right,
          bottom: r.bottom,
        }
      }
      const identity = required('[data-profile-identity-banner]')
      const hero = required('[data-testid="character-profile"]')
      const portrait = hero.querySelector('img')!
      const portraitFrame = portrait.parentElement?.parentElement as HTMLElement
      const heading = hero.querySelector('h1')!
      const sheet = required('[data-profile-sheet]')
      const story = required('[data-testid="current-path-coming-soon"]')
      const workspace = required('[data-profile-workspace]')
      const p = rect(portrait),
        h = rect(heading)
      return {
        identity: rect(identity),
        portrait: p,
        name: h,
        sheet: rect(sheet),
        story: rect(story),
        workspace: rect(workspace),
        overlap:
          Math.max(0, Math.min(p.right, h.right) - Math.max(p.x, h.x)) *
          Math.max(0, Math.min(p.bottom, h.bottom) - Math.max(p.y, h.y)),
        overflowX: document.documentElement.scrollWidth - window.innerWidth,
        sheetOverflowX: sheet.scrollWidth - sheet.clientWidth,
        identityOverflowY: getComputedStyle(identity).overflowY,
        sheetOverflowY: getComputedStyle(sheet).overflowY,
        sheetClientHeight: sheet.clientHeight,
        sheetScrollHeight: sheet.scrollHeight,
        portraitFrameBefore: getComputedStyle(portraitFrame, '::before').content,
        portraitFrameAfter: getComputedStyle(portraitFrame, '::after').content,
        primaryLinks: document.querySelectorAll('[aria-label="Primary game navigation"] a').length,
      }
    })
    const label = `profile-${viewport.width}x${viewport.height}`
    const screenshot = await page.screenshot({ fullPage: true })
    await info.attach(label, { body: screenshot, contentType: 'image/png' })
    if (output) {
      await writeFile(path.join(output, `${label}.png`), screenshot)
      await writeFile(path.join(output, `${label}.json`), JSON.stringify(metrics, null, 2))
    }
    expect.soft(metrics.overlap, `${label}: portrait must not cover character name`).toBe(0)
    expect.soft(metrics.overflowX, `${label}: no sideways document overflow`).toBeLessThanOrEqual(1)
    expect.soft(metrics.sheetOverflowX, `${label}: no clipped sheet`).toBeLessThanOrEqual(1)
    expect
      .soft(metrics.identity.width, `${label}: identity card keeps usable width`)
      .toBeGreaterThan(250)
    expect
      .soft(metrics.identityOverflowY, `${label}: no identity-card scrollbar`)
      .not.toMatch(/auto|scroll/)
    if (viewport.width < 1200) {
      expect
        .soft(metrics.sheetOverflowY, `${label}: stacked profile sheet keeps natural scrolling`)
        .not.toMatch(/auto|scroll/)
    }
    expect.soft(metrics.portraitFrameBefore, `${label}: no black top diamond ornament`).toBe('none')
    expect
      .soft(metrics.portraitFrameAfter, `${label}: no black bottom diamond ornament`)
      .toBe('none')
    expect.soft(metrics.primaryLinks).toBe(4)

    const intellectHeaderSpacing = await page
      .locator('[data-profile-stat-group="intellect"] > header')
      .evaluate((header) => {
        const labelElement = header.querySelector('strong')
        if (!labelElement) throw new Error('Missing Intellect Adventure Stat label.')
        const headerRect = header.getBoundingClientRect()
        const labelRect = labelElement.getBoundingClientRect()
        return {
          dividerGap: headerRect.right - labelRect.right,
          overflow: header.scrollWidth - header.clientWidth,
        }
      })
    expect
      .soft(intellectHeaderSpacing.dividerGap, `${label}: Intellect divider follows the full label`)
      .toBeGreaterThanOrEqual(8)
    expect
      .soft(intellectHeaderSpacing.overflow, `${label}: Intellect label is not clipped`)
      .toBeLessThanOrEqual(1)

    if (viewport.width >= 1200) {
      expect
        .soft(
          Math.abs(metrics.identity.bottom - metrics.sheet.bottom),
          `${label}: center panel aligns to character panel bottom`,
        )
        .toBeLessThanOrEqual(2)
      expect
        .soft(
          Math.abs(metrics.identity.bottom - metrics.story.bottom),
          `${label}: Current Path aligns to character panel bottom`,
        )
        .toBeLessThanOrEqual(2)
      expect
        .soft(metrics.sheetOverflowY, `${label}: center profile sheet owns vertical scrolling`)
        .toMatch(/auto|scroll/)
      expect
        .soft(
          metrics.sheetScrollHeight,
          `${label}: center profile sheet contains scrollable Adventure Stats`,
        )
        .toBeGreaterThan(metrics.sheetClientHeight)

      const profileSheet = page.locator('[data-profile-sheet]')
      const identityPanel = page.getByTestId('character-profile')
      const currentPath = page.getByTestId('current-path-coming-soon')
      const mainPanel = page.locator('#game-main')
      const beforeScroll = {
        identity: await identityPanel.boundingBox(),
        story: await currentPath.boundingBox(),
        mainScrollTop: await mainPanel.evaluate((element) => element.scrollTop),
      }
      await profileSheet.evaluate((element) => element.scrollTo({ top: element.scrollHeight }))
      expect(await profileSheet.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
      const afterScroll = {
        identity: await identityPanel.boundingBox(),
        story: await currentPath.boundingBox(),
        mainScrollTop: await mainPanel.evaluate((element) => element.scrollTop),
      }
      expect(afterScroll.mainScrollTop).toBe(beforeScroll.mainScrollTop)
      expect(
        Math.abs((afterScroll.identity?.y ?? 0) - (beforeScroll.identity?.y ?? 0)),
      ).toBeLessThanOrEqual(1)
      expect(
        Math.abs((afterScroll.story?.y ?? 0) - (beforeScroll.story?.y ?? 0)),
      ).toBeLessThanOrEqual(1)
      await profileSheet.evaluate((element) => element.scrollTo({ top: 0 }))

      expect
        .soft(metrics.identity.width, `${label}: no empty full-width banner`)
        .toBeLessThan(metrics.workspace.width * 0.35)
      expect
        .soft(
          Math.abs(metrics.sheet.y - metrics.identity.y),
          `${label}: sheet starts alongside identity`,
        )
        .toBeLessThanOrEqual(2)
      expect.soft(metrics.portrait.width, `${label}: readable portrait`).toBeGreaterThanOrEqual(150)
    }
    if (viewport.width <= 760) {
      expect.soft(metrics.sheet.y).toBeGreaterThanOrEqual(metrics.identity.bottom - 1)
    }

    // Profile keeps attribute management; combat build management lives on Arsenal.
    const redistribute = page
      .locator('section[aria-label="Attribute redistribution"] > button')
      .first()
    await redistribute.scrollIntoViewIfNeeded()
    await redistribute.click()
    const redistributionDialog = page.getByRole('dialog', {
      name: 'Redistribute Attributes',
      exact: true,
    })
    await expect(redistributionDialog).toBeVisible()
    await redistributionDialog.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(redistributionDialog).toHaveCount(0)

    await page.goto('/game/arsenal')
    await expect(page.locator('[data-arsenal-workspace]')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Arsenal', exact: true })).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'Primary game navigation' }).getByRole('button', {
        name: 'Items',
        exact: true,
      }),
    ).toHaveCount(0)
    await expect(page.locator('[data-arsenal-panel="items"]')).toBeVisible()
    const arsenalIdentity = page.locator('[data-profile-identity-banner]')
    const arsenalIdentityBox = await arsenalIdentity.boundingBox()
    expect(arsenalIdentityBox).not.toBeNull()
    expect(Math.abs(arsenalIdentityBox!.width - metrics.identity.width)).toBeLessThanOrEqual(2)
    expect(
      await arsenalIdentity.evaluate((element) => getComputedStyle(element).overflowY),
    ).not.toMatch(/auto|scroll/)
    const arsenalSheet = page.locator('[data-arsenal-sheet="true"]')
    await expect(arsenalSheet).toBeVisible()
    expect(
      await arsenalSheet.evaluate((element) => getComputedStyle(element).overflowY),
    ).not.toMatch(/auto|scroll/)
    const arsenalSections = page.locator('[data-arsenal-panel]')
    expect(await arsenalSections.count()).toBe(4)
    const arsenalSectionMetrics = await arsenalSections.evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect()
        const heading = node.querySelector('header')
        const headingRect = heading?.getBoundingClientRect()
        return {
          width: rect.width,
          height: rect.height,
          headingOverflow: heading ? heading.scrollWidth - heading.clientWidth : 0,
          headingBottom: headingRect?.bottom ?? 0,
        }
      }),
    )
    for (const metric of arsenalSectionMetrics) {
      expect(metric.width).toBeGreaterThan(250)
      expect(metric.height).toBeGreaterThan(110)
      expect(metric.headingOverflow).toBeLessThanOrEqual(1)
    }
    const techniqueCards = page.locator('[data-arsenal-technique-row="true"]')
    const techniqueChrome = await techniqueCards.evaluateAll((cards) =>
      cards.map((card) => {
        const style = getComputedStyle(card)
        return {
          horizontalChrome:
            Number.parseFloat(style.paddingLeft) +
            Number.parseFloat(style.paddingRight) +
            Number.parseFloat(style.borderLeftWidth) +
            Number.parseFloat(style.borderRightWidth),
          verticalChrome:
            Number.parseFloat(style.paddingTop) +
            Number.parseFloat(style.paddingBottom) +
            Number.parseFloat(style.borderTopWidth) +
            Number.parseFloat(style.borderBottomWidth),
        }
      }),
    )
    for (const metric of techniqueChrome) {
      expect(metric.horizontalChrome).toBeLessThanOrEqual(4)
      expect(metric.verticalChrome).toBeLessThanOrEqual(8)
    }

    const arsenalMedia = page.locator('[data-arsenal-media="true"]')
    expect(await arsenalMedia.count()).toBeGreaterThanOrEqual(2)
    const arsenalMetrics = await arsenalMedia.evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect()
        return { width: rect.width, height: rect.height }
      }),
    )
    for (const metric of arsenalMetrics) {
      expect(Math.abs(metric.width - metric.height)).toBeLessThanOrEqual(1)
      expect(metric.width).toBeCloseTo(56, 0)
    }
    for (const [launcher, dialogName] of [
      ['[data-testid="primary-build-panel"] > button', 'Discipline Management'],
      ['[data-testid="skill-build-panel"] > button', 'Techniques'],
    ]) {
      const button = page.locator(launcher!).first()
      await button.scrollIntoViewIfNeeded()
      await button.click()
      const dialog = page.getByRole('dialog', { name: dialogName!, exact: true })
      await expect(dialog).toBeVisible()
      await dialog.getByRole('button', { name: 'Close', exact: true }).click()
      await expect(dialog).toHaveCount(0)
    }
    if (viewport.width <= 760) {
      const online = page.locator('footer').getByRole('link', { name: /Online Users/ })
      await online.scrollIntoViewIfNeeded()
      const uncovered = await online.evaluate((element) => {
        const rect = element.getBoundingClientRect()
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
        return hit !== null && element.contains(hit)
      })
      expect.soft(uncovered, 'Online Users must remain above the fixed primary dock').toBe(true)
      if (output) {
        await writeFile(
          path.join(output, `${label}-footer.png`),
          await page.screenshot({ scale: 'css' }),
        )
      }
      if (uncovered) {
        await online.click()
        await expect(page).toHaveURL(/\/game\/online$/)
      }
    }
  }
  expect(errors).toEqual([])
})

test('a populated hybrid loadout keeps all four Techniques and management actions reachable', async ({
  page,
}, info) => {
  test.setTimeout(180_000)
  const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid')
  expect(['127.0.0.1', 'localhost']).toContain(api.hostname)
  const viewport =
    info.project.name === 'mobile-chromium'
      ? { width: 390, height: 844 }
      : info.project.name === 'laptop-chromium'
        ? { width: 980, height: 1000 }
        : { width: 1728, height: 887 }
  await page.setViewportSize(viewport)
  const characterName =
    info.project.name === 'mobile-chromium'
      ? 'Aster Dawn'
      : info.project.name === 'laptop-chromium'
        ? 'Aster Reed'
        : 'Aster Vale'
  await provisionAccountAndEnterCharacter({
    page,
    email: `populated-${info.project.name}-${Date.now()}@example.com`,
    password: 'Disposable-layout-review-2026!',
    characterName,
  })
  await page.goto('/game/arsenal')
  await expect(page.locator('[data-arsenal-workspace]')).toBeVisible()
  await page.locator('[data-testid="primary-build-panel"] > button').click()
  const management = page.getByRole('dialog', { name: 'Discipline Management', exact: true })
  await management
    .locator('label')
    .filter({ hasText: /^Proposed Secondary/ })
    .locator('select')
    .selectOption('lifebinder')
  const commitBuild = management.getByRole('button', {
    name: 'Commit Discipline changes',
    exact: true,
  })
  await expect(commitBuild).toBeEnabled()
  const buildSaved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/character/build/disciplines') &&
      response.request().method() === 'PUT',
  )
  await commitBuild.click()
  expect((await buildSaved).status()).toBe(200)
  await expect(page.getByTestId('secondary-discipline-chip')).toHaveText('Lifebinder')
  await management.getByRole('button', { name: 'Close', exact: true }).click()
  await page.locator('[data-testid="skill-build-panel"] > button').click()
  const techniques = page.getByRole('dialog', { name: 'Techniques', exact: true })
  await expect(techniques).toBeVisible()

  const squareFrames = techniques.locator('[data-av-square-media="true"]')
  expect(await squareFrames.count()).toBeGreaterThan(0)
  const frameMetrics = await squareFrames.evaluateAll((frames) =>
    frames.map((frame) => {
      const rect = frame.getBoundingClientRect()
      const image = frame.querySelector('img')
      return {
        width: rect.width,
        height: rect.height,
        fit: image ? getComputedStyle(image).objectFit : null,
      }
    }),
  )
  for (const metric of frameMetrics) {
    expect(Math.abs(metric.width - metric.height)).toBeLessThanOrEqual(1)
    if (metric.fit) expect(metric.fit).toBe('contain')
  }

  const choices = techniques
    .getByTestId('learned-skill-list')
    .locator('input[type="checkbox"]:enabled')
  expect(await choices.count()).toBeGreaterThanOrEqual(4)
  for (let index = 0; index < 4; index++) await choices.nth(index).check()
  const skillsSaved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/character/build/skills') &&
      response.request().method() === 'PUT',
  )
  await techniques.getByRole('button', { name: 'Commit Selected Techniques' }).click()
  expect((await skillsSaved).status()).toBe(200)
  await page.goto('/game/arsenal')
  await expect(page.getByTestId('secondary-discipline-chip')).toHaveText('Lifebinder')
  const loadout = page.locator('[data-arsenal-workspace]')
  await expect(
    loadout.locator('[data-arsenal-technique-row="true"][data-equipped="true"]'),
  ).toHaveCount(4)
  await expect(page.locator('[aria-labelledby="arsenal-attunement-heading"]')).toContainText(
    'Resonance',
  )
  await expect(page.getByText('Pronouns', { exact: true })).toHaveCount(0)
  const screenshot = await page.screenshot({ fullPage: true, scale: 'css' })
  const label = `profile-populated-${viewport.width}x${viewport.height}`
  await info.attach(label, { body: screenshot, contentType: 'image/png' })
  const output = process.env.LAYOUT_REVIEW_OUTPUT
  if (output) {
    await writeFile(path.join(output, `${label}.png`), screenshot)
    await writeFile(
      path.join(output, `${label}-viewport.png`),
      await page.screenshot({ scale: 'css' }),
    )
  }
  expect(
    await loadout.evaluate((element) => element.scrollWidth - element.clientWidth),
  ).toBeLessThanOrEqual(1)
  for (const selector of [
    '[data-testid="primary-build-panel"] > button',
    '[data-testid="skill-build-panel"] > button',
  ]) {
    const action = page.locator(selector)
    await action.scrollIntoViewIfNeeded()
    await action.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  }
})
