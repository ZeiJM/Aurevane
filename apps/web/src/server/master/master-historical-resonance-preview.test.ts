import { expect, it, vi } from 'vitest'
import { InMemoryCombatContentRepository } from '@aurevane/db/combat-content'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { resolveResonanceForPair } from '@aurevane/game-core/combat/resonance'
import { createCombatContentResolver } from '@/server/combat/combat-content-resolver'
import { createCombatContentAuthoringService } from './combat-content-authoring-service'
import { handleCombatContentAuthoringRequest } from './combat-content-authoring-handler'

vi.mock('server-only', () => ({}))
const owner = '11111111-1111-4111-8111-111111111111'
class Store extends InMemoryCombatContentRepository {
  async getOperatorRole(id: string) {
    return id === owner ? ('owner' as const) : null
  }
}
function fixture() {
  const store = new Store()
  const resolver = createCombatContentResolver({
    findCurrentSkill: (id) => store.findPublished(id, 'skill'),
    findSkillVersion: async () => null,
    findCurrentContent: (id, kind) => store.findPublished(id, kind),
    findContentVersion: async () => null,
  })
  const service = createCombatContentAuthoringService({ store, resolver })
  return {
    store,
    service,
    request(body: Record<string, unknown>, actorUserId = owner) {
      return handleCombatContentAuthoringRequest(
        new Request('https://aurevane.test/api/master/combat-content', {
          method: 'POST',
          body: JSON.stringify({
            operation: 'preview',
            contentKind: 'resonance',
            seed: 1,
            ...body,
          }),
        }),
        { getActor: async () => ({ userId: actorUserId }), createService: () => service },
      )
    },
  }
}
const sequence = resolveResonanceForPair('lifebinder', 'vanguard', 1)!
const immediate = resolveResonanceForPair('farstrider', 'lifebinder')!
const requestSequence = {
  definition: sequence,
  previewSetupSkillId: 'lifebinder.mending-light',
  previewRootSkillId: 'vanguard.forceful-strike',
}

it.each(['pve', 'pvp'] as const)(
  'samples native sequence and exact version in %s',
  async (combatContext) => {
    const api = fixture()
    const before = JSON.stringify(sequence)
    const response = await api.request({ ...requestSequence, combatContext })
    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200)
    const { preview } = await response.json()
    expect(preview).toMatchObject({
      actionId: sequence.id,
      contentVersion: sequence.contentVersion,
      legal: true,
      historicalSample: { mode: 'sequence', sameTurnOnly: true, activated: true },
      simulation: { localFixtureOnly: true, rngConsumed: true },
    })
    expect(preview.historicalSample.steps).toHaveLength(2)
    expect(preview.historicalSample.steps.map((s: { ran: boolean }) => s.ran)).toEqual([true, true])
    expect(preview.historicalSample.steps[0].resonanceEvents).toContainEqual(
      expect.objectContaining({ event: 'resonance_armed' }),
    )
    expect(preview.historicalSample.steps[1].resonanceEvents).toContainEqual(
      expect.objectContaining({
        event: 'resonance_activated',
        contentVersion: sequence.contentVersion,
      }),
    )
    expect(preview.historicalSample.steps[1].owner.apBefore).toBe(
      preview.historicalSample.steps[0].owner.apAfter,
    )
    expect(preview.historicalSample.steps[1].owner.apAfter).toBeLessThan(
      preview.historicalSample.steps[1].owner.apBefore,
    )
    expect(
      preview.historicalSample.steps[1].combatants.find(
        (r: { id: string }) => r.id === 'master-preview-enemy',
      ).hpAfter,
    ).toBeLessThan(100)
    expect(preview.historicalSample.steps[1].referenceAction).toEqual({
      id: requestSequence.previewRootSkillId,
      contentVersion: resolveMatureSkillVersion(requestSequence.previewRootSkillId)!.contentVersion,
    })
    expect(preview.projections).toEqual({ effects: [], terrain: [], events: [] })
    expect(preview.costs).toBeUndefined()
    expect(JSON.stringify(preview)).not.toMatch(
      /sourceInstanceId|capturedAbilitySources|effectOrigins|chanceBasisPoints|sourceDisciplineId|statBridge/,
    )
    expect(JSON.stringify(sequence)).toBe(before)
    expect(await (await api.request({ ...requestSequence, combatContext })).json()).toEqual({
      preview,
    })
  },
)
it('samples immediate trigger with no artificial setup', async () => {
  const response = await fixture().request({
    definition: immediate,
    previewRootSkillId: 'farstrider.aimed-shot',
  })
  expect(response.status, JSON.stringify(await response.clone().json())).toBe(200)
  const { preview } = await response.json()
  expect(preview.historicalSample).toMatchObject({ mode: 'immediate', activated: true })
  expect(preview.historicalSample.steps).toHaveLength(1)
  expect(
    preview.historicalSample.steps[0].resonanceEvents.map((e: { event: string }) => e.event),
  ).toEqual(['resonance_activated'])
})
it('runs a mismatched trigger honestly and records expiration instead of forcing activation', async () => {
  const response = await fixture().request({
    ...requestSequence,
    previewRootSkillId: 'lifebinder.mending-light',
  })
  expect(response.status, JSON.stringify(await response.clone().json())).toBe(200)
  const { preview } = await response.json()
  expect(preview.historicalSample.activated).toBe(false)
  expect(preview.historicalSample.steps[1].resonanceEvents).toContainEqual(
    expect.objectContaining({ event: 'resonance_expired' }),
  )
})
it.each([
  { previewSetupSkillId: undefined },
  { previewRootSkillId: undefined },
  { previewSetupSkillId: 'unknown.setup' },
  { previewRootSkillId: 'unknown.trigger' },
  { previewSetupSkillId: { id: 'lifebinder.mending-light' } },
  { behaviorId: 'fabricated-group' },
  { previewRootBehaviorId: 'fabricated-root-group' },
  { definition: { ...sequence, enabled: false } },
  { definition: { ...sequence, trigger: {} } },
])('rejects invalid historical request %j', async (overrides) => {
  expect((await fixture().request({ ...requestSequence, ...overrides })).status).toBe(400)
})
it('rejects an extraneous immediate setup', async () => {
  expect(
    (
      await fixture().request({
        definition: immediate,
        previewRootSkillId: 'farstrider.aimed-shot',
        previewSetupSkillId: 'lifebinder.mending-light',
      })
    ).status,
  ).toBe(400)
})
it('requires operator authorization before sample execution', async () => {
  expect((await fixture().request(requestSequence, 'outsider')).status).toBe(403)
})

