import { readFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'
import { InMemoryCombatContentRepository } from '@aurevane/db/combat-content'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { parseAbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { createCombatContentResolver } from '@/server/combat/combat-content-resolver'
import { createCombatContentAuthoringService } from './combat-content-authoring-service'
import { handleCombatContentAuthoringRequest } from './combat-content-authoring-handler'
import { previewActionSelection } from '@/components/master/combat-content/ability-preview-selector'

vi.mock('server-only', () => ({}))
const records = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json',
      import.meta.url,
    ),
    'utf8',
  ),
).records
const owner = '11111111-1111-4111-8111-111111111111'
class LocalStore extends InMemoryCombatContentRepository {
  async getOperatorRole(id: string) {
    return id === owner ? ('owner' as const) : null
  }
}
function fixture() {
  const store = new LocalStore()
  const resolver = createCombatContentResolver({
    findCurrentSkill: (id) => store.findPublished(id, 'skill'),
    findSkillVersion: async () => null,
    findCurrentContent: (id, kind) => store.findPublished(id, kind),
    findContentVersion: async () => null,
  })
  const service = createCombatContentAuthoringService({ store, resolver })
  return {
    service,
    store,
    request(body: Record<string, unknown>, userId = owner) {
      return handleCombatContentAuthoringRequest(
        new Request('https://aurevane.test/api/master/combat-content', {
          method: 'POST',
          body: JSON.stringify({ operation: 'preview', ...body }),
        }),
        { getActor: async () => ({ userId }), createService: () => service },
      )
    },
  }
}
const cases = [
  ['farstrider.keen-focus', 'farstrider.aimed-shot'],
  ['edgedancer.riposte', 'unarmed.basic'],
  ['runeblade.rune-burst', 'runeblade.arc-edge'],
  ['resonance.aetherist-farstrider.arcane-hunt', 'farstrider.aimed-shot'],
]
it.each(cases)('prepares real modifier %s with native reference %s', async (id, rootId) => {
  const row = records.find((r: { id: string }) => r.id === id)
  const definition = row.after
  const behaviorId = definition.ability.behaviors[0].id
  expect(previewActionSelection(definition, behaviorId)).toMatchObject({
    available: true,
    behaviorId,
  })
  const api = fixture()
  const before = JSON.stringify(definition)
  await api.service.previewSkillDefinition({
    actorUserId: owner,
    contentKind: row.kind,
    definition,
    behaviorId,
    previewRootSkillId: rootId,
  })
  const response = await api.request({
    contentKind: row.kind,
    definition,
    behaviorId,
    previewRootSkillId: rootId,
  })
  expect(response.status, JSON.stringify(await response.clone().json())).toBe(200)
  const { preview } = await response.json()
  expect(preview).toMatchObject({
    actionId: id,
    behaviorId,
    referenceAction: { id: rootId },
    simulation: { rngConsumed: false },
  })
  expect(preview.referenceAction.contentVersion).toBeGreaterThan(0)
  expect(preview.modifier.activation).toBe('manual')
  expect(preview.modifier.mode).toBe('modifier')
  if (id === 'edgedancer.riposte') {
    expect(preview.legal).toBe(false)
    expect(preview.issues[0].code).toBe('modifier-requirement-not-met')
    expect(preview.costs).toBeUndefined()
  } else {
    expect(preview.legal).toBe(true)
    expect(preview.costs.actionEconomy).toBeGreaterThanOrEqual(10)
  }
  expect(JSON.stringify(preview)).not.toMatch(
    /sourceInstanceId|capturedAbilitySources|effectOrigins|chanceBasisPoints|sourceDisciplineId/,
  )
  expect(JSON.stringify(definition)).toBe(before)
  expect(
    await (
      await api.request({
        contentKind: row.kind,
        definition,
        behaviorId,
        previewRootSkillId: rootId,
      })
    ).json(),
  ).toEqual({ preview })
})
it('rejects an unknown root and does not silently fall back to Basic Attack', async () => {
  const definition = records.find((r: { id: string }) => r.id === 'farstrider.keen-focus').after
  const response = await fixture().request({
    definition,
    behaviorId: 'keen-focus',
    previewRootSkillId: 'unknown.root',
  })
  expect(response.status).toBe(400)
  expect((await response.json()).error.message).toMatch(/reference/i)
})
it('rejects malformed root selection at the authenticated boundary', async () => {
  const definition = records.find((r: { id: string }) => r.id === 'farstrider.keen-focus').after
  expect(
    (await fixture().request({ definition, previewRootSkillId: { id: 'unarmed.basic' } })).status,
  ).toBe(400)
  expect(
    (await fixture().request({ definition, previewRootSkillId: 'unarmed.basic' }, 'outsider'))
      .status,
  ).toBe(403)
})

