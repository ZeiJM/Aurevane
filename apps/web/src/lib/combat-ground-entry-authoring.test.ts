import { expect, it } from 'vitest'
import { withRemappedGroundEntries } from './combat-ground-entry-authoring'
it('keeps native Ground entries on the same effects through removal and reordering', () => {
  const hit = { type: 'damage' },
    poison = { type: 'poison' },
    buff = { type: 'apply-status' }
  const previous = {
    effects: [hit, poison, buff],
    groundArea: {
      durationRounds: 2,
      visualPresetId: 'arcane-pulse' as const,
      entryEffectOrdinals: [0, 1],
    },
  }
  expect(
    withRemappedGroundEntries(previous, { ...previous, effects: [buff, poison] }).groundArea
      ?.entryEffectOrdinals,
  ).toEqual([1])
  expect(
    withRemappedGroundEntries(previous, { ...previous, effects: [buff] }).groundArea,
  ).toBeUndefined()
})
