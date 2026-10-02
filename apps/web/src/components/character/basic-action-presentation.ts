import {
  createPv1fBasicAttackDefinition,
  createPv1fMpRecoveryAction,
  createPv1fRecoverAction,
  PV1F_BASIC_ATTACK_BASE_DAMAGE,
  PV1F_BASIC_ATTACK_POWER_SCALING_BASIS_POINTS,
  PV1F_GUARD_ACTION,
  PV1F_GUARDED_STATUS,
  PV1F_MP_RECOVER_PERCENT,
  PV1F_RECOVER_PERCENT,
  pv1fCooldownForAction,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  PV1F_BASIC_ATTACK_ID,
  PV1F_GUARD_ACTION_ID,
  PV1F_MP_RECOVER_ACTION_ID,
  PV1F_RECOVER_ACTION_ID,
  PV1F_SKILLS,
} from '@aurevane/game-core/combat/pv1f-skills'
import { skillParameterRows } from './skill-detail-presentation'

export type BasicActionPresentationId = (typeof PV1F_SKILLS)[number]['id']
export type SkillCharacteristic = readonly [string, string | readonly string[]]

/** Inherent commands reuse Skill parameter grammar without fabricating authored Skill identities. */
export function basicActionCharacteristicRows(
  id: BasicActionPresentationId,
): readonly SkillCharacteristic[] {
  const skill = PV1F_SKILLS.find((entry) => entry.id === id)!
  if (id === 'basic.move') {
    return [
      ['Skill Type', 'Utility'],
      [
        'Cost',
        `${skill.cost.amount} AP per terrain-cost point; terrain and active movement modifiers apply`,
      ],
      ['Cooldown', 'None'],
      [
        'Requirements',
        'AP and Movement remaining; a legal, unoccupied path; no movement-blocking status',
      ],
      [
        'Effects',
        'Move along orthogonally adjacent tiles, spending AP and 1 Movement per entered tile [Immediate]',
      ],
      ['Range', 'Remaining Movement allowance'],
      ['Target', 'Empty Ground'],
      ['Target Method', 'Path'],
      ['Target Elevation', 'Each step must fit the committed Jump / movement profile'],
      ['Line of Sight', 'Not required'],
    ]
  }

  // Reference magnitudes materialize only target/requirement metadata; the Effects row displays
  // the authoritative percentage/formula rather than pretending to know character resources.
  const action =
    id === PV1F_BASIC_ATTACK_ID
      ? createPv1fBasicAttackDefinition(PV1F_BASIC_ATTACK_BASE_DAMAGE)
      : id === PV1F_GUARD_ACTION_ID
        ? PV1F_GUARD_ACTION
        : id === PV1F_RECOVER_ACTION_ID
          ? createPv1fRecoverAction(100)
          : createPv1fMpRecoveryAction(100)
  const cooldown = pv1fCooldownForAction(id)
  const rows = skillParameterRows({
    ...action,
    apCost: skill.cost.amount,
    mpCost: action.cost.mp,
    cooldown,
  })
  const effects =
    id === PV1F_GUARD_ACTION_ID
      ? `Guarded [${(10_000 - PV1F_GUARDED_STATUS.damageTakenMultiplierBasisPoints!) / 100}% less incoming damage] [${PV1F_GUARDED_STATUS.durationOwnerTurnStarts} Turns] · 1 stack per use, maximum ${PV1F_GUARDED_STATUS.maximumStacks}; reapplication refreshes duration`
      : id === PV1F_BASIC_ATTACK_ID
        ? `Physical damage [${PV1F_BASIC_ATTACK_BASE_DAMAGE} + floor(${PV1F_BASIC_ATTACK_POWER_SCALING_BASIS_POINTS / 100}% Physical Power)] [Immediate]`
        : `${skill.name} [${id === PV1F_RECOVER_ACTION_ID ? PV1F_RECOVER_PERCENT : PV1F_MP_RECOVER_PERCENT}% maximum ${id === PV1F_RECOVER_ACTION_ID ? 'HP' : 'MP'}] [Immediate] · rounded to a whole point, minimum 1, capped at maximum`
  return [
    ...rows.slice(0, 4).map(([label, value]): SkillCharacteristic => {
      if (label === 'Cooldown' && cooldown) {
        return [label, `${cooldown.ownerTurns} owner turns, shared by HP / MP Recovery`]
      }
      // Server battle-action-resource-availability rejects MP Recovery when MP is full.
      if (label === 'Requirements' && id === PV1F_MP_RECOVER_ACTION_ID) {
        return [label, 'Missing MP']
      }
      return [label, value]
    }),
    ['Effects', effects],
    ...rows.slice(4),
  ]
}

/** Match registered inherent names, never infer mechanics from an authored Technique's label. */
export function basicActionIdForCommand(
  slot: string,
  label: string,
): BasicActionPresentationId | null {
  if (!['move', 'attack', 'guard', 'recover'].includes(slot)) return null
  return PV1F_SKILLS.find((skill) => skill.name === label)?.id ?? null
}
