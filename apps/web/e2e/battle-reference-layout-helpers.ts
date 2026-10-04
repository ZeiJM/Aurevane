import { expect, type Page, type TestInfo } from '@playwright/test'
import { expectRefinedCockpit, targetForecast } from './refined-battle-helpers'

export async function expectBattleChronicleGutterGeometry(page: Page, requireGrowth = false) {
  const geometry = await page.locator('#battlefield [data-board-auto-fit]').evaluate((board) => {
    const viewport = board.parentElement!
    const stage = board.closest('#battlefield')!.parentElement!
    const viewportStyle = getComputedStyle(viewport)
    const [columns, rows] = board.getAttribute('data-board-auto-fit')!.split('x').map(Number)
    return {
      screenWidth: innerWidth,
      rootFont: parseFloat(getComputedStyle(document.documentElement).fontSize),
      transfer:
        parseFloat(
          getComputedStyle(stage).getPropertyValue('--battle-chronicle-gutter-transfer'),
        ) || 0,
      availableWidth:
        viewport.clientWidth -
        parseFloat(viewportStyle.paddingLeft) -
        parseFloat(viewportStyle.paddingRight),
      availableHeight:
        viewport.clientHeight -
        parseFloat(viewportStyle.paddingTop) -
        parseFloat(viewportStyle.paddingBottom),
      columns,
      rows,
      gap: parseFloat(getComputedStyle(board).columnGap) || 0,
      board: board.getBoundingClientRect().toJSON(),
      chronicle: stage
        .querySelector('[data-battle-side="selected"]')!
        .getBoundingClientRect()
        .toJSON(),
    }
  })
  if (geometry.screenWidth <= 1100) {
    expect(geometry.transfer, 'smaller layouts keep their existing rail allocation').toBe(0)
    return
  }
  const { rootFont, columns, rows, gap, transfer } = geometry
  const originalWidth = geometry.availableWidth + transfer
  const footprintColumns = rows === 7 && [9, 12, 15].includes(columns!) ? 15 : columns!
  const originalTile = Math.max(
    0,
    Math.min(
      (originalWidth - (footprintColumns - 1) * gap) / footprintColumns,
      (geometry.availableHeight - (rows! - 1) * gap) / rows!,
    ),
  )
  expect(
    Math.abs(geometry.board.width - (columns! * originalTile + (columns! - 1) * gap)),
    'Chronicle growth preserves the original fitted board width',
  ).toBeLessThanOrEqual(1)
  expect(
    Math.abs(geometry.board.height - (rows! * originalTile + (rows! - 1) * gap)),
    'Chronicle growth preserves the original fitted board height',
  ).toBeLessThanOrEqual(1)
  const originalRail =
    Math.min(14 * rootFont, Math.max(10 * rootFont, geometry.screenWidth * 0.14)) - rootFont
  expect(
    Math.abs(geometry.chronicle.width - originalRail - transfer),
    'all reclaimed gutter goes to the Chronicle',
  ).toBeLessThanOrEqual(1)
  expect(transfer).toBeGreaterThanOrEqual(0)
  expect(transfer).toBeLessThanOrEqual(10 * rootFont)
  if (transfer > 0) {
    expect(
      geometry.availableWidth - (footprintColumns * originalTile + (footprintColumns - 1) * gap),
      'the widest arena footprint retains its safety gutter',
    ).toBeGreaterThanOrEqual(3 * rootFont - 1)
  }
  if (requireGrowth)
    expect(transfer, 'a wide, short stage gives spare map space to the Chronicle').toBeGreaterThan(
      0,
    )
}

