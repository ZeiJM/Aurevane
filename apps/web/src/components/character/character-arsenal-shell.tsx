import Image from 'next/image'
import type { EssenceDefinition } from '@aurevane/game-core/combat/essence'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import type { ResonanceDefinition } from '@aurevane/game-core/combat/resonance'
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

import {
  skillCompactRangeDescription,
  skillCooldownDescription,
  skillCostDescription,
  skillDisplayName,
  skillEffectSummaries,
  skillRequirementsSummary,
  skillTargetDescription,
  skillTargetMethodDescription,
  skillTypeDescription,
} from './skill-detail-presentation'
import { effectSummary, previewEffect } from './skill-effect-preview'
import styles from './character-arsenal-shell.module.css'

const OVERVIEW_TECHNIQUE_SLOTS = 4

function effectSummaryWithDuration(
  effect: Parameters<typeof previewEffect>[0],
): string {
  const base = effectSummary(previewEffect(effect))
  const turns = effect.durationTurns ?? 0
  return turns > 0 ? `${base} [${turns} ${turns === 1 ? 'Turn' : 'Turns'}]` : base
}

function EssenceHoverPreview({ essence }: { essence: EssenceDefinition }) {
  const skill = essence.skill
  const rows: readonly (readonly [string, string | readonly string[]])[] = [
    ['Skill Type', skillTypeDescription(skill)],
    ['Cost', skillCostDescription(skill)],
    ['Cooldown', skillCooldownDescription(skill)],
    ['Requirements', skillRequirementsSummary(skill)],
    ['Effects', skillEffectSummaries(skill)],
    ['Range', skillCompactRangeDescription(skill)],
    ['Target', skillTargetDescription(skill)],
    ['Target Method', skillTargetMethodDescription(skill)],
  ]
  return (
    <aside className={styles.attunementHover} role="tooltip">
      <span>Essence Preview</span>
      <strong>{`Essence: ${essence.name}`}</strong>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              {typeof value === 'string' ? (
                value
              ) : (
                <ul>
                  {value.map((entry, index) => (
                    <li key={`${index}:${entry}`}>{entry}</li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  )
}

function ResonanceHoverPreview({
  resonance,
}: {
  resonance: ResonanceDefinition
}) {
  const setup = resonance.trigger.setup
  const payoff = resonance.trigger.payoff
  const effects = resonance.trigger.payoffEffects.map(effectSummaryWithDuration)
  return (
    <aside className={styles.attunementHover} role="tooltip">
      <span>Resonance Preview</span>
      <strong>{`Resonance: ${resonance.name}`}</strong>
      <dl>
        <div>
          <dt>Type</dt>
          <dd>Resonance</dd>
        </div>
        <div>
          <dt>Requirements</dt>
          <dd>
            <ul>
              <li>{`Setup: ${setup.sourceDisciplineId} · ${setup.requiredTags.join(' + ')}`}</li>
              <li>{`Payoff: ${payoff.sourceDisciplineId} · ${payoff.requiredTags.join(' + ')}`}</li>
            </ul>
          </dd>
        </div>
        <div>
          <dt>Effects</dt>
          <dd>
            <ul>
              {effects.map((entry, index) => (
                <li key={`${index}:${entry}`}>{entry}</li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
    </aside>
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
            </header>

            <div className={styles.attunementGrid}>
              {essence ? (
                <article className={styles.attunementCard} data-active="true">
                  <span className={styles.attunementPreviewAnchor} tabIndex={0}>
                    <span className={styles.attunementArt}>
                      <Image
                        src={battleSkillArtwork(essence.skill.id)}
                        width={64}
                        height={64}
                        unoptimized
                        alt=""
                      />
                    </span>
                    <EssenceHoverPreview essence={essence} />
                  </span>
                  <div>
                    <strong>{`Essence: ${essence.name}`}</strong>
                    <p>{essence.description}</p>
                    <b>● Active</b>
                  </div>
                </article>
              ) : (
                <LockedAttunementCard label="Essence" />
              )}

              {resonance ? (
                <article className={styles.attunementCard} data-active="true">
                  <span className={styles.attunementPreviewAnchor} tabIndex={0}>
                    <span className={styles.attunementArt}>
                      <Image
                        src={battleResonanceArtwork(resonance.id)}
                        width={64}
                        height={64}
                        unoptimized
                        alt=""
                      />
                    </span>
                    <ResonanceHoverPreview resonance={resonance} />
                  </span>
                  <div>
                    <strong>{`Resonance: ${resonance.name}`}</strong>
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
                <h2 id="nexus-power-heading">Ascension / Severance</h2>
              </div>
            </header>

            <div className={styles.powerGrid}>
              <article className={styles.futurePowerCard} data-power="ascension">
                <span className={styles.powerGlyph} aria-hidden="true">
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
                <span className={styles.powerGlyph} aria-hidden="true">
                  <Image
                    src="/media/art/nexus/nexus-severed-default-v01.webp"
                    width={160}
                    height={160}
                    unoptimized
                    alt=""
                  />
                </span>
                <div>
                  <strong>Severed</strong>
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
