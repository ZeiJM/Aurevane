import type { SupernaturalStoryState } from '@aurevane/game-core/character/supernatural-state'
import {
  CharacterSupernaturalChoiceControls,
  type SupernaturalChoiceOption,
} from './character-supernatural-choice-controls'

/** Presentation of the existing server projection; no catalog or eligibility is resolved here. */
export function CharacterSupernaturalPath({
  state,
  choices,
}: {
  state: SupernaturalStoryState | null
  choices: readonly SupernaturalChoiceOption[]
}) {
  if (!state)
    return (
      <>
        <h2>Your journey</h2>
        <p>
          Path information is unavailable. Continue your journey; a choice appears here when it is
          available.
        </p>
      </>
    )

  if (state.path !== 'unawakened')
    return (
      <>
        <h2>{state.path === 'ascended' ? 'Ascended' : 'Severed'}</h2>
        <p data-supernatural-path={state.path}>
          {state.path === 'ascended' ? 'Ascension' : 'Severence'} is your permanent supernatural
          path. Ordinary progression cannot switch you to{' '}
          {state.path === 'ascended' ? 'Severence' : 'Ascension'}.
        </p>
        <p>
          Your path persists through Rekindling. Changing Disciplines does not change this choice.
        </p>
        <p>Power details are not available in this view.</p>
      </>
    )

  return (
    <>
      <h2>Unawakened</h2>
      <p>
        {choices.length
          ? 'A permanent path choice is available. Review the consequences before choosing.'
          : 'No path choice is currently available. Continue your journey.'}
      </p>
      {choices.length ? (
        <CharacterSupernaturalChoiceControls stateVersion={state.stateVersion} choices={choices} />
      ) : null}
    </>
  )
}
