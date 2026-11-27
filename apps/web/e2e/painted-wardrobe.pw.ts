import { expect, test } from '@playwright/test'
import { expectSmoothReadyStance, grantAppearanceToken } from './appearance-test-helpers'
import { allocateCreationPoints, createVerifiedAccountAndSignIn } from './pv1f-test-helpers'

test('@painted-wardrobe saves an authored pose variant using one token', async ({
  page,
  isMobile,
}, testInfo) => {
  test.slow()
  const suffix = Date.now()
    .toString()
    .slice(-8)
    .replace(/\d/g, (digit) => String.fromCharCode(65 + Number(digit)))
  // Browser Smoke shares one database across projects and reserves saved recipes
  // across characters. Give the laptop project its own initial and final look.
  const look = isMobile
    ? 'human-f-0005'
    : testInfo.project.name === 'laptop-chromium'
      ? 'human-m-0005'
      : 'human-m-0006'
  const characterName = `Warden ${suffix}`
  await createVerifiedAccountAndSignIn({
    page,
    email: `wardrobe-${look}-${Date.now()}@example.com`,
    password: 'Painted-wardrobe-browser-2026!',
  })
  await page.getByRole('link', { name: 'Create Character' }).first().click()
  await page.getByLabel('Character name').fill(characterName)
  await page.getByRole('button', { name: 'Build my character' }).click()
  const dialog = page.getByRole('dialog', { name: 'Character appearance' })
  await dialog.getByRole('radio', { name: isMobile ? 'Female' : 'Male', exact: true }).check()
  const battlePoses = dialog.getByRole('group', { name: 'Battle poses' })
  await expect(battlePoses.locator('figcaption')).toHaveText([
    'Idle',
    'Walk',
    'Attack',
    'Cast',
    'Hit',
    'Down',
  ])
  await expectSmoothReadyStance(battlePoses.locator('[data-preview-motion="idle"]'))
  const control = (name: string) => dialog.getByRole('combobox', { name, exact: true })
  await control('Look').selectOption(look)
  await expect(control('Look')).toHaveValue(look)
  await expect(control('Race').locator('option')).toHaveCount(4)
  await dialog.getByRole('button', { name: 'Use this appearance' }).click()
  await expect(dialog).toBeHidden({ timeout: 20_000 })

  await page.getByRole('button', { name: 'Choose your discipline' }).click()
  const review = page.getByRole('button', { name: 'Review character' })
  await expect(review).toBeVisible({ timeout: 15_000 })
  await allocateCreationPoints(page)
  await review.click()
  const creation = page.waitForResponse(
    (response) => response.url().endsWith('/api/character') && response.status() === 201,
  )
  await page.getByRole('button', { name: 'Create character' }).click()
  const { character } = await (await creation).json()
  await expect(page).toHaveURL(/\/game\/haven$/)

  await grantAppearanceToken(character.userId)
  await page.goto('/game/account/titles')
  const appearanceSettings = page.getByRole('region', { name: 'Character appearance', exact: true })
  const designSprite = appearanceSettings.getByRole('button', {
    name: 'Design sprite',
    exact: true,
  })
  await expect(appearanceSettings.getByText('1 Appearance Token available.')).toBeVisible()
  await designSprite.click()
  await expect(control('Look')).toHaveValue(look)
  await expect(control('Race')).toHaveValue('human')
  const variant = '2'
  await expect(control('Variant').locator('option')).toHaveCount(2)
  await control('Variant').selectOption(variant)
  await expect(dialog.getByText(/spends one Appearance Token/)).toBeVisible()
  const preview = dialog.getByAltText('Neutral appearance portrait')
  const path = `/api/media/appearance/7/${look}.v${variant}`
  await expect(preview).toHaveAttribute('src', `${path}/neutral.svg`)
  const atlasWidth = await page.evaluate(async (imagePath) => {
    const image = new Image()
    image.src = imagePath
    await image.decode()
    return image.naturalWidth
  }, `/media/art/character-catalogue/${look}/variant-${variant}/sprites.webp`)
  expect(atlasWidth).toBe(3072)
  await page.screenshot({ path: testInfo.outputPath('painted-wardrobe.png') })
  const confirm = dialog.getByRole('button', { name: 'Confirm appearance' })
  await confirm.click()
  await expect(dialog).toBeHidden({ timeout: 20_000 })
  await expect(appearanceSettings.getByText('0 Appearance Tokens available.')).toBeVisible()

  const saved = await page.request.get('/api/account/appearance')
  expect(saved.ok()).toBe(true)
  expect((await saved.json()).appearance).toMatchObject({
    imageUrl: `${path}/neutral.svg`,
    appearanceTokens: 0,
  })
  await page.reload()
  await designSprite.click()
  await expect(control('Look')).toHaveValue(look)
  await expect(control('Variant')).toHaveValue(variant)
  await expect(confirm).toBeDisabled()
})
