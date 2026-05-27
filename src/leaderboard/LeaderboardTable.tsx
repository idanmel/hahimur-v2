import { useState } from 'react'
import type { PointsBreakdown } from './points'

export interface LeaderboardRow extends PointsBreakdown {
  label: string
}

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

const BREAKDOWN: { key: keyof PointsBreakdown; label: string }[] = [
  { key: 'group',      label: 'בתים' },
  { key: 'r32',        label: 'שלב 32' },
  { key: 'r16',        label: 'שמינית' },
  { key: 'qf',         label: 'רבע' },
  { key: 'sf',         label: 'חצי' },
  { key: 'third',      label: 'ארד' },
  { key: 'final',      label: 'גמר' },
  { key: 'goldenBoot', label: 'מלך שערים' },
]

export default function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <>
      {/* Desktop: full table */}
      <div className="lb-scroll lb-desktop">
        <table className="lb-table">
          <thead>
            <tr>
              <th className="lb-th lb-th--rank">#</th>
              <th className="lb-th lb-th--name">מהמר</th>
              <th className="lb-th">בתים</th>
              <th className="lb-th">שלב 32</th>
              <th className="lb-th">שמינית</th>
              <th className="lb-th">רבע</th>
              <th className="lb-th">חצי</th>
              <th className="lb-th">ארד</th>
              <th className="lb-th">גמר</th>
              <th className="lb-th">מלך שערים</th>
              <th className="lb-th lb-th--total">סה"כ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const rank = i + 1
              const rankClass = rank <= 3 ? `lb-row--rank-${rank}` : 'lb-row--other'
              return (
                <tr
                  key={row.label}
                  className={`lb-row ${rankClass}`}
                  style={{ '--delay': `${i * 90}ms` } as React.CSSProperties}
                >
                  <td className="lb-td lb-td--rank">
                    {rank <= 3 ? MEDALS[rank] : rank}
                  </td>
                  <td className="lb-td lb-td--name">{row.label}</td>
                  <td className="lb-td">{row.group || '—'}</td>
                  <td className="lb-td">{row.r32 || '—'}</td>
                  <td className="lb-td">{row.r16 || '—'}</td>
                  <td className="lb-td">{row.qf || '—'}</td>
                  <td className="lb-td">{row.sf || '—'}</td>
                  <td className="lb-td">{row.third || '—'}</td>
                  <td className="lb-td">{row.final || '—'}</td>
                  <td className="lb-td">{row.goldenBoot || '—'}</td>
                  <td className="lb-td lb-td--total">{row.total}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: expandable cards */}
      <div className="lb-mobile">
        {rows.map((row, i) => {
          const rank = i + 1
          const isOpen = expanded === row.label
          const rankCls = rank <= 3 ? `lb-card--rank-${rank}` : ''
          return (
            <div
              key={row.label}
              className={`lb-card ${rankCls} ${isOpen ? 'lb-card--open' : ''}`}
              style={{ '--delay': `${i * 60}ms` } as React.CSSProperties}
              onClick={() => setExpanded(isOpen ? null : row.label)}
            >
              <div className="lb-card__header">
                <span className="lb-card__rank">
                  {rank <= 3 ? MEDALS[rank] : rank}
                </span>
                <span className="lb-card__name">{row.label}</span>
                <span className="lb-card__total">{row.total}</span>
                <span className="lb-card__chevron">›</span>
              </div>
              <div className="lb-card__body">
                <div className="lb-card__inner">
                  <div className="lb-card__grid">
                    {BREAKDOWN.map(({ key, label }) => (
                      <div key={key} className="lb-card__stat">
                        <span className="lb-card__stat-label">{label}</span>
                        <span className="lb-card__stat-value">{row[key] || '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
