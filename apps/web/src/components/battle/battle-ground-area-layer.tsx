import {
  COMBAT_GROUND_VISUAL_PRESETS,
  groundEffectVisual,
  type PublicCombatGroundArea,
} from '@aurevane/game-core/combat/combat-ground-visuals'
import { GroundEffectIcon } from './battle-ground-effect-visuals'
import styles from './battle-ground-area-layer.module.css'

function atTile(
  areas: readonly PublicCombatGroundArea[] | undefined,
  round: number,
  position: { x: number; y: number },
) {
  return (areas ?? []).filter(
    (area) =>
      !area.steamTiles?.some((tile) => tile.x === position.x && tile.y === position.y) &&
      area.expiresAtRound > round &&
      area.tiles.some((tile) => tile.x === position.x && tile.y === position.y),
  )
}
export function battleGroundAreaDescriptions(
  areas: readonly PublicCombatGroundArea[] | undefined,
  round: number,
  position: { x: number; y: number },
): string[] {
  return atTile(areas, round, position).flatMap((area) => {
    const names = area.effectVisualIds?.flatMap((id) => groundEffectVisual(id)?.label ?? []) ?? [
      COMBAT_GROUND_VISUAL_PRESETS.find((preset) => preset.id === area.visualPresetId)?.label ??
        'Ground effect',
    ]
    const remaining = area.expiresAtRound - Math.max(round, area.activationRound)
    return names.map(
      (name) =>
        `${name} · ${round < area.activationRound ? `Starts round ${area.activationRound} · ` : ''}${remaining} ${remaining === 1 ? 'round' : 'rounds'}${round < area.activationRound ? '' : ' remaining'}`,
    )
  })
}
export function battleGroundAreaLabel(
  areas: readonly PublicCombatGroundArea[] | undefined,
  round: number,
  position: { x: number; y: number },
): string {
  const descriptions = battleGroundAreaDescriptions(areas, round, position)
  return descriptions.length ? `; Ground fields: ${descriptions.join('; ')}` : ''
}
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
  const visible = atTile(areas, round, position)
  const current = visible.filter((area) => area.effectVisualIds !== undefined)
  const fields = current.flatMap((area) =>
    area.effectVisualIds!.flatMap((id) => {
      const visual = groundEffectVisual(id)
      if (!visual) return []
      const remaining = area.expiresAtRound - Math.max(round, area.activationRound)
      return [
        {
          id,
          visual,
          area,
          text: `${visual.label} · ${round < area.activationRound ? `Starts round ${area.activationRound} · ` : ''}${remaining} ${remaining === 1 ? 'round' : 'rounds'}${round < area.activationRound ? '' : ' remaining'}`,
        },
      ]
    }),
  )
  const grouped = new Map<(typeof fields)[number]['id'], typeof fields>()
  for (const field of fields) {
    const group = grouped.get(field.id) ?? []
    group.push(field)
    grouped.set(field.id, group)
  }
  const markers = [...grouped.values()].map((group) => ({
    ...group[0]!,
    text: group.map((field) => field.text).join('; '),
    // The logical field remains present until its last active instance expires.
    // Every individual lifetime remains available in the tile/Inspect description.
    remaining: group.reduce(
      (longest, field) =>
        round >= field.area.activationRound
          ? Math.max(longest, field.area.expiresAtRound - round)
          : longest,
      0,
    ),
  }))
  const clocks = [
    ...new Set(
      current.filter((area) => round < area.activationRound).map((area) => area.activationRound),
    ),
  ]
  return (
    <>
      {steam ? (
        <span className={styles.mist} data-ground-steam-mist="true" aria-hidden="true">
          <i />
          <i />
        </span>
      ) : null}
      {visible.map((area) => {
        const pending = round < area.activationRound
        const remaining = area.expiresAtRound - Math.max(round, area.activationRound)
        const material = area.effectVisualIds?.some(
          (id) => groundEffectVisual(id)?.material === 'frost',
        )
          ? 'frost'
          : area.effectVisualIds?.length
            ? (groundEffectVisual(area.effectVisualIds[0])?.material ?? area.visualPresetId)
            : area.visualPresetId
        const name =
          COMBAT_GROUND_VISUAL_PRESETS.find((preset) => preset.id === area.visualPresetId)?.label ??
          'Ground effect'
        return (
          <span
            key={area.id}
            className={styles.layer}
            data-ground-area-id={area.id}
            data-ground-area-phase={pending ? 'pending' : 'active'}
            data-ground-area-preset={material}
            aria-hidden="true"
            title={
              area.effectVisualIds
                ? battleGroundAreaDescriptions([area], round, position).join('; ')
                : `${name}: ${pending ? 'pending; ' : ''}${remaining} ${remaining === 1 ? 'round' : 'rounds'}`
            }
          >
            <i />
            {area.effectVisualIds ? null : <b>{pending ? '◷' : remaining}</b>}
          </span>
        )
      })}
      {markers.length ? (
        <span
          className={styles.effectMarkers}
          data-ground-effect-markers="true"
          aria-hidden="true"
          title={markers.map((marker) => marker.text).join('; ')}
        >
          {markers.map((marker) => (
            <span
              key={`${marker.area.id}:${marker.id}`}
              className={styles.effectMarker}
              data-ground-effect-id={marker.id}
              data-ground-effect-tone={marker.visual.tone}
              title={marker.text}
            >
              <GroundEffectIcon id={marker.id} />
              {marker.remaining ? <small>{marker.remaining}</small> : null}
            </span>
          ))}
          {markers.length > 2 ? <small className={styles.more}>+{markers.length - 2}</small> : null}
        </span>
      ) : null}
      {clocks.length ? (
        <span className={styles.clocks} aria-hidden="true">
          {clocks.map((activationRound) => (
            <b
              key={activationRound}
              data-ground-area-clock="true"
              title={`Starts round ${activationRound}`}
            >
              ◷{activationRound}
            </b>
          ))}
        </span>
      ) : null}
    </>
  )
}
