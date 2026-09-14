from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


actions_path = Path('packages/game-core/src/combat/actions.ts')
actions = actions_path.read_text()

actions = replace_once(
    actions,
    "  | { type: 'displace'; recipient: Exclude<CombatEffectRecipient, 'actor'>; distance: 1 }",
    """  | {
      type: 'displace'
      recipient: Exclude<CombatEffectRecipient, 'actor'>
      direction?: 'push' | 'pull'
      distance: number
    }""",
    'displace type',
)

actions = replace_once(
    actions,
    """  if (effect.type === 'displace')
    return applyDisplacement(state, actorId, recipientId, actionId, content)""",
    """  if (effect.type === 'displace')
    return applyDisplacement(state, actorId, recipientId, actionId, effect, content)""",
    'displace execution call',
)

actions = replace_once(
    actions,
    """      const ap = status.movement.additionalApPerTile ?? 0
      assertNonNegativeSafeInteger(ap, 'movement AP surcharge')
      if (ap > 20) throw new RangeError('Movement surcharge exceeds 20 AP per tile.')""",
    """      const ap = status.movement.additionalApPerTile ?? 0
      if (!Number.isSafeInteger(ap) || ap < -10 || ap > 20)
        throw new RangeError('Movement AP modifier must be between -10 and 20 AP per tile.')""",
    'core movement modifier validation',
)

marker = 'function applyDisplacement(\n'
if actions.count(marker) != 1:
    raise RuntimeError(f'applyDisplacement marker count was {actions.count(marker)}')
start = actions.index(marker)
old_tail = actions[start:]
if 'function ' in old_tail[len(marker):]:
    raise RuntimeError('applyDisplacement is no longer the final function; patch must be reviewed')

new_tail = """function applyDisplacement(
  state: CombatEncounterState,
  actorId: string,
  recipientId: string,
  actionId: string,
  effect: Extract<CombatEffectDefinition, { type: 'displace' }>,
  content: CombatContentCatalog,
): CombatResolutionTransition {
  const source = getPlacement(state.tactical, actorId).position
  const placement = getPlacement(state.tactical, recipientId)
  const from = { ...placement.position }
  const dx = from.x - source.x
  const dy = from.y - source.y
  const profile = state.tactical.movementProfiles.find(
    (row) => row.id === placement.movementProfileId,
  )!

  let initialFailure: DisplacementFailureReason | null = null
  if (getCombatant(state.tactical.battle, recipientId).hp <= 0) initialFailure = 'target-defeated'
  else if (
    getStatusRow(state, recipientId).statuses.some(
      (status) =>
        getStatusDefinition(content, status.statusId, status.statusVersion).movement?.blocked,
    )
  )
    initialFailure = 'status-restricted'
  else if (!dx && !dy) initialFailure = 'direction-undefined'

  if (initialFailure) {
    return {
      state,
      events: [
        {
          event: 'displacement_failed',
          actionId,
          sourceCombatantId: actorId,
          combatantId: recipientId,
          reason: initialFailure,
          position: { ...from },
        },
      ],
    }
  }

  const horizontal = Math.abs(dx) >= Math.abs(dy)
  const pushStep = horizontal
    ? { x: Math.sign(dx), y: 0 }
    : { x: 0, y: Math.sign(dy) }
  const directionMultiplier = effect.direction === 'pull' ? -1 : 1
  const step = {
    x: pushStep.x * directionMultiplier,
    y: pushStep.y * directionMultiplier,
  }

  let nextState = state
  let current = { ...from }
  let stopReason: DisplacementFailureReason | null = null
  let movedTiles = 0

  for (let index = 0; index < effect.distance; index += 1) {
    const to = { x: current.x + step.x, y: current.y + step.y }
    const tile = nextState.tactical.tiles.find((candidate) => samePosition(candidate.position, to))
    const override =
      tile && profile.terrainCostOverrides.find((row) => row.terrainId === tile.terrainId)
    const terrainCost = tile
      ? override
        ? override.traversalCost
        : nextState.tactical.terrains.find((row) => row.id === tile.terrainId)?.traversalCost
      : null

    if (effect.direction === 'pull' && samePosition(to, source)) stopReason = 'occupied-tile'
    else if (!tile) stopReason = 'out-of-bounds'
    else if (terrainCost == null) stopReason = 'blocked-terrain'
    else if (
      nextState.tactical.placements.some(
        (unit) => unit.combatantId !== recipientId && samePosition(unit.position, to),
      )
    )
      stopReason = 'occupied-tile'
    else if (
      Math.abs(tile.elevation - getTile(nextState.tactical, current).elevation) >
      profile.maxElevationStep
    )
      stopReason = 'elevation-step-too-high'

    if (stopReason) break

    nextState = {
      ...nextState,
      tactical: {
        ...nextState.tactical,
        placements: nextState.tactical.placements.map((unit) =>
          unit.combatantId === recipientId ? { ...unit, position: to } : unit,
        ),
      },
    }
    current = to
    movedTiles += 1
  }

  if (movedTiles === 0) {
    return {
      state,
      events: [
        {
          event: 'displacement_failed',
          actionId,
          sourceCombatantId: actorId,
          combatantId: recipientId,
          reason: stopReason ?? 'direction-undefined',
          position: { ...from },
        },
      ],
    }
  }

  const marked = applyEffect(
    nextState,
    actorId,
    recipientId,
    actionId,
    { type: 'apply-status', recipient: 'primary-unit', statusId: 'displaced', stacks: 1 },
    content,
    new Set(),
  )
  return {
    state: marked.state,
    events: [
      {
        event: 'combatant_displaced',
        actionId,
        sourceCombatantId: actorId,
        combatantId: recipientId,
        from,
        to: { ...current },
      },
      ...marked.events,
    ],
  }
}
"""
actions = actions[:start] + new_tail
actions_path.write_text(actions)

validator_path = Path('packages/game-core/src/combat/combat-authoring-validation.ts')
validator = validator_path.read_text()
validator = replace_once(
    validator,
    """    const ap = status.movement.additionalApPerTile ?? 0
    nonNegativeSafeInteger(ap, 'movement AP surcharge')
    if (ap > 20) throw new RangeError('Movement surcharge exceeds 20 AP per tile.')""",
    """    const ap = status.movement.additionalApPerTile ?? 0
    if (!Number.isSafeInteger(ap) || ap < -10 || ap > 20) {
      throw new RangeError('Movement AP modifier must be between -10 and 20 AP per tile.')
    }""",
    'authoring movement modifier validation',
)
validator_path.write_text(validator)