async function publishRoot(
  api: ReturnType<typeof fixture>,
  id: string,
  edit: (root: Record<string, unknown>) => void,
) {
  const root = structuredClone(resolveMatureSkillVersion(id)!)
  edit(root as unknown as Record<string, unknown>)
  const row = await api.store.publish({
    contentKey: root.id,
    contentKind: 'skill',
    definition: { ...root },
    expectedBaseVersion: null,
    versionFloor: root.contentVersion,
    actorUserId: owner,
  })
  return row
}
it('uses the current published reference and does not replenish AP for the second command', async () => {
  const api = fixture()
  await publishRoot(api, requestSequence.previewSetupSkillId, (root) => {
    root.apCost = 50
  })
  const current = await publishRoot(api, requestSequence.previewRootSkillId, (root) => {
    root.apCost = 60
  })
  const response = await api.request(requestSequence)
  expect(response.status, JSON.stringify(await response.clone().json())).toBe(200)
  const { preview } = await response.json()
  expect(preview.legal).toBe(false)
  expect(preview.historicalSample.steps[0].ran).toBe(true)
  const last = preview.historicalSample.steps[1]
  expect(last.referenceAction.contentVersion).toBe(current.contentVersion)
  expect(last.ran).toBe(false)
  expect(last.issues).toContainEqual(
    expect.objectContaining({ code: 'insufficient-action-economy' }),
  )
  expect(last.owner.apAfter).toBe(last.owner.apBefore)
  expect(last.owner.mpAfter).toBe(last.owner.mpBefore)
  expect(last.resonanceEvents).toEqual([])
  expect(preview.historicalSample.activated).toBe(false)
})
it('rejects a disabled current reference without falling back to a builtin version', async () => {
  const api = fixture()
  await publishRoot(api, requestSequence.previewRootSkillId, (root) => {
    root.enabled = false
  })
  expect((await api.request(requestSequence)).status).toBe(400)
})
it('rejects a canonical current reference without discarding its Ability', async () => {
  const api = fixture()
  const { readFileSync } = await import('node:fs')
  const records = JSON.parse(
    readFileSync(
      new URL(
        '../../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ).records
  await publishRoot(api, requestSequence.previewRootSkillId, (root) => {
    root.ability = records.find((r: { id: string }) => r.id === root.id).after.ability
  })
  const response = await api.request(requestSequence)
  expect(response.status, JSON.stringify(await response.clone().json())).toBe(400)
  expect((await response.json()).error.message).toMatch(/native reference/)
})
it('does not force a hit or activate a hit-dependent native payoff on a miss', async () => {
  const api = fixture()
  const observations = []
  for (let seed = 1; seed <= 20; seed++) {
    const response = await api.request({
      definition: immediate,
      previewRootSkillId: 'farstrider.aimed-shot',
      seed,
    })
    expect(response.status).toBe(200)
    observations.push((await response.json()).preview)
  }
  expect(observations.some((preview) => preview.historicalSample.activated)).toBe(true)
  const misses = observations.filter((preview) => !preview.historicalSample.activated)
  expect(misses.length).toBeGreaterThan(0)
  for (const preview of misses) {
    expect(preview.historicalSample.steps[0].ran).toBe(true)
    expect(preview.historicalSample.steps[0].resonanceEvents).toEqual([])
    const target = preview.historicalSample.steps[0].combatants.find(
      (unit: { id: string }) => unit.id === 'master-preview-enemy',
    )
    expect(target.hpAfter).toBe(target.hpBefore)
  }
})
it('applies the authored native payoff, beyond merely reporting its activation marker', async () => {
  const api = fixture()
  if (immediate.trigger.kind !== 'skill-trigger-v2')
    throw new Error('Expected native v2 immediate fixture')
  const mismatched = {
    ...immediate,
    trigger: {
      ...immediate.trigger,
      trigger: { ...immediate.trigger.trigger, requiredTags: ['healing'] },
    },
  }
  const matchedResponse = await api.request({
    definition: immediate,
    previewRootSkillId: 'farstrider.aimed-shot',
  })
  const controlResponse = await api.request({
    definition: mismatched,
    previewRootSkillId: 'farstrider.aimed-shot',
  })
  expect(matchedResponse.status).toBe(200)
  expect(controlResponse.status, JSON.stringify(await controlResponse.clone().json())).toBe(200)
  const matched = (await matchedResponse.json()).preview.historicalSample
  const control = (await controlResponse.json()).preview.historicalSample
  expect(matched.activated).toBe(true)
  expect(control.activated).toBe(false)
  expect(matched.steps[0].combatants).not.toEqual(control.steps[0].combatants)
  expect(matched.steps[0].owner.apAfter).toBe(control.steps[0].owner.apAfter)
})
it('does not mutate the actual input Skill or Resonance objects', async () => {
  const { previewHistoricalResonanceCombatContentDefinition } =
    await import('./combat-content-preview')
  const trigger = structuredClone(resolveMatureSkillVersion(requestSequence.previewRootSkillId)!)
  const setup = structuredClone(resolveMatureSkillVersion(requestSequence.previewSetupSkillId)!)
  const definition = structuredClone(sequence)
  const before = JSON.stringify({ trigger, setup, definition })
  const result = previewHistoricalResonanceCombatContentDefinition(definition, trigger, {
    setup,
    seed: 1,
  })
  expect(JSON.stringify({ trigger, setup, definition })).toBe(before)
  expect(
    previewHistoricalResonanceCombatContentDefinition(definition, trigger, { setup, seed: 1 }),
  ).toEqual(result)
})
it('preserves the native Ground command selected for Flame Burst', async () => {
  const { previewCombatContentDefinition } = await import('./combat-content-preview')
  const root = resolveMatureSkillVersion('cinderweaver.flame-burst')!
  const native = previewCombatContentDefinition(root, { seed: 1 })
  expect(native.targeting.selection).toEqual({ kind: 'activate', ground: true })
  const response = await fixture().request({ definition: immediate, previewRootSkillId: root.id })
  expect(response.status, JSON.stringify(await response.clone().json())).toBe(200)
  const { preview } = await response.json()
  expect(preview.historicalSample.steps[0].selection).toEqual(native.targeting.selection)
})
it('projects a setup-created Summon removed by a valid same-turn native trigger', async () => {
  const { previewHistoricalResonanceCombatContentDefinition } =
    await import('./combat-content-preview')
  const { validateMatureSkillDefinition } = await import('@aurevane/game-core/combat/mature-skills')
  const setup = structuredClone(resolveMatureSkillVersion('wildwarden.renewing-herbs')!)
  const trigger: import('@aurevane/game-core/combat/mature-skills').MatureSkillDefinition = {
    ...resolveMatureSkillVersion('vanguard.forceful-strike')!,
    target: {
      kind: 'self',
      teamPolicy: 'self',
      shape: { kind: 'circle', radius: 2 },
      minimumRange: 0,
      maximumRange: 0,
      requiresLineOfSight: false,
      maximumElevationDifference: 0,
      friendlyFire: 'all-except-actor',
    },
    effects: Array.from({ length: 4 }, () => ({
      type: 'damage' as const,
      recipient: 'affected-units' as const,
      amount: 20,
      durationTurns: 0,
    })),
  }
  expect(validateMatureSkillDefinition(trigger)).toEqual([])
  const preview = previewHistoricalResonanceCombatContentDefinition(sequence, trigger, {
    setup,
    seed: 1,
  })
  expect(preview.legal).toBe(true)
  expect(preview.historicalSample.steps.map((step) => step.ran)).toEqual([true, true])
  const spawned = preview.historicalSample.steps[0]!.combatants.find(
    (row) => row.presentBefore === false && row.presentAfter === true,
  )!
  expect(spawned).toBeDefined()
  const removed = preview.historicalSample.steps[1]!.combatants.find(
    (row) => row.id === spawned.id,
  )!
  expect(removed).toMatchObject({
    presentBefore: true,
    presentAfter: false,
    hpAfter: null,
    mpAfter: null,
    apAfter: null,
    barrierAfter: null,
  })
  expect(removed.hpBefore).toBeGreaterThan(0)
  expect(preview.historicalSample.steps[1]!.owner.hpAfter).toBe(
    preview.historicalSample.steps[1]!.owner.hpBefore,
  )
})
