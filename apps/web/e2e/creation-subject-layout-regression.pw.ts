import { expect, test } from '@playwright/test'

import { createVerifiedAccountAndSignIn } from './pv1f-test-helpers'

async function reachDiscipline(page: Parameters<typeof createVerifiedAccountAndSignIn>[0]['page']) {
  const suffix = String(Date.now())
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  await createVerifiedAccountAndSignIn({
    page,
    email: `creation-subject-${Date.now()}-${Math.random()}@example.test`,
    password: 'Disposable-creation-subject-2026!',
  })
  await page.getByRole('link', { name: 'Create Character', exact: true }).click()
  const creation = page.getByTestId('character-creation')
  await creation.getByLabel('Character name', { exact: true }).fill(`Subject ${suffix}`)
  await creation.getByRole('button', { name: 'Choose your discipline', exact: true }).click()
  await expect(creation).toHaveAttribute('data-step', 'discipline')
  return creation
}

test('Discipline follows its own subject reference hierarchy on desktop', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Desktop subject reconciliation only')
  await page.setViewportSize({ width: 1366, height: 768 })
  const creation = await reachDiscipline(page)

  const choices = creation.locator('label:has(input[name="discipline"])')
  const table = creation.locator('fieldset:has(input[name="discipline"]) + div + div')
  const rows = table.locator(':scope > div')

  await expect(page.getByRole('heading', { level: 1, name: 'Choose your first Discipline.' })).toBeVisible()
  await expect(choices).toHaveCount(6)
  await expect(table).toBeVisible()
  await expect(rows).toHaveCount(6)

  const choiceBoxes = await choices.evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect()
      return { x: box.x, y: box.y, width: box.width, height: box.height }
    }),
  )
  expect(choiceBoxes[0].y).toBeCloseTo(choiceBoxes[1].y, 0)
  expect(choiceBoxes[1].y).toBeCloseTo(choiceBoxes[2].y, 0)
  expect(choiceBoxes[3].y).toBeGreaterThan(choiceBoxes[0].y + choiceBoxes[0].height - 2)

  const rowBoxes = await rows.evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect()
      return { width: box.width, height: box.height }
    }),
  )
  expect(rowBoxes.every((box) => box.width > box.height * 5)).toBe(true)

  const surface = await creation.evaluate((node) => {
    const content = node.children[1] as HTMLElement
    return getComputedStyle(content).backgroundColor
  })
  expect(surface).not.toBe('rgba(9, 15, 23, 0.949)')

  const metrics = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - innerWidth,
  }))
  expect(metrics.overflow).toBeLessThanOrEqual(1)
})

test('Discipline keeps all real choices and natural scrolling on phone', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile-chromium', 'Phone subject reconciliation only')
  await page.setViewportSize({ width: 390, height: 844 })
  const creation = await reachDiscipline(page)
  const choices = creation.locator('label:has(input[name="discipline"])')
  const table = creation.locator('fieldset:has(input[name="discipline"]) + div + div')
  const rows = table.locator(':scope > div')

  await expect(choices).toHaveCount(6)
  await expect(rows).toHaveCount(6)
  const lastRow = rows.last()
  await lastRow.scrollIntoViewIfNeeded()
  await expect(lastRow).toBeInViewport({ ratio: 0.8 })

  const metrics = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - innerWidth,
    pageScroll: document.documentElement.scrollHeight - innerHeight,
  }))
  expect(metrics.overflow).toBeLessThanOrEqual(1)
  expect(metrics.pageScroll).toBeGreaterThan(0)
})
