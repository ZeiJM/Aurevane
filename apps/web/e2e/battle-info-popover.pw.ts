import { expect, test } from '@playwright/test'

import { createAccountAndEnterCharacter } from './pv1f-test-helpers'

const fields = [
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
]

test('shared compact readers retain complete reports and consume the first armed battlefield click', async ({
  page,
}, testInfo) => {
  test.slow()
  const seed = `${Date.now()}`
  await createAccountAndEnterCharacter({
    page,
    email: `compact-reader-${testInfo.project.name}-${seed}@example.com`,
    password: 'Compact-reader-2026!',
    characterName: `Reader ${seed
      .split('')
      .map((digit) => String.fromCharCode(65 + Number(digit)))
      .join('')}`,
  })

  const panels = page.locator('[data-battle-info-panel]')
  await page.goto('/game/nexus')
  const essence = page.getByRole('button', { name: /^Preview Essence:/ }).first()
  await essence.focus()
  await expect(panels).toHaveCount(1)
  await expect(panels.locator('dt')).toHaveText(fields)
  await expect(panels.locator('header button')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(panels).toHaveCount(0)
  await expect(essence).toBeFocused()
  // Focus-opened hover readers leave focus on the trigger. Escape must not suppress
  // the player's next deliberate focus when the trigger was already focused.
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  await expect(essence).toBeFocused()
  await expect(panels).toHaveCount(1)
  await page.keyboard.press('Escape')

  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)
  const inspect = page.getByRole('button', { name: 'About Inspect', exact: true })
  const attack = page.getByRole('button', { name: 'About Basic Attack', exact: true })
  const economy = page.locator('[data-unified-battle-economy]')
  const before = await economy.innerText()
  await inspect.click()
  await expect(panels).toHaveCount(1)
  await expect(panels).toHaveAttribute('aria-label', 'Inspect')
  await expect(panels.locator('header button')).toHaveCount(0)
  // Direct DOM activation covers keyboard/assistive activation even where the
  // current reader visually overlaps another trigger at a narrow breakpoint.
  await attack.evaluate((button) => (button as HTMLButtonElement).click())
  await expect(panels).toHaveCount(1)
  await expect(panels).toHaveAttribute('aria-label', 'Basic Attack')
  await expect(panels.locator('dt')).toHaveText(fields)
  const typography = await panels.evaluate((panel) => ({
    body: getComputedStyle(panel).fontSize,
    heading: getComputedStyle(panel.querySelector('header strong')!).fontSize,
    width: panel.getBoundingClientRect().width,
  }))
  expect(typography.body).toBe('13px')
  expect(typography.heading).toBe('16px')
  if ((await panels.getAttribute('data-battle-info-layout')) === 'compact') {
    expect(typography.width).toBeLessThanOrEqual(320)
  }
  await page.keyboard.press('Space')
  await expect(economy).toHaveText(before)
  await page.keyboard.press('Escape')
  await expect(panels).toHaveCount(0)
  await expect(attack).toBeFocused()

  const commits: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && /\/(?:commit|intents)$/.test(request.url())) {
      commits.push(request.url())
    }
  })
  await page.locator('main[data-unified-battle]').focus()
  await page.keyboard.press('Digit3')
  const ownTile = page.getByRole('button', { name: /occupied by Reader / })
  for (const label of ['About Guard', 'About selected Skill slot 1']) {
    await page.getByRole('button', { name: label, exact: true }).click()
    await expect(panels).toHaveCount(1)
    // Dispatch to the actual tile so the event reaches document capture even
    // when the phone reader visually covers that tile's pointer hit area.
    await ownTile.dispatchEvent('click')
    await expect(panels).toHaveCount(0)
    expect(commits).toHaveLength(0)
    await expect(economy).toHaveText(before)
  }
  await ownTile.click()
  await expect(page.getByRole('progressbar', { name: 'Action Economy remaining' })).toHaveAttribute(
    'aria-valuenow',
    '70',
  )
  expect(commits).toHaveLength(1)
})
