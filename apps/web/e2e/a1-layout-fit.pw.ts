import { expect, test, type Page } from '@playwright/test'

import { createAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Fit ${letters}`
}

test.only('keeps the core A1 surfaces inside the initial desktop and laptop viewport', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    'Natural vertical scrolling is allowed on phones.',
  )
  test.slow()

  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const email = `a1-fit-${projectSlug}-${Date.now()}@example.com`
  const password = 'A1-layout-fit-2026!'
  const characterName = uniqueCharacterName()

  await page.goto('/')
  await expect(page.getByTestId('account-shell')).toBeVisible()
  await expectInitialViewportFit(page, 'Account Entry')

  await page.goto('/news')
  await expect(page.getByRole('heading', { level: 1, name: 'News' })).toBeVisible()
  await expectInitialViewportFit(page, 'News')

  await createAccountAndEnterCharacter({ page, email, password, characterName })

  await expect(page.getByTestId('character-profile')).toContainText(characterName)
  await expectInitialViewportFit(page, 'Character Profile')

  await page.goto('/game/battle')
  const geometry = await page.evaluate(() => {
    const describe = (element: Element | null) => {
      if (!(element instanceof HTMLElement)) return null
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return {
        tag: element.tagName,
        id: element.id,
        className: element.className,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        position: style.position,
        overflow: style.overflow,
        width: style.width,
        minWidth: style.minWidth,
        maxWidth: style.maxWidth,
        height: style.height,
        minHeight: style.minHeight,
        gridTemplateColumns: style.gridTemplateColumns,
        gridTemplateRows: style.gridTemplateRows,
        alignSelf: style.alignSelf,
        justifySelf: style.justifySelf,
      }
    }
    const heading = document.querySelector('#battle-launch-title')
    const headingGroup = heading?.parentElement ?? null
    const headingHeader = headingGroup?.parentElement ?? null
    const pageRoot = document.querySelector('#battle-launch')
    const main = document.querySelector('#game-main')
    const shell = document.querySelector('[data-testid="authenticated-shell"]')
    return {
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
      },
      heading: describe(heading),
      headingGroup: describe(headingGroup),
      headingHeader: describe(headingHeader),
      pageRoot: describe(pageRoot),
      main: describe(main),
      shell: describe(shell),
    }
  })
  console.log(`BATTLE_GEOMETRY ${JSON.stringify(geometry)}`)
  await expect(page.getByRole('heading', { name: 'Choose your arena.' })).toBeVisible()
  await expectInitialViewportFit(page, 'Battle Hall')

  await page.goto('/game/settings/controls')
  await expect(page.getByRole('heading', { name: 'Controls & Keybinds' })).toBeVisible()
  await expectInitialViewportFit(page, 'Controls & Keybinds')

  await page.goto('/game/training')
  await expect(page.getByRole('heading', { name: 'Passive Training' })).toBeVisible()
  await expect(page.getByTestId('training-report')).toHaveCount(0)
  await expectInitialViewportFit(page, 'Passive Training')

  await page.goto('/game')
  await expect(page.getByRole('heading', { name: 'Choose your character.' })).toBeVisible()
  await expectInitialViewportFit(page, 'Character Select')

  await page.setViewportSize({ width: 1024, height: 576 })
  await page.goto('/game')
  await expect(page.getByRole('heading', { name: 'Choose your character.' })).toBeVisible()
  await expectInitialViewportFit(page, 'Character Select at 1024x576')
})

async function expectInitialViewportFit(page: Page, surface: string): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  const dimensions = await page.evaluate(() => ({
    clientHeight: document.documentElement.clientHeight,
    scrollHeight: document.documentElement.scrollHeight,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))

  expect(
    dimensions.scrollHeight,
    `${surface} should not require initial vertical page scrolling`,
  ).toBeLessThanOrEqual(dimensions.clientHeight + 1)
  expect(
    dimensions.scrollWidth,
    `${surface} should not require horizontal page scrolling`,
  ).toBeLessThanOrEqual(dimensions.clientWidth + 1)
}
