import type { MasterPanelCapability } from '@/server/master/staff-access'

/** A page includes every tool needed to use it. Only Staff & Access is nondelegable. */
export const MASTER_PANEL_PAGES = [
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
    id: 'players',
    label: 'Players',
    capabilities: ['players.manage', 'support.issue_compensation'],
  },
  {
    id: 'moderation',
    label: 'Moderation',
    capabilities: ['moderation.manage', 'moderation.permanent_ban'],
  },
  { id: 'music', label: 'Site Music', capabilities: ['music.manage'] },
  { id: 'world-environment', label: 'World Environment', capabilities: ['world.manage'] },
  { id: 'activity', label: 'Activity Log', capabilities: ['activity.read'] },
] as const satisfies readonly {
  id: string
  label: string
  capabilities: readonly MasterPanelCapability[]
}[]
export type MasterPanelPage = (typeof MASTER_PANEL_PAGES)[number]['id']
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
