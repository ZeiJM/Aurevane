import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getTacticalHallRecord } from '@aurevane/game-core/combat/tactical-hall-records'
import { expect, test, type Page, type TestInfo } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

async function enterHall(page: Page, testInfo: TestInfo, suffix: string) {
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname
  if (!['localhost', '127.0.0.1'].includes(host)) {
    throw new Error('Hall review requires disposable local Supabase.')
  }
  const mobile = testInfo.project.name === 'mobile-chromium'
  await page.setViewportSize({
    width: mobile ? 390 : testInfo.project.name === 'laptop-chromium' ? 1366 : 1728,
    height: mobile ? 844 : testInfo.project.name === 'laptop-chromium' ? 768 : 887,
  })
  // Names are globally unique, including across the other layout review suites.
  const nameSuffix = `${Date.now()}`
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  await provisionAccountAndEnterCharacter({
    page,
    email: `hall-${suffix}-${testInfo.project.name}-${Date.now()}@example.test`,
    password: 'Disposable-hall-review-2026!',
    characterName: `${suffix === 'lobby' ? 'Mira' : 'Arin'} ${nameSuffix}`,
  })
  await page.goto('/game/battle')
  await expect(page.getByRole('heading', { name: 'Battle Hall', exact: true })).toBeVisible()
  return mobile
}

async function capture(page: Page, testInfo: TestInfo, state: string) {
  if (testInfo.project.name !== 'mobile-chromium' && state !== 'lobby' && state !== 'unseated') {
    const actions = await page.locator('[data-hall-workspace] button').evaluateAll((buttons) =>
      buttons
        .filter((button) => button.getClientRects().length > 0)
        .filter((button) =>
          ['Enter Battle', 'Create Battle Lobby', 'Join Battle Lobby', 'Spectate Battle'].includes(
            button.textContent?.trim() ?? '',
          ),
        )
        .map((button) => {
          const rect = button.getBoundingClientRect()
          const panel = button.closest('[data-hall-workspace]')!.getBoundingClientRect()
          return {
            label: button.textContent,
            inView: rect.y >= panel.y && rect.bottom <= Math.min(panel.bottom, innerHeight),
          }
        }),
    )
    for (const action of actions) {
      expect
        .soft(action.inView, `${state}: ${action.label} stays inside the visible workspace`)
        .toBe(true)
    }
  }
  const output = process.env.LAYOUT_REVIEW_OUTPUT
  if (!output) return
  await page.evaluate(() => {
    window.scrollTo(0, 0)
    document.getElementById('game-main')?.scrollTo(0, 0)
    for (const panel of document.querySelectorAll('[data-hall-workspace]')) panel.scrollTo(0, 0)
  })
  await mkdir(output, { recursive: true })
  await page.screenshot({
    path: path.join(output, `hall-${state}-${testInfo.project.name}.png`),
    fullPage: true,
  })
  await page.screenshot({
    path: path.join(output, `hall-${state}-${testInfo.project.name}-viewport.png`),
  })
}

