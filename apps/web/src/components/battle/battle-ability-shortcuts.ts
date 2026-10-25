import type { CombatKeybindAction } from '@aurevane/validation/player/combat-controls'
import { battleSkillCastMode } from './battle-captured-action-cost'
import type { BattleRuntime, BattleTechniqueCategory } from './battle-runtime'

/** Equipped ability shortcuts share command guards, while their readers remain available. */
export function routeBattleAbilityShortcut(
  action: CombatKeybindAction,
  context: {
    techniques: BattleRuntime['techniques']
    special:
      | {
          skill: { id: string }
          category: BattleTechniqueCategory
        }
      | undefined
    commandsDisabled: boolean
  },
  controls: {
    openInfo: (selector: string) => void
    activate: (actionId: string, category: BattleTechniqueCategory) => void
  },
): boolean {
  if (action.startsWith('skill')) {
    const slot = Number(action.slice(-1))
    const skill = context.techniques?.[slot - 1]
    if (skill && !battleSkillCastMode(skill).canCast)
      controls.openInfo(`[data-battle-reader-shortcut="skill${slot}"]`)
    else if (skill && !context.commandsDisabled) controls.activate(skill.id, skill.category)
    return true
  }
  if (action === 'essence') {
    if (context.special) {
      if (!context.commandsDisabled)
        controls.activate(context.special.skill.id, context.special.category)
    } else controls.openInfo('[data-battle-reader-shortcut="essence"]')
    return true
  }
  if (action === 'supernatural') {
    controls.openInfo('[data-battle-reader-shortcut="supernatural"]')
    return true
  }
  return false
}
