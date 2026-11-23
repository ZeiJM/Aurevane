import { expect, test } from '@playwright/test'

import { commitGesture } from './refined-battle-helpers'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueIdentity(project: string): { email: string; characterName: string } {
  const seed = `${Date.now()}${Math.floor(Math.random() * 100_000)}`
  const suffix = seed
    .slice(-7)
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return {
    email: `move-preview.${project}.${seed}@example.com`,
    characterName: `MovePreview ${suffix}`,
  }
}

test('keeps Move reachable tiles distinct and executes one clicked path through the server', async ({
  page,
}, testInfo) => {
  test.skip(
    !['desktop-chromium', 'mobile-chromium'].includes(testInfo.project.name),
    'Move presentation is shared across desktop and mobile',
  )
  test.slow()

  const identity = uniqueIdentity(testInfo.project.name)
  await provisionAccountAndEnterCharacter({
    page,
    email: identity.email,
    password: 'AurevaneTest!42',
    characterName: identity.characterName,
  })

  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const battlefield = page.getByRole('region', { name: 'Tactical battlefield' })
  const commandDeck = page.getByRole('region', { name: 'Command Deck' })
  const moveButton = commandDeck.getByRole('button', { name: /^Move,/ })

  if (testInfo.project.name === 'mobile-chromium') await moveButton.tap()
  else await moveButton.click()

  await expect(moveButton).toHaveAttribute('data-battle-active', 'true')

  const reachable = battlefield.locator("button[aria-label^='Tile '][data-reachable]").first()
  const neutral = battlefield
    .locator("button[aria-label^='Tile ']:not([data-reachable]):not([data-path])")
    .filter({ hasNot: battlefield.locator('[data-target-relation]') })
    .first()
  await expect(reachable).toBeVisible()
  await expect(neutral).toBeVisible()

  const reachableStyle = await reachable.evaluate((tile) => {
    const style = getComputedStyle(tile)
    return { borderColor: style.borderColor, boxShadow: style.boxShadow }
  })
  const neutralStyle = await neutral.evaluate((tile) => {
    const style = getComputedStyle(tile)
    return { borderColor: style.borderColor, boxShadow: style.boxShadow }
  })

  expect(reachableStyle.borderColor).toBe('rgb(105, 210, 204)')
  expect(reachableStyle.boxShadow).toContain('inset')
  expect(reachableStyle.boxShadow).toContain('39, 190, 182')
  expect(neutralStyle.borderColor).not.toContain('226, 83, 83')
  expect(neutralStyle.boxShadow).not.toContain('206, 62, 62')

  const before = await page
    .getByRole('progressbar', { name: 'Action Economy remaining' })
    .getAttribute('aria-valuenow')
  const destination = (await reachable.getAttribute('aria-label'))!.split(';')[0]!
  const walkSamples = await page.evaluateHandle((name) => {
    const samples: { distance: number; facing: { left: number; top: number } | null }[] = []
    const sample = () => {
      const token = Array.from(
        document.querySelectorAll<HTMLElement>('[data-battle-token-walking="true"]'),
      ).find((actor) => actor.parentElement?.ariaLabel?.includes(`occupied by ${name}`))
      const tile = token?.parentElement
      if (token && tile) {
        const [x, y] = token.style.translate.split(' ').map(Number.parseFloat)
        const corner = tile.getBoundingClientRect()
        const marker = tile
          .querySelector(':scope > [data-battle-facing-indicator="true"]')
          ?.getBoundingClientRect()
        samples.push({
          distance: Math.hypot(x!, y!),
          facing: marker ? { left: marker.left - corner.left, top: marker.top - corner.top } : null,
        })
      } else if (samples.length > 0) {
        return
      }
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
    return samples
  }, identity.characterName)
  const result = await commitGesture(page, reachable)
  expect(result.request().postDataJSON().intent.kind).toBe('move')
  await expect(
    page.getByRole('progressbar', { name: 'Action Economy remaining' }),
  ).not.toHaveAttribute('aria-valuenow', before!)
  await expect(moveButton).toHaveAttribute('data-battle-active', 'true')
  const occupiedDestination = page.getByRole('button', {
    name: new RegExp(`^${destination};.*occupied by ${identity.characterName}`),
  })
  await expect(occupiedDestination).toBeVisible()
  await expect
    .poll(() =>
      walkSamples.evaluate((samples) => {
        const distances = samples.map(({ distance }) => distance)
        return distances.some(
          (distance) => distance > 0.5 && distance < Math.max(...distances) - 0.5,
        )
      }),
    )
    .toBe(true)
  await expect(occupiedDestination.locator('[data-battle-token-walking]')).toHaveCount(0)
  for (const { facing } of await walkSamples.jsonValue()) {
    expect(facing).not.toBeNull()
    expect(facing!.left).toBeGreaterThanOrEqual(1)
    expect(facing!.left).toBeLessThanOrEqual(5)
    expect(facing!.top).toBeGreaterThanOrEqual(1)
    expect(facing!.top).toBeLessThanOrEqual(5)
  }
  await walkSamples.dispose()
  await page.reload()
  await expect(
    page.getByRole('button', {
      name: new RegExp(`^${destination};.*occupied by ${identity.characterName}`),
    }),
  ).toBeVisible()
  await expect(battlefield.locator('[data-battle-token-walking]')).toHaveCount(0)
})
