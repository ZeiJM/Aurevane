import {
  COMBAT_GROUND_VISUAL_PRESETS,
  type PublicCombatGroundArea,
} from '@aurevane/game-core/combat/combat-ground-visuals'
import styles from './battle-ground-area-layer.module.css'

/** Shared fixed-tile layer for participants, spectators and Master animation previews. */
export function BattleGroundAreaLayer({
  areas,
  round,
  position,
  steam = false,
}: {
  areas?: readonly PublicCombatGroundArea[]
  round: number
  steam?: boolean
  position: { x: number; y: number }
}) {
  return (
    <>
      {steam ? (
        <span className={styles.mist} data-ground-steam-mist="true" aria-hidden="true">
          <i />
          <i />
        </span>
      ) : null}
      {areas
        ?.filter(
          (area) =>
            !area.steamTiles?.some((tile) => tile.x === position.x && tile.y === position.y) &&
            area.expiresAtRound > round &&
            area.tiles.some((tile) => tile.x === position.x && tile.y === position.y),
        )
        .map((area) => {
          const pending = round < area.activationRound
          const remaining = area.expiresAtRound - Math.max(round, area.activationRound)
          const name =
            COMBAT_GROUND_VISUAL_PRESETS.find((preset) => preset.id === area.visualPresetId)
              ?.label ?? 'Ground effect'
          return (
            <span
              key={area.id}
              className={styles.layer}
              data-ground-area-id={area.id}
              data-ground-area-phase={pending ? 'pending' : 'active'}
              data-ground-area-preset={area.visualPresetId}
              aria-hidden="true"
              title={`${name}: ${pending ? 'pending; ' : ''}${remaining} ${remaining === 1 ? 'round' : 'rounds'}`}
            >
              <i />
              <b>{pending ? '◷' : remaining}</b>
            </span>
          )
        })}
    </>
  )
}
