import React from 'react'
import type { PointsBreakdown } from './points'

export interface LeaderboardRow extends PointsBreakdown {
  label: string
}

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

type RoundKey = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final' | 'goldenBoot'

const ROUNDS: { key: RoundKey; label: string }[] = [
  { key: 'group',      label: 'בתים' },
  { key: 'r32',        label: 'שלב 32' },
  { key: 'r16',        label: 'שמינית' },
  { key: 'qf',         label: 'רבע' },
  { key: 'sf',         label: 'חצי' },
  { key: 'third',      label: 'ארד' },
  { key: 'final',      label: 'גמר' },
  { key: 'goldenBoot', label: 'מלך שערים' },
]

type SubField = { key: string; label: string }

const SUB_FIELDS: Record<RoundKey, SubField[]> = {
  group:      [{ key: 'matchPoints', label: "מש'" }, { key: 'advancementPoints', label: "קיד'" }],
  r32:        [{ key: 'matchPoints', label: "מש'" }, { key: 'advancementPoints', label: "קיד'" }],
  r16:        [{ key: 'matchPoints', label: "מש'" }, { key: 'advancementPoints', label: "קיד'" }],
  qf:         [{ key: 'matchPoints', label: "מש'" }, { key: 'advancementPoints', label: "קיד'" }],
  sf:         [{ key: 'matchPoints', label: "מש'" }, { key: 'advancementPoints', label: "קיד'" }],
  third:      [{ key: 'matchPoints', label: "מש'" }, { key: 'thirdPlaceWinner', label: 'זוכה' }],
  final:      [{ key: 'matchPoints', label: "מש'" }, { key: 'champion', label: 'אלוף' }],
  goldenBoot: [{ key: 'goalsPoints', label: "שע'" }, { key: 'winnerBonus', label: "בונ'" }],
}

export default function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <>
      {/* Desktop: each round cell stacks total + non-zero sub-fields below it */}
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
                  {ROUNDS.map(({ key }) => {
                    const data = row[key] as unknown as Record<string, number>
                    const activeSubs = SUB_FIELDS[key].filter(sf => (data[sf.key] ?? 0) > 0)
                    return (
                      <td key={key} className="lb-td lb-td--detail">
                        <span className="lb-td-total">{data.total || '—'}</span>
                        {activeSubs.length > 0 && (
                          <div className="lb-td-subs">
                            {activeSubs.map(sf => (
                              <span key={sf.key} className="lb-td-sub">
                                <span className="lb-td-sub-label">{sf.label}</span>
                                <span className="lb-td-sub-value">{data[sf.key]}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    )
                  })}
                  <td className="lb-td lb-td--total">{row.total}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: flat cards, always-visible per-round sections */}
      <div className="lb-mobile">
        {rows.map((row, i) => {
          const rank = i + 1
          const rankCls = rank <= 3 ? `lb-card--rank-${rank}` : ''
          return (
            <div
              key={row.label}
              className={`lb-card lb-card--flat ${rankCls}`}
              style={{ '--delay': `${i * 60}ms` } as React.CSSProperties}
            >
              <div className="lb-card__header">
                <span className="lb-card__rank">{rank <= 3 ? MEDALS[rank] : rank}</span>
                <span className="lb-card__name">{row.label}</span>
                <span className="lb-card__total">{row.total}</span>
              </div>
              <div className="lb-card__sections">
                {ROUNDS.map(({ key, label }) => {
                  const data = row[key] as unknown as Record<string, number>
                  const activeSubs = SUB_FIELDS[key].filter(sf => (data[sf.key] ?? 0) > 0)
                  if (data.total === 0) return null
                  return (
                    <div key={key} className="lb-card__section">
                      <div className="lb-card__section-header">
                        <span className="lb-card__section-label">{label}</span>
                        <span className="lb-card__section-total">{data.total}</span>
                      </div>
                      {activeSubs.length > 0 && (
                        <div className="lb-card__section-fields">
                          {activeSubs.map(sf => (
                            <div key={sf.key} className="lb-card__section-field">
                              <span className="lb-card__sf-label">{sf.label}</span>
                              <span className="lb-card__sf-value">{data[sf.key]}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
