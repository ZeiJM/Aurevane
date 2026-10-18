import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { InMemoryCombatContentRepository } from '@aurevane/db/combat-content'
import type { AnyResonanceDefinition } from '@aurevane/game-core/combat/resonance'
import { resolveResonanceForPair } from '@aurevane/game-core/combat/resonance'
import { parseAbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { createCombatContentResolver } from '@/server/combat/combat-content-resolver'
import { CombatContentReviewPanel } from '@/components/master/combat-content/combat-content-review-panel'
import { ResonanceContentEditor } from '@/components/master/combat-content/resonance-content-editor'
import { createCombatContentAuthoringService } from './combat-content-authoring-service'
import { handleCombatContentAuthoringRequest } from './combat-content-authoring-handler'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }))
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
    request(body: Record<string, unknown>, actorUserId = owner) {
      return handleCombatContentAuthoringRequest(
        new Request('https://aurevane.test/api/master/combat-content', {
          method: 'POST',
          body: JSON.stringify({ operation: 'preview', contentKind: 'resonance', ...body }),
        }),
        { getActor: async () => ({ userId: actorUserId }), createService: () => service },
      )
    },
  }
}
const records = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json',
      import.meta.url,
    ),
    'utf8',
  ),
).records.filter((r: { kind: string }) => r.kind === 'resonance') as {
  id: string
  after: AnyResonanceDefinition
}[]
const steamfront = records.find(
  (r) => r.id === 'resonance.cinderweaver-tidecaller.linked-sequence',
)!.after
const poise = records.find((r) => r.id === 'resonance.aetherist-edgedancer.linked-sequence')!.after
const noop = () => {}

for (const combatContext of ['pve', 'pvp'] as const) {
  it.each([
    {
      definition: steamfront,
      behaviorId: 'quench',
      ap: 35,
      mp: 4,
      affected: 'master-preview-actor',
    },
    {
      definition: steamfront,
      behaviorId: 'flare',
      ap: 50,
      mp: 6,
      affected: 'master-preview-enemy',
    },
    { definition: poise, behaviorId: 'release', ap: 50, mp: 8, affected: 'master-preview-enemy' },
  ])(
    combatContext + ' previews actual Resonance $behaviorId through the authenticated lane',
    async ({ definition, behaviorId, ap, mp, affected }) => {
      const api = fixture()
      const before = JSON.stringify(definition)
      expect(api.service.validateResonanceDefinition(definition).issues).toEqual([])
      const response = await api.request({ definition, behaviorId, combatContext })
      expect(response.status).toBe(200)
      const { preview } = await response.json()
      expect(preview).toMatchObject({
        actionId: definition.id,
        behaviorId,
        legal: true,
        issues: [],
        costs: { actionEconomy: ap, mp, hp: 0 },
        simulation: { rngConsumed: false },
      })
      expect(preview.targeting.affectedCombatantIds).toContain(affected)
      if (behaviorId === 'release')
        expect(preview.movement.path).toEqual([
          { x: 2, y: 1 },
          { x: 3, y: 1 },
        ])
      expect(preview.projections.effects.length).toBeGreaterThan(0)
      expect(JSON.stringify(preview)).not.toMatch(
        /sourceInstanceId|capturedAbilitySources|effectOrigins|chanceBasisPoints|sourceDisciplineId/,
      )
      expect(JSON.stringify(definition)).toBe(before)
      const again = await api.request({ definition, behaviorId, combatContext })
      expect(await again.json()).toEqual({ preview })
      const html = renderToStaticMarkup(
        <CombatContentReviewPanel
          contentKey={definition.id}
          baseVersion={definition.contentVersion - 1}
          nextVersion={definition.contentVersion}
          validation={{ valid: true, issues: [], derivedTags: [] }}
          diff={{ changedPaths: ['ability'] }}
          preview={preview}
          history={[]}
          busy={false}
          publishConfirmationOpen={false}
          rollbackTargetVersion={null}
          onValidate={noop}
          onDiff={noop}
          onPreview={noop}
          onRequestPublish={noop}
          onConfirmPublish={noop}
          onCancelPublish={noop}
          onRequestRollback={noop}
          onConfirmRollback={noop}
          onCancelRollback={noop}
        />,
      )
      expect(html).toContain('Legal in fixture')
      expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Publish<\/button>/)
    },
  )
}

