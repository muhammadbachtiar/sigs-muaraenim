export default function PetaPublikPage() {
  return (
    <div
      style={{
        height: 'calc(100vh - 53px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-canvas-soft)',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--color-ink)',
            letterSpacing: '-0.5px',
          }}
        >
          Peta Sinyal Publik
        </h1>
        <p
          style={{
            fontSize: '0.9375rem',
            color: 'var(--color-ink-muted)',
            marginTop: 'var(--space-xs)',
          }}
        >
          Komponen Leaflet Map akan ditampilkan di sini
        </p>
      </div>
    </div>
  )
}
