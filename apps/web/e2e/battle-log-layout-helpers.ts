import { expect, type Locator, type Page, type TestInfo } from '@playwright/test'

/** Desktop retains the visible reader; mobile uses the permanently docked action timeline. */
export async function setBattleChronicleOpen(page: Page, open: boolean) {
  await page.locator('main[data-battle-concept]').waitFor({ state: 'visible' })
  const timeline = page.locator('[data-battle-mobile-chronicle-strip]')
  if (await timeline.isVisible()) {
    await expect(timeline.locator('[data-battle-action-strip]')).toBeVisible()
    await expect(page.locator('[data-battle-mobile-chronicle-toggle]')).toHaveCount(0)
    if (!open) {
      await page.keyboard.press('Escape')
      await expect(timeline.getByRole('dialog', { name: /Chronicle action:/i })).toHaveCount(0)
    }
  } else if (open) {
    await expect(page.locator('[data-battle-inline-log] [data-battle-chronicle]')).toBeVisible()
  }
}

export async function battleChronicleScrollRegion(page: Page, reader: Locator) {
  const timeline = page.locator('[data-battle-mobile-chronicle-strip]')
  return (await timeline.isVisible()) ? timeline.locator('[aria-label="Battle actions"]') : reader
}

export async function scrollBattleChronicle(page: Page, reader: Locator, edge: 'start' | 'end') {
  const scroller = await battleChronicleScrollRegion(page, reader)
  if (edge === 'end')
    await scroller.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
  else {
    const top = await reader.evaluate((element) => {
      const panel = element.closest('[data-battle-mobile-lower-panel]')
      return panel && getComputedStyle(panel).display !== 'contents'
        ? panel.scrollTop + element.getBoundingClientRect().top - panel.getBoundingClientRect().top
        : 0
    })
    await scroller.evaluate((element, top) => {
      element.scrollTop = top
    }, top)
  }
}

