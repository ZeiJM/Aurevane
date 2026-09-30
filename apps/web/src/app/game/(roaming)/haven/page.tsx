import Link from 'next/link'
import { Suspense } from 'react'
import { isAurevaneError } from '@aurevane/game-core/errors'
import {
  loadPracticeStatus,
  isPassiveTrainingActive,
} from '@/server/wayfarers-practice/wayfarers-practice-service'
import { createSupabaseWayfarersPracticeRepository } from '@/server/wayfarers-practice/supabase-wayfarers-practice-repository'
import { availableSupernaturalChoiceTransitions } from '@aurevane/game-core/character/supernatural-content'
import { CharacterSupernaturalPath } from '@/components/character/character-supernatural-path'
import { newsArticles } from '@/content/public-information'
import { requireRoamingCharacter } from '@/server/character/require-roaming-character'
import { findAuthoredSupernaturalStoryState } from '@/server/character/supernatural-story-state-service'
import { createSupabaseSupernaturalStoryStateRepository } from '@/server/character/supabase-supernatural-story-state-repository'

export const dynamic = 'force-dynamic'
export default async function HavenPage() {
  const { actor, character } = await requireRoamingCharacter()
  const state = await findAuthoredSupernaturalStoryState(
    actor.userId,
    character.id,
    createSupabaseSupernaturalStoryStateRepository(),
  ).catch((error) => {
    if (isAurevaneError(error) && error.code === 'PERSISTENCE_UNAVAILABLE') return null
    throw error
  })
  const choices = state
    ? availableSupernaturalChoiceTransitions(state).flatMap((transition) =>
        transition.result.path === 'ascended' || transition.result.path === 'severed'
          ? [
              {
                transitionId: transition.id,
                transitionContentVersion: transition.contentVersion,
                path: transition.result.path,
              },
            ]
          : [],
      )
    : []
  return (
    <div className="av-haven">
      <header className="av-page-heading">
        <div>
          <span className="av-eyebrow">A place to return to</span>
          <h1>Haven</h1>
        </div>
        <span>
          Level {character.level} · Cycle {character.progressionCycle.number}
        </span>
      </header>
      <section className="av-haven-hero">
        <div>
          <span className="av-eyebrow">Welcome home, {character.name}</span>
          <h2>Your next chapter awaits.</h2>
          <p>Catch your breath. Gather your strength. The road will be there when you are ready.</p>
          <Link className="av-action" href="/game/world">
            Continue your journey <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
      <div className="av-haven-grid">
        <aside className="av-stone-panel av-current-path" aria-label="Current Path">
          <span className="av-eyebrow">Current Path</span>
          <CharacterSupernaturalPath state={state} choices={choices} />
        </aside>
        <section className="av-stone-panel">
          <span className="av-eyebrow">Your practice</span>
          <Suspense fallback={<p>Reading your training status…</p>}>
            <HavenTraining userId={actor.userId} characterId={character.id} />
          </Suspense>
          <div className="av-daily-note">
            <span>Daily rewards</span>
            <span className="av-soon">Coming Soon</span>
          </div>
        </section>
        <section className="av-stone-panel">
          <span className="av-eyebrow">From the chronicle</span>
          <h2>Latest news</h2>
          {newsArticles.length ? (
            newsArticles.slice(0, 2).map((article) => (
              <Link key={article.id} href={`/news/${article.slug}`}>
                {article.title}
              </Link>
            ))
          ) : (
            <p>The chronicle is quiet. Updates will appear here when published.</p>
          )}
          <Link href="/news">Read the chronicle →</Link>
        </section>
      </div>
      <nav className="av-quick-links" aria-label="Haven shortcuts">
        <Link href="/game/loadout">
          <b>✦</b>
          <span>
            Prepare your loadout<small>Disciplines & techniques</small>
          </span>
          →
        </Link>
        <Link href="/game/training">
          <b>◷</b>
          <span>
            Passive Training<small>Review your training & reports</small>
          </span>
          →
        </Link>
        <Link href="/game/battle">
          <b>⚔</b>
          <span>
            Enter the Battle Hall<small>Practice, challenge & spectate</small>
          </span>
          →
        </Link>
      </nav>
    </div>
  )
}

async function HavenTraining({ userId, characterId }: { userId: string; characterId: string }) {
  const status = await loadPracticeStatus(
    { userId },
    characterId,
    createSupabaseWayfarersPracticeRepository(),
  ).catch((error) => {
    if (!isAurevaneError(error) || error.code !== 'PERSISTENCE_UNAVAILABLE') throw error
    return null
  })
  if (!status)
    return (
      <>
        <h2>Passive Training</h2>
        <p>Training status is temporarily unavailable.</p>
        <Link href="/game/training">Open training →</Link>
      </>
    )
  const active = isPassiveTrainingActive(status)
  return (
    <>
      <h2>{active ? 'Practice is underway.' : 'Prepare for the road.'}</h2>
      <p>
        {status.plannedWindow
          ? `Your ${status.plannedWindow} practice plan is set.`
          : 'Choose a practice plan before your next rest.'}
      </p>
      <Link href="/game/training">Review Passive Training →</Link>
    </>
  )
}
