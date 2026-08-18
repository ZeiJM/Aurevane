'use client'

import {
  CHARACTER_ATTRIBUTE_IDS,
  CHARACTER_CREATION_RULES_V1,
  CHARACTER_PRESENTATIONS,
  PRONOUN_PRESETS,
  validateCharacterCreationIntent,
  type CharacterAttributeBonuses,
} from '@aurevane/game-core/character/creation'
import { FOUNDATION_DISCIPLINES } from '@aurevane/game-core/character/foundation-disciplines'
import {
  STARTER_CHARACTER_APPEARANCES,
  STARTER_CHARACTER_PORTRAITS,
} from '@aurevane/game-core/character/starter-options'
import { GameButton, Kicker } from '@aurevane/ui'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { AurevaneImage } from '@/components/media/aurevane-image'
import type { ImageAssetId } from '@/media/registry'

import styles from './character-creation-experience.module.css'

type Step = 'identity' | 'discipline' | 'review'

interface CharacterCreationExperienceProps {
  slotIndex: number
}

const portraitAssetIds: readonly ImageAssetId[] = [
  'character.creation.portrait-01',
  'character.creation.portrait-02',
  'character.creation.portrait-03',
  'character.creation.portrait-04',
]

const attributeCopy = {
  might: 'Physical force: heavy impacts, physical power, armor, and vertical force.',
  finesse: 'Precision and technique: accuracy, critical precision, and refined physical output.',
  vitality: 'Endurance: maximum health, physical toughness, and sustained frontline pressure.',
  agility: 'Mobility and reflex: movement, evasion, initiative, and agile jumping.',
  intellect: 'Mystic understanding: magical potency, MP, warding support, and precision.',
  resolve: 'Willpower: MP support, ward, initiative steadiness, and status resistance.',
} as const

const emptyBonuses: CharacterAttributeBonuses = {
  might: 0,
  finesse: 0,
  vitality: 0,
  agility: 0,
  intellect: 0,
  resolve: 0,
}

