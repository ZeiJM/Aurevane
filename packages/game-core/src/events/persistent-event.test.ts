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

  it('allows a reward-free repeatable travel journey only with explicit supported recurrence', () => {
    const base = definition()
    const repeatable = {
      ...base,
      category: 'repeatable-activities',
      scope: { type: 'region', key: 'verdant-expanse' },
      phases: [
        {
          id: 'trail',
          name: 'Trail',
          transition: { type: 'manual' },
          objectives: [],
          effects: [],
          cleanupEffects: [],
        },
      ],
      rewardPackageRefs: [],
      aftermathRefs: [],
      repeatableTravel: {
        journey: {
          type: 'travel-and-report',
          giverId: 'eastern-watch-officer',
          destination: { sectorId: 'verdant-expanse', x: 3, y: 4 },
          offer: 'Walk there.',
          active: 'Continue.',
          ready: 'Report.',
          completed: 'Thank you.',
        },
        recurrence: { mode: 'calendar-day', timeZone: 'America/Port_of_Spain', resetMinute: 240 },
      },
    } as const
    const validate = (patch: object) =>
      validatePersistentEventDefinition({ ...repeatable, ...patch })
    expect(() => validate({})).not.toThrow()
    expect(() => validate({ category: 'story-campaigns' })).toThrow(/repeatable/i)
    expect(() => validate({ rewardPackageRefs: ['reward.unsupported'] })).toThrow(/reward/i)
    expect(() =>
      validate({
        repeatableTravel: { ...repeatable.repeatableTravel, recurrence: { mode: 'calendar-day' } },
      }),
    ).toThrow(/timezone/i)
    expect(() =>
      validate({
        repeatableTravel: { ...repeatable.repeatableTravel, recurrence: { mode: 'rolling-24h' } },
      }),
    ).not.toThrow()
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

const hiddenDiscovery = () =>
  ({
    ...definition(),
    category: 'hidden-discoveries',
    scope: { type: 'global' },
    phases: [
      {
        id: 'discover',
        name: 'Discovery',
        objectives: [],
        effects: [],
        cleanupEffects: [],
        transition: { type: 'manual' },
      },
    ],
    rewardPackageRefs: [],
    aftermathRefs: [],
    inventoryDiscovery: {
      firstItemId: 'fixture.fragment-one',
      secondItemId: 'fixture.fragment-two',
      clue: 'The fragments fit together.',
    },
  }) satisfies PersistentEventDefinition

const recovery = {
  giverNpcId: '77777777-7777-4777-8777-777777777777',
  checkpoint: { sectorId: 'verdant-expanse', x: 3, y: 4 },
  outputItemId: 'fixture.restored-sword',
  offer: 'Choose the recovery route to restore the blade.',
  travel: 'Follow the route and return with both fragments.',
  ready: 'Bring both fragments to the forge.',
  completed: 'The blade is restored.',
}

const restorationDiscovery = (): PersistentEventDefinition => {
  const event = hiddenDiscovery()
  return { ...event, inventoryDiscovery: { ...event.inventoryDiscovery, restoration: recovery } }
}

it('validates a private carried-Item discovery without enabling rewards or public phases', () => {
  const hidden = hiddenDiscovery()
  expect(() => validatePersistentEventDefinition(hidden)).not.toThrow()
  expect(() =>
    validatePersistentEventDefinition({
      ...hidden,
      inventoryDiscovery: { ...hidden.inventoryDiscovery, secondItemId: 'fixture.fragment-one' },
    }),
  ).toThrow('Choose two different carried Item identities')
  expect(() =>
    validatePersistentEventDefinition({
      ...hidden,
      scope: { type: 'region', key: 'verdant-expanse' },
    }),
  ).toThrow('requires a global Hidden Discovery')
  expect(() =>
    validatePersistentEventDefinition({ ...hidden, rewardPackageRefs: ['reward.fixture'] }),
  ).toThrow('no shared effects or rewards')
})

it('accepts the authored recovery route and its distinct sword in a private discovery', () => {
  expect(() => validatePersistentEventDefinition(restorationDiscovery())).not.toThrow()
})

it.each([
  ['null restoration', null],
  ['array restoration', [recovery]],
  ['an unsupported restoration field', { ...recovery, combatTrial: {} }],
  [
    'a giver that is not an authored NPC UUID',
    { ...recovery, giverNpcId: 'eastern-watch-officer' },
  ],
  ['an output with a malformed Item identity', { ...recovery, outputItemId: 'fixture.Sword' }],
  ['the first fragment as the output', { ...recovery, outputItemId: 'fixture.fragment-one' }],
  ['the second fragment as the output', { ...recovery, outputItemId: 'fixture.fragment-two' }],
  ['an absent checkpoint', { ...recovery, checkpoint: undefined }],
  ['a malformed sector', { ...recovery, checkpoint: { ...recovery.checkpoint, sectorId: 'A' } }],
  ['a cell outside the grid', { ...recovery, checkpoint: { ...recovery.checkpoint, x: 13 } }],
  ['a fractional cell', { ...recovery, checkpoint: { ...recovery.checkpoint, y: 4.5 } }],
  [
    'an extra checkpoint field',
    { ...recovery, checkpoint: { ...recovery.checkpoint, autoPath: true } },
  ],
  ['missing travel dialogue', { ...recovery, travel: undefined }],
  ['untrimmed offer dialogue', { ...recovery, offer: ' Offer ' }],
  ['overlong completion dialogue', { ...recovery, completed: 'x'.repeat(801) }],
])('rejects %s for the recovery route', (_label, restoration) => {
  const hidden = hiddenDiscovery()
  const candidate = {
    ...hidden,
    inventoryDiscovery: { ...hidden.inventoryDiscovery, restoration },
  } as unknown as PersistentEventDefinition
  expect(() => validatePersistentEventDefinition(candidate)).toThrow(/restoration/i)
})

it('preserves hidden scope and forbids shared phases or rewards for restoration', () => {
  const hidden = restorationDiscovery()
  for (const candidate of [
    { ...hidden, category: 'story-campaigns' as const },
    { ...hidden, scope: { type: 'region', key: 'verdant-expanse' } as const },
    { ...hidden, phases: [...hidden.phases, { ...hidden.phases[0]!, id: 'another-phase' }] },
    { ...hidden, rewardPackageRefs: ['reward.fixture'] },
    { ...hidden, aftermathRefs: ['aftermath.fixture'] },
  ]) {
    expect(() => validatePersistentEventDefinition(candidate)).toThrow(
      'requires a global Hidden Discovery',
    )
  }
})