it('shows the actual Resonance action selector and simulation control', () => {
  const html = renderToStaticMarkup(
    <ResonanceContentEditor
      resonances={[
        {
          id: steamfront.id,
          label: steamfront.name,
          disciplinePair: steamfront.disciplinePair,
          currentVersion: steamfront.contentVersion,
          baseVersion: steamfront.contentVersion,
          draftVersion: null,
          definition: steamfront,
          history: [],
        },
      ]}
    />,
  )
  expect(html).toContain('aria-label="Preview action group"')
  expect(html).toContain('value="quench"')
  expect(html).toContain('value="flare"')
  expect(html).toMatch(/<button[^>]*>Preview<\/button>/)
})

it.each([
  {
    label: 'ambiguous group',
    body: { definition: steamfront },
    message: /Choose.*Manual action group/,
  },
  {
    label: 'unknown group',
    body: { definition: steamfront, behaviorId: 'missing' },
    message: /Choose.*Manual action group/,
  },
  {
    label: 'disabled definition',
    body: { definition: { ...steamfront, enabled: false }, behaviorId: 'quench' },
    message: /disabled/i,
  },
])('rejects $label without reporting a legal simulation', async ({ body, message }) => {
  const response = await fixture().request(body)
  expect(response.status).toBe(400)
  expect((await response.json()).error.message).toMatch(message)
})

it('retains native Requirement failures instead of inventing resource state', async () => {
  const response = await fixture().request({ definition: poise, behaviorId: 'gather' })
  expect(response.status).toBe(200)
  const { preview } = await response.json()
  expect(preview.legal).toBe(false)
  expect(preview.issues.length).toBeGreaterThan(0)
})

it('rejects an unauthorized actor before simulating', async () => {
  const response = await fixture().request(
    { definition: steamfront, behaviorId: 'quench' },
    '22222222-2222-4222-8222-222222222222',
  )
  expect(response.status).toBe(403)
})

it.each(
  records.flatMap(({ after: definition }) =>
    definition
      .ability!.behaviors.filter((b) => b.activation === 'manual' && b.mode === 'action')
      .map((b) => ({ definition, behaviorId: b.id })),
  ),
)(
  'prepares accepted $definition.id / $behaviorId without casting a legacy container',
  async ({ definition, behaviorId }) => {
    const before = JSON.stringify(definition)
    const response = await fixture().request({ definition, behaviorId })
    expect(response.status).toBe(200)
    const { preview } = await response.json()
    expect(preview.actionId).toBe(definition.id)
    expect(preview.behaviorId).toBe(behaviorId)
    expect(preview.simulation.rngConsumed).toBe(false)
    expect(preview.targeting.target).toEqual(
      definition.ability!.behaviors.find((b) => b.id === behaviorId)!.targeting,
    )
    expect(JSON.stringify(preview)).not.toMatch(
      /sourceInstanceId|capturedAbilitySources|effectOrigins|chanceBasisPoints|sourceDisciplineId/,
    )
    expect(JSON.stringify(definition)).toBe(before)
  },
)

it('previews one free Controlled prime and the selected Resonance release costs', async () => {
  const group = steamfront.ability!.behaviors[1]!
  const definition = {
    ...steamfront,
    ability: parseAbilityDefinition({
      schemaVersion: 1,
      behaviors: [
        { ...group, effects: group.effects.map((effect) => ({ ...effect, timing: 'controlled' })) },
      ],
    }),
  }
  const response = await fixture().request({ definition, behaviorId: 'flare' })
  expect(response.status).toBe(200)
  expect((await response.json()).preview).toMatchObject({
    legal: true,
    costs: { actionEconomy: 50, mp: 6, hp: 0 },
    simulation: { preparation: 'free-controlled-prime', rngConsumed: false },
  })
})

