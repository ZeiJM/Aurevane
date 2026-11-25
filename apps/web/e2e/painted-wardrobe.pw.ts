import { expect, test } from '@playwright/test'
import { expectSmoothReadyStance, grantAppearanceToken } from './appearance-test-helpers'
import { allocateCreationPoints, createVerifiedAccountAndSignIn } from './pv1f-test-helpers'

test('@painted-wardrobe saves independent painted features and accessories using one token', async ({
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
  const identity = isMobile ? 'f64' : testInfo.project.name === 'laptop-chromium' ? 'm64' : 'm63'
  const characterName = `Warden ${suffix}`
  await createVerifiedAccountAndSignIn({
    page,
    email: `wardrobe-${identity}-${Date.now()}@example.com`,
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
  const outfit = dialog.getByRole('group', { name: 'Appearance options' })
  const control = (name: string) => outfit.getByRole('combobox', { name, exact: true })
  await control('Face').selectOption(identity)
  await expect(control('Face')).toHaveValue(identity)
  await control('Clothing style').selectOption('shearling')
  await control('Clothing color').selectOption('pine')
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
  await expect(control('Clothing color')).toHaveValue('pine')
  await expect(control('Accessory color')).toBeDisabled()
  await control('Clothing style').selectOption('hawkmantle')
  await control('Clothing color').selectOption('cobalt')
  await control('Accessory style').selectOption('mapcase')
  await control('Accessory color').selectOption('crimson')
  await expect(control('Clothing color')).toHaveValue('cobalt')
  await expect(control('Accessory color')).toHaveValue('crimson')
  await control('Headwear style').selectOption(isMobile ? 'bandana' : 'arcanist')
  await control('Headwear color').selectOption('amber')
  await control('Facewear style').selectOption('eyepatch')
  await control('Facewear color').selectOption('charcoal')
  await expect(control('Accessory color')).toHaveValue('crimson')
  await expect(control('Headwear color')).toHaveValue('amber')
  await expect(control('Facewear color')).toHaveValue('charcoal')
  await control('Hairstyle').selectOption('twins')
  await control('Hair color').selectOption('lilac')
  await control('Eye color').selectOption('green')
  await control('Second hair color').selectOption('silver')
  await control('Two-tone placement').selectOption('tips')
  await control('Right eye color (heterochromia)').selectOption('blue')
  await control('Facial scar').selectOption('cross')
  await control('Portrait setting').selectOption('frost')
  await expect(dialog.getByText(/spends one Appearance Token/)).toBeVisible()
  const path = `/api/media/appearance/6/${identity}.hawkmantle.cobalt.mapcase.crimson.${isMobile ? 'bandana' : 'arcanist'}.amber.eyepatch.charcoal.natural.natural.twins.lilac.green.accent-silver.dye-tips.eye-blue.scar-cross.frost`
  const atlasWidth = await page.evaluate(async (imagePath) => {
    const image = new Image()
    image.src = imagePath
    await image.decode()
    return image.naturalWidth
  }, `${path}/illustrated-atlas.svg`)
  expect(atlasWidth).toBe(576)
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
  await expect(control('Portrait setting')).toHaveValue('frost')
  await expect(confirm).toBeDisabled()
})