async function captureDesktopHallGeometry(
  page: Page,
  testInfo: TestInfo,
  mode: 'ai' | 'spectate',
  state: string,
) {
  const metrics = await page.locator(`[data-hall-workspace="${mode}"]`).evaluate((element) => {
    const body = element.querySelector('[data-hall-scroll-body]')!
    const workspace = element.getBoundingClientRect()
    const bodyRect = body.getBoundingClientRect()
    const main = document.getElementById('game-main')!
    const mainRect = main.getBoundingClientRect()
    const hall = element.closest('[data-hall-concept]')!
    const heading = hall.querySelector('[data-hall-scene]')!
    const modeRail = hall.querySelector('[data-hall-mode-rail]')!
    const rect = (node: Element) => {
      const bounds = node.getBoundingClientRect()
      return {
        top: bounds.top,
        bottom: bounds.bottom,
        height: bounds.height,
        center: (bounds.left + bounds.right) / 2,
      }
    }
    const scrolling = [document.documentElement, document.body, main, hall, element, body].map(
      (node) => ({
        name: node.id || node.getAttribute('data-hall-workspace') || node.tagName,
        overflowY: node.scrollHeight - node.clientHeight,
        overflowX: node.scrollWidth - node.clientWidth,
        scrollTop: node.scrollTop,
        scrollLeft: node.scrollLeft,
      }),
    )
    const controls = [...element.querySelectorAll('button, input, select')]
      .filter((node) => node.getClientRects().length > 0 && getComputedStyle(node).opacity !== '0')
      .map((node) => {
        const bounds = node.getBoundingClientRect()
        return {
          label: node.getAttribute('aria-label') || node.textContent?.trim(),
          height: bounds.height,
          contained:
            bounds.top >= Math.max(workspace.top, mainRect.top, 0) &&
            bounds.bottom <= Math.min(workspace.bottom, mainRect.bottom, innerHeight) &&
            bounds.left >= workspace.left &&
            bounds.right <= workspace.right,
        }
      })
    const arena = element
      .querySelector('[aria-label="AI sparring arena"]')
      ?.closest('label')?.parentElement
    const modes = element.querySelector('[aria-label="AI arenas"]')
    const purpose = element.querySelector('#ai-record-purpose')
    const footer = element.querySelector('footer')!
    const note = element.querySelector('aside')
    const vista = element.querySelector('figure')
    return {
      viewport: { width: innerWidth, height: innerHeight },
      heading: rect(heading),
      modeRail: rect(modeRail),
      scrolling,
      controls,
      ai:
        arena && modes && purpose
          ? {
              arena: rect(arena),
              modes: rect(modes),
              purpose: rect(purpose),
              action: rect(footer),
              workspaceTop: workspace.top,
              categoryBottom: modeRail.getBoundingClientRect().bottom,
              categoryGap: parseFloat(getComputedStyle(hall).rowGap),
              rightColumnCenter:
                (modes.getBoundingClientRect().right +
                  parseFloat(getComputedStyle(body).columnGap) +
                  bodyRect.right) /
                2,
            }
          : null,
      spectate:
        note && vista
          ? {
              vista: rect(vista),
              note: rect(note),
              noteFontSize: parseFloat(getComputedStyle(note.querySelector('p')!).fontSize),
              contained:
                note.getBoundingClientRect().bottom <=
                Math.min(workspace.bottom, mainRect.bottom, innerHeight),
              bodyOverflow: getComputedStyle(body).overflowY,
            }
          : null,
    }
  })
  const name = `hall-${state}-${metrics.viewport.width}x${metrics.viewport.height}-${testInfo.project.name}`
  const output = process.env.LAYOUT_REVIEW_OUTPUT ?? testInfo.outputPath('hall-geometry')
  await mkdir(output, { recursive: true })
  await writeFile(path.join(output, `${name}.json`), JSON.stringify(metrics, null, 2))
  await page.screenshot({ path: path.join(output, `${name}.png`) })
  // Record the rendered state before asserting, so failed fits retain their evidence.
  for (const scrolling of metrics.scrolling) {
    expect
      .soft(scrolling.overflowY, `${name}: ${scrolling.name} vertical overflow`)
      .toBeLessThanOrEqual(1)
    expect
      .soft(scrolling.overflowX, `${name}: ${scrolling.name} horizontal overflow`)
      .toBeLessThanOrEqual(1)
    expect.soft(scrolling.scrollTop, `${name}: ${scrolling.name} scroll position`).toBe(0)
    expect
      .soft(scrolling.scrollLeft, `${name}: ${scrolling.name} horizontal scroll position`)
      .toBe(0)
  }
  for (const control of metrics.controls) {
    expect
      .soft(control.height, `${name}: ${control.label} remains usable`)
      .toBeGreaterThanOrEqual(44)
    expect.soft(control.contained, `${name}: ${control.label} is fully visible`).toBe(true)
  }
  if (metrics.ai) {
    expect
      .soft(
        Math.abs(metrics.ai.workspaceTop - metrics.ai.categoryBottom - metrics.ai.categoryGap),
        `${name}: AI workspace starts directly below the category tabs`,
      )
      .toBeLessThanOrEqual(1)
    expect
      .soft(
        Math.abs(metrics.ai.arena.top - metrics.ai.modes.top),
        `${name}: Arena starts beside the first mode`,
      )
      .toBeLessThanOrEqual(4)
    for (const [name, bounds] of Object.entries({
      arena: metrics.ai.arena,
      purpose: metrics.ai.purpose,
      action: metrics.ai.action,
    })) {
      expect
        .soft(
          Math.abs(bounds.center - metrics.ai.rightColumnCenter),
          `${state}: ${name} is centered in the right column`,
        )
        .toBeLessThanOrEqual(2)
    }
    expect
      .soft(
        metrics.ai.action.top - metrics.ai.purpose.bottom,
        `${name}: Enter Battle follows its description`,
      )
      .toBeLessThanOrEqual(24)
  }
  if (metrics.spectate) {
    expect.soft(metrics.spectate.contained, `${name}: full access note is visible`).toBe(true)
    expect
      .soft(metrics.spectate.noteFontSize, `${name}: access note stays readable`)
      .toBeGreaterThanOrEqual(14)
    expect
      .soft(metrics.spectate.vista.height, `${name}: banner leaves room for real controls`)
      .toBeLessThanOrEqual(128)
    expect.soft(metrics.spectate.bodyOverflow, `${name}: content is not masked`).toBe('visible')
  }
}

