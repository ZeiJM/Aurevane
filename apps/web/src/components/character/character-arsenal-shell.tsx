import Image from 'next/image'
import { BattleInfoPopover } from '@/components/battle/battle-info-popover'
import { renderBattleFlavorTemplate } from '@aurevane/game-core/combat/battle-narration'
import { DEFAULT_SUPPORT_ACTION_ID } from '@aurevane/game-core/combat/support-actions'
import { pv1fSkillByActionId } from '@aurevane/game-core/combat/pv1f-skills'
import type { EssenceDefinition } from '@aurevane/game-core/combat/essence'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import type { AnyResonanceDefinition } from '@aurevane/game-core/combat/resonance'
import { Surface } from '@aurevane/ui'

import {
  battleResonanceArtwork,
  battleSkillArtwork,
} from '@/components/battle/battle-skill-presentation'
import { CharacterDisciplineBuildPanel } from '@/components/character/character-discipline-build-panel'
import { type CharacterWorkspaceProps } from '@/components/character/character-profile-shell'
import { CharacterSkillBuildPanel } from '@/components/character/character-skill-build-panel'
import { FoundationDisciplineSigil } from '@/components/character/foundation-discipline-sigil'
import { LoadoutHeader } from '@/components/character/loadout-header'

import { skillDisplayName } from './skill-detail-presentation'
import { ResonanceParameters } from './resonance-parameters'
import { SkillParameters } from './skill-parameters'
import styles from './character-arsenal-shell.module.css'

const OVERVIEW_TECHNIQUE_SLOTS = 4

function EssenceHoverPreview({ essence }: { essence: EssenceDefinition }) {
  const skill = essence.skill
  return (
    <BattleInfoPopover
      label={`Preview Essence: ${essence.name}`}
      title={`Essence: ${essence.name}`}
      className={styles.attunementPreviewAnchor}
      hover
      trigger={
        <span className={styles.attunementArt} data-gameplay-art="attunement">
          <Image src={battleSkillArtwork(skill.id)} width={160} height={160} unoptimized alt="" />
        </span>
      }
    >
      <aside id={`essence-preview-${essence.essenceId}`} role="tooltip">
        <dl>
          <SkillParameters skill={skill} />
        </dl>
      </aside>
    </BattleInfoPopover>
  )
}

