import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
import Link from 'next/link'

import {
  CombatContentEditor,
  type CombatContentEditorSkillOption,
} from '@/components/master/combat-content/combat-content-editor'
import {
  createServerCombatContentResolver,
  deriveSkillPresentationTags,
} from '@/server/combat/combat-content-resolver'
import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
import { createSupabaseCombatContentAuthoringStore } from '@/server/master/supabase-combat-content-authoring-store'

import styles from '../master.module.css'

export const dynamic = 'force-dynamic'

function titleSkill(skillId: string): string {
  const tail = skillId.includes('.') ? skillId.slice(skillId.indexOf('.') + 1) : skillId
  return tail
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export default async function MasterCombatContentPage() {
  const { actor, role } = await requireMasterPanelPageAccess()
  const resolver = createServerCombatContentResolver()
  const store = createSupabaseCombatContentAuthoringStore(actor.userId)
  const catalog = latestEnabledMatureSkills()

  const options = (
    await Promise.all(
      catalog.map(async (staticDefinition): Promise<CombatContentEditorSkillOption | null> => {
        const [current, draft] = await Promise.all([
          resolver.resolveCurrentSkillDefinition(staticDefinition.id),
          store.findDraft(staticDefinition.id),
        ])
        if (!current) return null

        return {
          id: current.id,
          sourceDisciplineId: current.sourceDisciplineId,
          label: titleSkill(current.id),
          currentVersion: current.contentVersion,
          baseVersion: draft?.baseVersion ?? current.contentVersion,
          draftVersion: draft?.draftVersion ?? null,
          derivedTags: [...deriveSkillPresentationTags(current)],
        }
      }),
    )
  )
    .filter((option): option is CombatContentEditorSkillOption => option !== null)
    .sort(
      (left, right) =>
        left.sourceDisciplineId.localeCompare(right.sourceDisciplineId) ||
        left.id.localeCompare(right.id),
    )

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <header className={styles.masthead}>
          <div className={styles.brand}>
            <strong>AUREVANE</strong>
            <span>Master Panel · Combat Content</span>
          </div>
          <span className={styles.operator}>{role}</span>
        </header>
        <Link className={styles.breadcrumb} href="/master">
          ← Master Panel
        </Link>
        <CombatContentEditor skills={options} initialSkillId={options[0]?.id} />
      </div>
    </main>
  )
}
