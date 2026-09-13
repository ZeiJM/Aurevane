import { expect, type Page, type TestInfo } from '@playwright/test'

export async function expectBattleReferenceLayout(page: Page, testInfo: TestInfo, label: string) {
  const root = page.locator('main[data-unified-battle="true"]')
  const log = root.locator('[data-battle-flow-log-target="true"] [data-docked-battle-log="true"]')
  await expect(log).toBeVisible()
  const clock = root.locator('[data-battle-turn-clock-slot="true"] > span')
  await expect(clock).toBeVisible()
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  // Viewport changes settle through ResizeObserver before tiles and portrait tokens are measured.
  await expect
    .poll(() =>
      root.locator('[data-board-auto-fit]').evaluate((board) => {
        const viewport = board.parentElement!
        const style = getComputedStyle(viewport)
        const [columns, rows] = board.getAttribute('data-board-auto-fit')!.split('x').map(Number)
        const width =
          viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
        const height =
          viewport.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
        const scale = Math.min(width / columns!, height / rows!)
        const rect = board.getBoundingClientRect()
        return Math.max(
          Math.abs(rect.width - scale * columns!),
          Math.abs(rect.height - scale * rows!),
        )
      }),
    )
    .toBeLessThanOrEqual(3)
  const geometry = await root.evaluate((element) => {
    const rect = (selector: string) =>
      element.querySelector(selector)!.getBoundingClientRect().toJSON()
    const board = element.querySelector('[data-board-auto-fit]')!
    const boardRect = board.getBoundingClientRect()
    const viewport = board.parentElement!.getBoundingClientRect()
    const lastTile = board.querySelector('button:last-child')!.getBoundingClientRect()
    const cards = [...element.querySelectorAll<HTMLElement>('[data-command-card]')]
    const viewportStyle = getComputedStyle(board.parentElement!)
    const fit = board.getAttribute('data-board-auto-fit')!.split('x').map(Number)
    const availableWidth =
      board.parentElement!.clientWidth -
      parseFloat(viewportStyle.paddingLeft) -
      parseFloat(viewportStyle.paddingRight)
    const availableHeight =
      board.parentElement!.clientHeight -
      parseFloat(viewportStyle.paddingTop) -
      parseFloat(viewportStyle.paddingBottom)
    const expectedScale = Math.min(availableWidth / fit[0]!, availableHeight / fit[1]!)
    const tokens = [...board.querySelectorAll<HTMLElement>('[data-battle-shared-token]')].map(
      (token) => ({
        token: token.getBoundingClientRect().toJSON(),
        tile: token.parentElement!.getBoundingClientRect().toJSON(),
      }),
    )
    const railMeters = [
      ...element.querySelectorAll<HTMLElement>(
        '[data-unified-combatant-rail] button > div > span > b',
      ),
    ].map((label) => ({
      label: label.getBoundingClientRect().toJSON(),
      bar: label.parentElement!.getBoundingClientRect().toJSON(),
    }))
    return {
      expectedBoard: { width: expectedScale * fit[0]!, height: expectedScale * fit[1]! },
      board: boardRect.toJSON(),
      tokens,
      railMeters,
      key: rect('[aria-label="Map Key"]'),
      victory: rect('[data-battle-shared-header-action="victory"]'),
      header: rect(':scope > header'),
      flowFeed: (() => {
        const feed =
          element.querySelector<HTMLElement>('[data-compact-flow]') ??
          element.querySelector<HTMLElement>('[aria-label="Battle Log"]')!
        return {
          height: feed.clientHeight,
          scrollHeight: feed.scrollHeight,
          width: feed.clientWidth,
          scrollWidth: feed.scrollWidth,
        }
      })(),
      battlefield: rect('#battlefield'),
      deck: rect('[data-unified-command-deck]'),
      flow: rect('[data-battle-flow]'),
      instructions: rect('[data-battle-instruction-host]'),
      log: rect('[data-docked-battle-log]'),
      footer: rect(':scope > footer'),
      economy: rect('[data-unified-battle-economy]'),
      clock: rect('[data-battle-turn-clock-slot]'),
      boardFits:
        boardRect.left >= viewport.left - 1 &&
        boardRect.right <= viewport.right + 1 &&
        boardRect.top >= viewport.top - 1 &&
        boardRect.bottom <= viewport.bottom + 1,
      lastTileFits: lastTile.right <= viewport.right + 1 && lastTile.bottom <= viewport.bottom + 1,
      cards: cards.map((card) => ({
        ...card.getBoundingClientRect().toJSON(),
        font: parseFloat(getComputedStyle(card.querySelector('strong')!).fontSize),
      })),
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
    }
  })
  expect(geometry.deck.x).toBeLessThan(geometry.battlefield.x)
  expect(geometry.deck.right).toBeLessThanOrEqual(geometry.flow.x)
  expect(Math.abs(geometry.deck.y - geometry.flow.y)).toBeLessThanOrEqual(1)
  expect(Math.abs(geometry.deck.bottom - geometry.flow.bottom)).toBeLessThanOrEqual(1)
  expect(geometry.deck.y).toBeGreaterThanOrEqual(geometry.battlefield.bottom - 1)
  expect(geometry.instructions.y).toBeGreaterThanOrEqual(
    Math.max(...geometry.cards.map((card) => card.bottom)),
  )
  expect(geometry.instructions.bottom).toBeLessThanOrEqual(geometry.deck.bottom)
  expect(geometry.battlefield.height).toBeGreaterThanOrEqual(
    (geometry.footer.y - geometry.header.bottom) * 0.55,
  )
  expect(geometry.flow.bottom).toBeLessThanOrEqual(geometry.footer.y + 1)
  expect(Math.abs(geometry.board.width - geometry.expectedBoard.width)).toBeLessThanOrEqual(3)
  expect(Math.abs(geometry.board.height - geometry.expectedBoard.height)).toBeLessThanOrEqual(3)
  expect(geometry.key.right).toBeLessThanOrEqual(geometry.victory.x)
  expect(
    Math.abs(
      geometry.economy.x +
        geometry.economy.width / 2 -
        (geometry.header.x + geometry.header.width / 2),
    ),
  ).toBeLessThanOrEqual(2)
  for (const { token, tile } of geometry.tokens) {
    expect(token.width).toBeGreaterThan(tile.width * 0.6)
    expect(token.width).toBeLessThanOrEqual(tile.width * 0.75)
    expect(token.height).toBeLessThanOrEqual(tile.height * 0.75)
  }
  expect(geometry.railMeters.length).toBeGreaterThanOrEqual(4)
  for (const { label, bar } of geometry.railMeters) {
    expect(label.x).toBeGreaterThanOrEqual(bar.x - 1)
    expect(label.right).toBeLessThanOrEqual(bar.right + 1)
    expect(label.y).toBeGreaterThanOrEqual(bar.y - 1)
    expect(label.bottom).toBeLessThanOrEqual(bar.bottom + 1)
  }
  expect(geometry.flowFeed.scrollHeight).toBeLessThanOrEqual(geometry.flowFeed.height + 1)
  expect(geometry.flowFeed.scrollWidth).toBeLessThanOrEqual(geometry.flowFeed.width + 1)
  expect(geometry.boardFits).toBe(true)
  expect(geometry.lastTileFits).toBe(true)
  expect(geometry.log.x).toBeGreaterThanOrEqual(geometry.flow.x)
  expect(geometry.log.right).toBeLessThanOrEqual(geometry.flow.right)
  expect(geometry.log.width).toBeGreaterThan(geometry.flow.width - 4)
  expect(geometry.clock.x).toBeGreaterThanOrEqual(geometry.economy.x)
  expect(geometry.clock.right).toBeLessThanOrEqual(geometry.economy.right + 1)
  expect(geometry.cards).toHaveLength(6)
  for (const card of geometry.cards) {
    expect(card.height).toBeLessThanOrEqual(120)
    expect(card.font).toBeGreaterThanOrEqual(12)
    expect(card.x).toBeGreaterThanOrEqual(geometry.deck.x)
    expect(card.right).toBeLessThanOrEqual(geometry.deck.right + 1)
  }
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1)
  await expectBattlePreviewFits(page)
  await testInfo.attach(label, {
    body: await page.screenshot({ path: testInfo.outputPath(`${label}.png`) }),
    contentType: 'image/png',
  })
}