export async function expectBattleHeaderAndArtworkGeometry(page: Page) {
  const root = page.locator('main[data-unified-battle="true"]')
  await expect(root.locator(':scope > header')).not.toContainText('Battle Hall ·')
  const geometry = await root.evaluate((element) => {
    const header = element.querySelector('[data-unified-battle-header]')!.getBoundingClientRect()
    const economy = element.querySelector('[data-unified-battle-economy]')!.getBoundingClientRect()
    const standards = Array.from(
      element.querySelectorAll<HTMLElement>(
        '[data-command-card] [data-battle-command-artwork="static"]',
      ),
    ).map((frame) => frame.getBoundingClientRect().toJSON())
    const selected = Array.from(
      element.querySelectorAll<HTMLElement>(
        '[data-battle-selected-skills] [data-battle-skill-slot] [data-av-square-media]:has(> img), ' +
          '[data-battle-selected-skills] [data-battle-special="essence"] [data-av-square-media]:has(> img), ' +
          '[data-battle-selected-skills] [data-battle-special="resonance"] [data-av-square-media]:has(> img)',
      ),
    ).map((frame) => ({
      frame: frame.getBoundingClientRect().toJSON(),
      image: frame.querySelector('img')!.getBoundingClientRect().toJSON(),
    }))
    const cards = [...element.querySelectorAll('[data-battle-combatant-card]')].map((card) => ({
      portrait: card.querySelector('[data-av-square-media]')!.getBoundingClientRect().toJSON(),
      resources: [...card.querySelectorAll('[data-resource]')].map((resource) => ({
        track: resource.querySelector('i')!.getBoundingClientRect().toJSON(),
        fill: resource.querySelector('b')!.getBoundingClientRect().toJSON(),
        maximum: Number(resource.querySelector('[role="meter"]')!.getAttribute('aria-valuemax')),
        current: Number(resource.querySelector('[role="meter"]')!.getAttribute('aria-valuenow')),
        valueLines: (() => {
          const range = document.createRange()
          range.selectNodeContents(resource.querySelector('[role="meter"] span')!)
          return [...range.getClientRects()].map((line) => line.toJSON())
        })(),
      })),
    }))
    return {
      cards,
      header: header.toJSON(),
      economy: economy.toJSON(),
      standards,
      selected,
      empty: Array.from(
        element.querySelectorAll<HTMLElement>(
          '[data-battle-selected-skills] [aria-label="Empty selected Skill slot"]',
        ),
      ).map((frame) => frame.getBoundingClientRect().toJSON()),
      selectedGroups: [
        '[aria-label="Selected Discipline Skills"]',
        '[data-battle-special="essence"], [data-battle-special="resonance"]',
        '[data-battle-special="supernatural"]',
      ].map((selector) => element.querySelector(selector)!.getBoundingClientRect().toJSON()),
      width: innerWidth,
    }
  })
  if (geometry.width > 820) {
    expect(
      Math.abs(
        geometry.economy.x +
          geometry.economy.width / 2 -
          (geometry.header.x + geometry.header.width / 2),
      ),
      'AP panel centers against the whole header',
    ).toBeLessThanOrEqual(1)
  } else {
    const [skills, extension, future] = geometry.selectedGroups
    expect(
      skills!.right,
      'selected Skill group does not overlap Essence or Resonance',
    ).toBeLessThanOrEqual(extension!.left)
    expect(
      extension!.right,
      'Essence or Resonance does not overlap the future group',
    ).toBeLessThanOrEqual(future!.left)
  }
  expect(geometry.standards).toHaveLength(5)
  expect(
    geometry.selected.length,
    'authored selected Skill or Essence artwork provides the size baseline',
  ).toBeGreaterThan(0)
  const baseline = geometry.selected[0]!.frame
  expect(baseline.width).toBeGreaterThan(0)
  for (const card of geometry.cards) {
    expect(
      Math.abs(card.portrait.width - baseline.width),
      'combatant portraits match cockpit artwork',
    ).toBeLessThanOrEqual(1)
    const [hp, mp] = card.resources
    expect(hp!.track.width, 'resource tracks stay visible').toBeGreaterThan(0)
    expect(
      Math.abs(hp!.track.width - mp!.track.width),
      'HP and MP share one track width regardless of label length',
    ).toBeLessThanOrEqual(1)
    for (const resource of card.resources) {
      expect(resource.fill.width).toBeLessThanOrEqual(resource.track.width + 1)
      if (resource.maximum > 0 && resource.current === resource.maximum) {
        expect(
          Math.abs(resource.fill.width - resource.track.width),
          'full resources fill their equal tracks',
        ).toBeLessThanOrEqual(1)
      }
      for (const line of resource.valueLines) {
        expect(line.left, 'complete resource value remains visible').toBeGreaterThanOrEqual(
          resource.track.left - 1,
        )
        expect(line.right).toBeLessThanOrEqual(resource.track.right + 1)
      }
    }
  }
  for (const frame of [
    ...geometry.standards,
    ...geometry.selected.map((item) => item.frame),
    ...geometry.empty,
  ]) {
    expect(
      Math.abs(frame.width - frame.height),
      'command and selected artwork stay square',
    ).toBeLessThanOrEqual(1)
    expect(
      Math.abs(frame.width - baseline.width),
      'standard commands match authored selected artwork width',
    ).toBeLessThanOrEqual(1)
    expect(
      Math.abs(frame.height - baseline.height),
      'standard commands match authored selected artwork height',
    ).toBeLessThanOrEqual(1)
  }
  for (const { frame, image } of geometry.selected) {
    expect(image.width).toBeLessThanOrEqual(frame.width + 1)
    expect(image.height).toBeLessThanOrEqual(frame.height + 1)
    expect(
      Math.abs(image.width - image.height),
      'Skill imagery preserves its square proportions',
    ).toBeLessThanOrEqual(1)
  }
}

