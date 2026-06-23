import type { MatchScores } from '../../shared/types'
import type { User } from '../../users/index'
import { resultGroup } from './matchUtils'
import { buildScoreFrequency, type ScoreFreqRow } from './scoreFrequency'

type Props = {
  matchId: string
  users: User[]
  actualScore?: MatchScores | null
  // How to read a user's predicted score for this match. Defaults to the flat
  // predictions map; knockout pages pass an orientation-corrected lookup so a
  // bettor who had the two teams reversed still groups under the real scoreline.
  scoreFor?: (u: User) => MatchScores | null | undefined
  // Team labels, used to name the penalty-shootout winner on a drawn knockout
  // scoreline. Group matches never carry a drawWinner, so they go unused there.
  homeLabel?: string
  awayLabel?: string
}

export default function ScoreFrequencyTable({ matchId, users, actualScore = null, scoreFor, homeLabel, awayLabel }: Props) {
  const { rows, unpredicted, recap } = buildScoreFrequency(matchId, users, actualScore, scoreFor)

  if (rows.length === 0 && unpredicted.length === 0) return null

  const rowClass = (score: MatchScores, outcome: ScoreFreqRow['outcome'], isLeader: boolean) => {
    const group = ` score-freq__row--g${resultGroup(score.home!, score.away!)}`
    if (!actualScore) return group + (isLeader ? ' score-freq__row--leader' : '')
    if (outcome === 'tzelifa') return group + ' score-freq__row--exact'
    if (outcome === 'pgiya') return group + ' score-freq__row--outcome'
    return group + ' score-freq__row--miss'
  }

  const penWinner = (score: MatchScores): string | undefined =>
    score.drawWinner === 'home' ? homeLabel : score.drawWinner === 'away' ? awayLabel : undefined

  return (
    <>
      {actualScore && (
        <div className="points-recap" data-testid="points-recap" dir="rtl">
          <span className="points-recap__item points-recap__item--exact">{recap.exact} צליפה</span>
          <span className="points-recap__dot" />
          <span className="points-recap__item points-recap__item--partial">{recap.partial} פגיעה</span>
          <span className="points-recap__dot" />
          <span className="points-recap__item points-recap__item--miss">{recap.miss} פספוס</span>
        </div>
      )}
      <div data-testid="score-freq-table" className="score-freq">
        {rows.map(({ key, score, names, count, pct, isLeader, outcome, pts }, i) => (
          <div
            key={key}
            data-testid="score-freq-row"
            className={`score-freq__row${rowClass(score, outcome, isLeader)}`}
            style={{ '--bar-pct': `${pct}%`, '--row-delay': `${i * 80}ms`, animationDelay: `${i * 80}ms` } as React.CSSProperties}
          >
            <div className="score-freq__fill" />
            <div className="score-freq__content">
              <span className="score-freq__score">
                {score.away}–{score.home}
                {score.drawWinner && (
                  <span className="score-freq__pens">
                    {penWinner(score) ? `פנדלים ל${penWinner(score)}` : 'פנדלים'}
                  </span>
                )}
              </span>
              <div className="score-freq__names">
                {names.map(name => <span key={name} className="score-freq__name">{name}</span>)}
              </div>
              <div className="score-freq__meta">
                {pts !== null && (
                  <span className="score-freq__pts-area">
                    <span className="score-freq__pts">{pts}</span>
                    <span className="score-freq__pts-label">נק׳</span>
                  </span>
                )}
                <span className="score-freq__stat">
                  <span className="score-freq__count">{count}</span>
                  <span className="score-freq__pct">{pct}%</span>
                </span>
              </div>
            </div>
          </div>
        ))}
        {unpredicted.length > 0 && (
          <div className="score-freq__unpredicted" data-testid="score-freq-unpredicted" dir="rtl">
            <span className="score-freq__unpredicted-label">לא ניחשו</span>
            {unpredicted.map(name => <span key={name} className="score-freq__name">{name}</span>)}
          </div>
        )}
      </div>
    </>
  )
}
