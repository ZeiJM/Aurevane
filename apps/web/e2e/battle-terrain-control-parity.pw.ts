import { expect, test, type Locator, type Page } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

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

async function expectTerrainControlHarmony(terrainLegend: Locator) {
  await expect(terrainLegend).toBeVisible()
  await expect(terrainLegend.getByText('Difficult Terrain')).toBeVisible()
  await expect(terrainLegend.getByText('Elevated Ground')).toBeVisible()
  await expect(terrainLegend.getByRole('switch', { name: 'Tile coordinates' })).toBeVisible()

  const geometry = await terrainLegend.evaluate((legend) => {
    const difficult = legend.children[0] as HTMLElement
    const elevated = legend.children[1] as HTMLElement
    const coordinate = legend.querySelector<HTMLElement>(
      'button[data-terrain-coordinate-toggle="true"]',
    )!
    const difficultRect = difficult.getBoundingClientRect()
    const elevatedRect = elevated.getBoundingClientRect()
    const coordinateRect = coordinate.getBoundingClientRect()

    return {
      difficultWidth: difficultRect.width,
      elevatedWidth: elevatedRect.width,
      coordinateWidth: coordinateRect.width,
      difficultHeight: difficultRect.height,
      elevatedHeight: elevatedRect.height,
      coordinateHeight: coordinateRect.height,
    }
  })

  expect(Math.abs(geometry.difficultWidth - geometry.elevatedWidth)).toBeLessThanOrEqual(1.5)
  expect(Math.abs(geometry.difficultWidth - geometry.coordinateWidth)).toBeLessThanOrEqual(1.5)
  expect(Math.abs(geometry.difficultHeight - geometry.elevatedHeight)).toBeLessThanOrEqual(1.5)
  expect(Math.abs(geometry.difficultHeight - geometry.coordinateHeight)).toBeLessThanOrEqual(1.5)
}

type BattleScaleGeometry = {
  root: { width: number; height: number }
  header: { width: number; height: number }
  economy: { width: number; height: number }
  victory: { width: number; height: number }
  roundLog: { width: number; height: number }
  content: { width: number; height: number }
  rail: { width: number; height: number }
  railCard: { width: number; height: number }
  portrait: { width: number; height: number }
  battlefield: { width: number; height: number }
  board: { width: number; height: number }
  token: { width: number; height: number }
  commandDeck: { width: number; height: number }
  commandContext: { width: number; height: number }
  commandButton: { width: number; height: number }
  footer: { width: number; height: number }
  cancel: { width: number; height: number }
  confirm: { width: number; height: number }
}

async function captureBattleScaleGeometry(page: Page): Promise<BattleScaleGeometry> {
  await expect(
    page.locator("main[data-unified-battle='true'][data-battle-visual-contract='true']"),
  ).toBeVisible()
  await expect(page.locator('#battlefield [data-board-auto-fit="9x7"]')).toBeVisible()

  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(
      "main[data-unified-battle='true'][data-battle-visual-contract='true']",
    )!
    const header = root.querySelector<HTMLElement>(':scope > header')!
    const economy = header.querySelector<HTMLElement>('[data-battle-shared-economy="true"]')!
    const victory = header.querySelector<HTMLElement>(
      '[data-battle-shared-header-action="victory"]',
    )!
    const roundLog = header.querySelector<HTMLElement>(
      '[data-battle-shared-header-action="round-log"]',
    )!
    const content = root.querySelector<HTMLElement>('[data-unified-battle-content="true"]')!
    const battlefield = root.querySelector<HTMLElement>('#battlefield')!
    const board = battlefield.querySelector<HTMLElement>('[data-board-auto-fit="9x7"]')!
    const token = battlefield.querySelector<HTMLElement>(
      'button[aria-label*="occupied by"] > span:last-child',
    )!
    const commandDeck = root.querySelector<HTMLElement>('[data-unified-command-deck="true"]')!
    const commandContext = commandDeck.firstElementChild as HTMLElement
    const commandButton = commandDeck.querySelector<HTMLElement>(
      '[data-command-card] > button[data-battle-command]',
    )!
    const footer = root.querySelector<HTMLElement>(':scope > footer')!
    const footerButtons = Array.from(footer.querySelectorAll<HTMLButtonElement>('button'))
    const cancel = footerButtons.find((button) => button.textContent?.includes('Cancel Action'))!
    const confirm = footerButtons.find((button) => button.textContent?.includes('Confirm Action'))!

    const visibleArticles = Array.from(content.querySelectorAll<HTMLElement>('aside article')).filter(
      (article) => {
        const articleRect = article.getBoundingClientRect()
        const style = window.getComputedStyle(article)
        return (
          articleRect.width > 0 &&
          articleRect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden'
        )
      },
    )
    const railCard = visibleArticles[0]!
    const rail = railCard.closest('aside') as HTMLElement
    const portrait = railCard.querySelector<HTMLElement>(
      'button[data-desktop-inspect-combatant], button[aria-label^="Show "]',
    )!

    const rect = (element: Element) => {
      const value = element.getBoundingClientRect()
      return {
        width: Math.round(value.width * 10) / 10,
        height: Math.round(value.height * 10) / 10,
      }
    }

    return {
      root: rect(root),
      header: rect(header),
      economy: rect(economy),
      victory: rect(victory),
      roundLog: rect(roundLog),
      content: rect(content),
      rail: rect(rail),
      railCard: rect(railCard),
      portrait: rect(portrait),
      battlefield: rect(battlefield),
      board: rect(board),
      token: rect(token),
      commandDeck: rect(commandDeck),
      commandContext: rect(commandContext),
      commandButton: rect(commandButton),
      footer: rect(footer),
      cancel: rect(cancel),
      confirm: rect(confirm),
    }
  })
}

