import { describe, expect, it } from 'vitest'
import { basicActionCharacteristicRows, basicActionIdForCommand } from './basic-action-presentation'

const values = (id: Parameters<typeof basicActionCharacteristicRows>[0]) =>
  Object.fromEntries(basicActionCharacteristicRows(id))

describe('authoritative inherent action descriptors', () => {
  it('shows Guard mitigation, expiration and stack cap without assigning a cooldown', () => {
    const guard = values('basic.guard')
    expect(guard['Skill Type']).toBe('Utility')
    expect(guard.Cost).toBe('30 AP')
    expect(guard.Cooldown).toBe('None')
    expect(guard.Effects).toContain('15% less incoming damage')
    expect(guard.Effects).toContain('2 Turns')
    expect(guard.Effects).toContain('maximum 3')
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
    expect(hp.Cooldown).toBe('2 owner turns, shared by HP / MP Recovery')
    expect(mp.Cooldown).toBe(hp.Cooldown)
    expect(hp.Effects).toContain('10% maximum HP')
    expect(mp.Effects).toContain('10% maximum MP')
    expect(hp.Effects).toContain('[Immediate]')
    expect(mp.Effects).toContain('minimum 1, capped at maximum')
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
