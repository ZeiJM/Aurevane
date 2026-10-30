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
      expectGeometry(await geometry(dialog), baseline, `${width}x${height}: Skill preview focus`)
    }
    for (const input of await dialog.getByRole('radio').all()) {
      await input.focus()
      expectGeometry(await geometry(dialog), baseline, `${width}x${height}: Support preview focus`)
      await expect(dialog.getByTestId('technique-preview').locator('dl > div')).toHaveCount(8)
    }
    releaseSave = undefined
    const supportTab = dialog.getByRole('tab', { name: 'Support', exact: true })
    if (await supportTab.isVisible()) await supportTab.click()
    // Tab selection changes the visible gallery on phones; measure that active pane.
    const supportBaseline = await geometry(dialog)
    await dialog.getByRole('radio', { name: 'HP Recovery', exact: true }).check()
    // Compact Techniques hides its old footer at phone widths; assert the pending
    // live-region state without requiring a visible bottom notification.
    await expect(
      dialog.locator('[aria-live="polite"]', { hasText: 'Saving selection…' }),
    ).toHaveText('Saving selection…')
    await expect.poll(() => Boolean(releaseSave)).toBe(true)
    expectGeometry(
      await geometry(dialog),
      supportBaseline,
      `${width}x${height}: Support save pending`,
    )
    releaseSave!()
    await expect(dialog.getByRole('status')).toHaveText(error)
    await expect(dialog.getByRole('radio', { name: 'Guard', exact: true })).toBeChecked()
    expectGeometry(
      await geometry(dialog),
      supportBaseline,
      `${width}x${height}: Support save rejected`,
    )
    releaseSave = undefined
    const disciplineTab = dialog.getByRole('tab', { name: 'Discipline 1', exact: true })
    if (await disciplineTab.isVisible()) await disciplineTab.click()
    const skillBaseline = await geometry(dialog)
    const skill = dialog.locator('[data-technique-card] input:not(:disabled)').first()
    await skill.check()
    // Compact Techniques hides its old footer at phone widths; assert the pending
    // live-region state without requiring a visible bottom notification.
    await expect(
      dialog.locator('[aria-live="polite"]', { hasText: 'Saving selection…' }),
    ).toHaveText('Saving selection…')
    await expect.poll(() => Boolean(releaseSave)).toBe(true)
    expectGeometry(await geometry(dialog), skillBaseline, `${width}x${height}: Skill save pending`)
    releaseSave!()
    await expect(dialog.getByRole('status')).toHaveText(error)
    await expect(skill).not.toBeChecked()
    expectGeometry(await geometry(dialog), skillBaseline, `${width}x${height}: Skill save rejected`)
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
    // At phone sizes the inactive discipline gallery is intentionally display:none.
    // Measure a visible artwork tile from the selected category, including Support.
    const art = [
      ...node.querySelectorAll(
        '[data-technique-art], [data-technique-category="support"] [data-av-square-media]',
      ),
    ].find((tile) => tile.getBoundingClientRect().width > 0)
    if (!art) throw new Error('Active Techniques artwork is missing')
    const previewImages = preview.querySelectorAll('img').length
    const artRect = rect(art)
    const previewRect = rect(preview)
    // Mobile focus scrolls the gallery; compare positions within its content by adding back the
    // scroll offset of every scrolling ancestor between the element and the dialog.
    const scrolled = (element: Element) => {
      let total = 0
      for (let at = element.parentElement; at && at !== node.parentElement; at = at.parentElement) {
        total += at.scrollTop
      }
      return total
    }
    artRect[1] += scrolled(art)
    previewRect[1] += scrolled(preview)
    return {
      dialog: rect(node),
      workspace: rect(workspace),
      art: artRect,
      preview: previewRect,
      previewImages,
    }
  })
}

function expectGeometry(
  actual: Awaited<ReturnType<typeof geometry>>,
  expected: Awaited<ReturnType<typeof geometry>>,
  context: string,
) {
  expect(actual.previewImages, `${context}: preview does not duplicate chooser artwork`).toBe(0)
  for (const key of ['dialog', 'workspace', 'art', 'preview'] as const) {
    actual[key].forEach((value, index) =>
      expect(
        Math.abs(value - expected[key][index]),
        `${context}: ${key} dimension ${index} remains stable`,
      ).toBeLessThanOrEqual(1),
    )
  }
}
