import { expect, test } from '@playwright/test'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

test('Techniques saves one Support Action separately from four Discipline Skills', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One authenticated desktop flow proves build persistence.',
  )
  const seed = Date.now()
  await provisionAccountAndEnterCharacter({
    page,
    email: `support-ui-${seed}@example.com`,
    password: 'Support-ui-2026!',
    characterName: `Support ${String(seed)
      .split('')
      .map((x) => String.fromCharCode(65 + Number(x)))
      .join('')}`,
  })
  await page.goto('/game/nexus')
  const open = async () => {
    await page
      .getByTestId('skill-build-panel')
      .getByRole('button', { name: /Manage Techniques/ })
      .click()
    return page.getByRole('dialog', { name: 'Techniques' })
  }
  let dialog = await open()
  const initialCount = (await dialog.getByTestId('skill-capacity').textContent()) ?? ''
  expect(initialCount).toMatch(/Discipline Skills — 0 \/ 4 selected/)
  await expect(dialog.getByRole('radio', { name: 'Guard', exact: true })).toBeChecked()
  await dialog.getByRole('radio', { name: 'Guard', exact: true }).focus()
  const preview = dialog.getByTestId('technique-preview')
  for (const label of [
    'Skill Type',
    'Cost',
    'Cooldown',
    'Requirements',
    'Effects',
    'Range',
    'Target',
    'Target Method',
    'Target Elevation',
    'Line of Sight',
  ]) {
    await expect(preview.locator('dt', { hasText: new RegExp(`^${label}$`) })).toBeVisible()
  }
  await expect(preview).toContainText('15% less incoming damage')
  await expect(preview).toContainText('2 Turns')
  for (const name of ['HP Recovery', 'MP Recovery']) {
    const save = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/character/build/support-action') &&
        response.request().method() === 'POST',
    )
    await dialog.getByRole('radio', { name, exact: true }).check()
    expect((await save).ok()).toBe(true)
    await expect(dialog.getByRole('radio', { name, exact: true })).toBeChecked()
    await expect(preview).toContainText(`10% maximum ${name === 'HP Recovery' ? 'HP' : 'MP'}`)
    await expect(preview).toContainText('2 owner turns, shared by HP / MP Recovery')
    await expect(dialog.getByTestId('skill-capacity')).toHaveText(initialCount)
  }
  const skill = dialog.locator('[data-technique-card] input:not(:checked):not(:disabled)').first()
  const disciplineSave = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/character/build/skills') &&
      response.request().method() === 'PUT',
  )
  await skill.check()
  expect((await disciplineSave).ok()).toBe(true)
  await expect(dialog.getByRole('radio', { name: 'MP Recovery', exact: true })).toBeChecked()
  const clear = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/character/build/skills') &&
      response.request().method() === 'PUT',
  )
  await dialog.getByRole('button', { name: /Clear Selections/ }).click()
  expect((await clear).ok()).toBe(true)
  await expect(dialog.getByTestId('skill-capacity')).toHaveText(
    /Discipline Skills — 0 \/ 4 selected/,
  )
  await expect(dialog.getByRole('radio', { name: 'MP Recovery', exact: true })).toBeChecked()
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page).not.toHaveURL(/profilePanel=techniques/)
  await expect(page.getByTestId('nexus-support-action')).toContainText('MP Recovery')
  await page.reload()
  await expect(page.getByTestId('nexus-support-action')).toContainText('MP Recovery')
  dialog = await open()
  await expect(dialog.getByRole('radio', { name: 'MP Recovery', exact: true })).toBeChecked()
  // A failed write restores the committed choice and does not consume a Discipline slot.
  await page.route('**/api/character/build/support-action', (route) =>
    route.fulfill({
      status: 409,
      json: { error: { message: 'The build changed. Please refresh.' } },
    }),
  )
  await dialog.getByRole('radio', { name: 'Guard', exact: true }).check()
  await expect(dialog.getByRole('status')).toHaveText('The build changed. Please refresh.')
  await expect(dialog.getByRole('radio', { name: 'MP Recovery', exact: true })).toBeChecked()
  await expect(dialog.getByTestId('skill-capacity')).toHaveText(
    /Discipline Skills — 0 \/ 4 selected/,
  )
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByTestId('nexus-support-action')).toContainText('MP Recovery')
})
