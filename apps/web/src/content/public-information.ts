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

export const PUBLIC_CONTENT_REVISION = 'p2.7-pv1-2026-08-18'
export const PUBLIC_CONTENT_LAST_UPDATED = '2026-08-16'
export const MANUAL_CONTENT_LAST_UPDATED = '2026-08-18'

/**
 * Source-controlled public content is intentional at the current project scale. Stable IDs/slugs
 * and the typed read model are the migration boundary for the later versioned Public
 * Communications repository. Only published, spoiler-safe material belongs in this module.
 */
export const newsArticles: readonly NewsArticle[] = []

export const manualArticles: readonly ManualArticle[] = [
  {
    id: 'manual.start-here',
    slug: 'start-here',
    title: 'Start Here',
    summary: 'What AUREVANE is today, what you can do now, and what is still being built.',
    category: 'Orientation',
    lastUpdated: MANUAL_CONTENT_LAST_UPDATED,
    rulesVersion: 'PV-1 current build',
    body: [
      {
        id: 'what-is-aurevane',
        title: 'What is AUREVANE?',
        paragraphs: [
          'AUREVANE is an original persistent browser-based tactical fantasy RPG. Your account owns a durable character identity and authoritative progression state rather than a disposable browser save.',
          'The current player-facing build covers account entry, permanent character creation, the character profile, Character XP, Wayfarer’s Practice, and the Tactical Hall combat test slice. Tactical combat is now playable in focused training records and Recruit Sparring, while the wider world, deeper buildcraft, economy, social systems, co-op, and PvP remain in development.',
        ],
      },
      {
        id: 'current-foundation',
        title: 'What you can use now',
        paragraphs: [
          'The current build is intentionally focused. These are the player-facing foundations already present or currently testable:',
        ],
        bullets: [
          'Create or sign in to an account and safely return to the same private profile.',
          'Create one base-slot character with a validated identity, four core attributes, and a Foundation Discipline choice.',
          'Open the authoritative character profile and inspect server-calculated derived stats.',
          'Progress through the versioned Character XP and level foundation.',
          'Use Wayfarer’s Practice automatically or set a Short, Overnight, or Extended plan for your next meaningful absence.',
          'Enter the Tactical Hall for guided Movement, Strike, and Guard lessons or a full Recruit Sparring practice battle.',
          'Use server-validated movement, Basic Attack, Guard, facing, turn completion, battle logs, and reconnect-safe battle state.',
        ],
      },
      {
        id: 'current-test-boundary',
        title: 'A live test slice is not the finished game',
        paragraphs: [
          'The Tactical Hall is a real player-facing combat slice, but it is still being validated. Its purpose is to prove that moving, acting, facing, reading the battlefield, ending a turn, reconnecting, and fighting a legal AI opponent feel understandable and reliable before deeper combat layers are added.',
          'Practice battles do not currently stand in for the future reward game. Tactical Hall exercises are deliberately safe and do not grant repeatable Character XP, loot, currency, PvP rating, or world progression.',
        ],
      },
      {
        id: 'planned-identity',
        title: 'The larger game',
        paragraphs: [
          'The approved direction grows AUREVANE into deeper Primary and Secondary Discipline buildcraft, Mastery, Skills, Essence and Resonance identities, equipment and loadouts, supernatural character development, exploration, live world activity, co-op Expeditions, social spaces, PvP and the Colosseum, player economy, and long-term world ownership systems.',
          'Those systems are roadmap direction, not a claim that they are playable today. The Manual marks planned material explicitly and expands current-rule coverage only when a system reaches a real player-facing state.',
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
    lastUpdated: MANUAL_CONTENT_LAST_UPDATED,
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
    lastUpdated: MANUAL_CONTENT_LAST_UPDATED,
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
          'Your Foundation Discipline is an onboarding identity choice at this stage. It does not mean that the later Primary/Secondary Discipline system, Mastery ladder, full Skill loadouts, Essence, Resonance, Soulmarks, or permanent supernatural paths are already implemented.',
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
    lastUpdated: MANUAL_CONTENT_LAST_UPDATED,
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
        paragraphs: ['The current ruleset defines these derived values:'],
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
          'The current coefficients are development balance for a deterministic stat framework, not a promise that launch tuning is final. The Tactical Hall slice has begun giving these combat foundations real battlefield context, while later equipment and Discipline systems will deepen the same framework.',
          'Rules stay centralized and versioned so combat, equipment, and future build modifiers can extend one calculation contract instead of quietly duplicating formulas in the interface.',
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
    lastUpdated: MANUAL_CONTENT_LAST_UPDATED,
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
          'Character Level and future Discipline Mastery are separate concepts. The current public build implements Character XP and level; Discipline Mastery belongs to later buildcraft work and is not yet a player-facing progression track.',
          'The current development curve is configurable. It should not be read as a final promise about launch pacing or calendar time to Level 100.',
        ],
      },
      {
        id: 'combat-practice-rewards',
        title: 'Tactical Hall does not farm Character XP',
        paragraphs: [
          'Current Tactical Hall lessons and Recruit Sparring are practice content. They validate combat play without becoming a repeatable progression faucet, so completing or aborting an exercise does not award repeatable Character XP, loot, currency, rating, or world progression.',
        ],
      },
    ],
  },
  {
    id: 'manual.wayfarers-practice',
    slug: 'wayfarers-practice',
    title: 'Wayfarer’s Practice',
    summary:
      'Balanced Practice, optional absence plans, Training Reports, Rested Momentum, and offline limits.',
    category: 'Progression',
    lastUpdated: MANUAL_CONTENT_LAST_UPDATED,
    rulesVersion: 'P1.6 current Practice flow',
    body: [
      {
        id: 'balanced-practice',
        title: 'Balanced Practice is the safe default',
        paragraphs: [
          'Wayfarer’s Practice is AUREVANE’s absence-protection foundation. The server calculates eligible elapsed time lazily from server-controlled timestamps; your device clock and timezone do not determine rewards.',
          'Once an absence passes the current meaningful-absence threshold, the server may generate a Training Report containing bounded Character XP and Rested Momentum. The exact report is authoritative and can be claimed once.',
        ],
      },
      {
        id: 'planned-windows',
        title: 'You can plan the next absence',
        paragraphs: [
          'Balanced Practice still works automatically, but you can now set one of three plans for your next meaningful absence: Short (about 3 hours), Overnight (about 8 hours), or Extended (about 24 hours). The choice is a planning convenience, not a way to manufacture time or bypass the server.',
          'A plan applies once. Returning early credits only the time you were actually away. Staying away beyond the chosen window lets remaining eligible time continue automatically as Balanced Practice, and the explicit plan is consumed when that Training Report is generated.',
        ],
      },
      {
        id: 'guardrails',
        title: 'What offline practice cannot do',
        paragraphs: [
          'Wayfarer’s Practice is deliberately not an idle-game substitute for playing AUREVANE. A Training Report cannot complete or fabricate major game outcomes.',
        ],
        bullets: [
          'It cannot complete story, quests, bosses, Expeditions, live events, or PvP participation.',
          'It cannot grant PvP rank, Resonance, Essence, Soulmarks, Archive discoveries, rare equipment, economy output, or later supernatural progression.',
          'It cannot use client-clock changes or repeated claim submissions to farm the same absence window.',
          'Discipline Focus and offline Mastery are not part of the current implementation.',
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
    id: 'manual.tactical-hall',
    slug: 'tactical-hall',
    title: 'Tactical Hall & Practice Battles',
    summary: 'Where to learn the current combat slice, what the records teach, and what practice awards.',
    category: 'Combat',
    lastUpdated: MANUAL_CONTENT_LAST_UPDATED,
    rulesVersion: 'P2.7 / PV-1',
    body: [
      {
        id: 'what-is-tactical-hall',
        title: 'What the Tactical Hall is',
        paragraphs: [
          'The Tactical Hall is the current player-facing combat training space. It exists to teach the real server-authoritative battle loop in a controlled environment before AUREVANE layers on broader PvE, co-op, PvP, equipment, Skills, and world consequences.',
          'You can choose a short guided lesson or Recruit Sparring for the fuller tactical loop. The current Hall is testable game content, not a mock-up, but it remains part of active PV-1 usability validation.',
        ],
      },
      {
        id: 'records',
        title: 'Current Tactical Records',
        paragraphs: ['The Hall currently exposes four practice choices:'],
        bullets: [
          'Movement — learn legal positioning and how movement budget works without spending your Action.',
          'Strike — learn target selection and Basic Attack.',
          'Guard — learn the defensive action and its turn cost.',
          'Recruit Sparring — fight a legal AI opponent through the fuller move, act, face, and end-turn loop.',
        ],
      },
      {
        id: 'arenas',
        title: 'Current battlefield sizes',
        paragraphs: [
          'Focused lessons use a compact 5×3 Basic Training Floor. Recruit Sparring uses the 9×7 Duel Yard, which gives movement, rough terrain, elevation, approach angles, flanking space, and facing enough room to matter.',
          'AUREVANE’s wider battlefield system is designed to scale with encounter purpose and participant count. The current 9×7 yard is a duel baseline, not a promise that every future battle will use the same number of tiles.',
        ],
      },
      {
        id: 'practice-rules',
        title: 'Practice rules',
        paragraphs: [
          'Battle state and legal actions are validated by the server. The client requests an action; it does not declare that movement, damage, rewards, or battle outcomes happened.',
          'Current Tactical Hall exercises do not provide repeatable progression rewards. If you want to stop a Hall exercise, use Abort Exercise. That is a neutral training exit rather than a normal-world Retreat or PvP Surrender system.',
        ],
      },
    ],
  },
  {
    id: 'manual.tactical-combat-basics',
    slug: 'tactical-combat-basics',
    title: 'Tactical Combat Basics',
    summary: 'How a current turn works: inspect, move, act, face, end, and reconnect safely.',
    category: 'Combat',
    lastUpdated: MANUAL_CONTENT_LAST_UPDATED,
    rulesVersion: 'P2.7 / PV-1',
    body: [
      {
        id: 'turn-model',
        title: 'The current turn model',
        paragraphs: [
          'A useful current mental model is: inspect the field, position, act, reposition if movement remains, confirm your final facing, then end the turn. You do not need to perform every step on every turn, but that sequence explains how the pieces fit together.',
          'Movement and the current Action are separate resources. Moving does not automatically spend your Action. Basic Attack and Guard do spend the current Action, while remaining legal movement can still matter before the turn is committed.',
        ],
      },
      {
        id: 'current-actions',
        title: 'Commands available in the current slice',
        paragraphs: [
          'The Tactical Hall deliberately exposes a small command surface while usability is being proven. The current primary commands are Inspect, Move, Basic Attack, Guard, and End Turn.',
        ],
        bullets: [
          'Inspect previews battlefield information without committing a combat action.',
          'Move selects a legal destination and spends movement budget rather than the current Action.',
          'Basic Attack selects a legal hostile target and spends the current Action when committed.',
          'Guard spends the current Action to take the current defensive posture.',
          'End Turn commits your final facing and passes control when the server accepts the turn.',
        ],
      },
      {
        id: 'facing',
        title: 'Facing is part of the decision',
        paragraphs: [
          'Your final direction matters to the tactical model. The current interface uses a provisional final-facing flow so choosing a direction does not become a separate mandatory action chore.',
          'Changing the facing preview does not by itself commit the turn. End Turn is the explicit commit point, so you can check or adjust facing before you finish.',
        ],
      },
      {
        id: 'legality-and-preview',
        title: 'The interface previews; the server decides',
        paragraphs: [
          'The interface can highlight legal destinations, targets, costs, and forecasts to help you understand a choice. Those previews are guidance, not authority. The server validates the actual intent against the current battle snapshot before state changes.',
          'This separation is why stale, invalid, duplicated, or tampered requests can be rejected instead of silently becoming real battle outcomes.',
        ],
      },
      {
        id: 'reconnect',
        title: 'Battle state survives the page',
        paragraphs: [
          'Current battle sessions are persisted authoritative state. Refreshing or reconnecting should restore the battle rather than creating a new browser-local fight, and the battle log provides a readable record of accepted events.',
        ],
      },
    ],
  },
  {
    id: 'manual.combat-controls',
    slug: 'combat-controls',
    title: 'Combat Controls',
    summary: 'Current keyboard shortcuts, targeting helpers, facing keys, and remapping.',
    category: 'Combat',
    lastUpdated: MANUAL_CONTENT_LAST_UPDATED,
    rulesVersion: 'P2.7 controls v1',
    body: [
      {
        id: 'pointer-first',
        title: 'Pointer and touch remain valid',
        paragraphs: [
          'Combat is not intended to require memorizing keyboard shortcuts. The battlefield and command controls can be used directly, while keyboard bindings provide faster access for players who want them.',
          'Combat bindings are stored as player settings and can be remapped. Duplicate key combinations are rejected so one shortcut cannot silently trigger two different combat commands.',
        ],
      },
      {
        id: 'default-keys',
        title: 'Default keyboard bindings',
        paragraphs: ['The current defaults are:'],
        bullets: [
          '1 — Inspect',
          '2 — Move',
          '3 — Basic Attack',
          '4 — Guard',
          'Space — End Turn',
          'Enter — Confirm',
          'Esc — Cancel',
          'W / A / S / D — Face North / West / South / East',
          'Tab / Shift+Tab — Next / Previous target',
          'L — Combat Log',
        ],
      },
      {
        id: 'facing-keys',
        title: 'WASD changes final-facing intent',
        paragraphs: [
          'In the current turn flow, W/A/S/D is used for facing selection rather than freeform real-time movement. Pressing a facing key changes the provisional direction; it does not commit the turn by itself.',
        ],
      },
    ],
  },
  {
    id: 'manual.road-ahead',
    slug: 'road-ahead',
    title: 'Road Ahead — Approved Direction',
    summary: 'A spoiler-light map of approved future systems, clearly separated from current rules.',
    category: 'Planned',
    lastUpdated: MANUAL_CONTENT_LAST_UPDATED,
    rulesVersion: 'Roadmap context — not live rules',
    body: [
      {
        id: 'planned-not-live',
        title: 'This article is planning context',
        paragraphs: [
          'Everything in this article is planned direction unless another Manual article says it is currently playable. It is here so players can understand what AUREVANE is growing toward without forcing roadmap concepts into the current ruleset.',
          'Names, balance values, sequencing, and implementation details can still change before these systems become player-facing. When they do become real, their dedicated Manual articles replace planning summaries as the authoritative guide.',
        ],
      },
      {
        id: 'buildcraft-direction',
        title: 'Deeper character buildcraft',
        paragraphs: [
          'The approved build direction expands beyond the current Foundation Discipline identity into Primary and optional Secondary Disciplines, separate Discipline Mastery, curated Skill choices, and equipment-driven build decisions.',
        ],
        bullets: [
          'Pure Discipline identity is intended to support an Essence expression.',
          'Mixed Discipline identity is intended to support Resonance; Resonance is the current term replacing the retired Confluence terminology.',
          'Equipment Skills, loadouts, equipment load, and stat-driven build physics are planned to create meaningful tradeoffs instead of a single best gear score.',
        ],
      },
      {
        id: 'supernatural-direction',
        title: 'Supernatural character identity',
        paragraphs: [
          'AUREVANE’s approved supernatural direction separates temporary or reversible Soulmark-style identity from rarer permanent Severance paths and Mantles. These systems are not part of the current playable progression loop.',
        ],
      },
      {
        id: 'world-direction',
        title: 'A reactive persistent world',
        paragraphs: [
          'The world roadmap grows from the current character and combat foundations into exploration, quests, live world activity, discoveries, the Archive, settlements and social spaces, player economy, homesteads, and longer-term consequences that persist beyond one battle.',
          'The intent is a world that reacts to player activity and ongoing events rather than a static list of disconnected menus.',
        ],
      },
      {
        id: 'multiplayer-direction',
        title: 'Co-op, social play, and PvP',
        paragraphs: [
          'Planned multiplayer layers include parties, co-op Expeditions, richer social presence, Tavern-style gathering spaces, consent-based PvP, and a Colosseum/spectation layer for battles intended to be watched or shared.',
          'Those systems will receive their own privacy, matchmaking, reward, conduct, and spectation rules before they become meaningful live features.',
        ],
      },
    ],
  },
  {
    id: 'manual.faq',
    slug: 'faq',
    title: 'FAQ & Troubleshooting',
    summary: 'Straight answers for common questions in the current player-facing build.',
    category: 'Help',
    lastUpdated: MANUAL_CONTENT_LAST_UPDATED,
    rulesVersion: 'PV-1 current build',
    body: [
      {
        id: 'can-i-play-combat',
        title: 'Can I play tactical combat yet?',
        paragraphs: [
          'Yes. The current build includes the Tactical Hall combat test slice: three focused lessons plus Recruit Sparring on the full Duel Yard. It is an active PV-1 validation slice rather than the finished combat game, so deeper Skills, equipment interactions, broader AI grades, PvE encounters, co-op, and PvP are still ahead.',
        ],
      },
      {
        id: 'practice-rewards',
        title: 'Does Tactical Hall practice give XP or loot?',
        paragraphs: [
          'No repeatable progression rewards are currently attached to Tactical Hall exercises. The Hall is for learning and validating combat. Abort Exercise is also neutral training cleanup, not a reward-bearing victory or normal-world Retreat.',
        ],
      },
      {
        id: 'refresh-battle',
        title: 'Will refreshing lose my battle?',
        paragraphs: [
          'Current battle sessions are persisted on the server. A refresh or reconnect should restore the authoritative session instead of replacing it with a browser-local copy. If the session cannot be safely loaded, the client should fail closed rather than inventing state.',
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
        title: 'Where are Resonance, PvP, trading, guilds, and Expeditions?',
        paragraphs: [
          'They are later roadmap systems. Their existence in the approved game direction does not make them current playable features. See Road Ahead for spoiler-light context; dedicated Manual and Rules coverage will arrive with the implementations that make those systems real.',
        ],
      },
    ],
  },
  {
    id: 'manual.glossary',
    slug: 'glossary',
    title: 'Glossary',
    summary: 'Current player-facing terms plus clearly marked planning vocabulary used by this guide.',
    category: 'Reference',
    lastUpdated: MANUAL_CONTENT_LAST_UPDATED,
    rulesVersion: 'PV-1 current build',
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
          'The initial Discipline identity selected during current character creation. It is onboarding identity metadata, not yet the complete Primary/Secondary Discipline and Mastery system.',
        ],
      },
      {
        id: 'tactical-hall-term',
        title: 'Tactical Hall',
        paragraphs: [
          'The current player-facing combat training space containing guided records and Recruit Sparring.',
        ],
      },
      {
        id: 'tactical-record-term',
        title: 'Tactical Record',
        paragraphs: [
          'A focused Tactical Hall practice scenario. Current records teach Movement, Strike, Guard, or the fuller Recruit Sparring loop.',
        ],
      },
      {
        id: 'action-term',
        title: 'Action',
        paragraphs: [
          'The current turn resource spent by commands such as Basic Attack or Guard. Movement uses its own budget in the present combat slice.',
        ],
      },
      {
        id: 'final-facing-term',
        title: 'Final Facing',
        paragraphs: [
          'The direction your combatant will face when the current turn is committed. The interface lets you preview or adjust it before End Turn.',
        ],
      },
      {
        id: 'abort-exercise-term',
        title: 'Abort Exercise',
        paragraphs: [
          'The neutral exit for current Tactical Hall practice. It is not the future normal-world Retreat or PvP Surrender/Forfeit system.',
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
        id: 'resonance-term',
        title: 'Resonance — planned',
        paragraphs: [
          'The approved term for a future mixed-Discipline expression. It replaces the retired Confluence terminology and is not currently a live buildcraft mechanic.',
        ],
      },
      {
        id: 'essence-term',
        title: 'Essence — planned',
        paragraphs: [
          'The approved term for a future pure-Discipline expression. It is planning vocabulary, not a current character-creation reward.',
        ],
      },
      {
        id: 'server-authoritative-term',
        title: 'Server-authoritative',
        paragraphs: [
          'The server validates and owns valuable game outcomes such as character creation, progression, combat state, and rewards; client intent alone is not trusted as the outcome.',
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
