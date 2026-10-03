import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

test('default portrait gallery is modal, cancels safely, and locks after its one persisted choice', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const stamp = Date.now()
  const suffix = String(stamp).replace(/\d/g, (digit) => String.fromCharCode(97 + Number(digit)))
  await provisionAccountAndEnterCharacter({
    page,
    email: `portrait-choice-${stamp}@example.com`,
    password: 'AurevaneTest!42',
    characterName: `Portrait ${suffix}`,
  })
  await page.goto('/game/account/titles')
  const choose = page.getByRole('button', { name: 'Choose Default Portrait', exact: true })
  const dialog = page.getByRole('dialog', { name: 'Default portrait', exact: true })
  await expect(dialog).toBeHidden()
  await choose.click()
  await expect(dialog.getByRole('radio')).toHaveCount(64)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(choose).toBeFocused()
  await choose.click()
  await dialog.getByRole('radio', { name: 'Female adventurer 02', exact: true }).check()
  await dialog.getByRole('checkbox', { name: /one default portrait change/ }).check()
  const receipt = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/account/default-portrait') && response.status() === 200,
  )
  await dialog.getByRole('button', { name: 'Confirm Default Portrait', exact: true }).click()
  const body = await (await receipt).json()
  expect(body.choice.portraitRef).toBe('portrait.adventure.female-02')
  expect(body.choice.changedAt).toEqual(expect.any(String))
  await expect(dialog.getByText('Default portrait choice used.', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await page.reload()
  await expect(choose).toHaveCount(0)
  await expect(
    page
      .locator('section[aria-labelledby="profile-image-heading"]')
      .getByText('Default portrait choice used.', { exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save Profile Image', exact: true })).toBeVisible()
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
    const footerBox = document
      .querySelector('[data-testid="authenticated-shell"] > footer')!
      .getBoundingClientRect()
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
      footer: footerBox.toJSON(),
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
  expect(metrics.main.bottom).toBeLessThanOrEqual(metrics.footer.top + 1)
  for (const { name, box } of metrics.children) {
    expect(box.top, `${label}: ${name} is below main top`).toBeGreaterThanOrEqual(metrics.main.top)
    expect(box.bottom, `${label}: ${name} is above footer`).toBeLessThanOrEqual(
      metrics.main.bottom + 1,
    )
    expect(box.left).toBeGreaterThanOrEqual(metrics.main.left)
    expect(box.right).toBeLessThanOrEqual(metrics.main.right + 1)
  }
}

test('Titles keeps the scenic account workspace and its side-by-side editing controls at normal desktop zoom', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Desktop Titles composition only')
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1366, height: 768 })
  await provisionAccountAndEnterCharacter({
    page,
    email: `titles-layout-${Date.now()}@example.com`,
    password: 'AurevaneTest!42',
    characterName: 'Title Wayfarer',
  })
  await page.goto('/game/account/titles')

  const concept = page.locator('[data-character-concept="titles"]')
  const personal = page.locator('section[aria-labelledby="personal-title-heading"]')
  const current = page.locator('section[aria-labelledby="current-title-heading"]')
  const profileImage = page.locator('section[aria-labelledby="profile-image-heading"]')
  const save = page.getByRole('button', { name: 'Save Profile Image' })
  await expect(concept).toBeVisible()
  await expect(personal).toBeVisible()
  await expect(current).toHaveCount(0)
  await expect(profileImage).toBeVisible()
  await expect(save).toBeVisible()
  await settle(page)
  await expectDesktopTitlesFitWithoutScroll(page, '1366x768 initial')

  const metrics = await page.evaluate(() => {
    const rect = (selector: string) => {
      const box = document.querySelector(selector)!.getBoundingClientRect()
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        right: box.right,
        bottom: box.bottom,
      }
    }
    const root = document.querySelector<HTMLElement>('[data-character-concept="titles"]')!
    const footer = document
      .querySelector('[data-testid="authenticated-shell"] > footer')!
      .getBoundingClientRect()
    const saveButton = Array.from(root.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Save Profile Image'),
    )!
    const saveBox = saveButton.getBoundingClientRect()
    return {
      root: rect('[data-character-concept="titles"]'),
      personal: rect('section[aria-labelledby="personal-title-heading"]'),
      profileImage: rect('section[aria-labelledby="profile-image-heading"]'),
      save: { y: saveBox.y, bottom: saveBox.bottom },
      footerTop: footer.top,
      surface: root.dataset.avSurface ?? null,
      background: getComputedStyle(root.parentElement!).backgroundImage,
      personalHeadingColor: getComputedStyle(root.querySelector('#personal-title-heading')!).color,
      profileHeadingColor: getComputedStyle(root.querySelector('#profile-image-heading')!).color,
      overflow: document.documentElement.scrollWidth - innerWidth,
    }
  })

  expect.soft(metrics.overflow, 'no horizontal overflow').toBeLessThanOrEqual(1)
  expect.soft(metrics.surface, 'Titles uses the stone surface token contract').toBe('moonstone')
  expect.soft(metrics.background, 'stone Titles workspace').toContain('linear-gradient')
  expect
    .soft(maxRgbChannel(metrics.personalHeadingColor), 'personal-title heading remains readable')
    .toBeLessThan(110)
  expect
    .soft(maxRgbChannel(metrics.profileHeadingColor), 'profile-image heading remains readable')
    .toBeLessThan(110)
  expect
    .soft(metrics.profileImage.x, 'portrait editor sits beside the title editor')
    .toBeGreaterThanOrEqual(metrics.personal.right)
  expect
    .soft(Math.abs(metrics.personal.y - metrics.profileImage.y), 'desktop editor headings align')
    .toBeLessThanOrEqual(2)
  expect
    .soft(
      Math.abs(metrics.personal.width - metrics.profileImage.width),
      'desktop editors share available width',
    )
    .toBeLessThanOrEqual(2)
  expect
    .soft(metrics.save.bottom, 'profile image action stays above footer')
    .toBeLessThanOrEqual(metrics.footerTop + 1)
  expect
    .soft(metrics.root.bottom, 'Titles board stays above footer')
    .toBeLessThanOrEqual(metrics.footerTop + 1)

  await page.getByPlaceholder('e.g. Dawn Warden').fill('Dawn Keeper')
  await page.getByRole('button', { name: 'Review Title' }).click()
  await expect(personal.getByRole('textbox', { name: /^Personal title/ })).toHaveCount(0)
  await expect(personal.getByText('Dawn Keeper', { exact: true })).toBeVisible()
  await expect(personal.getByRole('checkbox')).toBeVisible()
  await expect(profileImage.getByRole('textbox', { name: /^Direct image URL/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm Final Title' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  await expectDesktopTitlesFitWithoutScroll(page, '1366x768 title confirmation')
  await page.setViewportSize({ width: 1536, height: 614 })
  await expectDesktopTitlesFitWithoutScroll(page, '1536x614 title confirmation')
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(personal.getByRole('textbox', { name: /^Personal title/ })).toHaveValue(
    'Dawn Keeper',
  )
  await expect(personal.getByRole('button', { name: 'Review Title', exact: true })).toBeVisible()
  await expectDesktopTitlesFitWithoutScroll(page, '1536x614 title editor')
  const saveResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/account/profile-display',
  )
  await save.click()
  const response = await saveResponse
  const saveResult = { status: response.status(), body: await response.json() }
  if (process.env.LAYOUT_REVIEW_OUTPUT) {
    await writeFile(
      path.join(process.env.LAYOUT_REVIEW_OUTPUT, 'titles-portrait-save-response.json'),
      JSON.stringify(saveResult, null, 2),
    )
  }
  expect(saveResult.status, JSON.stringify(saveResult.body)).toBe(200)
  await expect(
    profileImage.getByText('Custom profile image removed.', { exact: true }),
  ).toBeVisible()
  await expectDesktopTitlesFitWithoutScroll(page, '1536x614 portrait save confirmation')
  await page.setViewportSize({ width: 1366, height: 768 })

  if (process.env.LAYOUT_REVIEW_OUTPUT) {
    await mkdir(process.env.LAYOUT_REVIEW_OUTPUT, { recursive: true })
    await page.screenshot({
      path: path.join(process.env.LAYOUT_REVIEW_OUTPUT, 'titles-desktop-1366x768.png'),
      fullPage: true,
    })
  }
})

test('Titles stacks cleanly on phone without inventing desktop-only overflow', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile-chromium', 'Phone Titles composition only')
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await provisionAccountAndEnterCharacter({
    page,
    email: `titles-mobile-${Date.now()}@example.com`,
    password: 'AurevaneTest!42',
    characterName: 'Mobile Wayfarer',
  })
  await page.goto('/game/account/titles')

  const concept = page.locator('[data-character-concept="titles"]')
  await expect(concept).toBeVisible()
  await expect(page.locator('section[aria-labelledby="current-title-heading"]')).toHaveCount(0)
  await settle(page)

  const metrics = await page.evaluate(() => {
    const rect = (selector: string) => {
      const box = document.querySelector(selector)!.getBoundingClientRect()
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        bottom: box.bottom,
      }
    }
    const root = document.querySelector<HTMLElement>('[data-character-concept="titles"]')!
    return {
      surface: root.dataset.avSurface ?? null,
      rootBackground: getComputedStyle(root.parentElement!).backgroundImage,
      personalHeadingColor: getComputedStyle(root.querySelector('#personal-title-heading')!).color,
      personal: rect('section[aria-labelledby="personal-title-heading"]'),
      profileImage: rect('section[aria-labelledby="profile-image-heading"]'),
      overflow: document.documentElement.scrollWidth - innerWidth,
    }
  })

  expect.soft(metrics.overflow, 'phone has no horizontal overflow').toBeLessThanOrEqual(1)
  expect
    .soft(metrics.surface, 'phone Titles uses the stone surface token contract')
    .toBe('moonstone')
  expect.soft(metrics.rootBackground, 'phone stone workspace').toContain('linear-gradient')
  expect
    .soft(maxRgbChannel(metrics.personalHeadingColor), 'phone title heading remains readable')
    .toBeLessThan(110)
  expect
    .soft(Math.abs(metrics.personal.x - metrics.profileImage.x), 'phone editors share one column')
    .toBeLessThanOrEqual(2)
  expect
    .soft(metrics.profileImage.y, 'portrait configuration follows the title editor')
    .toBeGreaterThanOrEqual(metrics.personal.bottom)

  const save = page.getByRole('button', { name: 'Save Profile Image' })
  await save.scrollIntoViewIfNeeded()
  await expect(save).toBeInViewport({ ratio: 1 })
  await save.click({ trial: true })

  if (process.env.LAYOUT_REVIEW_OUTPUT) {
    await mkdir(process.env.LAYOUT_REVIEW_OUTPUT, { recursive: true })
    await page.screenshot({
      path: path.join(process.env.LAYOUT_REVIEW_OUTPUT, 'titles-mobile-390x844.png'),
      fullPage: true,
    })
  }
})
