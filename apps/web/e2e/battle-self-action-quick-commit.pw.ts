import { expect, test, type Locator, type Page } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueIdentity(prefix: string): { email: string; characterName: string } {
  const seed = `${Date.now()}${Math.floor(Math.random() * 100_000)}`
  const suffix = seed
    .slice(-7)
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')

  return {
    email: `${prefix}.${seed}@example.com`,
    characterName: `${prefix} ${suffix}`,
  }
}

async function enterGuidedBattle(page: Page) {
  const identity = uniqueIdentity('QuickGuard')
  await provisionAccountAndEnterCharacter({
    page,
    email: identity.email,
    password: 'AurevaneTest!42',
    characterName: identity.characterName,
  })

  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('guided-fundamentals')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const coach = page.getByRole('dialog', { name: 'Complete the tactical fundamentals' })
  await expect(coach).toBeVisible()
  await coach.getByRole('button', { name: 'Continue training' }).click()

  const root = page.locator("main[data-unified-battle='true'][data-battle-kind='pve']")
  await expect(root).toBeVisible()
  await expect(root).toHaveAttribute('data-local-turn', 'true')
  return root
}

async function readFacingGlyph(root: Locator, playerName: string): Promise<string> {
  return root.evaluate((element, name) => {
    const tile = Array.from(
      element.querySelectorAll<HTMLButtonElement>('#battlefield button[aria-label*="occupied by"]'),
    ).find((candidate) =>
      (candidate.getAttribute('aria-label') ?? '').includes(`occupied by ${name}`),
    )
    if (!tile) throw new Error(`Could not find ${name} on the battlefield.`)

    const marker = Array.from(tile.querySelectorAll<HTMLElement>('i, span')).find((candidate) =>
      ['↑', '→', '↓', '←'].includes(candidate.textContent?.trim() ?? ''),
    )
    const glyph = marker?.textContent?.trim()
    if (!glyph) throw new Error(`Could not read ${name}'s facing glyph.`)
    return glyph
  }, playerName)
}

async function expectFinePointerDesktopPresentation(page: Page, root: Locator) {
  expect(
    await page.evaluate(
      () => window.matchMedia('(any-hover: hover) and (any-pointer: fine)').matches,
    ),
  ).toBe(true)
  await expect(root.locator('section[aria-label="Battle roster"]')).toBeHidden()
  const rails = root.locator('aside[data-unified-combatant-rail="true"]')
  await expect(rails).toHaveCount(2)
  await expect(rails.first()).toBeVisible()
  await expect(page.locator('[data-mobile-battle-popup]')).toHaveCount(0)
}

async function openInspectAndDismiss(page: Page, root: Locator, targetName: string) {
  const inspect = root.locator(
    'section[aria-label="Command Deck"] button[data-battle-command="inspect"]',
  )
  await inspect.click()
  const target = root.locator(`#battlefield button[aria-label*="occupied by ${targetName}"]`)
  await target.click()

  const dialog = page.getByRole('dialog', { name: `${targetName} battle details` })
  await expect(dialog).toBeVisible({ timeout: 5_000 })
  const backdrop = page.locator('[data-desktop-battle-inspect="true"]')
  await expect(backdrop).toBeVisible()
  await backdrop.click({ position: { x: 5, y: 5 } })
  await expect(dialog).toBeHidden()
  await expect(inspect).not.toHaveAttribute('data-active', 'true')
  await expect(root).toBeFocused()
}

