import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  latestEnabledMatureSkills,
  validateMatureSkillDefinition,
  type MatureSkillDefinition,
} from './mature-skills'
import {
  currentEssenceDefinitions,
  validateEssenceDefinition,
  type EssenceDefinition,
} from './essence'
import {
  currentResonanceDefinitions,
  validateResonanceDefinition,
  type AnyResonanceDefinition,
} from './resonance'
import { defaultBasicSkills, validateBasicSkillDefinition } from './combat-basic-actions'
import { parseAbilityDefinition, validateAbilityDefinition } from './combat-definition'
import { projectPublicCombat } from './public-combat-presentation'
import { validateDisciplineSkillLoadout } from '../character/discipline-skill-loadout'
import { COMBAT_TAG_REGISTRY } from './combat-tag-registry'
import { PHASE4_STATUSES } from './status-content'
import { validateAbilityRequirements, type RequirementNode } from './combat-requirements'

type Row = {
  kind: string
  id: string
  beforeVersion: number
  beforeDigest: string
  designState: string
  after: Record<string, unknown>
  role?: string
  requiresSurfaceWork?: string[]
  retentionRationale?: string
  acceptance?: { setup: string; payoff: string; counterplay: string; cases: unknown[] }
  eligibility?: unknown
  decisionReview?: {
    setup: string
    expectedState: string
    counterScenario: string
    opportunityCost: string
    plannedCaseId: string
  }
  playIdentity?: {
    combinationRationale: string
    earnedFourSkillKit: {
      id: string
      contentVersion: number
      sourceDisciplineId: string
      unlockRequirement: unknown
    }[]
    turnDecision: string
    counter: string
    functionalSignature: string
    capacity: string
  }
}
const root = new URL('../../../../docs/superpowers/specs/', import.meta.url)
const manifest = JSON.parse(
  readFileSync(new URL('2026-10-10-roster-rebalance-proposals.json', root), 'utf8'),
) as { requiredRecordCount: number; records: Row[] }
const inventory = JSON.parse(
  readFileSync(new URL('2026-10-10-roster-rebalance-inventory.json', root), 'utf8'),
) as { records: Row[] }
function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, sorted(v)]),
    )
  return value
}
function digest(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(sorted(value)))
    .digest('hex')
}
const source = [
  ...latestEnabledMatureSkills().map((after) => ({ kind: 'skill', id: after.id, after })),
  ...currentEssenceDefinitions().map((after) => ({ kind: 'essence', id: after.essenceId, after })),
  ...currentResonanceDefinitions().map((after) => ({ kind: 'resonance', id: after.id, after })),
  ...defaultBasicSkills().map((after) => ({ kind: 'basic', id: after.id, after })),
]

