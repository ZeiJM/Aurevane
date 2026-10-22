import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { validateResonanceDefinition } from './resonance'
import { automaticAbilityExecutionRequirements } from './combat-simple-requirements'
import type { AnyResonanceDefinition } from './resonance'

const cohort = JSON.parse(
  readFileSync(
    new URL(
      '../../../../docs/verification/release-assets/2026-10-22-resonance-trigger-fix.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as {
  changed: {
    id: string
    name: string
    previousVersion: number
    before: AnyResonanceDefinition
    after: AnyResonanceDefinition
  }[]
}

describe('Self-status Resonance automatic enemy-turn trigger repair', () => {
  it('repairs exactly the 13 affected published identities, including Red Lightning', () => {
    expect(cohort.changed).toHaveLength(13)
    expect(new Set(cohort.changed.map((row) => row.id)).size).toBe(13)
    expect(cohort.changed.map((row) => row.name)).toContain('Red Lightning')
  })

  it.each(cohort.changed)('$name activates off a real enemy turn and retains all executable effects', ({
    previousVersion,
    before,
    after,
  }) => {
    const prior = before.ability!.behaviors[0]!
    const next = after.ability!.behaviors[0]!
    expect(after.id).toBe(before.id)
    expect(after.contentVersion).toBe(previousVersion + 1)
    expect(after.disciplinePair).toEqual(before.disciplinePair)
    expect(after.media).toEqual(before.media)
    expect(next.requirements).toEqual(prior.requirements)
    expect(next.requirements).toMatchObject({
      kind: 'status-presence',
      subject: 'owner',
      present: true,
    })
    expect(prior.automaticTrigger).toBe('damage-dealt')
    expect(next.automaticTrigger).toBe('enemy-turn-ended')
    expect(next.automaticTarget).toEqual({ subject: 'triggering' })
    expect(next.activation).toBe('automatic')
    expect(next.targeting).toEqual(prior.targeting)
    expect(next.effects).toEqual(prior.effects)
    expect(next.costs).toEqual(prior.costs)
    expect(next.cooldown).toEqual(prior.cooldown)
    expect(next.activationLimits).toEqual(prior.activationLimits)
    expect(automaticAbilityExecutionRequirements(next)).toMatchObject({
      kind: 'all',
      children: expect.arrayContaining([
        { kind: 'event', eventType: 'turn_ended', phase: 'after' },
        { kind: 'subject-relation', subject: 'triggering', otherSubject: 'owner', relation: 'enemy' },
        next.requirements,
      ]),
    })
    expect(validateResonanceDefinition(after)).toEqual([])
  })
})
