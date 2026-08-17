export interface PublicBodyBlock {
  id: string
  title?: string
  paragraphs: readonly string[]
  bullets?: readonly string[]
}

export interface ManualArticle {
  id: string
  slug: string
  title: string
  summary: string
  category: string
  lastUpdated: string
  rulesVersion?: string
  body: readonly PublicBodyBlock[]
}

export interface NewsArticle {
  id: string
  slug: string
  title: string
  summary: string
  category: string
  publishedAt: string
  lastUpdated: string
  body: readonly PublicBodyBlock[]
  relatedManualSlugs?: readonly string[]
}

export interface PublicRuleSection {
  id: string
  title: string
  summary: string
  body: readonly PublicBodyBlock[]
}

export const PUBLIC_CONTENT_REVISION = 'p1.7-2026-08-16'
export const PUBLIC_CONTENT_LAST_UPDATED = '2026-08-16'

/**
 * Source-controlled public content is intentional at P1.7 scale. The stable IDs/slugs and typed
 * read model are the migration boundary for the later versioned Public Communications repository.
 * Only published, spoiler-safe material belongs in this module.
 */
export const newsArticles: readonly NewsArticle[] = []

export const manualArticles: readonly ManualArticle[] = [
  {
    id: 'manual.start-here',
    slug: 'start-here',
    title: 'Start Here',
    summary: 'What AUREVANE is today, what you can do now, and what is still being built.',
    category: 'Orientation',
    lastUpdated: PUBLIC_CONTENT_LAST_UPDATED,
    rulesVersion: 'Phase 1 foundation',
    body: [
      {
        id: 'what-is-aurevane',
        title: 'What is AUREVANE?',
        paragraphs: [
          'AUREVANE is an original persistent browser-based tactical fantasy RPG. Your account owns a durable character identity and authoritative progression state rather than a disposable browser save.',
          'The currently released player foundation covers account entry, permanent character creation, the character profile, Character XP, and Wayfarer’s Practice. Tactical combat foundations are under active development, but the first player-facing battle experience has not been released yet.',
        ],
      },
      {
        id: 'current-foundation',
        title: 'What you can use now',
        paragraphs: [
          'The current build is intentionally narrow. These are the player-facing foundations already present:',
        ],
        bullets: [
          'Create or sign in to an account and safely return to the same private profile.',
          'Create one base-slot character with a validated identity, four core attributes, and a Foundation Discipline choice.',
          'Open the authoritative character profile and inspect server-calculated derived stats.',
          'Progress through the versioned Character XP and level foundation.',
          'Receive and claim a bounded Wayfarer’s Practice Training Report after a meaningful absence when one is available.',
        ],
      },
      {
        id: 'planned-identity',
        title: 'The larger game',
        paragraphs: [
          'AUREVANE is being built toward tactical combat, deeper Discipline buildcraft, Current + Legacy choices, Confluences, exploration, co-op, Expeditions, PvP, and a persistent world. Those systems are part of the approved direction, but this Manual does not present unreleased mechanics as playable features.',
          'When a system becomes player-facing, its canonical guide will expand here and important changes will be recorded in News.',
        ],
      },
    ],
  },
  {
    id: 'manual.account-security',
    slug: 'account-security',
    title: 'Account & Security',
    summary: 'How account identity, private character data, sessions, and sign-out are separated.',
    category: 'Account',
    lastUpdated: PUBLIC_CONTENT_LAST_UPDATED,
    rulesVersion: 'P1.1',
    body: [
      {
        id: 'account-boundary',
        title: 'Your account is not your character name',
        paragraphs: [
          'Your sign-in identity is private authentication data. It is not reused as your public character identity. AUREVANE verifies the signed-in session before private profile or character state is loaded.',
          'Private account and character reads are authorized on the server. Changing browser data or request parameters does not grant ownership of another player’s state.',
        ],
      },
      {
        id: 'shared-devices',
        title: 'Shared devices and sign-out',
        paragraphs: [
          'Sign out when you finish on a shared device. Some environments may require email confirmation during account creation, depending on the active authentication configuration.',
          'AUREVANE staff should never need your password or secret credentials. See the public Rules for the current account-security and impersonation expectations.',
        ],
      },
      {
        id: 'service-interruption',
        title: 'If private account services are unavailable',
        paragraphs: [
          'The game shell fails closed rather than inventing partial private state. A verified session may be shown a recovery state if the account or character repository cannot be safely loaded.',
          'News, Manual, and Rules are deliberately independent public reads and remain available without loading your private profile.',
        ],
      },
    ],
  },
  {
    id: 'manual.character-creation',
    slug: 'character-creation',
    title: 'Character Creation',
    summary:
      'The current level-1 creation contract, identity choices, and starting attribute budget.',
    category: 'Character',
    lastUpdated: PUBLIC_CONTENT_LAST_UPDATED,
    rulesVersion: 'Character creation v1',
    body: [
      {
        id: 'identity',
        title: 'Identity choices',
        paragraphs: [
          'Character creation currently records a validated name, presentation, pronoun preset, official portrait reference, starter appearance reference, Foundation Discipline identity, and the four starting attributes.',
          'Character names are normalized and validated. The current rules accept names from 3 to 24 Unicode code points, reject reserved staff/system identities, and enforce authoritative uniqueness when the character is persisted.',
        ],
      },
      {
        id: 'attributes',
        title: 'Starting attributes',
        paragraphs: [
          'Might, Finesse, Intellect, and Resolve each begin from the same baseline of 5. Creation gives exactly 4 additional whole-number points to distribute, with no more than 4 bonus points placed into one attribute.',
          'The server rebuilds and validates the starting state. The browser does not get to submit its own level, XP total, timestamps, or final attribute totals.',
        ],
      },
      {
        id: 'foundation-discipline',
        title: 'Foundation Discipline',
        paragraphs: [
          'Your Foundation Discipline is an onboarding identity choice at this stage. It does not mean Discipline Mastery, Arts, Traits, Legacy Disciplines, Confluences, or Soulmarks are already implemented.',
          'A valid new character begins at Level 1 with 0 Character XP and the first progression cycle established by the authoritative creation rules.',
        ],
      },
    ],
  },
  {
    id: 'manual.attributes-derived-stats',
    slug: 'attributes-derived-stats',
    title: 'Attributes & Derived Stats',
    summary: 'How the four attributes feed the current versioned stat framework.',
    category: 'Character',
    lastUpdated: PUBLIC_CONTENT_LAST_UPDATED,
    rulesVersion: 'Derived stat rules v1',
    body: [
      {
        id: 'four-attributes',
        title: 'The four attributes',
        paragraphs: [
          'Might, Finesse, Intellect, and Resolve are permanent core inputs to the current profile framework. Their purpose is broader than one combat number: each can contribute to several derived values.',
          'The profile reads authoritative character attributes and calculates derived values from one versioned rule source. Browser-only edits cannot change those values on the server.',
        ],
      },
      {
        id: 'current-derived-stats',
        title: 'Current derived-stat language',
        paragraphs: ['The Phase 1 ruleset currently defines these derived values:'],
        bullets: [
          'Maximum HP and Maximum MP',
          'Physical Power and Mystic Power',
          'Armor and Ward',
          'Accuracy and Evasion',
          'Critical Chance',
          'Initiative',
          'Movement and Jump',
          'Status Resistance',
        ],
      },
      {
        id: 'tuning',
        title: 'Versioned, not frozen balance',
        paragraphs: [
          'The current coefficients are development balance for a deterministic profile framework, not a promise that launch combat tuning is final. Rules are centralized and versioned so later combat, equipment, and Discipline modifiers can extend the same calculation contract without duplicating formulas in the UI.',
          'As the first player-facing tactical slice arrives, the Manual will explain the derived stats that have real battlefield meaning in that slice.',
        ],
      },
    ],
  },
  {
    id: 'manual.character-xp',
    slug: 'character-xp',
    title: 'Level & Character XP',
    summary:
      'The authoritative 1–100 Character XP foundation and what level does — and does not — mean.',
    category: 'Progression',
    lastUpdated: PUBLIC_CONTENT_LAST_UPDATED,
    rulesVersion: 'P1.5 progression foundation',
    body: [
      {
        id: 'xp-authority',
        title: 'Character XP is server-awarded',
        paragraphs: [
          'Character XP uses a versioned, configurable level curve with a Level 1–100 boundary. Authoritative game services grant XP with recorded provenance; the browser cannot choose an award amount for itself.',
          'One award can cross more than one level threshold, and progression resolves atomically so retries or concurrent requests do not duplicate the same grant.',
        ],
      },
      {
        id: 'level-versus-mastery',
        title: 'Level is not Discipline Mastery',
        paragraphs: [
          'Character Level and future Discipline Mastery are separate concepts. Phase 1 implements Character XP and level only. Discipline Mastery belongs to later buildcraft work and is not currently a player-facing progression track.',
          'The current development curve is configurable. It should not be read as a final promise about launch pacing or calendar time to Level 100.',
        ],
      },
    ],
  },
  {
    id: 'manual.wayfarers-practice',
    slug: 'wayfarers-practice',
    title: 'Wayfarer’s Practice',
    summary:
      'Balanced Practice, Training Reports, Rested Momentum, and the limits of offline progression.',
    category: 'Progression',
    lastUpdated: PUBLIC_CONTENT_LAST_UPDATED,
    rulesVersion: 'P1.6 Balanced Practice',
    body: [
      {
        id: 'balanced-practice',
        title: 'Balanced Practice only',
        paragraphs: [
          'Phase 1 uses Balanced Practice as AUREVANE’s absence-protection foundation. The server calculates eligible elapsed time lazily from server-controlled timestamps; your device clock and timezone do not determine rewards.',
          'After a meaningful eligible absence, the server may generate a Training Report containing bounded Character XP and Rested Momentum. The exact report is authoritative and can be claimed once.',
        ],
      },
      {
        id: 'guardrails',
        title: 'What offline practice cannot do',
        paragraphs: [
          'Wayfarer’s Practice is deliberately not an idle-game substitute for playing AUREVANE. A Training Report cannot complete or fabricate major game outcomes.',
        ],
        bullets: [
          'It cannot complete story, quests, bosses, Expeditions, or event participation.',
          'It cannot grant PvP rank, Confluences, Soulmarks, Archive discoveries, rare equipment, economy output, or Rekindling eligibility.',
          'It cannot use client-clock changes or repeated claim submissions to farm the same absence window.',
          'Discipline Focus and offline Mastery are not part of the Phase 1 implementation.',
        ],
      },
      {
        id: 'missing-report',
        title: 'No report showing?',
        paragraphs: [
          'A short reconnect may not qualify as a meaningful absence. A prior eligible window may also already be claimed. Refreshing does not create a new reward merely because the page was reloaded.',
          'If private progression services are unavailable, AUREVANE should fail closed rather than inventing a report from browser time.',
        ],
      },
    ],
  },
  {
    id: 'manual.faq',
    slug: 'faq',
    title: 'FAQ & Troubleshooting',
    summary: 'Straight answers for the most common questions in the current foundation build.',
    category: 'Help',
    lastUpdated: PUBLIC_CONTENT_LAST_UPDATED,
    rulesVersion: 'Phase 1 foundation',
    body: [
      {
        id: 'can-i-play-combat',
        title: 'Can I play tactical combat yet?',
        paragraphs: [
          'Not yet. Tactical combat engine work exists, but the first player-facing battle interface is still gated behind reconciliation, hardening, and external-preview verification. This Manual will not label that work as released until players can actually use it.',
        ],
      },
      {
        id: 'refresh-character',
        title: 'Will refresh lose my character?',
        paragraphs: [
          'A successfully persisted character is authoritative server state. Refreshing or signing back in should return the same base-slot character rather than creating a browser-local copy.',
        ],
      },
      {
        id: 'public-pages',
        title: 'Do I need an account to read News, Manual, or Rules?',
        paragraphs: [
          'No. These three routes are permanent public information surfaces. They do not require character readiness or private player-state loading.',
        ],
      },
      {
        id: 'future-systems',
        title: 'Where are Confluences, PvP, trading, guilds, and Expeditions?',
        paragraphs: [
          'They are later roadmap systems. Their existence in the approved game direction does not make them current playable features. Their Manual and Rules coverage will arrive with the implementation that makes those systems real.',
        ],
      },
    ],
  },
  {
    id: 'manual.glossary',
    slug: 'glossary',
    title: 'Glossary',
    summary: 'Current player-facing terms without unreleased-system spoilers.',
    category: 'Reference',
    lastUpdated: PUBLIC_CONTENT_LAST_UPDATED,
    rulesVersion: 'Phase 1 foundation',
    body: [
      {
        id: 'character-xp-term',
        title: 'Character XP',
        paragraphs: [
          'Server-authoritative experience used by the current Character Level progression foundation.',
        ],
      },
      {
        id: 'foundation-discipline-term',
        title: 'Foundation Discipline',
        paragraphs: [
          'The initial Discipline identity selected during character creation. In Phase 1 it is onboarding identity metadata, not a complete Mastery/Arts build system.',
        ],
      },
      {
        id: 'rested-momentum-term',
        title: 'Rested Momentum',
        paragraphs: [
          'A bounded return-support value associated with Wayfarer’s Practice. It does not complete content while you are away.',
        ],
      },
      {
        id: 'training-report-term',
        title: 'Training Report',
        paragraphs: [
          'A server-generated, claim-once report for eligible Wayfarer’s Practice accrual.',
        ],
      },
      {
        id: 'derived-stat-term',
        title: 'Derived Stat',
        paragraphs: [
          'A value calculated from the authoritative versioned stat rules rather than edited as independent browser state.',
        ],
      },
      {
        id: 'server-authoritative-term',
        title: 'Server-authoritative',
        paragraphs: [
          'The server validates and owns valuable game outcomes such as character creation, progression, and future combat results; client intent alone is not trusted as the outcome.',
        ],
      },
    ],
  },
]

