import type { Metadata } from 'next'

import { PublicInformationShell } from '@/components/public-information/public-information-shell'
import styles from '@/components/public-information/public-information-shell.module.css'
import { currentRulesDocument } from '@/content/current-rules'

export const metadata: Metadata = {
  title: 'Rules | AUREVANE',
  description: 'Current AUREVANE fair-play, account-security, and conduct rules.',
}

export default function RulesPage() {
  return (
    <PublicInformationShell active="rules">
      <section className={styles.hero} aria-labelledby="rules-title">
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>Fair play & conduct</span>
          <h1 id="rules-title">Rules</h1>
          <p>
            Current public expectations for account security, game integrity, exploit handling, and
            identity conduct. These are game rules, not a substitute for future legal terms or
            privacy notices.
          </p>
          <dl className={styles.articleMeta}>
            <div>
              <dt>Version</dt>
              <dd>{currentRulesDocument.version}</dd>
            </div>
            <div>
              <dt>Effective scope</dt>
              <dd>{currentRulesDocument.effectiveLabel}</dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>{currentRulesDocument.lastUpdated}</dd>
            </div>
          </dl>
        </div>
        <aside className={styles.heroPanel} aria-label="Rules publication boundary">
          <span className={styles.heroGlyph} aria-hidden="true">
            ◈
          </span>
          <strong>Stable rules, honest scope.</strong>
          <p>
            Direct private PvP and spectation are current Phase 2 test features. Ranked,
            marketplace, guild, tournament, and mature social policy is published only when those
            systems become real.
          </p>
        </aside>
      </section>

      <section className={styles.section} aria-labelledby="quick-principles-title">
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.eyebrow}>Quick principles</span>
            <h2 id="quick-principles-title">The current foundation</h2>
          </div>
        </div>
        <ul className={styles.principles}>
          {currentRulesDocument.principles.map((principle) => (
            <li key={principle}>{principle}</li>
          ))}
        </ul>
      </section>

      <div className={styles.rulesLayout}>
        <nav className={styles.rulesNav} aria-label="Rules sections">
          {currentRulesDocument.sections.map((section) => (
            <a href={`#${section.id}`} key={section.id}>
              {section.title}
            </a>
          ))}
        </nav>

        <div className={styles.ruleStack}>
          {currentRulesDocument.sections.map((section) => (
            <section className={styles.ruleSection} id={section.id} key={section.id}>
              <span className={styles.eyebrow}>Rule section</span>
              <h2>{section.title}</h2>
              <p>{section.summary}</p>
              {section.body.map((block) => (
                <div className={styles.articleSection} id={block.id} key={block.id}>
                  {block.title ? <h3>{block.title}</h3> : null}
                  {block.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  {block.bullets ? (
                    <ul>
                      {block.bullets.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </PublicInformationShell>
  )
}
