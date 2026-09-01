export type Pv1fSkillCategory = 'movement' | 'attack' | 'defense' | 'heal'

export type Pv1fSkillCost =
  | { readonly kind: 'flat'; readonly amount: number }
  | { readonly kind: 'per-terrain-point'; readonly amount: number }

export type Pv1fSkillSource = 'inherent'

export interface Pv1fSkillDefinition {
  readonly id: string
  readonly actionId: string | null
  readonly category: Pv1fSkillCategory
  readonly name: string
  readonly cost: Pv1fSkillCost
  readonly source: Pv1fSkillSource
}

export const PV1F_MOVEMENT_COST_PER_TERRAIN_POINT = 25 as const
export const PV1F_BASIC_ATTACK_COST = 30 as const
export const PV1F_GUARD_COST = 30 as const
export const PV1F_RECOVER_COST = 50 as const
export const PV1F_MP_RECOVER_COST = 50 as const

export const PV1F_BASIC_ATTACK_ID = 'basic.attack.unarmed.basic' as const
export const PV1F_GUARD_ACTION_ID = 'basic.guard' as const
export const PV1F_RECOVER_ACTION_ID = 'basic.recover' as const
export const PV1F_MP_RECOVER_ACTION_ID = 'basic.recover.mp' as const

export const PV1F_SKILLS = [
  {
    id: 'basic.move',
    actionId: null,
    category: 'movement',
    name: 'Move',
    cost: { kind: 'per-terrain-point', amount: PV1F_MOVEMENT_COST_PER_TERRAIN_POINT },
    source: 'inherent',
  },
  {
    id: PV1F_BASIC_ATTACK_ID,
    actionId: PV1F_BASIC_ATTACK_ID,
    category: 'attack',
    name: 'Basic Attack',
    cost: { kind: 'flat', amount: PV1F_BASIC_ATTACK_COST },
    source: 'inherent',
  },
  {
    id: PV1F_GUARD_ACTION_ID,
    actionId: PV1F_GUARD_ACTION_ID,
    category: 'defense',
    name: 'Guard',
    cost: { kind: 'flat', amount: PV1F_GUARD_COST },
    source: 'inherent',
  },
  {
    id: PV1F_RECOVER_ACTION_ID,
    actionId: PV1F_RECOVER_ACTION_ID,
    category: 'heal',
    name: 'HP Recovery',
    cost: { kind: 'flat', amount: PV1F_RECOVER_COST },
    source: 'inherent',
  },
  {
    id: PV1F_MP_RECOVER_ACTION_ID,
    actionId: PV1F_MP_RECOVER_ACTION_ID,
    category: 'heal',
    name: 'MP Recovery',
    cost: { kind: 'flat', amount: PV1F_MP_RECOVER_COST },
    source: 'inherent',
  },
] as const satisfies readonly Pv1fSkillDefinition[]

export function pv1fSkillByActionId(actionId: string): Pv1fSkillDefinition | null {
  return PV1F_SKILLS.find((skill) => skill.actionId === actionId) ?? null
}

export function pv1fSkillsByCategory(category: Pv1fSkillCategory): readonly Pv1fSkillDefinition[] {
  return PV1F_SKILLS.filter((skill) => skill.category === category)
}

export function pv1fFlatActionCost(actionId: string): number | null {
  const skill = pv1fSkillByActionId(actionId)
  return skill?.cost.kind === 'flat' ? skill.cost.amount : null
}
