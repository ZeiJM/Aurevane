import { readFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'
import { InMemoryCombatContentRepository } from '@aurevane/db/combat-content'
import { createCombatContentResolver } from '@/server/combat/combat-content-resolver'
import { createCombatContentAuthoringService } from './combat-content-authoring-service'
import { handleCombatContentAuthoringRequest } from './combat-content-authoring-handler'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import type { AnyResonanceDefinition } from '@aurevane/game-core/combat/resonance'
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
class Store extends InMemoryCombatContentRepository {
  async getOperatorRole(id: string) {
    return id === owner ? ('owner' as const) : null
  }
}
async function fixture(
  rootId = 'vanguard.forceful-strike',
  editRoot?: (root: MatureSkillDefinition) => void,
) {
  const store = new Store()
  const root = structuredClone(records.find((r: { id: string }) => r.id === rootId).after)
  editRoot?.(root)
  await store.publish({
    contentKey: root.id,
    contentKind: 'skill',
    definition: root,
    expectedBaseVersion: null,
    versionFloor: root.contentVersion - 1,
    actorUserId: owner,
  })
  const resolver = createCombatContentResolver({
    findCurrentSkill: (id) => store.findPublished(id, 'skill'),
    findSkillVersion: async () => null,
    findCurrentContent: (id, kind) => store.findPublished(id, kind),
    findContentVersion: async () => null,
  })
  const service = createCombatContentAuthoringService({ store, resolver })
  return {
    root,
    store,
    request(
      definition: MatureSkillDefinition | AnyResonanceDefinition,
      overrides: Record<string, unknown> = {},
      userId = owner,
    ) {
      return handleCombatContentAuthoringRequest(
        new Request('https://aurevane.test/api/master/combat-content', {
          method: 'POST',
          body: JSON.stringify({
            operation: 'preview',
            contentKind: 'disciplinePair' in definition ? 'resonance' : 'skill',
            definition,
            behaviorId: definition.ability!.behaviors[0]!.id,
            previewRootSkillId: root.id,
            seed: 1,
            eventSample: {
              referenceActor: 'owner',
              ownerHpPercent: 60,
              ownerMpPercent: 60,
              ownerStatus: 'none',
            },
            ...overrides,
          }),
        }),
        { getActor: async () => ({ userId }), createService: () => service },
      )
    },
  }
}
const cases = [
  ['ironfist.counter-palm', 'vanguard.forceful-strike', 'owner', 60, 'none'],
  ['resonance.ironfist-lifebinder.renewed-force', 'ironfist.rising-fist', 'owner', 60, 'none'],
  [
    'resonance.dawnshield-vanguard.linked-sequence',
    'vanguard.forceful-strike',
    'owner',
    60,
    'none',
  ],
  ['resonance.dawnshield-ironfist.linked-sequence', 'ironfist.rising-fist', 'owner', 50, 'poison'],
  ['resonance.runeblade-stormsinger.linked-sequence', 'runeblade.arc-edge', 'owner', 60, 'none'],
  ['resonance.chronist-dawnshield.linked-sequence', 'dawnshield.renewal', 'owner', 60, 'none'],
  ['vanguard.second-wind', 'vanguard.forceful-strike', 'opponent', 60, 'none'],
] as const
it.each(cases)(
  'samples real Automatic source %s from reference %s',
  async (id, rootId, referenceActor, ownerHpPercent, ownerStatus) => {
    const definition = records.find((r: { id: string }) => r.id === id).after
    const before = JSON.stringify(definition)
    expect(previewActionSelection(definition)).toMatchObject({
      available: true,
      behaviorId: definition.ability!.behaviors[0]!.id,
    })
    const api = await fixture(rootId)
    const overrides = {
      eventSample: { referenceActor, ownerHpPercent, ownerMpPercent: 60, ownerStatus },
    }
    const response = await api.request(definition, overrides)
    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200)
    const { preview } = await response.json()
    expect(preview).toMatchObject({
      actionId: id,
      behaviorId: definition.ability!.behaviors[0]!.id,
      legal: true,
      referenceAction: { id: rootId, contentVersion: api.root.contentVersion },
      eventSample: { ran: true, activated: true, scenario: overrides.eventSample },
    })
    expect(preview.eventSample.eventTypes.length).toBeGreaterThan(0)
    expect(preview.eventSample.owner.mpAfter).toBeLessThanOrEqual(preview.eventSample.owner.maxMp)
    expect(preview.eventSample.owner.hpAfter).toBeGreaterThan(0)
    if (id === 'resonance.dawnshield-ironfist.linked-sequence') {
      expect(preview.eventSample.ownerStatusChanges).toContainEqual({
        kind: 'removed',
        statusId: 'poison',
        name: 'Poison',
      })
    }
    if (id === 'ironfist.counter-palm') {
      expect(preview.eventSample.owner.mpAfter).toBe(preview.eventSample.owner.mpBefore - 3)
      expect(preview.eventSample.owner.barrierAfter).toBe(12)
    }
    expect(JSON.stringify(preview)).not.toMatch(
      /sourceInstanceId|abilityParticipants|capturedAbilitySources|effectOrigin|conditionTruth|chanceBasisPoints|provenance|rootActionId|commandId|sourceDisciplineId/,
    )
    expect(JSON.stringify(definition)).toBe(before)
    expect(await (await api.request(definition, overrides)).json()).toEqual({ preview })
    expect(
      await api.store.findPublished(id, definition.disciplinePair ? 'resonance' : 'skill'),
    ).toBeNull()
  },
)
it('does not invent a missing action family or source Discipline requirement', async () => {
  const def = records.find(
    (r: { id: string }) => r.id === 'resonance.dawnshield-vanguard.linked-sequence',
  ).after
  const api = await fixture('aetherist.arc-bolt')
  const response = await api.request(def)
  expect(response.status).toBe(200)
  expect((await response.json()).preview.eventSample).toMatchObject({ ran: true, activated: false })
})
it('retains threshold causality and does not heal after an explicitly missed incoming command', async () => {
  const def = records.find((r: { id: string }) => r.id === 'vanguard.second-wind').after
  const api = await fixture('vanguard.forceful-strike', (root) => {
    Object.assign(root.ability!.behaviors[0]!, {
      accuracy: { kind: 'fixed', chanceBasisPoints: 0 },
    })
  })
  const response = await api.request(def, {
    eventSample: {
      referenceActor: 'opponent',
      ownerHpPercent: 60,
      ownerMpPercent: 60,
      ownerStatus: 'none',
    },
  })
  expect(response.status).toBe(200)
  const { preview } = await response.json()
  expect(preview.eventSample).toMatchObject({ ran: true, activated: false })
  expect(preview.eventSample.owner.hpAfter).toBe(preview.eventSample.owner.hpBefore)
})
it.each([
  null,
  [],
  { referenceActor: 'everyone' },
  { referenceActor: 'owner', ownerHpPercent: 0 },
  { referenceActor: 'owner', ownerHpPercent: 101 },
  { referenceActor: 'owner', ownerHpPercent: 40.5 },
  { referenceActor: 'owner', ownerMpPercent: -1 },
  { referenceActor: 'owner', ownerMpPercent: 101 },
  { referenceActor: 'owner', ownerStatus: 'unknown' },
  { referenceActor: 'owner', extra: true },
])('rejects malformed sample settings %j', async (eventSample) => {
  const def = records.find((r: { id: string }) => r.id === 'ironfist.counter-palm').after
  const response = await (await fixture()).request(def, { eventSample })
  expect(response.status).toBe(400)
})
it('keeps authorization, disabled definitions and unknown current reference roots closed', async () => {
  const def = records.find((r: { id: string }) => r.id === 'ironfist.counter-palm').after
  const api = await fixture()
  expect((await api.request(def, {}, 'outsider')).status).toBe(403)
  expect((await api.request({ ...def, enabled: false })).status).toBe(400)
  expect((await api.request(def, { previewRootSkillId: 'unknown.root' })).status).toBe(400)
})

