import { GameButton, Kicker, StatusMark, Surface } from '@aurevane/ui'

import { AudioSettingsMenu } from '@/components/audio/audio-settings-menu'
import { AurevaneImage } from '@/components/media/aurevane-image'
import { foundationStatus } from '@/lib/foundation'

const navigation = [
  { index: '01', label: 'World', active: true, phase: 'Foundation' },
  { index: '02', label: 'Character', active: false, phase: 'Phase 1' },
  { index: '03', label: 'Expeditions', active: false, phase: 'Planned' },
  { index: '04', label: 'Guilds', active: false, phase: 'Planned' },
] as const

const pillars = [
  {
    index: 'I',
    title: 'Buildcraft with identity',
    copy: 'Disciplines, mastery, Confluences, Soulmarks, and equipment are designed to create lasting build decisions.',
  },
  {
    index: 'II',
    title: 'Tactical by intention',
    copy: 'Position, terrain, timing, composition, and prediction will matter more than simply chasing larger numbers.',
  },
  {
    index: 'III',
    title: 'A persistent shared world',
    copy: 'The browser is the doorway to a world built around long-lived characters, cooperation, rivalry, and change.',
  },
] as const

export function FoundationShell() {
  return (
    <div className="game-shell" data-testid="game-shell">
      <a className="skip-link" href="#foundation-main">
        Skip to main content
      </a>

      <header className="game-shell__masthead">
        <a className="brand" href="#foundation-main" aria-label="AUREVANE foundation home">
          <span className="brand__crest" aria-hidden="true">
            <span>A</span>
          </span>
          <span className="brand__wordmark">
            <strong>AUREVANE</strong>
            <small>Persistent tactical fantasy</small>
          </span>
        </a>

        <div className="masthead-status" aria-label="Foundation status">
          <span className="masthead-status__signal">
            <StatusMark /> {foundationStatus.label}
          </span>
          <span className="masthead-status__phase">{foundationStatus.phase}</span>
        </div>

        <AudioSettingsMenu />
      </header>

      <aside className="game-shell__rail" aria-label="Primary game navigation">
        <nav className="shell-nav">
          {navigation.map((item) =>
            item.active ? (
              <a
                className="shell-nav__item shell-nav__item--active"
                href="#foundation-main"
                aria-current="page"
                key={item.label}
              >
                <span className="shell-nav__index" aria-hidden="true">
                  {item.index}
                </span>
                <span className="shell-nav__label">{item.label}</span>
                <span className="shell-nav__phase">{item.phase}</span>
              </a>
            ) : (
              <button className="shell-nav__item" type="button" disabled key={item.label}>
                <span className="shell-nav__index" aria-hidden="true">
                  {item.index}
                </span>
                <span className="shell-nav__label">{item.label}</span>
                <span className="shell-nav__phase">{item.phase}</span>
              </button>
            ),
          )}
        </nav>
        <p className="rail-build">DEV // {foundationStatus.ticket}</p>
      </aside>

      <main className="game-shell__main" id="foundation-main">
        <section className="world-stage" aria-labelledby="aurevane-title">
          <AurevaneImage assetId="ui.foundation.vista" className="world-stage__media" />
          <div className="world-stage__shade" aria-hidden="true" />
          <div className="world-stage__ornament" aria-hidden="true">
            <span />
            <b>◆</b>
            <span />
          </div>

          <div className="world-stage__content">
            <Kicker marker="◆">Phase zero // presentation foundation</Kicker>
            <h1 id="aurevane-title">AUREVANE</h1>
            <p className="world-stage__lead">
              A persistent tactical fantasy RPG about becoming stronger without losing who your
              character has become.
            </p>

            <div className="world-stage__action-row">
              <GameButton type="button" disabled>
                Enter the world
              </GameButton>
              <p>
                World access opens with playable systems.
                <br />
                This shell is intentionally gameplay-free.
              </p>
            </div>
          </div>

          <div className="world-stage__request" aria-label="Production media status">
            <span>Vista</span>
            <strong>ART-UI-001</strong>
            <em>Requested</em>
          </div>
        </section>

        <section className="foundation-pillars" aria-label="AUREVANE design pillars">
          {pillars.map((pillar) => (
            <Surface className="pillar" tone="quiet" key={pillar.index}>
              <span className="pillar__index" aria-hidden="true">
                {pillar.index}
              </span>
              <h2>{pillar.title}</h2>
              <p>{pillar.copy}</p>
            </Surface>
          ))}
        </section>
      </main>

      <aside className="game-shell__side" aria-label="Foundation details">
        <Surface className="side-card" tone="quiet">
          <Kicker marker={<StatusMark />}>Foundation</Kicker>
          <h2>Built underneath the beauty.</h2>
          <p>{foundationStatus.message}</p>
          <dl className="system-list">
            <div>
              <dt>Server authority</dt>
              <dd>Online</dd>
            </div>
            <div>
              <dt>Persistence</dt>
              <dd>Online</dd>
            </div>
            <div>
              <dt>Media registry</dt>
              <dd>Online</dd>
            </div>
            <div>
              <dt>Audio director</dt>
              <dd>Gesture gated</dd>
            </div>
          </dl>
        </Surface>

        <Surface className="side-card side-card--media" tone="quiet">
          <Kicker marker="◇">Production queue</Kicker>
          <h2>Media stays traceable.</h2>
          <p>
            The shell never substitutes random web assets for missing production art or sound.
            Requested media remains explicit until review.
          </p>
          <ul className="request-list">
            <li>
              <span>World vista</span>
              <strong>ART-UI-001</strong>
            </li>
            <li>
              <span>Title score</span>
              <strong>AUDIO-MUS-001</strong>
            </li>
            <li>
              <span>Ambience</span>
              <strong>AUDIO-AMB-001</strong>
            </li>
          </ul>
        </Surface>
      </aside>

      <footer className="game-shell__footer">
        <span>AUREVANE // DEVELOPMENT BUILD</span>
        <span>{foundationStatus.phase}</span>
        <span>{foundationStatus.ticket}</span>
        <span>Server-authoritative by design</span>
      </footer>
    </div>
  )
}
