export default function BattleLoading() {
  return (
    <main
      aria-live="polite"
      aria-busy="true"
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: '2rem',
        background:
          'radial-gradient(circle at 50% 18%, rgba(86, 69, 43, 0.24), transparent 38%), #05070a',
        color: '#e6dfd0',
      }}
    >
      <section
        style={{
          width: 'min(32rem, 100%)',
          padding: '1.5rem',
          border: '1px solid rgba(184, 177, 163, 0.22)',
          borderRadius: '0.85rem',
          background: 'rgba(9, 12, 17, 0.9)',
          boxShadow: '0 1.5rem 4rem rgba(0, 0, 0, 0.45)',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            margin: '0 0 0.45rem',
            color: '#c7a95d',
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          Battle Hall
        </p>
        <h1 style={{ margin: 0, fontSize: 'clamp(1.8rem, 5vw, 2.8rem)', fontWeight: 500 }}>
          Entering battle…
        </h1>
        <p style={{ margin: '0.65rem 0 0', color: '#9fa5ad', lineHeight: 1.5 }}>
          Synchronizing the authoritative battle state and committed build.
        </p>
      </section>
    </main>
  )
}
