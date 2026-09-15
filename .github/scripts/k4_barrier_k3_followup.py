from __future__ import annotations

from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one replacement target, found {count}")
    file.write_text(text.replace(old, new))


replace_once(
    "packages/game-core/src/combat/combat-effect-state.ts",
    """export interface CombatBarrierInstance {
  targetCombatantId: string
  sourceCombatantId: string
  sourceActionId: string
  amount: number
}
""",
    """export interface CombatBarrierInstance {
  targetCombatantId: string
  sourceCombatantId: string
  sourceActionId: string
  amount: number
  provenance?: CombatEffectInstanceProvenance
}
""",
)

replace_once(
    "packages/game-core/src/combat/actions-legacy.ts",
    """    ['poison', effectState.poison],
    ['bleed', effectState.bleed],
    ['burn', effectState.burn],
  ]
""",
    """    ['poison', effectState.poison],
    ['bleed', effectState.bleed],
    ['burn', effectState.burn],
    ['barriers', effectState.barriers],
  ]
""",
)

replace_once(
    "packages/game-core/src/combat/combat-effect-provenance.ts",
    """  let poison = afterEffects.poison
  let bleed = afterEffects.bleed
  let burn = afterEffects.burn
  let statusChanged = false
""",
    """  let poison = afterEffects.poison
  let bleed = afterEffects.bleed
  let burn = afterEffects.burn
  let barriers = afterEffects.barriers ?? []
  let statusChanged = false
""",
)

replace_once(
    "packages/game-core/src/combat/combat-effect-provenance.ts",
    """      effect.type !== 'apply-status' &&
      effect.type !== 'poison' &&
      effect.type !== 'burn' &&
      !createsRecoverySchedule(effect)
""",
    """      effect.type !== 'apply-status' &&
      effect.type !== 'poison' &&
      effect.type !== 'burn' &&
      effect.type !== 'barrier-change' &&
      !createsRecoverySchedule(effect)
""",
)

replace_once(
    "packages/game-core/src/combat/combat-effect-provenance.ts",
    """      if (effect.type === 'burn') {
        let updated = false
        burn = burn.map((instance) => {
          if (
            instance.targetCombatantId !== targetCombatantId ||
            instance.sourceCombatantId !== actorId ||
            instance.sourceActionId !== action.id
          ) {
            return instance
          }
          updated = true
          return { ...instance, provenance }
        })
        effectStateChanged ||= updated
        continue
      }

      const kind = effect.type === 'healing' ? 'hp' : 'mp'
""",
    """      if (effect.type === 'burn') {
        let updated = false
        burn = burn.map((instance) => {
          if (
            instance.targetCombatantId !== targetCombatantId ||
            instance.sourceCombatantId !== actorId ||
            instance.sourceActionId !== action.id
          ) {
            return instance
          }
          updated = true
          return { ...instance, provenance }
        })
        effectStateChanged ||= updated
        continue
      }

      if (effect.type === 'barrier-change') {
        let updated = false
        barriers = barriers.map((instance) => {
          if (
            instance.targetCombatantId !== targetCombatantId ||
            instance.sourceCombatantId !== actorId ||
            instance.sourceActionId !== action.id
          ) {
            return instance
          }
          updated = true
          return { ...instance, provenance }
        })
        effectStateChanged ||= updated
        continue
      }

      const kind = effect.type === 'healing' ? 'hp' : 'mp'
""",
)

replace_once(
    "packages/game-core/src/combat/combat-effect-provenance.ts",
    """            ongoingRecovery,
            poison,
            bleed,
            burn,
          },
""",
    """            ongoingRecovery,
            poison,
            bleed,
            burn,
            barriers,
          },
""",
)

replace_once(
    "packages/game-core/src/combat/pv1f-action-economy.ts",
    """    if (effect.type === 'damage' || effect.type === 'healing') {
      scaled.push({ ...effect, amount: halfPositiveMagnitude(effect.amount) })
""",
    """    if (
      effect.type === 'damage' ||
      effect.type === 'healing' ||
      effect.type === 'barrier-change'
    ) {
      scaled.push({ ...effect, amount: halfPositiveMagnitude(effect.amount) })
""",
)
