import { expect, test, type Page } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

const SHARED_HEADER =
  /^(Steel is drawn\. The battle is underway\.|Stand fast\. The field belongs to the resolute\.|Hold your nerve\. One clear move can turn the tide\.|Press forward\. Fortune follows the decisive\.|Every step has weight\. Make this one count\.)$/

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

async function expectSharedHeader(root: ReturnType<Page['locator']>) {
  const message = root.locator('[data-battle-header-message="true"]')
  await expect(message).toBeVisible()
  await expect(message).toHaveText(SHARED_HEADER)
}

async function expectMobileTokenMeters(root: ReturnType<Page['locator']>) {
  const occupied = root.locator('#battlefield button[aria-label*="occupied by"]')
  const count = await occupied.count()
  expect(count).toBeGreaterThan(0)

  for (let index = 0; index < count; index += 1) {
    const tile = occupied.nth(index)
    const token = tile.locator(':scope > [data-battle-shared-token="true"]')
    await expect(token).toHaveCount(1)
    const meters = token.locator(':scope > [data-mobile-token-meters="true"]')
    await expect(meters).toHaveCount(1)
    await expect(meters.locator('[data-mobile-token-meter="hp"]')).toHaveCount(1)
    await expect(meters.locator('[data-mobile-token-meter="mp"]')).toHaveCount(1)

    const geometry = await tile.evaluate((element) => {
      const tokenElement = element.querySelector<HTMLElement>(
        ':scope > [data-battle-shared-token="true"]',
      )!
      const meterElement = tokenElement.querySelector<HTMLElement>(
        ':scope > [data-mobile-token-meters="true"]',
      )!
      const hpTrack = meterElement.querySelector<HTMLElement>('[data-mobile-token-meter="hp"]')!
      const mpTrack = meterElement.querySelector<HTMLElement>('[data-mobile-token-meter="mp"]')!
      const hp = hpTrack.querySelector<HTMLElement>(':scope > i')!
      const mp = mpTrack.querySelector<HTMLElement>(':scope > i')!
      const arrow = tokenElement.querySelector<HTMLElement>(':scope > i')!
      const portraitCandidates = Array.from(tokenElement.children).filter(
        (child): child is HTMLElement =>
          child instanceof HTMLElement &&
          (child.classList.contains('character-portrait-media') ||
            Array.from(child.classList).some((className) => className.includes('unitPortraitFallback'))),
      )
      const portrait = portraitCandidates[0]!
      const tileRect = element.getBoundingClientRect()
      const tokenRect = tokenElement.getBoundingClientRect()
      const meterRect = meterElement.getBoundingClientRect()
      const hpTrackRect = hpTrack.getBoundingClientRect()
      const mpTrackRect = mpTrack.getBoundingClientRect()
      const arrowRect = arrow.getBoundingClientRect()
      const portraitRect = portrait.getBoundingClientRect()
      return {
        tileTop: tileRect.top,
        tileBottom: tileRect.bottom,
        tokenLeft: tokenRect.left,
        tokenRight: tokenRect.right,
        tokenTop: tokenRect.top,
        tokenBottom: tokenRect.bottom,
        meterLeft: meterRect.left,
        meterRight: meterRect.right,
        meterTop: meterRect.top,
        meterBottom: meterRect.bottom,
        meterGap: mpTrackRect.top - hpTrackRect.bottom,
        arrowTop: arrowRect.top,
        arrowBottom: arrowRect.bottom,
        portraitLeft: portraitRect.left,
        portraitRight: portraitRect.right,
        portraitTop: portraitRect.top,
        portraitBottom: portraitRect.bottom,
        portraitCount: portraitCandidates.length,
        portraitClipPath: getComputedStyle(portrait).clipPath,
        hpWidth: hp.getBoundingClientRect().width,
        mpWidth: mp.getBoundingClientRect().width,
        hpBackground: getComputedStyle(hp).backgroundImage,
        mpBackground: getComputedStyle(mp).backgroundImage,
      }
    })

    const tokenCenter = (geometry.tokenLeft + geometry.tokenRight) / 2
    const meterCenter = (geometry.meterLeft + geometry.meterRight) / 2
    expect(Math.abs(meterCenter - tokenCenter)).toBeLessThanOrEqual(1)
    expect(geometry.meterGap).toBeGreaterThanOrEqual(0)
    expect(geometry.meterGap).toBeLessThanOrEqual(2)
    expect(geometry.meterTop).toBeGreaterThanOrEqual(geometry.tokenBottom - 3)
    expect(geometry.meterBottom).toBeLessThanOrEqual(geometry.tileBottom + 2)

    expect(geometry.portraitCount).toBe(1)
    expect(geometry.portraitClipPath).not.toBe('none')
    expect(geometry.portraitLeft).toBeGreaterThanOrEqual(geometry.tokenLeft - 1)
    expect(geometry.portraitRight).toBeLessThanOrEqual(geometry.tokenRight + 1)
    expect(geometry.portraitTop).toBeGreaterThanOrEqual(geometry.tokenTop - 1)
    expect(geometry.portraitBottom).toBeLessThanOrEqual(geometry.tokenBottom + 1)

    expect(geometry.arrowTop).toBeGreaterThanOrEqual(geometry.tileTop - 1)
    expect(geometry.arrowBottom).toBeLessThanOrEqual(geometry.tokenTop + 3)
    expect(geometry.hpWidth).toBeGreaterThan(0)
    expect(geometry.mpWidth).toBeGreaterThanOrEqual(0)
    expect(geometry.hpBackground).not.toBe(geometry.mpBackground)
  }
}

