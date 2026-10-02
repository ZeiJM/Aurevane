import { expect, test } from '@playwright/test'

import { expectTerrainKey } from './battle-map-key-helpers'
import {
  expectBattleFlowKeepsBoardSize,
  expectBattleReferenceLayout,
} from './battle-reference-layout-helpers'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'
import { commitGesture } from './refined-battle-helpers'
import { expectReadableBattleLog } from './battle-log-layout-helpers'

test('battle-log geometry ignores scrolling but rejects a reader resize', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.setContent(`
    <style>
      body { margin: 0; }
      main { height: 300px; overflow: auto; }
      .spacer { height: 700px; }
      [data-battle-inline-log] { width: 264px; height: 200px; }
      header, [aria-label="Battle history turns"] { height: 28px; }
      ol { margin: 0; padding: 0; height: 44px; scrollbar-width: none; }
      [data-battle-log-reading] { height: 100px; }
    </style>
    <main><div class="spacer"></div><aside data-battle-inline-log>
      <header><button aria-label="Switch to Text log">Timeline</button></header>
      <div data-view><div aria-label="Battle history turns"><span>Turn 1</span></div>
        <ol aria-label="Battle action timeline"><li>Guard</li></ol>
        <div data-battle-log-reading><section role="region" aria-label="Recorded action result">Guard recorded</section></div>
      </div>
    </aside></main>
    <script>
      document.querySelector('header button').onclick = (event) => {
        const button = event.currentTarget;
        const textMode = button.textContent === 'Timeline';
        button.textContent = textMode ? 'Text log' : 'Timeline';
        button.setAttribute('aria-label', textMode ? 'Switch to Timeline' : 'Switch to Text log');
        document.querySelector('ol').setAttribute('aria-label', textMode ? 'Battle action transcript' : 'Battle action timeline');
      };
    </script>
  `)
  await expectReadableBattleLog(page, testInfo, 'nested-scroll')
  expect(await page.locator('main').evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  await page.locator('header button').evaluate((button) => {
    button.addEventListener(
      'click',
      () => {
        const log = document.querySelector<HTMLElement>('[data-battle-inline-log]')!
        log.style.height = '240px'
      },
      { once: true },
    )
  })
  await expect(expectReadableBattleLog(page, testInfo, 'reader-resize')).rejects.toThrow(
    /log height stays fixed/,
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
      root
        .locator('[data-battle-inline-log]')
        .getByRole('button', { name: /^Action details:.*Guard/ }),
    ).toBeVisible()
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
    await expect(spectatorLog.getByRole('button', { name: 'Switch to Text log' })).toBeVisible()
    await expectReadableBattleLog(spectator, testInfo, 'spectator-short-log', spectatorLog)
    const chat = spectatorRoot
      .locator('details')
      .filter({ has: spectator.getByText('Battle Chat', { exact: true }) })
    await chat.locator('summary').click()
    await expect(chat).toHaveAttribute('open', '')
    await expect(chat.getByRole('textbox')).toBeVisible()
    await chat.locator('summary').click()
    await expect(chat).not.toHaveAttribute('open', '')
    await spectatorLog.getByRole('button', { name: 'Switch to Text log' }).click()
    const history = spectatorLog.getByRole('list', {
      name: 'Battle action transcript',
      exact: true,
    })
    await expect(history).toBeVisible()
    await expect(history).not.toContainText('temporarily unavailable')
    await expect(history).toContainText('Guard')
    await spectatorLog.getByRole('button', { name: 'Switch to Timeline', exact: true }).click()
    await expect(history).toHaveCount(0)

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
