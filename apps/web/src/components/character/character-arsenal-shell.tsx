import Image from 'next/image'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import { Surface } from '@aurevane/ui'

import {
  battleResonanceArtwork,
  battleSkillArtwork,
} from '@/components/battle/battle-skill-presentation'
import { CharacterDisciplineBuildPanel } from '@/components/character/character-discipline-build-panel'
import { CharacterIdentityCard } from '@/components/character/character-identity-card'
import {
  characterDisciplineSummary,
  type CharacterWorkspaceProps,
} from '@/components/character/character-profile-shell'
import { CharacterSkillBuildPanel } from '@/components/character/character-skill-build-panel'
import { FoundationDisciplineSigil } from '@/components/character/foundation-discipline-sigil'

import { skillDisplayName } from './skill-detail-presentation'
import styles from './character-arsenal-shell.module.css'

const disciplineConceptCopy: Readonly<Record<string, { description: string; label: string }>> = {
  runeblade: {
    description:
      'Harness ancient marks and turn precision into power. Cut through what others cannot.',
    label: 'Discipline of Marks',
  },
  lifebinder: {
    description:
      'Draw life, sustain allies, and shape a stronger tomorrow. What you protect persists.',
    label: 'Discipline of Life',
  },
}

const techniqueConceptCopy: Readonly<Record<string, string>> = {
  'runeblade.aether-cut': 'Slice through barriers.',
  'runeblade.rune-strike': 'Imbue and release.',
  'runeblade.frost-nova': 'Freeze the field.',
  'runeblade.shadow-step': 'Vanish and reposition.',
  'lifebinder.mend': 'Restore health.',
  'lifebinder.barrier': 'Raise a protective ward.',
  'lifebinder.verdant-pulse': 'Heal and strengthen.',
  'lifebinder.vital-surge': 'Empower and renew.',
}