describe('complete design-only roster handoff', () => {
  it('contains exactly the complete real inventory, including every unique pair', () => {
    expect(manifest.requiredRecordCount).toBe(294)
    expect(manifest.records).toHaveLength(294)
    expect(new Set(manifest.records.map((r) => `${r.kind}:${r.id}`)).size).toBe(294)
    expect(manifest.records.map((r) => `${r.kind}:${r.id}`).sort()).toEqual(
      source.map((r) => `${r.kind}:${r.id}`).sort(),
    )
    const pairs = manifest.records
      .filter((r) => r.kind === 'resonance')
      .map((r) => (r.after.disciplinePair as string[]).join(':'))
    expect(new Set(pairs).size).toBe(136)
  })
  it.each(source)(
    'preserves $kind $id identity, source, earned eligibility, media and exact before digest',
    ({ kind, id, after: before }) => {
      const row = manifest.records.find((r) => r.kind === kind && r.id === id)
      expect(row, `missing ${id}`).toBeDefined()
      if (!row) return
      const entry = inventory.records.find((r) => r.kind === kind && r.id === id)!
      expect(row.beforeVersion).toBe(before.contentVersion)
      expect(row.beforeDigest).toBe(entry.beforeDigest)
      expect(digest(before)).toBe(row.beforeDigest)
      const old = before as unknown as Record<string, unknown>
      for (const key of [
        'id',
        'essenceId',
        'sourceDisciplineId',
        'disciplinePair',
        'unlockRequirement',
        'media',
      ])
        if (key in old) expect(row.after[key], `${id}.${key}`).toEqual(old[key])
      if (kind === 'basic') {
        expect(row.after).toEqual(before)
        expect(row.retentionRationale).toBeTruthy()
      } else expect(row.after.contentVersion).toBe((before.contentVersion as number) + 1)
    },
  )
  it.each(manifest.records)(
    '$id passes actual record and Ability parsers and has concrete design acceptance',
    (row) => {
      const after = row.after
      const issues =
        row.kind === 'skill'
          ? validateMatureSkillDefinition(after as unknown as MatureSkillDefinition)
          : row.kind === 'essence'
            ? validateEssenceDefinition(after as unknown as EssenceDefinition)
            : row.kind === 'resonance'
              ? validateResonanceDefinition(after as unknown as AnyResonanceDefinition)
              : validateBasicSkillDefinition(after)
      expect(issues, row.id).toEqual([])
      const nativeGround = latestEnabledMatureSkills().some((s) => s.id === row.id && s.groundArea)
      if (row.kind !== 'basic' && !nativeGround)
        expect(after.ability, `${row.id} canonical behavior cannot be deleted`).toBeDefined()
      if (after.ability) {
        expect(validateAbilityDefinition(after.ability), row.id).toEqual([])
        expect(parseAbilityDefinition(after.ability)).toBeDefined()
      }
      expect(row.role).toBeTruthy()
      expect(row.eligibility).toBeDefined()
      expect(row.requiresSurfaceWork).toBeDefined()
      expect(row.acceptance?.setup).toBeTruthy()
      expect(row.acceptance?.payoff).toBeTruthy()
      expect(row.acceptance?.counterplay).toBeTruthy()
      expect(row.acceptance?.cases.length).toBeGreaterThanOrEqual(3)
    },
  )
})

it('gives all136 class Skills and17 Essences individual state/counter/opportunity-cost plans', () => {
  const classes = manifest.records.filter((r) => r.kind === 'skill' || r.kind === 'essence')
  expect(classes).toHaveLength(153)
  for (const row of classes) {
    const review = row.decisionReview
    expect(review, row.id).toBeDefined()
    expect(review?.setup, row.id).toBe(row.acceptance?.setup)
    expect(review?.expectedState, row.id).toBe(row.acceptance?.payoff)
    expect(review?.counterScenario, row.id).toBe(row.acceptance?.counterplay)
    expect(review?.opportunityCost.length, row.id).toBeGreaterThan(35)
    expect(
      row.acceptance?.cases.some((c) => (c as { id: string }).id === review?.plannedCaseId),
    ).toBe(true)
    expect(JSON.stringify(review)).not.toContain('choose its legal recipients')
    expect(JSON.stringify(review)).not.toContain('Use range/sight denial')
  }
  expect(new Set(classes.map((r) => r.decisionReview?.opportunityCost)).size).toBe(153)
})

