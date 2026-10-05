import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { BattleLogEntry } from '@/server/battle/battle-log-service'

import { formatBattleLogForClipboard } from './battle-log-clipboard'
import { BattleLogFeed } from './battle-log-feed'

const actor = 'character:storm'
const enemy = 'recruit:weon'
const names = { [actor]: 'Storm', [enemy]: 'Weon' }
const options = { playerName: 'Storm', combatantNames: names }

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
    occurredAt: '2026-10-04T00:08:51.017Z',
    message: 'RAW ENGINE DIAGNOSTICS v99.0 62% hit chance',
    messageTemplate: eventType,
    templateValues: {},
    actorCombatantId: actor,
    targetCombatantId: enemy,
    actionId: 'skill.reflection',
    actionLabel: 'Hollow Reflection',
    round: 1,
    turnNumber: 1,
    kind: 'offense',
    headline: 'Hollow Reflection',
    tone: 'neutral',
    facts: [],
    ...overrides,
  }
}

function technique(version: number, overrides: Partial<BattleLogEntry> = {}) {
  return entry(version, 0, 'combat_action_used', {
    actionContext: {
      skillId: 'skill.reflection',
      contentVersion: 4,
      name: 'Hollow Reflection',
      description: 'Internal mechanical detail excluded from narration.',
      flavor: '{actor} follows a pale plane into the opening.',
    },
    ...overrides,
  })
}

