import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

import { grantAppearanceToken } from './appearance-test-helpers'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

const workspace = '[data-character-concept="titles"]'
const titleSection = 'section[aria-labelledby="personal-title-heading"]'
const appearanceSection = 'section[aria-labelledby="character-appearance-heading"]'

test('Appearance & Title saves repeatable free titles and previews a design before spending one token', async ({
  page,
}, info) => {
  test.setTimeout(90_000)
  const stamp = Date.now()
  const suffix = String(stamp).replace(/\d/g, (digit) => String.fromCharCode(97 + Number(digit)))
  const { userId } = await provisionAccountAndEnterCharacter({
    page,
    email: `appearance-choice-${stamp}@example.com`,
    password: 'AurevaneTest!42',
    characterName: `Look ${suffix}`,
  })
  await page.goto('/game/account/titles')

  await expect(page.getByRole('heading', { name: 'Appearance & Title', exact: true })).toBeVisible()
  const titles = page.locator(titleSection)
  const appearance = page.locator(appearanceSection)
  await expect(titles.getByRole('button')).toHaveCount(3)
  await expect(appearance.getByRole('button')).toHaveText('Design sprite')
  await expect(page.locator(workspace).getByRole('textbox')).toHaveCount(0)
  await expect(page.locator(`${workspace} > footer`)).toHaveCount(0)

  for (const title of ['Roadfarer', 'Dawn Seeker', 'Horizon Wanderer', 'Roadfarer']) {
    const option = titles.getByRole('button', { name: new RegExp(`^${title}`) })
    await option.click()
    await expect(option).toHaveAttribute('aria-pressed', 'true')
    await expect(titles.locator('button[aria-pressed="true"]')).toHaveCount(1)
    await expect(appearance.getByText('0 Appearance Tokens available.')).toBeVisible()
  }
  await page.reload()
  await expect(titles.getByRole('button', { name: /^Roadfarer/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  const design = appearance.getByRole('button', { name: 'Design sprite' })
  const dialog = page.getByRole('dialog', { name: 'Character appearance' })
  const confirm = dialog.getByRole('button', { name: 'Confirm appearance' })
  const look = dialog.getByRole('combobox', { name: 'Look', exact: true })
  const variant = dialog.getByRole('combobox', { name: 'Variant', exact: true })
  const character =
    info.project.name === 'desktop-chromium'
      ? 'fae-f-0003'
      : info.project.name === 'laptop-chromium'
        ? 'fae-f-0004'
        : 'fae-f-0005'
  const race = dialog.getByRole('combobox', { name: 'Race', exact: true })
  await design.click()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('radio', { name: 'Female', exact: true }).check()
  await race.selectOption('fae')
  await look.selectOption(character)
  await variant.selectOption('2')
  await expect(variant).toHaveValue('2')
  await expect(confirm).toBeDisabled()
  await expect(dialog.getByText('You need an Appearance Token', { exact: false })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(design).toBeFocused()

  await grantAppearanceToken(userId)
  await page.reload()
  await expect(appearance.getByText('1 Appearance Token available.')).toBeVisible()
  await design.click()
  await dialog.getByRole('radio', { name: 'Female', exact: true }).check()
  await race.selectOption('fae')
  await look.selectOption(character)
  await expect(variant).toHaveValue('1')
  await variant.selectOption('2')
  await expect(confirm).toBeEnabled()
  await expect(
    dialog.getByText('Confirming a different look spends one Appearance Token.'),
  ).toBeVisible()
  await confirm.click()
  await expect(dialog).toBeHidden({ timeout: 20_000 })
  await expect(appearance.getByText('0 Appearance Tokens available.')).toBeVisible()

  await page.reload()
  await expect(appearance.getByText('0 Appearance Tokens available.')).toBeVisible()
  await design.click()
  await expect(variant).toHaveValue('2')
  await expect(confirm).toBeDisabled()
})

async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
  })
}

function maxRgbChannel(value: string) {
  return Math.max(...(value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number))
}

async function expectDesktopTitlesFitWithoutScroll(page: Page, label: string) {
  await settle(page)
  const metrics = await page.locator('[data-character-concept="titles"]').evaluate((root) => {
    const main = document.getElementById('game-main')!
    const mainBox = main.getBoundingClientRect()
    const viewportBottom = innerHeight
    const candidates = [...root.querySelectorAll<HTMLElement>(':scope > section, button, input')]
    const describe = (element: Element) => {
      const style = getComputedStyle(element)
      return {
        box: element.getBoundingClientRect().toJSON(),
        height: style.height,
        minHeight: style.minHeight,
        gridRows: style.gridTemplateRows,
        padding: style.padding,
        alignSelf: style.alignSelf,
      }
    }
    return {
      sizing: {
        main: describe(main),
        scene: describe(root.closest('[data-settings-scene]')!),
        workspace: describe(root.parentElement!),
      },
      main: mainBox.toJSON(),
      root: root.getBoundingClientRect().toJSON(),
      viewportBottom,
      mainOverflow: main.scrollHeight - main.clientHeight,
      rootOverflow: root.scrollHeight - root.clientHeight,
      mainScrollTop: main.scrollTop,
      rootScrollTop: root.scrollTop,
      documentOverflow: document.documentElement.scrollHeight - innerHeight,
      children: candidates
        .filter((child) => child.getClientRects().length > 0)
        .map((child) => ({
          name: child.textContent ?? child.getAttribute('aria-label'),
          box: child.getBoundingClientRect().toJSON(),
        })),
    }
  })
  const name = `titles-fit-${label.replace(/[^a-z0-9-]+/gi, '-')}`
  const outputDirectory = process.env.LAYOUT_REVIEW_OUTPUT
  if (outputDirectory) {
    await mkdir(outputDirectory, { recursive: true })
    await writeFile(path.join(outputDirectory, `${name}.json`), JSON.stringify(metrics, null, 2))
  }
  await test.info().attach(name, { body: JSON.stringify(metrics), contentType: 'application/json' })
  await page.screenshot({
    path: outputDirectory
      ? path.join(outputDirectory, `${name}.png`)
      : test.info().outputPath(`${name}.png`),
  })
  expect(metrics.mainOverflow, `${label}: main fits without scrolling`).toBeLessThanOrEqual(1)
  expect(
    metrics.rootOverflow,
    `${label}: editors fit without internal scrolling`,
  ).toBeLessThanOrEqual(1)
  expect(metrics.mainScrollTop).toBe(0)
  expect(metrics.rootScrollTop).toBe(0)
  expect(metrics.documentOverflow).toBeLessThanOrEqual(1)
  expect(metrics.root.top).toBeGreaterThanOrEqual(metrics.main.top)
  expect(metrics.root.bottom).toBeLessThanOrEqual(metrics.main.bottom + 1)
  expect(metrics.main.bottom).toBeLessThanOrEqual(metrics.viewportBottom + 1)
  for (const { name, box } of metrics.children) {
    expect(box.top, `${label}: ${name} is below main top`).toBeGreaterThanOrEqual(metrics.main.top)
    expect(box.bottom, `${label}: ${name} fits in the viewport`).toBeLessThanOrEqual(
      metrics.main.bottom + 1,
    )
    expect(box.left).toBeGreaterThanOrEqual(metrics.main.left)
    expect(box.right).toBeLessThanOrEqual(metrics.main.right + 1)
  }
}

async function measureLayout(page: Page) {
  await settle(page)
  return page.locator(workspace).evaluate(
    (root, { titleSection, appearanceSection }) => {
      const title = root.querySelector(titleSection)!
      const appearance = root.querySelector(appearanceSection)!
      return {
        title: title.getBoundingClientRect().toJSON(),
        appearance: appearance.getBoundingClientRect().toJSON(),
        titleHeadingColor: getComputedStyle(title.querySelector('h2')!).color,
        appearanceHeadingColor: getComputedStyle(appearance.querySelector('h2')!).color,
        surface: (root as HTMLElement).dataset.avSurface ?? null,
        background: getComputedStyle(root.parentElement!).backgroundImage,
        overflow: document.documentElement.scrollWidth - innerWidth,
      }
    },
    { titleSection, appearanceSection },
  )
}

test('Appearance & Title keeps the scenic workspace and side-by-side controls on desktop', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Desktop settings layout only')
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1366, height: 768 })
  await provisionAccountAndEnterCharacter({
    page,
    email: `titles-layout-${Date.now()}@example.com`,
    password: 'AurevaneTest!42',
    characterName: 'Title Wayfarer',
  })
  await page.goto('/game/account/titles')

  await expect(page.locator(workspace)).toBeVisible()
  const metrics = await measureLayout(page)
  expect(metrics.overflow).toBeLessThanOrEqual(1)
  expect(metrics.surface).toBe('moonstone')
  expect(metrics.background).toContain('linear-gradient')
  expect(maxRgbChannel(metrics.titleHeadingColor)).toBeLessThan(110)
  expect(maxRgbChannel(metrics.appearanceHeadingColor)).toBeLessThan(110)
  expect(metrics.appearance.x).toBeGreaterThanOrEqual(metrics.title.right)
  expect(Math.abs(metrics.title.y - metrics.appearance.y)).toBeLessThanOrEqual(2)
  expect(Math.abs(metrics.title.width - metrics.appearance.width)).toBeLessThanOrEqual(2)
  await expectDesktopTitlesFitWithoutScroll(page, '1366x768 initial')

  await page.setViewportSize({ width: 1536, height: 614 })
  const title = page.getByRole('button', { name: /^Horizon Wanderer/ })
  await title.click()
  await expect(title).toHaveAttribute('aria-pressed', 'true')
  await expectDesktopTitlesFitWithoutScroll(page, '1536x614 equipped title')
})