interface Witness {
  recordId: string
  contentVersion: number
  mechanicsPath: string
  caseIds: string[]
}
interface Coverage {
  effectCoverage: { id: string; witnesses: Witness[]; classification: string }[]
  statusCoverage: {
    id: string
    witnesses: Witness[]
    classification: string
    systemRule?: string
  }[]
  requirementCoverage: { kind: string; witnesses: Witness[] }[]
  selectedActivationCombinations: { combination: string; witnesses: Witness[] }[]
  classes: {
    disciplineId: string
    complexity: string
    rationale: string
    approachableLoadout: string[]
    surface: string
  }[]
  groundExtension: { status: string; records: string[]; tests: string[] }
}
const coveragePath = new URL('2026-10-10-roster-rebalance-coverage.json', root)
const coverage = JSON.parse(readFileSync(coveragePath, 'utf8')) as Coverage
function resolve(w: Witness): Record<string, unknown> {
  const row = manifest.records.find((r) => r.id === w.recordId)!
  expect(row, `coverage orphan ${w.recordId}`).toBeDefined()
  expect(row.after.contentVersion).toBe(w.contentVersion)
  for (const id of w.caseIds)
    expect(row.acceptance?.cases.some((c) => (c as { id: string }).id === id)).toBe(true)
  let value: unknown = row
  for (const key of w.mechanicsPath.split('.')) value = (value as Record<string, unknown>)[key]
  expect(value, `${w.recordId}:${w.mechanicsPath}`).toBeDefined()
  return value as Record<string, unknown>
}
function nodes(n: RequirementNode | null): RequirementNode[] {
  return n ? [n, ...('children' in n ? n.children.flatMap(nodes) : [])] : []
}
// No October10 record contains these later mechanics. Their executable coverage lives in
// combat-endure.test.ts, combat-reversal.test.ts and combat-attack-tags.test.ts.
// Keep this finite: an unreviewed future registry entry must still fail roster coverage.
const outsideOctober10Effects = ['endure', 'reversal', 'weak-point', 'spike', 'ruin']
it('keeps later effect mechanics outside the immutable October10 records', () => {
  const types = new Set<string>(
    manifest.records.flatMap((row) =>
      row.after.ability
        ? parseAbilityDefinition(row.after.ability).behaviors.flatMap((behavior) =>
            behavior.effects.map((effect) => effect.payload.type),
          )
        : [],
    ),
  )
  for (const id of outsideOctober10Effects) {
    expect(
      COMBAT_TAG_REGISTRY.some((tag) => tag.id === id),
      id,
    ).toBe(true)
    expect(types.has(id), id).toBe(false)
  }
})
it('has registry-derived meaningful effect witnesses for the immutable October10 roster', () => {
  expect(coverage.effectCoverage.map((r) => r.id).sort()).toEqual(
    COMBAT_TAG_REGISTRY.filter((r) => !outsideOctober10Effects.includes(r.id))
      .map((r) => r.id)
      .sort(),
  )
  for (const entry of coverage.effectCoverage) {
    expect(entry.witnesses.length, entry.id).toBeGreaterThan(0)
    for (const w of entry.witnesses) expect(resolve(w).type).toBe(entry.id)
  }
})
it('classifies every status registered for the immutable October10 roster', () => {
  const ids = [
    ...new Set([
      'guarded',
      'exposed',
      'lowered-guard',
      'covert',
      'revealed',
      // Later mechanics: combat-blindside.test.ts, combat-counter.test.ts and combat-endure.test.ts.
      ...PHASE4_STATUSES.filter(
        (s) => !['blindside-vulnerability', 'counter', 'endure'].includes(s.id),
      ).map((s) => s.id),
    ]),
  ]
  expect(coverage.statusCoverage.map((r) => r.id).sort()).toEqual(ids.sort())
  for (const entry of coverage.statusCoverage) {
    if (entry.id === 'lowered-guard' || entry.id === 'displaced') {
      expect(entry.systemRule).toBeTruthy()
      expect(entry.witnesses).toEqual([])
      expect(entry.classification).toBe(
        entry.id === 'lowered-guard'
          ? 'system-generated'
          : 'historical-compatibility-not-authorable',
      )
    } else {
      expect(entry.witnesses.length, entry.id).toBeGreaterThan(0)
      for (const w of entry.witnesses) {
        const p = resolve(w)
        expect(
          p.statusId === entry.id ||
            p.type === entry.id ||
            (entry.id === 'revealed' && p.type === 'sensory'),
        ).toBe(true)
      }
    }
  }
})
it('covers all eight real Requirement forms and selected activation combinations with actual typed nodes', () => {
  expect(coverage.requirementCoverage.map((r) => r.kind).sort()).toEqual(
    [
      'all',
      'any',
      'resource-state',
      'resource-threshold-crossing',
      'status-presence',
      'prime-presence',
      'event',
      'action',
    ].sort(),
  )
  for (const entry of coverage.requirementCoverage) {
    expect(entry.witnesses.length).toBeGreaterThan(0)
    for (const w of entry.witnesses) {
      const n = resolve(w)
      expect(n.kind).toBe(entry.kind)
      expect(validateAbilityRequirements(n)).toEqual([])
    }
  }
  const actual = new Set<string>()
  for (const row of manifest.records)
    if (row.after.ability)
      for (const b of parseAbilityDefinition(row.after.ability).behaviors)
        actual.add(`${b.activation}/${b.mode}`)
  expect(coverage.selectedActivationCombinations.map((r) => r.combination).sort()).toEqual(
    [...actual].sort(),
  )
  for (const c of coverage.selectedActivationCombinations)
    for (const w of c.witnesses) {
      const b = resolve(w)
      expect(`${b.activation}/${b.mode}`).toBe(c.combination)
    }
})
it('requires deliberate hostile accuracy, finite automatic budgets, real modifier flows and one offensive scaling budget', () => {
  for (const row of manifest.records) {
    if (!row.after.ability || row.kind === 'basic') continue
    for (const b of parseAbilityDefinition(row.after.ability).behaviors) {
      const unitPacket = b.effects.some((e) =>
        ['primary-unit', 'affected-units'].includes(e.payload.recipient),
      )
      if (
        b.activation === 'manual' &&
        b.mode === 'action' &&
        b.targeting?.categories?.includes('enemy') &&
        unitPacket
      )
        expect(b.accuracy, { id: row.id, group: b.id }.toString()).toEqual({ kind: 'standard' })
      if (b.activation === 'manual' && b.mode === 'action')
        expect(b.costs.find((c) => c.resource === 'ap')?.amount, row.id).toBeGreaterThan(0)
      if (b.activation === 'automatic') {
        expect(b.activationLimits?.length, row.id).toBeGreaterThan(0)
        expect(
          nodes(b.requirements).some((n) => n.kind === 'event'),
          row.id,
        ).toBe(true)
        expect(
          b.costs.some((c) => c.resource === 'mp' && c.amount > 0),
          row.id,
        ).toBe(true)
      }
      if (b.activation === 'ongoing') {
        expect(b.requirements).not.toBeNull()
        expect(b.effects.every((e) => e.payload.type === 'damage-bonus')).toBe(true)
      }
      if (b.mode === 'modifier' && b.activation === 'manual')
        expect(
          row.requiresSurfaceWork?.some((s) => s.toLowerCase().includes('modifier')),
          row.id,
        ).toBe(true)
      const damage = b.effects
        .map((e) => e.payload)
        .filter((p) => p.type === 'damage' || p.type === 'pierce')
      expect(
        damage.reduce((sum, p) => sum + (p.scaling?.coefficientBasisPoints ?? 2500), 0),
        row.id,
      ).toBeLessThanOrEqual(2500)
    }
  }
})
it('materializes all three selected Ground groups while preserving their exact native area metadata', () => {
  const originals = latestEnabledMatureSkills().filter((s) => s.groundArea)
  expect(originals).toHaveLength(3)
  expect(coverage.groundExtension.records.sort()).toEqual(originals.map((s) => s.id).sort())
  expect(coverage.groundExtension.status).toBe('materialized-local-not-active')
  expect(coverage.groundExtension.tests.length).toBeGreaterThanOrEqual(7)
  for (const before of originals) {
    const row = manifest.records.find((r) => r.id === before.id)!
    expect(row.after.groundArea).toEqual(before.groundArea)
    expect(parseAbilityDefinition(row.after.ability).behaviors[0]!.groundArea).toMatchObject({
      durationRounds: before.groundArea!.durationRounds,
      visualPresetId: before.groundArea!.visualPresetId,
      entryEffectIds: before.groundArea!.entryEffectOrdinals.map((ordinal) => `entry-${ordinal}`),
      timing: 'next-round',
    })
    expect(row.requiresSurfaceWork?.some((s) => s.includes('ground'))).toBe(true)
  }
})
it('assigns each real class a justified Library-only tier and four useful obtainable Manual choices', () => {
  const classes = [...new Set(latestEnabledMatureSkills().map((s) => s.sourceDisciplineId))]
  expect(coverage.classes.map((c) => c.disciplineId).sort()).toEqual(classes.sort())
  for (const c of coverage.classes) {
    expect(['Intuitive', 'Tactical', 'Intricate']).toContain(c.complexity)
    expect(c.rationale.length).toBeGreaterThan(40)
    expect(c.surface).toContain('Library')
    expect(c.approachableLoadout).toHaveLength(4)
    expect(new Set(c.approachableLoadout).size).toBe(4)
    for (const id of c.approachableLoadout) {
      const row = manifest.records.find((r) => r.id === id)!
      expect(row, id).toBeDefined()
      expect(row.after.sourceDisciplineId).toBe(c.disciplineId)
      expect(
        parseAbilityDefinition(row.after.ability).behaviors.some(
          (b) => b.activation === 'manual' && b.mode === 'action',
        ),
      ).toBe(true)
    }
  }
})

