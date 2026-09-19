import { describe, expect, it } from 'vitest'

import {
  assertEventRunTransition,
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

const cloneDefinition = (): any => JSON.parse(JSON.stringify(definition()))

describe('persistent event definition', () => {
  it('accepts typed scoped multi-phase definitions', () => {
    expect(() => validatePersistentEventDefinition(definition())).not.toThrow()
  })

  it('rejects arbitrary effect kinds and unknown objective transition references', () => {
    const invalidEffect = cloneDefinition()
    invalidEffect.phases[0].effects[0].type = 'script'
    expect(() => validatePersistentEventDefinition(invalidEffect)).toThrow(/effect type/i)

    const invalidTransition = cloneDefinition()
    invalidTransition.phases[0].transition.objectiveId = 'missing'
    expect(() => validatePersistentEventDefinition(invalidTransition)).toThrow(/same phase/i)
  })

  it('rejects a transition tied to an objective from another phase', () => {
    const invalid = cloneDefinition()
    invalid.phases[1].transition = { type: 'objective-threshold', objectiveId: 'survey' }
    expect(() => validatePersistentEventDefinition(invalid)).toThrow(/same phase/i)
  })

  it('enforces the approved lifecycle transition graph', () => {
    expect(() => assertEventRunTransition('scheduled', 'live')).not.toThrow()
    expect(() => assertEventRunTransition('live', 'paused')).not.toThrow()
    expect(() => assertEventRunTransition('paused', 'resolving')).not.toThrow()
    expect(() => assertEventRunTransition('resolving', 'ended')).not.toThrow()
    expect(() => assertEventRunTransition('ended', 'archived')).not.toThrow()
    expect(() => assertEventRunTransition('archived', 'live')).toThrow(/cannot transition/i)
  })
})
