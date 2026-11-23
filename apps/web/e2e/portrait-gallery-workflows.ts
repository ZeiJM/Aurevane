import { expect, type Page } from '@playwright/test'

export async function expectPortraitGalleryLayout(page: Page) {
  const metrics = await page
    .getByRole('dialog', { name: 'Default portrait', exact: true })
    .evaluate((dialog) => {
      const gallery = dialog.querySelector('fieldset')!
      const footer = dialog.querySelector('footer')!
      const rect = (element: Element) => element.getBoundingClientRect().toJSON()
      return {
        dialog: rect(dialog),
        gallery: rect(gallery),
        footer: rect(footer),
        viewport: { width: innerWidth, height: innerHeight },
        overflow: dialog.scrollWidth - dialog.clientWidth,
        cards: [...gallery.querySelectorAll('label')].map((card) => ({
          card: rect(card),
          image: rect(card.querySelector('img')!),
          radio: rect(card.querySelector('input')!),
          name: rect(card.querySelector('span')!),
        })),
      }
    })
  expect(metrics.dialog.left).toBeGreaterThanOrEqual(0)
  expect(metrics.dialog.top).toBeGreaterThanOrEqual(0)
  expect(metrics.dialog.right).toBeLessThanOrEqual(metrics.viewport.width + 1)
  expect(metrics.dialog.bottom).toBeLessThanOrEqual(metrics.viewport.height + 1)
  expect(metrics.overflow).toBeLessThanOrEqual(1)
  expect(metrics.gallery.height).toBeGreaterThan(40)
  expect(metrics.gallery.bottom).toBeLessThanOrEqual(metrics.footer.top + 1)
  expect(metrics.footer.bottom).toBeLessThanOrEqual(metrics.dialog.bottom)
  for (const { card, image, radio, name } of metrics.cards) {
    expect(image.width).toBeGreaterThan(50)
    expect(Math.abs(image.height - image.width), 'every portrait stays square').toBeLessThanOrEqual(
      1,
    )
    expect(radio.width, 'native radio cannot stretch to card width').toBeLessThanOrEqual(24)
    expect(radio.height, 'native radio cannot stretch to row height').toBeLessThanOrEqual(24)
    expect(card.height, 'cards contain compact image and label tracks').toBeLessThan(
      image.height + 120,
    )
    expect(name.top - image.bottom, 'name stays beside its own portrait').toBeLessThan(10)
  }
  const confirm = page
    .getByRole('dialog', { name: 'Default portrait', exact: true })
    .getByRole('button', { name: 'Confirm Default Portrait', exact: true })
  await expect(confirm).toBeInViewport({ ratio: 1 })
  return metrics
}