function functionalShape(value: unknown, key = ''): unknown {
  if (Array.isArray(value)) return value.map((v) => functionalShape(v, key))
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([k]) =>
            ![
              'id',
              'key',
              'contentVersion',
              'schemaVersion',
              'sourceDisciplineId',
              'requiredTags',
              'abilityId',
              'description',
            ].includes(k),
        )
        .map(([k, v]) => [k, functionalShape(v, k)]),
    )
  if (['statusId', 'statusIds', 'element', 'defenseKind', 'source'].includes(key)) return '_'
  if (typeof value === 'number') return key === 'maximumSelections' ? value : '_'
  return value
}

it('the four reviewed pair decisions differ from equipped tools beyond scalar prices, prerequisites or future Armor', () => {
  function decision(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(decision)
    if (!value || typeof value !== 'object') return value
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([k]) => !['requirements', 'costs', 'cooldown', 'armorIgnoredBasisPoints'].includes(k),
        )
        .map(([k, v]) => [k, k === 'type' && v === 'pierce' ? 'damage' : decision(v)]),
    )
  }
  for (const id of [
    'resonance.aetherist-shadehand.veiled-conduit',
    'resonance.edgedancer-wildwarden.linked-sequence',
    'resonance.farstrider-runeblade.linked-sequence',
    'resonance.cinderweaver-wildwarden.linked-sequence',
  ]) {
    const row = manifest.records.find((r) => r.id === id)
    expect(row, id).toBeDefined()
    const pairShape = JSON.stringify(functionalShape(decision(row!.after.ability)))
    for (const tool of row!.playIdentity!.earnedFourSkillKit) {
      const skill = manifest.records.find((r) => r.id === tool.id)!
      expect(pairShape, id + ' vs ' + tool.id).not.toBe(
        JSON.stringify(functionalShape(decision(skill.after.ability))),
      )
    }
  }
})
it.each(manifest.records.filter((r) => r.kind === 'resonance'))(
  '$id has an actual earned four-Skill pair decision within both Primary orders',
  (row) => {
    const identity = row.playIdentity!
    expect(identity, row.id).toBeDefined()
    expect(identity.combinationRationale.length).toBeGreaterThan(60)
    expect(identity.turnDecision).toBe(row.acceptance?.payoff)
    expect(identity.counter).toBe(row.acceptance?.counterplay)
    expect(identity.earnedFourSkillKit).toHaveLength(4)
    expect(new Set(identity.earnedFourSkillKit.map((k) => k.id)).size).toBe(4)
    const pair = row.after.disciplinePair as string[]
    const references = identity.earnedFourSkillKit.map((k) => {
      const skill = manifest.records.find((r) => r.kind === 'skill' && r.id === k.id)!
      expect(skill, k.id).toBeDefined()
      expect(k.contentVersion).toBe(skill.after.contentVersion)
      expect(k.sourceDisciplineId).toBe(skill.after.sourceDisciplineId)
      expect(k.unlockRequirement).toEqual(skill.after.unlockRequirement)
      expect(pair).toContain(k.sourceDisciplineId)
      return {
        skillId: k.id,
        contentVersion: k.contentVersion,
        sourceDisciplineId: k.sourceDisciplineId,
      }
    })
    for (const primary of pair) {
      const secondary = pair.find((id) => id !== primary)!
      expect(
        validateDisciplineSkillLoadout({
          primaryDisciplineId: primary,
          secondaryDisciplineId: secondary,
          equipped: references,
          learned: references,
        }),
        row.id,
      ).toEqual([])
      expect(
        validateDisciplineSkillLoadout({
          primaryDisciplineId: primary,
          secondaryDisciplineId: secondary,
          equipped: references,
          learned: [],
        }).every((i) => i.code === 'skill-not-learned'),
      ).toBe(true)
    }
    expect(identity.capacity).toContain('earned unlocks')
    expect(
      row.acceptance?.cases.some(
        (c) => (c as { id: string }).id === row.id + ':four-skill-decision',
      ),
    ).toBe(true)
    expect(identity.functionalSignature).toBe(digest(functionalShape(row.after.ability)))
  },
)
it('screens all136 pair interactions with scalar/cosmetic-stripped operations, preserving the independent creative gate', () => {
  const pairs = manifest.records.filter((r) => r.kind === 'resonance')
  expect(new Set(pairs.map((r) => digest(functionalShape(r.after.ability)))).size).toBe(136)
  const maintained = pairs.filter((r) =>
    parseAbilityDefinition(r.after.ability).behaviors.some((b) => b.activation === 'ongoing'),
  )
  expect(maintained.map((r) => r.after.name).sort()).toEqual(['Held Formula', 'Unstable Reserve'])
  const simpleMultipliers = pairs.filter((r) =>
    parseAbilityDefinition(r.after.ability).behaviors.some(
      (b) =>
        b.activation === 'manual' &&
        b.mode === 'modifier' &&
        b.effects.length === 1 &&
        b.effects[0]!.payload.type === 'damage-bonus',
    ),
  )
  expect(simpleMultipliers.map((r) => r.after.name)).toEqual(['Sighted Capacitor'])
})

