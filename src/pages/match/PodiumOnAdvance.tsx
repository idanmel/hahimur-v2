import { useMemo } from 'react'
import type { TournamentResults } from '../../shared/types'
import type { User } from '../../users'
import { TEAMS } from '../../shared/groups'
import { realPlayedState } from '../../leaderboard/winprob/realPlayed'
import { usePodiumByAdvancer } from './usePodiumByAdvancer'
import { podiumAdvice, type PodiumSide } from './podiumAdvice'

interface Props {
  currentUser?: User
  results: TournamentResults
  matchNum: number
  // True while this fixture is actually being played. Its live score is folded
  // into the bracket, which would make the sim treat it as settled and stop
  // advising — so we keep showing the pre-match fork until the match is decided.
  live?: boolean
}

const he = (team: string) => TEAMS[team]?.he ?? team
const pct = (p: number) => `${(p * 100).toFixed(1)}%`
const signed = (d: number) => `${d >= 0 ? '+' : '−'}${(Math.abs(d) * 100).toFixed(1)}%`
const Flag = ({ team }: { team: string }) => {
  const iso = TEAMS[team]?.iso
  return iso ? <span className={`fi fi-${iso} podium-advice__flag`} /> : null
}

const Heading = (
  <header className="section-heading" dir="rtl">
    <span className="section-heading__eyebrow">מה עדיף לך</span>
    <h2 className="section-heading__title">איך המשחק משפיע על הסיכוי שלך לסיים בפודיום</h2>
  </header>
)

// Rendered above the .match-predictions column, so it carries that column's own
// max-width + side padding to stay aligned with the cards below it on wide screens.
const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="podium-advice__wrap">
    {Heading}
    <section className="podium-advice" dir="rtl">{children}</section>
  </div>
)

// One side of the fork: which advancer this is, the conditional podium %, and a
// swing meter whose fill grows up-gold / down-red from the centre, sized to this
// outcome's |delta| against the biggest swing on the card — so the two tiles read
// as a balance tilting around your baseline.
function Branch({ side, best, fill }: { side: PodiumSide; best: boolean; fill: number }) {
  const up = side.delta >= 0
  return (
    <div className={`podium-advice__branch${best ? ' podium-advice__branch--best' : ' podium-advice__branch--dim'}`}>
      {best && <span className="podium-advice__ribbon">הכי מקדם אותך</span>}
      <div className="podium-advice__branch-head">
        <Flag team={side.team} />
        <span className="podium-advice__branch-team">{he(side.team)}</span>
        <span className="podium-advice__branch-verb">עולה</span>
      </div>
      <div className="podium-advice__branch-pct">{pct(side.podium)}</div>
      <div
        className={`podium-advice__swing ${up ? 'is-up' : 'is-down'}`}
        style={{ '--fill': fill } as React.CSSProperties}
      >
        <span className="podium-advice__swing-pivot" />
        <span className="podium-advice__swing-fill" />
      </div>
      <div className={`podium-advice__delta ${up ? 'podium-advice__delta--up' : 'podium-advice__delta--down'}`}>
        <span className="podium-advice__delta-arrow">{up ? '▲' : '▼'}</span>
        {signed(side.delta)}
      </div>
    </div>
  )
}

// "What raises your odds of a high finish in this match" — for a not-yet-played
// knockout fixture with known teams, P(you finish top-5 of the whole pool | each
// side advances), with the better side highlighted. The heavy Monte-Carlo runs in a
// worker (usePodiumByAdvancer); this component only renders the verdict.
export default function PodiumOnAdvance({ currentUser, results, matchNum, live }: Props) {
  const played = useMemo(() => {
    const state = realPlayedState(results)
    // While the match is live its running score is in the bracket; drop it so the
    // sim keeps forking on the (still-undecided) advancer rather than bailing out.
    if (live) delete state[String(matchNum)]
    return state
  }, [results, live, matchNum])
  const playerGoals = results.playerGoals ?? {}
  const { status, result } = usePodiumByAdvancer(currentUser?.label ?? '', played, playerGoals, matchNum)

  if (!currentUser) {
    return (
      <Shell>
        <p className="podium-advice__empty">בחרו את עצמכם (בורר המשתמש) כדי לראות איזו עלייה מהמשחק הזה הכי מקדמת אתכם למקום 1–5.</p>
      </Shell>
    )
  }

  if (status === 'loading') {
    return (
      <Shell>
        <p className="podium-advice__loading">מחשב את הסיכויים…</p>
      </Shell>
    )
  }

  // Unsupported browser, or the match isn't advisable after all (decided / teams
  // not yet resolved): nothing to show.
  if (!result) return null

  const advice = podiumAdvice(result)
  // Normalise both swing meters to the larger move on the card, so the bigger
  // shift fills its track and the smaller is read relative to it.
  const maxAbs = Math.max(Math.abs(advice.better.delta), Math.abs(advice.worse.delta), 1e-9)
  const fillFor = (s: PodiumSide) => Math.min(1, Math.abs(s.delta) / maxAbs)

  return (
    <Shell>
      {/* Baseline hero: your odds of a top-5 finish right now, over a 5-rung
          standings ladder (place 1 the brightest gold, each rung below dimmer) */}
      <div className="podium-advice__baseline">
        <span className="podium-advice__baseline-label">הסיכוי שלך למקום 1–5 כרגע</span>
        <div className="podium-advice__stand" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => (
            <i key={i} className="podium-advice__rung" />
          ))}
        </div>
        <span className="podium-advice__baseline-value">{pct(advice.baseline)}</span>
      </div>

      <div className="podium-advice__crossroads">
        <span>{advice.noPreference ? 'התוצאה כמעט לא משנה לך' : 'צומת הדרכים שלך'}</span>
      </div>

      <div className="podium-advice__fork">
        <Branch side={advice.better} best={!advice.noPreference} fill={fillFor(advice.better)} />
        <Branch side={advice.worse} best={false} fill={fillFor(advice.worse)} />
      </div>
    </Shell>
  )
}
