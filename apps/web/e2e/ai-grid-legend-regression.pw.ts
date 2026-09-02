import { expect, test } from '@playwright/test'

import { createAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const seed = Date.now().toString()
  const suffix = seed
    .slice(-7)
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Grid Guard ${suffix}`
}

test('keeps the desktop AI 9x7 grid, shared terrain legend, and battle log dock structurally aligned', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop AI geometry regression')
  test.slow()

  const email = `ai-grid-${Date.now()}@example.com`
  const password = 'AurevaneTest!42'
  const characterName = uniqueCharacterName()

  await createAccountAndEnterCharacter({ page, email, password, characterName })
  await page.goto('/game/battle')
  await expect(page.getByRole('heading', { name: 'Choose your arena.' })).toBeVisible()

  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const battlefield = page.getByRole('region', { name: 'Tactical battlefield' })
  const board = battlefield.locator('[data-board-auto-fit="9x7"]')
  const terrainLegend = battlefield.locator(':scope > [aria-label="Terrain legend"]')

  await expect(battlefield).toBeVisible()
  await expect(board).toHaveCount(1)
  await expect(board.locator("button[aria-label^='Tile ']")).toHaveCount(63)

  await expect(terrainLegend).toHaveCount(1)
  await expect(terrainLegend).toBeVisible()
  await expect(terrainLegend.getByText('Difficult Terrain')).toBeVisible()
  await expect(terrainLegend.getByText('Elevated Ground')).toBeVisible()
  await expect(battlefield.locator('[data-ai-native-terrain-legend="true"]')).toHaveCount(0)
  await expect(battlefield.locator('[data-ai-legacy-terrain-legend="true"]')).toHaveCount(0)
  await expect(battlefield.locator('[data-terrain-legend-polish]')).toHaveCount(0)
  await expect(terrainLegend.getByRole('switch', { name: 'Tile coordinates' })).toBeVisible()

  const geometry = await board.evaluate((element) => {
    const tile11 = element.querySelector<HTMLButtonElement>('button[aria-label^="Tile 1, 1;"]')!
    const tile21 = element.querySelector<HTMLButtonElement>('button[aria-label^="Tile 2, 1;"]')!
    const tile12 = element.querySelector<HTMLButtonElement>('button[aria-label^="Tile 1, 2;"]')!
    const tile97 = element.querySelector<HTMLButtonElement>('button[aria-label^="Tile 9, 7;"]')!
    const viewport = element.parentElement!
    const boardRect = element.getBoundingClientRect()
    const viewportRect = viewport.getBoundingClientRect()
    const tile11Rect = tile11.getBoundingClientRect()
    const tile21Rect = tile21.getBoundingClientRect()
    const tile12Rect = tile12.getBoundingClientRect()
    const tile97Rect = tile97.getBoundingClientRect()

    return {
      tileWidth: tile11Rect.width,
      tileHeight: tile11Rect.height,
      columnGap: tile21Rect.left - tile11Rect.right,
      rowGap: tile12Rect.top - tile11Rect.bottom,
      boardLeft: boardRect.left,
      boardRight: boardRect.right,
      boardTop: boardRect.top,
      boardBottom: boardRect.bottom,
      viewportLeft: viewportRect.left,
      viewportRight: viewportRect.right,
      viewportTop: viewportRect.top,
      viewportBottom: viewportRect.bottom,
      lastTileRight: tile97Rect.right,
      lastTileBottom: tile97Rect.bottom,
    }
  })

  expect(Math.abs(geometry.tileWidth - geometry.tileHeight)).toBeLessThanOrEqual(1.5)
  expect(geometry.columnGap).toBeGreaterThan(0)
  expect(geometry.rowGap).toBeGreaterThan(0)
  expect(Math.abs(geometry.columnGap - geometry.rowGap)).toBeLessThanOrEqual(1.5)

  expect(geometry.boardLeft).toBeGreaterThanOrEqual(geometry.viewportLeft - 1)
  expect(geometry.boardRight).toBeLessThanOrEqual(geometry.viewportRight + 1)
  expect(geometry.boardTop).toBeGreaterThanOrEqual(geometry.viewportTop - 1)
  expect(geometry.boardBottom).toBeLessThanOrEqual(geometry.viewportBottom + 1)
  expect(geometry.lastTileRight).toBeLessThanOrEqual(geometry.viewportRight + 1)
  expect(geometry.lastTileBottom).toBeLessThanOrEqual(geometry.viewportBottom + 1)

  const coordinateToggle = terrainLegend.getByRole('switch', { name: 'Tile coordinates' })
  const combatLogButton = page.getByRole('button', { name: /Combat Log/ })
  await expect(coordinateToggle).toHaveAttribute('aria-checked', 'false')
  await coordinateToggle.click()
  await expect(coordinateToggle).toHaveAttribute('aria-checked', 'true')
  await combatLogButton.click()

  const dock = battlefield.locator('[data-docked-battle-log="true"]')
  await expect(dock).toBeVisible()
  await expect(terrainLegend).toBeVisible()
  await expect(terrainLegend.getByText('Difficult Terrain')).toBeVisible()
  await expect(terrainLegend.getByText('Elevated Ground')).toBeVisible()
  await expect(terrainLegend.getByRole('switch', { name: 'Tile coordinates' })).toBeVisible()

  await page.reload()
  await expect(coordinateToggle).toHaveAttribute('aria-checked', 'true')
  await expect(dock).toBeVisible()

  await coordinateToggle.click()
  await combatLogButton.click()
  await expect(coordinateToggle).toHaveAttribute('aria-checked', 'false')
  await expect(dock).toHaveCount(0)

  await page.reload()
  await expect(coordinateToggle).toHaveAttribute('aria-checked', 'false')
  await expect(dock).toHaveCount(0)
  await combatLogButton.click()
  await expect(dock).toBeVisible()

  const dockGeometry = await battlefield.evaluate((element) => {
    const docked = element.querySelector<HTMLElement>('[data-docked-battle-log="true"]')!
    const boardElement = element.querySelector<HTMLElement>('[data-board-auto-fit="9x7"]')!
    const legend = element.querySelector<HTMLElement>(':scope > [aria-label="Terrain legend"]')!
    const difficult = legend.children[0] as HTMLElement
    const elevated = legend.children[1] as HTMLElement
    const coordinate = legend.querySelector<HTMLElement>(
      'button[data-terrain-coordinate-toggle="true"]',
    )!
    const battlefieldRect = element.getBoundingClientRect()
    const boardRect = boardElement.getBoundingClientRect()
    const dockRect = docked.getBoundingClientRect()
    const legendRect = legend.getBoundingClientRect()
    const difficultRect = difficult.getBoundingClientRect()
    const elevatedRect = elevated.getBoundingClientRect()
    const coordinateRect = coordinate.getBoundingClientRect()
    const dockStyle = getComputedStyle(docked)
    const dockTransform = new DOMMatrixReadOnly(dockStyle.transform)
    const footerContinuation = getComputedStyle(element, '::after')

    return {
      battlefieldRight: battlefieldRect.right,
      battlefieldBottom: battlefieldRect.bottom,
      boardTop: boardRect.top,
      boardBottom: boardRect.bottom,
      dockTop: dockRect.top,
      dockRight: dockRect.right,
      dockBottom: dockRect.bottom,
      dockTranslateX: dockTransform.m41,
      legendLeft: legendRect.left,
      legendRight: legendRect.right,
      legendTop: legendRect.top,
      legendBottom: legendRect.bottom,
      difficultLeft: difficultRect.left,
      difficultRight: difficultRect.right,
      elevatedLeft: elevatedRect.left,
      elevatedRight: elevatedRect.right,
      coordinateLeft: coordinateRect.left,
      coordinateRight: coordinateRect.right,
      dockGridRowStart: dockStyle.gridRowStart,
      dockGridRowEnd: dockStyle.gridRowEnd,
      footerContinuationContent: footerContinuation.content,
      footerContinuationGridRowStart: footerContinuation.gridRowStart,
      footerContinuationBorderTopStyle: footerContinuation.borderTopStyle,
    }
  })

  expect(Math.abs(dockGeometry.dockTop - dockGeometry.boardTop)).toBeLessThanOrEqual(3)
  expect(Math.abs(dockGeometry.dockBottom - dockGeometry.boardBottom)).toBeLessThanOrEqual(3)
  expect(dockGeometry.dockBottom).toBeLessThan(dockGeometry.legendTop)
  expect(dockGeometry.legendTop).toBeLessThan(dockGeometry.legendBottom)
  expect(dockGeometry.legendBottom).toBeLessThanOrEqual(dockGeometry.battlefieldBottom + 1)
  expect(dockGeometry.dockGridRowStart).toBe('1')
  expect(dockGeometry.dockGridRowEnd).toBe('auto')

  expect(dockGeometry.dockTranslateX).toBeLessThan(-12)
  expect(dockGeometry.battlefieldRight - dockGeometry.dockRight).toBeGreaterThan(12)

  expect(dockGeometry.footerContinuationContent).not.toBe('none')
  expect(dockGeometry.footerContinuationGridRowStart).toBe('2')
  expect(dockGeometry.footerContinuationBorderTopStyle).toBe('solid')

  expect(dockGeometry.difficultLeft).toBeGreaterThanOrEqual(dockGeometry.legendLeft - 1)
  expect(dockGeometry.elevatedLeft).toBeGreaterThanOrEqual(dockGeometry.difficultRight - 1)
  expect(dockGeometry.coordinateLeft).toBeGreaterThanOrEqual(dockGeometry.elevatedRight - 1)
  expect(dockGeometry.coordinateRight).toBeLessThanOrEqual(dockGeometry.legendRight + 1)
})
