import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { BattleLogEntry } from '@/server/battle/battle-log-service'

import { BattleLogFeed } from './battle-log-feed'
import { BattleLogPanel } from './battle-log-panel'

const actor = 'character:zei'
const enemy = 'recruit:weon'
const names = { [actor]: 'Zei', [enemy]: 'Weon', 'recruit:other': 'Weon' }

function entry(
  battleVersion: number,
  eventIndex: number,
  eventType: string,
  overrides: Partial<BattleLogEntry> = {},
): BattleLogEntry {
  return {
    battleVersion,
    eventIndex,
    eventType,
    occurredAt: '2026-10-03T00:00:00Z',
    message: eventType,
    messageTemplate: eventType,
    templateValues: {},
    actorCombatantId: actor,
    targetCombatantId: enemy,
    actionId: 'skill.reflection',
    actionLabel: 'Hollow Reflection',
    round: 2,
    turnNumber: 3,
    kind: 'offense',
    headline: 'Hollow Reflection',
    tone: 'neutral',
    facts: [],
    ...overrides,
  }
}

function technique(version: number, owner = actor, title = 'Hollow Reflection') {
  return entry(version, 0, 'combat_action_used', {
    actorCombatantId: owner,
    actionLabel: title,
    actionContext: {
      skillId: 'skill.reflection',
      contentVersion: 4,
      name: title,
      description: 'Recorded damage and protection.',
      flavor: '{actor} follows a pale plane into the opening.',
    },
  })
}

function render(entries: readonly BattleLogEntry[]) {
  return renderToStaticMarkup(
    <BattleLogFeed compactFlow entries={entries} combatantNames={names} playerName="Zei" />,
  )
}

