import { expect, it, vi } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import type { FinalizedContentImage } from '@aurevane/game-core/combat/content-media'
import { createCombatContentResolver } from '@/server/combat/combat-content-resolver'
import { resolveCurrentSupportActionArtwork } from './current-support-action-artwork'

vi.mock('server-only', () => ({}))

it('prefers finalized published Invocation artwork while keeping native Support icons and definitions intact', async () => {
  const artwork: FinalizedContentImage = {
    id: '00000000-0000-4000-8000-000000000099',
    kind: 'image',
    checksum: 'a'.repeat(64),
    byteLength: 1024,
    contentType: 'image/png',
    width: 128,
    height: 128,
    sourceWidth: 128,
    sourceHeight: 128,
    crop: { x: 0, y: 0, size: 128 },
  }
  const invocation = {
    ...defaultBasicSkills().find((row) => row.id === 'basic.invocation')!,
    contentVersion: 77,
    media: {
      ...defaultBasicSkills().find((row) => row.id === 'basic.invocation')!.media,
      artwork,
    },
  }
  const before = JSON.stringify(invocation)
  const resolver = createCombatContentResolver({
    async findCurrentSkill(id) {
      return id === invocation.id
        ? {
            id: '00000000-0000-4000-8000-000000000100',
            contentKind: 'skill',
            contentKey: invocation.id,
            contentVersion: 77,
            definition: structuredClone(invocation),
            publishedBy: '00000000-0000-4000-8000-000000000101',
            publishedAt: '2026-11-03T00:00:00.000Z',
          }
        : null
    },
    async findSkillVersion() {
      return null
    },
  })
  const keys = await resolveCurrentSupportActionArtwork(resolver)
  expect(keys['basic.invocation']).toBe('content-media.00000000-0000-4000-8000-000000000099')
  expect(keys['basic.recover']).toBeNull()
  expect(Object.keys(keys)).toHaveLength(6)
  expect(JSON.stringify(keys)).not.toMatch(/checksum|ability|execution|audio/)
  expect(JSON.stringify(invocation)).toBe(before)
})
