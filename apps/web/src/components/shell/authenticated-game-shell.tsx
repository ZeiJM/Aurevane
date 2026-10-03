import { Kicker, Surface } from '@aurevane/ui'
import type { PersistedCharacter } from '@aurevane/game-core/character/persistence'
import type { Route } from 'next'
import type { ReactNode } from 'react'

import { CharacterIdentityCard } from '@/components/character/character-identity-card'
import { loadCharacterIdentityRailContext } from '@/server/character/character-identity-rail-context'
import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import { getStarterPortraitImageAssetId } from '@/media/character'
import {
  getActiveBattleForUser,
  getActiveSpectatingForUser,
} from '@/server/account/active-game-session'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadCharacterProfileDisplay } from '@/server/character/character-profile-display-service'
import { loadSelectedCharacter } from '@/server/character/selected-character'

import { AuthenticatedShellPresentation } from './authenticated-shell-presentation'
import styles from './authenticated-game-shell.module.css'

type CharacterBackRoute = '/game' | '/game/character'

interface AuthenticatedShellFrameProps {
  children: ReactNode
  sessionLabel?: string
  layout?: 'standard' | 'battlefield'
  footerLabel?: string
  backHref?: CharacterBackRoute
  backLabel?: string
}

function ShellCharacterPortrait({
  character,
  imageUrl,
  rail = false,
}: {
  character: PersistedCharacter
  imageUrl: string | null
  rail?: boolean
}) {
  return (
    <span className={styles.screenPortrait} title={character.name}>
      <CharacterPortraitImage
        imageUrl={imageUrl}
        fallbackAssetId={getStarterPortraitImageAssetId(character.portraitRef)}
        className={styles.screenPortraitImage}
        sizes={
          rail
            ? '(max-height: 620px) 88px, (max-height: 700px) 112px, 165px'
            : '(max-width: 760px) 2rem, 3rem'
        }
        alt=""
        priority
      />
    </span>
  )
}

function RailIdentity({
  character,
  identity,
  imageUrl,
}: {
  character: PersistedCharacter
  identity: Awaited<ReturnType<typeof loadCharacterIdentityRailContext>> | null
  imageUrl: string | null
}) {
  return identity ? (
    <div className="av-rail-full-identity">
      <CharacterIdentityCard {...identity} compactRail />
    </div>
  ) : (
    <div className="av-rail-identity">
      <ShellCharacterPortrait character={character} imageUrl={imageUrl} rail />
      <strong>{character.name}</strong>
      <small>Level {character.level}</small>
    </div>
  )
}

export function AuthenticatedGameRecoveryContent() {
  return (
    <Surface className={styles.primaryCard} tone="elevated">
      <Kicker marker="◇">Game service interruption</Kicker>
      <h1>Your session is safe. The road is briefly closed.</h1>
      <p className={styles.lead}>
        AUREVANE verified your sign-in, but it could not safely load the private account and
        character state required to continue. No character or progression state was changed.
      </p>
      <div className={styles.characterState} data-testid="persistence-recovery">
        <span>Private game state unavailable</span>
        <strong>Retry when account services are ready.</strong>
        <p>
          Retry the private-state load, or use Account to sign out. AUREVANE will not create partial
          character state to bypass the problem.
        </p>
        <form action="/game" method="get">
          <button type="submit">Retry private-state load</button>
        </form>
      </div>
    </Surface>
  )
}

export function AuthenticatedGameRecovery() {
  return (
    <AuthenticatedShellFrame sessionLabel="Service Recovery">
      <AuthenticatedGameRecoveryContent />
    </AuthenticatedShellFrame>
  )
}

export async function AuthenticatedShellFrame({
  children,
  sessionLabel = 'Character Profile',
  backHref,
  backLabel,
  layout = 'standard',
}: AuthenticatedShellFrameProps) {
  let activeCharacter: PersistedCharacter | null = null
  let activeUserId: string | null = null
  let activeBattleHref: Route | null = null
  let activeSpectatingHref: Route | null = null
  try {
    const actor = await getAuthenticatedActor()
    activeUserId = actor.userId
    const [activeBattle, activeSpectating, selectedCharacter] = await Promise.all([
      getActiveBattleForUser(actor.userId).catch(() => null),
      getActiveSpectatingForUser(actor.userId).catch(() => null),
      loadSelectedCharacter(actor),
    ])
    activeBattleHref = activeBattle
      ? (`/game/battle/${activeBattle.battleSessionId}` as Route)
      : null
    activeSpectatingHref =
      !activeBattle && activeSpectating
        ? (`/game/battle/spectate/${activeSpectating.battleKey}` as Route)
        : null
    activeCharacter = selectedCharacter
  } catch {
    activeCharacter = null
    activeUserId = null
  }

  const activeSessionHref = activeBattleHref ?? activeSpectatingHref
  const activeSessionLabel = activeBattleHref
    ? 'Return to Active Battle'
    : activeSpectatingHref
      ? 'Return to Spectated Battle'
      : null

  // Resolve both cosmetic reads before publishing a new shell. Streaming an empty
  // portrait boundary briefly replaced the existing custom avatar on navigation/refresh.
  const [display, identity] =
    activeCharacter && activeUserId
      ? await Promise.all([
          loadCharacterProfileDisplay(activeUserId, activeCharacter.id).catch(() => null),
          layout !== 'battlefield'
            ? loadCharacterIdentityRailContext({ userId: activeUserId }, activeCharacter).catch(
                () => null,
              )
            : Promise.resolve(null),
        ])
      : [null, null]
  const imageUrl = display ? display.imageUrl : (identity?.imageUrl ?? null)

  return (
    <AuthenticatedShellPresentation
      sessionLabel={sessionLabel}
      backHref={backHref}
      backLabel={backLabel}
      layout={layout}
      character={
        activeCharacter ? { name: activeCharacter.name, level: activeCharacter.level } : null
      }
      characterPortrait={
        activeCharacter && activeUserId ? (
          <ShellCharacterPortrait character={activeCharacter} imageUrl={imageUrl} />
        ) : null
      }
      railIdentity={
        layout !== 'battlefield' && activeCharacter && activeUserId ? (
          <RailIdentity character={activeCharacter} identity={identity} imageUrl={imageUrl} />
        ) : null
      }
      activeBattleHref={activeBattleHref}
      activeSpectatingHref={activeSpectatingHref}
      activeSessionHref={activeSessionHref}
      activeSessionLabel={activeSessionLabel}
    >
      {children}
    </AuthenticatedShellPresentation>
  )
}
