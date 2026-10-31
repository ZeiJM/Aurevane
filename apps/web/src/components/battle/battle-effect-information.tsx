import { battleTagDescription } from '@/lib/battle/battle-tag-wording'
import type { ReactNode, RefObject } from 'react'
import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  terrainBattleEffectPresentation,
  primedBattleEffectPresentation,
  reversalBattleEffectPresentation,
  type BattlePresentedStatus,
} from '@/lib/battle/battle-elevation-effects'
import { mechanicTagExplanation } from '../character/mechanic-tag-explanation'
import { gameplayStatusName } from '@/lib/battle/combat-interaction-presentation'
import { BattleInfoPopover } from './battle-info-popover'
import { CompactEffectSummary } from '../character/compact-skill-effect-summary'
import { describeBattleEffect } from './battle-effect-identity'
import { summarizeBattleEffects } from './battle-effect-summary'
import { battleEffectAmountInformation } from './battle-effect-amount-information'
import { battleEffectStrengthInformation } from './battle-effect-strength-information'
import { battleEffectRecoveryStrengthInformation } from './battle-effect-recovery-strength-information'
import {
  capturedBattleEffectStatus,
  hasCapturedApplicationStacking,
} from '@/lib/battle/battle-effect-captured-policy'

const presentationFamilies = new Set([
  'mp-drain',
  'mp-recovery',
  'create-terrain',
  'displace',
  'push',
  'pull',
  'barrier',
  'barrier-change',
  'return-to-turn-start',
  'remove-status',
  'copy-statuses',
  'sensory',
  'summon',
  'damage',
  'healing',
])

/** Read only viewer-projected instances; never reconstruct their source or execution data. */
export function battleEffectInformation(effect: BattlePresentedStatus) {
  const perApplication = hasCapturedApplicationStacking(effect)
  const effective = capturedBattleEffectStatus(effect)
  const details = describeBattleEffect(effective)
  const known = Boolean(
    PV1F_COMBAT_CONTENT.statuses.some(
      (row) => row.id === effect.statusId && row.version === effect.statusVersion,
    ) ||
    (effect.statusVersion === 1 && presentationFamilies.has(effect.statusId)) ||
    terrainBattleEffectPresentation(effect) !== null ||
    primedBattleEffectPresentation(effect) !== null ||
    reversalBattleEffectPresentation(effect) !== null,
  )
  const label = known ? details.label : gameplayStatusName(effect.statusId)
  const baseDescription = !known
    ? 'Captured effect rules unavailable.'
    : effect.elementalDamagePolicyVersion === undefined &&
        effect.effectStackingPolicyVersion !== 1 &&
        (effect.statusId === 'wet' || effect.statusId === 'conductive')
      ? mechanicTagExplanation(effect.statusId, { legacyElemental: true })
      : details.description
  const timing =
    effect.timingState === 'pending' && effect.activationRound === undefined
      ? 'Pending · Activation round unavailable'
      : details.timing
  const incoming = known ? summarizeBattleEffects([effective])[0]?.value : undefined
  const capturedApplications =
    known && perApplication && (effect.applicationModifiers?.length ?? 0) > 1
      ? effect.applicationModifiers!.map((application, index) => {
          const text = describeBattleEffect({
            ...effect,
            ...application,
            potencyBasisPoints: application.potencyBasisPoints,
            blindsideModifiersBasisPoints: application.blindsideModifiersBasisPoints,
            applicationModifiers: undefined,
          }).description
          return `Application ${index + 1}: ${application.stacks} stack${application.stacks === 1 ? '' : 's'} · ${text}`
        })
      : []
  const applications = effect.battleTag ? [] : capturedApplications
  const description = battleTagDescription(
    effect.battleTag,
    capturedApplications.length ? capturedApplications.join(' ') : baseDescription,
  )
  const summary = incoming ? `Incoming damage from this effect: ${incoming}.` : null
  const amountFacts = known ? battleEffectAmountInformation(effect) : { rows: [], notes: [] }
  const strengths = known ? battleEffectStrengthInformation(effect) : { rows: [], notes: [] }
  const recoveryStrengths = known
    ? battleEffectRecoveryStrengthInformation(effect)
    : { rows: [], notes: [] }
  const amounts = {
    rows: [...amountFacts.rows, ...strengths.rows, ...recoveryStrengths.rows],
    notes: [...amountFacts.notes, ...strengths.notes, ...recoveryStrengths.notes],
  }
  const amountExplanation = [
    ...amounts.rows.map((row) => `${row.label}: ${row.magnitude}.`),
    ...amounts.notes,
  ].join(' ')
  return {
    ...details,
    label,
    identifier: known ? details.identifier : `id:${effect.statusId}`,
    kind: known ? details.kind : 'Effect',
    description,
    timing,
    summary,
    incoming,
    applications,
    amounts,
    explanation: `${known ? details.kind : 'Effect'} · ${description} ${timing} · ${details.duration} ${effect.stacks} stack${effect.stacks === 1 ? '' : 's'}.${summary ? ` ${summary}` : ''}${amountExplanation ? ` ${amountExplanation}` : ''}`,
  }
}

function Information({
  effect,
  report,
}: {
  effect: BattlePresentedStatus
  report: ReturnType<typeof battleEffectInformation>
}) {
  return (
    <div data-battle-live-effect-information={effect.statusId}>
      <p>
        <strong>{report.kind}</strong>
        {report.applications.length ? null : <> · {report.description}</>}
      </p>
      <p>
        {report.timing} · {report.duration}
      </p>
      <p>
        {effect.stacks} stack{effect.stacks === 1 ? '' : 's'}
      </p>
      {report.summary ? (
        <p>
          <CompactEffectSummary
            parts={{
              label: 'Incoming damage from this effect',
              magnitude: report.incoming ?? null,
              duration: null,
            }}
          />
        </p>
      ) : null}
      {report.amounts.rows.map((row) => (
        <p key={row.label}>
          <CompactEffectSummary parts={{ ...row, duration: null }} />
        </p>
      ))}
      {report.amounts.notes.map((note) => (
        <p key={note}>{note}</p>
      ))}
      {report.applications.length ? (
        <ul aria-label="Captured applications">
          {report.applications.map((text, index) => (
            <li key={index}>{text}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function BattleEffectInformation({ effect }: { effect: BattlePresentedStatus }) {
  return <Information effect={effect} report={battleEffectInformation(effect)} />
}

/** Native effect chips share the same captured report and one popup owner. */
export function BattleEffectPopover({
  effect,
  trigger,
  className,
  layer = 'battle',
  portalHost,
}: {
  effect: BattlePresentedStatus
  trigger: ReactNode
  className?: string
  layer?: 'battle' | 'inspect'
  portalHost?: RefObject<HTMLElement | null>
}) {
  const report = battleEffectInformation(effect)
  return (
    <BattleInfoPopover
      label={`Explain ${report.label}, ${report.timing} · ${report.duration}`}
      title={report.label}
      description={report.explanation}
      trigger={trigger}
      className={className}
      layer={layer}
      hover
      nested
      referenceTrigger
      effectTrigger
      portalHost={portalHost}
      consumeOutsideClick
    >
      <Information effect={effect} report={report} />
    </BattleInfoPopover>
  )
}