function expectBattleScaleParity(
  label: keyof BattleScaleGeometry,
  pve: BattleScaleGeometry,
  pvp: BattleScaleGeometry,
  tolerance = 1.5,
) {
  expect(
    Math.abs(pve[label].width - pvp[label].width),
    `${label} width drift: PvE ${pve[label].width}px vs PvP ${pvp[label].width}px`,
  ).toBeLessThanOrEqual(tolerance)
  expect(
    Math.abs(pve[label].height - pvp[label].height),
    `${label} height drift: PvE ${pve[label].height}px vs PvP ${pvp[label].height}px`,
  ).toBeLessThanOrEqual(tolerance)
}

async function enterScaleParityPveBattle(page: Page) {
  const identity = uniqueIdentity('ScalePvE')
  await provisionAccountAndEnterCharacter({
    page,
    email: identity.email,
    password: 'AurevaneTest!42',
    characterName: identity.characterName,
  })
  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)
}

async function enterScaleParityPvpBattle(host: Page, guest: Page) {
  const hostIdentity = uniqueIdentity('ScaleHost')
  const guestIdentity = uniqueIdentity('ScaleGuest')
  const password = 'AurevaneTest!42'

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

  await host.goto('/game/battle')
  await host.getByRole('button', { name: /Player vs Player/ }).click()
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
}

test('keeps PvE terrain controls visually unified on desktop and mobile', async ({ page }, testInfo) => {
  test.skip(
    !['desktop-chromium', 'mobile-chromium'].includes(testInfo.project.name),
    'Shared terrain-control parity targets desktop and mobile',
  )
  test.slow()

  const identity = uniqueIdentity('TerrainPvE')
  const password = 'AurevaneTest!42'

  await provisionAccountAndEnterCharacter({
    page,
    email: identity.email,
    password,
    characterName: identity.characterName,
  })
  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const battlefield = page.getByRole('region', { name: 'Tactical battlefield' })
  const terrainLegend = battlefield.locator(':scope > [aria-label="Terrain legend"]')
  await expectTerrainControlHarmony(terrainLegend)
})

test('keeps PvP terrain controls visually unified on desktop and mobile', async ({
  browser,
}, testInfo) => {
  test.skip(
    !['desktop-chromium', 'mobile-chromium'].includes(testInfo.project.name),
    'Shared terrain-control parity targets desktop and mobile',
  )
  test.slow()

  const mobile = testInfo.project.name === 'mobile-chromium'
  const contextOptions = mobile
    ? {
        baseURL: 'http://127.0.0.1:3100',
        viewport: { width: 412, height: 915 },
        isMobile: true,
        hasTouch: true,
      }
    : {
        baseURL: 'http://127.0.0.1:3100',
        viewport: { width: 1536, height: 614 },
      }

  const hostContext = await browser.newContext(contextOptions)
  const guestContext = await browser.newContext(contextOptions)
  const host = await hostContext.newPage()
  const guest = await guestContext.newPage()
  const hostIdentity = uniqueIdentity('TerrainHost')
  const guestIdentity = uniqueIdentity('TerrainGuest')
  const password = 'AurevaneTest!42'

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

    await host.goto('/game/battle')
    await host.getByRole('button', { name: /Player vs Player/ }).click()
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
    const battlefield = host.locator("main[data-battle-kind='pvp'] #battlefield")
    const terrainLegend = battlefield.locator(':scope > [aria-label="Terrain legend"]')
    await expectTerrainControlHarmony(terrainLegend)
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()])
  }
})

test('keeps PvE desktop battle scale locked to PvP', async ({ browser, page }, testInfo) => {
  test.skip(
    !['desktop-chromium', 'laptop-chromium'].includes(testInfo.project.name),
    'Desktop/laptop scale parity is validated separately from compact mobile composition',
  )
  test.slow()

  await enterScaleParityPveBattle(page)
  const pve = await captureBattleScaleGeometry(page)

  const viewport = page.viewportSize() ?? { width: 1440, height: 900 }
  const contextOptions = {
    baseURL: 'http://127.0.0.1:3100',
    viewport,
  }
  const hostContext = await browser.newContext(contextOptions)
  const guestContext = await browser.newContext(contextOptions)
  const host = await hostContext.newPage()
  const guest = await guestContext.newPage()

  try {
    await enterScaleParityPvpBattle(host, guest)
    const pvp = await captureBattleScaleGeometry(host)

    console.log('battle-scale-parity', JSON.stringify({ pve, pvp }))

    for (const label of [
      'root',
      'header',
      'economy',
      'victory',
      'roundLog',
      'content',
      'rail',
      'railCard',
      'portrait',
      'battlefield',
      'board',
      'token',
      'commandDeck',
      'commandContext',
      'commandButton',
      'footer',
      'cancel',
      'confirm',
    ] as const) {
      expectBattleScaleParity(label, pve, pvp)
    }
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()])
  }
})
