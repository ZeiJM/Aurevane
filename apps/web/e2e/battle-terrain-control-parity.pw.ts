import { expect, test, type Page } from '@playwright/test'

import { expectTerrainKey } from './battle-map-key-helpers'
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

type BattleScaleGeometry = {
  root: { width: number; height: number }
  header: { width: number; height: number }
  economy: { width: number; height: number }
  victory: { width: number; height: number }
  terrainKey: { width: number; height: number }
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
  finish: { width: number; height: number }
}

async function captureBattleScaleGeometry(page: Page): Promise<BattleScaleGeometry> {
  const root = page.locator("main[data-unified-battle='true'][data-battle-visual-contract='true']")
  const header = root.locator(':scope > header')
  const battlefield = root.locator('#battlefield')
  const commandDeck = root.locator('[data-unified-command-deck="true"]')
  const rail = root.locator('aside[data-battle-side="local"]')
  const railCard = rail.locator('[data-battle-combatant-card="local"]')
  const footer = root.locator(':scope > footer')
  await expect(
    header.locator(
      '[data-ai-turn-clock="true"], [data-pvp-turn-clock="true"], [data-pvp-opponent-turn-clock="true"]',
    ),
  ).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  console.log(
    'terrain-control-style',
    await footer.getByRole('button', { name: 'Terrain', exact: true }).evaluate((button) => {
      const style = getComputedStyle(button)
      return {
        markup: button.outerHTML,
        root: button.closest('main')?.outerHTML.split('>')[0],
        font: style.font,
        gap: style.gap,
        padding: style.padding,
        children: Array.from(button.children, (child) => ({
          text: child.textContent,
          display: getComputedStyle(child).display,
          width: child.getBoundingClientRect().width,
        })),
      }
    }),
  )
  const surfaces = {
    root,
    header,
    economy: header.locator('[data-unified-battle-economy="true"]'),
    victory: header.getByRole('button', { name: /^Victory Conditions/i }),
    terrainKey: footer.getByRole('button', { name: 'Terrain', exact: true }),
    content: root.locator('[data-unified-battle-content="true"]'),
    rail,
    railCard,
    portrait: railCard.locator('[data-desktop-inspect-combatant]'),
    battlefield,
    board: battlefield.locator('[data-board-auto-fit="9x7"]'),
    token: battlefield.locator('button[aria-label*="occupied by"] > span:last-child').first(),
    commandDeck,
    commandContext: root.locator('[data-battle-preview-strip]'),
    commandButton: commandDeck.locator('[data-command-card] > button[data-battle-command]').first(),
    footer,
    cancel: footer.getByRole('button', { name: 'Cancel Action', exact: true }),
    finish: commandDeck.locator('[data-battle-command="finish"]'),
  }
  const geometry = {} as BattleScaleGeometry
  for (const label of Object.keys(surfaces) as (keyof BattleScaleGeometry)[]) {
    await expect(surfaces[label], `${label} scale surface`).toBeVisible()
    const box = await surfaces[label].boundingBox()
    expect(box, `${label} scale measurement`).not.toBeNull()
    geometry[label] = {
      width: Math.round(box!.width * 10) / 10,
      height: Math.round(box!.height * 10) / 10,
    }
  }
  return geometry
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
  const identity = uniqueIdentity('PvE')
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
  await host.getByRole('button', { name: 'PVP - Direct', exact: true }).click()
  // Scale parity compares the same 9×7 board in both modes.
  const smallMap = host
    .getByRole('group', { name: 'Map size' })
    .getByRole('button', { name: 'Small · 9×7', exact: true })
  await smallMap.click()
  await expect(smallMap).toHaveAttribute('aria-pressed', 'true')
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

test('keeps PvE terrain controls visually unified on desktop and mobile', async ({
  page,
}, testInfo) => {
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

  await expectTerrainKey(page)
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
    await expectTerrainKey(host)
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
      'terrainKey',
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
      'finish',
    ] as const) {
      expectBattleScaleParity(label, pve, pvp)
    }
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()])
  }
})
