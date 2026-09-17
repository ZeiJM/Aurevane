import { AurevaneImage } from '@/components/media/aurevane-image'
import { rulesDocument } from '@/content/public-information'

import styles from './rules-codex.module.css'

export function RulesCodex() {
  return (
    <article className={styles.rules} data-testid="rules-page" data-rules-surface="ink">
      <header className={styles.intro}>
        <div className={styles.introCopy}>
          <span className={styles.eyebrow}>Fair play &amp; conduct</span>
          <h1>Rules</h1>
          <p className={styles.lede}>
            Current public expectations for account security, game integrity, exploit handling, and
            identity conduct. These are game rules, not a substitute for future legal terms or
            privacy notices.
          </p>

          <dl className={styles.meta}>
            <div>
              <dt>Version</dt>
              <dd>{rulesDocument.version}</dd>
            </div>
            <div>
              <dt>Effective scope</dt>
              <dd>{rulesDocument.effectiveLabel}</dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>{rulesDocument.lastUpdated}</dd>
            </div>
          </dl>
        </div>

        <div className={styles.heroMedia} data-testid="rules-hero-media">
          <AurevaneImage
            assetId="environment.archive.interior"
            className={styles.heroImage}
            sizes="(max-width: 768px) 100vw, 48rem"
          />
          <span className={styles.heroVeil} aria-hidden="true" />
          <div className={styles.heroStatement}>
            <strong>Stable rules, honest scope.</strong>
            <p>
              No speculative marketplace, ranked-PvP, guild, tournament, or mature social policy is
              silently treated as active before those systems exist.
            </p>
          </div>
        </div>
      </header>

      <section className={styles.principles} aria-labelledby="rules-principles-title">
        <header>
          <span className={styles.eyebrow}>Quick principles</span>
          <h2 id="rules-principles-title">The current foundation</h2>
        </header>
        <ul>
          {rulesDocument.principles.map((principle) => (
            <li key={principle}>{principle}</li>
          ))}
        </ul>
      </section>

      <div className={styles.workspace}>
        <nav className={styles.nav} data-testid="rules-section-nav" aria-label="Rules sections">
          <span className={styles.navLabel}>Rules</span>
          {rulesDocument.sections.map((section, index) => (
            <a href={`#${section.id}`} key={section.id}>
              <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <strong>{section.title}</strong>
            </a>
          ))}
        </nav>

        <div className={styles.content} data-testid="rules-content">
          {rulesDocument.sections.map((section, index) => (
            <section
              className={styles.ruleSection}
              data-testid="rules-section"
              id={section.id}
              key={section.id}
            >
              <header className={styles.ruleHeader}>
                <span className={styles.ruleNumber} aria-hidden="true">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                </span>
                <div>
                  <h2>{section.title}</h2>
                  <p>{section.summary}</p>
                </div>
              </header>

              <div className={styles.ruleBody}>
                {section.body.map((block) => (
                  <div className={styles.bodyBlock} id={block.id} key={block.id}>
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
              </div>
            </section>
          ))}
        </div>
      </div>
    </article>
  )
}
