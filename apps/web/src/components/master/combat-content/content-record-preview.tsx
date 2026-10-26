'use client'
import { Component, useState, type ReactNode } from 'react'
import {
  bindCombatTagPresentations,
  type CombatTagPresentationSnapshot,
} from '@aurevane/game-core/combat/combat-tag-registry'
import type { CombatContentDefinition, CombatContentKind } from '@aurevane/db/combat-content'
import {
  BASIC_SKILL_IDS,
  type BasicSkillDefinition,
} from '@aurevane/game-core/combat/combat-basic-actions'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import type { AnyResonanceDefinition } from '@aurevane/game-core/combat/resonance'
import {
  validateAbilityDefinition,
  type AbilityDefinition,
} from '@aurevane/game-core/combat/combat-definition'
import type { AbilityPresentationText } from '@aurevane/game-core/combat/battle-narration'
import {
  abilityPresentationContext,
  abilityPresentationValues,
} from '@aurevane/game-core/combat/battle-narration'
import { projectPublicCombat } from '@aurevane/game-core/combat/public-combat-presentation'
import {
  contentMediaSource,
  type FinalizedContentMediaSlots,
} from '@aurevane/game-core/combat/content-media'
import { PHASE4_STATUSES } from '@aurevane/game-core/combat/status-content'
import { SkillDetails } from '@/components/character/skill-details'
import { SkillParameters } from '@/components/character/skill-parameters'
import { ResonanceParameters } from '@/components/character/resonance-parameters'
import { BattleCombatantEffects } from '@/components/battle/battle-combatant-effects'
import { BattleLogFeed } from '@/components/battle/battle-log-feed'
import type { BattleLogEntry } from '@/server/battle/battle-log-service'
import { objectValue } from './content-definition-fields'
import Image from 'next/image'
import { contentRecordName } from './content-record-workflow'
import { ContentNativeSample } from './content-native-sample'
class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <p>Complete the definition to render this preview. Your edits are retained.</p>
    ) : (
      this.props.children
    )
  }
}
function SharedPreview({
  kind,
  definition,
  actor,
  target,
  amount,
  tagPresentations,
}: {
  kind: CombatContentKind
  definition: CombatContentDefinition
  actor: string
  target: string
  amount: number
  tagPresentations: readonly CombatTagPresentationSnapshot[]
}) {
  const originalBody = kind === 'essence' ? objectValue(definition.skill) : definition
  if (
    Object.hasOwn(originalBody, 'ability') &&
    validateAbilityDefinition(originalBody.ability).length > 0
  )
    return <p>Resolve Ability compatibility to show the player preview.</p>
  // This is a current authoring preview, never an exact/captured-history reader.
  // Bind only the copied presentation view; Save/Publish retain the raw definition.
  const safe = projectPublicCombat(bindCombatTagPresentations(definition, tagPresentations))
  const body = kind === 'essence' ? objectValue(safe.skill) : safe
  const name = contentRecordName(safe)
  const basic =
    kind === 'skill' && (BASIC_SKILL_IDS as readonly string[]).includes(String(body.id))
      ? (body as unknown as BasicSkillDefinition)
      : undefined
  const stats = basic ? { physicalPower: 100, mysticPower: 80, move: 5, jump: 2 } : undefined
  const ability = body.ability as AbilityDefinition | undefined
  const media = objectValue(body.media) as FinalizedContentMediaSlots
  const artwork = media.artwork ? contentMediaSource(media.artwork, true) : null
  const audio = media.audio ? contentMediaSource(media.audio, true) : null
  const context = abilityPresentationContext(body, 'result')
  const outcome = context.outcomes?.includes('healing')
    ? 'healing'
    : context.outcomes?.includes('damage')
      ? 'damage'
      : null
  const presentation = body.presentation as AbilityPresentationText | undefined
  const base: BattleLogEntry = {
    battleVersion: 1,
    eventIndex: 0,
    occurredAt: '2000-01-01T00:00:00.000Z',
    eventType: 'combat_action_used',
    message: `${actor} uses ${name}.`,
    messageTemplate: '{actor} uses {action}.',
    templateValues: { actor, action: name },
    actorCombatantId: 'sample-author',
    targetCombatantId: 'sample-target',
    actionId: 'sample-action',
    actionLabel: name,
    round: 1,
    turnNumber: 1,
    kind: 'offense',
    headline: name,
    tone: 'neutral',
    facts: [],
    actionContext: {
      family: kind === 'essence' ? 'essence' : kind === 'resonance' ? 'resonance' : 'skill',
      contentId: String(safe.id ?? safe.essenceId),
      skillId: String(body.id ?? safe.id),
      contentVersion: Number(safe.contentVersion ?? 1),
      name,
      description: String(safe.description ?? ''),
      flavor: typeof safe.flavorLine === 'string' ? safe.flavorLine : null,
      battleText:
        presentation?.activation ??
        (typeof body.battleText === 'string' ? body.battleText : undefined),
      presentation: presentation
        ? { ...presentation, values: abilityPresentationValues(body) }
        : undefined,
      narrator: { actor: { name: actor }, target: { name: target } },
    },
  }
  const recoversMp = ability?.behaviors.some((group) =>
    group.effects.some(
      (effect) => effect.payload.type === 'percentage-recovery' && effect.payload.resource === 'mp',
    ),
  )
  const messages: BattleLogEntry[] = outcome
    ? [
        base,
        {
          ...base,
          eventIndex: 1,
          eventType: outcome === 'healing' ? 'healing_applied' : 'damage_applied',
          kind: outcome === 'healing' ? ('recovery' as const) : ('offense' as const),
          tone: outcome === 'healing' ? ('healing' as const) : ('damage' as const),
          templateValues: { amount: String(amount) },
          message: `${target}: ${amount} ${outcome}.`,
        },
      ]
    : recoversMp
      ? [
          base,
          {
            ...base,
            eventIndex: 1,
            eventType: 'resource_changed',
            kind: 'recovery',
            tone: 'benefit',
            templateValues: { amount: String(amount), direction: 'gained', resource: 'MP' },
            message: `${target} recovers ${amount} MP.`,
          },
        ]
      : [base]
  const statuses = (
    ability?.behaviors.flatMap((group) => group.effects.map((effect) => effect.payload)) ?? []
  ).flatMap((payload) => {
    if (payload.type !== 'apply-status') return []
    const status = PHASE4_STATUSES.find((entry) => entry.id === payload.statusId)
    return status
      ? [
          {
            statusId: status.id,
            statusVersion: status.version,
            stacks: payload.stacks,
            remainingOwnerTurnStarts: payload.durationTurns ?? status.durationOwnerTurnStarts,
            sourceCombatantId: 'sample-author',
            potencyBasisPoints: payload.potencyBasisPoints,
          },
        ]
      : []
  })
  const combat = kind === 'skill' || kind === 'essence' || kind === 'resonance'
  return (
    <>
      <h4>Preview: {name}</h4>
      <p>{String(safe.description ?? '')}</p>
      {artwork ? (
        <Image src={artwork} alt={`${name} artwork`} width={160} height={160} unoptimized />
      ) : null}
      {audio ? <audio src={audio} controls preload="none" aria-label={`${name} sound`} /> : null}
      {basic ? (
        <p>
          Illustrative character: Physical Power 100, Mystic Power 80, Movement 5, Jump 2. Formulas
          retain the edited Basic rules.
        </p>
      ) : null}
      {combat ? (
        <>
          <details open>
            <summary>Compact information</summary>
            {kind === 'resonance' ? (
              <ResonanceParameters definition={safe as unknown as AnyResonanceDefinition} />
            ) : (
              <SkillParameters
                skill={body as unknown as MatureSkillDefinition}
                basic={basic}
                stats={stats}
              />
            )}
          </details>
          <details>
            <summary>Full Skill information</summary>
            {kind === 'resonance' ? (
              <ResonanceParameters definition={safe as unknown as AnyResonanceDefinition} />
            ) : (
              <SkillDetails
                skill={body as unknown as MatureSkillDefinition}
                basic={basic}
                stats={stats}
                expanded
              />
            )}
          </details>
          {statuses.length ? (
            <>
              <p>Illustrative active effects from this definition.</p>
              <BattleCombatantEffects name={target} statuses={statuses} />
            </>
          ) : (
            <p>No applicable active status container in this sample.</p>
          )}
          <h4>Sample messages</h4>
          <BattleLogFeed
            entries={messages}
            combatantNames={{ 'sample-author': actor, 'sample-target': target }}
            hideFlowViewControl
            flowView="text"
          />
        </>
      ) : kind === 'tag' ? (
        <>
          <strong>{String(safe.name)}</strong>
          <p>{String(safe.explanation ?? safe.description)}</p>
        </>
      ) : (
        <p>
          {kind === 'discipline'
            ? 'Public Discipline description and artwork. Linked Skill previews use their own records.'
            : 'Saved authoring preview. This category has no playable runtime container.'}
        </p>
      )}
    </>
  )
}
export function ContentRecordPreview({
  kind,
  working,
  saved,
  current,
  tagPresentations = [],
}: {
  kind: CombatContentKind
  working: CombatContentDefinition
  saved: CombatContentDefinition | null
  current: CombatContentDefinition | null
  tagPresentations?: readonly CombatTagPresentationSnapshot[]
}) {
  const [view, setView] = useState<'working' | 'saved' | 'current' | 'compare'>('working')
  const [actor, setActor] = useState('Sample author'),
    [target, setTarget] = useState('Sample target'),
    [amount, setAmount] = useState(37)
  const selected = view === 'saved' ? saved : view === 'current' ? current : working
  return (
    <>
      <h3>Preview</h3>
      <label>
        Preview version
        <select
          value={view}
          onChange={(event) => setView(event.currentTarget.value as typeof view)}
        >
          <option value="working">Local draft</option>
          <option value="saved" disabled={!saved}>
            Saved draft
          </option>
          <option value="current" disabled={!current}>
            Published
          </option>
          <option value="compare" disabled={!current}>
            Draft / Published comparison
          </option>
        </select>
      </label>
      <details>
        <summary>Illustrative sample context</summary>
        <label>
          Sample actor
          <input
            value={actor}
            maxLength={80}
            onChange={(event) => setActor(event.currentTarget.value)}
          />
        </label>
        <label>
          Sample target
          <input
            value={target}
            maxLength={80}
            onChange={(event) => setTarget(event.currentTarget.value)}
          />
        </label>
        <label>
          Recorded result amount
          <input
            type="number"
            value={amount}
            min={0}
            max={999999}
            onChange={(event) => setAmount(Math.max(0, Number(event.currentTarget.value)))}
          />
        </label>
        <p>
          Names and result amount illustrate message references. This does not simulate a battle or
          an equipped Resonance match.
        </p>
      </details>
      {view === 'compare' && current ? (
        <>
          <h4>Published</h4>
          <PreviewBoundary key={`current:${JSON.stringify(current)}`}>
            <SharedPreview
              kind={kind}
              definition={current}
              actor={actor}
              target={target}
              amount={amount}
              tagPresentations={tagPresentations}
            />
          </PreviewBoundary>
          <h4>Local draft</h4>
        </>
      ) : null}
      {['skill', 'essence', 'resonance'].includes(kind) && selected ? (
        <ContentNativeSample kind={kind} definition={selected} />
      ) : null}
      {selected ? (
        <PreviewBoundary key={JSON.stringify(selected)}>
          <SharedPreview
            kind={kind}
            definition={selected}
            actor={actor}
            target={target}
            amount={amount}
            tagPresentations={tagPresentations}
          />
        </PreviewBoundary>
      ) : (
        <p>No saved version.</p>
      )}
    </>
  )
}
