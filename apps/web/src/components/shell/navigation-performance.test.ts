import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('authenticated navigation performance contracts', () => {
  it('keeps Master Panel access off the normal shell render path', () => {
    const shell = source('src/components/shell/authenticated-game-shell.tsx')
    const roster = source('src/app/game/page.tsx')
    const accountMenu = source('src/components/shell/account-menu.tsx')

    expect(shell).not.toContain('createServerMasterPanelStaffAccessService')
    expect(roster).not.toContain('createServerMasterPanelStaffAccessService')
    expect(accountMenu).toContain("fetch('/api/master/access'")
  })

  it('shares presence heartbeats across client-side route remounts', () => {
    const presence = source('src/components/shell/online-presence-link.tsx')

    expect(presence).toContain('sharedHeartbeat')
    expect(presence).toContain('lastHeartbeatAt')
    expect(presence).toContain('HEARTBEAT_INTERVAL_MS')
    expect(presence).not.toContain('new AbortController()')
  })

  it('overlaps current Skill resolution with the remaining Character and Arsenal reads', () => {
    for (const path of [
      'src/app/game/(roaming)/character/page.tsx',
      'src/app/game/(roaming)/arsenal/page.tsx',
    ]) {
      const page = source(path)

      expect(page).toContain('const disciplineBuildPromise = loadCharacterBuildContext(')
      expect(page).toContain('const currentDisciplineSkillsPromise = disciplineBuildPromise.then(')
      expect(page).toContain('currentDisciplineSkillsPromise,')
      expect(page).not.toContain('isPv2BuildcraftTestKitEnabled')
      expect(page).not.toContain('pv2TestKitEnabled=')
    }
  })

  it('disables automatic Link prefetch across the authenticated shell', () => {
    for (const path of [
      'src/components/shell/game-rail.tsx',
      'src/components/shell/authenticated-shell-presentation.tsx',
      'src/components/shell/online-presence-link.tsx',
      'src/components/shell/account-menu.tsx',
    ]) {
      const file = source(path)
      const linkCount = file.match(/<Link\b/g)?.length ?? 0
      const disabledPrefetchCount = file.match(/prefetch={false}/g)?.length ?? 0

      expect(linkCount).toBeGreaterThan(0)
      expect(disabledPrefetchCount).toBe(linkCount)
    }
  })

  it('uses the scalar online count instead of loading directory rows for the footer', () => {
    const presenceService = source('src/server/presence/character-presence-service.ts')

    expect(presenceService).toContain("supabase.rpc('count_online_characters_v1')")
  })

  it('keeps World inside the persistent roaming shell without nesting another shell', () => {
    const layout = source('src/app/game/(roaming)/layout.tsx')
    const world = source('src/app/game/(roaming)/world/page.tsx')

    expect(layout).toContain('<AuthenticatedShellFrame>')
    expect(world).not.toContain('AuthenticatedShellFrame')
    expect(world).toContain('AuthenticatedGameRecoveryContent')
  })

  it('bounds repeated Atlas client render work', () => {
    const sector = source('src/components/world/sector-map.tsx')
    const sphere = source('src/components/world/spherical-view.tsx')

    expect(sector).toContain('cellsByIndex')
    expect(sector).not.toContain('sector.cells.find')
    expect(sphere).toContain('requestAnimationFrame')
    expect(sphere).toContain('cancelAnimationFrame')
  })

  it('keeps route-only site music changes from broadcasting a new audio context value', () => {
    const audio = source('src/components/audio/audio-provider.tsx')

    expect(audio).toContain('const contextValue = useMemo<AudioContextValue>(')
    expect(audio).toContain('<AudioRuntimeContext.Provider value={contextValue}>')
  })
})
