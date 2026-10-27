import { expect, it } from 'vitest'
import {
  parseWorkspaceRecovery,
  recoveryKey,
  mergeContentPages,
  loadCompleteContentList,
} from './content-workspace-recovery'

it('scopes refresh recovery to the authenticated account and rejects malformed state', () => {
  expect(recoveryKey('owner')).not.toBe(recoveryKey('other'))
  expect(recoveryKey('')).toBeNull()
  expect(parseWorkspaceRecovery('{bad')).toBeNull()
  expect(parseWorkspaceRecovery(JSON.stringify({ schema: 1, edits: [] }))).toBeNull()
})

it('recovers pending definitions with the original revision and keeps view state separate from commit', () => {
  const saved = {
    schema: 1,
    category: 'discipline',
    selectedKey: 'aetherist',
    tab: 'Skills',
    search: 'aeth',
    sort: 'name-desc',
    listScroll: 120,
    editorScroll: 44,
    edits: { aetherist: { revision: 4, definition: { id: 'aetherist', name: 'Local name' } } },
    newDefinition: null,
  }
  const restored = parseWorkspaceRecovery(JSON.stringify(saved))
  expect(restored).toEqual(saved)
  expect(restored?.edits.aetherist?.revision).toBe(4)
  expect(parseWorkspaceRecovery(JSON.stringify({ ...saved, sort: 'sql' }))).toBeNull()
  expect(
    parseWorkspaceRecovery(
      JSON.stringify({ ...saved, edits: { aetherist: { revision: -1, definition: {} } } }),
    ),
  ).toBeNull()
})

it('loads every bounded page into one unique list and rejects repeated cursors', async () => {
  const pages = [
    {
      records: [
        {
          contentKey: 'a',
          contentKind: 'discipline' as const,
          revision: 1,
          lifecycle: 'active' as const,
        },
      ],
      nextCursor: 'cursor1',
    },
    {
      records: [
        {
          contentKey: 'b',
          contentKind: 'discipline' as const,
          revision: 1,
          lifecycle: 'active' as const,
        },
      ],
      nextCursor: null,
    },
  ]
  let calls = 0
  const result = await loadCompleteContentList(async () => pages[calls++]!)
  expect(result.records.map((r) => r.contentKey)).toEqual(['a', 'b'])
  expect(calls).toBe(2)
  expect(mergeContentPages(pages[0]!, pages[0]!).records).toHaveLength(1)
  await expect(loadCompleteContentList(async () => pages[0]!)).rejects.toThrow('cursor')
})

it('commits only the selected skill mastery while retaining unrelated pending discipline edits', async () => {
  const { disciplineMasteryCommit } = await import('./content-workspace-recovery')
  const base = {
    id: 'bastion',
    name: 'Saved name',
    linkedSkills: ['bastion.guard', 'bastion.wall'],
    skillStages: [
      { skillId: 'bastion.guard', minimumStage: 1 },
      { skillId: 'bastion.wall', minimumStage: 1 },
    ],
  }
  const local = {
    ...base,
    name: 'Uncommitted name',
    skillStages: [
      { skillId: 'bastion.guard', minimumStage: 3 },
      { skillId: 'bastion.wall', minimumStage: 4 },
    ],
  }
  expect(disciplineMasteryCommit(base, local, 'bastion.guard')).toEqual({
    ...base,
    skillStages: [
      { skillId: 'bastion.guard', minimumStage: 3 },
      { skillId: 'bastion.wall', minimumStage: 1 },
    ],
  })
  expect(disciplineMasteryCommit(base, base, 'bastion.guard')).toBeNull()
  expect(local.name).toBe('Uncommitted name')
})

it('keeps newer creation edits while adopting server-assigned Essence identities', async () => {
  const { adoptCreatedContentIdentity } = await import('./content-workspace-recovery')
  const local = {
    id: 'draft.essence',
    essenceId: 'draft.essence',
    name: 'Newer edit',
    skill: { id: 'draft.essence', name: 'Newer skill text' },
  }
  expect(adoptCreatedContentIdentity(local, 'essence.saved', 'essence')).toEqual({
    id: 'essence.saved',
    essenceId: 'essence.saved',
    name: 'Newer edit',
    skill: { id: 'essence.saved', name: 'Newer skill text' },
  })
  expect(local.id).toBe('draft.essence')
})

it('replays the first creation payload after a lost response while retaining later edits separately', async () => {
  const { freezeCreationAttempt } = await import('./content-workspace-recovery')
  const first = { id: 'draft.sample', name: 'First submitted' }
  const attempt = freezeCreationAttempt(
    null,
    '11111111-1111-4111-8111-111111111111',
    'discipline',
    first,
  )
  first.name = 'Edited after response loss'
  const retry = freezeCreationAttempt(attempt, attempt.requestId, 'discipline', first)
  expect(retry.definition.name).toBe('First submitted')
  expect(first.name).toBe('Edited after response loss')
  expect(retry.requestId).toBe(attempt.requestId)
})

