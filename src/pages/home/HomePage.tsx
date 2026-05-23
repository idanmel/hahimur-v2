import Nav from '../../Nav'

export default function HomePage() {
  return (
    <>
      <header className="poster-header">
        <div className="poster-bar poster-bar--top" />
        <div className="poster-center">
          <p className="poster-overline">גביע העולם FIFA</p>
          <div className="poster-mundial">MUNDIAL <span className="poster-year">2026</span></div>
          <h1 className="poster-subtitle">ההימור 2026</h1>
        </div>
        <div className="poster-bar poster-bar--bottom" />
      </header>
      <Nav />

      <main dir="rtl" style={{ textAlign: 'center', paddingTop: '4rem', fontSize: '1.5rem' }}>
        מחכים למסר מהליכטטור
      </main>
    </>
  )
}
