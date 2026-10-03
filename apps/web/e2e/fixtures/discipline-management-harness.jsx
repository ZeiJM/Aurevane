import React from 'react'
import { createRoot } from 'react-dom/client'
import { CharacterDisciplineBuildPanel } from '@/components/character/character-discipline-build-panel'
import { buildPrimaryDisciplinePreview } from '@aurevane/game-core/character/discipline-build'
import { DISCIPLINE_ATLAS } from '@aurevane/game-core/character/discipline-atlas'
import { FOUNDATION_DISCIPLINES } from '@aurevane/game-core/character/foundation-disciplines'
import './production-styles'
const options = DISCIPLINE_ATLAS.filter((d) => d.publication === 'published').map((d) => ({
  definition: { ...d, definitionVersion: 1, enabledForPrimary: true, enabledForSecondary: true },
  profile: { disciplineId: d.id, profileVersion: 1, statOffsets: {} },
}))
const previewFor = (id) => {
  const o = options.find((o) => o.definition.id === id)
  return buildPrimaryDisciplinePreview({
    attributes:
      FOUNDATION_DISCIPLINES.find((d) => d.id === id)?.baseAttributes ??
      FOUNDATION_DISCIPLINES[0].baseAttributes,
    level: 1,
    primaryDefinition: o.definition,
    primaryProfile: o.profile,
  })
}
const attunement = {
  policy: { version: 1, primaryCooldownSeconds: 0, secondaryCooldownSeconds: 0 },
  serverNow: new Date().toISOString(),
  primaryLockedUntil: null,
  secondaryLockedUntil: null,
  primaryRemainingSeconds: 0,
  secondaryRemainingSeconds: 0,
}
window.calls = []
window.delay = 0
window.fail = null
window.characterId = 'character-a'
window.buildVersion = 1
window.primary = 'vanguard'
window.secondary = 'lifebinder'
window.hold = new URLSearchParams(location.search).has('holdGet') ? 'GET' : false
window.throwMethod = null
window.commitThenThrow = false
window.cooldown = 0
window.contextCharacter = null
window.release = () => {}
window.fetch = async (url, options = {}) => {
  const payload = options.body ? JSON.parse(options.body) : {}
  const method = options.method ?? 'GET'
  window.calls.push({ method, payload })
  if (window.hold === options.method) await new Promise((r) => (window.release = r))
  if (window.throwMethod === options.method && !window.commitThenThrow) throw new Error('offline')
  if (window.delay) await new Promise((r) => setTimeout(r, window.delay))
  if (window.fail === options.method)
    return new Response(JSON.stringify({ error: { message: 'Fixture failure' } }), { status: 409 })
  if (method === 'GET') return new Response(JSON.stringify({ context: currentContext() }))
  if (options.method === 'POST') {
    const current = previewFor(window.primary),
      proposed = previewFor(payload.primaryDisciplineId ?? window.primary)
    return new Response(
      JSON.stringify({
        preview: {
          characterId: window.characterId,
          current,
          currentSecondary: optionsFor(window.secondary),
          proposed,
          proposedSecondary: optionsFor(
            'secondaryDisciplineId' in payload ? payload.secondaryDisciplineId : window.secondary,
          ),
          currentAttributes:
            FOUNDATION_DISCIPLINES.find((d) => d.id === current.definition.id)?.baseAttributes ??
            FOUNDATION_DISCIPLINES[0].baseAttributes,
          proposedAttributes:
            FOUNDATION_DISCIPLINES.find((d) => d.id === proposed.definition.id)?.baseAttributes ??
            FOUNDATION_DISCIPLINES[0].baseAttributes,
          buildVersion: window.buildVersion,
          changes: {
            primary: window.primary !== (payload.primaryDisciplineId ?? window.primary),
            secondary:
              window.secondary !==
              ('secondaryDisciplineId' in payload
                ? payload.secondaryDisciplineId
                : window.secondary),
          },
          attunement: { ...attunement, primaryRemainingSeconds: window.cooldown },
        },
      }),
    )
  }
  window.primary = payload.primaryDisciplineId ?? window.primary
  if ('secondaryDisciplineId' in payload) window.secondary = payload.secondaryDisciplineId
  window.buildVersion++
  if (window.throwMethod === 'PUT' && window.commitThenThrow) throw new Error('response lost')
  return new Response(JSON.stringify({ context: currentContext() }))
}
function currentContext() {
  return {
    build: {
      characterId: window.contextCharacter ?? window.characterId,
      buildVersion: window.buildVersion,
    },
    current: previewFor(window.primary),
    currentSecondary: optionsFor(window.secondary),
    attunement,
    attributes:
      FOUNDATION_DISCIPLINES.find((d) => d.id === window.primary)?.baseAttributes ??
      FOUNDATION_DISCIPLINES[0].baseAttributes,
  }
}

function optionsFor(id) {
  return options.find((o) => o.definition.id === id)?.definition ?? null
}
const root = createRoot(document.getElementById('root'))
window.renderPanel = (characterId = 'character-a') =>
  root.render(
    <CharacterDisciplineBuildPanel
      key={characterId}
      characterId={characterId}
      initialCurrent={previewFor('vanguard')}
      initialCurrentSecondary={optionsFor('lifebinder')}
      availablePrimaries={options}
      availableSecondaries={options.map((o) => ({ ...o, masteredAt: 'earned' }))}
      initialAttunement={attunement}
      coreAttributes={FOUNDATION_DISCIPLINES[0].baseAttributes}
    />,
  )
window.renderPanel()
