'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import {
  CHARACTER_ATTRIBUTE_IDS,
  type CharacterAttributes,
} from '@aurevane/game-core/character/creation'
import {
  SUPPORT_ACTION_IDS,
  type SupportActionId,
} from '@aurevane/game-core/combat/support-actions'
import { validateAttributeAllocation } from '@aurevane/game-core/character/attribute-allocation'
import type { MasterPlayerView, PlayerCorrection } from '@/master/players'
import { disciplineCorrectionFromForm } from '@/master/player-discipline-correction'
import { playerProgressionProposal, xpForPlayerLevel } from '@/master/player-correction-progression'
import { resolveLevelProgress } from '@aurevane/game-core/character/progression'

export function playerLabel(value: string) {
  return value
    .split(/[._-]/u)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
export function playerContentLabel(
  player: MasterPlayerView,
  id: string | null | undefined,
  kind: 'Discipline' | 'Skill' | 'Resonance' | 'Essence',
) {
  if (!id) return 'None'
  if (kind === 'Discipline') {
    const name = player.disciplines?.find((row) => row.id === id)?.name
    if (name) return name
    // Retain readable builtin IDs when an older support response lacks its catalogue.
    return /^[a-z]+(?:-[a-z]+)*$/u.test(id) ? playerLabel(id) : 'Unavailable Discipline'
  }
  return player.contentNames?.[id] ?? `Unavailable ${kind}`
}
export function PlayerCorrectionForm({
  player,
  onReview,
  disabled,
  navigationDisabled = disabled,
  encounter,
}: {
  player: MasterPlayerView
  onReview(command: PlayerCorrection): void
  disabled: boolean
  navigationDisabled?: boolean
  encounter?: ReactNode
}) {
  const [kind, setKind] = useState<PlayerCorrection['kind'] | 'encounter'>('source')
  const [error, setError] = useState<string | null>(null)
  const [attributeText, setAttributeText] = useState(
    () =>
      Object.fromEntries(
        CHARACTER_ATTRIBUTE_IDS.map((id) => [id, String(player.facts.attributes[id])]),
      ) as Record<keyof CharacterAttributes, string>,
  )
  const [xpText, setXpText] = useState(String(player.facts.xp))
  const [levelText, setLevelText] = useState(String(player.facts.level))
  const attributes = Object.fromEntries(
    CHARACTER_ATTRIBUTE_IDS.map((id) => [
      id,
      attributeText[id] === '' ? NaN : Number(attributeText[id]),
    ]),
  ) as CharacterAttributes
  const numberText = (value: string) => value.replace(/^0+(?=\d)/u, '')
  const policy = player.attributePolicy
  const curve = player.progressionCurve
  let proposal: ReturnType<typeof playerProgressionProposal> | null = null
  let progressionError: string | null = null
  if (policy && curve) {
    try {
      proposal = playerProgressionProposal(
        attributes,
        xpText === '' ? NaN : Number(xpText),
        curve,
        policy,
      )
    } catch (cause) {
      progressionError = cause instanceof Error ? cause.message : 'Enter valid progression values.'
    }
  }
  const baseTotal = policy
    ? CHARACTER_ATTRIBUTE_IDS.reduce((total, id) => total + policy.baseAttributes[id], 0)
    : 31
  const personalSpent =
    CHARACTER_ATTRIBUTE_IDS.reduce((total, id) => total + attributes[id], 0) - baseTotal
  const available = player.learnedSkills.filter(
    (skill) =>
      (skill.eligibilityDisciplineId ?? skill.sourceDisciplineId) ===
        player.facts.build.primary.disciplineId ||
      (skill.eligibilityDisciplineId ?? skill.sourceDisciplineId) ===
        player.facts.build.secondary?.disciplineId,
  )
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (kind === 'encounter' || disabled) return
    setError(null)
    const data = new FormData(event.currentTarget)
    let command: PlayerCorrection
    if (kind === 'source') {
      if (curve) {
        try {
          xpForPlayerLevel(Number(levelText), curve)
        } catch {
          setError('Enter a whole Level within the progression limit.')
          return
        }
      }
      command = {
        kind,
        xp: xpText === '' ? NaN : Number(xpText),
        attributes,
      }
      if (policy) {
        if (progressionError) {
          setError(progressionError)
          return
        }
        const issue = validateAttributeAllocation({
          attributes: command.attributes,
          level: proposal?.level ?? player.facts.level,
          policy,
        })[0]
        if (issue) {
          setError(issue.message)
          return
        }
      }
    } else if (kind === 'disciplines') {
      try {
        command = disciplineCorrectionFromForm(player.facts.build, data)
      } catch (error) {
        setError(
          error instanceof Error ? error.message : 'Choose a different Primary or Secondary.',
        )
        return
      }
    } else if (kind === 'support')
      command = { kind, supportActionId: String(data.get('support')) as SupportActionId }
    else {
      const skills = available.filter((_, index) => data.getAll('skill').includes(String(index)))
      if (
        skills.length > 4 ||
        new Set(skills.map((skill) => skill.skillId)).size !== skills.length
      ) {
        setError('Choose up to four different Skills, selecting each Skill only once.')
        return
      }
      command = {
        kind,
        skills: skills.map(
          ({ skillId, contentVersion, sourceDisciplineId, eligibilityDisciplineId }) => ({
            skillId,
            contentVersion,
            sourceDisciplineId,
            ...(eligibilityDisciplineId ? { eligibilityDisciplineId } : {}),
          }),
        ),
      }
    }
    onReview(command)
  }
  return (
    <form onSubmit={submit}>
      <h3>Gameplay correction</h3>
      <div role="group" aria-label="Correction section" data-correction-sections>
        {(
          [
            ['source', 'Stats & Progression'],
            ['disciplines', 'Disciplines'],
            ['skills', 'Skills'],
            ['support', 'Support'],
            ...(encounter ? ([['encounter', 'Encounter']] as const) : []),
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            disabled={navigationDisabled}
            aria-pressed={kind === value}
            onClick={() => {
              setKind(value)
              setError(null)
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div hidden={kind !== 'encounter'} data-player-encounter-panel>
        {encounter}
      </div>
      <fieldset disabled={disabled} key={kind} hidden={kind === 'encounter'}>
        <legend>
          {kind === 'source'
            ? 'Stats & Progression'
            : kind === 'disciplines'
              ? 'Disciplines'
              : kind === 'skills'
                ? 'Equipped Skills'
                : 'Support action'}
        </legend>
        {kind === 'source' ? (
          <>
            <p>
              {Number.isFinite(personalSpent) ? personalSpent : '—'} /{' '}
              {proposal?.personalPool ?? player.calculated.personalPointPool} personal points
              assigned at Level {proposal?.level ?? player.facts.level}. Primary bases stay fixed.
            </p>
            {proposal?.excess ? (
              <p role="status">
                Remove {proposal.excess} personal points or raise Level before saving.
              </p>
            ) : proposal?.unspent ? (
              <p>
                {proposal.unspent} points will remain available to allocate. Save as entered to keep
                these points.
              </p>
            ) : null}
            <div data-player-fields>
              {CHARACTER_ATTRIBUTE_IDS.map((id) => (
                <label key={id}>
                  {playerLabel(id)}
                  <input
                    name={id}
                    aria-label={playerLabel(id)}
                    aria-describedby={policy ? `player-${id}-limits` : undefined}
                    type="number"
                    min={policy?.baseAttributes[id] ?? 1}
                    max={policy?.attributeCaps[id] ?? 60}
                    step="1"
                    required
                    value={attributeText[id]}
                    onChange={(event) =>
                      setAttributeText((current) => ({
                        ...current,
                        [id]: numberText(event.target.value),
                      }))
                    }
                  />
                  {policy ? (
                    <small id={`player-${id}-limits`}>
                      Base {policy.baseAttributes[id]} · Cap {policy.attributeCaps[id] ?? 'None'}
                    </small>
                  ) : null}
                </label>
              ))}
              <label>
                Level
                <input
                  aria-label="Level"
                  type="number"
                  min="1"
                  max={curve?.maxLevel ?? 100}
                  step="1"
                  required
                  disabled={!curve}
                  value={levelText}
                  onChange={(event) => {
                    const value = numberText(event.target.value)
                    setLevelText(value)
                    if (curve) {
                      try {
                        setXpText(String(xpForPlayerLevel(Number(value), curve)))
                      } catch {
                        /* Allow an incomplete field while editing. */
                      }
                    }
                  }}
                />
              </label>
              <label>
                Total XP
                <input
                  name="xp"
                  type="number"
                  min="0"
                  max={curve?.cumulativeXpByLevel[curve.maxLevel - 1]}
                  step="1"
                  required
                  disabled={!curve}
                  value={xpText}
                  onChange={(event) => {
                    const value = numberText(event.target.value)
                    setXpText(value)
                    if (curve && value !== '') {
                      try {
                        setLevelText(String(resolveLevelProgress(Number(value), curve).level))
                      } catch {
                        /* Invalid XP stays visible for correction. */
                      }
                    }
                  }}
                />
              </label>
            </div>
            {!curve ? (
              <p>
                Progression editing is unavailable until the character’s XP curve can be loaded.
              </p>
            ) : null}
            {progressionError ? (
              <p role="status">{progressionError}</p>
            ) : proposal?.issues[0] ? (
              <p role="status">{proposal.issues[0].message}</p>
            ) : null}
            {proposal &&
            (proposal.excess > 0 ||
              (proposal.fitLevel !== null && proposal.fitLevel < proposal.level)) ? (
              <div data-correction-sections>
                <button
                  type="button"
                  disabled={proposal.fitLevel === null}
                  onClick={() => {
                    if (proposal && proposal.fitLevel !== null && proposal.fitXp !== null) {
                      setLevelText(String(proposal.fitLevel))
                      setXpText(String(proposal.fitXp))
                    }
                  }}
                >
                  {proposal.fitLevel !== null && proposal.fitLevel < proposal.level
                    ? `Lower to Level ${proposal.fitLevel} and remove ${proposal.unspent - (proposal.fitUnspent ?? 0)} banked points`
                    : `Fit Level to Stats${proposal.fitLevel ? ` · Level ${proposal.fitLevel}` : ''}`}
                </button>
                {proposal.fitLevel !== null && proposal.fitLevel < proposal.level ? (
                  <p>
                    This also lowers total XP to {proposal.fitXp}. Stats stay as entered.
                    {proposal.fitUnspent
                      ? ` ${proposal.fitUnspent} starting points remain available at Level 1.`
                      : ''}{' '}
                    Review the changes before saving.
                  </p>
                ) : null}
                {proposal.redistribution ? (
                  <details>
                    <summary>Preview balanced redistribution</summary>
                    <p>
                      {CHARACTER_ATTRIBUTE_IDS.map(
                        (id) =>
                          `${playerLabel(id)} ${attributes[id]} → ${proposal!.redistribution![id]}`,
                      ).join(' · ')}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setAttributeText(
                          Object.fromEntries(
                            CHARACTER_ATTRIBUTE_IDS.map((id) => [
                              id,
                              String(proposal!.redistribution![id]),
                            ]),
                          ) as Record<keyof CharacterAttributes, string>,
                        )
                      }
                    >
                      Use this allocation
                    </button>
                  </details>
                ) : null}
              </div>
            ) : null}
          </>
        ) : kind === 'disciplines' ? (
          <>
            <label>
              Primary
              <select name="primary" defaultValue={player.facts.build.primary.disciplineId}>
                {player.disciplines
                  .filter((row) => row.primary)
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Secondary
              <select
                name="secondary"
                defaultValue={player.facts.build.secondary?.disciplineId ?? ''}
              >
                <option value="">None</option>
                {player.disciplines
                  .filter((row) => row.secondary)
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
              </select>
            </label>
            <p>
              Secondary choices use this character’s existing mastery. Changing Primary preserves
              the current allocation rules and cooldown.
            </p>
          </>
        ) : kind === 'skills' ? (
          <>
            <p>Tick up to four different Skills to equip.</p>
            {available.length ? (
              available.map((skill, index) => (
                <label
                  key={`${skill.skillId}:${skill.contentVersion}:${skill.eligibilityDisciplineId ?? skill.sourceDisciplineId}`}
                >
                  <input
                    type="checkbox"
                    name="skill"
                    value={index}
                    defaultChecked={player.facts.build.disciplineSkills.some(
                      (active) =>
                        active.skillId === skill.skillId &&
                        active.contentVersion === skill.contentVersion &&
                        (active.eligibilityDisciplineId ?? active.sourceDisciplineId) ===
                          (skill.eligibilityDisciplineId ?? skill.sourceDisciplineId),
                    )}
                  />
                  {playerContentLabel(player, skill.skillId, 'Skill')} ·{' '}
                  {playerContentLabel(
                    player,
                    skill.eligibilityDisciplineId ?? skill.sourceDisciplineId,
                    'Discipline',
                  )}{' '}
                  · {skill.earnedEligibility === false ? 'Locked' : 'Unlocked'}
                </label>
              ))
            ) : (
              <p>No Skills available for these disciplines.</p>
            )}
          </>
        ) : (
          <label>
            Support action
            <select name="support" defaultValue={player.facts.build.supportActionId}>
              {SUPPORT_ACTION_IDS.map((id) => (
                <option key={id} value={id}>
                  {id === 'basic.guard'
                    ? 'Guard'
                    : id === 'basic.recover'
                      ? 'Recover HP'
                      : 'Recover MP'}
                </option>
              ))}
            </select>
          </label>
        )}
      </fieldset>
      {error ? <p role="alert">{error}</p> : null}
      <button disabled={disabled} type="submit" hidden={kind === 'encounter'}>
        Review correction
      </button>
    </form>
  )
}

export function PlayerCorrectionReview({
  player,
  command,
}: {
  player: MasterPlayerView
  command: PlayerCorrection
}) {
  const progression =
    command.kind === 'source' && player.progressionCurve && player.attributePolicy
      ? {
          before: playerProgressionProposal(
            player.facts.attributes,
            player.facts.xp,
            player.progressionCurve,
            player.attributePolicy,
          ),
          after: playerProgressionProposal(
            command.attributes,
            command.xp,
            player.progressionCurve,
            player.attributePolicy,
          ),
        }
      : null
  const rows =
    command.kind === 'source'
      ? [
          ...CHARACTER_ATTRIBUTE_IDS.map((id) => ({
            label: playerLabel(id),
            before: player.facts.attributes[id],
            after: command.attributes[id],
          })),
          { label: 'Total XP', before: player.facts.xp, after: command.xp },
          ...(progression
            ? [
                {
                  label: 'Banked points',
                  before: progression.before.unspent,
                  after: progression.after.unspent,
                },
              ]
            : []),
          ...(player.progressionCurve
            ? [
                {
                  label: 'Level',
                  before: player.facts.level,
                  after: resolveLevelProgress(command.xp, player.progressionCurve).level,
                },
              ]
            : []),
        ]
      : command.kind === 'disciplines'
        ? [
            {
              label: 'Primary',
              before: playerContentLabel(
                player,
                player.facts.build.primary.disciplineId,
                'Discipline',
              ),
              after: playerContentLabel(
                player,
                command.primary ?? player.facts.build.primary.disciplineId,
                'Discipline',
              ),
            },
            {
              label: 'Secondary',
              before: playerContentLabel(
                player,
                player.facts.build.secondary?.disciplineId,
                'Discipline',
              ),
              after: playerContentLabel(
                player,
                command.secondary === undefined
                  ? player.facts.build.secondary?.disciplineId
                  : command.secondary,
                'Discipline',
              ),
            },
          ]
        : command.kind === 'support'
          ? [
              {
                label: 'Support action',
                before: playerLabel(player.facts.build.supportActionId),
                after: playerLabel(command.supportActionId),
              },
            ]
          : [
              {
                label: 'Equipped Skills',
                before:
                  player.facts.build.disciplineSkills
                    .map((skill) => playerContentLabel(player, skill.skillId, 'Skill'))
                    .join(', ') || 'None',
                after:
                  command.skills
                    .map((skill) => playerContentLabel(player, skill.skillId, 'Skill'))
                    .join(', ') || 'None',
              },
            ]
  return (
    <dl>
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>
            {row.before} → <strong>{row.after}</strong>
          </dd>
        </div>
      ))}
    </dl>
  )
}