it('does not cast a historical sequence Resonance as an independent action', async () => {
  const definition = resolveResonanceForPair('lifebinder', 'vanguard')!
  const before = JSON.stringify(definition)
  const response = await fixture().request({ definition })
  expect(response.status).toBe(400)
  expect((await response.json()).error.message).toMatch(/no Manual action group/)
  const html = renderToStaticMarkup(
    <ResonanceContentEditor
      resonances={[
        {
          id: definition.id,
          label: definition.name,
          disciplinePair: definition.disciplinePair,
          currentVersion: definition.contentVersion,
          baseVersion: definition.contentVersion,
          draftVersion: null,
          definition,
          history: [],
        },
      ]}
    />,
  )
  expect(html).toContain('Historical sample references')
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Preview<\/button>/)
  expect(JSON.stringify(definition)).toBe(before)
})

it('rejects a malformed canonical definition without falling back to the legacy trigger', async () => {
  const response = await fixture().request({
    definition: { ...steamfront, ability: { schemaVersion: 1, behaviors: [] } },
    behaviorId: 'quench',
  })
  expect(response.status).toBe(400)
})

it('samples Automatic-only Resonance groups through a reference rather than casting them independently', async () => {
  const definition = records.find((r) =>
    r.after.ability!.behaviors.every((b) => b.activation === 'automatic'),
  )!.after
  const response = await fixture().request({ definition })
  expect(response.status).toBe(200)
  expect((await response.json()).preview).toMatchObject({
    actionId: definition.id,
    referenceAction: { id: 'unarmed.basic' },
    eventSample: { ran: true, activated: false },
    simulation: { localFixtureOnly: true },
  })
})

it('projects an edited Resonance native Summon instead of hiding its profile', async () => {
  const all = JSON.parse(
    readFileSync(
      new URL(
        '../../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ).records
  const skill = all.find((r: { id: string }) => r.id === 'wildwarden.renewing-herbs').after
  const definition = { ...steamfront, ability: skill.ability }
  const api = fixture()
  expect(api.service.validateResonanceDefinition(definition).issues).toEqual([])
  const response = await api.request({ definition, behaviorId: 'renewing-herbs' })
  expect(response.status).toBe(200)
  const { preview } = await response.json()
  expect(preview.legal).toBe(true)
  expect(preview.summon?.profile.name).toBe('Verdant Stalker')
  expect(preview.summon?.spawnPosition).toEqual(preview.targeting.selection.position)
  expect(preview.summon?.abilities.length).toBeGreaterThan(0)
  expect(JSON.stringify(preview)).not.toMatch(
    /sourceInstanceId|capturedAbilitySources|effectOrigins|chanceBasisPoints/,
  )
})

it.each(['circle', 'line'] as const)(
  'previews geometry2 Fire Ground %s intent with actual persistence',
  async (shape) => {
    const flare = steamfront.ability!.behaviors[1]!
    const native = resolveMatureSkillVersion('cinderweaver.flame-burst')!
    const definition = {
      ...steamfront,
      ability: parseAbilityDefinition({
        schemaVersion: 1,
        behaviors: [
          {
            ...flare,
            targeting: {
              ...native.target,
              maximumSelections: 1,
              ...(shape === 'line' ? { shape: { kind: 'line', length: 3 }, maximumRange: 3 } : {}),
            },
            effects: flare.effects.map((effect) =>
              effect.payload.type === 'damage'
                ? { ...effect, payload: { ...effect.payload, recipient: 'affected-units' } }
                : effect,
            ),
            groundArea: {
              durationRounds: 3,
              visualPresetId: 'embers',
              entryEffectIds: ['damage'],
              timing: 'next-round',
            },
          },
        ],
      }),
    }
    const api = fixture()
    expect(api.service.validateResonanceDefinition(definition).issues).toEqual([])
    const response = await api.request({ definition, behaviorId: 'flare' })
    expect(response.status).toBe(200)
    const { preview } = await response.json()
    expect(preview.legal).toBe(true)
    expect(preview.targeting.selection).toEqual(
      shape === 'line'
        ? { kind: 'direction', direction: 'east', ground: true }
        : { kind: 'activate', ground: true },
    )
    expect(preview.groundAreas).toHaveLength(1)
    expect(preview.groundAreas[0].expiresAtRound - preview.groundAreas[0].activationRound).toBe(3)
    expect(preview.simulation.rngConsumed).toBe(false)
    expect(JSON.stringify(preview)).not.toMatch(/sourceInstanceId|effectOrigins|chanceBasisPoints/)
  },
)
