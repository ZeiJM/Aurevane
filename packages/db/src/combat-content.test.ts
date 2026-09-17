import { describe, expect, it } from 'vitest'

import {
  CombatContentConflictError,
  InMemoryCombatContentRepository,
  type CombatContentDefinition,
} from './combat-content'

const ACTOR = '11111111-1111-4111-8111-111111111111'
const OTHER_ACTOR = '22222222-2222-4222-8222-222222222222'

const skillDefinition = (name: string, ap = 2): CombatContentDefinition => ({
  name,
  actionPointCost: ap,
  effects: [{ type: 'damage', amount: 12 }],
})

describe('InMemoryCombatContentRepository', () => {
  it('saves mutable drafts with optimistic draft versions', async () => {
    const repository = new InMemoryCombatContentRepository()

    const first = await repository.saveDraft({
      contentKey: 'tidecaller.water-lance',
      contentKind: 'skill',
      definition: skillDefinition('Water Lance'),
      baseVersion: null,
      expectedDraftVersion: null,
      actorUserId: ACTOR,
    })

    expect(first.draftVersion).toBe(1)
    expect(first.updatedBy).toBe(ACTOR)

    const second = await repository.saveDraft({
      contentKey: first.contentKey,
      contentKind: first.contentKind,
      definition: skillDefinition('Water Lance', 3),
      baseVersion: null,
      expectedDraftVersion: first.draftVersion,
      actorUserId: OTHER_ACTOR,
    })

    expect(second.draftVersion).toBe(2)
    expect(second.updatedBy).toBe(OTHER_ACTOR)
    expect((await repository.findDraft(first.contentKey))?.definition).toEqual(
      skillDefinition('Water Lance', 3),
    )
  })

  it('rejects a stale draft save', async () => {
    const repository = new InMemoryCombatContentRepository()

    await repository.saveDraft({
      contentKey: 'tidecaller.water-lance',
      contentKind: 'skill',
      definition: skillDefinition('Water Lance'),
      baseVersion: null,
      expectedDraftVersion: null,
      actorUserId: ACTOR,
    })

    await expect(
      repository.saveDraft({
        contentKey: 'tidecaller.water-lance',
        contentKind: 'skill',
        definition: skillDefinition('Water Lance', 4),
        baseVersion: null,
        expectedDraftVersion: 0,
        actorUserId: ACTOR,
      }),
    ).rejects.toBeInstanceOf(CombatContentConflictError)
  })

  it('publishes immutable monotonic versions and advances the current pointer', async () => {
    const repository = new InMemoryCombatContentRepository()

    const first = await repository.publish({
      contentKey: 'tidecaller.water-lance',
      contentKind: 'skill',
      definition: skillDefinition('Water Lance'),
      expectedBaseVersion: null,
      actorUserId: ACTOR,
    })
    const second = await repository.publish({
      contentKey: first.contentKey,
      contentKind: first.contentKind,
      definition: skillDefinition('Water Lance', 3),
      expectedBaseVersion: first.contentVersion,
      actorUserId: ACTOR,
    })

    expect(first.contentVersion).toBe(1)
    expect(second.contentVersion).toBe(2)
    expect((await repository.findPublished(first.contentKey))?.contentVersion).toBe(2)

    ;(second.definition as { actionPointCost?: number }).actionPointCost = 99

    expect((await repository.findPublished(first.contentKey))?.definition).toEqual(
      skillDefinition('Water Lance', 3),
    )
  })

  it('rolls the current pointer back without deleting immutable history', async () => {
    const repository = new InMemoryCombatContentRepository()

    await repository.publish({
      contentKey: 'tidecaller.water-lance',
      contentKind: 'skill',
      definition: skillDefinition('Water Lance'),
      expectedBaseVersion: null,
      actorUserId: ACTOR,
    })
    await repository.publish({
      contentKey: 'tidecaller.water-lance',
      contentKind: 'skill',
      definition: skillDefinition('Water Lance', 3),
      expectedBaseVersion: 1,
      actorUserId: ACTOR,
    })

    await repository.setCurrentPublication('tidecaller.water-lance', 1, OTHER_ACTOR)

    expect((await repository.findPublished('tidecaller.water-lance'))?.contentVersion).toBe(1)
    expect(
      (await repository.listPublishedVersions('tidecaller.water-lance')).map(
        (version) => version.contentVersion,
      ),
    ).toEqual([1, 2])
  })

  it('rejects publishing from a stale base version', async () => {
    const repository = new InMemoryCombatContentRepository()

    await repository.publish({
      contentKey: 'tidecaller.water-lance',
      contentKind: 'skill',
      definition: skillDefinition('Water Lance'),
      expectedBaseVersion: null,
      actorUserId: ACTOR,
    })

    await expect(
      repository.publish({
        contentKey: 'tidecaller.water-lance',
        contentKind: 'skill',
        definition: skillDefinition('Water Lance', 3),
        expectedBaseVersion: null,
        actorUserId: ACTOR,
      }),
    ).rejects.toBeInstanceOf(CombatContentConflictError)
  })
})