export async function expectBattleReferenceLayout(page: Page, testInfo: TestInfo, label: string) {
  const root = page.locator('main[data-unified-battle="true"]')
  await expect(root).toHaveAttribute('data-battle-layout', 'refined')
  await expectRefinedCockpit(page)
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
  })
  await expectBattleHeaderAndArtworkGeometry(page)
  await expectBattleChronicleGutterGeometry(page)
  const geometry = await root.evaluate((element) => {
    const rect = (selector: string) =>
      element.querySelector(selector)!.getBoundingClientRect().toJSON()
    const board = element.querySelector('[data-board-auto-fit]')!
    const boardRect = board.getBoundingClientRect()
    const viewport = board.parentElement!.getBoundingClientRect()
    const tile = board.querySelector('button')!.getBoundingClientRect()
    const last = board.querySelector('button:last-child')!.getBoundingClientRect()
    return {
      board: boardRect.toJSON(),
      viewport: viewport.toJSON(),
      tile: tile.toJSON(),
      last: last.toJSON(),
      deck: rect('[data-unified-command-deck]'),
      forecast: rect('[data-battle-preview-strip]'),
      key: rect('button[aria-label="Terrain"]'),
      cancel: rect('[data-battle-footer-actions] > button:nth-child(2)'),
      log: rect('[data-battle-inline-log]'),
      leftCardRoles: [
        ...element.querySelectorAll('[data-battle-side="local"] > [data-battle-combatant-card]'),
      ].map((card) => card.getAttribute('data-battle-combatant-card')),
      rightCardCount: element.querySelectorAll(
        '[data-battle-side="selected"] [data-battle-combatant-card]',
      ).length,
      versus: {
        bounds: rect('[data-battle-versus]'),
        pointerEvents: getComputedStyle(element.querySelector('[data-battle-versus]')!)
          .pointerEvents,
        animation: getComputedStyle(element.querySelector('[data-battle-versus-flames]')!)
          .animationName,
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      },
      tokens: [...board.querySelectorAll('button[aria-label*="occupied by"] > [data-team]')].map(
        (token) => ({
          token: token.getBoundingClientRect().toJSON(),
          tile: token.parentElement!.getBoundingClientRect().toJSON(),
          portrait: token
            .querySelector(
              ':scope > .character-portrait-media, :scope > [class*="unitPortraitFallback"]',
            )!
            .getBoundingClientRect()
            .toJSON(),
          border: parseFloat(getComputedStyle(token).borderLeftWidth),
        }),
      ),
      cards: [...element.querySelectorAll('[data-battle-combatant-card]')].map((card) => {
        const portrait = card.querySelector('[data-av-square-media]')!
        const header = card.querySelector('header')!
        const facing = header.querySelector('span')!
        const arrow = facing.querySelector('svg')!
        const grid = card.querySelector('section[aria-label$=" combat effects"] > div')!
        const gridStyle = getComputedStyle(grid)
        const cardStyle = getComputedStyle(card)
        const headerStyle = getComputedStyle(header)
        return {
          bounds: card.getBoundingClientRect().toJSON(),
          portrait: portrait.getBoundingClientRect().toJSON(),
          header: header.getBoundingClientRect().toJSON(),
          facing: facing.getBoundingClientRect().toJSON(),
          arrow: arrow.getBoundingClientRect().toJSON(),
          grid: grid.getBoundingClientRect().toJSON(),
          gridColumns: gridStyle.gridTemplateColumns.split(' ').length,
          rowSize: parseFloat(gridStyle.gridAutoRows),
          rowGap: parseFloat(gridStyle.rowGap),
          identityWidth:
            header.clientWidth -
            parseFloat(headerStyle.paddingLeft) -
            parseFloat(headerStyle.paddingRight),
          portraitRowHeight: parseFloat(cardStyle.gridTemplateRows.split(' ')[1]!),
          vitals: card
            .querySelector('[data-resource]')!
            .parentElement!.getBoundingClientRect()
            .toJSON(),
          overflow: card.scrollHeight - card.clientHeight,
          cardContentWidth:
            card.clientWidth -
            parseFloat(cardStyle.paddingLeft) -
            parseFloat(cardStyle.paddingRight),
        }
      }),
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      w: innerWidth,
      h: innerHeight,
    }
  })
  await testInfo.attach(`${label}-geometry.json`, {
    body: JSON.stringify(geometry, null, 2),
    contentType: 'application/json',
  })
  await testInfo.attach(label, {
    body: await page.screenshot({ path: testInfo.outputPath(`${label}.png`) }),
    contentType: 'image/png',
  })
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.w + 1)
  expect(geometry.leftCardRoles).toEqual(['local', 'selected'])
  expect(geometry.rightCardCount).toBe(0)
  const [localCard, enemyCard] = geometry.cards
  const seam = (localCard!.bounds.bottom + enemyCard!.bounds.top) / 2
  expect(
    Math.abs(geometry.versus.bounds.top + geometry.versus.bounds.height / 2 - seam),
    'VS centers on the existing card seam without adding a grid row',
  ).toBeLessThanOrEqual(1)
  expect(geometry.versus.bounds.width).toBeLessThanOrEqual(108)
  expect(geometry.versus.bounds.left).toBeGreaterThanOrEqual(localCard!.bounds.left)
  expect(geometry.versus.bounds.right).toBeLessThanOrEqual(localCard!.bounds.right)
  expect(geometry.versus.pointerEvents).toBe('none')
  expect(geometry.versus.animation === 'none').toBe(geometry.versus.reducedMotion)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(
    await root
      .locator('[data-battle-versus-flames]')
      .evaluate((node) => getComputedStyle(node).animationName),
  ).toBe('none')
  await page.emulateMedia({ reducedMotion: null })
  expect(Math.abs(geometry.tile.width - geometry.tile.height)).toBeLessThanOrEqual(1)
  if (geometry.w > 820) {
    expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.h + 1)
    expect(geometry.board.left).toBeGreaterThanOrEqual(geometry.viewport.left - 1)
    expect(geometry.last.right).toBeLessThanOrEqual(geometry.viewport.right + 1)
    expect(geometry.last.bottom).toBeLessThanOrEqual(geometry.viewport.bottom + 1)
    expect(geometry.key.top).toBeGreaterThanOrEqual(geometry.deck.bottom - 1)
    expect(geometry.key.right).toBeLessThanOrEqual(geometry.cancel.left + 1)
    expect(geometry.log.left).toBeGreaterThanOrEqual(geometry.viewport.right - 1)
    expect(geometry.forecast.top).toBeGreaterThanOrEqual(geometry.viewport.bottom - 1)
    expect(geometry.deck.top).toBeGreaterThanOrEqual(geometry.forecast.bottom - 1)
  }
  expect(geometry.tokens.length, 'occupied map tokens are measured').toBeGreaterThan(0)
  for (const { token, tile, portrait, border } of geometry.tokens) {
    expect(token.width).toBeGreaterThan(tile.width * 0.8)
    expect(token.width).toBeLessThanOrEqual(tile.width * 0.9)
    expect(Math.abs(token.width - token.height)).toBeLessThanOrEqual(1)
    expect(
      Math.abs(portrait.width - portrait.height),
      'portrait crop stays circular',
    ).toBeLessThanOrEqual(1)
    expect(
      Math.abs(portrait.x + portrait.width / 2 - (token.x + token.width / 2)),
      'portrait centers in identity ring',
    ).toBeLessThanOrEqual(1)
    expect(
      Math.abs(portrait.y + portrait.height / 2 - (token.y + token.height / 2)),
    ).toBeLessThanOrEqual(1)
    expect(
      Math.abs(portrait.width + border * 2 - token.width),
      'ring fits around portrait',
    ).toBeLessThanOrEqual(1)
  }
  for (const card of geometry.cards) {
    expect(card.header.bottom, 'name and facing are above the portrait').toBeLessThanOrEqual(
      card.portrait.top + 1,
    )
    expect(
      Math.abs(card.arrow.x + card.arrow.width / 2 - (card.facing.x + card.facing.width / 2)),
    ).toBeLessThanOrEqual(1)
    expect(
      Math.abs(card.arrow.y + card.arrow.height / 2 - (card.facing.y + card.facing.height / 2)),
    ).toBeLessThanOrEqual(1)
    expect(Math.abs(card.portrait.width - card.portrait.height)).toBeLessThanOrEqual(1)
    if (geometry.w > 820) {
      expect(card.portrait.height).toBeGreaterThanOrEqual(32)
      expect(card.portrait.right, 'portrait sits left of vitals').toBeLessThanOrEqual(
        card.vitals.left + 1,
      )
      expect(
        Math.abs(
          (card.portrait.top + card.portrait.bottom) / 2 -
            (card.vitals.top + card.vitals.bottom) / 2,
        ),
        'vitals are centered beside the avatar',
      ).toBeLessThanOrEqual(1)
      expect(card.grid.top, 'effects sit below the avatar and vitals').toBeGreaterThanOrEqual(
        Math.max(card.portrait.bottom, card.vitals.bottom) - 1,
      )
      for (const content of [card.header, card.portrait, card.vitals, card.grid]) {
        expect(content.left).toBeGreaterThanOrEqual(card.bounds.left - 1)
        expect(content.right).toBeLessThanOrEqual(card.bounds.right + 1)
        expect(content.top).toBeGreaterThanOrEqual(card.bounds.top - 1)
        expect(content.bottom).toBeLessThanOrEqual(card.bounds.bottom + 1)
      }
      expect(card.overflow).toBeLessThanOrEqual(1)
    }
    expect(card.gridColumns, 'ten effect icons per row').toBe(10)
    expect(
      Math.abs(card.grid.height - (card.rowSize * 2 + card.rowGap)),
      'two effect rows are reserved',
    ).toBeLessThanOrEqual(1)
  }
  await expectBattlePreviewFits(page)
}

