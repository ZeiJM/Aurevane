/** Owner-approved minimum report for active Skills, inherent actions and passives. */
export const MINIMUM_SKILL_INFORMATION_FIELDS = [
  'Skill Type',
  'Cost',
  'Cooldown',
  'Requirements',
  'Effects',
  'Range',
  'Target',
  'Target Method',
  'Target Elevation',
  'Line of Sight',
] as const

export type SkillInformationField = (typeof MINIMUM_SKILL_INFORMATION_FIELDS)[number]
export type SkillCharacteristic = readonly [string, string | readonly string[]]

/** All fields are required at the call site; display order has one authority. */
export function skillInformationRows<Value extends string | readonly string[]>(
  values: Readonly<Record<SkillInformationField, Value>>,
): readonly (readonly [SkillInformationField, Value])[] {
  return MINIMUM_SKILL_INFORMATION_FIELDS.map((label) => [label, values[label]] as const)
}
