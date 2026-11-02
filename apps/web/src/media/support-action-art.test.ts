import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { battleSkillArtwork } from '../components/battle/battle-skill-presentation'
import { resolveSkillIconHook } from './skill-media-hooks'
import { getImageAsset } from './registry'
import { contentArtworkDefault } from './content-artwork-defaults'
import { SUPPORT_ACTION_ART, VESPER_PORTRAIT_ART } from './support-action-art'

it('resolves each support action and its authored media hook to committed original artwork', () => {
  for (const row of SUPPORT_ACTION_ART) {
    expect(battleSkillArtwork(row.actionId, row.id)).toBe(row.src)
    expect(resolveSkillIconHook(row.id)?.previewSrc).toBe(row.src)
    expect(getImageAsset(row.id).src).toBe(row.src)
    expect(contentArtworkDefault(row.actionId).iconKey).toBe(row.id)
  }
  for (const row of [...SUPPORT_ACTION_ART, VESPER_PORTRAIT_ART]) {
    const bytes = readFileSync(fileURLToPath(new URL(`../../public${row.src}`, import.meta.url)))
    expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF')
    expect(bytes.length).toBeGreaterThan(3000)
  }
})
