import {
  manualArticles as foundationManualArticles,
  type ManualArticle,
} from './public-information'

const LAST_UPDATED = '2026-08-26'

const overrides: Record<string, ManualArticle> = {
  'start-here': {
    id: 'manual.start-here',
    slug: 'start-here',
    title: 'Start Here',
    summary:
      'What AUREVANE is today, what is complete, what you can test now, and how the current game shell is organized.',
    category: 'Orientation',
    lastUpdated: LAST_UPDATED,
    rulesVersion: 'Phase 1 complete · PV-1 (Phase 2 test)',
    body: [
      {
        id: 'what-is-aurevane',
        title: 'What is AUREVANE?',
        paragraphs: [
          'AUREVANE is an original persistent browser-based tactical fantasy RPG. Your account owns durable character identities, settings, progression, and server-authoritative game state rather than a disposable browser save.',
          'Phase 1 — Character & Progression Foundation is complete. Phase 2 — Tactical Combat & Battle Platform is implementation-mature and is currently being tested through PV-1 (Phase 2 test), including AI battles, direct private PvP, and keyed spectation.',
        ],
      },
      {
        id: 'current-build',
        title: 'What you can use now',
        paragraphs: ['The current player-facing build includes:'],
        bullets: [
          'Create or sign in to an account and safely return to the same private profile.',
          'Create characters in three roster slots with six core attributes and a starting Discipline.',
          'Open a compact character profile with server-calculated derived stats and profile identity badges.',
          'Set the current character’s one personal title from Account → Titles & Profile Display.',
          'Progress through the versioned Character XP and level foundation.',
          'Explicitly start Short, Medium, or Extended Passive Training and receive a bounded server-timed Character XP reward when that block completes.',
          'Enter Battle Hall for Guided Fundamentals or AI Sparring using the current 100-AP tactical combat rules.',
          'Create or join direct private PvP lobbies across the currently exposed formats and settings.',
          'Watch a shared PvP battle through its Battle Key using the read-only spectator flow.',
        ],
      },
      {
        id: 'navigation',
        title: 'Finding things',
        paragraphs: [
          'Manual, News, and Rules live in the authenticated header. Account contains audio, Controls & Keybinds, Titles & Profile Display, Switch Character, and sign-out. The compact footer Navigation menu contains the destinations other than the page you are currently viewing, including Profile, Battle Hall, Passive Training, and Online Users where applicable.',
          'Normal game screens show a small circular portrait beside the green screen-name indicator in the shared header. The AUREVANE A-in-diamond remains the brand crest. Active battle uses its own combat HUD instead of the shared screen header.',
        ],
      },
      {
        id: 'larger-game',
        title: 'The larger game',
        paragraphs: [
          'AUREVANE is still being built toward deeper Discipline buildcraft with a Primary Discipline, an optional mastered Secondary Discipline, mixed-build Resonances, pure-Discipline Essence, broader PvE, exploration, co-op, Expeditions, trading, social systems, and a persistent world. Ranked matchmaking, seasons, tournaments, and the mature Colosseum layer also remain future PvP scope.',
          'The Manual describes released or actively testable behavior first and expands as systems become real. Phase 3 is not active while Phase 2 testing continues.',
        ],
      },
    ],
  },
  'character-creation': {
    id: 'manual.character-creation',
    slug: 'character-creation',
    title: 'Character Creation',
    summary:
      'Identity, six starting attributes, Disciplines, three character slots, and entering the game.',
    category: 'Character',
    lastUpdated: LAST_UPDATED,
    rulesVersion: 'Character creation v1 · Phase 1 complete',
    body: [
      {
        id: 'identity',
        title: 'Identity choices',
        paragraphs: [
          'Character creation records a validated public name, presentation, pronoun preset, official portrait reference, starter appearance reference, starting Discipline, and six core attributes. Presentation and cosmetic choices do not hide combat bonuses.',
          'Names are normalized and validated on the server. The current rules accept 3–24 characters after normalization, reject reserved system identities, and enforce authoritative uniqueness when the character is persisted.',
        ],
      },
      {
        id: 'six-attributes',
        title: 'Six starting attributes',
        paragraphs: [
          'Might, Finesse, Vitality, Agility, Intellect, and Resolve each begin at 5. Creation gives exactly 6 additional whole-number points to distribute. The current authoritative rules allow from 0 to 6 bonus points in any one attribute, provided the total assigned bonus is exactly 6.',
          'Vitality owns the main endurance role while Agility owns the main movement/reflex role. This gives buildcraft more room than the retired four-attribute model without simply inflating baseline derived stats.',
          'The server rebuilds and validates the starting state. The browser does not get to submit its own level, XP total, timestamps, or final attribute totals.',
        ],
      },
      {
        id: 'discipline',
        title: 'What is a Discipline?',
        paragraphs: [
          'A Discipline is a learnable combat tradition that establishes your first tactical direction. It is not a permanent class lock. Later mastery systems are intended to let characters deepen, broaden, and combine what they know.',
          'The starting choices are Vanguard, Farstrider, Shadehand, Ironfist, Aetherist, and Lifebinder. Full Mastery, Discipline Skills, optional mastered Secondary Disciplines, Resonances, pure-Discipline Essence, and supernatural paths are later progression systems rather than hidden creation grants.',
        ],
      },
      {
        id: 'slots-and-entry',
        title: 'Slots, creation, and switching',
        paragraphs: [
          'Accounts have three character slots. Successful creation makes the new character active and takes you directly into the game instead of bouncing back to Character Select.',
          'Character Select is available when entering an authenticated session and through Account → Switch Character. If you swap away from a character, that character has a server-authoritative one-hour return cooldown before you can select it again.',
        ],
      },
    ],
  },
  'attributes-derived-stats': {
    id: 'manual.attributes-derived-stats',
    slug: 'attributes-derived-stats',
    title: 'Attributes & Derived Stats',
    summary: 'How six core attributes feed the current versioned stat framework.',
    category: 'Character',
    lastUpdated: LAST_UPDATED,
    rulesVersion: 'Derived stat rules v1 · Phase 1 complete',
    body: [
      {
        id: 'six-attributes',
        title: 'The six attributes',
        paragraphs: [
          'Might is physical force; Finesse is precision and technique; Vitality is endurance; Agility is mobility and reflex; Intellect is mystic understanding; Resolve is willpower and supernatural steadiness.',
          'Each attribute can contribute to several derived values. The profile reads authoritative character state and calculates derived values from one versioned ruleset, so browser-only edits cannot change them on the server.',
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
        id: 'relationships',
        title: 'How the six-attribute split works',
        paragraphs: [
          'Vitality carries the main maximum-HP and physical-toughness role that previously overloaded Resolve. Agility carries the main movement, evasion, and reflex role that previously competed inside Finesse.',
          'The balanced benchmark was intentionally preserved when the six-attribute model was introduced. The expansion creates more build directions rather than granting a free baseline power spike.',
        ],
      },
      {
        id: 'tuning',
        title: 'Versioned, not frozen balance',
        paragraphs: [
          'Current coefficients are development balance for the deterministic profile and battle framework, not a promise that launch tuning is final. Rules stay centralized and versioned so equipment, Disciplines, statuses, and later progression can extend the same calculation contract.',
        ],
      },
    ],
  },
  'wayfarers-practice': {
    id: 'manual.wayfarers-practice',
    slug: 'wayfarers-practice',
    title: 'Passive Training',
    summary:
      'Explicitly start a server-timed background training block for modest Character XP while you are busy or AFK.',
    category: 'Progression',
    lastUpdated: LAST_UPDATED,
    rulesVersion: 'Passive Training v1 · Phase 1 complete',
    body: [
      {
        id: 'simple-flow',
        title: 'Choose a duration, then train',
        paragraphs: [
          'Passive Training never starts automatically. Choose Short, Medium, or Extended and the server records the authoritative start time, duration, and completion reward. Staying signed in, going AFK, closing the browser, or returning early does not change that timer.',
          'The current completion rewards are Character XP only. Short runs for 3 hours at 10 XP per hour, Medium for 8 hours at 7 XP per hour, and Extended for 24 hours at 4 XP per hour. Longer blocks give more total XP but deliberately lower hourly efficiency.',
        ],
      },
      {
        id: 'while-training',
        title: 'What stays available while training',
        paragraphs: [
          'Passive Training is intended for background use, not forced logout. Profile, account, Manual, News, Rules, Online Users, and social/chat surfaces may remain available while a block is active.',
          'Starting a new Battle Hall fight is disabled until the training block completes or you stop it. Stopping early clears the unfinished block and grants no partial reward.',
        ],
      },
      {
        id: 'completion',
        title: 'Completion and Training Reports',
        paragraphs: [
          'When the server-timed block reaches its completion boundary, AUREVANE freezes one Training Report. Claiming that report is idempotent and applies the server-calculated Character XP once.',
          'Simply being offline or idle does not generate a report. Browser clocks, tab state, and client-submitted elapsed time are not reward authority.',
        ],
      },
      {
        id: 'guardrails',
        title: 'What Passive Training cannot do',
        paragraphs: [
          'Passive Training is deliberately modest background progression, not an idle-game replacement.',
        ],
        bullets: [
          'It cannot complete story, quests, bosses, Expeditions, or event participation.',
          'It cannot grant PvP rank, Resonance or Essence accomplishments, Soulmarks or Mantles, Archive discoveries, rare equipment, economy output, or Rekindling eligibility.',
          'It cannot use client-clock changes, logout tricks, or repeated claim submissions to manufacture extra rewards.',
        ],
      },
    ],
  },
  faq: {
    id: 'manual.faq',
    slug: 'faq',
    title: 'FAQ & Troubleshooting',
    summary: 'Straight answers for common questions in the current build.',
    category: 'Help',
    lastUpdated: LAST_UPDATED,
    rulesVersion: 'Phase 1 complete · PV-1 (Phase 2 test)',
    body: [
      {
        id: 'combat',
        title: 'Can I play tactical combat?',
        paragraphs: [
          'Yes. Battle Hall currently exposes Guided Fundamentals and AI Sparring, while the same Phase 2 battle platform also supports direct private PvP and keyed spectation. These systems are being tested through PV-1 (Phase 2 test) rather than treated as proof that Phase 2 is finished.',
        ],
      },
      {
        id: 'pvp',
        title: 'Is PvP available?',
        paragraphs: [
          'Yes for the current direct private-lobby formats. You can create or join a lobby, fight the shared authoritative battle, and share a Battle Key for spectation. Ranked matchmaking, ratings, seasons, tournaments, and mature Colosseum discovery are later competitive scope.',
        ],
      },
      {
        id: 'creation-errors',
        title: 'Character creation says something is invalid',
        paragraphs: [
          'Creation validates the same character choices before submission and identifies the relevant field. All six starting bonus points must be assigned before confirmation.',
        ],
      },
      {
        id: 'switch-cooldown',
        title: 'Why is a character temporarily locked after switching?',
        paragraphs: [
          'Swapping away from a character starts a one-hour return cooldown on that swapped-away character. The roster shows the remaining time, and the server enforces the rule rather than trusting a browser timer.',
        ],
      },
      {
        id: 'public-pages',
        title: 'Do I need an account to read News, Manual, or Rules?',
        paragraphs: [
          'No. News, Manual, and Rules are public information surfaces. Their navigation is kept in the header rather than duplicated in a second footer.',
        ],
      },
    ],
  },
  glossary: {
    id: 'manual.glossary',
    slug: 'glossary',
    title: 'Glossary',
    summary: 'Current player-facing terms without unreleased-system spoilers.',
    category: 'Reference',
    lastUpdated: LAST_UPDATED,
    rulesVersion: 'Phase 1 complete · PV-1 (Phase 2 test)',
    body: [
      {
        id: 'discipline-term',
        title: 'Discipline',
        paragraphs: [
          'A learnable combat tradition. Character creation chooses a starting Discipline; it is a direction for early buildcraft, not a permanent class lock.',
        ],
      },
      {
        id: 'battle-hall-term',
        title: 'Battle Hall',
        paragraphs: [
          'The current battle destination for Guided Fundamentals, AI Sparring, direct private PvP, and keyed spectation.',
        ],
      },
      {
        id: 'pv1-term',
        title: 'PV-1 (Phase 2 test)',
        paragraphs: [
          'The human/product validation gate used while testing the Phase 2 Tactical Combat & Battle Platform. Passing automated checks or deploying a build does not by itself close Phase 2.',
        ],
      },
      {
        id: 'action-economy-term',
        title: 'Action Economy / AP',
        paragraphs: [
          'The current turn budget. A normal turn starts at 100 AP. Normal movement costs 25 AP per traversal point, Basic Attack and Guard cost 30 AP, Recover costs 50 AP, and terrain can increase movement cost.',
        ],
      },
      {
        id: 'personal-title-term',
        title: 'Personal Title',
        paragraphs: [
          'A cosmetic per-character identity title. It grants no stats, competencies, powers, or account privileges. The current personal-title opportunity is a definitive one-time choice.',
        ],
      },
      {
        id: 'rested-momentum-term',
        title: 'Rested Momentum',
        paragraphs: [
          'A future bounded return-support concept. The current Passive Training foundation grants Character XP only; Rested Momentum is not part of the current player reward path.',
        ],
      },
      {
        id: 'server-authoritative-term',
        title: 'Server-authoritative',
        paragraphs: [
          'The server validates and owns valuable outcomes such as character creation, character switching, progression, title claims, and combat results; client intent alone is not trusted as the outcome.',
        ],
      },
    ],
  },
}

const battleHallArticle: ManualArticle = {
  id: 'manual.battle-hall',
  slug: 'battle-hall',
  title: 'Battle Hall & Tactical Combat',
  summary:
    'How the current AI practice battles, AP spending, previews, facing, and Combat Log work.',
  category: 'Combat',
  lastUpdated: LAST_UPDATED,
  rulesVersion: 'PV-1 (Phase 2 test) · 100-AP combat',
  body: [
    {
      id: 'entering',
      title: 'Entering Battle Hall',
      paragraphs: [
        'Battle Hall starts neutral with no fight preselected. AI Battles contains Guided Fundamentals and AI Sparring. Player vs Player contains the current direct private-lobby formats, and Spectate opens a shared battle through its Battle Key.',
        'These are real server-authoritative Phase 2 systems currently under PV-1 (Phase 2 test), not mock-ups. Continued Owner testing may still produce contained usability, presentation, timing, or stability corrections before Phase 2 is closed.',
      ],
    },
    {
      id: 'ap',
      title: 'Action Economy',
      paragraphs: [
        'A normal turn starts with 100 AP. A normal movement traversal point costs 25 AP. Rough ground currently has traversal cost 2, so entering it costs 50 AP. Basic Attack and Guard cost 30 AP; Recover costs 50 AP.',
        'Selecting a legal action previews the spend before commitment. The server revalidates the actual intent against the current battle state and owns the committed AP total.',
      ],
    },
    {
      id: 'planning',
      title: 'Choose first — nothing is forced',
      paragraphs: [
        'The battle does not begin in Move mode. You can Inspect, Move, Basic Attack, Guard, Recover, or finish the turn as the situation allows. Confirm Action commits a legal proposal; Cancel Action clears a proposal without committing it.',
        'Guided Fundamentals is training-specific. AI Sparring and PvP use their applicable surrender/exit flows rather than inventing a reward-bearing training victory.',
      ],
    },
    {
      id: 'facing',
      title: 'Final facing ends the turn',
      paragraphs: [
        'Choosing final north, east, south, or west facing is the final 0-AP command. A legal direction commits that facing, performs authoritative end-turn processing, and advances to the next actor. There is no second mandatory End Turn confirmation after a valid final-facing choice.',
      ],
    },
    {
      id: 'reading-battle',
      title: 'Reading the battlefield',
      paragraphs: [
        'Combatant rails and Inspect expose high-value state such as HP, Initiative, Movement, Jump, Armor, Evasion, facing, and statuses without forcing every number onto every tile.',
        'The Combat Log groups accepted battle events into readable action history. Battle chat is available where the current battle mode exposes it, while all valuable battle state remains server-authoritative.',
      ],
    },
  ],
}

const pvpArticle: ManualArticle = {
  id: 'manual.pvp-spectation',
  slug: 'pvp-spectation',
  title: 'PvP & Spectation',
  summary:
    'How current direct private PvP lobbies, shared battles, turn timers, Battle Keys, and spectators work.',
  category: 'Combat',
  lastUpdated: LAST_UPDATED,
  rulesVersion: 'PV-1 (Phase 2 test) · direct PvP',
  body: [
    {
      id: 'direct-pvp',
      title: 'Direct private PvP is playable now',
      paragraphs: [
        'Battle Hall currently supports direct private PvP lobbies. The exposed formats include 1v1, 2v2, 3v3, Three-Way (1v1v1), and Flexible Teams with one to three combatants on each side.',
        'The lobby creator can choose the currently exposed map-size, elevation-bias, terrain-bias, and turn-timer settings. Once the battle starts, participants share one authoritative persisted battle state rather than separate browser-owned copies.',
      ],
    },
    {
      id: 'turns-and-exits',
      title: 'Turns, reconnects, and surrender',
      paragraphs: [
        'PvP uses server-owned turn authority and timer state. Reconnect and refresh restore the shared battle rather than granting a fresh turn or local copy. Surrender is an explicit participant action and is separate from training-specific completion rules.',
      ],
    },
    {
      id: 'spectation',
      title: 'Watching by Battle Key',
      paragraphs: [
        'A participant can share the battle’s Battle Key. Spectators join through Battle Hall → Spectate and receive a committed read-only battle projection with the spectator presentation, logs, presence, chat, and Inspect capabilities currently exposed by the mode.',
        'Spectation does not grant permission to mutate the battle. Stopping spectation removes the active spectator membership so a later Battle Hall refresh does not silently rejoin the session.',
      ],
    },
    {
      id: 'competitive-boundary',
      title: 'What is not the mature competitive game yet',
      paragraphs: [
        'Direct PvP and spectation are current Phase 2 test features. Ranked matchmaking, rating ladders, seasons, tournaments, Arena Tempering, and mature Colosseum discovery remain later competitive-product scope.',
        'PV-1 (Phase 2 test) is validating the tactical battle platform itself. It is not permission to start Phase 3, and it is not a claim that every later competitive system already exists.',
      ],
    },
  ],
}

export const currentManualArticles: readonly ManualArticle[] = [
  ...foundationManualArticles.map((article) => overrides[article.slug] ?? article),
  battleHallArticle,
  pvpArticle,
]

export function findCurrentManualArticle(slug: string): ManualArticle | null {
  return currentManualArticles.find((article) => article.slug === slug) ?? null
}