test('Battle Hall places one arena workspace below the scenic mode tabs with all real controls', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000)
  const mobile = await enterHall(page, testInfo, 'hall')
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await expect(page.locator('[data-av-game-rail]')).toBeVisible()
  await expect(page.locator('[data-hall-workspace]')).toHaveCount(3)
  await expect(page.locator('[data-hall-workspace]:visible')).toHaveCount(1)
  await expect(page.locator('[data-hall-workspace="ai"]')).toBeVisible()
  await expect(page.locator('[data-hall-workspace="pvp"]')).toBeHidden()
  await expect(page.locator('[data-hall-workspace="spectate"]')).toBeHidden()
  await capture(page, testInfo, 'idle')
  const ai = page.locator('[data-hall-workspace="ai"]')
  const modes = page.getByRole('navigation', { name: 'Battle Hall sections', exact: true })
  const modeButtons = modes.getByRole('button')
  await expect(modeButtons).toHaveCount(4)
  for (const [index, name] of [
    'AI Battles',
    'PVP - Direct',
    'PVP - Matchmaking (coming soon)',
    'Spectate',
  ].entries()) {
    await expect(modeButtons.nth(index)).toHaveAccessibleName(name)
  }
  await expect(ai.locator('figure')).toHaveCount(0)
  await expect(page.getByLabel('AI sparring arena')).toBeVisible()
  await modes.getByRole('button', { name: 'PVP - Matchmaking (coming soon)', exact: true }).click()
  await expect(page.locator('.av-matchmaking')).toContainText('Coming Soon')
  await page.getByRole('button', { name: 'AI Battles', exact: false }).click()

  await expect(page.getByLabel('Battle mode')).toHaveValue('recruit-sparring')
  await expect(page.getByRole('button', { name: 'Enter Battle', exact: true })).toBeEnabled()
  await expect(page.getByText('No battle selected.', { exact: true })).toHaveCount(0)
  if (!mobile) {
    await expect(ai.getByText('Recommended for', { exact: true })).toBeHidden()
    await expect(ai.getByText('Ideal for', { exact: true })).toBeHidden()
    await expect(ai.getByText('For experienced', { exact: true })).toBeHidden()
  }
  await expect(ai.getByText('01 / AI Battles', { exact: true })).toHaveCount(0)
  await expect(
    ai.getByText('Practice, learn, and test your committed build against AI opponents.', {
      exact: true,
    }),
  ).toHaveCount(0)
  await expect(
    ai.getByText(/Full duel arena with difficult ground, elevation, and flanking room./),
  ).toHaveCount(0)

  for (const mode of ['recruit-sparring', 'guided-fundamentals', 'mastery-trial'] as const) {
    const record = getTacticalHallRecord(mode)
    await ai
      .locator('button')
      .filter({ hasText: recordDisplayNameForTest(mode, record.name) })
      .first()
      .click()
    await expect(page.getByLabel('Battle mode')).toHaveValue(mode)
    const purpose = page.locator('#ai-record-purpose')
    await expect(page.getByLabel('Battle mode')).toHaveAttribute(
      'aria-describedby',
      'ai-record-purpose',
    )
    await expect(purpose).toHaveText(record.purpose)
    if (mobile) await purpose.scrollIntoViewIfNeeded()
    await expect(purpose).toBeInViewport()
    expect(
      await purpose.evaluate((node) => parseFloat(getComputedStyle(node).fontSize)),
    ).toBeGreaterThanOrEqual(11)
    await expect(page.getByRole('button', { name: 'Enter Battle', exact: true })).toBeEnabled()
    if (mode === 'mastery-trial') {
      await expect(page.getByRole('button', { name: 'Easy', exact: true })).toHaveCount(0)
      await expect(page.getByLabel('AI sparring arena')).toHaveValue('terraced-yard')
      await expect(page.getByLabel('AI sparring arena')).toBeDisabled()
      await expect(page.getByLabel('AI sparring arena').locator('option:checked')).toHaveText(
        /Terraced Yard/,
      )
    }
    if (!mobile) {
      const originalViewport = page.viewportSize()!
      for (const viewport of [
        { width: 1366, height: 768 },
        { width: 1536, height: 614 },
      ]) {
        await page.setViewportSize(viewport)
        await captureDesktopHallGeometry(page, testInfo, 'ai', mode)
      }
      await page.setViewportSize(originalViewport)
    }
    await capture(page, testInfo, mode)
  }

  const navigation = page.getByRole('navigation', { name: 'Battle Hall sections', exact: true })
  await navigation.getByRole('button', { name: 'PVP - Direct', exact: true }).click()
  await expect(page.locator('[data-hall-workspace]:visible')).toHaveCount(1)
  const pvpWorkspace = page.locator('[data-hall-workspace="pvp"]')
  await expect(pvpWorkspace).toBeVisible()
  await expect(ai).toBeHidden()
  await expect(page.getByText('02 / Challenge', { exact: true })).toHaveCount(0)
  if (!mobile) {
    const pvpSpace = await pvpWorkspace.evaluate((element) => {
      const stage = element.firstElementChild!.getBoundingClientRect()
      const workspace = element.getBoundingClientRect()
      return { stageHeight: stage.height, workspaceHeight: workspace.height }
    })
    expect
      .soft(pvpSpace.stageHeight, 'PvP composition fills the available parchment workspace')
      .toBeGreaterThan(pvpSpace.workspaceHeight * 0.9)
  }

  await page.locator('#pvp-mode').selectOption('flex-teams')
  await expect(page.locator('[data-pvp-team-sizes] select')).toHaveCount(2)
  for (const size of await page.locator('[data-pvp-team-sizes] select').all()) {
    await size.selectOption('3')
  }
  const turnTimer = page.getByRole('button', { name: '120 second turn timer', exact: true })
  await turnTimer.scrollIntoViewIfNeeded()
  await turnTimer.click()
  await expect(turnTimer).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Join by Key', exact: true }).click()
  await page.locator('#lobby-key').fill('avlabcd1234')
  await expect(page.locator('#lobby-key')).toHaveValue('AVL-ABCD-1234')
  await expect(page.getByRole('button', { name: 'Join Battle Lobby', exact: true })).toBeEnabled()
  await page.locator('#lobby-key').clear()
  await expect(page.getByRole('button', { name: 'Join Battle Lobby', exact: true })).toBeDisabled()
  await capture(page, testInfo, 'join')

  await page.getByRole('button', { name: 'Create Lobby', exact: true }).click()
  await expect(page.locator('#pvp-mode')).toHaveValue('flex-teams')
  await expect(turnTimer).toHaveAttribute('aria-pressed', 'true')
  for (const size of await page.locator('[data-pvp-team-sizes] select').all()) {
    await expect(size).toHaveValue('3')
  }
  await capture(page, testInfo, 'pvp')

  await navigation.getByRole('button', { name: /^Spectate/ }).click()
  await expect(page.locator('[data-hall-workspace]:visible')).toHaveCount(1)
  const spectateWorkspace = page.locator('[data-hall-workspace="spectate"]')
  await expect(spectateWorkspace).toBeVisible()
  await expect(page.locator('[data-hall-workspace="pvp"]')).toBeHidden()
  await expect(page.getByText('03 / Spectate', { exact: true })).toHaveCount(0)
  const readOnlyNote = spectateWorkspace.locator('aside')
  await expect(
    readOnlyNote.getByText(/Great tacticians learn twice/, { exact: false }),
  ).toHaveCount(0)
  const readOnlyPresentation = await readOnlyNote.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      backgroundImage: style.backgroundImage,
      textAlign: style.textAlign,
    }
  })
  expect(readOnlyPresentation.backgroundImage).toBe('none')
  expect(readOnlyPresentation.textAlign).toBe('center')

  await expect(page.getByRole('button', { name: 'Spectate Battle', exact: true })).toBeDisabled()
  await page.getByRole('textbox', { name: 'Battle Key', exact: true }).fill('avb-abcd-1234')
  await expect(page.getByRole('button', { name: 'Spectate Battle', exact: true })).toBeEnabled()
  await expect(page.getByText('Featured Matches', { exact: true })).toHaveCount(0)
  if (!mobile) {
    const originalViewport = page.viewportSize()!
    for (const viewport of [
      { width: 1366, height: 768 },
      { width: 1536, height: 614 },
    ]) {
      await page.setViewportSize(viewport)
      await captureDesktopHallGeometry(page, testInfo, 'spectate', 'spectate')
    }
    await page.setViewportSize(originalViewport)
  }
  await capture(page, testInfo, 'spectate')

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1)

  if (mobile) {
    for (const width of [320, 375, 760]) {
      await page.setViewportSize({ width, height: 844 })
      await expect(page.getByRole('button', { name: 'Spectate Battle', exact: true })).toBeVisible()
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      ).toBeLessThanOrEqual(1)
    }
  }
  expect(errors).toEqual([])
})

