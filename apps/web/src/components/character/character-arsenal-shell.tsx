import Image from 'next/image'

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
import { AuthenticatedShellFrame } from '@/components/shell/authenticated-game-shell'

import { skillDisplayName } from './skill-detail-presentation'
import styles from './character-arsenal-shell.module.css'

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
  const equippedBySlot = new Map(
    disciplineBuild.disciplineSkills.equippedSkills.map((entry) => [entry.slotIndex, entry]),
  )
  const slotCount = Math.max(4, disciplineBuild.disciplineSkills.capacity)
  const slotOffset = disciplineBuild.disciplineSkills.equippedSkills.some(
    (entry) => entry.slotIndex === 0,
  )
    ? 0
    : 1

  return (
    <AuthenticatedShellFrame sessionLabel="Arsenal">
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
            <div>
              <span>Combat preparation</span>
              <h1>Arsenal</h1>
              <p>Master disciplines. Refine techniques. Prepare for battle.</p>
            </div>
            <small>A sharper mind. A steadier hand.</small>
          </header>

          <div className={styles.topGrid}>
            <section
              className={styles.panel}
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

              <div className={styles.disciplineTiles}>
                {[disciplineBuild.current.definition, disciplineBuild.currentSecondary]
                  .filter((entry) => entry !== null)
                  .map((entry) => (
                    <article className={styles.disciplineTile} key={entry.id}>
                      <div className={styles.mediaTile} data-arsenal-media="true">
                        <FoundationDisciplineSigil disciplineId={entry.id} />
                      </div>
                      <strong>{entry.name}</strong>
                      <p>{entry.summary}</p>
                    </article>
                  ))}
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
              className={styles.panel}
              data-arsenal-panel="techniques"
              aria-labelledby="arsenal-techniques-heading"
            >
              <header className={styles.sectionHeading}>
                <div>
                  <span>◇</span>
                  <h2 id="arsenal-techniques-heading">Techniques</h2>
                </div>
                <small>
                  Active {disciplineBuild.disciplineSkills.equippedSkills.length} / {slotCount}
                </small>
              </header>

              <div className={styles.techniqueGrid} aria-label="Equipped Discipline Skills">
                {Array.from({ length: slotCount }, (_, slotIndex) => {
                  const entry = equippedBySlot.get(slotIndex + slotOffset)
                  if (!entry) {
                    return (
                      <div className={styles.emptyTechnique} key={slotIndex}>
                        <div className={styles.mediaTile} data-arsenal-empty-media="true">
                          <span aria-hidden="true">+</span>
                        </div>
                        <small>Empty Slot</small>
                      </div>
                    )
                  }
                  return (
                    <article className={styles.techniqueTile} key={entry.definition.id}>
                      <div className={styles.mediaTile} data-arsenal-media="true">
                        <Image
                          src={battleSkillArtwork(entry.definition.id)}
                          width={56}
                          height={56}
                          unoptimized
                          alt=""
                        />
                      </div>
                      <strong>{skillDisplayName(entry.definition)}</strong>
                    </article>
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
          </div>

          <div className={styles.bottomGrid}>
            <section
              className={styles.panel}
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
                    : 'Most paths attune to either Resonance or Essence.'}
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
                      <span>Resonance</span>
                      <strong>{resonance.name}</strong>
                      <p>{resonance.description}</p>
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
                      <span>Essence</span>
                      <strong>{essence.name}</strong>
                      <p>{essence.description}</p>
                    </div>
                  </article>
                ) : null}

                {!anomaly ? (
                  <article className={styles.lockedAttunement} data-disabled="true">
                    <div className={styles.mediaTile} data-arsenal-media="true">
                      <span aria-hidden="true">⌑</span>
                    </div>
                    <div>
                      <span>{resonance ? 'Essence' : 'Resonance'} · Anomaly only</span>
                      <strong>Locked</strong>
                      <p>Only an owner-granted anomaly may open both attunement paths.</p>
                    </div>
                  </article>
                ) : null}

                {!resonance && !essence ? (
                  <p className={styles.emptyAttunement}>
                    No authored Resonance or Essence is available for this build yet.
                  </p>
                ) : null}
              </div>
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
              <p>Equipment and gear management will live here in a future update.</p>
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
              <button type="button" disabled>
                Items Coming Soon
              </button>
            </section>
          </div>
        </Surface>
      </div>
    </AuthenticatedShellFrame>
  )
}
