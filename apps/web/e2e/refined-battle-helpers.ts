import { setBattleChronicleOpen } from './battle-log-layout-helpers'
import { expect, type Locator, type Page } from '@playwright/test'

export function targetForecast(page: Page) {
  return page.locator('[data-battle-preview-strip="true"]')
}

export async function openSelectedCombatantDetails(page: Page, name: string) {
  const card = page.locator('[data-battle-combatant-card="selected"]')
  await expect(card).toContainText(name)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await card.getByRole('button', { name: `Inspect ${name}`, exact: true }).click()
  const details = page.getByRole('dialog', { name: `${name} battle details`, exact: true })
  await expect(details).toBeVisible()
  return details
}

export async function commitGesture(page: Page, target: Locator) {
  const response = page.waitForResponse(
    (result) =>
      result.request().method() === 'POST' &&
      /\/(intents|commit)$/.test(new URL(result.url()).pathname),
  )
  await target.click()
  const result = await response
  expect(result.status()).toBe(200)
  return result
}

export async function moveOneStep(
  page: Page,
  actorName: string,
  scheme: 'wasd' | 'arrows' = 'wasd',
) {
  const root = page.locator('main[data-unified-battle="true"]')
  const move = root.locator('[data-battle-command="move"]')
  await move.click()
  const destination = await root.locator('#battlefield').evaluate((board, name) => {
    const tiles = [...board.querySelectorAll<HTMLButtonElement>('button[aria-label^="Tile "]')]
    const actor = tiles.find((tile) =>
      tile.getAttribute('aria-label')?.includes(`occupied by ${name}`),
    )
    const xy = actor?.getAttribute('aria-label')?.match(/^Tile (\d+), (\d+)/)
    if (!xy) throw new Error('Actor tile missing')
    const x = Number(xy[1]),
      y = Number(xy[2])
    for (const [dx, dy, key, arrow] of [
      [0, -1, 'KeyW', 'ArrowUp'],
      [1, 0, 'KeyD', 'ArrowRight'],
      [0, 1, 'KeyS', 'ArrowDown'],
      [-1, 0, 'KeyA', 'ArrowLeft'],
    ] as const) {
      const tile = tiles.find((tile) =>
        tile.getAttribute('aria-label')?.startsWith(`Tile ${x + dx}, ${y + dy};`),
      )
      if (tile?.hasAttribute('data-reachable'))
        return { label: tile.getAttribute('aria-label')!, key, arrow }
    }
    throw new Error('No adjacent reachable tile')
  }, actorName)
  const response = page.waitForResponse(
    (result) => result.request().method() === 'POST' && /\/(intents|commit)$/.test(result.url()),
  )
  await page.keyboard.press(scheme === 'wasd' ? destination.key : destination.arrow)
  const result = await response
  expect(result.status()).toBe(200)
  await expect(
    root.getByRole('button', {
      name: new RegExp(`^${destination.label.split(';')[0]};.*occupied by ${actorName}`),
    }),
  ).toBeVisible()
  return result
}

export async function expectRefinedCockpit(page: Page) {
  await setBattleChronicleOpen(page, false)
  const deck = page.getByRole('region', { name: 'Command Deck' })
  await expect(deck.locator('[data-command-card]')).toHaveCount(6)
  await expect(deck.locator('[data-battle-command="items"]')).toBeDisabled()
  await expect(deck.locator('[data-command-card="items"]')).not.toContainText('Coming soon')
  await expect(deck.locator('[data-command-card="items"] [data-battle-command-hotkey]')).toHaveText(
    'P',
  )
  await expect(deck.locator('[data-battle-skill-slot]')).toHaveCount(4)
  await expect(deck.locator('[data-battle-special]')).toHaveCount(2)
  await expect(
    deck.locator('[data-command-card="inspect"] [data-battle-command-hotkey]'),
  ).toHaveText('I')
  const order = await deck.evaluate((element) =>
    [
      ...element.querySelectorAll(
        '[data-command-card], [data-battle-skill-slot], [data-battle-special]',
      ),
    ]
      .sort((a, b) =>
        !window.matchMedia(
          '(max-width: 820px), (max-width: 980px) and (max-height: 500px) and (pointer: coarse)',
        ).matches
          ? a.getBoundingClientRect().x - b.getBoundingClientRect().x
          : 0,
      )
      .map(
        (node) =>
          node.getAttribute('data-command-card') ??
          node.getAttribute('data-battle-skill-slot') ??
          node.getAttribute('data-battle-special'),
      ),
  )
  const desktop = await page.evaluate(
    () =>
      !window.matchMedia(
        '(max-width: 820px), (max-width: 980px) and (max-height: 500px) and (pointer: coarse)',
      ).matches,
  )
  expect(order).toEqual([
    'items',
    'inspect',
    'move',
    'attack',
    'guard',
    ...(!desktop ? ['finish'] : []),
    '1',
    '2',
    '3',
    '4',
    expect.stringMatching(/essence|resonance/),
    'supernatural',
    ...(desktop ? ['finish'] : []),
  ])
  const scrollContainers = page.locator(
    '[data-battle-mobile-lower-panel], [data-battle-selected-skills]',
  )
  const scrollPositions = await scrollContainers.evaluateAll((elements) =>
    elements.map((element) => ({ left: element.scrollLeft, top: element.scrollTop })),
  )
  try {
    // The compact cockpit scrolls below the fixed board. Visit every frame so native
    // lazy images, including End Turn, are requested before checking their artwork.
    for (const frame of await deck.locator('[data-av-square-media]').all()) {
      await frame.scrollIntoViewIfNeeded()
      await expect
        .poll(() =>
          frame.evaluate((element) => {
            const image = element.querySelector('img')
            return !image || (image.complete && image.naturalWidth > 0)
          }),
        )
        .toBe(true)
      const bounds = await frame.boundingBox()
      expect(bounds).not.toBeNull()
      expect(Math.abs(bounds!.width - bounds!.height)).toBeLessThanOrEqual(1)
    }
  } finally {
    await scrollContainers.evaluateAll((elements, positions) => {
      elements.forEach((element, index) => element.scrollTo(positions[index]!))
    }, scrollPositions)
  }
  await expect(page.getByRole('button', { name: 'Confirm Action', exact: true })).toHaveCount(0)
  await expect(targetForecast(page)).toBeVisible()
  await expect(page.locator('[data-battle-secondary-actions]')).toHaveCount(0)
}
