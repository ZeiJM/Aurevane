import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { validateResonanceDefinition } from './resonance'
import type { AnyResonanceDefinition } from './resonance'

const candidate = JSON.parse(
  readFileSync(
    new URL(
      '../../../../docs/verification/release-assets/2026-10-22-resonance-quality-candidate.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as {
  inventoryCount: number
  retainedCount: number
  revisedCount: number
  review: readonly { id: string; decision: string }[]
  changes: readonly {
    id: string
    previousVersion: number
    afterVersion: number
    before: AnyResonanceDefinition
    after: AnyResonanceDefinition
  }[]
}

describe('published Resonance quality cohort', () => {
  it('reviews each of 136 pairs, with one decision and no unrelated Skill or Essence edits', () => {
    expect(candidate.inventoryCount).toBe(136)
    expect(candidate.review).toHaveLength(136)
    expect(new Set(candidate.review.map((row) => row.id)).size).toBe(136)
    expect(candidate.revisedCount + candidate.retainedCount).toBe(136)
    expect(candidate.changes).toHaveLength(candidate.revisedCount)
  })

  it.each(candidate.changes)(
    '$id retains exact history and declares valid modular native combat',
    ({ id, previousVersion, afterVersion, before, after }) => {
      expect(after.id).toBe(id)
      expect(after.contentVersion).toBe(previousVersion + 1)
      expect(afterVersion).toBe(after.contentVersion)
      expect(before.contentVersion).toBe(previousVersion)
      expect(after.disciplinePair).toEqual(before.disciplinePair)
      expect(after.media).toEqual(before.media)
      expect(after.name).toBe(before.name)
      expect(after.ability?.behaviors.length).toBe(1)
      expect(after.ability!.behaviors[0]!.activation).not.toBe('manual')
      expect(after.ability!.behaviors[0]!.effects.length).toBeGreaterThan(0)
      expect(after.ability!.behaviors[0]!.effects.length).toBeLessThanOrEqual(2)
      expect(after.ability!.behaviors[0]!.requirementMode).toBe('simple')
      if (
        ![
          'resonance.chronist-tidecaller.linked-sequence',
          'resonance.farstrider-frostweaver.linked-sequence',
          'resonance.frostweaver-ironfist.linked-sequence',
        ].includes(id)
      ) {
        expect(after.ability!.behaviors[0]!.requirements).toEqual(
          before.ability!.behaviors[0]!.requirements,
        )
      }
      expect(validateResonanceDefinition(after)).toEqual([])
    },
  )

  it.each([
    ['resonance.farstrider-frostweaver.linked-sequence', 'root', 3],
    ['resonance.frostweaver-ironfist.linked-sequence', 'frozen', 2],
  ] as const)('%s has bounded ranged automatic damage with real target legality', (id, statusId, range) => {
    const row = candidate.changes.find((entry) => entry.id === id)!
    const behavior = row.after.ability!.behaviors[0]!
    expect(behavior.mode).toBe('action')
    expect(behavior.activation).toBe('automatic')
    expect(behavior.automaticTrigger).toBe('damage-dealt')
    expect(behavior.automaticTarget).toEqual({ subject: 'affected' })
    expect(behavior.requirements).toMatchObject({
      kind: 'status-presence',
      statusId,
      subject: 'affected',
      present: true,
    })
    expect(behavior.targeting).toMatchObject({
      kind: 'unit',
      shape: { kind: 'single' },
      categories: ['enemy'],
      minimumRange: 1,
      maximumRange: range,
      requiresLineOfSight: true,
    })
    expect(behavior.costs).toEqual([{ resource: 'mp', amount: 3 }])
    expect(behavior.cooldown?.ownerTurns).toBe(3)
    expect(behavior.activationLimits).toEqual(['once-per-round', 'once-per-action'])
    expect(behavior.effects).toHaveLength(1)
    expect(behavior.effects[0]!.payload).toMatchObject({
      type: 'damage',
      amount: 3,
      recipient: 'primary-unit',
    })
  })

  it('makes Returning Current a Primed timing payoff instead of automatic cleanse, heal and Guard', () => {
    const row = candidate.changes.find(
      (entry) => entry.id === 'resonance.chronist-tidecaller.linked-sequence',
    )!
    const behavior = row.after.ability!.behaviors[0]!
    expect(behavior.requirements).toMatchObject({
      kind: 'prime-presence',
      present: true,
      subject: 'owner',
    })
    expect(behavior.costs).toEqual([])
    expect(behavior.effects).toHaveLength(1)
    expect(behavior.effects[0]?.payload).toMatchObject({
      type: 'apply-status',
      recipient: 'actor',
      statusId: 'haste',
      durationTurns: 1,
    })
  })
})