it('public projections omit all candidate hit-authoring fields without mutating private definitions', () => {
  function inspect(value: unknown): void {
    if (Array.isArray(value)) {
      value.forEach(inspect)
      return
    }
    if (!value || typeof value !== 'object') return
    for (const [key, v] of Object.entries(value)) {
      expect(['accuracyRule', 'accuracyMode', 'accuracyModifierBasisPoints']).not.toContain(key)
      if (key === 'accuracy') expect(typeof v).toBe('number')
      inspect(v)
    }
  }
  for (const row of manifest.records) {
    const before = JSON.stringify(row.after)
    inspect(projectPublicCombat(row.after))
    expect(JSON.stringify(row.after)).toBe(before)
  }
})

it('keeps only the five explicitly costed authored-Power exceptions rather than increasing a shared cap', () => {
  const exceptions: Record<string, { power: number; ap: number; mp: number }> = {
    'aetherist.overchannel': { power: 20, ap: 60, mp: 12 },
    'shadehand.execution-cut': { power: 24, ap: 60, mp: 8 },
    'ravager.desperate-execution': { power: 24, ap: 60, mp: 8 },
    'dawnshield.judgment': { power: 17, ap: 55, mp: 7 },
    'essence.aetherist.aether-nova': { power: 20, ap: 70, mp: 14 },
  }
  const seen = new Set<string>()
  for (const row of manifest.records) {
    if (!row.after.ability || row.kind === 'basic') continue
    for (const b of parseAbilityDefinition(row.after.ability).behaviors) {
      const power = b.effects.reduce(
        (total, e) =>
          total +
          (['damage', 'pierce'].includes(e.payload.type)
            ? (e.payload as { amount: number }).amount
            : 0),
        0,
      )
      if (power <= (b.attackFamily === 'mystic' ? 16 : 20)) continue
      const accepted = exceptions[row.id]
      expect(accepted, row.id).toBeDefined()
      expect(power).toBe(accepted.power)
      expect(b.costs.find((c) => c.resource === 'ap')?.amount).toBe(accepted.ap)
      expect(b.costs.find((c) => c.resource === 'mp')?.amount).toBe(accepted.mp)
      seen.add(row.id)
    }
  }
  expect([...seen].sort()).toEqual(Object.keys(exceptions).sort())
})
