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
  const deck = page.getByRole('region', { name: 'Command Deck' })
  await expect(deck.locator('[data-command-card]')).toHaveCount(5)
  await expect(deck.locator('[data-battle-skill-slot]')).toHaveCount(4)
  await expect(deck.locator('[data-battle-special]')).toHaveCount(2)
  await expect(
    deck.locator('[data-command-card="inspect"] [data-battle-command-hotkey]'),
  ).toBeEmpty()
  const order = await deck.evaluate((element) =>
    [
      ...element.querySelectorAll(
        '[data-command-card], [data-battle-skill-slot], [data-battle-special]',
      ),
    ].map(
      (node) =>
        node.getAttribute('data-command-card') ??
        node.getAttribute('data-battle-skill-slot') ??
        node.getAttribute('data-battle-special'),
    ),
  )
  expect(order).toEqual([
    'inspect',
    'move',
    'attack',
    'guard',
    '1',
    '2',
    '3',
    '4',
    expect.stringMatching(/essence|resonance/),
    'supernatural',
    'finish',
  ])
  const frames = await deck.locator('[data-av-square-media]').evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect()
      const image = element.querySelector('img')
      return {
        width: rect.width,
        height: rect.height,
        loaded: !image || (image.complete && image.naturalWidth > 0),
      }
    }),
  )
  for (const frame of frames) {
    expect(Math.abs(frame.width - frame.height)).toBeLessThanOrEqual(1)
    expect(frame.loaded).toBe(true)
  }
  await expect(page.getByRole('button', { name: 'Confirm Action', exact: true })).toHaveCount(0)
  await expect(targetForecast(page)).toBeVisible()
  await expect(page.locator('[data-battle-secondary-actions]')).toContainText('Recovery')
}
