import { isUnpredicted, type MatchScores } from '../../shared/types'
import type { User } from '../../users/index'
import { singleMatchPoints } from '../../leaderboard/points'
import { compareScores, resultGroup } from './matchUtils'

type Props = { matchId: string; users: User[]; actualScore?: MatchScores | null }

export default function ScoreFrequencyTable({ matchId, users, actualScore = null }: Props) {
  const byScore = new Map<string, string[]>()
  const unpredicted: string[] = []
  for (const u of users) {
    const p = u.predictions[matchId]
    if (!p || isUnpredicted(p)) { unpredicted.push(u.label); continue }
    const key = `${p.home}-${p.away}`
    byScore.set(key, [...(byScore.get(key) ?? []), u.label])
  }
  unpredicted.sort((a, b) => a.localeCompare(b, 'he'))

  const total = [...byScore.values()].reduce((s, names) => s + names.length, 0)
  const parseKey = (key: string) => { const [h, aw] = key.split('-').map(Number); return { h, aw } }
  const maxCount = Math.max(...[...byScore.values()].map(names => names.length))
  const rows = [...byScore.entries()]
    .sort((a, b) => { const pa = parseKey(a[0]), pb = parseKey(b[0]); return compareScores(pa.h, pa.aw, pb.h, pb.aw) })
    .map(([key, names]) => {
      const { h, aw } = parseKey(key)
      return {
        key,
        names: [...names].sort((a, b) => a.localeCompare(b, 'he')),
        count: names.length,
        pct: Math.round((names.length / total) * 100),
        isLeader: names.length === maxCount,
        pts: actualScore ? singleMatchPoints(matchId, { home: h, away: aw }, actualScore) : null,
      }
    })

  if (rows.length === 0 && unpredicted.length === 0) return null

  const recap = { exact: 0, partial: 0, miss: 0 }
  if (actualScore) {
    for (const r of rows) {
      const { h, aw } = parseKey(r.key)
      if (h === actualScore.home && aw === actualScore.away) recap.exact += r.count
      else if (r.pts! > 0) recap.partial += r.count
      else recap.miss += r.count
    }
  }

  const rowClass = (key: string, isLeader: boolean) => {
    const { h, aw } = parseKey(key)
    const group = ` score-freq__row--g${resultGroup(h, aw)}`
    if (!actualScore) return group + (isLeader ? ' score-freq__row--leader' : '')
    if (h === actualScore.home && aw === actualScore.away) return group + ' score-freq__row--exact'
    if (resultGroup(h, aw) === resultGroup(actualScore.home!, actualScore.away!)) return group + ' score-freq__row--outcome'
    return group + ' score-freq__row--miss'
  }

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
        {rows.map(({ key, names, count, pct, isLeader, pts }, i) => (
          <div
            key={key}
            data-testid="score-freq-row"
            className={`score-freq__row${rowClass(key, isLeader)}`}
            style={{ '--bar-pct': `${pct}%`, '--row-delay': `${i * 80}ms`, animationDelay: `${i * 80}ms` } as React.CSSProperties}
          >
            <div className="score-freq__fill" />
            <div className="score-freq__content">
              <span className="score-freq__score">{key.split('-').reverse().join('–')}</span>
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
