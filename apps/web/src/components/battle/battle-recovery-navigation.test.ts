import { expect, it } from 'vitest'
import {
  battleRecoveryNotice,
  participantPollDelay,
  shouldPollParticipant,
  spectatorLinkEnded,
} from './battle-recovery-navigation'
import { battleReturnNavigation } from './battle-return-navigation'
it('polls active PvE within two seconds and preserves faster PvP polling', () => {
  expect(shouldPollParticipant('pve', 'active')).toBe(true)
  expect(participantPollDelay('pve', true)).toBeLessThanOrEqual(2000)
  expect(participantPollDelay('pve', false)).toBeLessThanOrEqual(2000)
  expect(shouldPollParticipant('pve', 'abandoned')).toBe(false)
  expect(shouldPollParticipant('pvp', 'completed')).toBe(false)
  expect(participantPollDelay('pvp', true)).toBe(900)
})
it.each([400, 403])('ejects ended/revoked spectator HTTP %s', (status) =>
  expect(spectatorLinkEnded(status)).toBe(true),
)
it.each([409, 503, 500, 0])('keeps transient spectator HTTP %s retryable', (status) =>
  expect(spectatorLinkEnded(status)).toBe(false),
)
it('attributes only authoritative no-contest and preserves canonical World return over query preference', () => {
  expect(
    battleRecoveryNotice({ administrativeOutcome: 'NoContest', rewardOutcome: 'NoRewards' }),
  ).toMatch(/No contest.*No rewards/)
  expect(battleRecoveryNotice({})).not.toMatch(/No contest|No rewards/)
  expect(battleReturnNavigation('world', 'battle-hall').href).toBe('/game/world')
})
