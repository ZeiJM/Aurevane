import type { CombatActionSourceType } from './actions'
import {
  assertNever,
  type CombatActionSourceKind,
} from './combat-kernel-types'

export function canonicalCombatActionSourceKind(
  sourceType: CombatActionSourceType,
): CombatActionSourceKind {
  switch (sourceType) {
    case 'basic-attack':
    case 'basic-action':
      return 'basic'
    case 'discipline-skill':
      return 'discipline-skill'
    case 'scenario':
      return 'scenario'
    case 'test':
      return 'test'
    default:
      return assertNever(sourceType, 'CombatActionSourceType')
  }
}
