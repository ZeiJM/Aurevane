import { appendFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'
import { CHARACTER_ATTRIBUTE_IDS } from '@aurevane/game-core/character/creation'
import {
  foundationDisciplineAttributePolicy,
  attributePointPoolForLevel,
  validateAttributeAllocation,
} from '@aurevane/game-core/character/attribute-allocation'
import * as builders from './roster-legal-build.test-utils'
import {
  createLegalRosterDuel,
  legalRosterCycleKits,
  playLegalRosterDuel,
} from './roster-legal-duel.test-utils'

vi.mock('server-only', () => ({}))
// Only initial persisted-character input changes. Admission, derived profiles,
// learned loadouts, AI and every combat transition use the real shared path.
const original = builders.fixture
vi.spyOn(builders, 'fixture').mockImplementation((kit, level, identity) => {
  const f = original(kit, level, identity)
  if (level !== 100) return f
  const policy = foundationDisciplineAttributePolicy(kit.primary)!
  const offense = kit.primary === 'dawnshield' ? 'intellect' : 'might'
  const attributes = { ...policy.baseAttributes, vitality: 40, [offense]: 40 }
  let remaining =
    attributePointPoolForLevel(level) -
    CHARACTER_ATTRIBUTE_IDS.reduce((sum, id) => sum + attributes[id], 0)
  while (remaining > 0)
    for (const id of CHARACTER_ATTRIBUTE_IDS) {
      if (!remaining) break
      if (attributes[id] >= 40 || attributes[id] >= (policy.attributeCaps[id] ?? 40)) continue
      attributes[id]++
      remaining--
    }
  expect(validateAttributeAllocation({ attributes, level, policy, requireFullPool: true })).toEqual(
    [],
  )
  return { ...f, character: { ...f.character, attributes } }
})

it.each(
  legalRosterCycleKits.filter(
    (kit) => !kit.secondary && ['bastion', 'wildwarden', 'dawnshield'].includes(kit.primary),
  ),
)(
  '$name offense40/Vitality40 mirror reaches a natural result within the defensive pacing ceiling',
  async (kit) => {
    const duel = await createLegalRosterDuel({ kit, level: 100, context: 'pvp', seed: 12345 })
    // This immutable October10 benchmark used Guard v1, not today's HP Recovery default.
    expect(duel.state.supportActionPolicyVersion).toBeUndefined()
    for (const p of duel.participants) {
      expect(p.committed.supportActionId).toBe('basic.guard')
      const support = p.sources.find(
        (source) => source.basic && !['basic.move', 'unarmed.basic'].includes(source.abilityId),
      )
      expect(support?.basic).toMatchObject({ id: 'basic.guard', contentVersion: 1, enabled: true })
      expect(p.character.attributes.vitality).toBe(40)
      expect(p.character.attributes[kit.primary === 'dawnshield' ? 'intellect' : 'might']).toBe(40)
    }
    const before = JSON.stringify(duel.state)
    const result = playLegalRosterDuel(duel, { maximumRounds: 24 })
    expect(result.errors).toEqual([])
    expect(JSON.stringify(duel.state)).toBe(before)
    const b = result.state.tactical.battle
    if (process.env.AUREVANE_DEFENSIVE_PACING_EVIDENCE)
      appendFileSync(
        process.env.AUREVANE_DEFENSIVE_PACING_EVIDENCE,
        JSON.stringify({
          kit: kit.name,
          supportActionId: duel.participants[0]!.committed.supportActionId,
          seed: 12345,
          level: 100,
          context: 'pvp',
          horizon: 24,
          attributes: duel.participants.map((p) => p.character.attributes),
          round: b.round,
          lifecycle: b.lifecycle,
          combatants: b.combatants.map((c) => ({
            id: c.id,
            hp: c.hp,
            maxHp: c.maxHp,
            mp: c.mp,
            maxMp: c.maxMp,
          })),
          commands: result.commands,
          events: result.events,
        }) + '\n',
      )
    expect(b.lifecycle).toBe('completed')
    expect(b.round).toBeLessThanOrEqual(24)
    expect(b.combatants.some((c) => c.hp === 0)).toBe(true)
    expect(
      result.events.some(
        (e) => e && typeof e === 'object' && 'event' in e && e.event === 'battle_completed',
      ),
    ).toBe(true)
    if (kit.primary === 'dawnshield')
      expect(result.commands.some((c) => c.abilityId === 'dawnshield.judgment')).toBe(true)
  },
  120000,
)

// Explicit counterfactual: the new default is an intentional Support choice, not a change
// to this archived benchmark's damage, timing, AI or 24-round completion requirement.
it('isolates the HP Recovery choice under the same archived Bastion mirror rules', async () => {
  const kit = legalRosterCycleKits.find((row) => !row.secondary && row.primary === 'bastion')!
  const duel = await createLegalRosterDuel({
    kit: { ...kit, supportActionId: 'basic.recover' },
    level: 100,
    context: 'pvp',
    seed: 12345,
  })
  expect(duel.state.supportActionPolicyVersion).toBeUndefined()
  for (const participant of duel.participants) {
    expect(participant.committed.supportActionId).toBe('basic.recover')
    expect(
      participant.sources.find((source) => source.abilityId === 'basic.recover')?.basic,
    ).toMatchObject({ contentVersion: 1, enabled: true })
    expect(participant.sources.some((source) => source.abilityId === 'basic.guard')).toBe(false)
  }
  const result = playLegalRosterDuel(duel, { maximumRounds: 24 })
  expect(result.errors).toEqual([])
  expect(result.commands.some((command) => command.abilityId === 'basic.recover')).toBe(true)
  expect(result.commands.some((command) => command.abilityId === 'basic.guard')).toBe(false)
  if (process.env.AUREVANE_DEFENSIVE_PACING_EVIDENCE)
    appendFileSync(
      process.env.AUREVANE_DEFENSIVE_PACING_EVIDENCE,
      JSON.stringify({
        kit: kit.name,
        supportActionId: 'basic.recover',
        seed: 12345,
        horizon: 24,
        round: result.state.tactical.battle.round,
        lifecycle: result.state.tactical.battle.lifecycle,
        commands: result.commands,
      }) + '\n',
    )
}, 120000)