async function selectMoveAndVerifySharedTreatment(root: ReturnType<Page['locator']>) {
  const battlefield = root.locator('#battlefield')
  const move = root
    .getByRole('region', { name: 'Command Deck' })
    .getByRole('button', { name: /Move/ })
  await move.click()
  await expect(root).toHaveAttribute('data-battle-action-mode', 'move')

  const reachable = battlefield.locator('button[data-reachable]')
  await expect.poll(() => reachable.count()).toBeGreaterThan(0)
  const borderColor = await reachable
    .first()
    .evaluate((element) => getComputedStyle(element).borderColor)
  expect(borderColor).toMatch(/98, 205, 132|98, 210, 138/)
}

async function plotOneDesktopWasdStep(
  page: Page,
  root: ReturnType<Page['locator']>,
  playerName: string,
) {
  const battlefield = root.locator('#battlefield')
  const key = await battlefield.evaluate((element, name) => {
    const tiles = Array.from(
      element.querySelectorAll<HTMLButtonElement>('button[aria-label^="Tile "]'),
    )
    const actor = tiles.find((tile) =>
      (tile.getAttribute('aria-label') ?? '').includes(`occupied by ${name}`),
    )
    const actorMatch = actor?.getAttribute('aria-label')?.match(/^Tile\s+(\d+),\s*(\d+)/i)
    if (!actorMatch) return null
    const x = Number(actorMatch[1])
    const y = Number(actorMatch[2])
    const candidates = [
      { x, y: y - 1, key: 'w' },
      { x: x + 1, y, key: 'd' },
      { x, y: y + 1, key: 's' },
      { x: x - 1, y, key: 'a' },
    ]
    for (const candidate of candidates) {
      const prefix = `Tile ${candidate.x}, ${candidate.y};`
      const tile = tiles.find((item) => (item.getAttribute('aria-label') ?? '').startsWith(prefix))
      if (tile?.hasAttribute('data-reachable')) return candidate.key
    }
    return null
  }, playerName)

  expect(key).not.toBeNull()
  await page.keyboard.press(key!)
  await expect.poll(() => battlefield.locator('button[data-path]').count()).toBeGreaterThan(1)
  await expect(battlefield.getByText('0', { exact: true })).toHaveCount(1)
  await expect(battlefield.getByText('1', { exact: true })).toHaveCount(1)
}