it.each(['pve', 'pvp'] as const)(
  'quotes aggregate costs and actual amplified damage in %s using the native reference adapter',
  async (combatContext) => {
    const api = fixture()
    const definition = records.find((r: { id: string }) => r.id === 'farstrider.keen-focus').after
    const root = resolveMatureSkillVersion('farstrider.aimed-shot')!
    const baseline = await (await api.request({ definition: root, combatContext })).json()
    const response = await api.request({
      definition,
      behaviorId: 'keen-focus',
      previewRootSkillId: root.id,
      combatContext,
    })
    const { preview } = await response.json()
    expect(preview.legal).toBe(true)
    expect(preview.costs.actionEconomy).toBe(baseline.preview.costs.actionEconomy + 10)
    expect(preview.costs.mp).toBe(baseline.preview.costs.mp + 3)
    const damage = (result: typeof preview) =>
      result.projections.effects
        .filter((e: { effectType: string }) => e.effectType === 'damage')
        .reduce(
          (sum: number, e: { before: number; after: number }) =>
            sum + Number(e.before) - Number(e.after),
          0,
        )
    expect(damage(preview)).toBeGreaterThan(damage(baseline.preview))
  },
)
it('uses the current published canonical root version and an explicit root group', async () => {
  const api = fixture()
  const root = records.find((r: { id: string }) => r.id === 'farstrider.aimed-shot').after
  await api.store.publish({
    contentKey: root.id,
    contentKind: 'skill',
    definition: root,
    expectedBaseVersion: null,
    versionFloor: root.contentVersion - 1,
    actorUserId: owner,
  })
  const definition = records.find((r: { id: string }) => r.id === 'farstrider.keen-focus').after
  const response = await api.request({
    definition,
    behaviorId: 'keen-focus',
    previewRootSkillId: root.id,
    previewRootBehaviorId: 'aimed-shot',
  })
  expect(response.status).toBe(200)
  const { preview } = await response.json()
  expect(preview.referenceAction).toEqual({
    id: root.id,
    contentVersion: root.contentVersion,
    behaviorId: 'aimed-shot',
  })
  expect(preview.legal).toBe(true)
  expect(preview.costs).toMatchObject({
    actionEconomy: root.ability.behaviors[0].costs[0].amount + 10,
    mp:
      (root.ability.behaviors[0].costs.find((c: { resource: string }) => c.resource === 'mp')
        ?.amount ?? 0) + 3,
  })
  const bad = await api.request({
    definition,
    behaviorId: 'keen-focus',
    previewRootSkillId: root.id,
    previewRootBehaviorId: 'unknown',
  })
  expect(bad.status).toBe(400)
})
it('does not satisfy a modifier Discipline qualifier from its own source or chosen target', async () => {
  const definition = records.find((r: { id: string }) => r.id === 'farstrider.keen-focus').after
  const { preview } = await (
    await fixture().request({ definition, behaviorId: 'keen-focus' })
  ).json()
  expect(preview).toMatchObject({
    legal: false,
    referenceAction: { id: 'unarmed.basic' },
    issues: [{ code: 'modifier-requirement-not-met' }],
  })
  expect(preview.costs).toBeUndefined()
  expect(preview.projections.effects).toEqual([])
})
it('rejects ambiguous current canonical root groups until an exact group is chosen', async () => {
  const api = fixture()
  const first = records.find((r: { id: string }) => r.id === 'farstrider.aimed-shot').after
  const group = first.ability.behaviors[0]
  const root = {
    ...first,
    ability: parseAbilityDefinition({
      schemaVersion: 1,
      behaviors: [group, { ...group, id: 'other-shot' }],
    }),
  }
  await api.store.publish({
    contentKey: root.id,
    contentKind: 'skill',
    definition: root,
    expectedBaseVersion: null,
    versionFloor: root.contentVersion - 1,
    actorUserId: owner,
  })
  const definition = records.find((r: { id: string }) => r.id === 'farstrider.keen-focus').after
  expect(
    (await api.request({ definition, behaviorId: 'keen-focus', previewRootSkillId: root.id }))
      .status,
  ).toBe(400)
  const response = await api.request({
    definition,
    behaviorId: 'keen-focus',
    previewRootSkillId: root.id,
    previewRootBehaviorId: 'other-shot',
  })
  expect(response.status).toBe(200)
  expect((await response.json()).preview.referenceAction.behaviorId).toBe('other-shot')
})
it('rejects a disabled current root instead of substituting a built-in version', async () => {
  const api = fixture()
  const root = {
    ...records.find((r: { id: string }) => r.id === 'farstrider.aimed-shot').after,
    enabled: false,
  }
  await api.store.publish({
    contentKey: root.id,
    contentKind: 'skill',
    definition: root,
    expectedBaseVersion: null,
    versionFloor: root.contentVersion - 1,
    actorUserId: owner,
  })
  const definition = records.find((r: { id: string }) => r.id === 'farstrider.keen-focus').after
  const response = await api.request({
    definition,
    behaviorId: 'keen-focus',
    previewRootSkillId: root.id,
  })
  expect(response.status).toBe(400)
})

