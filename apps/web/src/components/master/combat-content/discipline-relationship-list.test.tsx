import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { AuthoredDiscipline } from '@aurevane/game-core/content/authored-content'
import type { ContentReference } from './content-definition-fields'
import {
  DisciplineRelationshipList,
  relationshipPowerChoices,
  withDisciplineRelationship,
} from './discipline-relationship-list'

const discipline: AuthoredDiscipline = {
  schemaVersion: 1,
  contentVersion: 2,
  id: 'bastion',
  name: 'Bastion',
  description: 'Retain this description.',
  sortOrder: 7,
  enabled: true,
  media: {},
  core: { might: 6, finesse: 5, vitality: 5, agility: 5, intellect: 5, resolve: 5 },
  focus: ['might', 'vitality'],
  enabledForPrimary: true,
  enabledForSecondary: false,
  linkedSkills: ['skill.saved'],
  skillStages: [{ skillId: 'skill.saved', minimumStage: 3 }],
  unlock: { kind: 'always' },
  essenceId: 'essence.old',
  resonanceSelections: [
    { withDisciplineId: 'warden', resonanceId: 'resonance.old' },
    { withDisciplineId: 'retained.partner', resonanceId: 'retained.power' },
  ],
}
const choices: readonly ContentReference[] = [
  { contentKey: 'bastion', name: 'Bastion', contentKind: 'discipline' },
  { contentKey: 'warden', name: 'Warden', contentKind: 'discipline' },
  { contentKey: 'luminary', name: 'Luminary', contentKind: 'discipline' },
  {
    contentKey: 'essence.new',
    name: 'Bastion Essence',
    contentKind: 'essence',
    sourceDisciplineId: 'bastion',
  },
  {
    contentKey: 'essence.other',
    name: 'Other Essence',
    contentKind: 'essence',
    sourceDisciplineId: 'warden',
  },
  {
    contentKey: 'resonance.new',
    name: 'Shared Resolve',
    contentKind: 'resonance',
    disciplinePair: ['warden', 'bastion'],
  },
  {
    contentKey: 'resonance.other',
    name: 'Unrelated Pair',
    contentKind: 'resonance',
    disciplinePair: ['warden', 'luminary'],
  },
  { contentKey: 'resonance.unknown', name: 'Missing Metadata', contentKind: 'resonance' },
]

describe('Discipline power association editing', () => {
  it('offers only owning Essences and the exact partner pair, including reversed pair order', () => {
    expect(
      relationshipPowerChoices(discipline, null, choices).map((row) => row.contentKey),
    ).toEqual(['essence.new'])
    expect(
      relationshipPowerChoices(discipline, 'warden', choices).map((row) => row.contentKey),
    ).toEqual(['resonance.new'])
    expect(relationshipPowerChoices(discipline, 'luminary', choices)).toEqual([])
  })
  it('assigns and removes associations while preserving unrelated authoring settings and retained partners', () => {
    const essence = withDisciplineRelationship(discipline, null, 'essence.new')
    expect(essence).toEqual({ ...discipline, essenceId: 'essence.new' })
    const replaced = withDisciplineRelationship(discipline, 'warden', 'resonance.new')
    expect(replaced).toEqual({
      ...discipline,
      resonanceSelections: [
        { withDisciplineId: 'warden', resonanceId: 'resonance.new' },
        discipline.resonanceSelections![1],
      ],
    })
    expect(withDisciplineRelationship(replaced, 'warden', '').resonanceSelections).toEqual([
      discipline.resonanceSelections![1],
    ])
    expect(discipline.resonanceSelections?.[0]?.resonanceId).toBe('resonance.old')
    expect(withDisciplineRelationship(discipline, null, '').essenceId).toBeNull()
  })
  it('supports unassigned new/custom partners without replacing other relationships', () => {
    const next = withDisciplineRelationship(discipline, 'luminary', 'resonance.custom')
    expect(next.resonanceSelections).toEqual([
      ...discipline.resonanceSelections!,
      { withDisciplineId: 'luminary', resonanceId: 'resonance.custom' },
    ])
    expect(next.skillStages).toBe(discipline.skillStages)
    expect(next.unlock).toBe(discipline.unlock)
  })
  it('clears only the override orphaned by removing its chosen association', () => {
    const overridden = { ...discipline, relationshipOverride: { withDisciplineId: 'warden' } }
    expect(withDisciplineRelationship(overridden, 'warden', '').relationshipOverride).toBeNull()
    expect(withDisciplineRelationship(overridden, null, '').relationshipOverride).toEqual({
      withDisciplineId: 'warden',
    })
    expect(
      withDisciplineRelationship(
        { ...discipline, relationshipOverride: { withDisciplineId: null } },
        null,
        '',
      ).relationshipOverride,
    ).toBeNull()
  })
  it('renders named rows for every known partner and keeps unknown retained relationships visible', () => {
    const onChange = vi.fn(),
      onEdit = vi.fn()
    const html = renderToStaticMarkup(
      <DisciplineRelationshipList
        value={discipline}
        choices={choices}
        onChange={onChange}
        onEdit={onEdit}
      />,
    )
    for (const label of [
      'None (Essence)',
      'Warden',
      'Luminary',
      'Retained Discipline 1',
      'Retained power',
      'Choose power for Luminary',
      'Change power for Warden',
    ])
      expect(html).toContain(label)
    expect(html).not.toContain('retained.partner')
    expect(html).not.toContain('Find')
    expect(onChange).not.toHaveBeenCalled()
    expect(onEdit).not.toHaveBeenCalled()
  })
})
