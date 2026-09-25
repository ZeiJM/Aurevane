import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { SUPERNATURAL_STORY_DEFINITION } from '@aurevane/game-core/character/supernatural-content'
import type { SupernaturalStoryState } from '@aurevane/game-core/character/supernatural-state'
import type { SupernaturalChoiceOption } from '../src/components/character/character-supernatural-choice-controls'
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
    if (viewport.width >= 1200) {
      await expect
        .poll(() =>
          page
            .locator('[data-profile-workspace]')
            .evaluate((element) =>
              getComputedStyle(element).getPropertyValue('--character-rail-height').trim(),
            ),
        )
        .not.toBe('')
    }
    await expect(page.locator('[data-profile-loadout]')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Identity', exact: true })).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Character Overview', exact: true }),
    ).toHaveCount(0)
    await expect(page.getByRole('complementary', { name: 'Current Path' })).toBeVisible()
    const primaryNavigation = page.getByRole('navigation', { name: 'Primary game navigation' })
    await expect(
      primaryNavigation.getByRole('button', { name: 'Arsenal', exact: true }),
    ).toBeDisabled()
    await expect(primaryNavigation.getByRole('link', { name: 'Nexus', exact: true })).toBeVisible()
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

      const railLinkMetrics = await rail
        .locator('[aria-label="Primary game navigation"] > :is(a, button)')
        .evaluateAll((links) =>
          links.map((link) => {
            const rect = link.getBoundingClientRect()
            const icon = link.querySelector<SVGElement>('svg')
            const iconRect = icon?.getBoundingClientRect()
            return {
              label: link.getAttribute('aria-label'),
              height: rect.height,
              iconWidth: iconRect?.width ?? 0,
            }
          }),
        )
      const railHeights = railLinkMetrics.map((item) => item.height)
      expect(Math.max(...railHeights) - Math.min(...railHeights)).toBeLessThanOrEqual(1)
      const nexusIcon = railLinkMetrics.find((item) => item.label === 'Nexus')
      const characterIcon = railLinkMetrics.find((item) => item.label === 'Character')
      expect(nexusIcon?.iconWidth ?? 0).toBeGreaterThan(characterIcon?.iconWidth ?? 0)
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
      const story = required('[aria-label="Current Path"]')
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
    expect.soft(metrics.primaryLinks).toBe(5)

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
      const profileScrollbar = await page.locator('[data-profile-sheet]').evaluate((element) => ({
        color: getComputedStyle(element).scrollbarColor,
        width: getComputedStyle(element).scrollbarWidth,
      }))
      expect(profileScrollbar.color).toContain('rgb(201, 168, 93)')
      expect(profileScrollbar.color).toContain('rgb(7, 16, 25)')
      expect(profileScrollbar.width).toBe('thin')
      expect
        .soft(
          metrics.sheetScrollHeight,
          `${label}: center profile sheet contains scrollable Adventure Stats`,
        )
        .toBeGreaterThan(metrics.sheetClientHeight)

      const profileSheet = page.locator('[data-profile-sheet]')
      const identityPanel = page.getByTestId('character-profile')
      const currentPath = page.getByRole('complementary', { name: 'Current Path' })
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

    // Profile keeps attribute management; combat build management lives on Nexus.
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

    await page.goto('/game/nexus')
    await expect(page.locator('[data-arsenal-workspace]')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Nexus', exact: true })).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'Primary game navigation' }).getByRole('button', {
        name: 'Arsenal',
        exact: true,
      }),
    ).toBeDisabled()
    await expect(page.locator('[data-arsenal-panel="power"]')).toBeVisible()
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
    const secondaryDisciplineSummary = page.locator('[data-slot="secondary"] p')
    if (await secondaryDisciplineSummary.count()) {
      expect(
        await secondaryDisciplineSummary.evaluate(
          (element) => element.scrollWidth - element.clientWidth,
        ),
      ).toBeLessThanOrEqual(1)
    }

    const techniqueCards = page.locator('[data-arsenal-technique-row="true"]')
    await expect(techniqueCards).toHaveCount(8)
    if (viewport.width >= 1200) {
      const lanes = page.locator('[data-nexus-technique-lane="true"]')
      await expect(lanes).toHaveCount(2)
      const [leftLane, rightLane] = await lanes.evaluateAll((nodes) =>
        nodes.map((node) => {
          const rect = node.getBoundingClientRect()
          return { x: rect.x, y: rect.y, right: rect.right, width: rect.width }
        }),
      )
      expect(Math.abs(leftLane!.y - rightLane!.y)).toBeLessThanOrEqual(2)
      expect(leftLane!.right).toBeLessThanOrEqual(rightLane!.x + 1)
      expect(leftLane!.width).toBeGreaterThan(250)
      expect(rightLane!.width).toBeGreaterThan(250)
    }
    const emptySlots = page.locator('[data-empty-technique-slot="true"]')
    if (await emptySlots.count()) {
      const plusOffsets = await emptySlots.evaluateAll((nodes) =>
        nodes.map((node) => {
          const rect = node.getBoundingClientRect()
          const plus = node.querySelector('span')!.getBoundingClientRect()
          return {
            x: Math.abs(rect.x + rect.width / 2 - (plus.x + plus.width / 2)),
            y: Math.abs(rect.y + rect.height / 2 - (plus.y + plus.height / 2)),
            squareDelta: Math.abs(rect.width - rect.height),
          }
        }),
      )
      for (const offset of plusOffsets) {
        expect(offset.x).toBeLessThanOrEqual(1)
        expect(offset.y).toBeLessThanOrEqual(1)
        expect(offset.squareDelta).toBeLessThanOrEqual(1)
      }
    }
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
      expect(metric.width).toBeCloseTo(64, 0)
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
  await page.goto('/game/nexus')
  await expect(page.locator('[data-arsenal-workspace]')).toBeVisible()
  await page.locator('[data-testid="primary-build-panel"] > button').click()
  const management = page.getByRole('dialog', { name: 'Discipline Management', exact: true })
  await management.getByLabel('Secondary Discipline').selectOption('lifebinder')
  const commitBuild = management.getByRole('button', { name: /Confirm Change/ })
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
  const coarseTechniquePointer = await page.evaluate(
    () => window.matchMedia('(hover: none), (pointer: coarse)').matches,
  )
  for (let index = 0; index < 4; index += 1) {
    const choice = choices.nth(index)
    if (await choice.isChecked()) continue
    const skillsSaved = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/character/build/skills') &&
        response.request().method() === 'PUT',
    )
    if (coarseTechniquePointer) {
      await choice.locator('..').dblclick()
    } else {
      await choice.check()
    }
    expect((await skillsSaved).status()).toBe(200)
  }
  await expect(techniques.getByRole('button', { name: 'Commit Selected Techniques' })).toHaveCount(
    0,
  )
  await page.goto('/game/nexus')
  await expect(page.getByTestId('secondary-discipline-chip')).toHaveText('Lifebinder')
  const loadout = page.locator('[data-arsenal-workspace]')
  const equippedOverview = loadout.locator(
    '[data-arsenal-technique-row="true"][data-equipped="true"]',
  )
  await expect(equippedOverview).toHaveCount(4)
  for (const card of await equippedOverview.all()) {
    await expect(card).not.toContainText('AP')
  }
  await expect(page.locator('[aria-labelledby="nexus-attunement-heading"]')).toContainText(
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

for (const pathChoice of [
  { path: 'ascended', label: 'Ascension', identity: 'Ascended' },
  { path: 'severed', label: 'Severence', identity: 'Severed' },
] as const) {
  test(`Profile ${pathChoice.label} requires confirmation and stays bound after reload`, async ({
    page,
  }, info) => {
    test.setTimeout(120_000)
    const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid')
    expect(['127.0.0.1', 'localhost']).toContain(api.hostname)
    const suffix = randomUUID()
      .replaceAll('-', '')
      .slice(0, 12)
      .replace(/[0-9]/g, (digit) => String.fromCharCode(65 + Number(digit)))
    const characterName = `Path ${suffix}`
    await provisionAccountAndEnterCharacter({
      page,
      email: `path-${randomUUID()}@example.com`,
      password: 'Disposable-path-review-2026!',
      characterName,
    })
    const panel = page.getByRole('complementary', { name: 'Current Path' })
    async function currentPath() {
      const response = await page.request.get('/api/character/supernatural')
      expect(response.ok()).toBe(true)
      return response.json() as Promise<{
        state: SupernaturalStoryState | null
        choices: SupernaturalChoiceOption[]
      }>
    }
    expect(await currentPath()).toEqual({ state: null, choices: [] })
    await expect(panel).toContainText('Path information is unavailable')
    await expect(panel.locator('[data-supernatural-choice]')).toHaveCount(0)

    // Disposable fixture setup only: make the existing authored threshold available.
    // Every choice below goes through the real authenticated API and private persistence.
    const container = execFileSync(
      'docker',
      ['ps', '--filter', 'name=supabase_db_', '--format', '{{.Names}}'],
      { encoding: 'utf8' },
    )
      .trim()
      .split('\n')[0]
    if (!container) throw new Error('Disposable local database is unavailable.')
    expect(characterName).toMatch(/^Path [a-zA-Z]+$/)
    const story = SUPERNATURAL_STORY_DEFINITION
    execFileSync('docker', [
      'exec',
      container,
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-Atqc',
      `select public.initialize_character_supernatural_story_state_v1(c.user_id,c.id,'${story.id}',${story.contentVersion},'${story.initialNodeId}') from public.characters c where c.name='${characterName}';`,
    ])
    await page.reload()
    await expect(panel.getByRole('heading', { name: 'Unawakened', exact: true })).toBeVisible()
    const available = await currentPath()
    expect(available.state?.path).toBe('unawakened')
    expect(available.choices).toHaveLength(2)
    const choice = available.choices.find((option) => option.path === pathChoice.path)!
    const other = available.choices.find((option) => option.path !== pathChoice.path)!
    const command = {
      expectedStateVersion: available.state!.stateVersion,
      idempotencyKey: randomUUID(),
      transitionId: choice.transitionId,
      transitionContentVersion: choice.transitionContentVersion,
      confirmPermanentChoice: true,
    }
    const unconfirmed = await page.request.put('/api/character/supernatural', {
      data: { ...command, confirmPermanentChoice: false },
    })
    expect(unconfirmed.status()).toBe(400)
    expect((await unconfirmed.json()).error.code).toBe('INVALID_REQUEST')
    const unapproved = await page.request.put('/api/character/supernatural', {
      data: { ...command, transitionId: 'not.an.authored.transition' },
    })
    expect(unapproved.status()).toBe(400)
    expect((await unapproved.json()).error.code).toBe('INVALID_REQUEST')
    expect(await currentPath()).toEqual(available)

    let writes = 0
    page.on('request', (request) => {
      if (request.method() === 'PUT' && request.url().endsWith('/api/character/supernatural'))
        writes++
    })
    const choose = panel.getByRole('button', { name: `Choose ${pathChoice.label}`, exact: true })
    await choose.focus()
    await choose.press('Enter')
    await expect(panel).toContainText('Your path persists through Rekindling')
    expect(writes).toBe(0)
    await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
    expect(writes).toBe(0)
    expect(await currentPath()).toEqual(available)
    await choose.click()
    const output = process.env.LAYOUT_REVIEW_OUTPUT
    if (output) {
      await mkdir(output, { recursive: true })
      await page.screenshot({
        path: path.join(output, `profile-path-confirm-${pathChoice.path}-${info.project.name}.png`),
        fullPage: true,
      })
    }
    const [request, response] = await Promise.all([
      page.waitForRequest(
        (request) =>
          request.method() === 'PUT' && request.url().endsWith('/api/character/supernatural'),
      ),
      page.waitForResponse(
        (response) =>
          response.request().method() === 'PUT' &&
          response.url().endsWith('/api/character/supernatural'),
      ),
      panel.getByRole('button', { name: `Confirm ${pathChoice.label}`, exact: true }).click(),
    ])
    expect(response.ok()).toBe(true)
    expect(writes).toBe(1)
    await expect(
      panel.getByRole('heading', { name: pathChoice.identity, exact: true }),
    ).toBeVisible()
    await expect(panel.locator('[data-supernatural-choice]')).toHaveCount(0)
    const bound = await currentPath()
    expect(bound.state?.path).toBe(pathChoice.path)
    expect(bound.state?.stateVersion).toBe(available.state!.stateVersion + 1)
    expect(bound.choices).toEqual([])
    await page.reload()
    await expect(
      panel.getByRole('heading', { name: pathChoice.identity, exact: true }),
    ).toBeVisible()
    expect(await currentPath()).toEqual(bound)
    // Stale retries and a forged opposite choice cannot switch the committed path.
    const replay = await page.request.put('/api/character/supernatural', {
      data: request.postDataJSON(),
    })
    expect(replay.status()).toBe(409)
    expect((await replay.json()).error.code).toBe('STALE_VERSION')
    const switched = await page.request.put('/api/character/supernatural', {
      data: {
        ...command,
        expectedStateVersion: bound.state!.stateVersion,
        idempotencyKey: randomUUID(),
        transitionId: other.transitionId,
        transitionContentVersion: other.transitionContentVersion,
      },
    })
    expect(switched.status()).toBe(400)
    expect((await switched.json()).error.code).toBe('INVALID_REQUEST')
    expect(await currentPath()).toEqual(bound)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    )
    if (output)
      await page.screenshot({
        path: path.join(output, `profile-path-bound-${pathChoice.path}-${info.project.name}.png`),
        fullPage: true,
      })
  })
}
