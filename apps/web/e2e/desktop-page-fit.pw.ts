import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

const desktopViewports = [
  { width: 1728, height: 885 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
  { width: 1024, height: 576 },
]

async function settleLayout(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
}

async function capture(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' })
}

async function expectAboveFooter(page: Page, locator: Locator): Promise<void> {
  const footer = await page.locator('[data-testid="authenticated-shell"] > footer').boundingBox()
  const box = await locator.boundingBox()
  expect(footer).not.toBeNull()
  expect(box).not.toBeNull()
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.y + box!.height).toBeLessThanOrEqual(footer!.y + 1)
  await locator.click({ trial: true })
}

async function expectHallFits(page: Page, label: string): Promise<void> {
  await settleLayout(page)
  const metrics = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>('#game-main')!
    const hall = document.querySelector<HTMLElement>('#battle-launch')!
    const footer = document.querySelector('[data-testid="authenticated-shell"] > footer')!
    const mainRect = main.getBoundingClientRect()
    const hallRect = hall.getBoundingClientRect()
    const footerRect = footer.getBoundingClientRect()
    const controls = Array.from(hall.querySelectorAll('button, input, select, label, legend'))
      .filter((element) => element.checkVisibility())
      .map((element) => {
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        const fontFloor = element.matches('input, select') ? 13 : 12
        return {
          name: (element.textContent || element.getAttribute('aria-label') || element.id)
            .trim()
            .slice(0, 90),
          outside:
            rect.top < mainRect.top - 1 ||
            rect.bottom > footerRect.top + 1 ||
            rect.left < hallRect.left - 1 ||
            rect.right > hallRect.right + 1,
          tooSmall: Number.parseFloat(style.fontSize) < fontFloor - 0.01,
        }
      })
    return {
      pageOverflowY: document.documentElement.scrollHeight - window.innerHeight,
      pageOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      mainOverflowY: main.scrollHeight - main.clientHeight,
      mainOverflowX: main.scrollWidth - main.clientWidth,
      hallBottom: hallRect.bottom,
      footerTop: footerRect.top,
      invalidControls: controls.filter((control) => control.outside || control.tooSmall),
    }
  })
  expect(metrics.pageOverflowY, `${label}: document vertical overflow`).toBeLessThanOrEqual(1)
  expect(metrics.pageOverflowX, `${label}: document horizontal overflow`).toBeLessThanOrEqual(1)
  expect(metrics.mainOverflowY, `${label}: inner page vertical overflow`).toBeLessThanOrEqual(1)
  expect(metrics.mainOverflowX, `${label}: inner page horizontal overflow`).toBeLessThanOrEqual(1)
  expect(metrics.hallBottom, `${label}: panel border behind footer`).toBeLessThanOrEqual(
    metrics.footerTop + 1,
  )
  expect(metrics.invalidControls, `${label}: clipped or undersized controls`).toEqual([])
}

async function enterTestCharacter(page: Page, prefix: string): Promise<void> {
  const seed = `${Date.now()}${Math.floor(Math.random() * 10000)}`
  const suffix = seed
    .slice(-7)
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  await provisionAccountAndEnterCharacter({
    page,
    email: `${prefix}.${seed}@example.com`,
    password: 'Desktop-page-fit-2026!',
    characterName: `Wayfarer ${suffix}`,
  })
}

