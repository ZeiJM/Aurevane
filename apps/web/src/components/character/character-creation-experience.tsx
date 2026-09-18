'use client'

import {
  CHARACTER_ATTRIBUTE_IDS,
  CHARACTER_CREATION_RULES_V1,
  CHARACTER_PRESENTATIONS,
  validateCharacterCreationIntent,
  type CharacterAttributeBonuses,
  type CharacterPresentationId,
} from '@aurevane/game-core/character/creation'
import { FOUNDATION_DISCIPLINES } from '@aurevane/game-core/character/foundation-disciplines'
import {
  defaultPronounPresetForPresentation,
  STARTER_CHARACTER_APPEARANCES,
  STARTER_CHARACTER_PORTRAITS,
} from '@aurevane/game-core/character/starter-options'
import { GameButton } from '@aurevane/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { AurevaneImage } from '@/components/media/aurevane-image'
import { getStarterPortraitImageAssetId } from '@/media/character'

import { FoundationDisciplineSigil } from './foundation-discipline-sigil'
import styles from './character-creation-experience.module.css'

type Step = 'identity' | 'discipline' | 'review'

interface CharacterCreationExperienceProps {
  slotIndex: number
}

const attributeCopy = {
  might: 'Strength behind the blow: physical power, armor, and forceful movement.',
  finesse:
    'A steady hand and exact technique: accuracy, critical precision, and refined physical output.',
  vitality: 'The body’s staying power: health, toughness, and endurance under pressure.',
  agility: 'Speed of foot and reflex: movement, evasion, initiative, and nimble jumps.',
  intellect: 'Command of the unseen: mystic power, MP, warding, and precision.',
  resolve: 'Strength of will: MP, ward, initiative, and resistance against hostile effects.',
} as const

function starterBonusesForDiscipline(disciplineId: string): CharacterAttributeBonuses {
  const discipline = FOUNDATION_DISCIPLINES.find((candidate) => candidate.id === disciplineId)
  return discipline
    ? { ...discipline.startingAttributeBonuses }
    : {
        might: 0,
        finesse: 0,
        vitality: 0,
        agility: 0,
        intellect: 0,
        resolve: 0,
      }
}

