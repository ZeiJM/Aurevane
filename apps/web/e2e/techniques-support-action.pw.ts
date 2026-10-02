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
  await expect(preview).toContainText('Guarded [15%] [2 Turns]')
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
    await expect(preview).toContainText(`10% max ${name === 'HP Recovery' ? 'HP' : 'MP'}`)
    await expect(preview).toContainText('2 turns')
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

  // A populated Nexus has a larger content budget than the empty-slot state.
  dialog = await open()
  for (let index = 0; index < 4; index += 1) {
    const save = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/character/build/skills') &&
        response.request().method() === 'PUT',
    )
    await dialog.locator('[data-technique-card] input:not(:checked):not(:disabled)').first().check()
    expect((await save).ok()).toBe(true)
  }
  await expect(dialog.getByTestId('skill-capacity')).toHaveText(
    /Discipline Skills — 4 \/ 4 selected/,
  )
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await page.reload()
  await expect(page.locator('#nexus-techniques-heading')).toHaveText('Discipline Skills — 4 / 4')
  for (const [width, height] of [
    [1280, 720],
    [1366, 768],
    [1536, 614],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height })
    await expect
      .poll(() =>
        page.evaluate(() => {
          const main = document.querySelector('main')!
          return Math.max(
            main.scrollHeight - main.clientHeight,
            document.documentElement.scrollHeight - window.innerHeight,
          )
        }),
      )
      .toBeLessThanOrEqual(1)
    const workspace = page.locator('[data-arsenal-workspace]')
    const panels = workspace.locator('[data-arsenal-panel]')
    const bounds = (await workspace.boundingBox())!
    for (const panel of await panels.all()) {
      const box = (await panel.boundingBox())!
      expect(box.y + box.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1)
      expect(
        await panel.evaluate((node) => node.scrollHeight - node.clientHeight),
      ).toBeLessThanOrEqual(1)
    }
    for (const artwork of await workspace
      .locator('[data-arsenal-panel="techniques"] [data-arsenal-media]')
      .all()) {
      const box = (await artwork.boundingBox())!
      expect(box.width, 'populated Nexus retains larger readable artwork').toBeGreaterThanOrEqual(
        64,
      )
      expect(Math.abs(box.width - box.height), 'Nexus artwork stays square').toBeLessThanOrEqual(1)
    }
    await expect(page.getByTestId('nexus-support-action')).toContainText('MP Recovery')
  }
})
