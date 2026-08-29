import { expect, test, type Locator } from '@playwright/test'

import {
  createAccountAndEnterCharacter,
  provisionAccountAndEnterCharacter,
} from './pv1f-test-helpers'

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

test('keeps PvE terrain controls visually unified on desktop and mobile', async ({ page }, testInfo) => {
  test.skip(
    !['desktop-chromium', 'mobile-chromium'].includes(testInfo.project.name),
    'Shared terrain-control parity targets desktop and mobile',
  )
  test.slow()

  const identity = uniqueIdentity('TerrainPvE')
  const password = 'AurevaneTest!42'

  await createAccountAndEnterCharacter({
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