export function CharacterCreationExperience({ slotIndex }: CharacterCreationExperienceProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('identity')
  const [name, setName] = useState('')
  const [presentationId, setPresentationId] = useState('androgynous')
  const [pronounPresetId, setPronounPresetId] = useState('they_them')
  const [portraitRef, setPortraitRef] = useState(STARTER_CHARACTER_PORTRAITS[0].ref)
  const [starterAppearanceRef, setStarterAppearanceRef] = useState(
    STARTER_CHARACTER_APPEARANCES[0].ref,
  )
  const [foundationDisciplineId, setFoundationDisciplineId] = useState('vanguard')
  const [attributeBonuses, setAttributeBonuses] = useState<CharacterAttributeBonuses>(emptyBonuses)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [invalidFields, setInvalidFields] = useState<readonly string[]>([])
  const idempotencyKey = useRef<string | null>(null)
  const stepHeading = useRef<HTMLHeadingElement>(null)

  const spentPoints = CHARACTER_ATTRIBUTE_IDS.reduce(
    (total, attributeId) => total + attributeBonuses[attributeId],
    0,
  )
  const remainingPoints = CHARACTER_CREATION_RULES_V1.attributes.bonusBudget - spentPoints

  useEffect(() => {
    stepHeading.current?.focus()
  }, [step])

  function changed() {
    idempotencyKey.current = null
    setErrorMessage(null)
    setInvalidFields([])
  }

  function changeAttribute(attributeId: (typeof CHARACTER_ATTRIBUTE_IDS)[number], delta: number) {
    const current = attributeBonuses[attributeId]
    const next = current + delta
    if (next < 0 || next > CHARACTER_CREATION_RULES_V1.attributes.maximumBonusPerAttribute) return
    if (delta > 0 && remainingPoints <= 0) return

    changed()
    setAttributeBonuses((currentBonuses) => ({ ...currentBonuses, [attributeId]: next }))
  }

  function creationIntent() {
    return {
      name,
      presentationId,
      pronounPresetId,
      portraitRef,
      starterAppearanceRef,
      attributeBonuses,
      foundationDisciplineId,
    }
  }

  async function submitCharacter() {
    if (submitting || remainingPoints !== 0) return

    const validation = validateCharacterCreationIntent(creationIntent())
    if (!validation.ok) {
      const fields = validation.issues.map((issue) => issue.field)
      setInvalidFields(fields)
      setErrorMessage(validation.issues[0]?.message ?? 'Review the marked character choices.')
      if (fields.some((field) => field === 'name' || field.includes('presentation') || field.includes('pronoun') || field.includes('portrait') || field.includes('appearance'))) {
        setStep('identity')
      } else {
        setStep('discipline')
      }
      return
    }

    setSubmitting(true)
    setErrorMessage(null)
    setInvalidFields([])
    idempotencyKey.current ??= crypto.randomUUID()

    try {
      const response = await fetch('/api/character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: 1,
          slotIndex,
          idempotencyKey: idempotencyKey.current,
          intent: creationIntent(),
        }),
      })
      const payload = (await response.json()) as {
        character?: { id?: string }
        error?: { code?: string; message?: string }
      }
      if (!response.ok) {
        if (payload.error?.code === 'CHARACTER_NAME_UNAVAILABLE') {
          idempotencyKey.current = null
          setInvalidFields(['name'])
          setStep('identity')
        }
        setErrorMessage(payload.error?.message ?? 'Character creation could not be completed.')
        return
      }

      // The API establishes this character as the active selection in the same successful response.
      router.replace('/game/character')
      router.refresh()
    } catch {
      setErrorMessage('Character creation could not reach the server. Your choices are still here.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className={styles.experience} data-testid="character-creation">
      <div className={styles.scene} aria-hidden="true">
        <AurevaneImage assetId="environment.character-creation.threshold" />
      </div>

      <div className={styles.content}>
        <Kicker marker="◆">Create your character</Kicker>
        <div className={styles.progress} aria-label="Character creation progress">
          <span data-active={step === 'identity'}>01 Identity</span>
          <span data-active={step === 'discipline'}>02 Discipline</span>
          <span data-active={step === 'review'}>03 Confirm</span>
        </div>

        {step === 'identity' ? (
          <div className={styles.step}>
            <h1 ref={stepHeading} tabIndex={-1}>
              Who steps onto the road?
            </h1>
            <p className={styles.intro}>
              Your account stays private. This name, portrait, and presentation become this
              character’s public identity.
            </p>

            <label className={styles.field} data-invalid={invalidFields.includes('name') || undefined}>
              <span>Character name</span>
              <input
                aria-invalid={invalidFields.includes('name') || undefined}
                autoComplete="off"
                maxLength={CHARACTER_CREATION_RULES_V1.name.maximumCodePoints}
                minLength={CHARACTER_CREATION_RULES_V1.name.minimumCodePoints}
                onChange={(event) => {
                  changed()
                  setName(event.target.value)
                }}
                value={name}
              />
              <small>3–24 letters; spaces, apostrophes, and hyphens may separate name parts.</small>
            </label>

            <div className={styles.twoColumn}>
              <fieldset className={styles.choiceGroup}>
                <legend>Presentation</legend>
                {CHARACTER_PRESENTATIONS.map((option) => (
                  <label key={option.id} className={styles.inlineChoice}>
                    <input
                      checked={presentationId === option.id}
                      name="presentation"
                      onChange={() => {
                        changed()
                        setPresentationId(option.id)
                      }}
                      type="radio"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </fieldset>

              <fieldset className={styles.choiceGroup}>
                <legend>Pronouns</legend>
                {PRONOUN_PRESETS.map((option) => (
                  <label key={option.id} className={styles.inlineChoice}>
                    <input
                      checked={pronounPresetId === option.id}
                      name="pronouns"
                      onChange={() => {
                        changed()
                        setPronounPresetId(option.id)
                      }}
                      type="radio"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </fieldset>
            </div>

            <fieldset className={styles.choiceGroup}>
              <legend>Portrait</legend>
              <div className={styles.portraitGrid}>
                {STARTER_CHARACTER_PORTRAITS.map((option, index) => (
                  <label
                    key={option.ref}
                    className={styles.portraitChoice}
                    data-selected={portraitRef === option.ref}
                  >
                    <input
                      checked={portraitRef === option.ref}
                      name="portrait"
                      onChange={() => {
                        changed()
                        setPortraitRef(option.ref)
                      }}
                      type="radio"
                    />
                    <AurevaneImage assetId={portraitAssetIds[index]} sizes="8rem" />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className={styles.choiceGroup}>
              <legend>Starter appearance</legend>
              <div className={styles.appearanceGrid}>
                {STARTER_CHARACTER_APPEARANCES.map((option) => (
                  <label
                    key={option.ref}
                    className={styles.optionCard}
                    data-selected={starterAppearanceRef === option.ref}
                  >
                    <input
                      checked={starterAppearanceRef === option.ref}
                      name="appearance"
                      onChange={() => {
                        changed()
                        setStarterAppearanceRef(option.ref)
                      }}
                      type="radio"
                    />
                    <strong>{option.label}</strong>
                    <small>Cosmetic only. No hidden combat bonus.</small>
                  </label>
                ))}
              </div>
            </fieldset>

            {errorMessage ? (
              <p className={styles.error} role="alert">
                {errorMessage}
              </p>
            ) : null}
            <div className={styles.actions}>
              <GameButton
                disabled={name.trim().length < CHARACTER_CREATION_RULES_V1.name.minimumCodePoints}
                onClick={() => setStep('discipline')}
                type="button"
              >
                Choose your discipline
              </GameButton>
            </div>
          </div>
        ) : null}

        {step === 'discipline' ? (
          <div className={styles.step}>
            <h1 ref={stepHeading} tabIndex={-1}>
              Choose your first Discipline.
            </h1>
            <p className={styles.intro}>
              A Discipline is a learnable combat tradition that shapes your starting tools and
              tactical style. It is your first direction, not a permanent class or build lock; later
              progression can broaden and combine what your character knows.
            </p>

            <fieldset
              className={styles.choiceGroup}
              data-invalid={invalidFields.includes('foundationDisciplineId') || undefined}
            >
              <legend>Discipline</legend>
              <div className={styles.disciplineGrid}>
                {FOUNDATION_DISCIPLINES.map((discipline) => (
                  <label
                    key={discipline.id}
                    className={styles.optionCard}
                    data-selected={foundationDisciplineId === discipline.id}
                  >
                    <input
                      checked={foundationDisciplineId === discipline.id}
                      name="discipline"
                      onChange={() => {
                        changed()
                        setFoundationDisciplineId(discipline.id)
                      }}
                      type="radio"
                    />
                    <strong>{discipline.name}</strong>
                    <small>{discipline.summary}</small>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className={styles.attributeHeader}>
              <div>
                <h2>Starting attributes</h2>
                <p>
                  Every attribute begins at {CHARACTER_CREATION_RULES_V1.attributes.baseline}. Spend
                  exactly {CHARACTER_CREATION_RULES_V1.attributes.bonusBudget} bonus points to shape
                  your strengths. Vitality owns endurance; Agility owns movement and reflex, so the
                  older attributes no longer have to carry too many jobs at once.
                </p>
              </div>
              <strong data-testid="attribute-points">
                {remainingPoints} bonus points remaining
              </strong>
            </div>

            <div className={styles.attributeGrid}>
              {CHARACTER_ATTRIBUTE_IDS.map((attributeId) => {
                const bonus = attributeBonuses[attributeId]
                const total = CHARACTER_CREATION_RULES_V1.attributes.baseline + bonus
                return (
                  <div
                    className={styles.attributeCard}
                    key={attributeId}
                    data-invalid={invalidFields.some((field) => field.includes(attributeId)) || undefined}
                  >
                    <div>
                      <strong>{attributeId[0].toUpperCase() + attributeId.slice(1)}</strong>
                      <small>{attributeCopy[attributeId]}</small>
                      <small>
                        Base {CHARACTER_CREATION_RULES_V1.attributes.baseline} · Total {total}
                      </small>
                    </div>
                    <div className={styles.attributeControl}>
                      <button
                        aria-label={`Decrease ${attributeId} bonus`}
                        disabled={bonus === 0}
                        onClick={() => changeAttribute(attributeId, -1)}
                        type="button"
                      >
                        −
                      </button>
                      <output aria-label={`${attributeId} bonus`}>+{bonus}</output>
                      <button
                        aria-label={`Increase ${attributeId} bonus`}
                        disabled={
                          remainingPoints === 0 ||
                          bonus === CHARACTER_CREATION_RULES_V1.attributes.maximumBonusPerAttribute
                        }
                        onClick={() => changeAttribute(attributeId, 1)}
                        type="button"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {errorMessage ? (
              <p className={styles.error} role="alert">
                {errorMessage}
              </p>
            ) : null}
            <div className={styles.actions}>
              <GameButton onClick={() => setStep('identity')} type="button" variant="quiet">
                Back
              </GameButton>
              <GameButton
                disabled={remainingPoints !== 0}
                onClick={() => setStep('review')}
                type="button"
              >
                Review character
              </GameButton>
            </div>
          </div>
        ) : null}

        {step === 'review' ? (
          <div className={styles.step}>
            <h1 ref={stepHeading} tabIndex={-1}>
              Confirm this character.
            </h1>
            <p className={styles.intro}>
              The server revalidates every choice, reserves the name, creates the character
              atomically in Slot {slotIndex + 1}, and takes you straight into that character.
            </p>
            <dl className={styles.reviewGrid}>
              <div>
                <dt>Slot</dt>
                <dd>{slotIndex + 1}</dd>
              </div>
              <div>
                <dt>Name</dt>
                <dd>{name}</dd>
              </div>
              <div>
                <dt>Discipline</dt>
                <dd>
                  {FOUNDATION_DISCIPLINES.find((item) => item.id === foundationDisciplineId)?.name}
                </dd>
              </div>
              <div>
                <dt>Presentation</dt>
                <dd>{CHARACTER_PRESENTATIONS.find((item) => item.id === presentationId)?.label}</dd>
              </div>
              <div>
                <dt>Pronouns</dt>
                <dd>{PRONOUN_PRESETS.find((item) => item.id === pronounPresetId)?.label}</dd>
              </div>
              {CHARACTER_ATTRIBUTE_IDS.map((attributeId) => (
                <div key={attributeId}>
                  <dt>{attributeId[0].toUpperCase() + attributeId.slice(1)}</dt>
                  <dd>
                    {CHARACTER_CREATION_RULES_V1.attributes.baseline + attributeBonuses[attributeId]}
                  </dd>
                </div>
              ))}
            </dl>
            {errorMessage ? (
              <p className={styles.error} role="alert">
                {errorMessage}
              </p>
            ) : null}
            <p className={styles.submitState} aria-live="polite">
              {submitting ? 'Reserving the name and creating the character…' : 'Ready to create.'}
            </p>
            <div className={styles.actions}>
              <GameButton
                disabled={submitting}
                onClick={() => setStep('discipline')}
                type="button"
                variant="quiet"
              >
                Back
              </GameButton>
              <GameButton
                disabled={submitting}
                onClick={() => void submitCharacter()}
                type="button"
              >
                {submitting ? 'Creating…' : 'Create character'}
              </GameButton>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