export const rulesDocument = {
  id: 'rules.public-foundation',
  version: '1.0',
  effectiveLabel: 'Phase 1 public foundation',
  lastUpdated: PUBLIC_CONTENT_LAST_UPDATED,
  principles: [
    'Protect accounts and credentials.',
    'Do not impersonate AUREVANE staff or support.',
    'Finding a bug is not misconduct; deliberately abusing a serious bug for unfair advantage may be.',
    'Do not tamper with requests or authoritative state to manufacture progression or ownership.',
    'Rules expand with released systems; unreleased PvP, economy, guild, tournament, and social policies are not silently in force.',
  ] as const,
  sections: [
    {
      id: 'fair-play',
      title: 'Fair Play & Game Integrity',
      summary: 'Do not manufacture authoritative game outcomes the normal game did not grant.',
      body: [
        {
          id: 'state-tampering',
          title: 'Authoritative state',
          paragraphs: [
            'Do not deliberately tamper with requests, identifiers, retries, or other client-controlled inputs to make AUREVANE award progression, character ownership, rewards, or other authoritative state you did not legitimately earn.',
            'A strong strategy or clever use of an intended mechanic is not automatically an exploit. Balance problems should be fixed as balance problems; misconduct requires an actual rule violation.',
          ],
        },
      ],
    },
    {
      id: 'bugs-and-exploits',
      title: 'Bugs & Exploit Reporting',
      summary: 'Discovery is not misconduct. Deliberate serious abuse can be.',
      body: [
        {
          id: 'exploit-principle',
          paragraphs: [
            'Finding or accidentally triggering a bug is not misconduct. If a bug appears to duplicate rewards, bypass ownership, grant unfair progression, corrupt shared state, or create another serious advantage, stop deliberately reproducing it for gain.',
            'Do not publish sensitive reproduction steps for a severe exploit in public channels. A private reporting path will be identified in tester instructions before external combat testing; until then, retain the minimum useful details rather than spreading an exploit recipe.',
          ],
        },
      ],
    },
    {
      id: 'accounts-security',
      title: 'Accounts & Security',
      summary: 'Keep credentials private and treat account recovery as a security boundary.',
      body: [
        {
          id: 'credentials',
          paragraphs: [
            'Keep your password and secret account credentials private. AUREVANE staff or support should never ask you to disclose your password or authentication secrets.',
            'The project has not yet published broad multiple-account or account-sharing policy. Do not infer a future policy from what the current UI happens to permit; material restrictions will be published before they are enforced as general player rules.',
          ],
        },
      ],
    },
    {
      id: 'identity-conduct',
      title: 'Identity, Conduct & Staff Impersonation',
      summary: 'Current conduct rules focus on the identity surfaces that actually exist.',
      body: [
        {
          id: 'staff-impersonation',
          paragraphs: [
            'Do not present yourself, your character identity, or an account-facing message as official AUREVANE staff, moderation, support, system messaging, or project administration when you are not authorized to do so.',
            'Character creation already reserves obvious staff/system names. Future social, profile, guild, and user-media conduct rules will be added when those player-facing systems exist rather than published speculatively now.',
          ],
        },
      ],
    },
    {
      id: 'current-scope',
      title: 'Current Rule Scope',
      summary: 'No hidden policy for systems that are not released.',
      body: [
        {
          id: 'not-yet-published',
          paragraphs: [
            'AUREVANE does not currently publish speculative marketplace, trading, ranked PvP, tournament, guild, nation, or mature social-platform rules because those systems are not released. When those capabilities become real, the Rules will expand before meaningful enforcement depends on them.',
            'Public Rules do not disclose anti-cheat thresholds, detection logic, privileged investigation methods, private staff identities, or security-sensitive exploit detail.',
          ],
        },
      ],
    },
  ] as readonly PublicRuleSection[],
}

export function findManualArticle(slug: string): ManualArticle | undefined {
  return manualArticles.find((article) => article.slug === slug)
}

export function findNewsArticle(slug: string): NewsArticle | undefined {
  return newsArticles.find((article) => article.slug === slug)
}
