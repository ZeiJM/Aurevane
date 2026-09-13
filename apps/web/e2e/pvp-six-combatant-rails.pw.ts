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

test('keeps three portrait and status cards accessible in each desktop PvP rail', async ({
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

    // A rendered 1v1 supplies the real card markup. Clones exercise six-card
    // presentation capacity only; battle membership and gameplay remain untouched.
    for (const viewport of [
      { width: 1536, height: 614 },
      { width: 1920, height: 982 },
      { width: 2400, height: 1228 },
    ]) {
      await host.setViewportSize(viewport)
      const geometries = await rails.evaluateAll(async (elements) => {
        await document.fonts.ready
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        )
        return elements.map((rail) => {
          const railElement = rail as HTMLElement
          const stack = railElement.firstElementChild as HTMLElement
          const source = stack.querySelector<HTMLElement>('article')!
          const singleCard = source.getBoundingClientRect().toJSON()
          const originalCount = stack.dataset.count
          const clones = [source.cloneNode(true), source.cloneNode(true)] as HTMLElement[]
          for (const clone of clones) stack.appendChild(clone)
          stack.dataset.count = '3'

          const geometry = {
            rail: railElement.getBoundingClientRect().toJSON(),
            stack: stack.getBoundingClientRect().toJSON(),
            singleCard,
            scrollHeight: railElement.scrollHeight,
            clientHeight: railElement.clientHeight,
            cards: Array.from(stack.querySelectorAll<HTMLElement>('article')).map((card) => {
              const portrait = card.querySelector<HTMLElement>(
                'button[data-desktop-inspect-combatant]',
              )!
              const image = portrait.querySelector<HTMLElement>('.character-portrait-media')!
              const effects = card.lastElementChild as HTMLElement
              return {
                card: card.getBoundingClientRect().toJSON(),
                heading: card.firstElementChild!.getBoundingClientRect().toJSON(),
                portrait: portrait.getBoundingClientRect().toJSON(),
                image: image.getBoundingClientRect().toJSON(),
                imageFit: getComputedStyle(image).objectFit,
                effects: effects.getBoundingClientRect().toJSON(),
                effectsHeight: effects.clientHeight,
                effectsScrollHeight: effects.scrollHeight,
              }
            }),
          }
          for (const clone of clones) clone.remove()
          if (originalCount === undefined) delete stack.dataset.count
          else stack.dataset.count = originalCount
          return geometry
        })
      })

      for (const geometry of geometries) {
        expect(geometry.rail.height).toBeGreaterThan(0)
        expect(geometry.cards).toHaveLength(3)
        expect(geometry.stack.width).toBeLessThanOrEqual(geometry.rail.width + 1)
        expect(Math.abs(geometry.stack.top - geometry.rail.top)).toBeLessThanOrEqual(1)
        expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight + 1)
        expect(geometry.cards[2]!.card.bottom).toBeLessThanOrEqual(geometry.rail.bottom + 1)
        const firstHeight = geometry.cards[0]!.card.height
        expect(
          Math.abs(firstHeight - geometry.singleCard.height),
          'A 1v1 card must already reserve room for two teammates.',
        ).toBeLessThanOrEqual(1)
        expect(firstHeight).toBeLessThanOrEqual(geometry.rail.height / 3)

        for (const {
          card,
          heading,
          portrait,
          image,
          imageFit,
          effects,
          effectsHeight,
          effectsScrollHeight,
        } of geometry.cards) {
          expect(Math.abs(card.height - firstHeight)).toBeLessThanOrEqual(1)
          expect(portrait.width).toBeGreaterThan(32)
          expect(
            Math.abs(portrait.width - portrait.height),
            'Rail portraits must remain square.',
          ).toBeLessThanOrEqual(1)
          expect(portrait.bottom).toBeLessThanOrEqual(card.bottom + 1)
          expect(portrait.top).toBeGreaterThanOrEqual(heading.bottom - 1)
          expect(imageFit).toBe('contain')
          expect(Math.abs(image.width - image.height)).toBeLessThanOrEqual(1)
          expect(Math.abs(image.left - portrait.left)).toBeLessThanOrEqual(1)
          expect(Math.abs(image.right - portrait.right)).toBeLessThanOrEqual(1)
          expect(Math.abs(image.top - portrait.top)).toBeLessThanOrEqual(1)
          expect(Math.abs(image.bottom - portrait.bottom)).toBeLessThanOrEqual(1)
          expect(portrait.left).toBeGreaterThanOrEqual(card.left)
          expect(portrait.right).toBeLessThanOrEqual(card.right + 1)
          expect(effects.bottom).toBeLessThanOrEqual(card.bottom + 1)
          expect(effects.right).toBeLessThanOrEqual(card.right + 1)
          expect(effectsScrollHeight).toBeLessThanOrEqual(effectsHeight + 1)
        }
      }
    }
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()])
  }
})
