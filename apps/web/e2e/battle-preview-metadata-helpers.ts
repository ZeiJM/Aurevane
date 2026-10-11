import { expect, type Locator } from '@playwright/test'

// Historical parameter chips and forecast costs are separate labels. Actual effect
// and terrain outcomes may legitimately describe AP changes inside their text.
const removedMetadataLabel = /^\s*(?:(?:Cost|Range):|\d+ AP(?:\s*\/\s*\d+ MP| left)?\s*$)/
const removedReadyCost = /\bready\s*·\s*\d+ AP\b/i

export async function expectNoSkillPreviewMetadata(preview: Locator) {
  await expect(preview.locator('[data-battle-preview-lane="parameters"]')).toHaveCount(0)
  await expect(
    preview.locator('[data-battle-preview-chip][data-battle-preview-tone="cost"]'),
  ).toHaveCount(0)
  await expect(
    preview.locator('[data-battle-preview-chip]').filter({ hasText: removedMetadataLabel }),
  ).toHaveCount(0)
  await expect(preview).not.toContainText(removedReadyCost)
}