export async function expectBattleFlowKeepsBoardSize(page: Page) {
  const board = page.locator('#battlefield [data-board-auto-fit]')
  const deck = page.locator('[data-unified-command-deck]')
  const sizes = async () => ({ board: await board.boundingBox(), deck: await deck.boundingBox() })
  const before = await sizes()
  const reader = page.locator('[data-battle-inline-log] [data-battle-chronicle]')
  await expect(reader).toBeVisible()
  await reader.focus()
  for (const key of ['Home', 'End']) {
    await reader.press(key)
    const after = await sizes()
    for (const region of ['board', 'deck'] as const) {
      expect(after[region]?.width).toBe(before[region]?.width)
      expect(after[region]?.height).toBe(before[region]?.height)
    }
  }
}

export async function expectBattlePreviewFits(page: Page) {
  const geometry = await targetForecast(page).evaluate((element) => {
    const host = element.getBoundingClientRect().toJSON()
    const items = [
      ...element.querySelectorAll<HTMLElement>(
        '[data-battle-instruction-title], [data-react-battle-preview] > span, [data-react-battle-preview] > button',
      ),
    ]
      .filter(
        (item) =>
          getComputedStyle(item).position !== 'absolute' && item.getBoundingClientRect().height > 0,
      )
      .map((item) => item.getBoundingClientRect().toJSON())
    return { host, items }
  })
  expect(geometry.items.length).toBeGreaterThan(0)
  for (const rect of geometry.items) {
    expect(rect.left).toBeGreaterThanOrEqual(geometry.host.left - 1)
    expect(rect.right).toBeLessThanOrEqual(geometry.host.right + 1)
    expect(rect.top).toBeGreaterThanOrEqual(geometry.host.top - 1)
    expect(rect.bottom).toBeLessThanOrEqual(geometry.host.bottom + 1)
  }
}
