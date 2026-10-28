import { expect, it } from 'vitest'
import { skillFxGroups, skillFxAudioAssets } from './skill-fx'
import { audioAssetRegistry } from './registry'
it('registers 153 neutral reusable groups and three lazy variants per group', () => {
  expect(skillFxGroups).toHaveLength(153)
  expect(skillFxAudioAssets).toHaveLength(459)
  expect(new Set(skillFxGroups.map((group) => group.key)).size).toBe(153)
  for (const group of skillFxGroups) {
    expect(group.label).not.toMatch(/aetherist|vanguard|ironfist|essence\./i)
    for (const variant of [1, 2, 3])
      expect(audioAssetRegistry.get(`${group.key}-${variant}`)).toMatchObject({
        channel: 'sfx',
        preload: 'none',
        status: 'approved',
      })
  }
})

it('contains no legacy sound-effect runtime entries', () => {
  const sounds = [...audioAssetRegistry.values()].filter(
    (asset) => asset.kind === 'sfx' || asset.kind === 'ui',
  )
  expect(sounds).toHaveLength(459)
  expect(sounds.every((asset) => asset.id.startsWith('audio.skill-fx.v01.'))).toBe(true)
})