it('does not mark a confirmed commit dirty solely because the server advanced its own version', async () => {
  const { recordIsDirty } = await import('./content-record-workflow')
  const current = {
    id: 'essence.sample',
    essenceId: 'essence.sample',
    contentVersion: 3,
    name: 'Saved',
    skill: {
      id: 'essence.sample',
      contentVersion: 3,
      effects: [{ source: { id: 'tag', contentVersion: 2 } }],
    },
  }
  const record = {
    current: { definition: current },
    draft: null,
  } as unknown as import('@aurevane/db/combat-content').CompleteCombatContentRecord
  expect(
    recordIsDirty(record, {
      ...current,
      contentVersion: 2,
      skill: { ...current.skill, contentVersion: 2 },
    }),
  ).toBe(false)
  expect(
    recordIsDirty(record, {
      ...current,
      skill: { ...current.skill, effects: [{ source: { id: 'tag', contentVersion: 1 } }] },
    }),
  ).toBe(true)
})

it('lists exact-source Skill candidates without assigning them or including unrelated sources', async () => {
  const { disciplineSkillCandidates } = await import('./content-workspace-recovery')
  const parent = {
    id: 'bastion',
    linkedSkills: ['retained.link'],
    skillStages: [{ skillId: 'retained.stage', minimumStage: 2 }],
  }
  expect(
    disciplineSkillCandidates(
      parent,
      [
        { contentKey: 'new.skill', contentKind: 'skill', sourceDisciplineId: 'bastion' },
        { contentKey: 'new.skill', contentKind: 'skill', sourceDisciplineId: 'bastion' },
        { contentKey: 'other.skill', contentKind: 'skill', sourceDisciplineId: 'warden' },
        { contentKey: 'unknown.skill', contentKind: 'skill' },
        { contentKey: 'bastion.essence', contentKind: 'essence', sourceDisciplineId: 'bastion' },
      ],
      ['retained.link', 'retained.graph'],
    ),
  ).toEqual(['retained.link', 'retained.stage', 'retained.graph', 'new.skill'])
  expect(parent.linkedSkills).toEqual(['retained.link'])
  expect(parent.skillStages).toEqual([{ skillId: 'retained.stage', minimumStage: 2 }])
})

it('explicit Skill inclusion and removal update only its link and mastery while retaining other local edits', async () => {
  const { withDisciplineSkill, disciplineSkillIsAvailable } =
    await import('./content-workspace-recovery')
  const parent = {
    id: 'bastion',
    description: 'Unrelated local prose',
    linkedSkills: ['old.skill'],
    skillStages: [{ skillId: 'old.skill', minimumStage: 4 }],
  }
  expect(disciplineSkillIsAvailable(parent, 'new.skill')).toBe(false)
  const included = withDisciplineSkill(parent, 'new.skill', true, 3)
  expect(included).toEqual({
    ...parent,
    linkedSkills: ['old.skill', 'new.skill'],
    skillStages: [...parent.skillStages, { skillId: 'new.skill', minimumStage: 3 }],
  })
  expect(disciplineSkillIsAvailable(included, 'new.skill')).toBe(true)
  expect(withDisciplineSkill(included, 'new.skill', false)).toEqual(parent)
  expect(parent.linkedSkills).toEqual(['old.skill'])
})

it('popup association commits publish only the selected Skill inclusion or removal', async () => {
  const { disciplineMasteryCommit, withDisciplineSkill } =
    await import('./content-workspace-recovery')
  const base = {
    id: 'bastion',
    name: 'Saved parent',
    linkedSkills: ['old.skill'],
    skillStages: [{ skillId: 'old.skill', minimumStage: 1 }],
  }
  const local = {
    ...base,
    name: 'Uncommitted parent',
    skillStages: [{ skillId: 'old.skill', minimumStage: 4 }],
  }
  const included = withDisciplineSkill(local, 'new.skill', true, 3)
  const published = disciplineMasteryCommit(base, included, 'new.skill')
  expect(published).toEqual({
    ...base,
    linkedSkills: ['old.skill', 'new.skill'],
    skillStages: [...base.skillStages, { skillId: 'new.skill', minimumStage: 3 }],
  })
  expect(
    disciplineMasteryCommit(
      published!,
      withDisciplineSkill(included, 'new.skill', false),
      'new.skill',
    ),
  ).toEqual(base)
  expect(disciplineMasteryCommit(base, local, 'new.skill')).toBeNull()
  expect(included.name).toBe('Uncommitted parent')
})

it('keeps a parent commit held across nested child and parent saves with idempotent cleanup', async () => {
  const { holdContentCommit } = await import('./content-workspace-recovery')
  const held = new Map<string, number>()
  const finishModal = holdContentCommit(held, 'bastion')
  const finishParentWrite = holdContentCommit(held, 'bastion')
  const finishOther = holdContentCommit(held, 'warden')
  expect(held.get('bastion')).toBe(2)
  finishParentWrite()
  expect(held.get('bastion')).toBe(1)
  finishParentWrite()
  expect(held.get('bastion')).toBe(1)
  finishModal()
  expect(held.has('bastion')).toBe(false)
  expect(held.get('warden')).toBe(1)
  finishOther()
  expect(held.size).toBe(0)
})
