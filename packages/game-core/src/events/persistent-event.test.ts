import { describe, expect, it } from 'vitest'

import {
  assertEventRunTransition,
  resolveEventCategory,
  validatePersistentEventDefinition,
  type PersistentEventDefinition,
} from './persistent-event'

const definition = (): PersistentEventDefinition => ({
  schemaVersion: 1,
  eventKey: 'event.frostmere-storm',
  templateKey: 'template.regional-crisis',
  contentVersion: 1,
  title: 'Storm over Frostmere',
  summary: 'A regional arcane storm disrupts travel and draws hostile encounters.',
  internalNotes: 'Foundation kernel fixture.',
  family: 'regional-event',
  scope: { type: 'region', key: 'region.frostmere' },
  phases: [
    {
      id: 'omen',
      name: 'Omen',
      objectives: [
        {
          id: 'survey',
          type: 'discover',
          referenceKey: 'objective.frostmere-survey',
          target: 1,
        },
      ],
      effects: [
        { type: 'world-pulse', referenceKey: 'announcement.frostmere-omen', enabled: true },
      ],
      cleanupEffects: [],
      transition: { type: 'objective-threshold', objectiveId: 'survey' },
    },
    {
      id: 'crisis',
      name: 'Crisis',
      objectives: [
        {
          id: 'repel',
          type: 'community-threshold',
          referenceKey: 'encounter.frostmere-storm',
          target: 100,
        },
      ],
      effects: [{ type: 'encounter-pool', referenceKey: 'pool.frostmere-storm', enabled: true }],
      cleanupEffects: [
        { type: 'encounter-pool', referenceKey: 'pool.frostmere-storm', enabled: false },
      ],
      transition: { type: 'elapsed', afterSeconds: 3600 },
    },
  ],
  rewardPackageRefs: ['reward.frostmere-storm'],
  aftermathRefs: ['aftermath.frostmere-storm'],
})

type MalformedEventFixture = {
  phases: Array<{
    effects: Array<{ type: string }>
    transition: { type: string; objectiveId?: string }
  }>
}

const cloneDefinition = (): MalformedEventFixture =>
  JSON.parse(JSON.stringify(definition())) as MalformedEventFixture

const validateMalformedFixture = (fixture: MalformedEventFixture): void =>
  validatePersistentEventDefinition(fixture as unknown as PersistentEventDefinition)

describe('persistent event definition', () => {
  it('keeps an explicit category independent of event family', () => {
    const repeatable = { ...definition(), category: 'repeatable-activities' as const }
    expect(() => validatePersistentEventDefinition(repeatable)).not.toThrow()
    expect(resolveEventCategory(repeatable)).toBe('repeatable-activities')
  })

  it('classifies older saved definitions without rewriting their captures', () => {
    expect(resolveEventCategory({ family: 'regional-event' })).toBe('world-events')
    expect(resolveEventCategory({ family: 'narrative-event' })).toBe('story-campaigns')
    expect(resolveEventCategory({ family: 'lore-revelation' })).toBe('hidden-discoveries')
  })

  it('rejects a status or a null category supplied as a category', () => {
    for (const category of ['scheduled', null]) {
      const malformed = { ...definition(), category } as unknown as PersistentEventDefinition
      expect(() => validatePersistentEventDefinition(malformed)).toThrow(/category/i)
    }
  })

  it('accepts typed scoped multi-phase definitions', () => {
    expect(() => validatePersistentEventDefinition(definition())).not.toThrow()
  })

  it('restricts weather to known conditions on real World Arrivals', () => {
    const event = definition()
    const first = event.phases[0]!
    const original = first.objectives[0]!
    const validate = (objective: object) =>
      validatePersistentEventDefinition({
        ...event,
        phases: [{ ...first, objectives: [{ ...original, ...objective }] }, event.phases[1]!],
      })
    const arrival = {
      completion: 'world-arrival',
      worldNavigation: { sectorId: 'frostmere', x: 3, y: 4, autoPath: true, guidance: 'exact' },
    }
    expect(() => validate({ ...arrival, requiredWeather: 'snow' })).toThrow(/weather/i)
    expect(() => validate({ ...arrival, requiredWeather: null })).toThrow(/weather/i)
    expect(() => validate({ ...arrival, requiredWeather: ['rain'] })).toThrow(/weather/i)
    expect(() => validate({ requiredWeather: 'rain' })).toThrow(/weather/i)
    expect(() => validate({ ...arrival, requiredWeather: 'rain' })).not.toThrow()
    expect(() => validate(arrival)).not.toThrow()
  })

  it('rejects arbitrary effect kinds and unknown objective transition references', () => {
    const invalidEffect = cloneDefinition()
    invalidEffect.phases[0].effects[0].type = 'script'
    expect(() => validateMalformedFixture(invalidEffect)).toThrow(/effect type/i)

    const invalidTransition = cloneDefinition()
    invalidTransition.phases[0].transition.objectiveId = 'missing'
    expect(() => validateMalformedFixture(invalidTransition)).toThrow(/same phase/i)
  })

  it('rejects a transition tied to an objective from another phase', () => {
    const invalid = cloneDefinition()
    invalid.phases[1].transition = { type: 'objective-threshold', objectiveId: 'survey' }
    expect(() => validateMalformedFixture(invalid)).toThrow(/same phase/i)
  })

  it('enforces the approved lifecycle transition graph', () => {
    expect(() => assertEventRunTransition('scheduled', 'live')).not.toThrow()
    expect(() => assertEventRunTransition('live', 'paused')).not.toThrow()
    expect(() => assertEventRunTransition('paused', 'resolving')).not.toThrow()
    expect(() => assertEventRunTransition('resolving', 'ended')).not.toThrow()
    expect(() => assertEventRunTransition('ended', 'archived')).not.toThrow()
    expect(() => assertEventRunTransition('ended', 'emergency-stopped')).not.toThrow()
    expect(() => assertEventRunTransition('archived', 'live')).toThrow(/cannot transition/i)
  })
})
