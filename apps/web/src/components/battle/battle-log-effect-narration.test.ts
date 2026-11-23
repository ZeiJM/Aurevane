import { describe, expect, it } from 'vitest'
import type { BattleLogEntry } from '@/server/battle/battle-log-service'
import { narrateBattleEffect } from './battle-log-effect-narration'

function entry(
  statusId: string,
  effectStrength?: BattleLogEntry['effectStrength'],
): BattleLogEntry {
  return {
    battleVersion: 1,
    eventIndex: 0,
    occurredAt: '2026-11-02T00:00:00.000Z',
    eventType: 'status_applied',
    message: '',
    messageTemplate: '',
    templateValues: {},
    actorCombatantId: 'source',
    targetCombatantId: 'target',
    actionId: null,
    actionLabel: null,
    statusId,
    effectStrength,
    round: 1,
    turnNumber: 1,
    kind: 'status',
    headline: '',
    tone: 'neutral',
    facts: [],
  }
}

const examples: {
  id: string
  strength?: BattleLogEntry['effectStrength']
  active: string
  pending: string
}[] = [
  {
    id: 'suppress',
    strength: { potencyBasisPoints: 12500 },
    active: "Suppress cuts Recruit's direct damage by 125%",
    pending: "Suppress will cut Recruit's direct damage by 125%",
  },
  {
    id: 'blind',
    strength: { potencyBasisPoints: 10000 },
    active: "Blind cuts Recruit's Accuracy by 100 percentage points",
    pending: "Blind will cut Recruit's Accuracy by 100 percentage points",
  },
  {
    id: 'mark',
    strength: { potencyBasisPoints: 1534 },
    active: "Marked boosts its source's Accuracy against Recruit by 15.34 percentage points",
    pending: "Marked will boost its source's Accuracy against Recruit by 15.34 percentage points",
  },
  {
    id: 'inspired',
    strength: { potencyBasisPoints: 2534 },
    active: "Damage Up boosts Recruit's damage by 25.34%",
    pending: "Damage Up will boost Recruit's damage by 25.34%",
  },
  {
    id: 'guarded',
    strength: { potencyBasisPoints: 10000 },
    active: "Guard cuts Recruit's damage taken by 100%",
    pending: "Guard will cut Recruit's damage taken by 100%",
  },
  {
    id: 'hexed',
    strength: { potencyBasisPoints: 2534 },
    active: "Healing Down cuts Recruit's HP and MP recovery by 25.34%",
    pending: "Healing Down will cut Recruit's HP and MP recovery by 25.34%",
  },
  {
    id: 'lowered-guard',
    strength: { damageTakenMultiplierBasisPoints: 14567 },
    active: 'Defenseless makes Recruit take 145.67% of normal damage',
    pending: 'Defenseless will make Recruit take 145.67% of normal damage',
  },
  {
    id: 'exposed',
    strength: { potencyBasisPoints: 2534 },
    active: "Vulnerable boosts Recruit's damage taken by 25.34%",
    pending: "Vulnerable will boost Recruit's damage taken by 25.34%",
  },
  {
    id: 'marked',
    strength: { potencyBasisPoints: 2534 },
    active: "Marked boosts Recruit's damage taken from its source by 25.34%",
    pending: "Marked will boost Recruit's damage taken from its source by 25.34%",
  },
  {
    id: 'conductive',
    strength: { potencyBasisPoints: 3525 },
    active: "Conductive boosts Recruit's Storm damage taken by 35.25%",
    pending: "Conductive will boost Recruit's Storm damage taken by 35.25%",
  },
  {
    id: 'wet',
    strength: { potencyBasisPoints: 3525, initiativeReductionBasisPoints: 1200 },
    active: "Drenched cuts Recruit's Initiative by 12% and boosts Storm damage taken by 35.25%",
    pending: "Drenched will cut Recruit's Initiative by 12% and boost Storm damage taken by 35.25%",
  },
  {
    id: 'haste',
    strength: { movementApAdjustment: 7 },
    active: "Haste cuts Recruit's movement cost by 7 AP per tile",
    pending: "Haste will cut Recruit's movement cost by 7 AP per tile",
  },
  {
    id: 'slow',
    strength: { movementApAdjustment: 3 },
    active: "Slow raises Recruit's movement cost by 3 AP per tile",
    pending: "Slow will raise Recruit's movement cost by 3 AP per tile",
  },
  {
    id: 'root',
    active: "Rooted locks Recruit's movement",
    pending: "Rooted will lock Recruit's movement",
  },
  {
    id: 'frozen',
    active: "Chilled locks Recruit's final facing",
    pending: "Chilled will lock Recruit's final facing",
  },
  {
    id: 'invisible',
    active: 'Recruit becomes Invisible',
    pending: 'Recruit will become Invisible',
  },
  {
    id: 'covert',
    active: "Covert hides Recruit's beneficial effects",
    pending: "Covert will hide Recruit's beneficial effects",
  },
  {
    id: 'airborne',
    active: 'Recruit becomes Airborne',
    pending: 'Recruit will become Airborne',
  },
  {
    id: 'burn',
    active: 'Recruit starts burning',
    pending: 'Recruit will start burning',
  },
  {
    id: 'poison',
    active: 'Recruit is poisoned',
    pending: 'Recruit will be poisoned',
  },
  {
    id: 'bleed',
    active: 'Recruit starts bleeding',
    pending: 'Recruit will start bleeding',
  },
  {
    id: 'warded',
    strength: { potencyBasisPoints: 12500 },
    active: "Burn Ward cuts Recruit's damage taken from burning opponents by 125%",
    pending: "Burn Ward will cut Recruit's damage taken from burning opponents by 125%",
  },
  {
    id: 'challenged',
    strength: { potencyBasisPoints: 10000 },
    active: "Taunt cuts Recruit's damage against anyone except its source by 100%",
    pending: "Taunt will cut Recruit's damage against anyone except its source by 100%",
  },
  {
    id: 'reckless',
    strength: { potencyBasisPoints: 12345 },
    active: "Reckless boosts Recruit's damage dealt and taken by 123.45%",
    pending: "Reckless will boost Recruit's damage dealt and taken by 123.45%",
  },
  {
    id: 'fortified',
    strength: { defenseIncreaseBasisPoints: 12345 },
    active:
      "Fortified boosts Recruit's Physical and Mystic Defense by 123.45% and cuts damage dealt by 123.45%",
    pending:
      "Fortified will boost Recruit's Physical and Mystic Defense by 123.45% and cut damage dealt by 123.45%",
  },
  {
    id: 'revealed',
    strength: { increasedDamageTakenBasisPoints: 1534 },
    active: 'Recruit is Revealed and takes 15.34% more damage',
    pending: 'Recruit will be Revealed and take 15.34% more damage',
  },
  {
    id: 'counter',
    strength: { counter: { kind: 'mystic', basisPoints: 12500 } },
    active: 'Magical Reflect returns 125% of Mystic HP damage taken by Recruit',
    pending: 'Magical Reflect will return 125% of Mystic HP damage taken by Recruit',
  },
  {
    id: 'blindside',
    strength: { blindsideModifiersBasisPoints: { side: 16000, rear: 22000 } },
    active: "Blindside boosts Recruit's side/rear Skill damage dealt to 160%/220% of normal",
    pending: "Blindside will boost Recruit's side/rear Skill damage dealt to 160%/220% of normal",
  },
  {
    id: 'blindside-vulnerability',
    strength: { blindsideModifiersBasisPoints: { side: 16000, rear: 22000 } },
    active: "Blindside boosts Recruit's side/rear Skill damage taken to 160%/220% of normal",
    pending: "Blindside will boost Recruit's side/rear Skill damage taken to 160%/220% of normal",
  },
  {
    id: 'endure',
    strength: { endureReleaseBasisPoints: 80000 },
    active:
      "Endure locks Recruit's attacks and stores received damage for an 800% burst after 2 turns",
    pending:
      "Endure will lock Recruit's attacks and store received damage for an 800% burst after 2 turns",
  },
]