export async function expectBattleFlowKeepsBoardSize(page: Page) {
  const root = page.locator('main[data-unified-battle="true"]')
  const flowToggle = root.locator('[data-battle-flow] > button')
  const log = page.getByTestId('battle-log-panel')
  // Mobile PvP uses the shared communication drawer, which covers its opener.
  // Exercise its real close control instead of trying to click through the drawer.
  const mobilePvp =
    (await root.getAttribute('data-battle-kind')) === 'pvp' &&
    (page.viewportSize()?.width ?? 0) <= 820
  const communication = page.locator('#pvp-battle-chat-panel')
  if ((await flowToggle.getAttribute('aria-expanded')) !== 'true') await flowToggle.click()
  await expect(flowToggle).toHaveAttribute('aria-expanded', 'true')
  if (mobilePvp) await expect(communication).toHaveAttribute('aria-hidden', 'false')
  const readGeometry = () =>
    root.evaluate(async (element) => {
      // Let the grid and its ResizeObserver complete before comparing rendered bounds.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      )
      return ['#battlefield', '[data-board-auto-fit]'].map((selector) => {
        const { x, y, width, height } = element.querySelector(selector)!.getBoundingClientRect()
        return { x, y, width, height }
      })
    })
  const open = await readGeometry()
  for (const expanded of [false, true]) {
    if (mobilePvp && !expanded) {
      await page.getByRole('button', { name: 'Close battle communication', exact: true }).click()
    } else {
      await flowToggle.click()
    }
    await expect(flowToggle).toHaveAttribute('aria-expanded', String(expanded))
    if (mobilePvp) {
      await expect(communication).toHaveAttribute('aria-hidden', String(!expanded))
    } else {
      await expect(log).toHaveCount(expanded ? 1 : 0)
    }
    const afterToggle = await readGeometry()
    for (const [index, bounds] of afterToggle.entries()) {
      for (const dimension of ['x', 'y', 'width', 'height'] as const) {
        expect(
          Math.abs(bounds[dimension] - open[index]![dimension]),
          `${index === 0 ? 'Battlefield' : 'Board'} ${dimension} must stay fixed when Battle Flow ${expanded ? 'opens' : 'closes'}`,
        ).toBeLessThanOrEqual(1)
      }
    }
  }
}