async function expectDesktopRailPortraitFill(root: ReturnType<Page['locator']>) {
  const card = root.locator('[data-unified-combatant-rail="true"] article').first()
  await expect(card).toBeVisible()
  const geometry = await card.evaluate((element) => {
    const heading = element.firstElementChild as HTMLElement
    const portrait = element.querySelector<HTMLButtonElement>(
      'button[data-desktop-inspect-combatant]',
    )!
    const cardRect = element.getBoundingClientRect()
    const headingRect = heading.getBoundingClientRect()
    const portraitRect = portrait.getBoundingClientRect()
    return {
      cardLeft: cardRect.left,
      cardRight: cardRect.right,
      cardBottom: cardRect.bottom,
      headingBottom: headingRect.bottom,
      portraitLeft: portraitRect.left,
      portraitRight: portraitRect.right,
      portraitTop: portraitRect.top,
      portraitBottom: portraitRect.bottom,
    }
  })
  expect(Math.abs(geometry.portraitLeft - geometry.cardLeft)).toBeLessThanOrEqual(2)
  expect(Math.abs(geometry.portraitRight - geometry.cardRight)).toBeLessThanOrEqual(2)
  expect(Math.abs(geometry.portraitBottom - geometry.cardBottom)).toBeLessThanOrEqual(2)
  expect(Math.abs(geometry.portraitTop - geometry.headingBottom)).toBeLessThanOrEqual(2)
}

test('keeps requested PvE presentation parity on desktop and mobile', async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile-chromium'
  test.skip(
    !mobile && testInfo.project.name !== 'desktop-chromium',
    'Shared PvE presentation regression',
  )
  test.slow()

  const identity = uniqueIdentity('SharedPve')
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

  const root = page.locator("main[data-unified-battle='true'][data-battle-kind='pve']")
  await expect(root).toBeVisible()
  await expectSharedHeader(root)

  const context = root.getByRole('region', { name: 'Command Deck' })
  await expect(context.locator('[data-ai-turn-clock="true"]')).toHaveText(/^\d+s$/)
  await context.getByRole('button', { name: /Guard/ }).click()
  const preview = context.locator('[data-battle-target-preview="true"]:visible').last()
  await expect(preview).toContainText('Success 100%')
  await expect(preview).toContainText(/Guarded/i)

  await root.getByRole('button', { name: 'Cancel Action' }).click()
  await selectMoveAndVerifySharedTreatment(root)

  if (mobile) {
    await expect(root.locator(':scope > section[aria-label="Battle roster"]')).toBeHidden()
    await expect(root.locator('[data-battle-notice="true"] > span')).toBeHidden()
    await expectMobileTokenMeters(root)

    const surrender = root.getByRole('button', { name: 'Surrender', exact: true })
    await expect(surrender).toBeVisible()
    const widths = await surrender.evaluate((button) => {
      const parent = button.parentElement!
      return {
        button: button.getBoundingClientRect().width,
        parent: parent.getBoundingClientRect().width,
      }
    })
    expect(Math.abs(widths.button - widths.parent)).toBeLessThanOrEqual(2)
  } else {
    await expectDesktopRailPortraitFill(root)
    await plotOneDesktopWasdStep(page, root, identity.characterName)
  }
})

test('keeps requested PvP presentation parity on desktop and mobile', async ({
  browser,
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile-chromium'
  test.skip(
    !mobile && testInfo.project.name !== 'desktop-chromium',
    'Shared PvP presentation regression',
  )
  test.slow()

  const password = 'AurevaneTest!42'
  const hostIdentity = uniqueIdentity('SharedPvpHost')
  const guestIdentity = uniqueIdentity('SharedPvpGuest')
  const contextOptions = mobile
    ? {
        baseURL: 'http://127.0.0.1:3100',
        viewport: { width: 412, height: 915 },
        isMobile: true,
        hasTouch: true,
      }
    : { baseURL: 'http://127.0.0.1:3100', viewport: { width: 1440, height: 900 } }
  const hostContext = await browser.newContext(contextOptions)
  const guestContext = await browser.newContext(contextOptions)
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

    const hostTurn = (await hostRoot.getAttribute('data-local-turn')) === 'true'
    const activeRoot = hostTurn ? hostRoot : guestRoot
    const activePage = hostTurn ? host : guest
    const activeName = hostTurn ? hostIdentity.characterName : guestIdentity.characterName

    await expectSharedHeader(activeRoot)
    await selectMoveAndVerifySharedTreatment(activeRoot)

    if (mobile) {
      await expect(activeRoot.locator(':scope > section[aria-label="Battle roster"]')).toBeHidden()
      await expect(activeRoot.locator('[data-battle-notice="true"] > span')).toBeHidden()
      await expectMobileTokenMeters(activeRoot)
    } else {
      await expectDesktopRailPortraitFill(activeRoot)
      await plotOneDesktopWasdStep(activePage, activeRoot, activeName)
    }
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()])
  }
})
