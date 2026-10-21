import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { PlayersWorkspace } from './players-workspace'
import type { MasterPanelAccess } from '@/server/master/staff-access'
import { masterNavigationForAccess } from './master-panel-shell'
it('offers neutral bounded search and Owner-only navigation', () => {
  const html = renderToStaticMarkup(createElement(PlayersWorkspace))
  expect(html).toContain('Character name')
  expect(html).toContain('Find players')
  expect(html).not.toContain('textarea')
  const access: MasterPanelAccess = {
    userId: 'owner',
    roles: ['game-owner'],
    effectiveCapabilities: ['staff.manage'],
    specialCapabilities: [],
    accessVersion: 1,
  }
  expect(masterNavigationForAccess(access).map((row) => row.id)).toContain('players')
  expect(
    masterNavigationForAccess({ ...access, roles: ['moderator'] }).map((row) => row.id),
  ).not.toContain('players')
})
it('reads calculated and protected facts, actual AP and every human affected by recovery', () => {
  const player: import('@/master/players').MasterPlayerView = {
    characterId: 'target',
    name: 'Target',
    portraitRef: 'portrait',
    verifiedEmail: 'verified@example.test',
    fingerprint: 'f'.repeat(64),
    deletionPending: false,
    facts: {
      level: 1,
      xp: 0,
      cycle: 1,
      attributes: { might: 12, finesse: 4, vitality: 7, agility: 4, intellect: 3, resolve: 6 },
      build: {
        buildVersion: 1,
        primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
        secondary: null,
        disciplineSkills: [],
        supportActionId: 'basic.guard',
        extensions: { resonance: null, essence: null },
      },
    },
    calculated: { maxHp: 100, maxMp: 30, personalPointPool: 5 },
    disciplines: [],
    learnedSkills: [],
    savedLoadouts: [],
    world: null,
    training: null,
    battle: {
      battleSessionId: 'session',
      version: 4,
      lifecycle: 'active',
      participants: [
        { characterId: 'target', name: 'Target' },
        { characterId: 'peer', name: 'Peer' },
      ],
      combatants: [{ id: 'target', hp: 75, mp: 20, ap: 2, statuses: ['stun'] }],
      recentActions: ['combat_action_used'],
    },
  }
  const html = renderToStaticMarkup(createElement(PlayersWorkspace, { initialPlayer: player }))
  expect(html).toContain('Target, Peer')
  expect(html).toContain('75 HP · 20 MP · 2 AP')
  expect(html).toContain('Calculated maximum resources')
  expect(html).toContain('Identity and account access are protected')
  expect(html).toContain('Review encounter recovery')
  expect(html).toMatch(/<fieldset disabled=""/)
  expect(html).not.toContain('sourceHash')
})
