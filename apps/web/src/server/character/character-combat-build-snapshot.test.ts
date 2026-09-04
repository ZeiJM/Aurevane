import { describe, expect, it, vi } from 'vitest'

import type { CharacterCommittedBuildSnapshotRecord } from './character-build-service'
import { toCombatBuildSnapshot } from './character-combat-build-snapshot'

vi.mock('server-only', () => ({}))

function pureCommitted(
  overrides: Partial<CharacterCommittedBuildSnapshotRecord> = {},
): CharacterCommittedBuildSnapshotRecord {
  return {
    schemaVersion: 2,
    buildVersion: 7,
    primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
    secondary: null,
    disciplineSkills: [
      {
        slotIndex: 2,
        skillId: 'skill.vanguard.hold-the-line',
        contentVersion: 1,
        sourceDisciplineId: 'vanguard',
      },
      {
        slotIndex: 1,
        skillId: 'skill.vanguard.forceful-strike',
        contentVersion: 1,
        sourceDisciplineId: 'vanguard',
      },
    ],
    extensions: {
      resonance: null,
      essence: {
        essenceId: 'essence.vanguard.unbroken-strike',
        contentVersion: 1,
        sourceDisciplineId: 'vanguard',
        skillId: 'essence.vanguard.unbroken-strike',
        skillContentVersion: 1,
      },
      equipmentSkills: [],
      supernatural: null,
      prestige: null,
    },
    ...overrides,
  }
}

describe('P3.7 character combat build snapshot mapping', () => {
  it('produces a deterministic immutable combat identity from the committed build', () => {
    const committed = pureCommitted()
    const first = toCombatBuildSnapshot(committed)
    const second = toCombatBuildSnapshot(pureCommitted())

    expect(first).toEqual(second)
    expect(first.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(first.sourceBuildSchemaVersion).toBe(2)
    expect(first.sourceBuildVersion).toBe(7)
    expect(first.disciplineSkills.map((skill) => skill.slotIndex)).toEqual([1, 2])
    expect(first.primary).not.toBe(committed.primary)
    expect(first.extensions.essence).not.toBe(committed.extensions.essence)
  })

  it('changes the fingerprint when authoritative build identity changes', () => {
    const baseline = toCombatBuildSnapshot(pureCommitted())
    const changedVersion = toCombatBuildSnapshot(pureCommitted({ buildVersion: 8 }))
    const changedSkill = toCombatBuildSnapshot(
      pureCommitted({
        disciplineSkills: [
          {
            slotIndex: 1,
            skillId: 'skill.vanguard.forceful-strike',
            contentVersion: 2,
            sourceDisciplineId: 'vanguard',
          },
        ],
      }),
    )

    expect(changedVersion.fingerprint).not.toBe(baseline.fingerprint)
    expect(changedSkill.fingerprint).not.toBe(baseline.fingerprint)
  })

  it('fails closed instead of emitting a mixed combat snapshot with pure Essence', () => {
    expect(() =>
      toCombatBuildSnapshot(
        pureCommitted({ secondary: { disciplineId: 'lifebinder', definitionVersion: 1 } }),
      ),
    ).toThrow('The committed combat build is invalid: Mixed builds cannot carry Essence.')
  })
})
