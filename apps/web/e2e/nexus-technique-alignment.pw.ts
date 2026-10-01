import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test, type Page, type TestInfo } from '@playwright/test'

import { previewDiscipline } from './discipline-library-helpers'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Align ${letters}`
}

test('single-Discipline Nexus aligns its four selected slots and preserves locked modal choices', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'Desktop Chromium proves the one-Discipline Technique alignment.',
  )

  await provisionAccountAndEnterCharacter({
    page,
    email: `nexus-technique-align-${Date.now()}@example.com`,
    password: 'Nexus-technique-align-2026!',
    characterName: uniqueCharacterName(),
  })

  await page.goto('/game/nexus')
  await expect(page.locator('[data-arsenal-workspace]')).toBeVisible()

  const lane = page.locator('[data-nexus-technique-lane="true"]')
  await expect(lane).toHaveCount(1)
  const slots = lane.locator('[data-arsenal-technique-row="true"]')
  await expect(slots).toHaveCount(4)
  const geometry = await slots.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return { y: rect.y, width: rect.width, height: rect.height }
    }),
  )
  expect(
    Math.max(...geometry.map((slot) => slot.y)) - Math.min(...geometry.map((slot) => slot.y)),
  ).toBeLessThanOrEqual(1)
  await expect(page.locator('[data-arsenal-panel="disciplines"]')).toContainText('Locked')
  await assertDesktopOverviewGeometry(page, testInfo, 'pure')

  await page
    .getByTestId('skill-build-panel')
    .getByRole('button', { name: /Manage Techniques/ })
    .click()

  const dialog = page.getByRole('dialog', { name: 'Techniques' })
  await expect(dialog).toBeVisible()

  await assertDesktopTechniqueGeometry(page, testInfo, 'pure')
})

async function assertDesktopOverviewGeometry(page: Page, testInfo: TestInfo, build: string) {
  const workspace = page.locator('[data-arsenal-workspace]')
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1536, height: 614 },
  ]) {
    await page.setViewportSize(viewport)
    await page.evaluate(() => document.fonts.ready)
    await workspace.locator('img').evaluateAll(async (images) => {
      await Promise.all(images.map((image) => (image as HTMLImageElement).decode()))
    })
    const metrics = await workspace.evaluate((element) => {
      const box = (node: Element) => {
        const rect = node.getBoundingClientRect()
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      }
      const style = getComputedStyle(element)
      const token = style.getPropertyValue('--av-cockpit-art-size').trim()
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
      const disciplines = Array.from(
        element.querySelectorAll('[data-arsenal-panel="disciplines"] [data-slot]'),
      ).map((slot) => ({
        slot: slot.getAttribute('data-slot'),
        frame: box(slot.firstElementChild!),
        borderWidth: parseFloat(getComputedStyle(slot.firstElementChild!).borderTopWidth),
        copy: box(slot.querySelector(':scope > div')!),
      }))
      const frames = Array.from(
        element.querySelectorAll(
          '[data-arsenal-media], [data-empty-technique-slot], [data-gameplay-art="attunement"], [data-gameplay-art="power"]',
        ),
      ).map((frame) => {
        const frameStyle = getComputedStyle(frame)
        const image = frame.querySelector('img') as HTMLImageElement | null
        const imageStyle = image ? getComputedStyle(image) : null
        return {
          box: box(frame),
          border: {
            top: parseFloat(frameStyle.borderTopWidth),
            right: parseFloat(frameStyle.borderRightWidth),
            bottom: parseFloat(frameStyle.borderBottomWidth),
            left: parseFloat(frameStyle.borderLeftWidth),
          },
          image:
            image && imageStyle
              ? {
                  src: image.currentSrc,
                  box: box(image),
                  naturalWidth: image.naturalWidth,
                  naturalHeight: image.naturalHeight,
                  objectFit: imageStyle.objectFit,
                  padding: [
                    imageStyle.paddingTop,
                    imageStyle.paddingRight,
                    imageStyle.paddingBottom,
                    imageStyle.paddingLeft,
                  ],
                }
              : null,
        }
      })
      return {
        artSize: token.endsWith('rem') ? parseFloat(token) * rem : parseFloat(token),
        disciplines,
        frames,
      }
    })
    const evidenceName = `nexus-overview-${build}-${viewport.width}x${viewport.height}`
    const output = process.env.LAYOUT_REVIEW_OUTPUT ?? testInfo.outputPath()
    await mkdir(output, { recursive: true })
    await writeFile(path.join(output, `${evidenceName}.json`), JSON.stringify(metrics, null, 2))
    const screenshot = await page.screenshot({
      fullPage: true,
      path: path.join(output, `${evidenceName}.png`),
    })
    await testInfo.attach(`${evidenceName}-metrics`, {
      body: JSON.stringify(metrics, null, 2),
      contentType: 'application/json',
    })
    await testInfo.attach(`${evidenceName}-screenshot`, {
      body: screenshot,
      contentType: 'image/png',
    })
    expect(metrics.disciplines).toHaveLength(2)
    const [primary, secondary] = metrics.disciplines
    expect(primary.slot).toBe('primary')
    expect(secondary.slot).toBe('secondary')
    for (const discipline of metrics.disciplines) expect(discipline.borderWidth).toBeGreaterThan(0)
    expect(Math.abs(primary.frame.x - secondary.frame.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(primary.copy.x - secondary.copy.x)).toBeLessThanOrEqual(1)
    expect(metrics.frames.length).toBeGreaterThanOrEqual(8)
    for (const frame of metrics.frames) {
      expect(Math.abs(frame.box.width - metrics.artSize)).toBeLessThanOrEqual(1)
      expect(Math.abs(frame.box.height - metrics.artSize)).toBeLessThanOrEqual(1)
      for (const border of Object.values(frame.border)) expect(border).toBeGreaterThan(0)
      if (!frame.image) continue
      // Approved source pixels remain intact; this checks CSS size rather than promising 2x assets.
      expect(frame.image.naturalWidth).toBeGreaterThanOrEqual(128)
      expect(frame.image.naturalHeight).toBeGreaterThanOrEqual(128)
      expect(frame.image.box.width).toBeLessThanOrEqual(frame.image.naturalWidth)
      expect(frame.image.box.height).toBeLessThanOrEqual(frame.image.naturalHeight)
      expect(frame.image.objectFit).toBe('contain')
      for (const padding of frame.image.padding) expect(parseFloat(padding)).toBe(0)
      expect(Math.abs(frame.image.box.x - frame.box.x - frame.border.left)).toBeLessThanOrEqual(1)
      expect(Math.abs(frame.image.box.y - frame.box.y - frame.border.top)).toBeLessThanOrEqual(1)
      expect(
        Math.abs(frame.image.box.width - frame.box.width + frame.border.left + frame.border.right),
      ).toBeLessThanOrEqual(1)
      expect(
        Math.abs(
          frame.image.box.height - frame.box.height + frame.border.top + frame.border.bottom,
        ),
      ).toBeLessThanOrEqual(1)
    }
  }
}

async function assertDesktopTechniqueGeometry(page: Page, testInfo: TestInfo, build: string) {
  const dialog = page.getByRole('dialog', { name: 'Techniques' })
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1536, height: 614 },
  ]) {
    await page.setViewportSize(viewport)
    await expect(dialog).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    await dialog.locator('img').evaluateAll(async (images) => {
      await Promise.all(images.map((image) => (image as HTMLImageElement).decode()))
    })
    const previews = []
    const liveCards = dialog.locator('[data-technique-card]:has(input)')
    for (let index = 0; index < (await liveCards.count()); index += 1) {
      await liveCards.nth(index).hover()
      previews.push(
        await dialog.getByTestId('technique-preview').evaluate((element) => {
          const box = (node: Element) => {
            const rect = node.getBoundingClientRect()
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          }
          return {
            name: element.querySelector('strong')?.textContent,
            box: box(element),
            overflow: {
              x: Math.max(0, element.scrollWidth - element.clientWidth),
              y: Math.max(0, element.scrollHeight - element.clientHeight),
            },
            contents: Array.from(element.querySelectorAll('dt, dd, li, img')).map(box),
          }
        }),
      )
    }
    const metrics = await dialog.evaluate((element) => {
      const box = (node: Element) => {
        const rect = node.getBoundingClientRect()
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      }
      const overflow = (node: Element) => ({
        x: Math.max(0, node.scrollWidth - node.clientWidth),
        y: Math.max(0, node.scrollHeight - node.clientHeight),
      })
      const groups = Array.from(element.querySelectorAll('[data-technique-group]')).map(
        (group) => ({
          box: box(group),
          overflow: overflow(group),
          cards: Array.from(group.querySelectorAll('[data-technique-card]')).map((card) => {
            const art = card.querySelector('[data-technique-art]')!
            return {
              box: box(card),
              overflow: overflow(card),
              art: box(art),
              image: art.querySelector('img') ? box(art.querySelector('img')!) : null,
              contents: Array.from(card.querySelectorAll('strong, [data-technique-meta]')).map(box),
            }
          }),
        }),
      )
      const preview = element.querySelector('[data-testid="technique-preview"]')!
      const style = getComputedStyle(element)
      const token = style.getPropertyValue('--av-cockpit-art-size').trim()
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
      return {
        dialog: box(element),
        overflow: overflow(element),
        artSize: token.endsWith('rem') ? parseFloat(token) * rem : parseFloat(token),
        groups,
        images: Array.from(element.querySelectorAll('img')).map((image) => ({
          ...box(image),
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          objectFit: getComputedStyle(image).objectFit,
          src: image.currentSrc,
        })),
        containers: Array.from(
          element.querySelectorAll(
            '[data-technique-workspace], [data-testid="learned-skill-list"], [data-technique-grid]',
          ),
        ).map((node) => ({ box: box(node), overflow: overflow(node) })),
        preview: {
          box: box(preview),
          overflow: overflow(preview),
          contents: Array.from(preview.querySelectorAll('dt, dd, li, img')).map(box),
        },
      }
    })
    const evidenceName = `techniques-${build}-${viewport.width}x${viewport.height}`
    await testInfo.attach(`${evidenceName}-metrics`, {
      body: JSON.stringify({ ...metrics, previews }, null, 2),
      contentType: 'application/json',
    })
    await testInfo.attach(`${evidenceName}-screenshot`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    })
    const contained = (
      inner: { x: number; y: number; width: number; height: number },
      outer: { x: number; y: number; width: number; height: number },
    ) => {
      expect(inner.x).toBeGreaterThanOrEqual(outer.x - 1)
      expect(inner.y).toBeGreaterThanOrEqual(outer.y - 1)
      expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width + 1)
      expect(inner.y + inner.height).toBeLessThanOrEqual(outer.y + outer.height + 1)
    }
    const noOverflow = (overflow: { x: number; y: number }) => {
      expect(overflow.x).toBe(0)
      expect(overflow.y).toBe(0)
    }
    contained(metrics.dialog, { x: 0, y: 0, ...viewport })
    noOverflow(metrics.overflow)
    for (const image of metrics.images) {
      expect(image.naturalWidth).toBeGreaterThanOrEqual(128)
      expect(image.naturalHeight).toBeGreaterThanOrEqual(128)
      expect(image.width).toBeLessThanOrEqual(image.naturalWidth)
      expect(image.height).toBeLessThanOrEqual(image.naturalHeight)
      expect(image.objectFit).toBe('contain')
    }
    expect(metrics.groups).toHaveLength(2)
    expect(Math.abs(metrics.groups[0].box.y - metrics.groups[1].box.y)).toBeLessThanOrEqual(1)
    for (const container of metrics.containers) {
      contained(container.box, metrics.dialog)
      noOverflow(container.overflow)
    }
    for (const group of metrics.groups) {
      contained(group.box, metrics.dialog)
      noOverflow(group.overflow)
      expect(group.cards).toHaveLength(8)
      for (const card of group.cards) {
        contained(card.box, group.box)
        contained(card.art, card.box)
        noOverflow(card.overflow)
        expect(Math.abs(card.art.width - metrics.artSize)).toBeLessThanOrEqual(1)
        expect(Math.abs(card.art.height - metrics.artSize)).toBeLessThanOrEqual(1)
        if (card.image) contained(card.image, card.art)
        for (const content of card.contents) contained(content, card.box)
      }
    }
    contained(metrics.preview.box, metrics.dialog)
    noOverflow(metrics.preview.overflow)
    for (const content of metrics.preview.contents) contained(content, metrics.preview.box)
    for (const preview of previews) {
      noOverflow(preview.overflow)
      for (const content of preview.contents) contained(content, preview.box)
    }
  }
}

test('mixed Techniques shows every primary and secondary card without desktop scrolling', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop geometry proof')
  test.skip(process.env.AUREVANE_PV2_TEST_MODE !== '1', 'Explicit PV-2 preparation required')
  await provisionAccountAndEnterCharacter({
    page,
    email: `nexus-technique-mixed-${Date.now()}@example.com`,
    password: 'Nexus-technique-align-2026!',
    characterName: uniqueCharacterName(),
  })
  const prepared = await page.evaluate(async () => {
    const response = await fetch('/api/character/build/pv2-test-kit', { method: 'POST' })
    return { ok: response.ok, body: await response.json() }
  })
  expect(prepared.ok).toBe(true)
  expect(prepared.body).toMatchObject({ result: { masteredDisciplines: 6, learnedSkills: 16 } })
  await page.goto('/game/nexus')
  await expect(page.locator('[data-arsenal-workspace]')).toBeVisible()
  await page
    .getByTestId('primary-build-panel')
    .getByRole('button', { name: /Manage Disciplines/ })
    .click()
  const disciplineDialog = page.getByRole('dialog', { name: 'Discipline Management' })
  await previewDiscipline(disciplineDialog, 'Secondary', 'Lifebinder')
  await disciplineDialog.getByRole('button', { name: /Confirm Change/ }).click()
  await expect(page.getByRole('status')).toContainText('Discipline changes committed.')
  await disciplineDialog.getByRole('button', { name: 'Close' }).click()
  await assertDesktopOverviewGeometry(page, testInfo, 'mixed')
  await page.getByRole('button', { name: /Manage Techniques/ }).click()
  await expect(page.getByTestId('learned-skill-list').getByRole('checkbox')).toHaveCount(16)
  await assertDesktopTechniqueGeometry(page, testInfo, 'mixed')
})
