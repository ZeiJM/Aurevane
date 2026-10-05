import React from 'react'
import { createRoot } from 'react-dom/client'
import { BattleCompletionPanel } from '@/components/battle/battle-completion-panel'
import { PvpBattleCompletionPanel } from '@/components/battle/pvp-battle-completion-panel'
import { BattleRuntimeProvider } from '@/components/battle/battle-runtime-context'
import './production-styles'

const query = new URLSearchParams(location.search)
const mode = query.get('mode') || 'pve'
const result = query.get('result') || 'victory'
const record = query.get('record') || 'recruit-sparring'
const actor = 'character:wayfarer'
const opponent = 'character:recruit'
const names = { [actor]: 'Wayfarer', [opponent]: 'Recruit' }
const combatants = [
  { id: actor, teamId: 'players', hp: result === 'victory' ? 91 : 0, maxHp: 142 },
  { id: opponent, teamId: 'opponents', hp: result === 'defeat' ? 37 : 0, maxHp: 80 },
]
// Completed session and committed-log API projections, consumed by the real renderers.
const battle = {
  battleSessionId: 'completion-fit',
  battleVersion: 61,
  replayed: false,
  invalidation: null,
  snapshot: {
    tactical: { width: 9, height: 7, battle: { lifecycle: 'completed', round: 8, combatants } },
    statBridge: {
      combatants: [
        { provenance: { kind: 'character-derived', sourceId: actor } },
        {
          provenance: {
            kind: 'scenario',
            sourceId: `scenario:p2-7-recruit:duel-yard:${record}:standard`,
          },
        },
      ],
    },
  },
}
const metadata = {
  mode: '1v1',
  localCharacterId: 'wayfarer',
  participants: combatants.map((combatant, index) => ({
    combatantId: combatant.id,
    characterId: index === 0 ? 'wayfarer' : 'recruit',
    characterName: names[combatant.id],
    teamIndex: index,
  })),
}
const entries = Array.from({ length: 60 }, (_, index) => {
  const base = {
    battleVersion: index + 1,
    occurredAt: new Date(Date.UTC(2026, 9, 5, 0, 0, index)).toISOString(),
    actorCombatantId: index % 2 === 0 ? actor : opponent,
    targetCombatantId: index % 2 === 0 ? opponent : actor,
    actionId: 'basic.attack.unarmed.basic',
    actionLabel: 'Basic Attack',
    round: 8,
    turnNumber: 15,
    kind: 'offense',
    headline: 'Basic Attack',
    facts: [],
  }
  return [
    {
      ...base,
      eventIndex: 0,
      eventType: 'combat_action_used',
      message: `${names[base.actorCombatantId]} used Basic Attack.`,
      messageTemplate: '{actor} used {action}.',
      templateValues: { action: 'Basic Attack' },
      tone: 'neutral',
    },
    {
      ...base,
      eventIndex: 1,
      eventType: 'damage_applied',
      message: `${names[base.targetCombatantId]} took 12 damage.`,
      messageTemplate: '{target} took {amount} damage.',
      templateValues: { amount: '12' },
      tone: 'damage',
      facts: [{ label: '12 DMG', tone: 'damage' }],
    },
  ]
}).flat()
window.completionFixture = { calls: [], copied: [], failure: null, entries }
window.fetch = async (input, options = {}) => {
  const url = typeof input === 'string' ? input : input.url
  window.completionFixture.calls.push({ url, method: options.method || 'GET' })
  if (url.endsWith('/events'))
    return Response.json(
      window.completionFixture.failure === 'events'
        ? { error: { message: 'Battle history is temporarily unavailable.' } }
        : { battleLog: { battleSessionId: battle.battleSessionId, entries } },
      { status: window.completionFixture.failure === 'events' ? 503 : 200 },
    )
  if (url.endsWith('/mastery'))
    return Response.json(
      window.completionFixture.failure === 'mastery'
        ? { error: { message: 'The Mastery result could not be saved.' } }
        : { mastery: { awardedXp: 50, xp: 450, replayed: false } },
      { status: window.completionFixture.failure === 'mastery' ? 503 : 200 },
    )
  throw new Error(`Unexpected completion request: ${url}`)
}
Object.defineProperty(navigator, 'clipboard', {
  configurable: true,
  value: {
    writeText: async (text) => {
      if (window.completionFixture.failure === 'copy') throw new Error('Clipboard unavailable')
      window.completionFixture.copied.push(text)
    },
  },
})
createRoot(document.getElementById('root')).render(
  <BattleRuntimeProvider playerName="Wayfarer" combatantNames={names}>
    {mode === 'pvp' ? (
      <PvpBattleCompletionPanel initialBattle={battle} metadata={metadata} />
    ) : (
      <BattleCompletionPanel battle={battle} />
    )}
  </BattleRuntimeProvider>,
)
