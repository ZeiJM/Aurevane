import { expect, test } from '@playwright/test'

import { expectTerrainKey } from './battle-map-key-helpers'
import {
  expectBattleFlowKeepsBoardSize,
  expectBattleReferenceLayout,
} from './battle-reference-layout-helpers'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'
import { commitGesture } from './refined-battle-helpers'
import { expectReadableBattleLog } from './battle-log-layout-helpers'
import { recordedChronicleAction } from './battle-log-chronicle-fixtures'

test('actual battle-log geometry ignores mobile scrolling but rejects a reader resize', async ({
  page,
}, testInfo) => {
  test.slow()
  await page.setViewportSize({ width: 390, height: 844 })
  const identity = uniqueIdentity('ScrollLog')
  await provisionAccountAndEnterCharacter({
    page,
    ...identity,
    password: 'AurevaneTest!42',
  })
  const entries = Array.from({ length: 20 }, (_, index) =>
    recordedChronicleAction(index + 1),
  ).flat()
  await page.route('**/api/battles/*/events', async (route) => {
    const battleSessionId = new URL(route.request().url()).pathname.split('/')[3]!
    await route.fulfill({ json: { battleLog: { battleSessionId, entries } } })
  })
  await page.goto('/game/battle')
  await page.getByRole('button', { name: 'Enter Battle', exact: true }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)
  const reader = page.locator('[data-battle-inline-log] [data-battle-chronicle]')
  await expect(reader.locator('[data-chronicle-action]')).toHaveCount(20)
  await expectReadableBattleLog(page, testInfo, 'actual-mobile-scroll')
  expect(
    await reader.evaluate((element) => element.scrollHeight - element.clientHeight),
  ).toBeGreaterThan(0)
  await reader.evaluate(async (element) => {
    element.scrollTop = element.scrollHeight
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
    element.addEventListener(
      'scroll',
      () => {
        const log = element.closest<HTMLElement>('[data-battle-inline-log]')!
        log.style.height = `${log.getBoundingClientRect().height + 40}px`
      },
      { once: true },
    )
  })
  await expect(expectReadableBattleLog(page, testInfo, 'reader-resize')).rejects.toThrow(
    /stays fixed while reading the chronicle/,
  )
})

function uniqueIdentity(prefix: string): { email: string; characterName: string } {
  const seed = `${Date.now()}${Math.floor(Math.random() * 100_000)}`
  const nameSuffix = seed
    .slice(-7)
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')

  return {
    email: `${prefix}.${seed}@example.com`,
    characterName: `${prefix} ${nameSuffix}`,
  }
}