async function finishTurnKeepingFacing(page: Page, root: Locator, testRepeat = false) {
  await expect(root).toHaveAttribute('data-local-turn', 'true', { timeout: 12_000 })
  await expect(root).toHaveAttribute('data-finish-turn-hotkey-owner', 'ready', { timeout: 5_000 })
  const finish = root.locator(
    'section[aria-label="Command Deck"] button[data-battle-command="finish"]',
  )
  await expect(finish).toBeEnabled()
  await expect(finish).toContainText('Space')

  await page.keyboard.press('Space')
  await expect(root).toHaveAttribute('data-finish-turn-hotkey-last-decision', 'handled-first')
  await expect(root.getByRole('button', { name: 'Face north' })).toBeEnabled()
  await expect(root.getByRole('button', { name: 'Face east' })).toBeEnabled()
  await expect(root.getByRole('button', { name: 'Face south' })).toBeEnabled()
  await expect(root.getByRole('button', { name: 'Face west' })).toBeEnabled()

  if (testRepeat) {
    await page.evaluate(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          code: 'Space',
          key: ' ',
          repeat: true,
          bubbles: true,
          cancelable: true,
        }),
      )
    })
    await page.waitForTimeout(100)
    await expect(root).toHaveAttribute('data-local-turn', 'true')
  }

  await page.keyboard.press('Space')
  await expect(root).toHaveAttribute('data-local-turn', 'false', { timeout: 12_000 })
}

test('previews Guard on the first shortcut press and commits it only on a second deliberate press', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chromium', 'Desktop keyboard shortcut contract')
  test.slow()

  const root = await enterGuidedBattle(page)
  const deck = root.getByRole('region', { name: 'Command Deck' })
  const guard = deck.getByRole('button', { name: /Guard/ })
  const confirm = root.getByRole('button', { name: 'Confirm Action' })
  const economy = root.getByRole('progressbar', { name: 'Action Economy remaining' })

  await expect(guard).toContainText('4')
  await expect(economy).toHaveAttribute('aria-valuenow', '100')

  await page.keyboard.press('Digit4')
  await expect(confirm).toBeEnabled()
  await expect(economy).toHaveAttribute('aria-valuenow', '100')

  // Holding a key must never count as the deliberate second press. Chromium and Edge both expose
  // OS-repeat through KeyboardEvent.repeat, so synthesize that condition explicitly here.
  await page.evaluate(() => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        code: 'Digit4',
        key: '4',
        repeat: true,
        bubbles: true,
        cancelable: true,
      }),
    )
  })
  await page.waitForTimeout(100)
  await expect(confirm).toBeEnabled()
  await expect(economy).toHaveAttribute('aria-valuenow', '100')

  const commitResponse = page.waitForResponse((response) => {
    const request = response.request()
    return request.method() === 'POST' && new URL(response.url()).pathname.endsWith('/intents')
  })

  await page.keyboard.press('Digit4')
  expect((await commitResponse).status()).toBe(200)
  await expect(economy).toHaveAttribute('aria-valuenow', '70')
})

test('keeps Guard double-press reliable after Inspect closes in a narrow desktop window', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chromium', 'Physical keyboard regression')
  test.slow()

  await page.setViewportSize({ width: 750, height: 900 })
  const root = await enterGuidedBattle(page)
  await expectFinePointerDesktopPresentation(page, root)

  const inspect = root.locator(
    'section[aria-label="Command Deck"] button[data-battle-command="inspect"]',
  )
  await inspect.click()
  const target = root.locator('#battlefield button[aria-label*="occupied by Recruit"]')
  await target.click()
  const dialog = page.getByRole('dialog', { name: /Recruit battle details/ })
  await expect(dialog).toBeVisible({ timeout: 5_000 })
  const backdrop = page.locator('[data-desktop-battle-inspect="true"]')
  await backdrop.click({ position: { x: 5, y: 5 } })
  await expect(dialog).toBeHidden()
  await expect(inspect).not.toHaveAttribute('data-active', 'true')
  await expect(root).toBeFocused()

  const confirm = root.getByRole('button', { name: 'Confirm Action' })
  const economy = root.getByRole('progressbar', { name: 'Action Economy remaining' })
  await page.keyboard.press('Digit4')
  await expect(confirm).toBeEnabled()

  const commitResponse = page.waitForResponse((response) => {
    const request = response.request()
    return request.method() === 'POST' && new URL(response.url()).pathname.endsWith('/intents')
  })
  await page.keyboard.press('Digit4')
  expect((await commitResponse).status()).toBe(200)
  await expect(economy).toHaveAttribute('aria-valuenow', '70')
})

