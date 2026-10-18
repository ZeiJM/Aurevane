import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { getStarterPortraitImageAssetId } from '@/media/character'
import { STARTER_CHARACTER_PORTRAITS } from '@aurevane/game-core/character/starter-options'
import type { ReactNode } from 'react'
import type { BattlePresentedStatus } from '@/lib/battle/battle-elevation-effects'
const hooks = vi.hoisted(() => ({ queue: [] as unknown[] }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState: (initial: unknown) => [
    hooks.queue.length
      ? hooks.queue.shift()
      : typeof initial === 'function'
        ? (initial as () => unknown)()
        : initial,
    () => {},
  ],
}))
vi.mock('react-dom', async (original) => ({
  ...(await original<typeof import('react-dom')>()),
  createPortal: (node: ReactNode) => node,
}))
import { DesktopBattleCombatantInspect } from './desktop-battle-combatant-inspect'
import { MobileBattleCombatantPopup } from './mobile-battle-combatant-popup'
import { PvpBattleInspectPopup } from './pvp-battle-inspect-popup'
import { PvpBattleCombatantPanels } from './pvp-battle-combatant-panels'
import { PvpDesktopParity } from './pvp-desktop-parity'
const statuses: BattlePresentedStatus[] = [
  {
    statusId: 'guarded',
    statusVersion: 1,
    stacks: 2,
    potencyBasisPoints: 1000,
    remainingOwnerTurnStarts: 2,
    remainingOwnerTurnEnds: 2,
    sourceCombatantId: 'source-private',
  },
]
const combatant = {
  id: 'actor',
  teamId: 'team',
  initiative: 10,
  hp: 80,
  maxHp: 100,
  mp: 20,
  maxMp: 30,
  barrier: 0,
  baseMovementBudget: 3,
  temporaryResources: [],
}
const placement = {
  combatantId: 'actor',
  position: { x: 0, y: 0 },
  facing: 'east',
  movementProfileId: 'ordinary-ground',
}
const participant = {
  combatantId: 'actor',
  characterId: 'character:actor',
  characterName: 'Archer',
  teamIndex: 0,
  seatIndex: 0,
  characterLevel: 1,
  profileImageUrl: null,
  portraitAssetId: null,
  portraitRef: STARTER_CHARACTER_PORTRAITS[0]!.ref,
}
const metadata = {
  lobbyId: 'lobby',
  battleKey: 'key',
  mode: '1v1' as const,
  localCharacterId: 'character:actor',
  participants: [participant],
}
const battle = {
  id: 'battle',
  status: 'active',
  snapshot: {
    tactical: {
      battle: {
        combatants: [combatant],
        currentTurn: { combatantId: 'actor' },
        status: 'active',
        round: 2,
      },
      placements: [placement],
    },
    statusState: [{ combatantId: 'actor', statuses }],
    statBridge: { combatants: [] },
  },
}
const selected = {
  combatant,
  placement,
  profile: null,
  statuses,
  name: 'Archer',
  teamLabel: 'Team 1',
  level: 1,
  imageUrl: null,
  fallbackAssetId: null,
  isPlayer: true,
  active: true,
  summon: null,
  participant,
  actionEconomy: null,
}
function renderSurface(surface: string) {
  hooks.queue =
    surface === 'pvp-panels'
      ? [battle, {}, 'actor']
      : surface === 'pvp-parity'
        ? [battle, {}, null]
        : [true, false, null, selected]
  const nodes = {
    'desktop-inspect': <DesktopBattleCombatantInspect battleSessionId="battle" />,
    'mobile-inspect': (
      <MobileBattleCombatantPopup
        battleSessionId="battle"
        playerName="Archer"
        playerPortraitAssetId={getStarterPortraitImageAssetId(STARTER_CHARACTER_PORTRAITS[0]!.ref)}
      />
    ),
    'pvp-inspect': (
      <PvpBattleInspectPopup
        battleSessionId="battle"
        metadata={metadata as Parameters<typeof PvpBattleInspectPopup>[0]['metadata']}
      />
    ),
    'pvp-panels': (
      <PvpBattleCombatantPanels
        initialBattle={
          battle as unknown as Parameters<typeof PvpBattleCombatantPanels>[0]['initialBattle']
        }
        metadata={metadata as unknown as Parameters<typeof PvpBattleCombatantPanels>[0]['metadata']}
      />
    ),
    'pvp-parity': (
      <PvpDesktopParity
        initialBattle={battle as unknown as Parameters<typeof PvpDesktopParity>[0]['initialBattle']}
        metadata={metadata as unknown as Parameters<typeof PvpDesktopParity>[0]['metadata']}
      />
    ),
  }
  return renderToStaticMarkup(nodes[surface as keyof typeof nodes]).replace(
    /src="data:[^"]*"/g,
    'src="[image]"',
  )
}
it.each(['desktop-inspect', 'mobile-inspect', 'pvp-inspect', 'pvp-panels', 'pvp-parity'])(
  'renders the actual captured status reader through %s',
  (surface) => {
    const html = renderSurface(surface)
    expect(html).toContain('data-battle-info-trigger="true"')
    expect(html).toContain('Incoming damage from this effect: −19%')
    expect(html).toContain('2 stacks')
    expect(html).not.toContain('source-private')
    if (surface.endsWith('inspect')) {
      expect(html).toMatch(/<section[^>]*data-battle-effect-inspect="true"[^>]*tabindex="-1"/)
      expect(html).toContain('Ctrl+Alt+E')
    }
  },
)

it.each(
  ['mobile-inspect', 'pvp-inspect'].flatMap((surface) => [
    {
      surface,
      fields: { statusId: 'barrier', durationScope: 'until-spent' as const },
      expected: 'Until depleted',
    },
    {
      surface,
      fields: { statusId: 'healing', durationScope: 'instant' as const, recoveryApplications: 4 },
      expected: '4 applications remaining',
    },
    {
      surface,
      fields: {
        timingState: 'pending' as const,
        activationRound: 4,
        durationScope: 'rounds' as const,
        remainingRoundBoundaries: 3,
      },
      expected: '3 round boundaries remaining',
    },
  ]),
)('shows truthful visible lifetime on $surface: $expected', ({ surface, fields, expected }) => {
  const old = statuses[0]!
  try {
    statuses[0] = {
      ...old,
      ...fields,
      remainingOwnerTurnStarts: 1,
      remainingOwnerTurnEnds: undefined,
    }
    const html = renderSurface(surface)
    const visible = html
      .replace(/<span[^>]* hidden=""[^>]*>.*?<\/span>/g, '')
      .replace(/<[^>]*>/g, '')
    expect(visible).toContain(expected)
    expect(visible).not.toContain('1 turn remaining')
  } finally {
    statuses[0] = old
  }
})

it('keeps the actual desktop inspection summary consistent with legacy captured Guard', () => {
  const old = statuses[0]!
  try {
    statuses[0] = {
      ...old,
      applicationModifiers: [
        { stacks: 1, sourceCombatantId: 'a', potencyBasisPoints: 1000 },
        { stacks: 1, sourceCombatantId: 'b', potencyBasisPoints: 2000 },
      ],
    }
    const visible = renderSurface('desktop-inspect')
      .replace(/<span[^>]* hidden=""[^>]*>.*?<\/span>/g, '')
      .replace(/<[^>]*>/g, '')
    expect(visible).toContain('−19%')
    expect(visible).not.toContain('−28%')
  } finally {
    statuses[0] = old
  }
})
