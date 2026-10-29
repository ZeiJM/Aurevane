import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { currentEssenceDefinitions } from '@aurevane/game-core/combat/essence'
import { currentResonanceDefinitions } from '@aurevane/game-core/combat/resonance'
import { combatContentCategory } from '@/server/combat/combat-content-categories'
import {
  createRelationshipPowerDraft,
  disciplineRelationshipCommit,
} from './relationship-power-creation'

it('creates an independently owned Essence whose inner Skill belongs to the same Discipline', () => {
  const source = structuredClone(currentEssenceDefinitions()[0]!)
  const before = structuredClone(source)
  const draft = createRelationshipPowerDraft(
    'essence',
    { ...source },
    'discipline.custom',
    null,
    'essence.custom',
  )
  expect(draft).toMatchObject({
    essenceId: 'essence.custom',
    sourceDisciplineId: 'discipline.custom',
    contentVersion: 1,
    skill: { id: 'essence.custom', sourceDisciplineId: 'discipline.custom', contentVersion: 1 },
  })
  expect(() => combatContentCategory('essence')!.parseAuthoring(draft)).not.toThrow()
  expect(source).toEqual(before)
})
it('creates an exact partner Resonance with trigger sources remapped to the new pair', () => {
  const source = structuredClone(currentResonanceDefinitions()[0]!)
  const before = structuredClone(source)
  const draft = createRelationshipPowerDraft(
    'resonance',
    { ...source },
    'discipline.custom',
    'discipline.partner',
    'resonance.custom',
  )
  expect(draft).toMatchObject({
    id: 'resonance.custom',
    disciplinePair: ['discipline.custom', 'discipline.partner'],
    contentVersion: 1,
  })
  expect(() => combatContentCategory('resonance')!.parseAuthoring(draft)).not.toThrow()
  expect(JSON.stringify(draft.trigger)).not.toContain(
    `"sourceDisciplineId":"${source.disciplinePair[0]}"`,
  )
  expect(source).toEqual(before)
})
it('a popup commit saves only its own selected relationship and keeps other parent edits local', () => {
  const base = {
    id: 'discipline.custom',
    name: 'Saved',
    essenceId: null,
    resonanceSelections: [{ withDisciplineId: 'other', resonanceId: 'resonance.saved' }],
  }
  const local = {
    ...base,
    name: 'Unsaved',
    essenceId: 'essence.new',
    resonanceSelections: [{ withDisciplineId: 'other', resonanceId: 'resonance.changed' }],
  }
  expect(disciplineRelationshipCommit(base, local, 'essence.new', null)).toEqual({
    ...base,
    essenceId: 'essence.new',
  })
  expect(disciplineRelationshipCommit(base, local, 'resonance.changed', 'other')).toEqual({
    ...base,
    resonanceSelections: local.resonanceSelections,
  })
  expect(disciplineRelationshipCommit(base, local, 'unrelated', 'other')).toBeNull()
  expect(local.name).toBe('Unsaved')
})
it('clears only the focused slot and its override when two slots share a power', () => {
  const base = {
    id: 'discipline.custom',
    essenceId: null,
    relationshipOverride: { withDisciplineId: 'first' },
    resonanceSelections: [
      { withDisciplineId: 'first', resonanceId: 'shared' },
      { withDisciplineId: 'second', resonanceId: 'shared' },
    ],
  }
  const local = { ...base, name: 'Unsaved', relationshipOverride: null, resonanceSelections: [] }
  expect(disciplineRelationshipCommit(base, local, 'shared', 'first')).toEqual({
    ...base,
    relationshipOverride: null,
    resonanceSelections: [base.resonanceSelections[1]],
  })
  expect(disciplineRelationshipCommit(base, local, 'shared', 'second')).toEqual({
    ...base,
    resonanceSelections: [base.resonanceSelections[0]],
  })
})

it('creates a valid Resonance when the selected new Discipline sorts after its partner', () => {
  const source = structuredClone(currentResonanceDefinitions()[0]!)
  const draft = createRelationshipPowerDraft(
    'resonance',
    { ...source },
    'discipline.custom',
    'aetherist',
    'resonance.custom',
  )
  expect(draft.disciplinePair).toEqual(['aetherist', 'discipline.custom'])
  expect(() => combatContentCategory('resonance')!.parseAuthoring(draft)).not.toThrow()
})

it.each([null, 'discipline.partner'])(
  'checks changed %s selections against current published ownership without mutating edits',
  async (partner) => {
    const { assertDisciplineRelationshipsReady } = await import('./relationship-power-creation')
    const base = {
      id: 'discipline.custom',
      name: 'Custom',
      essenceId: null,
      resonanceSelections: [],
    }
    const key = partner === null ? 'essence.new' : 'resonance.new'
    const definition =
      partner === null
        ? { essenceId: key, sourceDisciplineId: base.id, enabled: true, name: 'My Essence' }
        : { id: key, disciplinePair: [base.id, partner], enabled: true, name: 'My Resonance' }
    const next = {
      ...base,
      name: 'Recovered name',
      ...(partner === null
        ? { essenceId: key }
        : { resonanceSelections: [{ withDisciplineId: partner, resonanceId: key }] }),
    }
    const snapshot = structuredClone(next)
    const record = {
      contentKey: key,
      contentKind: partner === null ? 'essence' : 'resonance',
      lifecycle: 'active',
      current: { definition },
      draft: { definition: { ...definition, enabled: false } },
    } as unknown as import('@aurevane/db/combat-content').CompleteCombatContentRecord
    const read = vi.fn().mockResolvedValue(record)
    await assertDisciplineRelationshipsReady(base, next, read)
    expect(read).toHaveBeenCalledExactlyOnceWith(key)
    expect(next).toEqual(snapshot)
    read.mockClear()
    await assertDisciplineRelationshipsReady(next, next, read)
    expect(read).not.toHaveBeenCalled()
  },
)

it.each(['missing', 'draft', 'disabled', 'archived', 'wrong-source', 'wrong-kind'])(
  'rejects a %s child with targeted recovery guidance and no implicit publication',
  async (condition) => {
    const { assertDisciplineRelationshipsReady } = await import('./relationship-power-creation')
    const base = { id: 'discipline.custom', essenceId: null }
    const next = { ...base, name: 'Keep identity', essenceId: 'essence.bad' }
    const read = vi.fn().mockResolvedValue(
      condition === 'missing'
        ? null
        : {
            contentKey: 'essence.bad',
            contentKind: condition === 'wrong-kind' ? 'skill' : 'essence',
            lifecycle:
              condition === 'draft' ? 'draft' : condition === 'archived' ? 'archived' : 'active',
            current:
              condition === 'draft'
                ? null
                : {
                    definition: {
                      name: 'My Essence',
                      enabled: condition !== 'disabled',
                      sourceDisciplineId:
                        condition === 'wrong-source' ? 'discipline.other' : base.id,
                    },
                  },
          },
    )
    await expect(assertDisciplineRelationshipsReady(base, next, read)).rejects.toThrow(
      'Change or clear',
    )
    expect(next).toEqual({ ...base, name: 'Keep identity', essenceId: 'essence.bad' })
    expect(read).toHaveBeenCalledExactlyOnceWith('essence.bad')
  },
)
