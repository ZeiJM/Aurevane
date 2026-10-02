import { expect, test } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

test('ordinary desktop shell fits its identity and every navigation control without rail scroll', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Viewport matrix runs once on Chromium.')
  test.setTimeout(180_000)
  const seed = Date.now()
  const nameSuffix = seed
    .toString()
    .slice(-7)
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  await provisionAccountAndEnterCharacter({
    page,
    email: `shell-fit-${seed}-${info.workerIndex}@example.test`,
    password: 'Shell-viewport-fit-2026!',
    characterName: `Frame Explorer ${nameSuffix}`,
  })

  // Save a direct custom portrait through the same account flow as a player.
  const imageUrl = 'http://127.0.0.1:3100/media/art/adventure/male-01-v01.webp'
  await page.goto('/game/account/titles')
  await page.getByLabel('Direct image URL').fill(imageUrl)
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/account/profile-display') &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Save Profile Image', exact: true }).click()
  expect((await saved).ok()).toBe(true)
  const railImage = page.locator('[data-av-game-rail] [data-character-portrait-frame] img')
  await expect(railImage).toHaveAttribute('src', imageUrl)
  await expect(railImage).toHaveAttribute('loading', 'eager')
  await expect(railImage).toHaveAttribute('fetchpriority', 'high')
  await expect
    .poll(() => railImage.evaluate((image) => (image as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0)

  await page.evaluate(() => {
    const failures: string[] = []
    const observer = new MutationObserver(() => {
      const rail = document.querySelector('[data-av-game-rail]')
      const image = rail?.querySelector('[data-character-portrait-frame] img')
      if (!image || rail?.querySelector('[data-portrait-pending]'))
        failures.push('missing portrait')
      else if (!image.getAttribute('src')?.endsWith('/media/art/adventure/male-01-v01.webp'))
        failures.push('replaced portrait')
    })
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src'],
    })
    Object.assign(window, { avatarNavigationFailures: failures })
  })
  const navigation = page.getByRole('navigation', { name: 'Primary game navigation', exact: true })
  for (const [label, destination] of [
    ['Haven', '/game/haven'],
    ['Profile', '/game/character'],
    ['Loadout', '/game/nexus'],
    ['Haven', '/game/haven'],
  ]) {
    await navigation.getByRole('link', { name: label, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${destination}$`))
    await expect(railImage).toHaveAttribute('src', imageUrl)
    await expect(page.locator('[data-portrait-pending]')).toHaveCount(0)
  }
  expect(
    await page.evaluate(
      () => (window as Window & { avatarNavigationFailures?: string[] }).avatarNavigationFailures,
    ),
  ).toEqual([])
  const refresh = await page.reload()
  expect(refresh).not.toBeNull()
  // A hard refresh must also emit the resolved portrait, without an intermediate
  // streamed blank identity. Image network/decode time itself remains browser-owned.
  expect(await refresh!.text()).not.toContain('data-portrait-pending')
  await expect(railImage).toHaveAttribute('src', imageUrl)
  await expect
    .poll(() => railImage.evaluate((image) => (image as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0)

  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
    { width: 1366, height: 576 },
  ]) {
    await page.setViewportSize(viewport)
    await expect(
      page.locator('[data-av-game-rail]').getByTestId('character-rail-profile'),
    ).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const metrics = await page.locator('[data-av-game-rail]').evaluate((rail) => {
      const box = rail.getBoundingClientRect()
      const portrait = rail.querySelector('[data-character-portrait-frame] img')!
      const portraitFrame = rail.querySelector('[data-character-portrait-frame]')!
      const frameStyle = getComputedStyle(portraitFrame)
      const footer = document.querySelector('[data-testid="authenticated-shell"] > footer')!
      const main = document.getElementById('game-main')!
      return {
        portrait: {
          width: portrait.getBoundingClientRect().width,
          height: portrait.getBoundingClientRect().height,
          frameWidth: portraitFrame.getBoundingClientRect().width,
          frameHeight: portraitFrame.getBoundingClientRect().height,
          borderX: parseFloat(frameStyle.borderLeftWidth) + parseFloat(frameStyle.borderRightWidth),
          borderY: parseFloat(frameStyle.borderTopWidth) + parseFloat(frameStyle.borderBottomWidth),
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
        overflowingLabels: Array.from(
          rail.querySelectorAll('[aria-label="Primary game navigation"] a > span'),
        )
          .filter((label) => {
            const linkBox = label.parentElement!.getBoundingClientRect()
            const range = document.createRange()
            range.selectNodeContents(label)
            const textBox = range.getBoundingClientRect()
            return (
              label.scrollWidth > label.clientWidth + 1 ||
              textBox.left < linkBox.left - 1 ||
              textBox.right > linkBox.right + 1
            )
          })
          .map((label) => label.textContent),
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
    expect(metrics.overflowingLabels, `${label}: navigation text outside its control`).toEqual([])
    expect(metrics.portrait.frameWidth, `${label}: portrait frame size`).toBeCloseTo(
      viewport.height > 700 ? 165 : viewport.height > 620 ? 112 : 88,
      0,
    )
    expect(metrics.portrait.width + metrics.portrait.borderX).toBeCloseTo(
      metrics.portrait.frameWidth,
      0,
    )
    expect(metrics.portrait.height + metrics.portrait.borderY).toBeCloseTo(
      metrics.portrait.frameHeight,
      0,
    )
    expect(metrics.portrait.height).toBeCloseTo(metrics.portrait.width, 0)
    await info.attach(`shell-${label}`, { body: await page.screenshot(), contentType: 'image/png' })
  }

  const runes = page.locator('[data-aether-runes] > path')
  expect(
    await runes.evaluateAll((paths) =>
      paths.every((path) => getComputedStyle(path).animationName !== 'none'),
    ),
  ).toBe(true)
  const initialTransform = await runes.first().evaluate((path) => getComputedStyle(path).transform)
  await expect
    .poll(() => runes.first().evaluate((path) => getComputedStyle(path).transform))
    .not.toBe(initialTransform)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(
    await page
      .locator('[data-aether-wisp]')
      .evaluateAll((wisps) => wisps.map((wisp) => getComputedStyle(wisp).animationName)),
  ).toEqual(['none', 'none'])

  expect(
    await runes.evaluateAll((paths) =>
      paths.every((path) => getComputedStyle(path).animationName === 'none'),
    ),
  ).toBe(true)

  for (const width of [390, 360]) {
    await page.setViewportSize({ width, height: 844 })
    const nav = page.getByRole('navigation', { name: 'Primary game navigation', exact: true })
    for (const label of ['Haven', 'Profile', 'Loadout', 'Travel', 'Battle', 'Training']) {
      await expect(nav.getByRole('link', { name: label, exact: true })).toBeInViewport()
    }
    await expect(
      page.locator('[data-av-game-rail]').getByTestId('character-rail-profile'),
    ).toBeHidden()
    await info.attach(`shell-mobile-${width}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
  }
})