function recordDisplayNameForTest(
  recordId: 'recruit-sparring' | 'guided-fundamentals' | 'mastery-trial',
  fallback: string,
): string {
  return recordId === 'recruit-sparring' ? 'AI Sparring' : fallback
}

test('real multi-seat lobby remains a keyboard-contained dialog with square portraits and readable settings', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000)
  await enterHall(page, testInfo, 'lobby')
  await page
    .getByRole('navigation', { name: 'Battle Hall sections' })
    .getByRole('button', { name: 'PVP - Direct', exact: true })
    .click()
  await page.locator('#pvp-mode').selectOption('3v3')
  await page.getByRole('button', { name: '120 second turn timer', exact: true }).click()
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/pvp/lobbies') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Create Battle Lobby', exact: true }).click()
  expect((await created).ok()).toBe(true)
  const dialog = page.getByRole('dialog', { name: 'The arena is waiting.' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('120 seconds', { exact: true })).toBeVisible()
  await capture(page, testInfo, 'lobby')
  const metrics = await dialog.evaluate((element) => {
    const portrait = element.querySelector('img')!.getBoundingClientRect()
    const settings = element.querySelector('[aria-label="Locked PvP battle settings"]')!
    const footer = element.querySelector('footer')!.getBoundingClientRect()
    return {
      portraitRatio: portrait.width / portrait.height,
      labelSizes: [...settings.querySelectorAll('span')].map((node) =>
        parseFloat(getComputedStyle(node).fontSize),
      ),
      valueSizes: [...settings.querySelectorAll('strong')].map((node) =>
        parseFloat(getComputedStyle(node).fontSize),
      ),
      overflow: element.scrollWidth - element.clientWidth,
      focusInside: element.contains(document.activeElement),
      footerVisible: footer.bottom <= innerHeight && footer.y >= 0,
    }
  })
  if (process.env.LAYOUT_REVIEW_OUTPUT) {
    await writeFile(
      path.join(process.env.LAYOUT_REVIEW_OUTPUT, `hall-lobby-${testInfo.project.name}.json`),
      JSON.stringify(metrics, null, 2),
    )
  }
  expect.soft(metrics.portraitRatio).toBeCloseTo(1, 2)
  expect.soft(Math.min(...metrics.labelSizes)).toBeGreaterThanOrEqual(12)
  expect.soft(Math.min(...metrics.valueSizes)).toBeGreaterThanOrEqual(13)
  expect.soft(metrics.overflow).toBeLessThanOrEqual(1)
  expect.soft(metrics.focusInside).toBe(true)
  expect.soft(metrics.footerVisible).toBe(true)
  for (const direction of ['Tab', 'Shift+Tab']) {
    for (let index = 0; index < 14; index += 1) {
      await page.keyboard.press(direction)
      expect.soft(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true)
    }
  }
  // Escape must not silently abandon a server-owned multiplayer lobby.
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: /Mark Ready/ }).click()
  await expect(dialog.getByRole('button', { name: /Ready — click to stand down/ })).toBeVisible()
  await dialog.getByRole('button', { name: /Ready — click to stand down/ }).click()
  await expect(dialog.getByRole('button', { name: /Mark Ready/ })).toBeVisible()
  await dialog.getByTitle('Step out of this seat and choose another position.').click()
  await expect(dialog.getByRole('button', { name: /Choose a seat first/ })).toBeDisabled()
  await expect(dialog.getByRole('region', { name: 'Combatants choosing a seat' })).toBeVisible()
  await capture(page, testInfo, 'unseated')
  await dialog.getByTitle('Move to Team 2, seat 1', { exact: true }).click()
  await expect(dialog.getByRole('button', { name: /Mark Ready/ })).toBeEnabled()
  await page.reload()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('120 seconds', { exact: true })).toBeVisible()
  await expect(
    dialog
      .locator('[data-team="1"]')
      .getByTitle('Step out of this seat and choose another position.'),
  ).toBeVisible()
  await dialog.getByRole('button', { name: 'Close Lobby', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Create Battle Lobby', exact: true })).toBeEnabled()
})

