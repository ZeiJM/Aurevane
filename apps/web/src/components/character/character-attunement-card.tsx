'use client'

import Image from 'next/image'
import type { EssenceDefinition } from '@aurevane/game-core/combat/essence'
import type { ResonanceDefinition } from '@aurevane/game-core/combat/resonance'
import { useState } from 'react'

import {
  battleResonanceArtwork,
  battleSkillArtwork,
} from '@/components/battle/battle-skill-presentation'

import {
  skillCompactRangeDescription,
  skillCooldownDescription,
  skillCostDescription,
  skillEffectSummaries,
  skillLineOfSightDescription,
  skillRequirementsSummary,
  skillTargetDescription,
  skillTargetElevationDescription,
  skillTargetMethodDescription,
  skillTypeDescription,
} from './skill-detail-presentation'
import { effectSummary, previewEffect, skillPreviewEffects } from './skill-effect-preview'
import styles from './character-arsenal-shell.module.css'

type AttunementPreviewCardProps =
  | { readonly kind: 'essence'; readonly definition: EssenceDefinition }
  | { readonly kind: 'resonance'; readonly definition: ResonanceDefinition }

function shortSummary(description: string): string {
  const firstSentence = description.split(/(?<=[.!?])\s+/u)[0]?.trim() ?? description.trim()
  return firstSentence || 'A current attunement effect.'
}

function titleIdentity(value: string): string {
  return value
    .split(/[._-]/gu)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function DefinitionList({
  rows,
}: {
  readonly rows: readonly (readonly [string, string | readonly string[]])[]
}) {
  return (
    <dl className={styles.attunementPreviewFacts}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>
            {typeof value === 'string' ? (
              value
            ) : (
              <ul>
                {value.map((entry, index) => (
                  <li key={`${index}:${entry}`}>{entry}</li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function CharacterAttunementCard(props: AttunementPreviewCardProps) {
  const [open, setOpen] = useState(false)
  const isEssence = props.kind === 'essence'
  const name = props.definition.name
  const description = props.definition.description
  const art = isEssence
    ? battleSkillArtwork(props.definition.skill.id)
    : battleResonanceArtwork(props.definition.id)

  const rows: readonly (readonly [string, string | readonly string[]])[] = isEssence
    ? [
        ['Skill Type', skillTypeDescription(props.definition.skill)],
        ['Cost', skillCostDescription(props.definition.skill)],
        ['Cooldown', skillCooldownDescription(props.definition.skill)],
        ['Requirements', skillRequirementsSummary(props.definition.skill)],
        ['Effects', skillEffectSummaries(props.definition.skill)],
        ['Range', skillCompactRangeDescription(props.definition.skill)],
        ['Target', skillTargetDescription(props.definition.skill)],
        ['Target Method', skillTargetMethodDescription(props.definition.skill)],
        ['Target Elevation', skillTargetElevationDescription(props.definition.skill)],
        ['Line of Sight', skillLineOfSightDescription(props.definition.skill)],
      ]
    : [
        [
          'Setup Requirements',
          `${titleIdentity(props.definition.trigger.setup.sourceDisciplineId)}: ${props.definition.trigger.setup.requiredTags.map(titleIdentity).join(' + ')}`,
        ],
        [
          'Payoff Requirements',
          `${titleIdentity(props.definition.trigger.payoff.sourceDisciplineId)}: ${props.definition.trigger.payoff.requiredTags.map(titleIdentity).join(' + ')}`,
        ],
        [
          'Effects',
          props.definition.trigger.payoffEffects.map((effect) => effectSummary(previewEffect(effect))),
        ],
        ['Trigger', 'Use a matching setup Skill, then a matching payoff Skill.'],
        ['Cooldown', 'N/A'],
      ]

  const explanations = isEssence
    ? skillPreviewEffects(props.definition.skill)
    : props.definition.trigger.payoffEffects.map(previewEffect)

  return (
    <article
      className={styles.attunementCard}
      data-active="true"
      onMouseLeave={() => setOpen(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <button
        type="button"
        className={styles.attunementArtButton}
        aria-label={`Preview ${props.kind} ${name}`}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onFocus={() => setOpen(true)}
      >
        <span className={styles.attunementArt}>
          <Image src={art} width={64} height={64} unoptimized alt="" />
        </span>
      </button>
      <div>
        <strong>{isEssence ? `Essence: ${name}` : `Resonance: ${name}`}</strong>
        <p>{shortSummary(description)}</p>
        <b>● Active</b>
      </div>

      {open ? (
        <aside className={styles.attunementPreview} role="tooltip">
          <header>
            <span className={styles.attunementPreviewArt}>
              <Image src={art} width={128} height={128} unoptimized alt="" />
            </span>
            <div>
              <small>{isEssence ? 'Essence Preview' : 'Resonance Preview'}</small>
              <strong>{name}</strong>
            </div>
          </header>
          <DefinitionList rows={rows} />
          <ul className={styles.attunementEffectExplanations}>
            {explanations.map((effect, index) => (
              <li key={`${index}:${effect.label}`}>
                <strong>{effect.label}</strong> — {effect.explanation}
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </article>
  )
}
