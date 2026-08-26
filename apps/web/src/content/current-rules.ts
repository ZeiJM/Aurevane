import { rulesDocument } from './public-information'

const LAST_UPDATED = '2026-08-26'

export const currentRulesDocument = {
  ...rulesDocument,
  version: '1.1',
  effectiveLabel: 'Phase 1 complete · PV-1 (Phase 2 test)',
  lastUpdated: LAST_UPDATED,
  principles: [
    'Protect accounts and credentials.',
    'Do not impersonate AUREVANE staff or support.',
    'Finding a bug is not misconduct; deliberately abusing a serious bug for unfair advantage may be.',
    'Do not tamper with requests or authoritative state to manufacture progression, ownership, combat outcomes, or PvP advantage.',
    'Direct private PvP and keyed spectation are current Phase 2 test features; ranked matchmaking, seasons, tournaments, and mature competitive policy are not yet active.',
  ] as const,
  sections: rulesDocument.sections.map((section) => {
    if (section.id !== 'current-scope') return section

    return {
      ...section,
      summary: 'Current rules cover the systems players can actually use and test today.',
      body: [
        {
          id: 'current-and-future-scope',
          paragraphs: [
            'AUREVANE currently exposes direct private PvP and keyed spectation as part of PV-1 (Phase 2 test). The same fair-play, account-security, exploit, and authoritative-state expectations apply there: do not tamper with requests, battle identifiers, timers, lobbies, spectator membership, or retries to manufacture an outcome the server did not legitimately grant.',
            'AUREVANE does not yet publish mature ranked-matchmaking, rating, season, tournament, marketplace, trading, guild, nation, or broad social-platform rules because those systems are not released. Material restrictions will be published before meaningful enforcement depends on them.',
            'Public Rules do not disclose anti-cheat thresholds, detection logic, privileged investigation methods, private staff identities, or security-sensitive exploit detail.',
          ],
        },
      ],
    }
  }),
}
