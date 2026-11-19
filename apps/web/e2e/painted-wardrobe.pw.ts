import { expect, test } from '@playwright/test'
import { allocateCreationPoints, createVerifiedAccountAndSignIn } from './pv1f-test-helpers'

test('@painted-wardrobe saves independently styled clothing and accessories, then locks the final sprite', async ({
  page,
  isMobile,
}, testInfo) => {
  test.slow()
  const suffix = Date.now()
    .toString()
    .slice(-8)
    .replace(/\d/g, (digit) => String.fromCharCode(65 + Number(digit)))
  const identity = isMobile ? 'ranger' : 'guard'
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
  await dialog.getByRole('button', { name: 'Painted characters' }).click()
  const outfit = dialog.getByRole('group', { name: 'Painted outfit' })
  const control = (name: string) => outfit.getByRole('combobox', { name, exact: true })
  await control('Character').selectOption(identity)
  await control('Clothing style').selectOption('shearling')
  await control('Clothing color').selectOption('pine')
  await dialog.getByRole('button', { name: 'Use this appearance' }).click()
  await expect(dialog).toBeHidden({ timeout: 20_000 })

  await page.getByRole('button', { name: 'Choose your discipline' }).click()
  const review = page.getByRole('button', { name: 'Review character' })
  await expect(review).toBeVisible({ timeout: 15_000 })
  await allocateCreationPoints(page)
  await review.click()
  await page.getByRole('button', { name: 'Create character' }).click()
  await expect(page).toHaveURL(/\/game\/haven$/)

  await page.goto('/game/account/titles')
  const appearanceSettings = page.getByRole('region', { name: 'Character appearance', exact: true })
  const designSprite = appearanceSettings.getByRole('button', {
    name: 'Design sprite',
    exact: true,
  })
  await expect(appearanceSettings.getByText('1 sprite design save remaining.')).toBeVisible()
  await designSprite.click()
  await expect(
    dialog.getByRole('heading', { name: 'Character appearance', exact: true }),
  ).toHaveCSS('color', 'rgb(244, 236, 218)')
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
  await control('Face accessory style').selectOption('eyepatch')
  await control('Face accessory color').selectOption('charcoal')
  await expect(dialog.getByText(/This is your final save/)).toBeVisible()
  const path = `/api/media/appearance/4/${identity}.hawkmantle.cobalt.mapcase.crimson.${isMobile ? 'bandana' : 'arcanist'}.amber.eyepatch.charcoal`
  const atlasWidth = await page.evaluate(async (imagePath) => {
    const image = new Image()
    image.src = imagePath
    await image.decode()
    return image.naturalWidth
  }, `${path}/atlas.svg`)
  expect(atlasWidth).toBe(576)
  await page.screenshot({ path: testInfo.outputPath('painted-wardrobe.png') })
  await dialog.getByRole('button', { name: 'Confirm sprite design' }).click()
  await expect(dialog).toBeHidden({ timeout: 20_000 })
  await expect(page.getByText('Your sprite design is permanently locked.')).toBeVisible()

  const saved = await page.request.get('/api/account/appearance')
  expect(saved.ok()).toBe(true)
  expect((await saved.json()).appearance).toMatchObject({
    imageUrl: `${path}/neutral.svg`,
    remainingDesigns: 0,
  })
  await page.reload()
  await expect(designSprite).toBeDisabled()
})
