import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { InMemoryCombatContentRepository } from '@aurevane/db/combat-content'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { parseAbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { previewCombatContentDefinition } from './combat-content-preview'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import { createCombatContentResolver } from '@/server/combat/combat-content-resolver'
import { CombatContentReviewPanel } from '@/components/master/combat-content/combat-content-review-panel'
import { createCombatContentAuthoringService } from './combat-content-authoring-service'
vi.mock('server-only', () => ({}))
const owner = '11111111-1111-4111-8111-111111111111'
class LocalStore extends InMemoryCombatContentRepository {
  async getOperatorRole(userId: string) {
    return userId === owner ? ('owner' as const) : null
  }
}
function service() {
  const store = new LocalStore()
  const resolver = createCombatContentResolver({
    findCurrentSkill: (key) => store.findPublished(key, 'skill'),
    findSkillVersion: async (key, version) =>
      (await store.listPublishedVersions(key)).find(
        (row) => row.contentKind === 'skill' && row.contentVersion === version,
      ) ?? null,
    findCurrentContent: (key, kind) => store.findPublished(key, kind),
    findContentVersion: async (key, kind, version) =>
      (await store.listPublishedVersions(key)).find(
        (row) => row.contentKind === kind && row.contentVersion === version,
      ) ?? null,
  })
  return createCombatContentAuthoringService({ store, resolver })
}
const records = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json',
      import.meta.url,
    ),
    'utf8',
  ),
).records as { id: string; after: MatureSkillDefinition }[]
const cases = [
  ['vanguard.cleave', { kind: 'activate' }],
  ['farstrider.piercing-barrage', { kind: 'direction', direction: 'east' }],
  [
    'aetherist.chain-spark',
    {
      kind: 'selections',
      selections: [
        { kind: 'unit', combatantId: 'master-preview-enemy' },
        { kind: 'unit', combatantId: 'master-preview-enemy-2' },
      ],
    },
  ],
  [
    'farstrider.volley',
    {
      kind: 'selections',
      selections: [
        { kind: 'unit', combatantId: 'master-preview-enemy' },
        { kind: 'unit', combatantId: 'master-preview-enemy-2' },
      ],
    },
  ],
  [
    'vanguard.rally',
    {
      kind: 'selections',
      selections: [{ kind: 'unit', combatantId: 'master-preview-ally' }, { kind: 'self' }],
    },
  ],
] as const
const noop = () => {}
for (const combatContext of ['pve', 'pvp'] as const) {
  it.each(cases)(
    combatContext + ' authoring previews actual accepted %s targeting',
    async (id, selection) => {
      const definition = records.find((row) => row.id === id)!.after
      const before = JSON.stringify(definition)
      const api = service()
      const validation = api.validateSkillDefinition(definition)
      expect(validation.issues).toEqual([])
      const preview = await api.previewSkillDefinition({
        actorUserId: owner,
        definition,
        behaviorId: definition.ability!.behaviors[0]!.id,
        combatContext,
      })
      expect(preview.targeting.selection).toEqual(selection)
      expect(preview.issues).toEqual([])
      expect(preview.legal).toBe(true)
      expect(preview.targeting.affectedCombatantIds.length).toBeGreaterThan(0)
      if (selection.kind === 'selections') {
        const recipients = selection.selections.map((row) =>
          row.kind === 'self' ? 'master-preview-actor' : row.combatantId,
        )
        expect([...preview.targeting.affectedCombatantIds].sort()).toEqual([...recipients].sort())
        for (const combatantId of recipients)
          expect(preview.projections.effects).toContainEqual(
            expect.objectContaining({ combatantId }),
          )
      }
      expect(preview.simulation.rngConsumed).toBe(false)
      expect(JSON.stringify(preview)).not.toMatch(
        /sourceInstanceId|effectOrigins|chanceBasisPoints|capturedAbilitySources/,
      )
      expect(JSON.stringify(definition)).toBe(before)
      const html = renderToStaticMarkup(
        <CombatContentReviewPanel
          contentKey={id}
          baseVersion={definition.contentVersion - 1}
          nextVersion={definition.contentVersion}
          validation={validation}
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

it.each([
  { kind: 'all', ground: false, rawSelf: false },
  { kind: 'single', ground: true, rawSelf: false },
  { kind: 'single', ground: false, rawSelf: true },
] as const)(
  'uses actual independent categories for $kind ground=$ground rawSelf=$rawSelf',
  ({ kind, ground, rawSelf }) => {
    const original = records.find((row) => row.id === 'aetherist.chain-spark')!.after
    const group = original.ability!.behaviors[0]!
    const definition = {
      ...original,
      ability: parseAbilityDefinition({
        ...original.ability,
        behaviors: [
          {
            ...group,
            targeting: {
              ...group.targeting!,
              kind: rawSelf ? 'self' : 'unit',
              categories: [ground ? 'ground' : 'enemy'],
              shape: { kind },
              minimumRange: kind === 'all' ? 0 : 1,
              maximumRange: kind === 'all' ? 0 : 3,
              requiresLineOfSight: kind !== 'all',
              maximumSelections: 1,
            },
          },
        ],
      }),
    }
    expect(service().validateSkillDefinition(definition).issues).toEqual([])
    const before = JSON.stringify(definition)
    const preview = previewCombatContentDefinition(definition, { behaviorId: group.id })
    expect(preview.issues).toEqual([])
    expect(preview.legal).toBe(true)
    expect(preview.targeting.selection).toEqual(
      kind === 'all'
        ? { kind: 'activate' }
        : ground
          ? { kind: 'tile', position: { x: 3, y: 1 } }
          : { kind: 'unit', combatantId: 'master-preview-enemy' },
    )
    expect(preview.targeting.affectedCombatantIds).toContain('master-preview-enemy')
    expect(preview.simulation.rngConsumed).toBe(false)
    expect(JSON.stringify(definition)).toBe(before)
  },
)

it.each([{ kind: 'line', length: 3 }, { kind: 'circle', radius: 1 }, { kind: 'all' }] as const)(
  'previews an edited Basic with canonical $kind targeting',
  async (shape) => {
    const original = defaultBasicSkills().find((row) => row.id === 'basic.guard')!
    const group = original.ability.behaviors[0]!
    const definition = {
      ...original,
      ability: parseAbilityDefinition({
        ...original.ability,
        behaviors: [
          {
            ...group,
            requirements: null,
            targeting: {
              geometryVersion: 3,
              kind: 'unit',
              teamPolicy: 'enemy',
              categories: ['enemy'],
              friendlyFire: 'enemies-only',
              shape,
              minimumRange: 0,
              maximumRange:
                shape.kind === 'line' ? shape.length : shape.kind === 'circle' ? shape.radius : 0,
              requiresLineOfSight: false,
              maximumElevationDifference: 1,
              maximumSelections: 1,
            },
            effects: [
              { id: 'hit', payload: { type: 'damage', recipient: 'affected-units', amount: 7 } },
            ],
          },
        ],
      }),
    }
    const api = service()
    expect(api.validateSkillDefinition(definition).issues).toEqual([])
    const before = JSON.stringify(definition)
    const preview = await api.previewSkillDefinition({
      actorUserId: owner,
      definition,
      behaviorId: group.id,
    })
    expect(preview.issues).toEqual([])
    expect(preview.legal).toBe(true)
    expect(preview.targeting.selection).toEqual(
      shape.kind === 'line' ? { kind: 'direction', direction: 'east' } : { kind: 'activate' },
    )
    expect(preview.targeting.affectedCombatantIds).toContain('master-preview-enemy')
    expect(preview.projections.effects).toContainEqual(
      expect.objectContaining({ effectType: 'damage', combatantId: 'master-preview-enemy' }),
    )
    expect(preview.simulation.rngConsumed).toBe(false)
    expect(JSON.stringify(definition)).toBe(before)
  },
)
it.each(['controlled', 'move'] as const)(
  'preserves native %s preparation with canonical Line geometry',
  async (mode) => {
    const original = records.find((row) => row.id === 'farstrider.piercing-barrage')!.after
    const group = original.ability!.behaviors[0]!
    const definition = {
      ...original,
      ability: parseAbilityDefinition({
        ...original.ability,
        behaviors: [
          {
            ...group,
            effects:
              mode === 'controlled'
                ? group.effects.map((effect) => ({ ...effect, timing: 'controlled' }))
                : [
                    { id: 'step', payload: { type: 'move', recipient: 'actor', maximumTiles: 2 } },
                    ...group.effects,
                  ],
          },
        ],
      }),
    }
    const api = service()
    expect(api.validateSkillDefinition(definition).issues).toEqual([])
    const before = JSON.stringify(definition)
    const request = { actorUserId: owner, definition, behaviorId: group.id }
    const preview = await api.previewSkillDefinition(request)
    expect(preview.legal).toBe(true)
    expect(preview.issues).toEqual([])
    expect(preview.targeting.selection).toEqual({ kind: 'direction', direction: 'east' })
    expect(preview.costs).toMatchObject({ actionEconomy: 55, mp: 0, hp: 0 })
    expect(preview.targeting.affectedCombatantIds).toContain('master-preview-enemy')
    if (mode === 'controlled')
      expect(preview.simulation).toMatchObject({ preparation: 'free-controlled-prime' })
    else
      expect(preview).toMatchObject({
        movement: {
          path: [
            { x: 2, y: 1 },
            { x: 3, y: 1 },
          ],
        },
      })
    expect(preview.simulation.rngConsumed).toBe(false)
    expect(await api.previewSkillDefinition(request)).toEqual(preview)
    expect(JSON.stringify(definition)).toBe(before)
  },
)
it.each([{ categories: ['self'] as const }, { categories: ['self', 'ally'] as const }])(
  'never duplicates Self or invents in-range allies for zero-range $categories',
  async ({ categories }) => {
    const original = records.find((row) => row.id === 'vanguard.rally')!.after
    const group = original.ability!.behaviors[0]!
    const definition = {
      ...original,
      ability: parseAbilityDefinition({
        ...original.ability,
        behaviors: [
          {
            ...group,
            targeting: {
              ...group.targeting!,
              categories: [...categories],
              minimumRange: 0,
              maximumRange: 0,
            },
          },
        ],
      }),
    }
    const api = service()
    expect(api.validateSkillDefinition(definition).issues).toEqual([])
    const preview = await api.previewSkillDefinition({
      actorUserId: owner,
      definition,
      behaviorId: group.id,
    })
    expect(preview.issues).toEqual([])
    expect(preview.legal).toBe(true)
    expect(preview.targeting.selection).toMatchObject({ kind: 'selections' })
    if (preview.targeting.selection.kind !== 'selections')
      throw Error('Expected bounded plural selection')
    expect(preview.targeting.selection.selections).toHaveLength(1)
    expect(preview.targeting.affectedCombatantIds).toEqual(['master-preview-actor'])
  },
)

it.each([{ kind: 'single' }, { kind: 'circle', radius: 1 }] as const)(
  'places an actual allied Ground recipient for $kind categories',
  async (shape) => {
    const original = records.find((row) => row.id === 'vanguard.rally')!.after
    const group = original.ability!.behaviors[0]!
    const definition = {
      ...original,
      ability: parseAbilityDefinition({
        ...original.ability,
        behaviors: [
          {
            ...group,
            targeting: {
              ...group.targeting!,
              categories: ['ground'],
              shape,
              minimumRange: shape.kind === 'single' ? 1 : 0,
              maximumRange: shape.kind === 'single' ? 3 : 1,
              maximumSelections: 1,
            },
          },
        ],
      }),
    }
    const api = service()
    expect(api.validateSkillDefinition(definition).issues).toEqual([])
    const preview = await api.previewSkillDefinition({
      actorUserId: owner,
      definition,
      behaviorId: group.id,
    })
    expect(preview.issues).toEqual([])
    expect(preview.legal).toBe(true)
    expect(preview.targeting.affectedCombatantIds).toEqual(['master-preview-ally'])
    expect(preview.targeting.selection).toEqual(
      shape.kind === 'single' ? { kind: 'tile', position: { x: 3, y: 1 } } : { kind: 'activate' },
    )
  },
)

it.each([6, 15])(
  'previews actual authored Line[%i] through the Master service on its smaller board',
  async (length) => {
    const original = records.find((row) => row.id === 'farstrider.piercing-barrage')!.after
    const group = original.ability!.behaviors[0]!
    const definition = {
      ...original,
      ability: parseAbilityDefinition({
        ...original.ability,
        behaviors: [
          {
            ...group,
            targeting: {
              ...group.targeting!,
              shape: { kind: 'line', length },
              minimumRange: 0,
              maximumRange: length,
            },
          },
        ],
      }),
    }
    const api = service()
    expect(api.validateSkillDefinition(definition).issues).toEqual([])
    const before = JSON.stringify(definition)
    const preview = await api.previewSkillDefinition({
      actorUserId: owner,
      definition,
      behaviorId: group.id,
    })
    expect(preview.issues).toEqual([])
    expect(preview.legal).toBe(true)
    expect(preview.targeting.selection).toEqual({ kind: 'direction', direction: 'east' })
    expect(preview.targeting.affectedCombatantIds).toContain('master-preview-enemy')
    expect(preview.simulation.rngConsumed).toBe(false)
    expect(JSON.stringify(definition)).toBe(before)
  },
)
