import { TEAMS } from './groups'
import { matchOutcomeOdds, advanceOdds, hasOdds } from './matchOdds'
import './OddsBar.css'

const pct = (p: number) => `${Math.round(p * 100)}%`

// One team's leg of the bar's legend: flag, Hebrew name, and its percentage.
function TeamStat({ team, prob, side }: { team: string; prob: number; side: 'home' | 'away' }) {
  const t = TEAMS[team]
  return (
    <span className={`odds__stat odds__stat--${side}`}>
      {t?.iso && <span className={`fi fi-${t.iso} odds__flag`} aria-hidden="true" />}
      <span className="odds__team">{t?.he ?? team}</span>
      <b className="odds__pct">{pct(prob)}</b>
    </span>
  )
}

// A clear, at-a-glance strip of each team's chance in a single fixture, from the
// same Elo/Poisson model the win-prob board runs on. For a group match it's the
// 90' win/draw/win; for a knockout it's the chance each side advances (draws are
// split by the ET/penalty rule the engine uses). Renders nothing when a slot
// isn't a rated team yet (an unresolved knockout feeder), so it never shows a
// misleading 50/50 for "מנצח 74".
export default function OddsBar({ home, away, knockout = false }: {
  home: string
  away: string
  knockout?: boolean
}) {
  if (!hasOdds(home, away)) return null

  if (knockout) {
    const o = advanceOdds(home, away)
    return (
      <div className="odds" dir="rtl" data-testid="odds-bar">
        <div className="odds__caption">
          סיכוי להעפיל<span className="odds__src"> · הערכת מודל (Elo)</span>
        </div>
        <div className="odds__bar" aria-hidden="true">
          <span className="odds__seg odds__seg--home" style={{ width: pct(o.home) }} />
          <span className="odds__seg odds__seg--away" style={{ width: pct(o.away) }} />
        </div>
        <div className="odds__legend">
          <TeamStat team={home} prob={o.home} side="home" />
          <TeamStat team={away} prob={o.away} side="away" />
        </div>
      </div>
    )
  }

  const o = matchOutcomeOdds(home, away)
  return (
    <div className="odds" dir="rtl" data-testid="odds-bar">
      <div className="odds__caption">
        סיכוי לנצח<span className="odds__src"> · הערכת מודל (Elo)</span>
      </div>
      <div className="odds__bar" aria-hidden="true">
        <span className="odds__seg odds__seg--home" style={{ width: pct(o.homeWin) }} />
        <span className="odds__seg odds__seg--draw" style={{ width: pct(o.draw) }} />
        <span className="odds__seg odds__seg--away" style={{ width: pct(o.awayWin) }} />
      </div>
      <div className="odds__legend">
        <TeamStat team={home} prob={o.homeWin} side="home" />
        <span className="odds__stat odds__stat--draw">
          תיקו <b className="odds__pct">{pct(o.draw)}</b>
        </span>
        <TeamStat team={away} prob={o.awayWin} side="away" />
      </div>
    </div>
  )
}
