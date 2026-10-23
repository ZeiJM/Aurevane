import React from 'react'
import { createRoot } from 'react-dom/client'
import { usePathname } from 'next/navigation'
import { MasterPanelShell } from '@/components/master/master-panel-shell'
import { CombatEffectTimingEditor } from '@/components/master/combat-content/combat-effect-timing-editor'
import { BattlefieldElevationEditor } from '@/components/master/combat-content/battlefield-elevation-editor'
import { WorldEnvironmentEditor } from '@/components/master/world-environment/world-environment-editor'
import { SiteMusicManagement } from '@/components/master/music/site-music-management'
import { AudioProvider } from '@/components/audio/audio-provider'
import { AudioWorkspace } from '@/components/audio/audio-workspace'
import { createDefaultSiteMusicConfig, parseSiteMusicDraft } from '@/lib/site-music'
import { DEFAULT_WORLD_ENVIRONMENT_SETTINGS } from '@/world/environment'
import { defaultCombatEffectTimingPolicy } from '@aurevane/game-core/combat/combat-effect-timing'
import './production-styles'

const nativeFetch = window.fetch.bind(window)
const config = createDefaultSiteMusicConfig()
config.routeOverrides = [
  {
    id: 'legacy-game',
    label: 'Legacy game silence',
    pathPrefix: '/game',
    enabled: false,
    track: config.defaultTrack,
  },
]
let savedMusic = config
let settings = { ...DEFAULT_WORLD_ENVIRONMENT_SETTINGS }
const initialNowMs = Date.now()
window.__operationsRequests = []
// HTTP boundary fixture: production forms, parsing, resolver, player and styles are mounted.
// Owner authorization, SQL, storage durability and hosted publication are tested separately.
window.fetch = async (input, options) => {
  if (input === '/api/site-music') return Response.json({ config: savedMusic })
  if (typeof input !== 'string' || !input.startsWith('/api/master/'))
    return nativeFetch(input, options)
  const body = JSON.parse(options.body)
  window.__operationsRequests.push({ path: input, body })
  if (input === '/api/master/site-music') {
    savedMusic = {
      ...savedMusic,
      ...parseSiteMusicDraft(body.config),
      revision: savedMusic.revision + 1,
    }
    return Response.json({ config: savedMusic })
  }
  if (input === '/api/master/world-environment') {
    const change = body.change
    settings = {
      ...settings,
      dayLengthMinutes: change.dayLengthMinutes,
      timeOffsetMinutes: change.timeOffsetMinutes,
      frozenMinuteOfDay: change.frozenMinuteOfDay,
      ...(change.weather === 'unchanged'
        ? {}
        : {
            weatherOverride: change.weather,
            weatherOverrideUntil:
              change.weather === null ? null : Date.now() + change.durationMinutes * 60_000,
          }),
      version: settings.version + 1,
    }
    return Response.json({ settings })
  }
  return Response.json({ policy: { ...body.policy, version: body.policy.version + 1 } })
}
const access = {
  userId: 'fixture-owner',
  accessVersion: 1,
  roles: ['game-owner'],
  specialCapabilities: [],
  effectiveCapabilities: ['master.access', 'staff.manage', 'content.combat.author'],
}
function App() {
  const pathname = usePathname()
  const view = new URLSearchParams(location.search).get('view') ?? 'music'
  return (
    <AudioProvider>
      <div>
        <button onClick={() => history.pushState(null, '', '/game/world?view=music')}>
          Visit World
        </button>
        <button onClick={() => history.pushState(null, '', '/game/character?view=music')}>
          Visit Character
        </button>
        <span data-fixture-path>{pathname}</span>
      </div>
      <MasterPanelShell
        access={access}
        activeSection={
          view === 'rules' ? 'combat-timing' : view === 'world' ? 'world-environment' : 'music'
        }
        title={
          view === 'rules' ? 'Combat Rules' : view === 'world' ? 'World Environment' : 'Site Music'
        }
        description="Operational browser fixture"
      >
        {view === 'rules' ? (
          <>
            <CombatEffectTimingEditor
              initialPolicy={defaultCombatEffectTimingPolicy()}
              usedBy={{ damage: [{ contentKey: 'skill.fixture', name: 'Fixture Strike' }] }}
            />
            <BattlefieldElevationEditor
              initialPolicy={{
                version: 1,
                level1BasisPoints: 6000,
                level2BasisPoints: 3000,
                level3BasisPoints: 1000,
              }}
            />
          </>
        ) : view === 'world' ? (
          <WorldEnvironmentEditor initialSettings={settings} initialNowMs={initialNowMs} />
        ) : (
          <SiteMusicManagement initialConfig={savedMusic} />
        )}
      </MasterPanelShell>
      {view === 'music' ? <AudioWorkspace /> : null}
    </AudioProvider>
  )
}
createRoot(document.getElementById('root')).render(<App />)
