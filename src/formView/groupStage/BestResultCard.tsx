import { useId, useState } from 'react'
import { TEAMS } from '../../shared/groups'
import type { BestResult } from '../../leaderboard/bestResult'
import './BestResultCard.css'

const he = (team: string) => TEAMS[team]?.he ?? team

export default function BestResultCard({ result }: { result: BestResult }) {
  const [showPoints, setShowPoints] = useState(false)
  const panelId = useId()
  const cleanSlots = result.slots.filter(s => s.clean)

  return (
    <div className="best-result">
      <div className="best-result__head">
        <span className="best-result__title">הכי טוב בשבילך</span>
        <button
          type="button"
          className="best-result__sub best-result__sub--toggle"
          onClick={() => setShowPoints(v => !v)}
          aria-expanded={showPoints}
          aria-controls={panelId}
        >
          {result.groupPoints} נק׳ בבית
          <span className="best-result__caret" aria-hidden>{showPoints ? '▴' : '▾'}</span>
        </button>
      </div>

      {showPoints && (
        <div className="best-result__points" id={panelId}>
          <div className="best-result__points-group">
            <div className="best-result__points-cat">
              <span className="best-result__points-name">נקודות פוטנציאליות מהניחוש</span>
              <span className="best-result__points-val">{result.matchPoints} נק׳</span>
            </div>
            <p className="best-result__points-note">פגיעה/צליפה על תוצאות המשחקים — תלוי בתוצאה המדויקת, אז הכי פחות בטוח.</p>
          </div>

          <div className="best-result__points-group">
            <div className="best-result__points-cat">
              <span className="best-result__points-name">נקודות בטוחות מסידור הבית</span>
              <span className="best-result__points-val">{result.placePoints + result.advancementPoints} נק׳</span>
            </div>

            <div className="best-result__points-sub">מיקום מדויק <span className="best-result__points-each">· {result.placePoints} נק׳</span></div>
            {cleanSlots.length > 0 ? (
              <ul className="best-result__points-list">
                {cleanSlots.map(s => (
                  <li key={s.position}>{he(s.team)} — מקום {s.position + 1} <span className="best-result__points-each">· 1 נק׳</span></li>
                ))}
              </ul>
            ) : (
              <p className="best-result__points-note">אין מקום שיוצא בדיוק כמו שניחשת.</p>
            )}

            <div className="best-result__points-sub">עולות לשלב הבא <span className="best-result__points-each">· {result.advancementPoints} נק׳</span></div>
            {result.advancers.length > 0 ? (
              <ul className="best-result__points-list">
                {result.advancers.map(t => {
                  const conditional = result.thirdStatus === 'open' && t === result.thirdPick
                  return (
                    <li key={t}>
                      {he(t)} <span className="best-result__points-each">· 4 נק׳</span>
                      {conditional && <span className="best-result__points-cond"> (מותנה — 3 נק' לא תמיד מספיקות לעלייה כשלישית)</span>}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="best-result__points-note">אף קבוצה שניחשת לא עולה בתרחיש הזה.</p>
            )}
          </div>

          <div className="best-result__points-total">
            <span>סה״כ</span>
            <span>{result.groupPoints} נק׳</span>
          </div>
        </div>
      )}

      <ul className="best-result__matches">
        {result.ideal.map(m => {
          const same = m.predicted && m.predicted.home === m.scores.home && m.predicted.away === m.scores.away
          return (
            <li key={m.id} className="best-result__match">
              <span className="best-result__team">{he(m.homeTeam)}</span>
              <span className="best-result__scorewrap">
                <span className={`best-result__score${same ? '' : ' best-result__score--differ'}`} dir="ltr">{m.scores.away}:{m.scores.home}</span>
                <span className="best-result__pred">
                  {same
                    ? 'כמו שניחשת'
                    : m.predicted
                      ? <>ניחשת <span dir="ltr">{m.predicted.away}:{m.predicted.home}</span></>
                      : 'לא ניחשת'}
                </span>
              </span>
              <span className="best-result__team">{he(m.awayTeam)}</span>
            </li>
          )
        })}
      </ul>

      <div className="best-result__order">
        {result.slots.map(s => (
          <span key={s.position} className={`best-result__pos${s.clean ? ' best-result__pos--slot' : ''}`}>
            {s.position + 1}. {he(result.resultingOrder[s.position])}{s.clean ? ' ✓' : ''}
          </span>
        ))}
      </div>

      {result.alternativeOrder && (
        <div className="best-result__alt">
          רוצה לשמור על ההצלבות שניחשת? סידור חלופי: {result.alternativeOrder.orderHe[0]} ראשונה, {result.alternativeOrder.orderHe[1]} שנייה —
          {' '}אבל זה עולה לך {result.alternativeOrder.tableCost} נק׳ בבית מול ההמלצה.
        </div>
      )}

      {result.matchesPrediction && (
        <div className="best-result__note">
          זה בדיוק מה שניחשת — התחזית שלך כבר אופטימלית לבית הזה.
        </div>
      )}

      {result.reasons.length > 0 && (
        <ul className="best-result__reasons">
          {result.reasons.map((r, i) => (
            <li key={i} className={`best-result__reason${r.good ? '' : ' best-result__reason--bad'}`}>
              <span className="best-result__bullet">{r.good ? '✓' : '−'}</span>
              <span>{r.textHe}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="best-result__foot">
        מבט על הבית שלך בלבד — הניחוש, הסדר המדויק (כולל מקום 3 ו‑4 שנותנים נקודת מיקום) ומי שעולה.
        {' '}החישוב מניח ששאר משחקי הבית ייגמרו כפי שניחשת.
      </div>
    </div>
  )
}