it('does not quote an incompatible Recovery root as a standalone modifier cast', async () => {
  const definition = records.find((r: { id: string }) => r.id === 'farstrider.keen-focus').after
  const response = await fixture().request({
    definition,
    behaviorId: 'keen-focus',
    previewRootSkillId: 'basic.recover',
  })
  expect(response.status).toBe(200)
  const { preview } = await response.json()
  expect(preview).toMatchObject({
    legal: false,
    issues: [{ code: 'modifier-root-incompatible' }],
    referenceAction: { id: 'basic.recover' },
  })
  expect(preview.costs).toBeUndefined()
  expect(preview.projections.effects).toEqual([])
})
it('quotes the actual Basic Attack adapter when an edited modifier has satisfied Requirements', async () => {
  const original = records.find((r: { id: string }) => r.id === 'edgedancer.riposte').after
  const definition = {
    ...original,
    ability: parseAbilityDefinition({
      schemaVersion: 1,
      behaviors: original.ability.behaviors.map((b: Record<string, unknown>) => ({
        ...b,
        requirements: null,
      })),
    }),
  }
  const response = await fixture().request({ definition, behaviorId: 'riposte' })
  expect(response.status).toBe(200)
  const { preview } = await response.json()
  expect(preview).toMatchObject({
    legal: true,
    costs: { actionEconomy: 40, mp: 3 },
    referenceAction: { id: 'unarmed.basic' },
  })
  expect(
    preview.projections.effects.some((e: { effectType: string }) => e.effectType === 'damage'),
  ).toBe(true)
})
it('rejects disabled modifier drafts without enabling a source in the fixture', async () => {
  const definition = {
    ...records.find((r: { id: string }) => r.id === 'farstrider.keen-focus').after,
    enabled: false,
  }
  expect((await fixture().request({ definition, behaviorId: 'keen-focus' })).status).toBe(400)
})

it.each(['pve', 'pvp'] as const)(
  'quotes the exact selected modifier bundle with a current Controlled reference in %s',
  async (combatContext) => {
    const api = fixture()
    const root = records.find((r: { id: string }) => r.id === 'farstrider.longshot').after
    await api.store.publish({
      contentKey: root.id,
      contentKind: 'skill',
      definition: root,
      expectedBaseVersion: null,
      versionFloor: root.contentVersion - 1,
      actorUserId: owner,
    })
    const definition = records.find((r: { id: string }) => r.id === 'farstrider.keen-focus').after
    const response = await api.request({
      definition,
      behaviorId: 'keen-focus',
      previewRootSkillId: root.id,
      previewRootBehaviorId: 'longshot',
      combatContext,
    })
    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200)
    const { preview } = await response.json()
    expect(preview).toMatchObject({
      legal: true,
      behaviorId: 'keen-focus',
      referenceAction: { id: root.id, contentVersion: root.contentVersion, behaviorId: 'longshot' },
      simulation: { preparation: 'free-controlled-prime', rngConsumed: false },
      costs: { actionEconomy: 70, mp: 6, hp: 0 },
    })
    expect(
      preview.projections.effects.some(
        (e: { effectType: string; before: number; after: number }) =>
          e.effectType === 'damage' && Number(e.before) > Number(e.after),
      ),
    ).toBe(true)
    expect(JSON.stringify(preview)).not.toMatch(
      /sourceInstanceId|manualModifiers|capturedAbilitySources|effectOrigins|chanceBasisPoints/,
    )
  },
)
