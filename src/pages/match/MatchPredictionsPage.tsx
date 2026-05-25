import { useState } from 'react'
import Nav from '../../Nav'
import { GROUPS, TEAMS } from '../../shared/groups'
import type { Score } from '../../shared/types'
import { isUnpredicted } from '../../shared/types'
import ScoreInput from '../../formView/ScoreInput'
import { USERS } from '../../users/index'
import './MatchPredictionsPage.css'

const MATCH = GROUPS.A.matches[0]

function ScoreFrequencyTable({ matchId }: { matchId: string }) {
  const counts = new Map<string, number>()
  for (const u of USERS) {
    const p = u.predictions[matchId]
    if (!p || isUnpredicted(p)) continue
    const key = `${p.home}-${p.away}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const total = [...counts.values()].reduce((s, n) => s + n, 0)
  const rows = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, count, pct: Math.round((count / total) * 100) }))

  if (rows.length === 0) return null

  return (
    <div data-testid="score-freq-table" className="score-freq">
      {rows.map(({ key, count, pct }, i) => (
        <div
          key={key}
          data-testid="score-freq-row"
          className={`score-freq__row${i === 0 ? ' score-freq__row--leader' : ''}`}
          style={{ '--bar-pct': `${pct}%`, '--row-delay': `${i * 80}ms`, animationDelay: `${i * 80}ms` } as React.CSSProperties}
        >
          <div className="score-freq__content">
            <span className="score-freq__score">{key.replace('-', '–')}</span>
            <div className="score-freq__meta">
              <span className="score-freq__count">{count}</span>
              <span className="score-freq__pct">{pct}%</span>
            </div>
          </div>
          <div className="score-freq__track">
            <div className="score-freq__fill" />
          </div>
        </div>
      ))}
    </div>
  )
}

function PredictionSummary({ matchId, homeLabel, awayLabel }: { matchId: string; homeLabel: string; awayLabel: string }) {
  let homeWins = 0, draws = 0, awayWins = 0
  for (const u of USERS) {
    const p = u.predictions[matchId]
    if (!p || isUnpredicted(p)) continue
    if (p.home! > p.away!) homeWins++
    else if (p.home! < p.away!) awayWins++
    else draws++
  }
  const total = homeWins + draws + awayWins
  const pct = (n: number) => total === 0 ? 33.333 : (n / total) * 100

  return (
    <div className="pred-summary">
      <div className="pred-summary__cols">
        <div className="pred-summary__col pred-summary__col--home">
          <span className="pred-summary__count" data-testid="pred-count">{homeWins}</span>
          <span className="pred-summary__label">{homeLabel}</span>
        </div>
        <div className="pred-summary__col pred-summary__col--draw">
          <span className="pred-summary__count" data-testid="pred-count">{draws}</span>
          <span className="pred-summary__label">תיקו</span>
        </div>
        <div className="pred-summary__col pred-summary__col--away">
          <span className="pred-summary__count" data-testid="pred-count">{awayWins}</span>
          <span className="pred-summary__label">{awayLabel}</span>
        </div>
      </div>
      <div className="pred-summary__bar" aria-hidden="true">
        <div className="pred-summary__seg pred-summary__seg--home" style={{ width: `${pct(homeWins)}%` }} />
        <div className="pred-summary__seg pred-summary__seg--draw" style={{ width: `${pct(draws)}%` }} />
        <div className="pred-summary__seg pred-summary__seg--away" style={{ width: `${pct(awayWins)}%` }} />
      </div>
    </div>
  )
}

export default function MatchPredictionsPage() {
  const home = TEAMS[MATCH.homeTeam]
  const away = TEAMS[MATCH.awayTeam]
  const [homeScore, setHomeScore] = useState<Score>(null)
  const [awayScore, setAwayScore] = useState<Score>(null)

  return (
    <>
      <div className="match-header">
        <div className="match-header__group-badge">קבוצה א · מחזור 1</div>

        <div className="match-header__teams">
          <div className="match-team">
            <span className={`fi fi-${home.iso} match-team__flag`} />
            <span className="match-team__name">{home.he}</span>
          </div>

          <div className="match-header__vs">
            <ScoreInput label={home.he} value={homeScore} onChange={setHomeScore} />
            <span className="match-header__vs-text">–</span>
            <ScoreInput label={away.he} value={awayScore} onChange={setAwayScore} />
          </div>

          <div className="match-team">
            <span className={`fi fi-${away.iso} match-team__flag`} />
            <span className="match-team__name">{away.he}</span>
          </div>
        </div>

        <div className="match-header__meta">
          <span>{MATCH.matchDate}</span>
          <span className="match-header__meta-dot" />
          <span>{MATCH.kickoffIST}</span>
          <span className="match-header__meta-dot" />
          <span>שעון ישראל</span>
        </div>
      </div>

      <Nav />

      <div className="match-predictions">
        <p className="match-predictions__heading">הניחושים</p>

        <PredictionSummary matchId="A1" homeLabel={home.he} awayLabel={away.he} />
        <ScoreFrequencyTable matchId="A1" />

        {USERS.length === 0 ? (
          <p className="match-predictions__empty">אין תחזיות למשחק זה</p>
        ) : (
          [...USERS].sort((a, b) => {
            const pa = a.predictions['A1'], pb = b.predictions['A1']
            const ua = !pa || isUnpredicted(pa), ub = !pb || isUnpredicted(pb)
            if (ua && ub) return a.label.localeCompare(b.label, 'he')
            if (ua) return 1
            if (ub) return -1
            return pa.home! - pb.home! || pa.away! - pb.away! || a.label.localeCompare(b.label, 'he')
          }).map((u, i) => {
            const p = u.predictions['A1']
            const unpredicted = !p || isUnpredicted(p)
            const score = (v: number | null) => v !== null ? String(v) : '–'

            return (
              <div
                key={u.label}
                className={`prediction-row${unpredicted ? ' prediction-row--unpredicted' : ''}`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span className="prediction-row__name">{u.label}</span>
                <div className="prediction-row__score">
                  <span className="prediction-row__digit">{score(p?.home ?? null)}</span>
                  <span className="prediction-row__sep">–</span>
                  <span className="prediction-row__digit">{score(p?.away ?? null)}</span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
