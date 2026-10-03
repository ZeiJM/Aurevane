import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CombatStatusInstance } from '@aurevane/game-core/combat/actions'
import { PHASE4_STATUSES } from '@aurevane/game-core/combat/status-content'
import { BattleCombatantEffects } from './battle-combatant-effects'

function render(statusId?: string, stacks = 1) {
  const statuses: CombatStatusInstance[] = statusId
    ? [
        {
          statusId,
          statusVersion: 1,
          stacks,
          remainingOwnerTurnStarts: 2,
          sourceCombatantId: 'opponent',
        },
      ]
    : []
  return renderToStaticMarkup(<BattleCombatantEffects name="Archer" statuses={statuses} />)
}
describe('combatant effect presentation', () => {
  it('uses only the accessible effect popover without a native hover tooltip', () => {
    const markup = render('root')
    expect(markup).toContain('aria-haspopup="dialog"')
    expect(markup).toContain('aria-describedby=')
    expect(markup).not.toContain(' title=')
  })
  it('shows both the advantage and drawback of a mixed effect', () => {
    const markup = render('fortified')
    expect(markup).toContain('Damage received')
    expect(markup).toContain('−30%')
    expect(markup).toContain('Damage dealt')
    expect(markup).toContain('−20%')
    expect(markup).toContain('data-tone="positive"')
    expect(markup).toContain('data-tone="negative"')
    expect(markup).toContain('data-battle-effect-kind="Effect"')
  })
  it('labels conditional values and preserves the explanation and remaining duration', () => {
    const markup = render('marked')
    expect(markup).toContain('conditional')
    expect(markup).toContain('+20%')
    expect(markup).toContain('from the unit that applied Mark')
    expect(markup).toContain('2 affected-unit turn starts remaining')
  })
  it('shows compounded Guarded stacks without inventing an outgoing bonus', () => {
    const markup = render('guarded', 2)
    expect(markup).toContain('−27.8%')
    expect(markup).not.toContain('Damage dealt')
  })
  it('keeps every compact effect reachable by focus, hover or touch instead of truncating the card', () => {
    const statuses = ['guarded', 'marked', 'fortified'].map((statusId) => ({
      statusId,
      statusVersion: 1,
      stacks: 1,
      remainingOwnerTurnStarts: 2,
      sourceCombatantId: 'opponent',
    }))
    const markup = renderToStaticMarkup(
      <BattleCombatantEffects compact name="Archer" statuses={statuses} />,
    )
    expect(markup.match(/aria-haspopup="dialog"/g)).toHaveLength(3)
    expect(markup).toContain('Explain Guard')
    expect(markup).toContain('Explain Mark')
    expect(markup).toContain('Explain Fortified')
    expect(markup).not.toContain('All 3')
  })
  it('keeps duration visible inside a stacked icon and identifies each effect', () => {
    const statuses = ['guarded', 'regeneration', 'reckless', 'haste', 'hastened'].map(
      (statusId) => ({
        statusId,
        statusVersion: 1,
        stacks: 3,
        remainingOwnerTurnStarts: 2,
        sourceCombatantId: 'opponent',
      }),
    )
    const markup = renderToStaticMarkup(
      <BattleCombatantEffects compact name="Archer" statuses={statuses} />,
    )
    expect(markup.match(/data-effect-duration="true">2<\/small>/g)).toHaveLength(5)
    expect(markup).not.toContain('>×3</small>')
    for (const glyph of ['GUA', 'REG', 'REC', 'HST', 'HSN'])
      expect(markup).toContain(`>${glyph}</i>`)
  })
  it('keeps custom effects with the same prefix visually distinct and stable', () => {
    const statuses = ['effect-one', 'effect-two', 'effect-three'].map((statusId) => ({
      statusId,
      statusVersion: 1,
      stacks: 1,
      remainingOwnerTurnStarts: 2,
      sourceCombatantId: 'opponent',
    }))
    const markup = renderToStaticMarkup(
      <BattleCombatantEffects compact name="Archer" statuses={statuses} />,
    )
    const glyphs = [...markup.matchAll(/<i aria-hidden="true">([^<]+)<\/i>/g)].map(
      (match) => match[1],
    )
    expect(new Set(glyphs).size).toBe(3)
    const alone = renderToStaticMarkup(
      <BattleCombatantEffects compact name="Archer" statuses={[statuses[1]!]} />,
    )
    expect(alone).toContain(`>${glyphs[1]}</i>`)
  })

  it('provides the canonical explanation for compact and full effect readers', () => {
    const statuses = [
      {
        statusId: 'root',
        statusVersion: 1,
        stacks: 1,
        remainingOwnerTurnStarts: 2,
        sourceCombatantId: 'opponent',
      },
    ]
    for (const compact of [true, false]) {
      const markup = renderToStaticMarkup(
        <BattleCombatantEffects compact={compact} name="Archer" statuses={statuses} />,
      )
      expect(markup).toContain('aria-haspopup="dialog"')
      expect(markup).toContain('Active')
      expect(markup).toContain('Cannot move. Attacks, Skills and facing remain available.')
    }
  })

  it('shows a pending icon immediately with canonical meaning and future-round timing', () => {
    const markup = renderToStaticMarkup(
      <BattleCombatantEffects
        compact
        name="Archer"
        statuses={[
          {
            statusId: 'root',
            statusVersion: 1,
            stacks: 1,
            remainingOwnerTurnStarts: 1,
            remainingOwnerTurnEnds: 1,
            timingState: 'pending',
            activationRound: 4,
            sourceCombatantId: 'opponent',
          },
        ]}
      />,
    )
    expect(markup).toContain('data-effect-timing="pending"')
    expect(markup).toContain('Pending · Activates at the start of round 4')
    expect(markup).toContain('1 turn remaining')
    expect(markup).toContain('data-effect-duration="true">1</small>')
    expect(markup).toContain('Cannot move. Attacks, Skills and facing remain available.')
  })

  it('describes a one-turn active effect through the affected character’s completed turn', () => {
    const markup = renderToStaticMarkup(
      <BattleCombatantEffects
        compact
        name="Archer"
        statuses={[
          {
            statusId: 'guarded',
            statusVersion: 1,
            stacks: 1,
            remainingOwnerTurnStarts: 2,
            remainingOwnerTurnEnds: 1,
            timingState: 'active',
            sourceCombatantId: 'opponent',
          },
        ]}
      />,
    )
    expect(markup).toContain('Active · 1 turn remaining')
    expect(markup).toContain('Expires after the affected character completes that turn')
    expect(markup).toContain('data-effect-duration="true">1</small>')
    expect(markup).not.toContain('turn start')
  })

  it('suppresses fabricated one-turn lifetime counts for battle-long Copy in every reader', () => {
    const statuses = [
      {
        statusId: 'copy',
        statusVersion: 1,
        stacks: 1,
        remainingOwnerTurnStarts: 1,
        sourceCombatantId: 'archer',
        durationScope: 'battle' as const,
        timingState: 'pending' as const,
        activationRound: 4,
      },
    ]
    for (const compact of [true, false]) {
      const markup = renderToStaticMarkup(
        <BattleCombatantEffects compact={compact} name="Archer" statuses={statuses} />,
      )
      expect(markup).toContain('Until battle ends')
      expect(markup).toContain('Activates at the start of round 4')
      expect(markup).not.toContain('data-effect-duration="true"')
      expect(markup).not.toContain('>1t</small>')
    }
    const all = renderToStaticMarkup(
      <BattleCombatantEffects
        name="Archer"
        statuses={[
          {
            statusId: 'root',
            statusVersion: 1,
            stacks: 1,
            remainingOwnerTurnStarts: 2,
            sourceCombatantId: 'opponent',
          },
          ...statuses,
          {
            statusId: 'guarded',
            statusVersion: 1,
            stacks: 1,
            remainingOwnerTurnStarts: 2,
            sourceCombatantId: 'archer',
          },
        ]}
      />,
    )
    expect(all).not.toContain('Copy · 1t')
  })

  it.each([
    ['instant', 'mp-drain', 'One-time effect on activation'],
    ['until-spent', 'barrier', 'Until depleted'],
    ['until-removed', 'poison', 'Until removed'],
  ] as const)(
    'omits countdown overlays for %s pending effects',
    (durationScope, statusId, duration) => {
      const statuses = [
        {
          statusId,
          durationScope,
          statusVersion: 1,
          stacks: 1,
          remainingOwnerTurnStarts: 1,
          sourceCombatantId: 'archer',
          timingState: 'pending' as const,
          activationRound: 4,
        },
      ]
      for (const compact of [true, false]) {
        const markup = renderToStaticMarkup(
          <BattleCombatantEffects compact={compact} name="Archer" statuses={statuses} />,
        )
        expect(markup).toContain(duration)
        expect(markup).toContain('Activates at the start of round 4')
        expect(markup).not.toContain('data-effect-duration="true"')
        expect(markup).not.toContain('Until battle ends')
        expect(markup).not.toContain('>1t</small>')
      }
    },
  )

  it('shows the terrain boundary count inside the icon and labels full readers in rounds', () => {
    const statuses = [
      {
        statusId: 'create-terrain',
        statusVersion: 1,
        stacks: 1,
        remainingOwnerTurnStarts: 1,
        remainingRoundBoundaries: 2,
        sourceCombatantId: 'archer',
        durationScope: 'rounds' as const,
        timingState: 'active' as const,
      },
    ]
    const compact = renderToStaticMarkup(
      <BattleCombatantEffects compact name="Archer" statuses={statuses} />,
    )
    const full = renderToStaticMarkup(<BattleCombatantEffects name="Archer" statuses={statuses} />)
    expect(compact).toContain('data-effect-duration="true">2</small>')
    expect(compact).toContain('2 round boundaries remaining')
    expect(full).toContain('>2r</small>')
    expect(full).not.toContain('>1t</small>')
    expect(full).not.toContain('affected-unit turn')
  })

  it('retains every effect beyond the twenty visible slots with an overflow affordance', () => {
    const statuses = Array.from({ length: 23 }, (_, index) => ({
      statusId: `effect-${index}`,
      statusVersion: 1,
      stacks: 1,
      remainingOwnerTurnStarts: 2,
      sourceCombatantId: 'opponent',
    }))
    const markup = renderToStaticMarkup(
      <BattleCombatantEffects compact name="Archer" statuses={statuses} />,
    )
    expect(markup.match(/aria-haspopup="dialog"/g)).toHaveLength(23)
    expect(markup).toContain('Scroll for all 23 effects')
    expect(markup).toContain('Explain Effect 22')
  })
  it('identifies every published named and legacy status distinctly without losing catalog overflow', () => {
    const statuses = [
      ...PHASE4_STATUSES.map((status) => status.id),
      'guarded',
      'exposed',
      'lowered-guard',
    ].map((statusId) => ({
      statusId,
      statusVersion: 1,
      stacks: 1,
      remainingOwnerTurnStarts: 2,
      sourceCombatantId: 'opponent',
    }))
    const markup = renderToStaticMarkup(
      <BattleCombatantEffects compact name="Archer" statuses={statuses} />,
    )
    const glyphs = [...markup.matchAll(/<i aria-hidden="true">([^<]+)<\/i>/g)].map(
      (match) => match[1],
    )
    expect(glyphs).toHaveLength(statuses.length)
    expect(new Set(glyphs).size).toBe(statuses.length)
    expect(markup).toContain(`Scroll for all ${statuses.length} effects`)
  })
  it('uses affected-unit timing for periodic effects and explicit next-round timing for tempo effects', () => {
    expect(render('burn')).toContain('2 affected-turn-end ticks remaining')
    expect(render('hastened')).toContain('Until the next round starts')
    expect(render('root')).not.toContain('rounds remaining')
  })
  it('does not claim bonuses when no effect is active', () => {
    const markup = render()
    expect(markup).toContain('No combat effects')
    expect(markup).not.toContain('%')
  })
})
