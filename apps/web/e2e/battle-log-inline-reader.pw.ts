import { expect, test } from '@playwright/test'

import type { BattleLogEntry } from '../src/server/battle/battle-log-service'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'
import { commitGesture } from './refined-battle-helpers'

function fixtureEntry(action: number, turn: number): BattleLogEntry {
  return {
    battleVersion: action,
    eventIndex: 0,
    occurredAt: '2026-10-02T09:00:00.000Z',
    eventType: 'damage_applied',
    message: `Target takes ${action} damage.`,
    messageTemplate: '{target} takes {amount} damage.',
    templateValues: { amount: String(action) },
    actorCombatantId: 'character:fixture',
    targetCombatantId: 'recruit:fixture',
    actionId: 'basic.attack.unarmed.basic',
    actionLabel: `Recorded action ${action}`,
    round: 1,
    turnNumber: turn,
    kind: 'offense',
    headline: `Recorded action ${action}`,
    tone: 'damage',
    facts: [{ label: `Complete result ${action}`, tone: 'damage' }],
  }
}

test('pages long Battle Log turns inline and preserves reviewed history after a live commit', async ({
  page,
}, testInfo) => {
  test.slow()
  const suffix = String(Date.now())
    .slice(-8)
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  const characterName = `Log ${suffix}`
  await provisionAccountAndEnterCharacter({
    page,
    email: `inline-log.${Date.now()}.${testInfo.project.name}@example.com`,
    password: 'AurevaneTest!42',
    characterName,
  })

  // Only the read presentation is synthetic; the refresh below follows a real Guard commit.
  let entries = [...Array.from({ length: 20 }, (_, index) => fixtureEntry(index + 1, 1))]
  await page.route('**/api/battles/*/events', async (route) => {
    const battleSessionId = new URL(route.request().url()).pathname.split('/')[3]!
    await route.fulfill({ json: { battleLog: { battleSessionId, entries } } })
  })
  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)
  const log = page.locator('[data-battle-inline-log]')
  const reader = log.getByRole('region', { name: 'Recorded action result', exact: true })
  await expect(reader).toHaveAttribute('data-selected-action', 'battle:20')
  await expect(log.locator('[data-battle-log-reading]')).toHaveAttribute('data-measured', 'true')
  await expect(reader.locator('[data-reader-part="Result"] p')).toBeVisible()
  await expect(reader).toContainText('20 damage')
  await expect(page.locator('dialog[data-battle-action-details]')).toHaveCount(0)
  const before = await page.locator('[data-board-auto-fit]').boundingBox()

  // Every older action remains reachable through labelled pages, with no scrolling.
  const previousPage = log.getByRole('button', { name: 'Previous actions', exact: true })
  for (let pageNumber = 0; pageNumber < 20 && (await previousPage.isVisible()); pageNumber++) {
    if (!(await previousPage.isEnabled())) break
    await previousPage.click()
  }
  const firstAction = log.getByRole('button', {
    name: /Action details:.*Recorded action 1(?:\D|$)/,
  })
  await expect(firstAction).toBeVisible()
  await firstAction.click()
  await expect(reader).toHaveAttribute('data-selected-action', 'battle:1')
  await expect(reader).toContainText('1 damage')
  await expect(log.locator('[data-battle-log-reading]')).toHaveAttribute('data-measured', 'true')
  const geometry = await log.locator('[data-battle-log-reading]').evaluate((element) => ({
    horizontal: element.scrollWidth - element.clientWidth,
    vertical: element.scrollHeight - element.clientHeight,
  }))
  expect(geometry.horizontal).toBeLessThanOrEqual(1)
  expect(geometry.vertical).toBeLessThanOrEqual(1)
  expect(await page.locator('[data-board-auto-fit]').boundingBox()).toEqual(before)

  entries = [...entries, fixtureEntry(21, 2)]
  const refreshed = page.waitForResponse(
    (response) => response.url().endsWith('/events') && response.request().method() === 'GET',
  )
  const deck = page.getByRole('region', { name: 'Command Deck' })
  await deck.getByRole('button', { name: /^Guard,/ }).click()
  await commitGesture(
    page,
    page.getByRole('button', { name: new RegExp(`occupied by ${characterName}`) }),
  )
  await refreshed
  await expect(log.getByRole('button', { name: 'Next turn', exact: true })).toBeVisible()
  await expect(reader).toHaveAttribute('data-selected-action', 'battle:1')
  await expect(reader).toContainText('1 damage')
  await expect(reader).not.toHaveAttribute('data-selected-action', 'battle:21')
  await log.getByRole('button', { name: 'Next turn', exact: true }).click()
  await expect(reader).toHaveAttribute('data-selected-action', 'battle:21')
  await expect(reader).toContainText('21 damage')
  await expect(log.getByRole('button', { name: 'Next turn', exact: true })).toHaveCount(0)
  await testInfo.attach('inline-log-history-after-refresh', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
})
