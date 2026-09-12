import type { Route } from 'next'
import Link from 'next/link'

import {
  DISCIPLINE_ATLAS,
  describeDisciplineUnlockRule,
  type DisciplineAtlasBand,
  type DisciplineAtlasEntry,
} from '@aurevane/game-core/character/discipline-atlas'

import { FoundationDisciplineSigil } from '@/components/character/foundation-discipline-sigil'

import styles from './discipline-atlas-guide.module.css'

const BAND_ORDER: readonly DisciplineAtlasBand[] = [
  'foundation',
  'first-journey',
  'rekindling-1',
  'rekindling-2',
  'rekindling-3',
]

const BAND_COPY: Readonly<
  Record<DisciplineAtlasBand, { title: string; eyebrow: string; description: string }>
> = {
  foundation: {
    title: 'The six Foundations',
    eyebrow: 'Where every path can begin',
    description:
      'These are complete endgame-capable combat traditions, not temporary beginner jobs. Their edge is dependable action economy, readable plans and broad compatibility with the rest of the roster.',
  },
  'first-journey': {
    title: 'Branches of the first journey',
    eyebrow: 'Mastery opens new schools',
    description:
      'Most of AUREVANE’s roster can be discovered before the first Rekindling. These traditions ask for proven familiarity with one or more earlier Disciplines rather than a higher character level alone.',
  },
  'rekindling-1': {
    title: 'Veteran traditions',
    eyebrow: 'After Rekindling I',
    description:
      'The first Rekindling begins to open Disciplines whose rules assume a player already understands AUREVANE’s basic combat language. They are more demanding, not simply numerically stronger.',
  },
  'rekindling-2': {
    title: 'Deep-horizon study',
    eyebrow: 'After Rekindling II',
    description:
      'Very late traditions may require both a long character history and unusual discoveries. Their unlocks are meant to feel like conclusions to years of study, not items in a shop.',
  },
  'rekindling-3': {
    title: 'Apex study',
    eyebrow: 'After Rekindling III',
    description:
      'The third Rekindling is the last planned Discipline gate. Further Rekindlings can still expand Veteran Edge, prestige and personal history without adding another vertical class tier.',
  },
}

function publicPath(discipline: DisciplineAtlasEntry): string {
  if (discipline.disclosure === 'secret') {
    const rekindling =
      discipline.band === 'rekindling-1'
        ? 'Rekindling I + '
        : discipline.band === 'rekindling-2'
          ? 'Rekindling II + '
          : discipline.band === 'rekindling-3'
            ? 'Rekindling III + '
            : ''
    return `${rekindling}mastery prerequisites + a hidden discovery path`
  }
  return describeDisciplineUnlockRule(discipline.unlock)
}

function BudgetDots({ value }: { value: number }) {
  return (
    <span className={styles.dots} aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <i data-filled={index < value ? 'true' : 'false'} key={index} />
      ))}
    </span>
  )
}

function DisciplineCard({ discipline }: { discipline: DisciplineAtlasEntry }) {
  return (
    <article
      className={styles.disciplineCard}
      data-family={discipline.family}
      data-secret={discipline.disclosure === 'secret' ? 'true' : 'false'}
    >
      <header>
        <span className={styles.sigil} aria-hidden="true">
          <FoundationDisciplineSigil disciplineId={discipline.id} />
        </span>
        <div>
          <span className={styles.family}>{discipline.family}</span>
          <h3>{discipline.name}</h3>
        </div>
        {discipline.disclosure === 'secret' ? <em>Veiled path</em> : null}
      </header>
      <p>{discipline.summary}</p>
      <dl className={styles.cardMeta}>
        <div>
          <dt>Path</dt>
          <dd>{publicPath(discipline)}</dd>
        </div>
        <div>
          <dt>Content</dt>
          <dd>{discipline.publication === 'published' ? 'Playable in the current test' : 'Planned'}</dd>
        </div>
        {discipline.masteryRite ? (
          <div>
            <dt>Mastery Rite</dt>
            <dd>{discipline.masteryRite}</dd>
          </div>
        ) : null}
      </dl>
      <div className={styles.identityBudget} aria-label={`${discipline.name} identity profile`}>
        <span>
          Reliability <BudgetDots value={discipline.power.reliability} />
        </span>
        <span>
          Flexibility <BudgetDots value={discipline.power.flexibility} />
        </span>
        <span>
          Setup <BudgetDots value={discipline.power.setup} />
        </span>
        <span>
          Rule access <BudgetDots value={discipline.power.ruleAccess} />
        </span>
        <span>
          Execution <BudgetDots value={discipline.power.execution} />
        </span>
      </div>
    </article>
  )
}