export function CharacterCreationExperience({ slotIndex }: CharacterCreationExperienceProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('identity')
  const [name, setName] = useState('')
  const [presentationId, setPresentationId] = useState<CharacterPresentationId>('androgynous')
  const [portraitRef, setPortraitRef] = useState(STARTER_CHARACTER_PORTRAITS[0].ref)
  const [starterAppearanceRef, setStarterAppearanceRef] = useState(
    STARTER_CHARACTER_APPEARANCES[0].ref,
  )
  const [foundationDisciplineId, setFoundationDisciplineId] = useState('vanguard')
  const [attributeBonuses, setAttributeBonuses] = useState<CharacterAttributeBonuses>(() =>
    starterBonusesForDiscipline('vanguard'),
  )
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [invalidFields, setInvalidFields] = useState<readonly string[]>([])
  const idempotencyKey = useRef<string | null>(null)
  const stepHeading = useRef<HTMLHeadingElement>(null)

  const selectedDiscipline =
    FOUNDATION_DISCIPLINES.find((candidate) => candidate.id === foundationDisciplineId) ??
    FOUNDATION_DISCIPLINES[0]
  const selectedPortrait =
    STARTER_CHARACTER_PORTRAITS.find((option) => option.ref === portraitRef) ??
    STARTER_CHARACTER_PORTRAITS[0]
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
      // Kept for the v1 server/data contract. The player-facing UI intentionally does not
      // expose pronouns; a deterministic compatibility value follows the chosen presentation.
      pronounPresetId: defaultPronounPresetForPresentation(presentationId),
      portraitRef,
      starterAppearanceRef,
      attributeBonuses,
      foundationDisciplineId,
    }
  }

  function advanceIdentity() {
    const validation = validateCharacterCreationIntent(creationIntent())
    const nameIssue = validation.ok
      ? undefined
      : validation.issues.find((issue) => issue.field === 'name')
    if (nameIssue) {
      setInvalidFields(['name'])
      setErrorMessage(nameIssue.message)
      return
    }
    setErrorMessage(null)
    setInvalidFields([])
    setStep('discipline')
  }

  async function submitCharacter() {
    if (submitting || remainingPoints !== 0) return

    const validation = validateCharacterCreationIntent(creationIntent())
    if (!validation.ok) {
      const fields = validation.issues.map((issue) => issue.field)
      setInvalidFields(fields)
      setErrorMessage(validation.issues[0]?.message ?? 'Review the marked character choices.')
      if (
        fields.some(
          (field) =>
            field === 'name' ||
            field.includes('presentation') ||
            field.includes('pronoun') ||
            field.includes('portrait') ||
            field.includes('appearance'),
        )
      ) {
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

      router.replace('/game/character')
      router.refresh()
    } catch {
      setErrorMessage('Character creation could not reach the server. Your choices are still here.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section
      className={styles.experience}
      data-testid="character-creation"
      data-character-concept="creation"
      data-step={step}
    >
      <div className={styles.scene} aria-hidden="true">
        <AurevaneImage
          assetId="environment.character-creation.threshold"
          sizes="(min-width: 761px) 28vw, 100vw"
        />
        <div className={styles.sceneVeil} />
        <div className={styles.sceneCopy}>
          <span>Some souls seek power.</span>
          <span>Others seek truth.</span>
          <strong>All find their place in AUREVANE.</strong>
        </div>
      </div>

      <div className={styles.content}>
        <ol className={styles.progress} aria-label="Character creation progress">
          {(['identity', 'discipline', 'review'] as const).map((item, index) => (
            <li
              key={item}
              data-active={step === item}
              aria-current={step === item ? 'step' : undefined}
            >
              <b aria-hidden="true">{String(index + 1).padStart(2, '0')}</b>
              <span>
                {item === 'review' ? 'Begin' : item === 'identity' ? 'Name & Visage' : 'Discipline'}
              </span>
            </li>
          ))}
        </ol>

        {step === 'identity' ? (
          <div className={styles.step}>
            <h1 ref={stepHeading} tabIndex={-1}>
              Give your legend a face.
            </h1>
            <p className={styles.intro}>
              Choose the name, visage, and bearing by which AUREVANE will know you. These choices
              shape identity, not combat power.
            </p>

            <div className={styles.identityWorkspace}>
              <fieldset className={styles.choiceGroup} data-portrait-library="true">
                <legend>Choose your visage</legend>
                <p className={styles.choiceHint}>
                  {STARTER_CHARACTER_PORTRAITS.length} faces await. Choose the likeness that will
                  represent this character throughout AUREVANE.
                </p>
                <div className={styles.portraitGrid} data-portrait-grid="true">
                  {STARTER_CHARACTER_PORTRAITS.map((option) => (
                    <label
                      key={option.ref}
                      className={styles.portraitChoice}
                      data-selected={portraitRef === option.ref}
                      title={option.label}
                    >
                      <input
                        aria-label={option.label}
                        checked={portraitRef === option.ref}
                        name="portrait"
                        onChange={() => {
                          changed()
                          setPortraitRef(option.ref)
                        }}
                        type="radio"
                      />
                      <AurevaneImage
                        assetId={getStarterPortraitImageAssetId(option.ref)}
                        sizes="6rem"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <aside className={styles.portraitPreview} aria-label="Selected portrait preview">
                <span className={styles.previewLabel}>Your likeness</span>
                <div className={styles.previewFrame}>
                  <AurevaneImage
                    assetId={getStarterPortraitImageAssetId(portraitRef)}
                    sizes="(max-width: 760px) 7rem, (max-height: 800px) 16rem, 24rem"
                  />
                </div>
                <div className={styles.previewCopy}>
                  <strong>{name.trim() || 'Unnamed wayfarer'}</strong>
                  <span>{selectedPortrait.label}</span>
                  <small>
                    {CHARACTER_PRESENTATIONS.find((option) => option.id === presentationId)?.label}
                  </small>
                </div>
              </aside>
            </div>
            <div className={styles.identityDetails}>
              <label
                className={styles.field}
                data-invalid={invalidFields.includes('name') || undefined}
              >
                <span id="creation-name-label">Name carried into AUREVANE</span>
                <input
                  id="creation-name"
                  aria-label="Character name"
                  aria-describedby="creation-name-hint"
                  aria-invalid={invalidFields.includes('name') || undefined}
                  autoComplete="off"
                  maxLength={CHARACTER_CREATION_RULES_V1.name.maximumCodePoints}
                  minLength={CHARACTER_CREATION_RULES_V1.name.minimumCodePoints}
                  onChange={(event) => {
                    changed()
                    setName(event.target.value)
                  }}
                  placeholder="Enter a name…"
                  value={name}
                />
                <small id="creation-name-hint">
                  3–24 letters. Spaces, apostrophes, and hyphens may bind the parts of a name.
                </small>
              </label>
              <fieldset className={styles.choiceGroup}>
                <legend>Bearing</legend>
                <div className={styles.presentationChoices}>
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
                </div>
              </fieldset>
              <fieldset className={styles.choiceGroup}>
                <legend>First appearance</legend>
                <p className={styles.choiceHint}>
                  A matter of appearance only; no hidden strength lies here.
                </p>
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
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            {errorMessage ? (
              <p className={styles.error} role="alert">
                {errorMessage}
              </p>
            ) : null}
            <div className={styles.actions}>
              <Link href="/game" className={styles.backLink}>
                ← Character Select
              </Link>
              <GameButton
                disabled={name.trim().length < CHARACTER_CREATION_RULES_V1.name.minimumCodePoints}
                onClick={advanceIdentity}
                type="button"
              >
                Choose your discipline
              </GameButton>
            </div>
          </div>
        ) : null}

        {step === 'discipline' ? (
          <div
            className={`${styles.step} ${styles.disciplineStep}`}
            data-testid="creation-discipline-workspace"
            data-creation-surface="moonstone"
          >
            <h1 ref={stepHeading} tabIndex={-1}>
              Choose the Discipline that answers you.
            </h1>
            <p className={styles.intro}>
              Your Primary Discipline shapes the foundation of your starting attributes while it is
              equipped. Your personal points remain your own, even if you later walk another path.
            </p>

            <fieldset
              className={styles.choiceGroup}
              data-invalid={invalidFields.includes('foundationDisciplineId') || undefined}
            >
              <legend>Disciplines of AUREVANE</legend>
              <div className={styles.disciplineGrid}>
                {FOUNDATION_DISCIPLINES.map((discipline) => (
                  <label
                    key={discipline.id}
                    className={styles.optionCard}
                    data-selected={foundationDisciplineId === discipline.id}
                    data-testid="creation-discipline-choice"
                  >
                    <input
                      checked={foundationDisciplineId === discipline.id}
                      name="discipline"
                      onChange={() => {
                        changed()
                        setFoundationDisciplineId(discipline.id)
                        setAttributeBonuses(starterBonusesForDiscipline(discipline.id))
                      }}
                      type="radio"
                    />
                    <FoundationDisciplineSigil
                      disciplineId={discipline.id}
                      className={styles.disciplineSigil}
                    />
                    <strong>{discipline.name}</strong>
                    <small>{discipline.summary}</small>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className={styles.attributeHeader}>
              <div>
                <h2>Shape your starting attributes</h2>
                <p>
                  {selectedDiscipline.name} lends{' '}
                  {CHARACTER_CREATION_RULES_V1.attributes.disciplineBaseTotal} points to its base
                  profile. You hold {CHARACTER_CREATION_RULES_V1.attributes.bonusBudget} personal
                  points to shape as you wish. Those points—and every point earned through later
                  Levels—remain yours if your Primary Discipline changes.
                </p>
              </div>
              <strong data-testid="attribute-points">
                {remainingPoints} personal points remaining
              </strong>
            </div>

            <div className={styles.attributeGrid}>
              {CHARACTER_ATTRIBUTE_IDS.map((attributeId) => {
                const bonus = attributeBonuses[attributeId]
                const base = selectedDiscipline.baseAttributes[attributeId]
                const total = base + bonus
                return (
                  <div
                    className={styles.attributeCard}
                    data-testid="creation-attribute-row"
                    key={attributeId}
                    data-invalid={
                      invalidFields.some((field) => field.includes(attributeId)) || undefined
                    }
                  >
                    <div>
                      <strong>{attributeId[0].toUpperCase() + attributeId.slice(1)}</strong>
                      <small>{attributeCopy[attributeId]}</small>
                      <small>
                        Discipline base {base} · Personal +{bonus} · Total {total}
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
          <div
            className={`${styles.step} ${styles.reviewStep}`}
            data-testid="creation-confirm-workspace"
            data-creation-surface="moonstone"
          >
            <h1 ref={stepHeading} tabIndex={-1}>
              Seal this beginning.
            </h1>
            <p className={styles.intro}>
              In Slot {slotIndex + 1}, this name, visage, Discipline, and chosen strengths are ready
              to enter AUREVANE.
            </p>
            <div className={styles.reviewWorkspace}>
              <div className={styles.reviewPortrait} data-testid="creation-confirm-portrait">
                <AurevaneImage
                  assetId={getStarterPortraitImageAssetId(portraitRef)}
                  sizes="14rem"
                />
              </div>
              <div className={styles.reviewSummary} data-testid="creation-confirm-summary">
                <div
                  className={styles.reviewDisciplineMark}
                  data-testid="creation-confirm-discipline-sigil"
                >
                  <FoundationDisciplineSigil
                    disciplineId={selectedDiscipline.id}
                    className={styles.reviewDisciplineSigil}
                  />
                  <span>
                    <small>Discipline</small>
                    <strong>{selectedDiscipline.name}</strong>
                  </span>
                </div>
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
                    <dd>{selectedDiscipline.name}</dd>
                  </div>
                  <div>
                    <dt>Presentation</dt>
                    <dd>
                      {CHARACTER_PRESENTATIONS.find((item) => item.id === presentationId)?.label}
                    </dd>
                  </div>
                  <div>
                    <dt>Portrait</dt>
                    <dd>{selectedPortrait.label}</dd>
                  </div>
                  <div>
                    <dt>Starter appearance</dt>
                    <dd>
                      {
                        STARTER_CHARACTER_APPEARANCES.find(
                          (item) => item.ref === starterAppearanceRef,
                        )?.label
                      }
                    </dd>
                  </div>
                  {CHARACTER_ATTRIBUTE_IDS.map((attributeId) => (
                    <div key={attributeId}>
                      <dt>{attributeId[0].toUpperCase() + attributeId.slice(1)}</dt>
                      <dd>
                        {selectedDiscipline.baseAttributes[attributeId] +
                          attributeBonuses[attributeId]}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
            {errorMessage ? (
              <p className={styles.error} role="alert">
                {errorMessage}
              </p>
            ) : null}
            <p className={styles.submitState} aria-live="polite">
              {submitting ? 'Binding the name and shaping your character…' : 'The path is ready.'}
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