// Covers the intermediate layout, not just the three-column desktop and phone endpoints.
test('intermediate Hall layouts keep settings clear of the action row', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One intermediate viewport matrix')
  test.setTimeout(60_000)
  await enterHall(page, testInfo, 'intermediate')
  await page
    .getByRole('navigation', { name: 'Battle Hall sections' })
    .getByRole('button', { name: 'PVP - Direct', exact: true })
    .click()
  await page.locator('#pvp-mode').selectOption('flex-teams')
  for (const select of await page.locator('[data-pvp-team-sizes] select').all()) {
    await select.selectOption('3')
  }
  const panel = page.locator('[data-hall-workspace="pvp"]')
  for (const viewport of [
    { width: 1199, height: 768 },
    { width: 1024, height: 768 },
    { width: 1024, height: 576 },
    { width: 768, height: 1024 },
  ]) {
    await page.setViewportSize(viewport)
    const timer = page.getByRole('button', { name: '120 second turn timer', exact: true })
    await timer.click({ timeout: 5_000 })
    await expect(timer).toHaveAttribute('aria-pressed', 'true')
    const bounds = await panel.evaluate((node) => {
      const body = node.querySelector('[data-hall-scroll-body]')!
      const actions = node.querySelector('[data-hall-action-row]')!
      const contentBottom = Math.max(
        ...[...body.children].map((child) => child.getBoundingClientRect().bottom),
      )
      const visibleBottom = ['auto', 'scroll', 'hidden', 'clip'].includes(
        getComputedStyle(body).overflowY,
      )
        ? Math.min(contentBottom, body.getBoundingClientRect().bottom)
        : contentBottom
      return {
        overlap: visibleBottom - actions.getBoundingClientRect().top,
        actionsOutsidePanel:
          actions.getBoundingClientRect().bottom - node.getBoundingClientRect().bottom,
        overflowX: document.documentElement.scrollWidth - innerWidth,
      }
    })
    expect(
      bounds.overlap,
      `settings clear footer at ${viewport.width}x${viewport.height}`,
    ).toBeLessThanOrEqual(1)
    expect(bounds.actionsOutsidePanel, 'panel contains its own action row').toBeLessThanOrEqual(1)
    expect(bounds.overflowX, 'no horizontal document clipping').toBeLessThanOrEqual(1)
    await page
      .getByRole('button', { name: 'Create Battle Lobby', exact: true })
      .click({ trial: true, timeout: 5_000 })
    await page.getByRole('button', { name: 'Join by Key', exact: true }).click()
    await page.locator('#lobby-key').fill('avlabcd1234')
    await page
      .getByRole('button', { name: 'Join Battle Lobby', exact: true })
      .click({ trial: true, timeout: 5_000 })
    await page.getByRole('button', { name: 'Create Lobby', exact: true }).click()
    await expect(page.locator('#pvp-mode')).toHaveValue('flex-teams')
  }
})
