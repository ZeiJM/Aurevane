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
    for (const path of ['src/app/game/character/page.tsx', 'src/app/game/arsenal/page.tsx']) {
      const page = source(path)

      expect(page).toContain('const disciplineBuildPromise = loadCharacterBuildContext(')
      expect(page).toContain('const currentDisciplineSkillsPromise = disciplineBuildPromise.then(')
      expect(page).toContain('currentDisciplineSkillsPromise,')
      expect(page).not.toContain('isPv2BuildcraftTestKitEnabled')
      expect(page).not.toContain('pv2TestKitEnabled=')
    }
  })

  it('uses the scalar online count instead of loading directory rows for the footer', () => {
    const presenceService = source('src/server/presence/character-presence-service.ts')

    expect(presenceService).toContain("supabase.rpc('count_online_characters_v1')")
  })
})
