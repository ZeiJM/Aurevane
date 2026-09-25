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

const OVERVIEW_TECHNIQUE_SLOTS = 4

function TechniqueLane({
  kind,
  discipline,
  skills,
  locked = false,
}: {
  kind: 'primary' | 'secondary'
  discipline: { id: string; name: string } | null
  skills: readonly MatureSkillDefinition[]
  locked?: boolean
}) {
  return (
    <section
      className={styles.techniqueLane}
      data-nexus-technique-lane="true"
      data-locked={locked ? 'true' : 'false'}
      aria-label={locked ? 'Locked Secondary Techniques' : `${discipline?.name ?? kind} Techniques`}
    >
      <header className={styles.techniqueLaneIdentity}>
        <span className={styles.laneSigil} aria-hidden="true">
          {locked || !discipline ? (
            <span className={styles.lockGlyph}>▣</span>
          ) : (
            <FoundationDisciplineSigil disciplineId={discipline.id} />
          )}
        </span>
        <div>
          <strong>{locked ? 'Locked' : discipline?.name}</strong>
          {locked ? <small>Choose a second discipline.</small> : null}
        </div>
      </header>

      <div className={styles.techniqueSlots}>
        {Array.from({ length: OVERVIEW_TECHNIQUE_SLOTS }, (_, index) => {
          const skill = skills[index]
          if (locked) {
            return (
              <div
                className={styles.lockedTechniqueSlot}
                key={`locked-${kind}-${index}`}
                data-arsenal-technique-row="true"
                data-arsenal-media="true"
                data-equipped="false"
                aria-hidden="true"
              >
                <span>▣</span>
              </div>
            )
          }
          if (!skill) {
            return (
              <div
                className={styles.emptyTechniqueSlot}
                key={`empty-${kind}-${index}`}
                data-arsenal-technique-row="true"
                data-empty-technique-slot="true"
                data-equipped="false"
                aria-hidden="true"
              >
                <span>+</span>
              </div>
            )
          }
          return (
            <article
              className={styles.overviewTechnique}
              key={skill.id}
              data-arsenal-technique-row="true"
              data-equipped="true"
            >
              <span className={styles.overviewTechniqueArt} data-arsenal-media="true">
                <Image
                  src={battleSkillArtwork(skill.id)}
                  width={64}
                  height={64}
                  unoptimized
                  alt=""
                />
              </span>
              <strong>{skillDisplayName(skill)}</strong>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function LockedAttunementCard({ label }: { label: 'Essence' | 'Resonance' }) {
  return (
    <article className={styles.attunementCard} data-active="false">
      <span className={styles.attunementArt} aria-hidden="true">
        <span className={styles.lockGlyph}>▣</span>
      </span>
      <div>
        <strong>{label}</strong>
        <p>Not yet attuned.</p>
        <b>▣ Locked</b>
      </div>
    </article>
  )
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
  const disciplineSummary = characterDisciplineSummary(
    disciplineBuild.current.definition,
    disciplineBuild.currentSecondary,
  )
  const maxHp = disciplineBuild.current.derived.stats.maxHp.value
  const maxMp = disciplineBuild.current.derived.stats.maxMp.value
  const equipped = [...disciplineBuild.disciplineSkills.equippedSkills].sort(
    (left, right) => left.slotIndex - right.slotIndex,
  )
  const primarySkills = equipped
    .filter(
      (entry) => entry.definition.sourceDisciplineId === disciplineBuild.current.definition.id,
    )
    .map((entry) => entry.definition)
  const secondarySkills = disciplineBuild.currentSecondary
    ? equipped
        .filter(
          (entry) => entry.definition.sourceDisciplineId === disciplineBuild.currentSecondary?.id,
        )
        .map((entry) => entry.definition)
    : []

  return (
    <div className={styles.layout} data-arsenal-workspace data-character-concept="nexus">
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
              <h1>Nexus</h1>
              <p>Master disciplines. Refine techniques. Prepare for what comes.</p>
            </div>
          </div>
          <small>
            A sharper mind. A steadier hand.
            <br />A kinder world.
          </small>
        </header>

        <section
          className={[styles.panel, styles.disciplinesPanel].join(' ')}
          data-arsenal-panel="disciplines"
          aria-labelledby="nexus-disciplines-heading"
        >
          <header className={styles.sectionHeading}>
            <div>
              <span>✦</span>
              <h2 id="nexus-disciplines-heading">Disciplines</h2>
            </div>
            <small>Your foundation in battle</small>
          </header>

          <div className={styles.disciplinePair}>
            <article className={styles.disciplineCard} data-slot="primary">
              <span className={styles.disciplineSigil}>
                <FoundationDisciplineSigil disciplineId={disciplineBuild.current.definition.id} />
              </span>
              <div>
                <span>Primary Discipline</span>
                <strong>{disciplineBuild.current.definition.name}</strong>
                <p>{disciplineBuild.current.definition.summary}</p>
              </div>
            </article>

            {disciplineBuild.currentSecondary ? (
              <article className={styles.disciplineCard} data-slot="secondary">
                <span className={styles.disciplineSigil}>
                  <FoundationDisciplineSigil disciplineId={disciplineBuild.currentSecondary.id} />
                </span>
                <div>
                  <span>Secondary Discipline</span>
                  <strong>{disciplineBuild.currentSecondary.name}</strong>
                  <p>{disciplineBuild.currentSecondary.summary}</p>
                </div>
              </article>
            ) : (
              <article className={styles.disciplineCard} data-slot="secondary" data-locked="true">
                <span className={styles.disciplineSigil} aria-hidden="true">
                  <span className={styles.lockGlyph}>▣</span>
                </span>
                <div>
                  <span>Secondary Discipline</span>
                  <strong>Locked</strong>
                  <p>A second discipline awaits.</p>
                </div>
              </article>
            )}
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
          aria-labelledby="nexus-techniques-heading"
        >
          <header className={styles.sectionHeading}>
            <div>
              <span>✦</span>
              <h2 id="nexus-techniques-heading">Techniques</h2>
            </div>
          </header>

          <div className={styles.techniqueLanes}>
            <TechniqueLane
              kind="primary"
              discipline={{
                id: disciplineBuild.current.definition.id,
                name: disciplineBuild.current.definition.name,
              }}
              skills={primarySkills}
            />
            <TechniqueLane
              kind="secondary"
              discipline={
                disciplineBuild.currentSecondary
                  ? {
                      id: disciplineBuild.currentSecondary.id,
                      name: disciplineBuild.currentSecondary.name,
                    }
                  : null
              }
              skills={secondarySkills}
              locked={!disciplineBuild.currentSecondary}
            />
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
            aria-labelledby="nexus-attunement-heading"
          >
            <header className={styles.sectionHeading}>
              <div>
                <span>✦</span>
                <h2 id="nexus-attunement-heading">Attunement</h2>
              </div>
              <small>Align with greater potential</small>
            </header>

            <div className={styles.attunementGrid}>
              {essence ? (
                <article className={styles.attunementCard} data-active="true">
                  <span className={styles.attunementArt}>
                    <Image
                      src={battleSkillArtwork(essence.skill.id)}
                      width={64}
                      height={64}
                      unoptimized
                      alt=""
                    />
                  </span>
                  <div>
                    <strong>{essence.name}</strong>
                    <p>{essence.description}</p>
                    <b>● Active</b>
                  </div>
                </article>
              ) : (
                <LockedAttunementCard label="Essence" />
              )}

              {resonance ? (
                <article className={styles.attunementCard} data-active="true">
                  <span className={styles.attunementArt}>
                    <Image
                      src={battleResonanceArtwork(resonance.id)}
                      width={64}
                      height={64}
                      unoptimized
                      alt=""
                    />
                  </span>
                  <div>
                    <strong>{resonance.name}</strong>
                    <p>{resonance.description}</p>
                    <b>● Active</b>
                  </div>
                </article>
              ) : (
                <LockedAttunementCard label="Resonance" />
              )}
            </div>
          </section>

          <section
            className={[styles.panel, styles.powerPanel].join(' ')}
            data-arsenal-panel="power"
            aria-labelledby="nexus-power-heading"
          >
            <header className={styles.sectionHeading}>
              <div>
                <span>✦</span>
                <h2 id="nexus-power-heading">Ascension / Severed Power</h2>
              </div>
            </header>

            <div className={styles.powerGrid}>
              <article className={styles.futurePowerCard} data-power="ascension">
                <span className={styles.powerGlyph} aria-hidden="true">
                  ✺
                </span>
                <div>
                  <strong>Ascension</strong>
                  <p>Granted by the game owner. A different path of power.</p>
                  <b>▣ Coming Soon</b>
                </div>
              </article>
              <article className={styles.futurePowerCard} data-power="severed">
                <span className={styles.powerGlyph} aria-hidden="true">
                  ◐
                </span>
                <div>
                  <strong>Severed</strong>
                  <p>Granted by the game owner. A different path of power.</p>
                  <b>▣ Coming Soon</b>
                </div>
              </article>
            </div>
          </section>
        </div>
      </Surface>
    </div>
  )
}
