'use client'

import { useState, type FormEvent } from 'react'
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

export function playerLabel(value: string) {
  return value
    .split(/[._-]/u)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
export function PlayerCorrectionForm({
  player,
  onReview,
  disabled,
}: {
  player: MasterPlayerView
  onReview(command: PlayerCorrection): void
  disabled: boolean
}) {
  const [kind, setKind] = useState<PlayerCorrection['kind']>('source')
  const [error, setError] = useState<string | null>(null)
  const [attributes, setAttributes] = useState(player.facts.attributes)
  const policy = player.attributePolicy
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
    setError(null)
    const data = new FormData(event.currentTarget)
    let command: PlayerCorrection
    if (kind === 'source') {
      command = {
        kind,
        xp: Number(data.get('xp')),
        attributes: Object.fromEntries(
          CHARACTER_ATTRIBUTE_IDS.map((id) => [id, Number(data.get(id))]),
        ) as CharacterAttributes,
      }
      if (policy && command.xp === player.facts.xp) {
        const issue = validateAttributeAllocation({
          attributes: command.attributes,
          level: player.facts.level,
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
        setError('Choose up to four distinct Skills, with one eligibility choice per Skill.')
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
      <p>Review one group at a time. Active encounters and pending deletion block corrections.</p>
      <label>
        Correction group
        <select
          value={kind}
          onChange={(event) => {
            setKind(event.target.value as PlayerCorrection['kind'])
            setError(null)
          }}
          disabled={disabled}
        >
          <option value="source">Core Stats & XP</option>
          <option value="disciplines">Primary & Secondary</option>
          <option value="skills">Available Skill loadout</option>
          <option value="support">Support action</option>
        </select>
      </label>
      <fieldset disabled={disabled} key={kind}>
        <legend>
          {kind === 'source'
            ? 'Source values'
            : kind === 'disciplines'
              ? 'Disciplines'
              : kind === 'skills'
                ? 'Exact available Skills'
                : 'Support action'}
        </legend>
        {kind === 'source' ? (
          <>
            <p>
              {personalSpent} / {player.calculated.personalPointPool} personal points assigned at
              Level {player.facts.level}. Level follows XP; raising a stat requires available points
              or moving personal points from another stat. Fixed Primary bases stay in place.
            </p>
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
                    value={attributes[id]}
                    onChange={(event) =>
                      setAttributes((current) => ({ ...current, [id]: Number(event.target.value) }))
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
                Total XP
                <input
                  name="xp"
                  type="number"
                  min="0"
                  step="1"
                  required
                  defaultValue={player.facts.xp}
                />
              </label>
            </div>
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
            <p>
              Choose up to four distinct available Skills and one active eligibility for each.
              Testing access remains unearned.
            </p>
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
                  {playerLabel(skill.skillId)} · v{skill.contentVersion} ·{' '}
                  {playerLabel(skill.eligibilityDisciplineId ?? skill.sourceDisciplineId)} ·{' '}
                  {skill.earnedEligibility === true
                    ? 'Earned'
                    : skill.earnedEligibility === false
                      ? 'Available (unearned)'
                      : 'Earned status unavailable'}
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
      <button disabled={disabled} type="submit">
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
  const rows =
    command.kind === 'source'
      ? [
          ...CHARACTER_ATTRIBUTE_IDS.map((id) => ({
            label: playerLabel(id),
            before: player.facts.attributes[id],
            after: command.attributes[id],
          })),
          { label: 'Total XP', before: player.facts.xp, after: command.xp },
        ]
      : command.kind === 'disciplines'
        ? [
            {
              label: 'Primary',
              before: playerLabel(player.facts.build.primary.disciplineId),
              after: playerLabel(command.primary ?? player.facts.build.primary.disciplineId),
            },
            {
              label: 'Secondary',
              before: playerLabel(player.facts.build.secondary?.disciplineId ?? 'None'),
              after: playerLabel(
                (command.secondary === undefined
                  ? player.facts.build.secondary?.disciplineId
                  : command.secondary) ?? 'None',
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
                label: 'Earned Skills',
                before:
                  player.facts.build.disciplineSkills
                    .map((skill) => `${playerLabel(skill.skillId)} v${skill.contentVersion}`)
                    .join(', ') || 'None',
                after:
                  command.skills
                    .map((skill) => `${playerLabel(skill.skillId)} v${skill.contentVersion}`)
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