test('Appearance & Title stacks the controls and keeps them reachable on mobile', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile-chromium', 'Phone settings layout only')
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await provisionAccountAndEnterCharacter({
    page,
    email: `titles-mobile-${Date.now()}@example.com`,
    password: 'AurevaneTest!42',
    characterName: 'Mobile Wayfarer',
  })
  await page.goto('/game/account/titles')

  await expect(page.locator(workspace)).toBeVisible()
  const metrics = await measureLayout(page)
  expect(metrics.overflow).toBeLessThanOrEqual(1)
  expect(metrics.surface).toBe('moonstone')
  expect(metrics.background).toContain('linear-gradient')
  expect(maxRgbChannel(metrics.titleHeadingColor)).toBeLessThan(110)
  expect(maxRgbChannel(metrics.appearanceHeadingColor)).toBeLessThan(110)
  expect(Math.abs(metrics.title.x - metrics.appearance.x)).toBeLessThanOrEqual(2)
  expect(metrics.appearance.y).toBeGreaterThanOrEqual(metrics.title.bottom)

  const design = page.getByRole('button', { name: 'Design sprite' })
  await design.scrollIntoViewIfNeeded()
  await expect(design).toBeInViewport({ ratio: 1 })
  await design.click({ trial: true })

  if (process.env.LAYOUT_REVIEW_OUTPUT) {
    await mkdir(process.env.LAYOUT_REVIEW_OUTPUT, { recursive: true })
    await page.screenshot({
      path: path.join(process.env.LAYOUT_REVIEW_OUTPUT, 'titles-mobile-390x844.png'),
      fullPage: true,
    })
  }
})