export async function expectBattlePreviewFits(page: Page) {
  const instructions = page.locator('[data-battle-instruction-host]')
  const geometry = await instructions.evaluate(async (element) => {
    await document.fonts.ready
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
    const host = element.getBoundingClientRect().toJSON()
    const items = Array.from(
      element.querySelectorAll<HTMLElement>(
        '[data-battle-instruction-title], [data-battle-instruction-description], [data-react-battle-preview] > span, [data-react-battle-preview] > button',
      ),
    )
      .filter((child) => {
        const style = getComputedStyle(child)
        return (
          style.display !== 'none' &&
          style.position !== 'absolute' &&
          child.getBoundingClientRect().height > 0
        )
      })
      .map((child) => ({ text: child.textContent, rect: child.getBoundingClientRect().toJSON() }))
    return { host, items }
  })
  expect(geometry.items.length).toBeGreaterThan(0)
  for (const { text, rect } of geometry.items) {
    expect(rect.top, `${text} must remain inside the instruction row`).toBeGreaterThanOrEqual(
      geometry.host.top - 1,
    )
    expect(rect.bottom, `${text} must not spill below the instruction row`).toBeLessThanOrEqual(
      geometry.host.bottom + 1,
    )
    expect(rect.left, `${text} must not spill left of the instruction row`).toBeGreaterThanOrEqual(
      geometry.host.left - 1,
    )
    expect(rect.right, `${text} must not spill right of the instruction row`).toBeLessThanOrEqual(
      geometry.host.right + 1,
    )
  }
}
