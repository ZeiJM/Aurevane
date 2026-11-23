export const ABILITY_EDITOR_SECTIONS = [
  { id: 'details', label: 'Details & Text' },
  { id: 'media', label: 'Media' },
  { id: 'range', label: 'Range & Area' },
  { id: 'execution', label: 'Execution Characteristics' },
  { id: 'effects', label: 'Effects' },
] as const
export type AbilityEditorSection =
  (typeof ABILITY_EDITOR_SECTIONS)[number]['id'] | 'economy' | 'accuracy'

export function isAbilityEditorSection(value: unknown): value is AbilityEditorSection {
  return ABILITY_EDITOR_SECTIONS.some((section) => section.id === value)
}