export function CharacterArsenalShell({
  profile,
  attributeAllocation,
  disciplineBuild,
  personalTitle = null,
  imageUrl = null,
}: CharacterWorkspaceProps) {
  const learnedSkillCatalogKey = disciplineBuild.disciplineSkills.learnedSkills
    .map((entry) => entry.definition.id + '@' + entry.definition.contentVersion)
    .sort()
    .join(',')
  const skillBuildKey = [
    disciplineBuild.buildVersion,
    disciplineBuild.current.definition.id,
    disciplineBuild.currentSecondary?.id ?? 'pure',
    learnedSkillCatalogKey,
  ].join(':')
  const resonance = disciplineBuild.disciplineSkills.extensions.resonance
  const essence = disciplineBuild.disciplineSkills.extensions.essence
  const anomaly = Boolean(resonance && essence)
  const disciplineSummary = characterDisciplineSummary(
    disciplineBuild.current.definition,
    disciplineBuild.currentSecondary,
  )
  const maxHp = disciplineBuild.current.derived.stats.maxHp.value
  const maxMp = disciplineBuild.current.derived.stats.maxMp.value
  const slotCount = Math.max(4, disciplineBuild.disciplineSkills.capacity)
  const disciplines = [disciplineBuild.current.definition, disciplineBuild.currentSecondary].filter(
    (entry): entry is NonNullable<typeof entry> => entry !== null,
  )
  const equippedSkillIds = new Set(
    disciplineBuild.disciplineSkills.equippedSkills.map((entry) => entry.definition.id),
  )
  const techniqueCatalog = new Map<string, MatureSkillDefinition>()
  for (const entry of disciplineBuild.disciplineSkills.learnedSkills) {
    if (entry.activeSource) techniqueCatalog.set(entry.definition.id, entry.definition)
  }
  for (const entry of disciplineBuild.disciplineSkills.equippedSkills) {
    techniqueCatalog.set(entry.definition.id, entry.definition)
  }

  return (
    <div className={styles.layout} data-arsenal-workspace data-character-concept="arsenal">
      <CharacterIdentityCard
        profile={profile}
        primary={disciplineBuild.current.definition}
        secondary={disciplineBuild.currentSecondary}
        personalTitle={personalTitle}
        imageUrl={imageUrl}
        disciplineSummary={disciplineSummary}
        maxHp={maxHp}
        maxMp={maxMp}
      />

      <Surface
        className={styles.arsenal}
        tone="elevated"
        data-av-surface="moonstone"
        data-arsenal-sheet="true"
      >
        <header className={styles.pageHeading}>
          <div className={styles.pageHeadingTitle}>
            <span className={styles.pageIcon} aria-hidden="true">
              ⚔
            </span>
            <div>
              <h1>Arsenal</h1>
              <p>Master disciplines. Refine techniques. Prepare for battle.</p>
            </div>
          </div>
          <small>
            “A sharper mind. A steadier hand.
            <br />A kinder world through greater power.”
          </small>
        </header>

        <section
          className={[styles.panel, styles.disciplinesPanel].join(' ')}
          data-arsenal-panel="disciplines"
          aria-labelledby="arsenal-disciplines-heading"
        >
          <header className={styles.sectionHeading}>
            <div>
              <span>✦</span>
              <h2 id="arsenal-disciplines-heading">Disciplines</h2>
            </div>
            <small>Your disciplines shape your options in battle.</small>
          </header>

          <div className={styles.disciplineList}>
            {disciplines.map((entry) => {
              const concept = disciplineConceptCopy[entry.id]
              return (
                <article
                  className={styles.disciplineRow}
                  key={entry.id}
                  data-discipline={entry.id}
                >
                  <div className={styles.mediaTile} data-arsenal-media="true">
                    <FoundationDisciplineSigil disciplineId={entry.id} />
                  </div>
                  <div className={styles.disciplineIdentity}>
                    <strong>{entry.name}</strong>
                    <p>{entry.summary}</p>
                  </div>
                  <p className={styles.disciplineDescription}>
                    {concept?.description ?? entry.summary}
                  </p>
                  <span className={styles.disciplineLabel}>
                    {concept?.label ?? 'Foundation Discipline'}
                  </span>
                </article>
              )
            })}
          </div>

          <CharacterDisciplineBuildPanel
            initialBuildVersion={disciplineBuild.buildVersion}
            initialCurrent={disciplineBuild.current}
            initialCurrentSecondary={disciplineBuild.currentSecondary}
            availablePrimaries={disciplineBuild.availablePrimaries}
            availableSecondaries={disciplineBuild.availableSecondaries}
            initialAttunement={disciplineBuild.attunement}
            coreAttributes={profile.attributes}
          />
        </section>

        <section
          className={[styles.panel, styles.techniquesPanel].join(' ')}
          data-arsenal-panel="techniques"
          aria-labelledby="arsenal-techniques-heading"
        >
          <header className={styles.sectionHeading}>
            <div>
              <span>✧</span>
              <h2 id="arsenal-techniques-heading">Techniques</h2>
            </div>
            <small>
              Active Techniques {disciplineBuild.disciplineSkills.equippedSkills.length} /{' '}
              {slotCount}
            </small>
          </header>

          <div className={styles.techniqueGroups} aria-label="Equipped Discipline Skills">
            {disciplines.map((discipline) => {
              const definitions = [...techniqueCatalog.values()]
                .filter((definition) => definition.sourceDisciplineId === discipline.id)
                .slice(0, 4)
              const placeholders = Math.max(0, 4 - definitions.length)

              return (
                <section
                  className={styles.techniqueGroup}
                  key={discipline.id}
                  data-discipline={discipline.id}
                  aria-label={`${discipline.name} Techniques`}
                >
                  <header>
                    <FoundationDisciplineSigil disciplineId={discipline.id} />
                    <div>
                      <strong>{discipline.name} Techniques</strong>
                      <small>{discipline.summary}</small>
                    </div>
                  </header>
                  <div>
                    {definitions.map((definition) => (
                      <article
                        className={styles.techniqueRow}
                        key={definition.id}
                        data-arsenal-technique-row="true"
                        data-equipped={equippedSkillIds.has(definition.id) ? 'true' : 'false'}
                      >
                        <div className={styles.mediaTile} data-arsenal-media="true">
                          <Image
                            src={battleSkillArtwork(definition.id)}
                            width={56}
                            height={56}
                            unoptimized
                            alt=""
                          />
                        </div>
                        <div>
                          <strong>{skillDisplayName(definition)}</strong>
                          <small>{techniqueSummary(definition)}</small>
                        </div>
                      </article>
                    ))}
                    {Array.from({ length: placeholders }, (_, index) => (
                      <div
                        className={styles.emptyTechnique}
                        key={`${discipline.id}-empty-${index}`}
                        data-arsenal-technique-row="true"
                        data-equipped="false"
                      >
                        <div className={styles.mediaTile} data-arsenal-empty-media="true">
                          <span aria-hidden="true">+</span>
                        </div>
                        <small>Open technique slot</small>
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>

          <CharacterSkillBuildPanel
            key={skillBuildKey}
            characterId={attributeAllocation.characterId}
            initialBuildVersion={disciplineBuild.buildVersion}
            primaryDiscipline={{
              id: disciplineBuild.current.definition.id,
              name: disciplineBuild.current.definition.name,
            }}
            secondaryDiscipline={
              disciplineBuild.currentSecondary
                ? {
                    id: disciplineBuild.currentSecondary.id,
                    name: disciplineBuild.currentSecondary.name,
                  }
                : null
            }
            initialCapacity={disciplineBuild.disciplineSkills.capacity}
            initialLearnedSkills={disciplineBuild.disciplineSkills.learnedSkills}
            initialEquippedSkills={disciplineBuild.disciplineSkills.equippedSkills}
            initialResonance={resonance}
            initialEssence={essence}
          />
        </section>

        <div className={styles.bottomGrid}>
          <section
            className={[styles.panel, styles.attunementPanel].join(' ')}
            data-arsenal-panel="attunement"
            aria-labelledby="arsenal-attunement-heading"
          >
            <header className={styles.sectionHeading}>
              <div>
                <span>✧</span>
                <h2 id="arsenal-attunement-heading">Attunement</h2>
              </div>
              <small>
                {anomaly
                  ? 'Anomaly: dual attunement'
                  : 'Your core attunement. Most paths resonate with either a Resonance or an Essence.'}
              </small>
            </header>

            <div className={styles.attunementGrid}>
              {resonance ? (
                <article className={styles.attunementCard} data-active="true">
                  <div className={styles.mediaTile} data-arsenal-media="true">
                    <Image
                      src={battleResonanceArtwork(resonance.id)}
                      width={56}
                      height={56}
                      unoptimized
                      alt=""
                    />
                  </div>
                  <div>
                    <strong>{resonance.name}</strong>
                    <span>Resonance</span>
                    <p>{resonance.description}</p>
                    <b>● Active</b>
                  </div>
                </article>
              ) : null}

              {essence ? (
                <article className={styles.attunementCard} data-active="true">
                  <div className={styles.mediaTile} data-arsenal-media="true">
                    <Image
                      src={battleSkillArtwork(essence.skill.id)}
                      width={56}
                      height={56}
                      unoptimized
                      alt=""
                    />
                  </div>
                  <div>
                    <strong>{essence.name}</strong>
                    <span>Essence</span>
                    <p>{essence.description}</p>
                    <b>● Active</b>
                  </div>
                </article>
              ) : null}

              {!anomaly ? (
                <article className={styles.lockedAttunement} data-disabled="true">
                  <div className={styles.mediaTile} data-arsenal-media="true">
                    <span aria-hidden="true">▣</span>
                  </div>
                  <div>
                    <strong>Anomaly Path</strong>
                    <span>{resonance ? 'Essence' : 'Resonance'}</span>
                    <p>
                      Not Available. A rare and unstable path. Only an owner-granted anomaly may
                      open both attunement paths.
                    </p>
                    <b>▣ Locked</b>
                  </div>
                </article>
              ) : null}

              {!resonance && !essence ? (
                <p className={styles.emptyAttunement}>
                  No authored Resonance or Essence is available for this build yet.
                </p>
              ) : null}
            </div>
            {!anomaly ? (
              <p className={styles.anomalyNote}>
                ⓘ A rare anomaly may allow access to both through special provenance.
              </p>
            ) : null}
          </section>

          <section
            className={[styles.panel, styles.itemsPanel].join(' ')}
            aria-labelledby="arsenal-items-heading"
            data-arsenal-panel="items"
            data-disabled="true"
          >
            <header className={styles.sectionHeading}>
              <div>
                <span>▣</span>
                <h2 id="arsenal-items-heading">Items</h2>
              </div>
              <small>Coming Soon</small>
            </header>
            <p>Gear for what lies ahead.</p>
            <div className={styles.itemSlots} aria-hidden="true">
              {['Weapon', 'Head', 'Body', 'Ring', 'Feet', 'Cloak', 'Amulet', 'Hands'].map(
                (label) => (
                  <div key={label}>
                    <span>□</span>
                    <small>{label}</small>
                  </div>
                ),
              )}
            </div>
            <div className={styles.comingSoon}>
              <strong>Coming Soon</strong>
              <small>Item management will be available in a future update.</small>
            </div>
          </section>
        </div>
      </Surface>
    </div>
  )
}

function techniqueSummary(definition: MatureSkillDefinition): string {
  const approved = techniqueConceptCopy[definition.id]
  if (approved) return approved
  if (definition.tags.includes('heal')) return 'Restore and sustain.'
  if (definition.tags.includes('defense')) return 'Protect and endure.'
  if (definition.tags.includes('area')) return 'Shape the field.'
  if (definition.tags.includes('movement')) return 'Reposition with intent.'
  if (definition.tags.includes('support')) return 'Strengthen the advantage.'
  return 'Refine the opening.'
}