test('desktop Profile and all Battle Hall setups fit without clipped controls or tiny text', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One explicit desktop viewport matrix')
  test.setTimeout(240_000)
  await enterTestCharacter(page, 'desktop-fit')

  for (const viewport of desktopViewports) {
    await page.setViewportSize(viewport)
    const size = `${viewport.width}x${viewport.height}`
    await page.goto('/game/character')
    await expect(page.getByTestId('character-profile')).toBeVisible()
    await settleLayout(page)
    const reset = page.getByRole('button', { name: 'Reset / Redistribute Attributes' })
    if (viewport.height >= 720 && viewport.width >= 1280) {
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(
        viewport.height + 1,
      )
      await expectAboveFooter(page, reset)
    } else {
      // Real wheel input must reach lower content; hiding overflow is not a valid fix.
      const needsScroll = await page.evaluate(
        () => document.documentElement.scrollHeight > window.innerHeight,
      )
      await page.mouse.move(viewport.width / 3, viewport.height / 2)
      await page.mouse.wheel(0, 1600)
      if (needsScroll) await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0)
      await expectAboveFooter(page, reset)
    }
    const profileBottom = await page
      .locator('section[aria-label="Attribute redistribution"]')
      .boundingBox()
    const profileFooter = await page
      .locator('[data-testid="authenticated-shell"] > footer')
      .boundingBox()
    expect(
      profileBottom!.y + profileBottom!.height,
      `Profile lower section ${size}`,
    ).toBeLessThanOrEqual(profileFooter!.y + 1)
    await capture(page, testInfo, `profile-${size}`)
    await reset.click()
    const dialog = page.getByRole('dialog', { name: 'Redistribute Attributes', exact: true })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(dialog).toHaveCount(0)

    await page.goto('/game/battle')
    const tabs = page.getByRole('navigation', { name: 'Battle Hall sections' })
    await expect(page.locator('#ai-mode')).toBeVisible()
    await expectHallFits(page, `AI empty ${size}`)
    for (const mode of ['recruit-sparring', 'guided-fundamentals']) {
      await page.locator('#ai-mode').selectOption(mode)
      await expect(page.getByRole('button', { name: 'Enter Battle', exact: true })).toBeEnabled()
      await expectHallFits(page, `${mode} ${size}`)
    }
    await capture(page, testInfo, `hall-ai-${size}`)
    await tabs.locator('button[data-tone="pvp"]').click()
    for (const mode of ['1v1', '2v2', '3v3', '1v1v1', 'flex-teams']) {
      await page.locator('#pvp-mode').selectOption(mode)
      if (mode === 'flex-teams') {
        await page
          .locator('[data-pvp-create-card] > div:has(select) select')
          .nth(0)
          .selectOption('3')
        await page
          .locator('[data-pvp-create-card] > div:has(select) select')
          .nth(1)
          .selectOption('3')
      }
      await expectHallFits(page, `${mode} ${size}`)
    }
    await capture(page, testInfo, `hall-pvp-flex-${size}`)
    await page.getByRole('button', { name: 'Expanded', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Expanded', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.getByRole('button', { name: '120 second turn timer', exact: true }).click()
    await expect(
      page.getByRole('button', { name: '120 second turn timer', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await page.locator('#lobby-key').fill('avlabcd1234')
    await expect(page.locator('#lobby-key')).toHaveValue('AVL-ABCD-1234')
    await expect(page.getByRole('button', { name: 'Join Battle Lobby', exact: true })).toBeEnabled()
    await page.locator('#lobby-key').clear()
    await expect(
      page.getByRole('button', { name: 'Join Battle Lobby', exact: true }),
    ).toBeDisabled()
    await tabs.locator('button[data-tone="spectate"]').click()
    await page.getByRole('textbox', { name: 'Battle Key', exact: true }).fill('AVB-ABCD-1234')
    await expect(page.getByRole('button', { name: 'Spectate Battle', exact: true })).toBeEnabled()
    await expectHallFits(page, `Spectate ${size}`)
    await capture(page, testInfo, `hall-spectate-${size}`)
  }

  await page.setViewportSize({ width: 1366, height: 768 })
  await page.getByRole('button', { name: 'Navigation', exact: true }).click()
  await page
    .getByRole('navigation', { name: 'Game navigation' })
    .getByRole('link', { name: /^Profile/ })
    .click()
  await expect(page).toHaveURL(/\/game\/character$/)
  for (const [panel, name] of [
    ['primary-build-panel', 'Discipline Management'],
    ['skill-build-panel', 'Techniques'],
  ]) {
    await page.getByTestId(panel!).locator(':scope > button').click()
    const dialog = page.getByRole('dialog', { name, exact: true })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(dialog).toHaveCount(0)
  }
})

test('phone Battle Hall keeps its existing scrolling layout and functional tabs', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Phone boundary regression')
  test.slow()
  await enterTestCharacter(page, 'mobile-fit')
  await page.goto('/game/battle')
  const tabs = page.getByRole('navigation', { name: 'Battle Hall sections' })
  for (const tone of ['ai', 'pvp', 'spectate']) {
    await tabs.locator(`button[data-tone="${tone}"]`).click()
    await expect(page.locator(`#battle-launch > section[data-tone="${tone}"]`)).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => document.documentElement.clientWidth + 1),
    )
    await capture(page, testInfo, `mobile-${tone}`)
  }
  expect(
    await page
      .locator('[data-testid="authenticated-shell"] > footer')
      .evaluate((element) => getComputedStyle(element).position),
  ).toBe('fixed')
})
