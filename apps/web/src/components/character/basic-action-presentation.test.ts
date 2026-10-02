import { describe, expect, it } from 'vitest'
import {
  basicActionCharacteristicRows,
  basicActionEffectExplanation,
  basicActionIdForCommand,
} from './basic-action-presentation'

const values = (id: Parameters<typeof basicActionCharacteristicRows>[0]) =>
  Object.fromEntries(basicActionCharacteristicRows(id))

describe('authoritative inherent action descriptors', () => {
  it('shows Guard mitigation, expiration and stack cap with its independent cooldown', () => {
    const guard = values('basic.guard')
    expect(guard['Skill Type']).toBe('Utility')
    expect(guard.Cost).toBe('30 AP')
    expect(guard.Cooldown).toBe('2 turns')
    expect(guard.Effects).toBe('Guarded [15%] [2 Turns]')
    expect(guard.Effects).toContain('2 Turns')
    expect(basicActionEffectExplanation('basic.guard')).toContain('maximum 3 stacks')
    expect(guard.Target).toBe('Self')
    expect(guard.Range).toBe('N/A')
    expect(guard['Target Elevation']).toBe('N/A')
    expect(guard['Line of Sight']).toBe('N/A')
  })

  it('keeps HP and MP recovery requirements distinct and shares their cooldown', () => {
    const hp = values('basic.recover')
    const mp = values('basic.recover.mp')
    expect(hp.Requirements).toBe('HP ≤ 99.99%')
    expect(mp.Requirements).toBe('Missing MP')
    expect(hp.Cooldown).toBe('2 turns')
    expect(mp.Cooldown).toBe(hp.Cooldown)
    expect(hp.Effects).toBe('HP Recovery [10% max HP] [Immediate]')
    expect(mp.Effects).toBe('MP Recovery [10% max MP] [Immediate]')
    expect(hp.Effects).toContain('[Immediate]')
    expect(basicActionEffectExplanation('basic.recover.mp')).toContain('share a cooldown')
  })

  it('uses the Basic Attack targeting contract and current physical power coefficient', () => {
    const attack = values('basic.attack.unarmed.basic')
    expect(attack['Skill Type']).toBe('Attack')
    expect(attack.Effects).toContain('6 + floor(15% Physical Power)')
    expect(attack.Range).toBe('1')
    expect(attack.Target).toBe('Enemy')
    expect(attack['Target Method']).toBe('Single')
    expect(attack['Target Elevation']).toBe('1')
    expect(attack['Line of Sight']).toBe('Not required')
    expect(attack.Cooldown).toBe('None')
  })

  it('states movement limits without treating spare AP as unlimited movement or hardcoding Jump', () => {
    const move = values('basic.move')
    expect(move.Cost).toContain('20 AP per terrain-cost point')
    expect(move.Range).toBe('Remaining Movement allowance')
    expect(move.Effects).toContain('1 Movement per entered tile')
    expect(move.Requirements).toContain('no movement-blocking status')
    expect(move['Target Elevation']).toContain('committed Jump / movement profile')
    expect(move['Target Elevation']).not.toBe('1')
  })

  it('recognizes the saved Support Action name without creating basic rules for other Skills', () => {
    expect(basicActionIdForCommand('guard', 'MP Recovery')).toBe('basic.recover.mp')
    expect(basicActionIdForCommand('attack', 'Forceful Strike')).toBeNull()
    expect(basicActionIdForCommand('finish', 'Guard')).toBeNull()
  })
})