/** Read the actual rendered headings and paragraphs, including collapsed round content. */
function displayedLines(entries: readonly BattleLogEntry[], currentRound = 4) {
  const html = renderToStaticMarkup(
    createElement(BattleLogFeed, { entries, ...options, currentRound }),
  ).replace(/<span\b[^>]*aria-hidden="true"[^>]*>[^]*?<\/span>/gu, '')
  return Array.from(html.matchAll(/<(h[234]|p)\b[^>]*>([^]*?)<\/\1>/gu), ([, , content]) =>
    content
      .replace(/<[^>]+>/gu, '')
      .replace(/&#x27;/gu, "'")
      .replace(/&quot;/gu, '"')
      .replace(/&lt;/gu, '<')
      .replace(/&gt;/gu, '>')
      .replace(/&amp;/gu, '&')
      .trim(),
  ).filter(Boolean)
}

function expectDisplayParity(entries: readonly BattleLogEntry[], expected: readonly string[]) {
  const copied = formatBattleLogForClipboard(entries, options)
  expect(copied.split('\n').filter(Boolean)).toEqual(expected)
  expect(copied.split('\n').filter(Boolean)).toEqual(displayedLines(entries))
  expect(copied).not.toMatch(/RAW ENGINE|\bv\d+\.\d+\b|#\d+:|&#(?:\w+);|&amp;/u)
}

describe('Battle Chronicle clipboard transcript', () => {
  it('copies the actor-grouped displayed wording and all rounds, including collapsed history', () => {
    const entries = [
      entry(1, 0, 'combatant_moved'),
      entry(2, 0, 'combatant_moved'),
      technique(3),
      entry(3, 1, 'damage_applied', { templateValues: { amount: '8' } }),
      technique(4, {
        actorCombatantId: enemy,
        actionId: 'basic.guard',
        actionLabel: 'Guard',
        actionContext: undefined,
      }),
      entry(4, 1, 'status_applied', {
        actorCombatantId: enemy,
        targetCombatantId: enemy,
        statusId: 'guarded',
        templateValues: { status: 'Guarded' },
        facts: [{ label: '1 turn', tone: 'neutral' }],
      }),
      technique(5, { round: 4 }),
      entry(5, 1, 'combat_accuracy_resolved', {
        round: 4,
        templateValues: { outcome: 'MISSED' },
      }),
    ]
    expectDisplayParity([...entries].reverse(), [
      'ROUND 1',
      'Storm',
      'Storm moves.',
      'Hollow Reflection',
      'Storm follows a pale plane into the opening.',
      '8 damage to Weon',
      'Weon',
      'Guard',
      'Weon settles into a guarded stance.',
      'Guarded, 1 turn',
      'ROUND 4',
      'Storm',
      'Hollow Reflection',
      'Storm follows a pale plane into the opening.',
      'The skill misses Weon.',
    ])
  })

  it('keeps pinned narration names, pronouns, source families and plain punctuation', () => {
    expectDisplayParity(
      [
        technique(1, {
          actionContext: {
            skillId: 'skill.reflection',
            contentVersion: 4,
            family: 'essence',
            name: "Storm's Light & Shadow",
            description: 'Do not copy this mechanical description.',
            battleText:
              '{actor} lifts {actor.possessive} hand toward {target}; {target.subject} retreats.',
            flavor: 'Retired prose must not replace the pinned battle text.',
            narrator: {
              actor: { name: 'Storm at the battle', pronounPresetId: 'she_her' },
              target: { name: 'Weon at the battle', pronounPresetId: 'he_him' },
            },
          },
        }),
        entry(1, 1, 'damage_applied', { templateValues: { amount: '12' } }),
      ],
      [
        'ROUND 1',
        'Storm at the battle',
        "ESSENCE · Storm's Light & Shadow",
        'Storm at the battle lifts her hand toward Weon at the battle; he retreats.',
        '12 damage to Weon at the battle',
      ],
    )
  })

  it('copies recorded DoT ticks, stacked effects, pending timing and nested Resonance outcomes', () => {
    expectDisplayParity(
      [
        technique(1),
        entry(1, 1, 'status_applied', {
          statusId: 'bleed',
          templateValues: { status: 'Bleed', stacks: '3' },
          facts: [{ label: '2 turns', tone: 'neutral' }],
        }),
        entry(1, 2, 'effect_pending', {
          statusId: 'root',
          templateValues: { effect: 'Root', activation: ' until round 3' },
        }),
        entry(1, 3, 'resonance_activated', {
          actionId: 'resonance.quarry-edge',
          actionContext: {
            skillId: 'resonance.quarry-edge',
            contentId: 'resonance.quarry-edge',
            contentVersion: 2,
            family: 'resonance',
            name: 'Quarry Edge',
            description: 'Passive mechanics.',
            flavor: "The hunt answers {actor}'s call.",
          },
        }),
        entry(1, 4, 'resource_changed', {
          targetCombatantId: actor,
          templateValues: { amount: '3', direction: 'gained', resource: 'MP' },
          effectOrigin: {
            family: 'resonance',
            contentId: 'resonance.quarry-edge',
            contentVersion: 2,
          },
        }),
        entry(2, 0, 'damage_applied', {
          round: 3,
          periodicStatusId: 'bleed',
          templateValues: { amount: '4' },
        }),
      ],
      [
        'ROUND 1',
        'Storm',
        'Hollow Reflection',
        'Storm follows a pale plane into the opening.',
        'Bleed, 2 turns · ×3 to Weon · Root will take effect on Weon at the start of round 3!',
        'Resonance · Quarry Edge',
        "The hunt answers Storm's call.",
        '+3 MP',
        'ROUND 3',
        'Storm',
        'Hollow Reflection',
        "Weon's wounds reopen · Bleed deals 4 damage",
      ],
    )
  })

  it('keeps successful summons and missing-result wording exactly as the reader', () => {
    expectDisplayParity(
      [
        technique(1),
        entry(1, 1, 'summon_spawned', { targetCombatantId: 'summon:stalker' }),
        technique(2),
      ],
      [
        'ROUND 1',
        'Storm',
        'Hollow Reflection',
        'Storm follows a pale plane into the opening.',
        'Hollow Reflection',
        'Storm follows a pale plane into the opening.',
        'Action recorded; no effect result available.',
      ],
    )
  })

  it('retains viewer-authorized summon ability names after the live summon is absent', () => {
    expectDisplayParity(
      [
        technique(1, {
          actorCombatantId: 'summon:expired',
          targetCombatantId: actor,
          actionId: 'summon.verdant-mend',
          actionLabel: 'Verdant Mend',
          actionContext: {
            skillId: 'summon.verdant-mend',
            contentVersion: 4,
            name: 'Verdant Mend',
            description: 'Recorded summon ability.',
            flavor: null,
            battleText: '{actor} weaves living roots around {target}.',
            narrator: { actor: { name: 'Verdant Stalker' } },
          },
        }),
        entry(1, 1, 'healing_applied', {
          actorCombatantId: 'summon:expired',
          targetCombatantId: actor,
          templateValues: { amount: '4' },
        }),
      ],
      [
        'ROUND 1',
        'Verdant Stalker',
        'Verdant Mend',
        'Verdant Stalker weaves living roots around Storm.',
        '+4 HP to Storm',
      ],
    )
  })

  it('copies proven idle narration and viewer-redacted actions without reconstructing private skills', () => {
    expectDisplayParity(
      [
        entry(1, 0, 'turn_started'),
        entry(2, 0, 'final_facing_selected'),
        entry(2, 1, 'turn_ended'),
        entry(3, 0, 'hidden_combat_action', {
          actorCombatantId: enemy,
          targetCombatantId: null,
          actionId: null,
          actionLabel: null,
          headline: 'Concealed action',
          message: 'PRIVATE SKILL NAME',
          messageTemplate: '{actor} uses a concealed action.',
        }),
      ],
      [
        'ROUND 1',
        'Storm',
        'Storm stands around and does nothing.',
        'Weon',
        'Concealed action',
        'Weon uses a concealed action.',
      ],
    )
  })
})
