import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import type { MasterPlayerView } from '@/master/players'
import type { CombatContentCatalogue } from '../combat/combat-content-resolver'
import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
import { readPlayerContentNames } from './player-content-names'

it('uses one current catalogue for relevant names without changing captured versions or leaking definitions', async () => {
  const player = {
    facts: {
      build: {
        disciplineSkills: [{ skillId: 'skill.custom', contentVersion: 2 }],
        extensions: {
          essence: { essenceId: 'essence.custom', contentVersion: 1 },
          resonance: { resonanceId: 'resonance.pair.linked-sequence', contentVersion: 3 },
        },
      },
    },
    learnedSkills: [
      { skillId: 'skill.custom', contentVersion: 2 },
      { skillId: 'skill.learned', contentVersion: 1 },
    ],
  } as MasterPlayerView
  const before = structuredClone(player)
  const resolveCurrentCatalogue = vi.fn(
    async () =>
      ({
        entries: [
          ['skill.custom', 'Solar Strike'],
          ['skill.learned', 'Quiet Step'],
          ['essence.custom', 'Radiant Ascension'],
          ['resonance.pair.linked-sequence', 'Golden Accord'],
          ['skill.unrelated', 'Private unrelated name'],
        ].map(([contentKey, name]) => ({
          contentKey,
          contentVersion: 9,
          definition: { name, privateNotes: 'never export' },
        })),
      }) as unknown as CombatContentCatalogue,
  )
  expect(await readPlayerContentNames(player, { resolveCurrentCatalogue })).toEqual({
    'skill.custom': 'Solar Strike',
    'skill.learned': 'Quiet Step',
    'essence.custom': 'Radiant Ascension',
    'resonance.pair.linked-sequence': 'Golden Accord',
  })
  expect(resolveCurrentCatalogue).toHaveBeenCalledTimes(1)
  expect(player).toEqual(before)
})
it('avoids loading a catalogue for a player with no content references', async () => {
  const resolveCurrentCatalogue = vi.fn()
  const player = {
    facts: { build: { disciplineSkills: [], extensions: {} } },
    learnedSkills: [],
  } as unknown as MasterPlayerView
  expect(await readPlayerContentNames(player, { resolveCurrentCatalogue })).toEqual({})
  expect(resolveCurrentCatalogue).not.toHaveBeenCalled()
})

it('resolves built-in Skill names without an authored override alongside custom names', async () => {
  const builtin = latestEnabledMatureSkills().find((skill) => skill.id === 'vanguard.cleave')!
  expect(builtin).toBeDefined()
  const player = {
    facts: { build: { disciplineSkills: [], extensions: {} } },
    learnedSkills: [{ skillId: builtin.id }, { skillId: 'skill.custom' }],
  } as unknown as MasterPlayerView
  const catalogue = {
    entries: [
      { contentKey: builtin.id, category: 'skill', definition: builtin },
      {
        contentKey: 'skill.custom',
        category: 'skill',
        definition: { ...builtin, id: 'skill.custom', name: 'Solar Strike' },
      },
      {
        contentKey: 'skill.unrelated',
        category: 'skill',
        definition: { ...builtin, id: 'skill.unrelated' },
      },
    ],
  } as unknown as CombatContentCatalogue
  expect(
    await readPlayerContentNames(player, { resolveCurrentCatalogue: async () => catalogue }),
  ).toEqual({
    'vanguard.cleave': 'Cleave',
    'skill.custom': 'Solar Strike',
  })
})
