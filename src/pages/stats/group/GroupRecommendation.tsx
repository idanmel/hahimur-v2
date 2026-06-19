import { useMemo } from 'react'
import type { GroupLetter } from '../../../shared/groups'
import type { TournamentResults } from '../../../shared/types'
import type { User } from '../../../users'
import { recommendGroupOutcomes, remainingForGroup, type GroupRecommendation as GroupReco } from './recommendation'

interface Props {
  groupLetter: GroupLetter
  currentUser?: User
  results: TournamentResults
}

const sameOrder = (a: string[], b: string[]) => a.length === b.length && a.every((t, i) => t === b[i])

// "What's best for you?" — for the chosen player, what they should root for in
// this group's remaining matches. A deterministic, group-only read (no other
// players, no simulation), so it's computed inline.
export default function GroupRecommendation({ groupLetter, currentUser, results }: Props) {
  const remaining = useMemo(
    () => (currentUser ? remainingForGroup(groupLetter, results) : []),
    [currentUser, groupLetter, results],
  )

  const rec = useMemo<GroupReco | null>(
    () => (currentUser && remaining.length > 0 ? recommendGroupOutcomes(currentUser, groupLetter, results) : null),
    [currentUser, groupLetter, results, remaining.length],
  )

  if (!currentUser) {
    return (
      <section className="reco" dir="rtl">
        <h2>מה הכי טוב לך?</h2>
        <p className="reco__empty">בחרו את עצמכם (למעלה, בורר המשתמש) כדי לראות מה כדאי לכם שיקרה בבית.</p>
      </section>
    )
  }

  if (remaining.length === 0) return null

  const ctx = rec?.groupContext
  const contextBlock =
    ctx && (ctx.advances.length > 0 || !ctx.orderStillPossible) ? (
      <div className="reco__context">
        {ctx.advances.map(a => (
          <p
            key={a.teamHe}
            className={
              a.status === 'position'
                ? 'reco__ctx reco__ctx--good'
                : a.status === 'advance'
                  ? 'reco__ctx reco__ctx--warn'
                  : 'reco__ctx reco__ctx--bad'
            }
          >
            {a.status === 'position' ? (
              <>{a.teamHe} כבר מובטחת במקום ה{a.slotWord} כמו שניחשת — נקודת המיקום והעלייה מהמקום הזה כבר בטוחות.</>
            ) : a.status === 'advance' ? (
              <>{a.teamHe} כבר מובטחת עלייה מהבית — אבל עוד לא את המקום ה{a.slotWord} שניחשת, וזה עדיין משפיע על נקודת המיקום שלך.</>
            ) : (
              <>{a.teamHe} כבר לא תסיים בשתיים הראשונות — העלייה הישירה ירדה (עדיין ייתכן מהמקום השלישי, תלוי בבתים אחרים).</>
            )}
          </p>
        ))}
        {!ctx.orderStillPossible && (
          <p className="reco__ctx reco__ctx--bad">
            הסידור המדויק שניחשת כבר לא יושג במלואו — חלק מנקודות המיקום כבר ירדו, אז כדאי להתמקד במה שעוד פתוח.
          </p>
        )}
      </div>
    ) : null

  return (
    <section className="reco" dir="rtl">
      <h2>מה הכי טוב לך? · {currentUser.label}</h2>

      {rec && rec.scored && rec.best ? (
        <>
          <div className="reco__lead">
            {rec.counterIntuitive
              ? 'לא מה שהיית מצפה — אבל ככה הכי טוב לך:'
              : 'מה שכדאי לך שיקרה במשחקים שנותרו:'}
          </div>

          <ul className="reco__wants">
            {rec.best.choices.map(c => (
              <li key={c.matchId} className="reco__want">{c.text}</li>
            ))}
          </ul>

          <p className="reco__order">
            <span className="reco__order-label">ניחשת שהבית ייסגר כך:</span>{' '}
            {rec.predictedOrderHe.map((t, i) => `${i + 1}. ${t}`).join(' · ')}
          </p>
          {rec.counterIntuitive && !sameOrder(rec.predictedOrderHe, rec.best.orderHe) && (
            <p className="reco__order reco__order--alt">
              <span className="reco__order-label">אבל עדיף לך שייסגר כך:</span>{' '}
              {rec.best.orderHe.map((t, i) => `${i + 1}. ${t}`).join(' · ')}
            </p>
          )}

          {contextBlock}

          {rec.reasons.length > 0 && (
            <div className="reco__why-block">
              <div className="reco__why-title">
                {rec.counterIntuitive ? 'למה דווקא ככה עדיף לך:' : 'למה זה הכי טוב לך:'}
              </div>
              <ul className="reco__why-list">
                {rec.reasons.map((r, i) => (
                  <li key={i} className={r.good ? 'reco__why-good' : 'reco__why-bad'}>
                    {r.textHe}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="reco__assume">מבט על הבית שלך בלבד — בלי שחקנים אחרים ובלי שלבי הנוקאאוט.</p>
        </>
      ) : (
        <p className="reco__empty">כל משחקי הבית הסתיימו — אין יותר מה להמליץ.</p>
      )}
    </section>
  )
}
