import { expect, test } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

test('ordinary desktop shell fits its identity and every navigation control without rail scroll', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Viewport matrix runs once on Chromium.')
  test.setTimeout(180_000)
  const seed = Date.now()
  await provisionAccountAndEnterCharacter({
    page,
    email: `shell-fit-${seed}-${info.workerIndex}@example.test`,
    password: 'Shell-viewport-fit-2026!',
    characterName: 'Frame Explorer',
  })

  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
    { width: 1366, height: 576 },
  ]) {
    await page.setViewportSize(viewport)
    await expect(page.getByTestId('character-rail-profile')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const metrics = await page.locator('[data-av-game-rail]').evaluate((rail) => {
      const box = rail.getBoundingClientRect()
      const portrait = rail.querySelector('[data-character-portrait-frame] img')!
      const footer = document.querySelector('[data-testid="authenticated-shell"] > footer')!
      const main = document.getElementById('game-main')!
      return {
        portrait: {
          width: portrait.getBoundingClientRect().width,
          height: portrait.getBoundingClientRect().height,
        },
        railOverflow: rail.scrollHeight - rail.clientHeight,
        mainOverflow: main.scrollHeight - main.clientHeight,
        documentOverflow: document.documentElement.scrollHeight - window.innerHeight,
        documentWidthOverflow: document.documentElement.scrollWidth - window.innerWidth,
        footerGap: footer.getBoundingClientRect().top - box.bottom,
        unreachable: Array.from(rail.querySelectorAll('a, button'))
          .filter((control) => {
            const rect = control.getBoundingClientRect()
            return (
              rect.top < box.top ||
              rect.bottom > box.bottom ||
              rect.left < box.left ||
              rect.right > box.right
            )
          })
          .map((control) => control.textContent),
      }
    })
    const label = `${viewport.width}×${viewport.height}`
    expect(metrics.railOverflow, `${label}: rail scroll`).toBeLessThanOrEqual(1)
    expect(metrics.mainOverflow, `${label}: Haven main scroll`).toBeLessThanOrEqual(1)
    expect(metrics.documentOverflow, `${label}: document scroll`).toBeLessThanOrEqual(1)
    expect(
      metrics.documentWidthOverflow,
      `${label}: horizontal document scroll`,
    ).toBeLessThanOrEqual(1)
    expect(Math.abs(metrics.footerGap), `${label}: rail ends above footer`).toBeLessThanOrEqual(1)
    expect(metrics.unreachable, `${label}: clipped navigation`).toEqual([])
    expect(metrics.portrait.width, `${label}: crisp actual portrait size`).toBeCloseTo(
      viewport.height > 700 ? 144 : 88,
      0,
    )
    expect(metrics.portrait.height).toBeCloseTo(metrics.portrait.width, 0)
    await info.attach(`shell-${label}`, { body: await page.screenshot(), contentType: 'image/png' })
  }

  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(
    await page
      .locator('[data-aether-wisp]')
      .evaluateAll((wisps) => wisps.map((wisp) => getComputedStyle(wisp).animationName)),
  ).toEqual(['none', 'none'])

  for (const width of [390, 360]) {
    await page.setViewportSize({ width, height: 844 })
    const nav = page.getByRole('navigation', { name: 'Primary game navigation', exact: true })
    for (const label of ['Haven', 'Profile', 'Loadout', 'Travel', 'Battle', 'Training']) {
      await expect(nav.getByRole('link', { name: label, exact: true })).toBeInViewport()
    }
    await expect(page.getByTestId('character-rail-profile')).toBeHidden()
    await info.attach(`shell-mobile-${width}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
  }
})
