import { readFileSync } from 'node:fs'
import {
  createLegalRosterDuel,
  legalRosterCycleKits,
  playLegalRosterDuel,
} from '@/server/battle/roster-legal-duel.test-utils'
import type { CombatEffectTimingPolicy } from '@aurevane/game-core/combat/combat-effect-timing'
import { expect, it, vi } from 'vitest'
import {
  owner,
  store,
  resolver,
  publishProposedRoster,
} from '@/server/battle/roster-legal-build.test-utils'
import { createCombatContentAuthoringService } from './combat-content-authoring-service'
import { resolveCombatContentCatalogueSnapshot } from '@/server/combat/combat-content-resolver'
import { validateCombatCatalogueTiming } from '@/server/combat/combat-catalogue-timing-compatibility'

vi.mock('server-only', () => ({}))
type Row = {
  kind: 'skill' | 'essence' | 'resonance' | 'basic'
  id: string
  beforeVersion: number
  after: { contentVersion: number }
}
const rows: Row[] = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../docs/superpowers/specs/2026-10-18-modular-correction-cohort.json',
      import.meta.url,
    ),
    'utf8',
  ),
).records
const service = createCombatContentAuthoringService({ store, resolver })

it.each(rows)('$kind $id passes the actual Master authoring boundary', (row) => {
  const result =
    row.kind === 'essence'
      ? service.validateEssenceDefinition(row.after)
      : row.kind === 'resonance'
        ? service.validateResonanceDefinition(row.after)
        : service.validateSkillDefinition(row.after)
  expect(result.issues).toEqual([])
  expect(result.valid).toBe(true)
})

let publication: Promise<void> | undefined
function publishCorrectionRoster() {
  return (publication ??= (async () => {
    await publishProposedRoster()
    const old = new Map(
      await Promise.all(
        rows
          .filter((row) => row.kind !== 'basic')
          .map(
            async (row) =>
              [
                row.id,
                await store.findPublished(row.id, row.kind === 'basic' ? 'skill' : row.kind),
              ] as const,
          ),
      ),
    )
    for (const row of rows) {
      const input = {
        actorUserId: owner,
        definition: row.after,
        expectedBaseVersion: row.beforeVersion,
      }
      const receipt =
        row.kind === 'essence'
          ? await service.publishEssence(input)
          : row.kind === 'resonance'
            ? await service.publishResonance(input)
            : await service.publishSkill(input)
      expect(receipt.contentVersion).toBe(row.after.contentVersion)
      expect(receipt.definition).toEqual(row.after)
      const history = await store.listPublishedVersions(row.id)
      if (old.has(row.id))
        expect(history.find((entry) => entry.contentVersion === row.beforeVersion)).toEqual(
          old.get(row.id),
        )
    }
    const publications = await Promise.all(
      rows.map((row) => store.findPublished(row.id, row.kind === 'basic' ? 'skill' : row.kind)),
    )
    expect(publications.every(Boolean)).toBe(true)
    const catalogue = resolveCombatContentCatalogueSnapshot({
      token: 'a'.repeat(32),
      policy: {
        version: 8,
        tagAuthority: 'global',
        modes: {
          summon: 'instant',
          displace: 'instant',
          'mp-drain': 'instant',
          'remove-status': 'instant',
          'return-to-turn-start': 'controlled',
          'barrier-change': 'instant',
          blindside: 'instant',
        },
      },
      publications: publications.filter((row) => row !== null),
    })
    expect(validateCombatCatalogueTiming(catalogue)).toEqual([])
  })())
}

it('appends all corrections through real Owner publication and preserves every previously published definition', async () => {
  await publishCorrectionRoster()
})

const correctionPolicy: CombatEffectTimingPolicy = {
  version: 8,
  tagAuthority: 'global',
  modes: {
    summon: 'instant',
    displace: 'instant',
    'mp-drain': 'instant',
    'remove-status': 'instant',
    'return-to-turn-start': 'controlled',
    'barrier-change': 'instant',
    blindside: 'instant',
  },
}
const pairs = [
  'aetherist-shadehand',
  'edgedancer-wildwarden',
  'runeblade-vanguard',
  'cinderweaver-tidecaller',
  'aetherist-chronist',
  'chronist-edgedancer',
]
const currentKits = legalRosterCycleKits.filter(
  (kit) => !kit.secondary || pairs.some((pair) => kit.name.startsWith(`resonance.${pair}.`)),
)
it.each(currentKits)(
  '$name admits corrected earned builds and plays natural turns with global timing',
  async (kit) => {
    const duel = await createLegalRosterDuel({
      kit,
      level: 100,
      context: 'pvp',
      seed: 12345,
      prepareRoster: publishCorrectionRoster,
      effectTimingPolicy: correctionPolicy,
      modularSkillPolicyVersion: 1,
    })
    for (const participant of duel.participants) {
      for (const source of participant.sources) {
        const record = rows.find((row) => row.id === source.abilityId)
        expect(record, source.abilityId).toBeDefined()
        expect(source.contentVersion).toBe(record!.after.contentVersion)
      }
      expect(
        participant.sources.some(
          (source) => source.sourceKind === (kit.secondary ? 'resonance' : 'essence'),
        ),
      ).toBe(true)
    }
    const result = playLegalRosterDuel(duel, { maximumRounds: 3 })
    expect(result.errors).toEqual([])
    expect(result.commands.length).toBeGreaterThan(0)
    expect(
      result.state.tactical.battle.round > 3 ||
        result.state.tactical.battle.lifecycle === 'completed',
    ).toBe(true)
  },
  30000,
)
