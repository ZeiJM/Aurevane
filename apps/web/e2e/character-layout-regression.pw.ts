import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import { STARTER_CHARACTER_PORTRAITS } from '@aurevane/game-core/character/starter-options'

import { getStarterPortraitImageAssetId } from '../src/media/character'
import { getImageAsset } from '../src/media/registry'
import { createVerifiedAccountAndSignIn } from './pv1f-test-helpers'

async function capture(page: Page, testInfo: TestInfo, label: string) {
  await page.evaluate(() => document.fonts.ready)
  const directory = process.env.LAYOUT_REVIEW_OUTPUT
  const bytes = await page.screenshot({ fullPage: true })
  await testInfo.attach(label, { body: bytes, contentType: 'image/png' })
  if (directory) {
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, `character-${testInfo.project.name}-${label}.png`), bytes)
  }
}

async function reachable(control: Locator) {
  await control.scrollIntoViewIfNeeded()
  await expect(control).toBeVisible()
  await control.click({ trial: true })
}

async function containedKeyboard(page: Page, dialog: Locator) {
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let index = 0; index < 6; index += 1) {
      await page.keyboard.press(key)
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(
        true,
      )
    }
  }
}

test('character roster and creation preserve the approved workspace and real account flow', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000)
  const databaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid')
  expect(['127.0.0.1', 'localhost']).toContain(databaseUrl.hostname)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const suffix = `${testInfo.project.name}-${Date.now()}`
  await createVerifiedAccountAndSignIn({
    page,
    email: `character-workspace-${suffix}@example.com`,
    password: 'Character-layout-local-2026!',
  })
  const sizes = testInfo.project.name.startsWith('desktop')
    ? [
        { width: 1728, height: 887 },
        { width: 1440, height: 900 },
      ]
    : testInfo.project.name.startsWith('laptop')
      ? [
          { width: 1366, height: 768 },
          { width: 1024, height: 576 },
          { width: 768, height: 576 },
        ]
      : [
          { width: 390, height: 844 },
          { width: 320, height: 740 },
        ]
  for (const size of sizes) {
    await page.setViewportSize(size)
    const slots = page.getByRole('region', { name: 'Character slots' })
    await expect(slots.locator('article')).toHaveCount(3)
    await expect(page.getByRole('link', { name: 'Create Character', exact: true })).toHaveCount(1)
    const [heading, board] = await Promise.all([
      page.locator('[data-roster-stage] > header').boundingBox(),
      slots.boundingBox(),
    ])
    await capture(page, testInfo, `empty-${size.width}x${size.height}`)
    expect
      .soft(heading!.y + heading!.height, 'the roster heading is above, not beside, the cards')
      .toBeLessThanOrEqual(board!.y + 1)
    expect.soft(await slots.locator('[data-av-surface="moonstone"]').count()).toBe(0)
    expect
      .soft(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
      .toBeLessThanOrEqual(1)
    await reachable(page.getByTestId('delete-account-button'))
  }
  const accountButton = page.getByTestId('delete-account-button')
  await accountButton.click()
  const accountDialog = page.getByRole('dialog', { name: 'Delete your entire AUREVANE account?' })
  await expect(
    accountDialog.getByRole('button', { name: 'Start 24-hour account deletion' }),
  ).toBeDisabled()
  await containedKeyboard(page, accountDialog)
  await page.keyboard.press('Escape')
  await expect(accountDialog).toBeHidden()
  await expect(accountButton).toBeFocused()

  await page.getByRole('link', { name: 'Create Character', exact: true }).click()
  await expect(page.getByTestId('character-creation')).toBeVisible()
  const library = page.getByRole('group', { name: 'Choose a starting portrait', exact: true })
  const preview = page.getByRole('complementary', { name: 'Selected portrait preview' })
  await expect(library.locator('input[type="radio"]')).toHaveCount(40)
  await expect(page.getByRole('button', { name: 'Choose your discipline' })).toBeDisabled()
  await expect(page.getByTestId('character-creation')).not.toContainText(/pronoun/i)
  for (const size of sizes) {
    await page.setViewportSize(size)
    await page.evaluate(() => window.scrollTo(0, 0))
    await capture(page, testInfo, `identity-${size.width}x${size.height}`)
    const [libraryBox, previewBox, imageBox, nameBox] = await Promise.all([
      library.boundingBox(),
      preview.boundingBox(),
      preview.locator('img').boundingBox(),
      page.getByLabel('Character name').boundingBox(),
    ])
    expect
      .soft(Math.abs(imageBox!.width - imageBox!.height), 'square selected portrait')
      .toBeLessThanOrEqual(1)
    expect
      .soft(libraryBox!.y, 'portrait library precedes identity details')
      .toBeLessThan(nameBox!.y)
    if (size.width >= 980) {
      expect.soft(previewBox!.x).toBeGreaterThanOrEqual(libraryBox!.x + libraryBox!.width - 1)
      expect.soft(imageBox!.width, 'prominent desktop preview').toBeGreaterThanOrEqual(240)
    } else {
      expect
        .soft(previewBox!.y, 'preview stays above the long mobile library')
        .toBeLessThanOrEqual(libraryBox!.y)
    }
    expect
      .soft(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
      .toBeLessThanOrEqual(1)
  }

  // Decode every actual registered source independently of lazy loading in the bounded grid.
  const sources = STARTER_CHARACTER_PORTRAITS.map(
    (portrait) => getImageAsset(getStarterPortraitImageAssetId(portrait.ref)).src!,
  )
  expect(new Set(sources).size).toBe(40)
  const decoded = await page.evaluate(
    async (urls) =>
      Promise.all(
        urls.map(async (src) => {
          const image = new Image()
          image.src = src
          await image.decode()
          return image.naturalWidth > 0 && image.naturalWidth === image.naturalHeight
        }),
      ),
    sources,
  )
  expect(decoded.every(Boolean)).toBe(true)
  const radios = library.locator('input[name="portrait"]')
  await radios.first().focus()
  await page.keyboard.press('ArrowRight')
  await expect(radios.nth(1)).toBeChecked()
  await library.locator('label').last().click()
  await expect(radios.last()).toBeChecked()
  await expect(preview.locator('img')).toHaveAttribute('src', sources[39]!)

  const characterName = `Wayfarer ${Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')}`
  await page.getByLabel('Character name').fill(characterName)
  await page.getByLabel('Feminine', { exact: true }).check()
  await page
    .getByRole('group', { name: 'Starter appearance', exact: true })
    .locator('label')
    .last()
    .click()
  await page.getByRole('button', { name: 'Choose your discipline' }).click()
  await expect(page.getByRole('heading', { name: 'Choose your first Discipline.' })).toBeFocused()
  await page.getByRole('button', { name: 'Decrease might bonus' }).click()
  await expect(page.getByRole('button', { name: 'Review character' })).toBeDisabled()
  await page.getByRole('button', { name: 'Increase might bonus' }).click()
  await capture(page, testInfo, 'discipline')
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.getByLabel('Character name')).toHaveValue(characterName)
  await expect(page.getByLabel('Feminine', { exact: true })).toBeChecked()
  await expect(radios.last()).toBeChecked()
  await expect(page.locator('input[name="appearance"]').last()).toBeChecked()
  await page.getByRole('button', { name: 'Choose your discipline' }).click()
  await page.getByRole('button', { name: 'Review character' }).click()
  await expect(page.getByRole('heading', { name: 'Confirm this character.' })).toBeFocused()
  await expect(page.getByTestId('character-creation')).toContainText('Lightstep travelwear')
  await expect(page.getByTestId('character-creation')).not.toContainText(/pronoun/i)
  await capture(page, testInfo, 'confirm')
  const requestPromise = page.waitForRequest(
    (request) => request.url().endsWith('/api/character') && request.method() === 'POST',
  )
  await page.getByRole('button', { name: 'Create character', exact: true }).click()
  expect((await requestPromise).postDataJSON().intent).toMatchObject({
    name: characterName,
    presentationId: 'feminine',
    pronounPresetId: 'she_her',
    portraitRef: STARTER_CHARACTER_PORTRAITS[39]!.ref,
    starterAppearanceRef: 'appearance.starter.lightstep',
  })
  await expect(page).toHaveURL(/\/game\/character$/)
  await expect(page.getByTestId('character-profile')).toContainText(characterName)
  await page.getByRole('button', { name: 'Account', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Switch Character' }).click()
  await expect(page).toHaveURL(/\/game$/)
  const play = page.getByRole('link', { name: `Play ${characterName}` })
  await reachable(play)
  await capture(page, testInfo, 'populated')
  const deletionButton = page.getByRole('button', { name: 'Delete Character', exact: true })
  await deletionButton.click()
  const deletionDialog = page.getByRole('dialog', {
    name: `Schedule deletion of ${characterName}?`,
  })
  await expect(deletionDialog.locator('input')).toBeFocused()
  await containedKeyboard(page, deletionDialog)
  await page.keyboard.press('Escape')
  await expect(deletionDialog).toBeHidden()
  await expect(deletionButton).toBeFocused()
  await expect(play).toBeVisible()
  expect(errors).toEqual([])
})
