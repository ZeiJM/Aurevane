import { expect, test } from '@playwright/test'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

// Keep the screenshots and interaction trace when this release gate passes, too.
test.use({ trace: 'on' })

test('Ironfist provisions normally and Skill details preserve selection on phone and desktop', async ({
  page,
}, testInfo) => {
  test.setTimeout(150000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const suffix = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(97 + Number(digit)))
    .join('')
  await provisionAccountAndEnterCharacter({
    page,
    email: `phase4-${testInfo.project.name}-${Date.now()}@example.com`,
    password: 'Phase4-disposable-browser-2026!',
    characterName: `Roster ${suffix}`,
  })
  await page.getByRole('button', { name: /Manage Primary Discipline/ }).click()
  const management = page.getByRole('dialog', { name: 'Discipline Management' })
  await expect(management).toBeVisible()
  await page.reload()
  await expect(management).toBeVisible()
  await management
    .locator('label')
    .filter({ hasText: /^Proposed Primary/ })
    .locator('select')
    .selectOption('ironfist')
  await page.getByRole('button', { name: 'Commit Ironfist as Primary' }).click()
  await expect(page.getByTestId('primary-discipline-chip')).toHaveText('Ironfist')
  await management.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('button', { name: /Manage Techniques/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Techniques', exact: true })
  const list = page.getByTestId('learned-skill-list')
  await expect(list.locator('article')).toHaveCount(8)
  await expect(page.getByTestId('active-essence')).toHaveText('Hundredfold Rush')
  const palm = list.locator('article').filter({ hasText: 'Counter Palm' })
  await palm.locator('summary').click()
  await expect(palm).toContainText('Requires Guarded on yourself.')
  await expect(palm).toContainText('1 tile')
  await expect(palm.getByRole('checkbox')).not.toBeChecked()
  const sweep = list.locator('article').filter({ hasText: 'Sweep' })
  await expect(sweep).toContainText('Area · radius 1')
  for (const name of ['Rising Fist', 'Sweep', 'Breakfall', 'Counter Palm']) {
    await list.locator('article').filter({ hasText: name }).getByRole('checkbox').check()
  }
  // The profile refresh can remount the panel and clear its transient status.
  // Verify the authoritative save, then independently check persisted selections.
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/character/build/skills') &&
      response.request().method() === 'PUT',
  )
  await page.getByRole('button', { name: 'Commit Selected Techniques' }).click()
  expect((await saved).status()).toBe(200)
  await page.reload()
  await expect(dialog).toBeVisible()
  await expect(list.locator('input:checked')).toHaveCount(4)
  for (const name of ['Rising Fist', 'Sweep', 'Breakfall', 'Counter Palm']) {
    await expect(
      list.locator('article').filter({ hasText: name }).getByRole('checkbox'),
    ).toBeChecked()
  }
  await palm.locator('summary').click()
  const overflow = await dialog.evaluate((element) => element.scrollWidth > element.clientWidth + 1)
  expect(overflow).toBe(false)
  expect(await palm.evaluate((element) => element.scrollHeight > element.clientHeight + 1)).toBe(
    false,
  )
  await testInfo.attach(`phase4-skills-${testInfo.project.name}`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  const arena = page.getByLabel('AI sparring arena')
  await expect(arena).toBeVisible()
  await arena.selectOption('crossroads-court')
  await expect(arena).toHaveValue('crossroads-court')
  await arena.selectOption('terraced-yard')
  await expect(arena).toHaveValue('terraced-yard')
  await testInfo.attach(`phase4-arena-${testInfo.project.name}`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  for (const [id, dimensions, tiles, name] of [
    ['crossroads-court', '7x7', 49, 'Crossroads Court'],
    ['terraced-yard', '11x7', 77, 'Terraced Yard'],
  ] as const) {
    await arena.selectOption(id)
    await page.getByRole('button', { name: 'Enter Battle', exact: true }).click()
    await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)
    const root = page.locator("main[data-unified-battle='true'][data-battle-kind='pve']")
    const board = root.locator('#battlefield [data-board-auto-fit]')
    await expect(board).toHaveAttribute('data-board-auto-fit', dimensions)
    await expect(board.locator('button[aria-label^="Tile "]')).toHaveCount(tiles)
    await page.reload()
    await expect(board).toHaveAttribute('data-board-auto-fit', dimensions)
    await testInfo.attach(`phase4-${id}-${testInfo.project.name}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
    await root.getByRole('button', { name: 'Surrender', exact: true }).click()
    await page
      .getByRole('dialog', { name: 'Surrender this battle?' })
      .getByRole('button', { name: 'Confirm Surrender' })
      .click()
    const result = page.getByTestId('battle-result-overlay')
    await expect(result).toBeVisible()
    await expect(result).toContainText(name)
    await result.getByRole('button', { name: 'Return to Battle Hall' }).click()
    await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  }
  expect(errors).toEqual([])
})

test('Phase 4 preserves testing access and shows advanced Skills and descriptive tradeoffs', async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.AUREVANE_PV2_TEST_MODE !== '1',
    'Uses the existing isolated CI mastery fixture.',
  )
  test.setTimeout(150000)
  const suffix = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(97 + Number(digit)))
    .join('')
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await provisionAccountAndEnterCharacter({
    page,
    email: `p4-advanced-${testInfo.project.name}-${Date.now()}@example.com`,
    password: 'P4-advanced-disposable-2026!',
    characterName: `Mastery ${suffix}`,
  })
  await page.getByRole('button', { name: /Manage Primary Discipline/ }).click()
  const management = page.getByRole('dialog', { name: 'Discipline Management' })
  await management.getByText('Mastery & unlocks', { exact: true }).click()
  await expect(management.getByRole('progressbar')).toHaveCount(16)
  await expect(management).toContainText('Master · 1000/1,000 XP')
  const primary = management
    .locator('label')
    .filter({ hasText: /^Proposed Primary/ })
    .locator('select')
  await expect(primary.locator('option[value="bastion"]')).toHaveCount(1)
  // Existing Owner-authorized testing grants cover all active Disciplines.
  // Earned prerequisites and 4/2/2 acquisition are independently verified in database CI.
  await primary.selectOption('bastion')
  await page.getByRole('button', { name: 'Commit Bastion as Primary' }).click()
  await expect(page.getByTestId('primary-discipline-chip')).toHaveText('Bastion')
  await management.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('button', { name: /Manage Techniques/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Techniques', exact: true })
  const list = page.getByTestId('learned-skill-list')
  await expect(list.locator('article')).toHaveCount(8)
  await expect(page.getByTestId('active-essence')).toHaveText('Last Bastion')
  const fortress = list.locator('article').filter({ hasText: 'Fortress' })
  await expect(fortress).toContainText('Fortified')
  await fortress.locator('summary').click()
  await expect(fortress).toContainText('Take 30% less damage and deal 20% less damage.')
  await expect(fortress).toContainText('to yourself')
  expect(await dialog.evaluate((element) => element.scrollWidth > element.clientWidth + 1)).toBe(
    false,
  )
  await testInfo.attach(`phase4-advanced-${testInfo.project.name}`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('mastery-trial')
  await expect(page.getByRole('button', { name: 'Easy', exact: true })).toHaveCount(0)
  await expect(page.getByLabel('AI sparring arena')).toHaveValue('crossroads-court')
  await expect(page.getByText(/50 Mastery XP/)).toBeVisible()
  expect(errors).toEqual([])
})
