import { useEffect, useMemo, useState } from 'react'
import type { TournamentResults } from '../../shared/types'
import type { User } from '../../users'
import { recommendMatchOutcome, type MatchRecommendation as MatchReco, type OutcomeEval, type Want } from './matchReco'

interface Props {
  matchId: string
  currentUser?: User
  results: TournamentResults
  decided: boolean
}

// The three outcomes ordered for display: the recommended one first, then the
// rest by your points. Anchoring on `rec.best` (not a fresh sort) keeps the table
// consistent with the headline — when staying on your own predicted result is the
// best play, it stays "טוב לך" here too.
function rankedOutcomes(rec: MatchReco): { o: OutcomeEval; label: string }[] {
  const bestWant = rec.best!.want
  const best = rec.outcomes.find(o => o.want === bestWant)!
  const others = rec.outcomes
    .filter(o => o.want !== bestWant)
    .sort((a, b) => b.expPoints - a.expPoints)
  return [
    { o: best, label: 'טוב לך' },
    ...others.map((o, i) => ({ o, label: i === others.length - 1 ? 'פחות טוב' : 'באמצע' })),
  ]
}

function labelFor(rec: MatchReco, want: Want): string {
  return rankedOutcomes(rec).find(r => r.o.want === want)?.label ?? 'באמצע'
}

// The "why" behind a clicked outcome: the concrete reasons derived from your own
// bet (your scoreline, your group order, your advancers), each tinted plus/minus.
function OutcomeWhy({ rec, o }: { rec: MatchReco; o: OutcomeEval }) {
  const isBest = o.want === rec.best!.want
  return (
    <>
      {o.reasons.length > 0 && (
        <ul className="match-reco__why-list">
          {o.reasons.map((r, i) => (
            <li key={i} className={r.good ? 'match-reco__why-good' : 'match-reco__why-bad'}>
              {r.textHe}
            </li>
          ))}
        </ul>
      )}
      {!isBest && o.matchesBracket && (
        <p className="match-reco__modal-foot">שים לב: זו דווקא התוצאה שניחשת — אבל בבית הזה יש תוצאה שמשתלמת לך יותר.</p>
      )}
    </>
  )
}

// "What's best for you?" on the match page — the result that earns you the most
// points from this group (your scoreline + your exact order + your advancers).
// Deterministic and group-only, so it's computed inline, no other players.
export default function MatchRecommendation({ matchId, currentUser, results, decided }: Props) {
  const [whyWant, setWhyWant] = useState<Want | null>(null)

  const rec = useMemo<MatchReco | null>(
    () => (currentUser && !decided ? recommendMatchOutcome(currentUser, matchId, results) : null),
    [currentUser, matchId, results, decided],
  )

  // A fresh compute (e.g. a live score update) invalidates any open explanation.
  useEffect(() => { setWhyWant(null) }, [matchId, currentUser, results])

  useEffect(() => {
    if (!whyWant) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setWhyWant(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [whyWant])

  if (decided) return null

  const whyOutcome = whyWant && rec ? rec.outcomes.find(o => o.want === whyWant) : null

  return (
    <>
      <header className="section-heading" dir="rtl">
        <span className="section-heading__eyebrow">ההמלצה שלך</span>
        <h2 className="section-heading__title">מה טוב לך?</h2>
      </header>

      <section className="match-reco" dir="rtl">
        {!currentUser ? (
          <p className="match-reco__empty">בחרו את עצמכם (בורר המשתמש) כדי לראות איזו תוצאה טובה לכם בבית.</p>
        ) : !rec || !rec.scored || !rec.best ? (
          <p className="match-reco__empty">אין מספיק מידע להמלצה על המשחק הזה.</p>
        ) : (
          <>
            {rec.noPreference ? (
              <p className="match-reco__lead">
                כל תוצאה כאן שקולה עבורך — אף תוצאה לא משנה לך נקודות בבית.
              </p>
            ) : (
              <>
                <p className="match-reco__lead">
                  {rec.counterIntuitive
                    ? 'לא מה שהיית מצפה — אבל ככה טוב לך:'
                    : 'התוצאה שעוזרת לך:'}
                </p>
                <p className="match-reco__pick">{rec.best.text}</p>
              </>
            )}

            {!rec.noPreference && (
              <table className="match-reco__table">
                <thead>
                  <tr>
                    <th>תוצאה</th>
                    <th>למה?</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedOutcomes(rec).map(({ o, label }) => (
                    <tr key={o.want} className={o.want === rec.best!.want ? 'match-reco__row--best' : ''}>
                      <td>{o.text}</td>
                      <td>
                        <button
                          type="button"
                          className="match-reco__why-btn"
                          onClick={() => setWhyWant(o.want)}
                        >
                          {label}
                          <span className="match-reco__why-hint" aria-hidden> ⓘ</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <p className="match-reco__note">
              מבט על הבית שלך בלבד — איזו תוצאה שווה לך הרבה נקודות מההימור שלך: הניחוש על המשחק,
              הסדר המדויק שניחשת, ומי שעולה מהבית (כולל מהמקום השלישי). החישוב מניח ששאר משחקי הבית
              ייגמרו כפי שניחשת. לחצו על "למה?" כדי לראות את ההסבר.
            </p>
          </>
        )}

        {whyOutcome && rec && (
          <div
            className="match-reco__modal"
            role="dialog"
            aria-modal="true"
            onClick={() => setWhyWant(null)}
          >
            <div className="match-reco__modal-card" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                className="match-reco__modal-close"
                onClick={() => setWhyWant(null)}
                aria-label="סגירה"
              >
                ×
              </button>
              <div className="match-reco__modal-label">{labelFor(rec, whyOutcome.want)}</div>
              <h3 className="match-reco__modal-title">{whyOutcome.text}</h3>
              <div className="match-reco__modal-body">
                <OutcomeWhy rec={rec} o={whyOutcome} />
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  )
}
