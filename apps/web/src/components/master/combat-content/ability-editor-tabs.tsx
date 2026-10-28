'use client'
import { useId, useState, type ReactNode } from 'react'
import styles from './combat-content-editor.module.css'
import { ABILITY_EDITOR_SECTIONS, type AbilityEditorSection } from '@/lib/ability-editor-sections'
export { ABILITY_EDITOR_SECTIONS, type AbilityEditorSection } from '@/lib/ability-editor-sections'
export function AbilityEditorTabs({
  panels,
  initialSection = 'details',
}: {
  panels: Readonly<Record<AbilityEditorSection, ReactNode>>
  initialSection?: AbilityEditorSection
}) {
  const id = useId()
  const [active, setActive] = useState<AbilityEditorSection>(initialSection)
  return (
    <div className={styles.abilityWorkspace}>
      <div role="tablist" aria-label="Ability sections" className={styles.abilityTabs}>
        {ABILITY_EDITOR_SECTIONS.map((section, index) => (
          <button
            key={section.id}
            type="button"
            role="tab"
            id={`${id}-${section.id}-tab`}
            aria-controls={`${id}-${section.id}-panel`}
            aria-selected={active === section.id}
            tabIndex={active === section.id ? 0 : -1}
            onClick={() => setActive(section.id)}
            onKeyDown={(event) => {
              const next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? ABILITY_EDITOR_SECTIONS.length - 1
                    : event.key === 'ArrowRight'
                      ? (index + 1) % ABILITY_EDITOR_SECTIONS.length
                      : event.key === 'ArrowLeft'
                        ? (index + ABILITY_EDITOR_SECTIONS.length - 1) %
                          ABILITY_EDITOR_SECTIONS.length
                        : null
              if (next === null) return
              event.preventDefault()
              setActive(ABILITY_EDITOR_SECTIONS[next]!.id)
              event.currentTarget.parentElement
                ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                [next]?.focus()
            }}
          >
            {section.label}
          </button>
        ))}
      </div>
      {ABILITY_EDITOR_SECTIONS.map((section) => (
        <div
          key={section.id}
          role="tabpanel"
          id={`${id}-${section.id}-panel`}
          aria-labelledby={`${id}-${section.id}-tab`}
          data-ability-section={section.id}
          hidden={active !== section.id}
        >
          {panels[section.id]}
        </div>
      ))}
    </div>
  )
}
