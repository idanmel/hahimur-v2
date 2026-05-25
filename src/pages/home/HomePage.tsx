import Nav from '../../Nav'
import Countdown from '../../shared/Countdown'

const FIRST_MATCH = new Date('2026-06-11T00:00:00')

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
      <Countdown targetDate={FIRST_MATCH} label="לשריקת הפתיחה" />

      <main dir="rtl" style={{ maxWidth: '700px', margin: '0 auto', padding: '3rem 1.5rem', fontSize: '1.1rem', lineHeight: '1.9' }}>
        <p>ברוכים הבאים להימור המסורתי שלנו!</p>
        <p>
          לרגל חגיגות ה-22 שנים (!) לטורניר שלנו אנו בפתחו של ההימור ה-12 - שצפוי להיות ההימור התחרותי ביותר.
          ריבוי המשחקים, מיעוט הפייבורטיות ושיטות הצלבה קשוחות גורמות לכך שלהערכתי יהיה קשה מאוד למישהו להוליך
          באופן בולט ואני צופה שיהיה לנו מתח בין הרבה מאוד מתמודדים עד השלבים האחרונים.
        </p>
        <p>
          לא פחות מ-29 אנשים הצליחו להגיע בעבר לתואר הפודיום ולהרגיש את טעם ההצלחה לפחות באחד הטורנירים.
          מצד שני יש מספר מתמודדים שאיתנו כבר הרבה מאוד שנים כמו אדם, אורן, אגפים ומלמד אשר כולי תקווה
          שיזכו השנה לרוץ בצמרת ולהרגיש את המתח עד הרגעים האחרונים!
        </p>
        <p>
          מאחל לכולם טורניר מוצלח — והלוואי וההימור שלנו יגרום לרגעי שמחה, מתח, תחרות ובעיקר יציל את
          המונדיאל שפיפ"א מנסה בכל הכח להרוס.
        </p>

        <div className="scoring-section">
          <p className="scoring-section__title">שיטת הניקוד</p>
          <p className="scoring-section__legend">
            <strong>פגיעה</strong> — תוצאה נכונה &nbsp;·&nbsp;
            <strong>צליפה</strong> — תוצאה מדויקת &nbsp;·&nbsp;
            <strong>עולה</strong> — ניחוש נכון של קידום קבוצה
          </p>
          <div className="scoring-table-wrapper">
            <table className="scoring-table">
              <thead>
                <tr>
                  <th>שלב</th>
                  <th>פגיעה</th>
                  <th>צליפה</th>
                  <th className="col-advance">עולה</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { stage: 'שלב הבתים', hit: 2, exact: 4, advance: 5 },
                  { stage: 'שלב ה-32', hit: 5, exact: 7, advance: 5 },
                  { stage: 'שמינית הגמר', hit: 6, exact: 8, advance: 8 },
                  { stage: 'רבע הגמר', hit: 8, exact: 12, advance: 12 },
                  { stage: 'חצי הגמר', hit: 12, exact: 16, advance: 16 },
                  { stage: 'מקום שלישי', hit: 16, exact: 18, advance: 20 },
                  { stage: 'גמר', hit: 20, exact: 25, advance: 25 },
                ].map((row) => (
                  <tr key={row.stage}>
                    <td>{row.stage}</td>
                    <td>{row.hit}</td>
                    <td>{row.exact}</td>
                    <td className="col-advance">{row.advance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="scoring-section__goalscorer">
            <strong>מלך שערים:</strong> כל שער של השחקן שניחשת — 3 נקודות. זכה בנעל הזהב — בונוס 10 נקודות.
          </div>
        </div>
      </main>
    </>
  )
}
