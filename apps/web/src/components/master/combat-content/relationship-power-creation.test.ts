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
