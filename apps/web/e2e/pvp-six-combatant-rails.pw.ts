import { expect, test } from '@playwright/test'

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

test('fits three square portrait cards cleanly in each desktop PvP rail', async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop PvP rail regression')
  test.slow()

  const password = 'AurevaneTest!42'
  const hostIdentity = uniqueIdentity('RailHost')
  const guestIdentity = uniqueIdentity('RailGuest')
  const hostContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' })
  const guestContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' })
  const host = await hostContext.newPage()
  const guest = await guestContext.newPage()

  await Promise.all([
    host.setViewportSize({ width: 1536, height: 614 }),
    guest.setViewportSize({ width: 1536, height: 614 }),
  ])

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

    const rails = host.locator("aside[data-unified-combatant-rail='true']")
    await expect(rails).toHaveCount(2)
    await expect(rails.nth(0).locator('article')).toHaveCount(1)
    await expect(rails.nth(1).locator('article')).toHaveCount(1)

    const geometries = await rails.evaluateAll((elements) =>
      elements.map((rail, railIndex) => {
        const railElement = rail as HTMLElement
        const stack = railElement.firstElementChild as HTMLElement
        const source = stack.querySelector<HTMLElement>('article')!
        const originalCount = stack.dataset.count
        const clones = [source.cloneNode(true), source.cloneNode(true)] as HTMLElement[]
        for (const clone of clones) stack.appendChild(clone)
        stack.dataset.count = '3'

        const railRect = railElement.getBoundingClientRect()
        const stackRect = stack.getBoundingClientRect()
        const cards = Array.from(stack.querySelectorAll<HTMLElement>('article')).map((card) => {
          const heading = card.firstElementChild as HTMLElement
          const portrait = card.querySelector<HTMLElement>(
            'button[data-desktop-inspect-combatant]',
          )!
          const image = portrait.querySelector<HTMLElement>('.character-portrait-media')!
          const cardRect = card.getBoundingClientRect()
          const headingRect = heading.getBoundingClientRect()
          const portraitRect = portrait.getBoundingClientRect()
          const imageRect = image.getBoundingClientRect()
          return {
            card: {
              left: cardRect.left,
              right: cardRect.right,
              top: cardRect.top,
              bottom: cardRect.bottom,
              width: cardRect.width,
              height: cardRect.height,
            },
            heading: {
              bottom: headingRect.bottom,
              background: getComputedStyle(heading).backgroundColor,
            },
            portrait: {
              left: portraitRect.left,
              right: portraitRect.right,
              top: portraitRect.top,
              bottom: portraitRect.bottom,
              width: portraitRect.width,
              height: portraitRect.height,
            },
            image: {
              left: imageRect.left,
              right: imageRect.right,
              top: imageRect.top,
              bottom: imageRect.bottom,
            },
          }
        })

        for (const clone of clones) clone.remove()
        if (originalCount === undefined) delete stack.dataset.count
        else stack.dataset.count = originalCount

        return {
          railIndex,
          rail: {
            left: railRect.left,
            right: railRect.right,
            top: railRect.top,
            bottom: railRect.bottom,
            width: railRect.width,
            height: railRect.height,
          },
          stack: {
            left: stackRect.left,
            right: stackRect.right,
            top: stackRect.top,
            bottom: stackRect.bottom,
            width: stackRect.width,
          },
          cards,
        }
      }),
    )

    for (const geometry of geometries) {
      expect(geometry.rail.height).toBeGreaterThan(0)
      expect(geometry.cards).toHaveLength(3)
      expect(geometry.stack.width).toBeLessThanOrEqual(geometry.rail.width + 1)
      expect(geometry.stack.top).toBeGreaterThanOrEqual(geometry.rail.top - 1)
      expect(geometry.stack.bottom).toBeLessThanOrEqual(geometry.rail.bottom + 1)
      if (geometry.railIndex === 0) {
        expect(Math.abs(geometry.stack.left - geometry.rail.left)).toBeLessThanOrEqual(1)
      } else {
        expect(Math.abs(geometry.stack.right - geometry.rail.right)).toBeLessThanOrEqual(1)
      }

      for (const { card, heading, portrait, image } of geometry.cards) {
        expect(Math.abs(portrait.width - portrait.height)).toBeLessThanOrEqual(1)
        expect(Math.abs(portrait.top - heading.bottom)).toBeLessThanOrEqual(1)
        expect(heading.background).not.toBe('rgba(0, 0, 0, 0)')
        expect(Math.abs(image.left - portrait.left)).toBeLessThanOrEqual(1)
        expect(Math.abs(image.right - portrait.right)).toBeLessThanOrEqual(1)
        expect(Math.abs(image.top - portrait.top)).toBeLessThanOrEqual(1)
        expect(Math.abs(image.bottom - portrait.bottom)).toBeLessThanOrEqual(1)
        expect(portrait.left - card.left).toBeLessThanOrEqual(3)
        expect(card.right - portrait.right).toBeLessThanOrEqual(3)
        expect(card.bottom - portrait.bottom).toBeLessThanOrEqual(3)
      }
    }
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()])
  }
})
