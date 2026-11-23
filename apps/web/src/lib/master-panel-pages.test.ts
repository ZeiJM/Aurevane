import { expect, it } from 'vitest'
import {
  MASTER_PANEL_NAVIGATION,
  MASTER_PANEL_PAGES,
  normalizeMasterPanelOrder,
  orderedMasterPanelPages,
} from './master-panel-pages'

it('keeps delegated page choices in the same order as visible navigation without delegating Staff', () => {
  expect(MASTER_PANEL_PAGES.map((p) => p.id)).toEqual(
    MASTER_PANEL_NAVIGATION.filter((p) => p.id !== 'staff').map((p) => p.id),
  )
  expect(MASTER_PANEL_PAGES.map((p) => p.id)).not.toContain('staff')
  const reversed = MASTER_PANEL_NAVIGATION.map((p) => p.id).toReversed()
  expect(orderedMasterPanelPages(reversed).map((p) => p.id)).toEqual(
    reversed.filter((id) => id !== 'staff'),
  )
})
it('repairs unknown, duplicate and missing IDs and resets to the default sequence', () => {
  const defaults = MASTER_PANEL_NAVIGATION.map((p) => p.id)
  expect(normalizeMasterPanelOrder(['activity', 'unknown', 'activity', 'combat'])).toEqual([
    'activity',
    'combat',
    ...defaults.filter((id) => !['activity', 'combat'].includes(id)),
  ])
  expect(normalizeMasterPanelOrder(null)).toEqual(defaults)
})