/** Exercise the full text reader and effect explanations without changing battle geometry. */
export async function expectReadableBattleLog(
  page: Page,
  testInfo: TestInfo,
  label: string,
  log: Locator = page.locator('[data-battle-inline-log]'),
) {
  await setBattleChronicleOpen(page, true)
  const mobileTimeline = page.locator('[data-battle-mobile-chronicle-strip]')
  if (await mobileTimeline.isVisible()) {
    const strip = mobileTimeline.locator('[data-battle-action-strip]')
    const track = strip.locator('[aria-label="Battle actions"]')
    await expect(track).toBeVisible()
    await expect(mobileTimeline.locator('[data-battle-round]')).toBeVisible()
    const action = track.getByRole('button', { name: /Show Chronicle details/i }).last()
    const geometry = () =>
      page.evaluate(() =>
        [
          '[data-board-auto-fit]',
          '[data-battle-mobile-chronicle-strip]',
          '[data-battle-mobile-footer]',
        ].map((selector) => {
          const node = document.querySelector(selector)
          if (!node) throw new Error('Missing battle region: ' + selector)
          const bounds = node.getBoundingClientRect()
          return [selector, bounds.x, bounds.y, bounds.width, bounds.height]
        }),
      )
    const before = await geometry()
    if (await action.count()) {
      await action.click()
      const details = strip.getByRole('dialog', { name: /Chronicle action:/i })
      await expect(details).toBeVisible()
      await expect(details).not.toContainText('rollBasisPoints')
      await expect(page.locator('dialog[data-battle-action-details]')).toHaveCount(0)
      await details.getByRole('button', { name: 'Close Chronicle action' }).click()
      await expect(details).toHaveCount(0)
      await expect(action).toHaveAttribute('aria-expanded', 'false')
    }
    const after = await geometry()
    expect(after, 'Chronicle action details must not resize the mobile battle').toEqual(before)
    await testInfo.attach(`${label}-chronicle-geometry`, {
      body: JSON.stringify({ before, after }, null, 2),
      contentType: 'application/json',
    })
    await testInfo.attach(`${label}-chronicle`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
    return
  }
  const reader = log.getByRole('region', { name: 'Battle chronicle', exact: true })
  await expect(reader).toBeVisible()
  await expect(reader).toHaveAttribute('tabindex', '0')
  await expect(log.locator(':scope > header')).toHaveCount(0)
  await expect(log.getByText('Battle Log', { exact: true })).toHaveCount(0)
  await expect(log.getByText('Live', { exact: true })).toHaveCount(0)
  await expect(
    log.getByRole('button', {
      name: /Switch to (?:Timeline|Text log)|(?:Previous|Next) (?:turn|actions|details page)|Expand battle history|Action details:/,
    }),
  ).toHaveCount(0)
  await expect(
    log.getByRole('group', {
      name: /Filter battle actions|Battle history pages|Battle history turns/,
    }),
  ).toHaveCount(0)
  await expect(
    log.getByRole('list', { name: /Battle action timeline|Battle action transcript/ }),
  ).toHaveCount(0)
  await expect(page.locator('dialog[data-battle-action-details]')).toHaveCount(0)
  await expect(reader).not.toContainText('rollBasisPoints')

  const measure = () =>
    log.evaluate((element) => {
      const reading = element.querySelector<HTMLElement>('[data-battle-chronicle]')!
      const lower = element.closest<HTMLElement>('[data-battle-mobile-lower-panel]')
      const scrolling = lower && getComputedStyle(lower).display !== 'contents' ? lower : reading
      const rect = (node: Element) => {
        const box = node.getBoundingClientRect()
        return { top: box.top, bottom: box.bottom, left: box.left, right: box.right }
      }
      // Mobile BattleRouteFrame can scroll independently from the document.
      const layoutRect = (node: Element) => {
        const box = node.getBoundingClientRect()
        let x = box.x + window.scrollX
        let y = box.y + window.scrollY
        for (let parent = node.parentElement; parent; parent = parent.parentElement) {
          if (parent === document.scrollingElement) continue
          x += parent.scrollLeft
          y += parent.scrollTop
        }
        return { x, y, width: box.width, height: box.height }
      }
      const origin =
        lower && getComputedStyle(lower).display !== 'contents'
          ? layoutRect(
              element.closest('[data-unified-battle-content]') ??
                element.closest('main') ??
                document.body,
            )
          : { x: 0, y: 0 }
      const relativeLayout = (node: Element) => {
        const bounds = layoutRect(node)
        return { ...bounds, x: bounds.x - origin.x, y: bounds.y - origin.y }
      }
      const stableRegions: Record<string, ReturnType<typeof layoutRect>> = {
        log: relativeLayout(element),
        reader: relativeLayout(reading),
      }
      for (const selector of [
        '[data-board-auto-fit]',
        'main[data-battle-concept] > header',
        '[data-battle-side="local"]',
        '[data-battle-mobile-lower-panel]',
        '[data-battle-mobile-footer]',
        '[data-unified-command-deck]',
        '[data-battle-preview-strip]',
        'button[aria-label="Terrain"]',
      ]) {
        const region = document.querySelector(selector)
        if (region) stableRegions[selector] = relativeLayout(region)
      }
      return {
        log: rect(element),
        reader: rect(reading),
        stableRegions,
        horizontalOverflow: scrolling.scrollWidth - scrolling.clientWidth,
        verticalOverflow: scrolling.scrollHeight - scrolling.clientHeight,
        overflowY: getComputedStyle(scrolling).overflowY,
        readingHeight: scrolling.clientHeight,
        viewportHeight: innerHeight,
      }
    })
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
  })
  const before = await measure()
  expect(before.reader.top).toBeGreaterThanOrEqual(before.log.top - 1)
  expect(before.reader.bottom).toBeLessThanOrEqual(before.log.bottom + 1)
  expect(before.reader.left).toBeGreaterThanOrEqual(before.log.left - 1)
  expect(before.reader.right).toBeLessThanOrEqual(before.log.right + 1)
  expect(before.readingHeight).toBeGreaterThanOrEqual(36)
  expect(before.horizontalOverflow).toBeLessThanOrEqual(1)
  expect(['auto', 'scroll']).toContain(before.overflowY)
  if (!(await page.locator('[data-battle-mobile-chronicle-toggle]').isVisible())) {
    expect(before.log.top).toBeGreaterThanOrEqual(-1)
    expect(before.log.bottom).toBeLessThanOrEqual(before.viewportHeight + 1)
  }
  const actions = reader.locator('[data-chronicle-action]')
  if (await actions.count()) {
    expect(await reader.locator('h2').allTextContents()).toEqual(
      expect.arrayContaining([expect.stringMatching(/^ROUND \d+$/)]),
    )
    expect(await reader.locator('[data-chronicle-actor] h3').count()).toBeGreaterThan(0)
    for (const action of await actions.all()) {
      if ((await action.getAttribute('data-chronicle-family')) === 'movement') {
        await expect(action.locator(':scope > p')).toHaveText(/.+ moves\./)
      } else {
        await expect(action.locator(':scope > h4')).not.toHaveText('')
      }
      expect(await action.locator(':scope > p').count()).toBeGreaterThan(0)
    }
  }
  const scroller = await battleChronicleScrollRegion(page, reader)
  const scrollTop = await scroller.evaluate((element) => element.scrollTop)
  await reader.evaluate((element) => (element as HTMLElement).focus({ preventScroll: true }))
  await scrollBattleChronicle(page, reader, 'start')
  if (before.verticalOverflow > 1) {
    await scroller.hover()
    await page.mouse.wheel(0, before.readingHeight)
    await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  }
  const effect = reader.getByRole('button', { name: /^Explain / }).first()
  if (await effect.count()) {
    const effectName = (await effect.getAttribute('aria-label'))!.replace(/^Explain /, '')
    await effect.click()
    const panel = page.getByRole('dialog', { name: effectName, exact: true })
    await expect(panel).toBeVisible()
    await expect(panel.locator(':scope > p').first()).not.toHaveText('')
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
  }
  const after = await measure()
  await testInfo.attach(`${label}-chronicle-geometry`, {
    body: JSON.stringify({ before, after }, null, 2),
    contentType: 'application/json',
  })
  expect(Object.keys(after.stableRegions)).toEqual(Object.keys(before.stableRegions))
  for (const [region, bounds] of Object.entries(after.stableRegions)) {
    for (const dimension of ['x', 'y', 'width', 'height'] as const) {
      expect(
        Math.abs(bounds[dimension] - before.stableRegions[region]![dimension]),
        `${region} ${dimension} stays fixed while reading the chronicle`,
      ).toBeLessThanOrEqual(1)
    }
  }
  await scroller.evaluate((element, top) => {
    element.scrollTop = top
  }, scrollTop)
  await testInfo.attach(`${label}-chronicle`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
}