function ResonanceHoverPreview({ resonance }: { resonance: AnyResonanceDefinition }) {
  return (
    <BattleInfoPopover
      label={`Preview Resonance: ${resonance.name}`}
      title={`Resonance: ${resonance.name}`}
      className={styles.attunementPreviewAnchor}
      hover
      trigger={
        <span className={styles.attunementArt} data-gameplay-art="attunement">
          <Image
            src={battleResonanceArtwork(resonance.id)}
            width={160}
            height={160}
            unoptimized
            alt=""
          />
        </span>
      }
    >
      <aside id={`resonance-preview-${resonance.id}`} role="tooltip">
        <ResonanceParameters definition={resonance} />
      </aside>
    </BattleInfoPopover>
  )
}

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
                  width={160}
                  height={160}
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
      <span className={styles.attunementArt} data-gameplay-art="attunement" aria-hidden="true">
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
  const supportActionId = disciplineBuild.supportActionId ?? DEFAULT_SUPPORT_ACTION_ID
  const supportAction = pv1fSkillByActionId(supportActionId)!
  const equipped = [...disciplineBuild.disciplineSkills.equippedSkills].sort(
    (left, right) => left.slotIndex - right.slotIndex,
  )
  return (
    <div
      className={styles.layout}
      data-arsenal-workspace
      data-character-concept="nexus"
      data-composition="correction"
    >
      <Surface className={styles.arsenal} tone="elevated" data-arsenal-sheet="true">
        <LoadoutHeader active="nexus" />

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
          </header>

          <div className={styles.disciplinePair}>
            <article className={styles.disciplineCard} data-slot="primary">
              <span className={styles.disciplineSigil}>
                <FoundationDisciplineSigil disciplineId={disciplineBuild.current.definition.id} />
              </span>
              <div>
                <span>Primary Discipline</span>
                <strong data-testid="primary-discipline-chip">
                  {disciplineBuild.current.definition.name}
                </strong>
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
                  <strong data-testid="secondary-discipline-chip">
                    {disciplineBuild.currentSecondary.name}
                  </strong>
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
            key={profile.characterId}
            characterId={profile.characterId}
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
          <div className={styles.techniqueSummary}>
            <div className={styles.techniqueLanes}>
              <header className={styles.sectionHeading}>
                <div>
                  <span>✦</span>
                  <h2 id="nexus-techniques-heading">
                    Discipline Skills — {equipped.length} /{' '}
                    {disciplineBuild.disciplineSkills.capacity}
                  </h2>
                </div>
              </header>
              <TechniqueLane
                kind="primary"
                discipline={{
                  id: disciplineBuild.current.definition.id,
                  name: `Discipline Skills — ${equipped.length} / ${disciplineBuild.disciplineSkills.capacity}`,
                }}
                skills={equipped.map((entry) => entry.definition)}
              />
            </div>

            <div className={styles.supportSummary} data-testid="nexus-support-action">
              <header className={styles.sectionHeading}>
                <h2>Support Action</h2>
              </header>
              <span className={styles.overviewTechniqueArt} data-arsenal-media="true">
                <Image
                  src={battleSkillArtwork(supportActionId)}
                  width={160}
                  height={160}
                  unoptimized
                  alt=""
                />
              </span>
              <div>
                <strong>{supportAction.name}</strong>
              </div>
            </div>
          </div>

          <CharacterSkillBuildPanel
            key={skillBuildKey}
            characterId={attributeAllocation.characterId}
            initialBuildVersion={disciplineBuild.buildVersion}
            initialSupportActionId={supportActionId}
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
            </header>

            <div className={styles.attunementGrid}>
              {essence ? (
                <article className={styles.attunementCard} data-active="true">
                  <EssenceHoverPreview essence={essence} />
                  <div>
                    <div className={styles.attunementIdentity}>
                      <strong>{`Essence: ${essence.name}`}</strong>
                      <b>● Active</b>
                    </div>
                    <p>
                      {renderBattleFlavorTemplate(essence.flavorLine, { ability: essence.name }) ??
                        essence.description}
                    </p>
                  </div>
                </article>
              ) : (
                <LockedAttunementCard label="Essence" />
              )}

              {resonance ? (
                <article className={styles.attunementCard} data-active="true">
                  <ResonanceHoverPreview resonance={resonance} />
                  <div>
                    <div className={styles.attunementIdentity}>
                      <strong>{`Resonance: ${resonance.name}`}</strong>
                      <b>● Active</b>
                    </div>
                    <p>
                      {renderBattleFlavorTemplate(resonance.flavorLine, {
                        ability: resonance.name,
                      }) ?? resonance.description}
                    </p>
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
                <h2 id="nexus-power-heading">Ascension / Severance</h2>
              </div>
            </header>

            <div className={styles.powerGrid}>
              <article className={styles.futurePowerCard} data-power="ascension">
                <span className={styles.powerGlyph} data-gameplay-art="power" aria-hidden="true">
                  <Image
                    src="/media/art/nexus/nexus-ascension-default-v01.webp"
                    width={160}
                    height={160}
                    unoptimized
                    alt=""
                  />
                </span>
                <div>
                  <strong>Ascension</strong>
                  <b>▣ Coming Soon</b>
                </div>
              </article>
              <article className={styles.futurePowerCard} data-power="severed">
                <span className={styles.powerGlyph} data-gameplay-art="power" aria-hidden="true">
                  <Image
                    src="/media/art/nexus/nexus-severed-default-v01.webp"
                    width={160}
                    height={160}
                    unoptimized
                    alt=""
                  />
                </span>
                <div>
                  <strong>Severance</strong>
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