test('keeps the desktop PvP battle flow beside compact commands without resizing the battlefield', async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop PvP battle-log regression')
  test.setTimeout(180_000)

  const password = 'AurevaneTest!42'
  const hostIdentity = uniqueIdentity('LogHost')
  const guestIdentity = uniqueIdentity('LogGuest')
  const spectatorIdentity = uniqueIdentity('LogSpectator')
  const hostContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:3100',
    viewport: { width: 1536, height: 614 },
  })
  const guestContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:3100',
    viewport: { width: 1536, height: 614 },
  })
  const spectatorContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:3100',
    viewport: { width: 1536, height: 614 },
  })
  const host = await hostContext.newPage()
  const guest = await guestContext.newPage()
  const spectator = await spectatorContext.newPage()

  try {
    await provisionAccountAndEnterCharacter({
      page: host,
      email: hostIdentity.email,
      password,
      characterName: hostIdentity.characterName,
    })
    await provisionAccountAndEnterCharacter({
      page: guest,
      email: guestIdentity.email,
      password,
      characterName: guestIdentity.characterName,
    })
    await provisionAccountAndEnterCharacter({
      page: spectator,
      email: spectatorIdentity.email,
      password,
      characterName: spectatorIdentity.characterName,
    })

    await host.goto('/game/battle')
    await host.getByRole('button', { name: 'PVP - Direct', exact: true }).click()
    await host.getByRole('button', { name: 'Create Battle Lobby' }).click()

    const hostDialog = host.getByRole('dialog', { name: 'The arena is waiting.' })
    await expect(hostDialog).toBeVisible()
    const lobbyKey = (
      await hostDialog
        .locator('button')
        .filter({ hasText: 'Lobby Key' })
        .locator('strong')
        .textContent()
    )?.trim()
    expect(lobbyKey).toMatch(/^AVL-[A-Z0-9]{4}-[A-Z0-9]{4}$/)

    await guest.goto(`/game/battle?join=${encodeURIComponent(lobbyKey!)}`)
    const guestDialog = guest.getByRole('dialog', { name: 'The arena is waiting.' })
    await expect(guestDialog).toBeVisible()
    await guestDialog.getByRole('button', { name: 'Mark Ready' }).click()
    await hostDialog.getByRole('button', { name: 'Mark Ready' }).click()

    await expect(host).toHaveURL(/\/game\/battle\/[0-9a-f-]+$/i, { timeout: 20_000 })

    const root = host.locator("main[data-pvp-battle='true']")
    await expect(root).toBeVisible()
    await expect(guest.locator("main[data-pvp-battle='true']")).toBeVisible()
    const hostHasTurn = (await root.getAttribute('data-local-turn')) === 'true'
    const activePage = hostHasTurn ? host : guest
    const activeRoot = activePage.locator("main[data-pvp-battle='true']")
    const activeName = hostHasTurn ? hostIdentity.characterName : guestIdentity.characterName
    await activeRoot
      .getByRole('region', { name: 'Command Deck' })
      .getByRole('button', { name: /^Guard,/ })
      .click()
    await commitGesture(
      activePage,
      activeRoot.getByRole('button', { name: new RegExp(`occupied by ${activeName}`) }),
    )
    await expect(
      root.locator('[data-battle-inline-log]').locator('[data-battle-chronicle]'),
    ).toContainText('Guard')
    const spectatorKey = (
      await root.locator("[data-pvp-spectator-key='true'] strong").textContent()
    )?.trim()
    expect(spectatorKey).toMatch(/^AVB-[A-Z0-9]{4}-[A-Z0-9]{4}$/)

    await spectator.goto('/game/battle')
    await spectator.getByRole('button', { name: 'Spectate', exact: true }).click()
    await spectator.getByLabel('Battle Key').fill(spectatorKey!)
    const historyResponse = spectator.waitForResponse((response) =>
      /\/api\/battles\/[^/]+\/events(?:\?|$)/.test(response.url()),
    )
    await spectator.getByRole('button', { name: 'Spectate Battle' }).click()
    await expect(spectator).toHaveURL(
      new RegExp(`/game/battle/spectate/${spectatorKey!.replaceAll('-', '\\-')}$`),
      { timeout: 20_000 },
    )

    const spectatorRoot = spectator.locator("main[data-pvp-spectator='true']")
    await expect(spectatorRoot).toBeVisible()
    expect((await historyResponse).ok()).toBe(true)
    const spectatorLog = spectatorRoot.locator('[data-battle-inline-log]')
    await expect(spectatorLog).toBeVisible()
    await expect(spectatorLog.getByRole('region', { name: 'Battle chronicle' })).toBeVisible()
    await expectReadableBattleLog(spectator, testInfo, 'spectator-short-log', spectatorLog)
    const chat = spectatorRoot
      .locator('details')
      .filter({ has: spectator.getByText('Battle Chat', { exact: true }) })
    await chat.locator('summary').click()
    await expect(chat).toHaveAttribute('open', '')
    await expect(chat.getByRole('textbox')).toBeVisible()
    await chat.locator('summary').click()
    await expect(chat).not.toHaveAttribute('open', '')
    const history = spectatorLog.getByRole('region', { name: 'Battle chronicle', exact: true })
    await expect(history).toBeVisible()
    await expect(history).not.toContainText('temporarily unavailable')
    await expect(history).toContainText('Guard')
    await expect(history.locator('[data-chronicle-actor]')).toHaveCount(1)
    await expect(history.locator('[data-chronicle-actor] > h3')).toHaveText(activeName)
    await expect(
      history.getByRole('button', { name: 'Explain Guarded', exact: true }),
    ).toBeVisible()

    await expect(root.locator('[data-battle-inline-log]')).toBeVisible()
    await expectTerrainKey(host)
    await expectBattleReferenceLayout(host, testInfo, 'combat-pvp-short-window')
    await expectReadableBattleLog(host, testInfo, 'pvp-short-log')
    await expectBattleFlowKeepsBoardSize(host)
    for (const size of [
      { width: 2400, height: 1350 },
      { width: 1440, height: 900 },
      { width: 1280, height: 720 },
      { width: 1024, height: 576 },
    ]) {
      await host.setViewportSize(size)
      await expectBattleReferenceLayout(host, testInfo, `combat-pvp-${size.width}x${size.height}`)
      await expectReadableBattleLog(host, testInfo, `pvp-log-${size.width}x${size.height}`)
      await expectBattleFlowKeepsBoardSize(host)
    }
    await host.reload()
    await expect(root.locator('[data-battle-inline-log]')).toBeVisible()
    await expectBattleReferenceLayout(host, testInfo, 'combat-pvp-history-after-reload')
  } finally {
    await Promise.allSettled([hostContext.close(), guestContext.close(), spectatorContext.close()])
  }
})
