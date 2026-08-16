import { expect, test } from '@playwright/test'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Wayfarer ${letters}`
}

test('creates one permanent character and resumes it across refresh and sign-in', async ({
  page,
}, testInfo) => {
  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const email = `p13-${projectSlug}-${Date.now()}@example.com`
  const password = 'P13-browser-character-2026!'
  const characterName = uniqueCharacterName()

  await page.goto('/')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account', exact: true }).last().click()

  await expect(page).toHaveURL(/\/game$/)
  await expect(page.getByTestId('character-creation')).toBeVisible()

  const nameInput = page.getByLabel('Character name')
  await nameInput.click()
  await expect(nameInput).toBeFocused()
  await nameInput.fill(characterName)

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  )
  expect(hasHorizontalOverflow).toBe(false)

  await page.getByRole('button', { name: 'Choose your foundation' }).click()
  await expect(page.getByTestId('attribute-points')).toContainText('0 points remaining')
  await page.getByRole('button', { name: 'Review character' }).click()
  await expect(page.getByRole('heading', { name: 'Make this adventurer permanent.' })).toBeVisible()

  await page.getByRole('button', { name: 'Create permanent character' }).click()
  const established = page.getByTestId('character-established')
  await expect(established).toBeVisible()
  await expect(established).toContainText(characterName)
  await expect(established).toContainText('Vanguard')

  await page.reload()
  await expect(page.getByTestId('character-established')).toContainText(characterName)
  await expect(page.getByTestId('character-creation')).toHaveCount(0)

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/$/)

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Enter AUREVANE' }).click()

  await expect(page).toHaveURL(/\/game$/)
  await expect(page.getByTestId('character-established')).toContainText(characterName)
})
