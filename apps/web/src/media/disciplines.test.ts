import { FOUNDATION_DISCIPLINES } from '@aurevane/game-core/character/foundation-disciplines'
import { describe, expect, it } from 'vitest'

import { getFoundationDisciplineImageAsset } from './disciplines'

describe('Foundation Discipline media', () => {
  it('maps every Foundation Discipline to its traced production art request', () => {
    for (const discipline of FOUNDATION_DISCIPLINES) {
      expect(getFoundationDisciplineImageAsset(discipline.id)).toMatchObject({
        kind: 'icon',
        status: 'approved',
        requestId: discipline.id === 'ironfist' ? 'ART-DISC-002' : 'ART-DISC-001',
        decorative: true,
      })
    }
  })

  it('keeps unknown Discipline ids on the vector fallback path', () => {
    expect(getFoundationDisciplineImageAsset('unknown')).toBeNull()
  })
})
