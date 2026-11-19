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
  await outfit.getByLabel('Character', { exact: true }).selectOption(identity)
  await outfit.getByLabel('Clothing style').selectOption('shearling')
  await outfit.getByLabel('Clothing color').selectOption('pine')
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
  await expect(page.getByText('1 sprite design save remaining.')).toBeVisible()
  await page.getByRole('button', { name: 'Design sprite' }).click()
  await expect(outfit.getByLabel('Clothing color')).toHaveValue('pine')
  await expect(outfit.getByLabel('Accessory color')).toBeDisabled()
  await outfit.getByLabel('Clothing style').selectOption('hawkmantle')
  await outfit.getByLabel('Clothing color').selectOption('cobalt')
  await outfit.getByLabel('Accessory style').selectOption('mapcase')
  await outfit.getByLabel('Accessory color').selectOption('crimson')
  await expect(outfit.getByLabel('Clothing color')).toHaveValue('cobalt')
  await expect(outfit.getByLabel('Accessory color')).toHaveValue('crimson')
  await outfit.getByLabel('Headwear style').selectOption(isMobile ? 'bandana' : 'arcanist')
  await outfit.getByLabel('Headwear color').selectOption('amber')
  await outfit.getByLabel('Face accessory style').selectOption('eyepatch')
  await outfit.getByLabel('Face accessory color').selectOption('charcoal')
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
  await expect(page.getByRole('button', { name: 'Design sprite' })).toBeDisabled()
})