it('does not waive an unaffordable Automatic payment after a legal reference command', async () => {
  const def = records.find((r: { id: string }) => r.id === 'ironfist.counter-palm').after
  const api = await fixture()
  const response = await api.request(def, {
    eventSample: {
      referenceActor: 'owner',
      ownerHpPercent: 60,
      ownerMpPercent: 0,
      ownerStatus: 'none',
    },
  })
  expect(response.status).toBe(200)
  const { preview } = await response.json()
  expect(preview.eventSample).toMatchObject({
    ran: true,
    activated: false,
    owner: { mpBefore: 0, mpAfter: 0, barrierAfter: 0 },
  })
})
it('does not revive a source owner killed by the incoming reference command', async () => {
  const def = records.find((r: { id: string }) => r.id === 'vanguard.second-wind').after
  const response = await (
    await fixture()
  ).request(def, {
    eventSample: {
      referenceActor: 'opponent',
      ownerHpPercent: 1,
      ownerMpPercent: 60,
      ownerStatus: 'none',
    },
  })
  expect(response.status).toBe(200)
  expect((await response.json()).preview.eventSample).toMatchObject({
    ran: true,
    activated: false,
    owner: { hpAfter: 0 },
  })
})

it('preserves the updated stat bridge after a legal Summon reference', async () => {
  const def = records.find((r: { id: string }) => r.id === 'ironfist.counter-palm').after
  const api = await fixture('wildwarden.renewing-herbs')
  const response = await api.request(def)
  expect(response.status, JSON.stringify(await response.clone().json())).toBe(200)
  const { preview } = await response.json()
  expect(preview).toMatchObject({
    legal: true,
    referenceAction: { id: api.root.id },
    eventSample: { ran: true, activated: false },
  })
  expect(preview.eventSample.eventTypes).toContain('summon_spawned')
  expect(JSON.stringify(preview)).not.toMatch(/statBridge|profiles|sourceInstanceId|provenance/)
})
