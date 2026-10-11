import Link from 'next/link'
import { AuthenticatedShellFrame } from '@/components/shell/authenticated-game-shell'
import type { ReactNode } from 'react'

import { AurevaneImage } from '@/components/media/aurevane-image'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadSelectedCharacter } from '@/server/character/selected-character'

import { SiteHeader } from '@/components/shell/site-header'
import styles from './public-information-shell.module.css'

export type PublicInformationSection = 'news' | 'manual' | 'rules'

interface PublicInformationShellProps {
  active: PublicInformationSection
  children: ReactNode
}

async function loadOptionalGameIdentity() {
  try {
    const actor = await getAuthenticatedActor()
    return {
      authenticated: true as const,
      character: await loadSelectedCharacter(actor),
    }
  } catch {
    return {
      authenticated: false as const,
      character: null,
    }
  }
}

export async function PublicInformationShell({ active, children }: PublicInformationShellProps) {
  const identity = await loadOptionalGameIdentity()
  const character = identity.character
  if (character)
    return (
      <AuthenticatedShellFrame>
        <div className={styles.reading} data-public-reading>
          {children}
        </div>
      </AuthenticatedShellFrame>
    )
  const gameHref = identity.authenticated ? (character ? '/game/character' : '/game') : '/'
  const gameLabel = identity.authenticated
    ? character
      ? 'Return to Game'
      : 'Character Select'
    : 'Play / Sign In'

  return (
    <div className={styles.shell} data-testid="public-information-shell" data-public-concept="true">
      <div className={styles.worldBackdrop} aria-hidden="true">
        <AurevaneImage
          assetId="environment.archive.interior"
          className={styles.worldBackdropImage}
          sizes="100vw"
        />
      </div>
      <a className="skip-link" href="#public-information-main">
        Skip to public information
      </a>

      <SiteHeader
        brandHref={gameHref}
        brandLabel={identity.authenticated ? 'AUREVANE game home' : 'AUREVANE account entry home'}
        activeSection={active}
        utility={
          <Link className={styles.playLink} href={gameHref}>
            {gameLabel}
          </Link>
        }
      />

      <main className={styles.main} id="public-information-main">
        {children}
      </main>
    </div>
  )
}
