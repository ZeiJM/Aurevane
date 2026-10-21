export function shouldPollParticipant(kind: 'pve' | 'pvp', lifecycle: string): boolean {
  return (kind === 'pve' || kind === 'pvp') && lifecycle === 'active'
}
export function participantPollDelay(kind: 'pve' | 'pvp', local: boolean): number {
  return kind === 'pve' ? 2000 : local ? 900 : 1000
}
export function spectatorLinkEnded(status: number): boolean {
  return status === 400 || status === 403
}
export function battleRecoveryNotice(snapshot: unknown): string {
  return snapshot &&
    typeof snapshot === 'object' &&
    'administrativeOutcome' in snapshot &&
    snapshot.administrativeOutcome === 'NoContest' &&
    'rewardOutcome' in snapshot &&
    snapshot.rewardOutcome === 'NoRewards'
    ? 'Encounter ended: No contest · No rewards.'
    : 'The encounter has ended.'
}
