import { expect, test } from '@playwright/test'

import { createVerifiedAccountAndSignIn } from './pv1f-test-helpers'

function safeName(info: { workerIndex: number }) {
  const suffix = `${Date.now()}${info.workerIndex}`
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Aurelia ${suffix}`
}

test('Creation Discipline follows its own subject composition without losing real choices', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Desktop subject reconciliation only')
  test.setTimeout(90_000)
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname
  if (!['localhost', '127.0.0.1'].includes(host))
    throw new Error('Creation reconciliation requires disposable local Supabase.')

  await page.setViewportSize({ width: 1366, height: 768 })
  await createVerifiedAccountAndSignIn({
    page,
    email: `creation-subject-discipline-${Date.now()}@example.test`,
    password: 'Disposable-creation-subject-2026!',
  })
  await page.getByRole('link', { name: 'Create Character', exact: true }).click()

  const creation = page.getByTestId('character-creation')
  await creation.getByLabel('Character name', { exact: true }).fill(safeName(info))
  await creation.getByRole('button', { name: 'Choose your discipline', exact: true }).click()

  const workspace = creation.getByTestId('creation-discipline-workspace')
  const choices = creation.getByTestId('creation-discipline-choice')
  const rows = creation.getByTestId('creation-attribute-row')

  await expect(workspace).toBeVisible()
  await expect(workspace).toHaveAttribute('data-creation-surface', 'moonstone')
  await expect(choices).toHaveCount(6)
  await expect(rows).toHaveCount(6)
  await expect(creation.getByTestId('attribute-points')).toContainText('personal points remaining')

  const metrics = await page.evaluate(() => {
    const workspaceElement = document.querySelector<HTMLElement>(
      '[data-testid="creation-discipline-workspace"]',
    )!
    const firstRow = document.querySelectorAll<HTMLElement>(
      '[data-testid="creation-attribute-row"]',
    )[0]
    const secondRow = document.querySelectorAll<HTMLElement>(
      '[data-testid="creation-attribute-row"]',
    )[1]
    const background = getComputedStyle(workspaceElement).backgroundColor
    return {
      background,
      overflow: document.documentElement.scrollWidth - innerWidth,
      firstX: firstRow.getBoundingClientRect().x,
      secondX: secondRow.getBoundingClientRect().x,
      firstWidth: firstRow.getBoundingClientRect().width,
      secondWidth: secondRow.getBoundingClientRect().width,
    }
  })

  expect(metrics.overflow).toBeLessThanOrEqual(1)
  expect(Math.abs(metrics.firstX - metrics.secondX)).toBeLessThanOrEqual(2)
  expect(Math.abs(metrics.firstWidth - metrics.secondWidth)).toBeLessThanOrEqual(2)
  expect(metrics.firstWidth).toBeGreaterThan(700)
  const channels = (metrics.background.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)
  expect(Math.min(...channels)).toBeGreaterThan(150)
})

test('Creation Confirm follows its own subject composition and keeps genuine submission controls', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Desktop subject reconciliation only')
  test.setTimeout(90_000)
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname
  if (!['localhost', '127.0.0.1'].includes(host))
    throw new Error('Creation reconciliation requires disposable local Supabase.')

  await page.setViewportSize({ width: 1366, height: 768 })
  await createVerifiedAccountAndSignIn({
    page,
    email: `creation-subject-confirm-${Date.now()}@example.test`,
    password: 'Disposable-creation-subject-2026!',
  })
  await page.getByRole('link', { name: 'Create Character', exact: true }).click()

  const creation = page.getByTestId('character-creation')
  await creation.getByLabel('Character name', { exact: true }).fill(safeName(info))
  await creation.getByRole('button', { name: 'Choose your discipline', exact: true }).click()
  await creation.getByRole('button', { name: 'Review character', exact: true }).click()

  const workspace = creation.getByTestId('creation-confirm-workspace')
  const portrait = creation.getByTestId('creation-confirm-portrait')
  const summary = creation.getByTestId('creation-confirm-summary')

  await expect(workspace).toBeVisible()
  await expect(workspace).toHaveAttribute('data-creation-surface', 'moonstone')
  await expect(portrait).toBeVisible()
  await expect(summary).toBeVisible()
  await expect(creation.getByTestId('creation-confirm-discipline-sigil')).toBeVisible()
  await expect(creation).not.toContainText(/pronouns/i)
  await expect(creation.getByRole('button', { name: 'Back', exact: true })).toBeEnabled()
  await expect(
    creation.getByRole('button', { name: 'Create character', exact: true }),
  ).toBeEnabled()

  const geometry = await page.evaluate(() => {
    const portraitElement = document.querySelector<HTMLElement>(
      '[data-testid="creation-confirm-portrait"]',
    )!
    const summaryElement = document.querySelector<HTMLElement>(
      '[data-testid="creation-confirm-summary"]',
    )!
    const workspaceElement = document.querySelector<HTMLElement>(
      '[data-testid="creation-confirm-workspace"]',
    )!
    const portraitBox = portraitElement.getBoundingClientRect()
    const summaryBox = summaryElement.getBoundingClientRect()
    const background = getComputedStyle(workspaceElement).backgroundColor
    return {
      background,
      overflow: document.documentElement.scrollWidth - innerWidth,
      portraitRight: portraitBox.right,
      summaryLeft: summaryBox.left,
      portraitWidth: portraitBox.width,
    }
  })

  expect(geometry.overflow).toBeLessThanOrEqual(1)
  expect(geometry.portraitRight).toBeLessThan(geometry.summaryLeft)
  expect(geometry.portraitWidth).toBeGreaterThan(170)
  const channels = (geometry.background.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)
  expect(Math.min(...channels)).toBeGreaterThan(150)
})