describe('approved Battle Chronicle', () => {
  it('keeps movement-only rounds with one short move per actor per round', () => {
    const html = render([
      entry(1, 0, 'combatant_moved', { round: 1 }),
      entry(2, 0, 'combatant_moved', { round: 1 }),
      entry(3, 0, 'combatant_moved', { round: 1, actorCombatantId: enemy }),
      entry(4, 0, 'combatant_moved', { round: 2 }),
    ])
    expect(html).toContain('ROUND 1')
    expect(html.match(/Zei moves\./gu)).toHaveLength(2)
    expect(html.match(/Weon moves\./gu)).toHaveLength(1)
  })

  it('puts a miss recorded before the command beneath that command', () => {
    const html = render([
      entry(1, 0, 'stat_driven_attack_resolved', { templateValues: { outcome: 'MISSED' } }),
      { ...technique(1), eventIndex: 1 },
    ])
    expect(html.match(/data-chronicle-action=/gu)).toHaveLength(1)
    expect(html.indexOf('Hollow Reflection')).toBeLessThan(html.indexOf('The strike misses Weon.'))
    expect(html).toContain('data-outcome-tone="neutral"')
  })

  it('shows a recorded hit even if it has no damage event, and marks missing results honestly', () => {
    const html = render([
      entry(1, 0, 'stat_driven_attack_resolved', { templateValues: { outcome: 'HIT' } }),
      { ...technique(1), eventIndex: 1 },
      technique(2),
    ])
    expect(html).toContain('The strike hits Weon.')
    expect(html).toContain('No outcome recorded.')
    expect(html).not.toContain('0 damage')
  })
  it('renders pinned identities and authorized outcome pronouns without rewriting old scenes', () => {
    const command = technique(1)
    command.actionContext = {
      ...command.actionContext!,
      flavor: '{actor} raises {actor.possessive} hand toward {target}; {target.subject} retreats.',
      narrator: { actor: { name: 'Zei at the battle', pronounPresetId: 'she_her' } },
    }
    const html = render([
      command,
      entry(1, 1, 'damage_applied', {
        templateValues: { amount: '8' },
        actionContext: {
          ...command.actionContext,
          narrator: {
            actor: { name: 'Zei at the battle', pronounPresetId: 'she_her' },
            target: { name: 'Weon at the battle', pronounPresetId: 'he_him' },
          },
        },
      }),
    ])
    expect(html).toContain(
      'Zei at the battle raises her hand toward Weon at the battle; he retreats.',
    )
    expect(html).toContain('<h3>Zei at the battle</h3>')
    expect(html.replace(/<[^>]+>/gu, '')).toContain('8 damage to Weon at the battle')
    const historical = technique(2)
    historical.actionContext = {
      ...historical.actionContext!,
      flavor: '{actor} raises {actor.possessive} hand.',
    }
    expect(render([historical])).toContain('Zei raises their hand.')
  })
  it('shares the chronicle format with full and mobile readers without a rail header', () => {
    const html = renderToStaticMarkup(<BattleLogFeed entries={[technique(1)]} />)
    expect(html).toContain('data-battle-chronicle="true"')
    const inline = renderToStaticMarkup(
      <BattleLogPanel battleSessionId="fixture" presentation="inline" />,
    )
    expect(inline).not.toContain('<header')
    expect(inline).not.toContain('Timeline')
    expect(inline).not.toContain('Battle Log')
  })
  it('shows a dense text chronicle with complete narration and no log toolbar or counts', () => {
    const html = render([
      technique(1),
      entry(1, 1, 'damage_applied', { templateValues: { amount: '85' }, tone: 'damage' }),
    ])
    expect(html).toContain('data-battle-chronicle="true"')
    expect(html).toContain('ROUND 2')
    expect(html).toContain('Hollow Reflection')
    expect(html).toContain('Zei follows a pale plane into the opening.')
    expect(html.replace(/<[^>]+>/gu, '')).toContain('85 damage to Weon')
    expect(html).not.toContain('Timeline')
    expect(html).not.toContain('Text log')
    expect(html).not.toContain('action count')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('data-reader-part')
  })

  it('groups every technique by actor ID within the round, including identical character names', () => {
    const html = render([
      technique(1),
      technique(2, enemy, 'Royal Faceplant'),
      technique(3, actor, 'Pale Shelter'),
      technique(4, 'recruit:other', 'Broken Crown'),
    ])
    expect(html.match(/data-chronicle-actor="character:zei"/gu)).toHaveLength(1)
    expect(html.match(/data-chronicle-actor="recruit:weon"/gu)).toHaveLength(1)
    expect(html.match(/data-chronicle-actor="recruit:other"/gu)).toHaveLength(1)
    const zeiGroup = html.slice(
      html.indexOf('data-chronicle-actor="character:zei"'),
      html.indexOf('data-chronicle-actor="recruit:weon"'),
    )
    expect(zeiGroup).toContain('Hollow Reflection')
    expect(zeiGroup).toContain('Pale Shelter')
    expect(zeiGroup).not.toContain('Royal Faceplant')
  })

  it('omits ordinary movement, facing, turn ends and fading effects while retaining all real targets', () => {
    const html = render([
      entry(1, 0, 'combatant_moved', { actionId: null, kind: 'movement' }),
      entry(2, 0, 'turn_ended', { actionId: null, kind: 'turn' }),
      entry(2, 1, 'combatant_facing_changed', { actionId: null, kind: 'turn' }),
      entry(2, 2, 'status_expired', { actionId: null, kind: 'status' }),
      technique(3),
      ...Array.from({ length: 6 }, (_, index) =>
        entry(3, index + 1, 'damage_applied', {
          targetCombatantId: `recruit:target-${index}`,
          templateValues: { amount: String(index + 1) },
          tone: 'damage',
        }),
      ),
    ])
    expect(html).not.toContain('combatant_moved')
    expect(html).not.toContain('turn_ended')
    expect(html).not.toContain('combatant_facing_changed')
    expect(html).not.toContain('status_expired')
    for (let amount = 1; amount <= 6; amount++)
      expect(html.replace(/<[^>]+>/gu, '')).toContain(`${amount} damage to Recruit`)
  })

  it('uses one recovery tone for HP and MP and exposes canonical status explanations', () => {
    const html = render([
      technique(1, actor, 'HP Recovery'),
      entry(1, 1, 'healing_applied', {
        targetCombatantId: actor,
        templateValues: { amount: '12' },
        tone: 'healing',
      }),
      technique(2, actor, 'MP Recovery'),
      entry(2, 1, 'resource_changed', {
        targetCombatantId: actor,
        templateValues: { amount: '4', direction: 'gained', resource: 'MP' },
        tone: 'benefit',
      }),
      entry(2, 2, 'status_applied', {
        templateValues: { status: 'Bleed', statusId: 'bleed' },
        facts: [{ label: '3 turns', tone: 'neutral' }],
      }),
    ])
    expect(html).toMatch(/data-outcome-tone="recovery"[^]*?\+12 HP/)
    expect(html).toMatch(/data-outcome-tone="recovery"[^]*?\+4 MP/)
    expect(html).toContain('aria-label="Explain Bleed"')
    expect(html).toContain('Bleed, 3 turns')
  })

  it('places only recorded and verified Resonance results under its pinned special entry', () => {
    const activation = entry(1, 1, 'resonance_activated', {
      actionId: 'resonance.quarry-edge',
      actionContext: {
        skillId: 'resonance.quarry-edge',
        contentId: 'resonance.quarry-edge',
        contentVersion: 2,
        family: 'resonance',
        name: 'Quarry Edge',
        description: 'Passive context.',
        flavor: "The hunt answers {actor}'s call.",
      },
    })
    const html = render([
      technique(1),
      activation,
      entry(1, 2, 'damage_applied', { templateValues: { amount: '8' } }),
      entry(1, 3, 'resource_changed', {
        targetCombatantId: actor,
        templateValues: { amount: '3', direction: 'gained', resource: 'MP' },
        effectOrigin: {
          family: 'resonance',
          contentId: 'resonance.quarry-edge',
          contentVersion: 2,
        },
      }),
      entry(2, 0, 'resource_changed', {
        round: 3,
        targetCombatantId: actor,
        templateValues: { amount: '2', direction: 'gained', resource: 'MP' },
        effectOrigin: {
          family: 'resonance',
          contentId: 'resonance.quarry-edge',
          contentVersion: 2,
        },
      }),
    ])
    expect(html).toMatch(/data-chronicle-family="resonance"[^]*?Quarry Edge[^]*?\+3 MP/)
    const followingRound = html.slice(html.indexOf('aria-label="Round 3"'))
    expect(followingRound).toContain('Quarry Edge')
    expect(followingRound).toContain('+2 MP')
    expect(followingRound).not.toContain('Hollow Reflection')
    expect(html).not.toContain('+4 MP')
  })

  it('lets readers inspect pending effects and actual Barrier results using the standard meaning', () => {
    const html = render([
      technique(1),
      entry(1, 1, 'effect_pending', {
        statusId: 'root',
        messageTemplate: '{effect} pending until round {round}.',
        templateValues: { effect: 'Root', round: '3' },
      }),
      entry(1, 2, 'barrier_changed', {
        statusId: 'barrier',
        messageTemplate: '{target} gained {amount} Barrier.',
        templateValues: { amount: '9' },
      }),
    ])
    expect(html).toContain('aria-label="Explain Root"')
    expect(html).toContain('aria-label="Explain Barrier"')
    expect(html).toContain('Root pending until round 3.')
    expect(html).toContain('gained 9 Barrier.')
  })
})
