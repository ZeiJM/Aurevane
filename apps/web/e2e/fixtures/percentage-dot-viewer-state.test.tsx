import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { percentageDotEncounter } from '../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { resolveEssenceForBuild } from '@aurevane/game-core/combat/essence'
import { executePv1fMatureSkill } from '@aurevane/game-core/combat/pv1f-action-economy'
import { projectPercentageDotFixtureState } from './percentage-dot-viewer-state'
import { BattleCombatantEffects } from '@/components/battle/battle-combatant-effects'
vi.mock('server-only', () => ({}))
import { projectBattleStatusStateForViewer } from '@/server/battle/battle-live-viewer-projection'
import { createSpectatorBattleViewerEntitlement } from '@/server/battle/battle-viewer-entitlement'

it.each(
  ['burn', 'poison', 'bleed', 'essence-burn', 'essence-bleed'].flatMap((name) =>
    ['active', 'pending'].map((phase) => ({ name, phase })),
  ),
)(
  'projects $name/$phase from actual kernel effects without changing authority',
  ({ name, phase }) => {
    const definition = name.startsWith('essence-')
      ? resolveEssenceForBuild(name === 'essence-burn' ? 'cinderweaver' : 'ravager', null)!.skill
      : resolveMatureSkillVersion(
          {
            burn: 'cinderweaver.cinder-bolt',
            poison: 'wildwarden.venom-shot',
            bleed: 'ravager.gash',
          }[name]!,
        )!
    const dot = definition.effects.find((row) => ['burn', 'poison', 'bleed'].includes(row.type))!
    const state = {
      ...percentageDotEncounter(),
      effectTimingPolicy: {
        version: 1,
        modes: {
          damage: 'instant' as const,
          [dot.type]: phase === 'active' ? ('instant' as const) : ('next-round' as const),
        },
      },
    }
    const target =
      definition.target.geometryVersion === 2 && definition.target.shape.kind !== 'single'
        ? definition.target.shape.kind === 'line'
          ? { kind: 'direction' as const, direction: 'east' as const }
          : { kind: 'activate' as const }
        : { kind: 'unit' as const, combatantId: 'enemy' }
    const committed = executePv1fMatureSkill(state, definition, target, 'pve').state
    const before = structuredClone(committed)
    const projected = projectPercentageDotFixtureState(committed)
    const enemy = projected.statusState.find((row) => row.combatantId === 'enemy')!
    expect(
      enemy.statuses.some((row) => row.statusId === dot.type && row.timingState === phase),
    ).toBe(true)
    expect(projected.statusState).toEqual(
      projectBattleStatusStateForViewer(committed, createSpectatorBattleViewerEntitlement()),
    )
    const markup = renderToStaticMarkup(
      <BattleCombatantEffects name="Enemy" statuses={enemy.statuses} compact />,
    )
    expect(markup).toContain(`Explain ${dot.type[0]!.toUpperCase() + dot.type.slice(1)},`)
    expect(markup).toContain(`data-effect-timing="${phase}"`)
    expect(markup).not.toContain('percentageDotCommandId')
    expect(committed).toEqual(before)
  },
)