test('keeps desktop PvP Space-to-finish reliable across repeated turn handoffs', async ({
  browser,
}, testInfo) => {
  test.skip(
    !['desktop-chromium', 'desktop-edge'].includes(testInfo.project.name),
    'Focused desktop Chrome/Edge hotkey regression',
  )
  test.slow()

  const password = 'AurevaneTest!42'
  const hostIdentity = uniqueIdentity('FinishHost')
  const guestIdentity = uniqueIdentity('FinishGuest')
  const hostContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' })
  const guestContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' })
  const host = await hostContext.newPage()
  const guest = await guestContext.newPage()

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
    await expect(guest).toHaveURL(/\/game\/battle\/[0-9a-f-]+$/i, { timeout: 20_000 })

    const hostRoot = host.locator("main[data-unified-battle='true'][data-battle-kind='pvp']")
    const guestRoot = guest.locator("main[data-unified-battle='true'][data-battle-kind='pvp']")
    await expect(hostRoot).toBeVisible()
    await expect(guestRoot).toBeVisible()

    const hostFacing = await readFacingGlyph(hostRoot, hostIdentity.characterName)
    const guestFacing = await readFacingGlyph(guestRoot, guestIdentity.characterName)
    const hostStarts = (await hostRoot.getAttribute('data-local-turn')) === 'true'

    const first = hostStarts
      ? { page: host, root: hostRoot, name: hostIdentity.characterName, facing: hostFacing }
      : { page: guest, root: guestRoot, name: guestIdentity.characterName, facing: guestFacing }
    const second = hostStarts
      ? { page: guest, root: guestRoot, name: guestIdentity.characterName, facing: guestFacing }
      : { page: host, root: hostRoot, name: hostIdentity.characterName, facing: hostFacing }

    for (let cycle = 0; cycle < 5; cycle += 1) {
      if (cycle === 1) {
        await Promise.all([
          first.page.setViewportSize({ width: 750, height: 900 }),
          second.page.setViewportSize({ width: 750, height: 900 }),
        ])
        await expectFinePointerDesktopPresentation(first.page, first.root)
        await expectFinePointerDesktopPresentation(second.page, second.root)
        await openInspectAndDismiss(first.page, first.root, second.name)
      } else if (cycle === 3) {
        await Promise.all([
          first.page.setViewportSize({ width: 1280, height: 900 }),
          second.page.setViewportSize({ width: 1280, height: 900 }),
        ])
        await expectFinePointerDesktopPresentation(first.page, first.root)
        await openInspectAndDismiss(second.page, second.root, first.name)
      } else if (cycle === 4) {
        await Promise.all([
          first.page.setViewportSize({ width: 750, height: 900 }),
          second.page.setViewportSize({ width: 750, height: 900 }),
        ])
        await expectFinePointerDesktopPresentation(first.page, first.root)
        await expectFinePointerDesktopPresentation(second.page, second.root)
      }

      await finishTurnKeepingFacing(first.page, first.root, cycle === 0)
      await expect(second.root).toHaveAttribute('data-local-turn', 'true', { timeout: 12_000 })
      expect(await readFacingGlyph(first.root, first.name)).toBe(first.facing)

      await finishTurnKeepingFacing(second.page, second.root, cycle === 0)
      await expect(first.root).toHaveAttribute('data-local-turn', 'true', { timeout: 12_000 })
      expect(await readFacingGlyph(second.root, second.name)).toBe(second.facing)
      expect(await readFacingGlyph(first.root, first.name)).toBe(first.facing)
    }
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()])
  }
})
