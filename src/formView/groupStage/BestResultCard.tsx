import { TEAMS } from '../../shared/groups'
import type { BestResult } from '../../leaderboard/bestResult'
import './BestResultCard.css'

const he = (team: string) => TEAMS[team]?.he ?? team

export default function BestResultCard({ result }: { result: BestResult }) {
  const cleanPos = new Set(result.slots.filter(s => s.clean).map(s => s.position))

  return (
    <div className="best-result">
      <div className="best-result__head">
        <span className="best-result__title">הכי טוב בשבילך</span>
        <span className="best-result__sub">{result.groupPoints} נק׳ בבית</span>
      </div>

      <ul className="best-result__matches">
        {result.ideal.map(m => (
          <li key={m.id} className="best-result__match">
            <span className="best-result__team">{he(m.homeTeam)}</span>
            <span className="best-result__score">{m.scores.home}–{m.scores.away}</span>
            <span className="best-result__team">{he(m.awayTeam)}</span>
          </li>
        ))}
      </ul>

      <div className="best-result__order">
        {result.resultingOrder.map((t, i) => (
          <span key={t} className={`best-result__pos${cleanPos.has(i) ? ' best-result__pos--slot' : ''}`}>
            {i + 1}. {he(t)}{cleanPos.has(i) ? ' ✓' : ''}
          </span>
        ))}
      </div>

      {result.matchesPrediction && (
        <div className="best-result__note">
          זה בדיוק מה שניחשת — התחזית שלך כבר אופטימלית לבית הזה.
        </div>
      )}

      <div className="best-result__third">
        {result.thirdShouldAdvance
          ? `${he(result.thirdTeam)} (ניחשת שתעלה) מסיימת שלישית עם ${result.thirdPoints} נק׳ — חזק מספיק כדי לעלות ממקום שלישי.`
          : `${he(result.thirdTeam)} (ניחשת שלא תעלה) נשארת חלשה עם ${result.thirdPoints} נק׳ — כדי שלא תדחוף החוצה קבוצה שלישית אחרת שכן ניחשת.`}
      </div>
    </div>
  )
}
