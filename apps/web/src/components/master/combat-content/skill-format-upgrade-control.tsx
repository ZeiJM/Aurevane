'use client'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import { skillHasDifferentContextRules, upgradeSkillFormat } from './skill-format-upgrade'

export function SkillFormatUpgradeControl({
  value,
  onChange,
}: {
  value: MatureSkillDefinition
  onChange(value: MatureSkillDefinition): void
}) {
  const contexts = skillHasDifferentContextRules(value)
    ? (['base', 'pvp', 'pve'] as const)
    : (['base'] as const)
  return (
    <aside aria-label="Full effect editor">
      <p>
        Enable the full effect editor to add Move, Summon and modifier groups. This changes the
        draft only.
      </p>
      {contexts.length > 1 && (
        <p>
          This Skill has different combat context rules. Choose which costs and cooldowns to use for
          both PvE and PvP.
        </p>
      )}
      {contexts.map((context) => {
        let next: MatureSkillDefinition | undefined
        let issue = ''
        try {
          next = upgradeSkillFormat(value, context)
        } catch (error) {
          issue =
            error instanceof Error
              ? error.message
              : 'This retained Skill needs review before conversion.'
        }
        return (
          <span key={context}>
            <button
              type="button"
              disabled={!next}
              onClick={() => {
                if (next) onChange(next)
              }}
            >
              {contexts.length === 1
                ? 'Enable full effect editor'
                : `Use ${context === 'base' ? 'base' : context === 'pvp' ? 'PvP' : 'PvE'} rules`}
            </button>
            {issue && <small>{issue}</small>}
          </span>
        )
      })}
    </aside>
  )
}
