import { WORLD_REGIONS } from '@/world/catalog'

/** Display existing canonical region names without inventing unresolved audience membership. */
export function eventAudienceLabel(type: string, key?: string | null): string {
  if (type === 'global') return 'All players'
  if (type === 'region') {
    const region = WORLD_REGIONS.find((entry) => entry.id === key)
    if (region) return `Region · ${region.name}`
  }
  return `Unresolved ${type} · ${key || 'no reference selected'}`
}
