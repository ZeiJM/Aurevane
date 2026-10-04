import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { BattleLogEntry } from '@/server/battle/battle-log-service'

import { BattleLogFeed } from './battle-log-feed'
import { BattleLogPanel } from './battle-log-panel'
import { BattleLogChronicle } from './battle-log-chronicle'
import { buildBattleChronicle } from './battle-log-chronicle-model'

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
  it('narrates a completed idle turn in its recorded round and actor group', () => {
    const entries = [
      entry(1, 0, 'turn_started', { round: 4, turnNumber: 7, actorCombatantId: enemy }),
      entry(2, 0, 'combatant_facing_changed', { round: 4, turnNumber: 7, actorCombatantId: enemy }),
      entry(2, 1, 'final_facing_selected', { round: 4, turnNumber: 7, actorCombatantId: enemy }),
      entry(2, 2, 'turn_ended', { round: 4, turnNumber: 7, actorCombatantId: enemy }),
    ]
    const original = JSON.stringify(entries)
    const html = render(entries)
    expect(html).toContain('ROUND 4')
    expect(html).toContain('data-chronicle-actor="recruit:weon"')
    expect(html).toContain('Weon stands around and does nothing.')
    expect(html).not.toContain('Hollow Reflection')
    expect(html).not.toContain('Action recorded; no effect result available.')
    expect(JSON.stringify(entries)).toBe(original)
  })

  it.each([
    'combatant_moved',
    'movement_spent',
    'combat_action_used',
    'hidden_combat_action',
    'stat_driven_attack_resolved',
    'combat_accuracy_resolved',
    'recovery_scheduled',
    'status_applied',
    'unknown_legacy_action',
  ])('does not call a turn idle when %s is recorded', (eventType) => {
    expect(
      render([
        entry(1, 0, 'turn_started'),
        entry(2, 0, eventType, { templateValues: { outcome: 'MISSED' } }),
        entry(3, 0, 'turn_ended'),
      ]),
    ).not.toContain('stands around')
  })

  it.each(['basic.guard', 'basic.recover', 'basic.recover.mp', 'skill.utility'])(
    'does not call a completed %s use idle when no damage is recorded',
    (actionId) => {
      expect(
        render([
          entry(1, 0, 'turn_started'),
          entry(2, 0, 'combat_action_used', { actionId }),
          entry(3, 0, 'turn_ended'),
        ]),
      ).not.toContain('stands around')
    },
  )

  it('requires matching, complete turn history before inventing idle narration', () => {
    const start = entry(1, 0, 'turn_started')
    const end = entry(2, 0, 'turn_ended')
    for (const entries of [
      [end],
      [start],
      [start, { ...end, actorCombatantId: enemy }],
      [start, { ...end, turnNumber: 4 }],
      [start, { ...end, battleVersion: 3 }],
      [start, { ...end, eventIndex: 2 }],
      [
        start,
        entry(2, 0, 'combatant_waited', { actorCombatantId: enemy }),
        entry(3, 0, 'turn_ended'),
      ],
      [
        { ...start, turnNumber: null },
        { ...end, turnNumber: null },
      ],
    ])
      expect(render(entries)).not.toContain('stands around')
  })

  it('keeps idle AI decisions and expiry chatter quiet while naming the completed actor', () => {
    expect(
      render([
        entry(1, 0, 'turn_started'),
        entry(2, 0, 'recruit_ai_decision', { templateValues: { reason: 'facing the threat' } }),
        entry(2, 1, 'final_facing_selected'),
        entry(2, 2, 'status_expired', { actorCombatantId: null }),
        entry(2, 3, 'turn_ended'),
      ]),
    ).toContain('Zei stands around and does nothing.')
    expect(
      render([
        entry(1, 0, 'turn_started'),
        entry(2, 0, 'recruit_ai_decision', {
          templateValues: { reason: 'a legal tactical option' },
        }),
        entry(2, 1, 'turn_ended'),
      ]),
    ).not.toContain('stands around')
  })

  it('expands the current and previous round while preserving all older history behind controls', () => {
    const entries = [1, 2, 3, 4].map((round) => ({ ...technique(round), round }))
    const html = renderToStaticMarkup(<BattleLogChronicle entries={entries} currentRound={4} />)
    for (const round of [1, 2]) {
      expect(html).toMatch(
        new RegExp(`aria-label="Expand round ${round}"[^>]*aria-expanded="false"`),
      )
      expect(html).toMatch(new RegExp(`data-chronicle-round-content="${round}"[^>]*hidden=""`))
    }
    expect(html).toContain('aria-label="Collapse round 3" aria-expanded="true"')
    expect(html).toContain('data-chronicle-current-round="true"')
    expect(html).not.toContain('Collapse round 4')
    expect(html.match(/data-chronicle-action=/gu)).toHaveLength(4)
  })

  it('infers the latest recorded round even when its entries are hidden bookkeeping', () => {
    const html = render([
      { ...technique(1), round: 1 },
      { ...technique(2), round: 2 },
      entry(3, 0, 'round_started', { round: 3 }),
    ])
    expect(html).toContain('aria-label="Expand round 1" aria-expanded="false"')
    expect(html).toContain('aria-label="Collapse round 2" aria-expanded="true"')
    expect(html).not.toContain('data-chronicle-current-round="true"')
  })

  it('uses the live snapshot round before the first recorded action of that round', () => {
    const html = renderToStaticMarkup(
      <BattleLogFeed
        entries={[
          { ...technique(1), round: 1 },
          { ...technique(2), round: 2 },
        ]}
        currentRound={3}
      />,
    )
    expect(html).toContain('aria-label="Expand round 1" aria-expanded="false"')
    expect(html).toContain('aria-label="Collapse round 2" aria-expanded="true"')
  })

  it.each([
    ['guarded', 'benefit'],
    ['lowered-guard', 'harm'],
    ['root', 'harm'],
    ['barrier', 'benefit'],
    ['healing', 'benefit'],
    ['mp-recovery', 'benefit'],
    ['reckless', 'neutral'],
    ['fortified', 'neutral'],
    ['unknown-guard', 'neutral'],
  ] as const)(
    'classifies recorded %s identity consistently for pending and active outcomes',
    (statusId, tone) => {
      for (const eventType of ['effect_pending', 'status_applied', 'persistent_effect_applied']) {
        const recorded = entry(1, 1, eventType, {
          statusId,
          // Neither display copy nor unrelated event tone is classification authority.
          tone: 'benefit',
          templateValues: { effect: 'Guard', status: 'Guard', round: '3' },
        })
        const result = buildBattleChronicle([technique(1), recorded], { combatantNames: names })
        expect(result[0].actors[0].actions[0].outcomes[0].tone).toBe(tone)
        expect(render([technique(1), recorded])).toContain('aria-label="Explain ')
      }
    },
  )

  it('keeps recorded HP/MP scheduled recovery beneficial without treating other resources as recovery', () => {
    for (const resource of ['HP', 'MP', 'AP']) {
      const result = buildBattleChronicle([
        technique(1),
        entry(1, 1, 'recovery_scheduled', {
          templateValues: { resource },
        }),
      ])
      expect(result[0].actors[0].actions[0].outcomes[0].tone).toBe(
        resource === 'AP' ? 'neutral' : 'recovery',
      )
    }
  })

  it.each([
    ['root', 'benefit'],
    ['guarded', 'harm'],
    ['reckless', 'neutral'],
    ['unknown-guard', 'neutral'],
  ] as const)(
    'colors removing %s for the consequence while preserving its canonical explainer',
    (statusId, tone) => {
      const removal = entry(1, 1, 'status_removed', {
        statusId,
        messageTemplate: '{status} was removed from {target}.',
        templateValues: { status: statusId },
      })
      expect(
        buildBattleChronicle([technique(1), removal])[0].actors[0].actions[0].outcomes[0].tone,
      ).toBe(tone)
      expect(render([technique(1), removal])).toContain('aria-label="Explain ')
    },
  )

  it.each(['HP', 'MP'])(
    'colors recorded %s effect losses red and recovery ticks green',
    (resource) => {
      const results = buildBattleChronicle([
        technique(1),
        entry(1, 1, 'resource_changed', {
          templateValues: { resource, direction: 'spent', amount: '4' },
        }),
        entry(1, 2, 'resource_changed', {
          templateValues: { resource, direction: 'gained', amount: '3' },
        }),
      ])[0].actors[0].actions[0].outcomes
      expect(results.map((result) => result.tone)).toEqual(['harm', 'recovery'])
      expect(results.map((result) => result.text)).toEqual([`−4 ${resource}`, `+3 ${resource}`])
    },
  )

  it('keeps viewer-redacted consequences neutral without reconstructing concealed effect identities', () => {
    const html = render([
      technique(1),
      entry(1, 1, 'hidden_combat_action', {
        statusId: undefined,
        actionId: null,
        templateValues: {},
        messageTemplate: '{actor} uses a concealed action.',
        tone: 'benefit',
      }),
    ])
    expect(html).toContain('concealed action')
    expect(html).toContain('data-outcome-tone="neutral"')
    expect(html).not.toContain('Explain')
    expect(html).not.toContain('Covert')
  })

  it('places authoritative per-target Skill misses under the action without inventing misses from absent results', () => {
    const html = render([
      entry(1, 0, 'combat_accuracy_resolved', { templateValues: { outcome: 'MISSED' } }),
      { ...technique(1), eventIndex: 1 },
      technique(2),
    ])
    expect(html.match(/data-chronicle-action=/gu)).toHaveLength(2)
    expect(html).toContain('The skill misses Weon.')
    expect(html.match(/Action recorded; no effect result available\./gu)).toHaveLength(1)
    expect(html.indexOf('Hollow Reflection')).toBeLessThan(html.indexOf('The skill misses'))
  })

  it('shows a recorded Skill hit without damage but omits redundant hits when damage is recorded', () => {
    const html = render([
      entry(1, 0, 'combat_accuracy_resolved', { templateValues: { outcome: 'HIT' } }),
      { ...technique(1), eventIndex: 1 },
      entry(2, 0, 'combat_accuracy_resolved', { templateValues: { outcome: 'HIT' } }),
      { ...technique(2), eventIndex: 1 },
      entry(2, 2, 'damage_applied', { templateValues: { amount: '8' } }),
    ])
    expect(html.match(/The skill hits Weon\./gu)).toHaveLength(1)
    expect(html.replace(/<[^>]+>/gu, '')).toContain('8 damage to Weon')
  })

  it('marks every named action start consistently without marking its outcomes or movement', () => {
    const html = render([
      technique(1, actor, 'Basic Attack'),
      entry(1, 1, 'damage_applied', { templateValues: { amount: '10' } }),
      technique(2),
      entry(3, 0, 'combatant_moved'),
    ])
    expect(html.match(/data-chronicle-action-start="true"/gu)).toHaveLength(2)
    expect(html.match(/aria-hidden="true" data-chronicle-action-start/gu)).toHaveLength(2)
    expect(html).toContain('Basic Attack')
    expect(html).toContain('Hollow Reflection')
  })
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
    expect(html).toContain('Action recorded; no effect result available.')
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
    expect(html).toContain('Root will take effect on Weon at the start of round 3!')
    expect(html).not.toContain('Root pending')
    expect(html).toContain('gained 9 Barrier.')
  })
  it('uses recorded activation timing and recipients, without inventing a round when metadata is missing', () => {
    const html = render([
      technique(1),
      entry(1, 1, 'effect_pending', {
        statusId: 'root',
        templateValues: { effect: 'Root', activation: ' until round 6' },
      }),
      technique(2),
      entry(2, 1, 'effect_pending', {
        statusId: 'slow',
        targetCombatantId: actor,
        templateValues: { effect: 'Slow' },
      }),
    ])
    expect(html).toContain('Root will take effect on Weon at the start of round 6!')
    expect(html).toContain('Slow will take effect on Zei at the start of a future round!')
    expect(html).not.toContain('round undefined')
  })
})
