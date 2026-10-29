import type { MasterPanelCapability } from '@/server/master/staff-access'

/** A page includes every tool needed to use it. Only Staff & Access is nondelegable. */
const PAGE_DEFINITIONS = [
  {
    id: 'combat',
    label: 'Game Content',
    capabilities: ['content.combat.author', 'content.story_copy', 'content.production_publish'],
  },
  {
    id: 'combat-timing',
    label: 'Combat Rules',
    capabilities: ['combat.rules', 'balance.edit_selected'],
  },
  {
    id: 'events',
    label: 'Events',
    capabilities: [
      'events.author',
      'events.operate',
      'events.production_publish',
      'events.global_scope',
      'events.reward_titles',
      'events.emergency_stop',
    ],
  },
  {
    id: 'moderation',
    label: 'Moderation',
    capabilities: ['moderation.manage', 'moderation.permanent_ban'],
  },
  {
    id: 'players',
    label: 'Players',
    capabilities: ['players.manage', 'support.issue_compensation'],
  },
  { id: 'staff', label: 'Staff & Access', capabilities: ['staff.manage'] },
  { id: 'music', label: 'Site Music', capabilities: ['music.manage'] },
  { id: 'world-environment', label: 'World Environment', capabilities: ['world.manage'] },
  { id: 'activity', label: 'Activity Log', capabilities: ['activity.read'] },
] as const satisfies readonly {
  id: string
  label: string
  capabilities: readonly MasterPanelCapability[]
}[]
export const MASTER_PANEL_NAVIGATION = PAGE_DEFINITIONS.map((page) => ({
  ...page,
  href: `/master/${page.id === 'combat' ? 'combat-content' : page.id}` as const,
}))
export type MasterPanelTab = (typeof MASTER_PANEL_NAVIGATION)[number]['id']
export const MASTER_PANEL_PAGES = MASTER_PANEL_NAVIGATION.filter((page) => page.id !== 'staff')
export type MasterPanelPage = (typeof MASTER_PANEL_PAGES)[number]['id']
export interface MasterPanelNavigationSettings {
  readonly revision: number
  readonly order: readonly MasterPanelTab[]
}
export function normalizeMasterPanelOrder(value: unknown): MasterPanelTab[] {
  const candidates = Array.isArray(value) ? value : []
  const ids = MASTER_PANEL_NAVIGATION.map((page) => page.id)
  return [
    ...new Set([...candidates.filter((id): id is MasterPanelTab => ids.includes(id)), ...ids]),
  ]
}
export function isCompleteMasterPanelOrder(value: unknown): value is MasterPanelTab[] {
  return (
    Array.isArray(value) &&
    value.length === MASTER_PANEL_NAVIGATION.length &&
    new Set(value).size === value.length &&
    value.every((id) => MASTER_PANEL_NAVIGATION.some((page) => page.id === id))
  )
}
export function orderedMasterPanelPages(order?: unknown) {
  return normalizeMasterPanelOrder(order).flatMap((id) =>
    MASTER_PANEL_PAGES.filter((page) => page.id === id),
  )
}

export function isMasterPanelPage(value: unknown): value is MasterPanelPage {
  return MASTER_PANEL_PAGES.some((page) => page.id === value)
}
export function capabilitiesForMasterPanelPages(
  pages: readonly MasterPanelPage[],
): readonly MasterPanelCapability[] {
  return [
    ...new Set<MasterPanelCapability>(
      pages.length
        ? [
            'master.access',
            ...MASTER_PANEL_PAGES.filter((page) => pages.includes(page.id)).flatMap((page) => [
              ...page.capabilities,
            ]),
          ]
        : [],
    ),
  ]
}
