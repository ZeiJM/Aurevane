import { foundationStatus } from '@/lib/foundation'

export default function Home() {
  return (
    <main className="foundation-page">
      <section className="foundation-panel" aria-labelledby="aurevane-title">
        <p className="eyebrow">AUREVANE // DEVELOPMENT BUILD</p>
        <h1 id="aurevane-title">AUREVANE</h1>
        <p className="tagline">Persistent tactical fantasy. Built deliberately.</p>

        <div className="status-card">
          <span className="status-dot" aria-hidden="true" />
          <div>
            <strong>{foundationStatus.label}</strong>
            <p>{foundationStatus.message}</p>
          </div>
        </div>

        <div className="foundation-meta" aria-label="Build status">
          <span>{foundationStatus.phase}</span>
          <span>{foundationStatus.ticket}</span>
          <span>Server-authoritative architecture</span>
        </div>
      </section>
    </main>
  )
}
