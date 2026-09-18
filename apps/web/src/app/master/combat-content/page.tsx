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
import { masterPanelAuthorityLabel } from '@/server/master/staff-access'
import { createSupabaseCombatContentAuthoringStore } from '@/server/master/supabase-combat-content-authoring-store'

import styles from '../master.module.css'

export const dynamic = 'force-dynamic'

async function mapInBatches<T, R>(
  values: readonly T[],
  batchSize: number,
  project: (value: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  for (let index = 0; index < values.length; index += batchSize) {
    results.push(...(await Promise.all(values.slice(index, index + batchSize).map(project))))
  }
  return results
}

function titleSkill(skillId: string): string {
  const tail = skillId.includes('.') ? skillId.slice(skillId.indexOf('.') + 1) : skillId
  return tail
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export default async function MasterCombatContentPage() {
  const { actor, access } = await requireMasterPanelPageAccess('content.combat.author')
  const owner = access.roles.includes('game-owner')
  const authorityLabel = masterPanelAuthorityLabel(access.roles)
  const resolver = createServerCombatContentResolver()
  const store = createSupabaseCombatContentAuthoringStore(actor.userId)
  const catalog = latestEnabledMatureSkills()

  const options = (
    await mapInBatches(
      catalog,
      4,
      async (staticDefinition): Promise<CombatContentEditorSkillOption | null> => {
        const [current, draft, publishedVersions] = await Promise.all([
          resolver.resolveCurrentSkillDefinition(staticDefinition.id),
          store.findDraft(staticDefinition.id),
          store.listPublishedVersions(staticDefinition.id),
        ])
        if (!current) return null

        const historyByVersion = new Map<
          number,
          NonNullable<CombatContentEditorSkillOption['history']>[number]
        >()
        historyByVersion.set(staticDefinition.contentVersion, {
          contentVersion: staticDefinition.contentVersion,
          source: 'static-baseline',
          current: current.contentVersion === staticDefinition.contentVersion,
          publishedAt: null,
        })
        for (const version of publishedVersions) {
          historyByVersion.set(version.contentVersion, {
            contentVersion: version.contentVersion,
            source: 'published',
            current: current.contentVersion === version.contentVersion,
            publishedAt: version.publishedAt,
          })
        }

        return {
          id: current.id,
          sourceDisciplineId: current.sourceDisciplineId,
          label: titleSkill(current.id),
          currentVersion: current.contentVersion,
          baseVersion: draft?.baseVersion ?? current.contentVersion,
          draftVersion: draft?.draftVersion ?? null,
          derivedTags: [...deriveSkillPresentationTags(current)],
          definition: structuredClone(current),
          history: [...historyByVersion.values()].sort(
            (left, right) => left.contentVersion - right.contentVersion,
          ),
        }
      },
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
          <span
            className={[styles.operator, owner ? styles.worldwright : ''].filter(Boolean).join(' ')}
          >
            {owner ? (
              <span className={styles.operatorIcon} aria-hidden="true">
                ✦
              </span>
            ) : null}
            {authorityLabel}
          </span>
        </header>
        <Link className={styles.breadcrumb} href="/master">
          ← Master Panel
        </Link>
        <CombatContentEditor
          key={options
            .map(
              (option) =>
                `${option.id}:${option.currentVersion}:${option.draftVersion ?? 'none'}:${option.history?.map((entry) => `${entry.contentVersion}=${entry.current ? 'current' : 'old'}`).join(',') ?? ''}`,
            )
            .join('|')}
          skills={options}
          initialSkillId={options[0]?.id}
        />
      </div>
    </main>
  )
}
