import {
  manualArticles as foundationManualArticles,
  type ManualArticle,
} from './public-information'

const LAST_UPDATED = '2026-08-18'

const overrides: Record<string, ManualArticle> = {
  'start-here': {
    id: 'manual.start-here',
    slug: 'start-here',
    title: 'Start Here',
    summary:
      'What AUREVANE is today, what you can test now, and how the current game shell is organized.',
    category: 'Orientation',
    lastUpdated: LAST_UPDATED,
    rulesVersion: 'Current preview',
    body: [
      {
        id: 'what-is-aurevane',
        title: 'What is AUREVANE?',
        paragraphs: [
          'AUREVANE is an original persistent browser-based tactical fantasy RPG. Your account owns durable character identities, settings, progression, and server-authoritative game state rather than a disposable browser save.',
          'The current preview includes account entry, a three-slot character roster, character creation and profile systems, Character XP, Passive Training, Online Users, and the first playable Battle Hall tactical combat slice.',
        ],
      },
      {
        id: 'current-preview',
        title: 'What you can use now',
        paragraphs: ['The current player-facing preview includes:'],
        bullets: [
          'Create or sign in to an account and safely return to the same private profile.',
          'Create characters in three roster slots with six core attributes and a starting Discipline.',
          'Open a compact character profile with server-calculated derived stats and profile identity badges.',
          'Set the current character’s one personal title from Account → Titles & Profile Display.',
          'Progress through the versioned Character XP and level foundation.',
          'Explicitly start Short, Medium, or Extended Passive Training and receive a bounded server-timed Character XP reward when that block completes.',
          'Enter Battle Hall for movement, Basic Attack, Guard, Recover, final facing, Recruit AI, combat logs, and practice battles.',
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
          'AUREVANE is still being built toward deeper Discipline buildcraft, Current + Legacy choices, Confluences, exploration, co-op, Expeditions, PvP, trading, social systems, and a persistent world. Roadmap direction is not the same thing as a currently playable feature.',
          'The Manual describes released or testable behavior first and expands as systems become real.',
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
    rulesVersion: 'Character creation v1 · six-attribute preview',
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
          'Might, Finesse, Vitality, Agility, Intellect, and Resolve each begin at 5. Creation gives exactly 6 additional whole-number points to distribute, with no more than 4 bonus points placed into one attribute.',
          'Vitality owns the main endurance role while Agility owns the main movement/reflex role. This gives buildcraft more room than the older four-attribute preview without simply inflating baseline derived stats.',
          'The server rebuilds and validates the starting state. The browser does not get to submit its own level, XP total, timestamps, or final attribute totals.',
        ],
      },
      {
        id: 'discipline',
        title: 'What is a Discipline?',
        paragraphs: [
          'A Discipline is a learnable combat tradition that establishes your first tactical direction. It is not a permanent class lock. Later mastery systems are intended to let characters deepen, broaden, and combine what they know.',
          'The starting choices are Vanguard, Farstrider, Shadehand, Ironfist, Aetherist, and Lifebinder. Full Mastery, Arts, Traits, Legacy Disciplines, Confluences, and Soulmarks are separate progression systems rather than hidden creation grants.',
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
    rulesVersion: 'Derived stat rules v1 · six-attribute preview',
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
        title: 'How the new split works',
        paragraphs: [
          'Vitality now carries the main maximum-HP and physical-toughness role that previously overloaded Resolve. Agility now carries the main movement, evasion, and reflex role that previously competed inside Finesse.',
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
    rulesVersion: 'Passive Training v1',
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
          'It cannot grant PvP rank, Confluences, Soulmarks, Archive discoveries, rare equipment, economy output, or Rekindling eligibility.',
          'It cannot use client-clock changes, logout tricks, or repeated claim submissions to manufacture extra rewards.',
        ],
      },
    ],
  },
  faq: {
    id: 'manual.faq',
    slug: 'faq',
    title: 'FAQ & Troubleshooting',
    summary: 'Straight answers for common questions in the current preview.',
    category: 'Help',
    lastUpdated: LAST_UPDATED,
    rulesVersion: 'Current preview',
    body: [
      {
        id: 'combat',
        title: 'Can I play tactical combat?',
        paragraphs: [
          'Yes. Battle Hall currently exposes the first player-facing tactical slice: movement, Basic Attack, Guard, Recover, final facing, AI opponent turns, combat logs, and practice-battle completion. It remains a focused preview rather than the final breadth of AUREVANE combat.',
        ],
      },
      {
        id: 'creation-errors',
        title: 'Character creation says something is invalid',
        paragraphs: [
          'Creation now validates the same character choices before submission and identifies the relevant field instead of asking you to review an invisible highlight. All six starting bonus points must be assigned before confirmation.',
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
    rulesVersion: 'Current preview',
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
          'The current practice-combat destination for focused drills and AI Sparring using the authoritative tactical rules.',
        ],
      },
      {
        id: 'action-economy-term',
        title: 'Action Economy / AP',
        paragraphs: [
          'The current turn budget. A normal movement terrain point costs 25 AP; Basic Attack and Guard cost 30 AP; Recover costs 50 AP. Terrain can increase movement cost.',
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
  title: 'Battle Hall & Action Economy',
  summary: 'How the current practice battles, AP spending, previews, facing, and combat log work.',
  category: 'Combat',
  lastUpdated: LAST_UPDATED,
  rulesVersion: 'PV-1F action economy preview',
  body: [
    {
      id: 'entering',
      title: 'Entering Battle Hall',
      paragraphs: [
        'Battle Hall starts neutral with no fight preselected. AI Sparring is the first full training duel, while focused movement, strike, and guard drills remain available. Future 1v1, 2v2, and 3v3 player sparring is represented only as unavailable shell UI until multiplayer combat exists.',
      ],
    },
    {
      id: 'ap',
      title: 'Action Economy',
      paragraphs: [
        'A turn starts with 100 AP. A normal movement terrain point costs 25 AP. Rough ground currently has terrain weight 2, so entering it costs 50 AP. Basic Attack and Guard cost 30 AP; Recover costs 50 AP.',
        'Selecting a legal action proposes the AP spend before commitment. The AP bar shows the proposed segment with a temporary glow; after confirmation the authoritative committed value becomes the new solid remainder.',
      ],
    },
    {
      id: 'planning',
      title: 'Choose first — nothing is forced',
      paragraphs: [
        'The battle does not begin in Move mode. You can Inspect, Move, Basic Attack, Guard, Recover, or Finish Turn as the situation allows. Confirm Action, Enter, or a deliberate double-click/double-tap commits a legal proposal.',
        'Cancel Action clears the current proposal without committing it. Abort Battle ends the practice battle as abandoned.',
      ],
    },
    {
      id: 'facing',
      title: 'Final facing and the opponent turn',
      paragraphs: [
        'Finish Turn asks for north, east, south, or west facing. Choosing the direction commits that facing and ends your turn. The AI opponent then resolves its server-authoritative turn before control returns to you if the battle is still active.',
      ],
    },
    {
      id: 'reading-battle',
      title: 'Reading the battlefield',
      paragraphs: [
        'Combatant cards keep only high-value information visible by default. Click a combatant to inspect Initiative, Movement, Jump, Armor, Evasion, and current facing. Status icons open above the battle layer so their details stay readable.',
        'The Combat Log groups the sibling events from one committed action into a single action entry. Solo Battle Chat is also available for self-notes and interface testing.',
      ],
    },
  ],
}

export const currentManualArticles: readonly ManualArticle[] = [
  ...foundationManualArticles.map((article) => overrides[article.slug] ?? article),
  battleHallArticle,
]

export function findCurrentManualArticle(slug: string): ManualArticle | null {
  return currentManualArticles.find((article) => article.slug === slug) ?? null
}