export function DisciplineAtlasGuide() {
  const published = DISCIPLINE_ATLAS.filter((discipline) => discipline.publication === 'published')
  const secret = DISCIPLINE_ATLAS.filter((discipline) => discipline.disclosure === 'secret')

  return (
    <article className={styles.guide}>
      <Link className={styles.back} href={'/manual' as Route}>
        ← Adventurer’s Guide
      </Link>

      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Character · Disciplines</span>
          <h1>The Discipline Atlas</h1>
          <p>
            AUREVANE does not ask you to pick one class and live with it forever. You begin with a
            Foundation, learn how it thinks, master other traditions, mix them through Resonance or
            remain pure for Essence, and gradually uncover a much larger map of combat ideas.
          </p>
        </div>
        <aside>
          <span aria-hidden="true">◇</span>
          <strong>36 planned traditions</strong>
          <p>
            {published.length} are currently published for Phase-4 testing. {secret.length} of the
            long-term roster use veiled discovery paths rather than a normal visible checklist.
          </p>
        </aside>
      </header>

      <section className={styles.principle}>
        <span className={styles.eyebrow}>The important part</span>
        <h2>This is a map of knowledge, not a ladder of replacements.</h2>
        <div className={styles.principleGrid}>
          <div>
            <strong>Vanguard does not become Bastion.</strong>
            <p>
              Studying Vanguard can reveal Bastion, but Vanguard remains its own complete tradition
              with different strengths, Essence choices and Resonance partners.
            </p>
          </div>
          <div>
            <strong>Late does not mean strictly stronger.</strong>
            <p>
              Advanced Disciplines spend more of their budget on unusual rules, setup and execution.
              Foundations spend more on reliability and clean turns. Both belong at endgame.
            </p>
          </div>
          <div>
            <strong>Your history changes the map.</strong>
            <p>
              Mastery, Rekindling, authored rites and discoveries can all reveal paths. Some secret
              traditions are not meant to announce themselves in a creation menu.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.masterySection}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>Mastery</span>
            <h2>Experience is necessary. Proof matters too.</h2>
          </div>
          <p>
            Mastery measures understanding of a combat tradition. Character Level measures the
            character as a whole; the two systems deliberately do different jobs.
          </p>
        </div>

        <div className={styles.masteryTrack}>
          <div>
            <span>0 XP</span>
            <strong>Initiate</strong>
            <p>Learn the basic language of the Discipline.</p>
          </div>
          <div>
            <span>100 XP</span>
            <strong>Practiced</strong>
            <p>Demonstrate normal tools instead of merely having them equipped.</p>
          </div>
          <div>
            <span>300 XP</span>
            <strong>Adept</strong>
            <p>Show the Discipline’s core principle under a real objective.</p>
          </div>
          <div>
            <span>600 XP</span>
            <strong>Expert</strong>
            <p>Adapt when the obvious game plan is deliberately disrupted.</p>
          </div>
          <div>
            <span>1,000 XP</span>
            <strong>Master</strong>
            <p>Complete the full Technique record and the tradition’s final Mastery Rite.</p>
          </div>
        </div>

        <div className={styles.noteGrid}>
          <div>
            <h3>Eight learned Techniques, four selected</h3>
            <p>
              A mature Discipline teaches eight regular Techniques. Your battle build selects up to
              four at a time. Advanced libraries currently teach four at Initiate, two more at
              Practiced and two more at Adept so the later Mastery journey is about using the toolbox,
              not waiting months to receive it.
            </p>
          </div>
          <div>
            <h3>Master is not “+20% damage”</h3>
            <p>
              Mastery opens Secondary eligibility, Atlas branches, rites, recognition and future
              progression. It should not turn partially mastered players into numerically invalid
              characters.
            </p>
          </div>
          <div>
            <h3>Passive study has a ceiling</h3>
            <p>
              A future Discipline Focus may contribute bounded numerical practice, but it cannot
              demonstrate Techniques, clear trials or create a Master while the player never uses the
              Discipline.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.budgetSection}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>Class budget</span>
            <h2>More difficult classes receive different tools, not a bigger budget.</h2>
          </div>
          <p>
            The five marks shown on Atlas cards are an identity profile, not a tier list. A fifth mark
            in Rule Access means the class breaks or bends more normal combat assumptions; it does not
            mean “five-star strength.”
          </p>
        </div>
        <div className={styles.budgetExamples}>
          <article>
            <span>Foundation example</span>
            <h3>Vanguard</h3>
            <strong>Reliable answers, low setup.</strong>
            <p>
              Good positioning and action efficiency are valuable in almost every fight. Its strength
              is that it asks fewer conditions before doing useful work.
            </p>
          </article>
          <article>
            <span>Advanced example</span>
            <h3>Chronist</h3>
            <strong>More rules, more ways to misplay.</strong>
            <p>
              Initiative manipulation can create exceptional turns, but it requires planning and does
              not simply add a larger damage coefficient to Aetherist spells.
            </p>
          </article>
          <article>
            <span>Apex example</span>
            <h3>Spellwright</h3>
            <strong>Metamagic instead of bigger fireballs.</strong>
            <p>
              Its prize is the ability to manipulate spell structure. The price is setup, execution
              and dependence on understanding several magical traditions first.
            </p>
          </article>
        </div>
      </section>

      <section className={styles.testingSection}>
        <span className={styles.eyebrow}>Phase-4 testing rule</span>
        <h2>The doors are open while we build.</h2>
        <p>
          During development, every <strong>published</strong> Discipline remains available for
          testing even when your character has not yet satisfied its eventual release prerequisites.
          That convenience is a testing entitlement, not earned Mastery. Planned Disciplines do not
          become selectable until their Skills, Essence, Resonances and authoritative combat content
          actually exist.
        </p>
        <p>
          When AUREVANE reaches the point where normal acquisition is enabled, the testing overlay can
          be turned off and the same Atlas requirements become the real gates. Test access is kept
          separate from earned Mastery so months of development do not accidentally pre-master every
          launch character.
        </p>
      </section>

      {BAND_ORDER.map((band) => {
        const copy = BAND_COPY[band]
        const entries = DISCIPLINE_ATLAS.filter((discipline) => discipline.band === band)
        return (
          <section className={styles.atlasBand} key={band}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.eyebrow}>{copy.eyebrow}</span>
                <h2>{copy.title}</h2>
              </div>
              <p>{copy.description}</p>
            </div>
            <div className={styles.disciplineGrid}>
              {entries.map((discipline) => (
                <DisciplineCard discipline={discipline} key={discipline.id} />
              ))}
            </div>
          </section>
        )
      })}

      <section className={styles.rekindlingSection}>
        <span className={styles.eyebrow}>Rekindling &amp; memory</span>
        <h2>You may rebuild. Your history does not disappear.</h2>
        <p>
          Rekindling is meant to change the journey, not erase it. Historical Mastery belongs in the
          character’s long-term record even when a later cycle asks them to rebuild current-cycle
          proficiency. Veteran Echo Routes can replace repeated beginner lessons with shorter, harder
          examinations for traditions the character has already mastered before.
        </p>
        <p>
          Breadth and depth are both legitimate identities. A character who masters many Disciplines
          gains more build paths; a lifelong Vanguard specialist should still earn meaningful
          Vanguard-specific achievements, Essence accomplishments and prestige without being forced to
          collect every class for raw stats.
        </p>
      </section>
    </article>
  )
}
