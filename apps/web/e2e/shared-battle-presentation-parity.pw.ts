import { expect, test, type Page } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'
import {
  moveOneStep,
  targetForecast,
  expectRefinedCockpit,
  commitGesture,
} from './refined-battle-helpers'
import {
  expectBattlePreviewFits,
  expectBattleHeaderAndArtworkGeometry,
} from './battle-reference-layout-helpers'
import { expectReadableBattleLog } from './battle-log-layout-helpers'

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
  await expect(root.locator('[data-unified-battle-header]')).toBeVisible()
  await expect(root.getByRole('progressbar', { name: 'Action Economy remaining' })).toBeVisible()
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
    await expect(token.locator('[data-battle-facing-indicator="true"]')).toBeVisible()

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
      const arrow = tokenElement.querySelector<HTMLElement>(
        '[data-battle-facing-indicator="true"]',
      )!
      const portraitCandidates = Array.from(tokenElement.children).filter(
        (child): child is HTMLElement =>
          child instanceof HTMLElement &&
          (child.classList.contains('character-portrait-media') ||
            Array.from(child.classList).some((className) =>
              className.includes('unitPortraitFallback'),
            )),
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
        portraitBorderRadius: getComputedStyle(portrait).borderRadius,
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
    expect(geometry.portraitBorderRadius).toBe('50%')
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
    .getByRole('button', { name: /^Move,/ })
  await move.click()
  await expect(move).toHaveAttribute('data-battle-active', 'true')

  const reachable = battlefield.locator('button[data-reachable]')
  await expect.poll(() => reachable.count()).toBeGreaterThan(0)
  const borderColor = await reachable
    .first()
    .evaluate((element) => getComputedStyle(element).borderColor)
  expect(borderColor).toMatch(/105, 210, 204/)
}

async function plotOneDesktopWasdStep(
  page: Page,
  _root: ReturnType<Page['locator']>,
  playerName: string,
) {
  await moveOneStep(page, playerName)
}

async function expectDesktopCombatantCard(root: ReturnType<Page['locator']>) {
  const card = root.locator('[data-battle-combatant-card="local"]')
  await expect(card).toBeVisible()
  await expect(card).toContainText(/HP.*MP/s)
  const geometry = await card
    .locator('[data-av-square-media]')
    .evaluate((element) => element.getBoundingClientRect().toJSON())
  expect(Math.abs(geometry.width - geometry.height)).toBeLessThanOrEqual(1)
  await expect(card.getByRole('region', { name: / combat effects$/ })).toBeVisible()
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
  await expectBattleHeaderAndArtworkGeometry(page)

  const context = root.getByRole('region', { name: 'Command Deck' })
  await expect(root.locator('[data-ai-turn-clock="true"]')).toHaveText(/^\d+s$/)
  await context.getByRole('button', { name: /^Guard,/ }).click()
  const preview = targetForecast(page).locator('[data-react-battle-preview="true"]:visible')
  await expect(targetForecast(page).locator('[aria-label="Action preview"]')).toHaveCount(1)
  await expect(preview).toContainText('Success 100%')
  expect(
    await preview
      .locator('[data-battle-range-forecast] > span:last-child, [data-battle-preview-chip]')
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(12)
  await expect(preview).toContainText(/Guard/i)
  await expectBattlePreviewFits(page)
  await testInfo.attach('combat-guard-forecast', {
    body: await page.screenshot({ path: testInfo.outputPath('combat-guard-forecast.png') }),
    contentType: 'image/png',
  })

  await root.getByRole('button', { name: 'Cancel Action' }).click()
  await selectMoveAndVerifySharedTreatment(root)

  if (mobile) {
    await expect(root.locator(':scope > section[aria-label="Battle roster"]')).toBeHidden()
    await expect(root.locator('[data-battle-notice="true"] > span')).toBeHidden()
    await expectMobileTokenMeters(root)

    await expectRefinedCockpit(page)
  } else {
    await expectDesktopCombatantCard(root)
    await plotOneDesktopWasdStep(page, root, identity.characterName)
    await root.getByRole('button', { name: 'Cancel Action' }).click()
    await context.getByRole('button', { name: /^Guard,/ }).click()
    await commitGesture(
      page,
      root.getByRole('button', { name: new RegExp(`occupied by ${identity.characterName}`) }),
    )
    const inline = root.locator('[data-battle-inline-log]')
    const chronicle = inline.getByRole('region', { name: 'Battle chronicle', exact: true })
    await expect(chronicle).toContainText('Guard')
    await expect(chronicle).toContainText('Guarded')
    await expect(chronicle.locator('[data-chronicle-actor] h3')).toContainText(
      identity.characterName,
    )
    await expect(
      chronicle.getByRole('button', { name: 'Explain Guarded', exact: true }),
    ).toBeVisible()
    await expect(inline.locator(':scope > header')).toHaveCount(0)
    await expect(inline.getByRole('button', { name: /Switch to/ })).toHaveCount(0)
    await expect(page.locator('dialog[data-battle-action-details]')).toHaveCount(0)
    for (const size of [
      { width: 1536, height: 614 },
      { width: 1280, height: 720 },
      { width: 1024, height: 576 },
      { width: 412, height: 915 },
    ]) {
      await page.setViewportSize(size)
      await expectReadableBattleLog(page, testInfo, `ai-log-${size.width}x${size.height}`)
    }
    await testInfo.attach('combat-populated-history', {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
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
    await expectBattleHeaderAndArtworkGeometry(activePage)
    await selectMoveAndVerifySharedTreatment(activeRoot)

    if (mobile) {
      await expect(activeRoot.locator(':scope > section[aria-label="Battle roster"]')).toBeHidden()
      await expect(activeRoot.locator('[data-battle-notice="true"] > span')).toBeHidden()
      await expectMobileTokenMeters(activeRoot)
    } else {
      await expectDesktopCombatantCard(activeRoot)
      await plotOneDesktopWasdStep(activePage, activeRoot, activeName)
    }
    await activeRoot.getByRole('button', { name: 'Cancel Action' }).click()
    await activeRoot
      .getByRole('region', { name: 'Command Deck' })
      .getByRole('button', { name: /^Guard,/ })
      .click()
    await commitGesture(
      activePage,
      activeRoot.getByRole('button', { name: new RegExp(`occupied by ${activeName}`) }),
    )
    await expect(
      activeRoot
        .locator('[data-battle-inline-log]')
        .getByRole('region', { name: 'Battle chronicle', exact: true }),
    ).toContainText('Guard')
    await expectReadableBattleLog(activePage, testInfo, mobile ? 'pvp-mobile-log' : 'pvp-log')
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()])
  }
})
