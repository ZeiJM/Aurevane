import { expect, test } from '@playwright/test'

import { createAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Deletion ${letters}`
}

test('locks pending character deletion and restores playability on cancel', async ({
  page,
}, testInfo) => {
  test.slow()

  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const email = `pv1f-delete-${projectSlug}-${Date.now()}@example.com`
  const password = 'PV1F-browser-delete-2026!'
  const characterName = uniqueCharacterName()

  await createAccountAndEnterCharacter({ page, email, password, characterName })
  await page.getByRole('link', { name: 'Back to Character Select' }).click()
  await expect(page).toHaveURL(/\/game$/)

  const playLink = page.getByRole('link', { name: `Play ${characterName}` })
  const selectHref = await playLink.getAttribute('href')
  expect(selectHref).toMatch(/^\/game\/select\/[0-9a-f-]{36}$/)

  await page.getByRole('button', { name: 'Delete Character' }).click()
  const dialog = page.getByRole('dialog', { name: `Schedule deletion of ${characterName}?` })
  await expect(dialog).toBeVisible()
  const confirmationInput = dialog.locator('input')
  const scheduleButton = dialog.getByRole('button', { name: 'Start 24-hour deletion' })

  await confirmationInput.fill(`DELETE ${characterName} WRONG`)
  await expect(scheduleButton).toBeDisabled()
  await confirmationInput.fill(`DELETE ${characterName}`)
  await expect(scheduleButton).toBeEnabled()
  await scheduleButton.click()

  await expect(page.getByText('Deletion pending', { exact: true })).toBeVisible()
  await expect(
    page.getByText('This character cannot be played during the grace period.'),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: `Play ${characterName}` })).toHaveCount(0)

  const countdown = page.getByText(/^\d{2}:\d{2}:\d{2} remaining$/)
  await expect(countdown).toBeVisible()
  const firstCountdown = await countdown.textContent()
  await page.waitForTimeout(1_100)
  await expect(countdown).not.toHaveText(firstCountdown ?? '')

  if (!selectHref) throw new Error('Character select href was unavailable.')
  await page.goto(selectHref)
  await expect(page).toHaveURL(/\/game$/)
  await expect(page.getByText('Deletion pending', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: `Play ${characterName}` })).toHaveCount(0)

  await page.getByRole('button', { name: 'Cancel deletion' }).click()
  await expect(page.getByRole('link', { name: `Play ${characterName}` })).toBeVisible()
  await expect(page.getByText('Deletion pending', { exact: true })).toHaveCount(0)
})
