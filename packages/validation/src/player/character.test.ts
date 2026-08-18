import { describe, expect, it } from 'vitest'

import {
  parseCharacterCreationPersistenceRow,
  parseCharacterCreationRequest,
  parseCharacterPersistenceRow,
} from './character'

const validIntent = {
  name: 'Arlen Vale',
  presentationId: 'androgynous',
  pronounPresetId: 'they_them',
  portraitRef: 'portrait.starter.wayfarer-01',
  starterAppearanceRef: 'appearance.starter.roadworn',
  attributeBonuses: { might: 1, finesse: 1, intellect: 1, resolve: 1 },
  foundationDisciplineId: 'vanguard',
}

const validRow = {
  id: '00000000-0000-4000-8000-000000000701',
  user_id: '00000000-0000-4000-8000-000000000702',
  slot_index: 0,
  rules_version: 1,
  name: 'Arlen Vale',
  name_key: 'arlenvale',
  presentation_id: 'androgynous',
  pronoun_preset_id: 'they_them',
  portrait_ref: 'portrait.starter.wayfarer-01',
  starter_appearance_ref: 'appearance.starter.roadworn',
  foundation_discipline_id: 'vanguard',
  might: 6,
  finesse: 6,
  intellect: 6,
  resolve: 6,
  level: 1,
  xp: 0,
  progression_cycle: 1,
  created_at: '2026-08-16T15:30:00.000Z',
  cycle_started_at: '2026-08-16T15:30:00.000Z',
  last_active_at: '2026-08-16T15:30:00.000Z',
}

describe('character persistence validation', () => {
  it('accepts the strict versioned creation request with a legal slot intent', () => {
    expect(
      parseCharacterCreationRequest({
        version: 1,
        slotIndex: 0,
        idempotencyKey: '00000000-0000-4000-8000-000000000703',
        intent: validIntent,
      }),
    ).not.toBeNull()
  })

  it('rejects out-of-range slots and client-selected authoritative fields', () => {
    expect(
      parseCharacterCreationRequest({
        version: 1,
        slotIndex: 3,
        idempotencyKey: '00000000-0000-4000-8000-000000000703',
        intent: validIntent,
      }),
    ).toBeNull()

    expect(
      parseCharacterCreationRequest({
        version: 1,
        slotIndex: 0,
        idempotencyKey: '00000000-0000-4000-8000-000000000703',
        intent: { ...validIntent, level: 100 },
      }),
    ).toBeNull()
  })

  it('accepts persisted character rows and the replay marker', () => {
    expect(parseCharacterPersistenceRow(validRow)?.name_key).toBe('arlenvale')
    expect(parseCharacterCreationPersistenceRow({ ...validRow, replayed: true })?.replayed).toBe(
      true,
    )
  })

  it('rejects incomplete persistence rows', () => {
    const incomplete = { ...validRow, name_key: undefined }
    expect(parseCharacterPersistenceRow(incomplete)).toBeNull()
  })
})
