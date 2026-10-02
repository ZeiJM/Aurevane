import { expect, test, type Locator, type Route } from '@playwright/test'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

test('Techniques preserves geometry through previews, pending saves and failed saves', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One flow covers desktop and phone viewports.',
  )
  test.setTimeout(120_000)
  const seed = Date.now()
  await provisionAccountAndEnterCharacter({
    page,
    email: `techniques-stable-${seed}@example.com`,
    password: 'Techniques-stable-2026!',
    characterName: `Stable ${String(seed)
      .split('')
      .map((x) => String.fromCharCode(65 + Number(x)))
      .join('')}`,
  })
  await page.goto('/game/nexus')
  await page
    .getByTestId('skill-build-panel')
    .getByRole('button', { name: /Manage Techniques/ })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Techniques', exact: true })
  const error =
    'The selected Techniques could not be saved because the build changed. Please close Techniques and refresh your build before trying again.'
  let releaseSave: (() => void) | undefined
  const failSave = async (route: Route) => {
    await new Promise<void>((resolve) => {
      releaseSave = resolve
    })
    await route.fulfill({ status: 409, json: { error: { message: error } } })
  }
  await page.route('**/api/character/build/support-action', failSave)
  await page.route('**/api/character/build/skills', failSave)
  for (const [width, height] of [
    [1280, 720],
    [1366, 768],
    [1536, 614],
    [1920, 1080],
    [390, 844],
    [360, 740],
  ]) {
    await page.setViewportSize({ width, height })
    const baseline = await geometry(dialog)
    for (const input of await dialog.locator('[data-technique-card] input').all()) {
      await input.focus()
      expectGeometry(await geometry(dialog), baseline)
    }
    for (const input of await dialog.getByRole('radio').all()) {
      await input.focus()
      expectGeometry(await geometry(dialog), baseline)
      await expect(dialog.getByTestId('technique-preview').locator('dl > div')).toHaveCount(10)
    }
    releaseSave = undefined
    await dialog.getByRole('radio', { name: 'HP Recovery', exact: true }).check()
    await expect(dialog.getByText('Saving selection…', { exact: true })).toBeVisible()
    await expect.poll(() => Boolean(releaseSave)).toBe(true)
    expectGeometry(await geometry(dialog), baseline)
    releaseSave!()
    await expect(dialog.getByRole('status')).toHaveText(error)
    await expect(dialog.getByRole('radio', { name: 'Guard', exact: true })).toBeChecked()
    expectGeometry(await geometry(dialog), baseline)
    releaseSave = undefined
    const skill = dialog.locator('[data-technique-card] input:not(:disabled)').first()
    await skill.check()
    await expect(dialog.getByText('Saving selection…', { exact: true })).toBeVisible()
    await expect.poll(() => Boolean(releaseSave)).toBe(true)
    expectGeometry(await geometry(dialog), baseline)
    releaseSave!()
    await expect(dialog.getByRole('status')).toHaveText(error)
    await expect(skill).not.toBeChecked()
    expectGeometry(await geometry(dialog), baseline)
    expect(
      await dialog.evaluate((node) => node.scrollWidth - node.clientWidth),
    ).toBeLessThanOrEqual(1)
  }
})

async function geometry(dialog: Locator) {
  return dialog.evaluate((node) => {
    const workspace = node.querySelector('[data-technique-workspace]')!
    const preview = node.querySelector('[data-testid="technique-preview"]')!
    const rect = (element: Element) => {
      const r = element.getBoundingClientRect()
      return [r.x, r.y, r.width, r.height]
    }
    const art = node.querySelector('[data-technique-art]')!
    const previewArt = preview.querySelector('[data-av-square-media]')!
    const artRect = rect(art)
    const previewRect = rect(previewArt)
    // Mobile focus scrolls the gallery; compare positions within its content.
    artRect[1] += workspace.scrollTop
    previewRect[1] += workspace.scrollTop + preview.scrollTop
    return {
      dialog: rect(node),
      workspace: rect(workspace),
      art: artRect,
      previewArt: previewRect,
    }
  })
}

function expectGeometry(
  actual: Awaited<ReturnType<typeof geometry>>,
  expected: Awaited<ReturnType<typeof geometry>>,
) {
  for (const key of ['dialog', 'workspace', 'art', 'previewArt'] as const) {
    actual[key].forEach((value, index) =>
      expect(
        Math.abs(value - expected[key][index]),
        `${key} dimension ${index} remains stable`,
      ).toBeLessThanOrEqual(1),
    )
  }
}