describe('concise committed battle effect narration', () => {
  it.each(examples)(
    '$id describes the exact active and pending application',
    ({ id, strength, active, pending }) => {
      expect(narrateBattleEffect(entry(id, strength), 'Recruit', false, '2 turns')).toBe(active)
      expect(narrateBattleEffect(entry(id, strength), 'Recruit', true, '2 turns')).toBe(pending)
    },
  )

  it.each([
    ['physical', 'Physical', 6525],
    ['full', 'all', 99900],
  ] as const)(
    'preserves %s Reflect shares as percentages of received HP damage',
    (kind, family, basisPoints) => {
      expect(
        narrateBattleEffect(entry('counter', { counter: { kind, basisPoints } }), 'Recruit'),
      ).toBe(
        `${kind === 'physical' ? 'Physical' : 'Full'} Reflect returns ${basisPoints / 100}% of ${family} HP damage taken by Recruit`,
      )
    },
  )

  it.each([
    ['blind', "Blind cuts Recruit's Accuracy"],
    ['suppress', "Suppress cuts Recruit's direct damage"],
    ['haste', "Haste cuts Recruit's movement cost per tile"],
    ['wet', "Drenched boosts Recruit's Storm damage taken"],
    ['counter', 'Reflect returns matching HP damage taken by Recruit to its source'],
    ['blindside', "Blindside boosts Recruit's side/rear Skill damage dealt"],
    ['fortified', "Fortified boosts Recruit's defenses and cuts damage dealt"],
    ['reckless', "Reckless boosts Recruit's damage dealt and taken"],
    [
      'endure',
      "Endure locks Recruit's attacks and stores received damage for a burst when it expires",
    ],
  ])('keeps %s without recorded strength qualitative', (id, expected) => {
    expect(narrateBattleEffect(entry(id), 'Recruit')).toBe(expected)
  })

  it('does not manufacture a missing Initiative reduction or overwrite a zero movement adjustment', () => {
    expect(narrateBattleEffect(entry('wet', { potencyBasisPoints: 3525 }), 'Recruit')).toBe(
      "Drenched boosts Recruit's Storm damage taken by 35.25%",
    )
    expect(narrateBattleEffect(entry('haste', { movementApAdjustment: 0 }), 'Recruit')).toBe(
      "Haste cuts Recruit's movement cost by 0 AP per tile",
    )
  })

  it('uses only visible committed fields and never substitutes source identity or message text', () => {
    expect(
      narrateBattleEffect(
        {
          ...entry('blind'),
          message: 'secret',
          templateValues: { potencyBasisPoints: '99900', source: 'secret' },
        },
        'Recruit',
      ),
    ).toBe("Blind cuts Recruit's Accuracy")
    expect(
      narrateBattleEffect(
        { ...entry('blind', { potencyBasisPoints: 10000 }), targetCombatantId: null },
        'Recruit',
      ),
    ).toBeNull()
    expect(narrateBattleEffect(entry('lowered-guard'), 'Recruit')).toBeNull()
    expect(narrateBattleEffect(entry('unknown'), 'Recruit')).toBeNull()
  })

  it('preserves the legacy committed Suppress strength field', () => {
    expect(narrateBattleEffect({ ...entry('suppress'), potencyBasisPoints: 3525 }, 'Recruit')).toBe(
      "Suppress cuts Recruit's direct damage by 35.25%",
    )
  })
})
