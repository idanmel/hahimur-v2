import React from 'react'
import type { PointsBreakdown } from './points'

export interface LeaderboardRow extends PointsBreakdown {
  label: string
}

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

type RoundKey = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final' | 'goldenBoot'

const ROUNDS: { key: RoundKey; label: string; phase: 'group' | 'ko' | 'golden' }[] = [
  { key: 'group',      label: 'בתים',       phase: 'group'  },
  { key: 'r32',        label: 'שלב 32',     phase: 'ko'     },
  { key: 'r16',        label: 'שמינית',     phase: 'ko'     },
  { key: 'qf',         label: 'רבע גמר',    phase: 'ko'     },
  { key: 'sf',         label: 'חצי גמר',    phase: 'ko'     },
  { key: 'third',      label: 'מקום שלישי', phase: 'ko'     },
  { key: 'final',      label: 'גמר',        phase: 'ko'     },
  { key: 'goldenBoot', label: 'מלך שערים',  phase: 'golden' },
]

type SubField = { key: string; label: string }

const SUB_FIELDS: Record<RoundKey, SubField[]> = {
  group:      [{ key: 'matchPoints', label: 'תוצאה' }, { key: 'advancementPoints', label: 'עולות' }],
  r32:        [{ key: 'matchPoints', label: 'תוצאה' }, { key: 'advancementPoints', label: 'עולות' }],
  r16:        [{ key: 'matchPoints', label: 'תוצאה' }, { key: 'advancementPoints', label: 'עולות' }],
  qf:         [{ key: 'matchPoints', label: 'תוצאה' }, { key: 'advancementPoints', label: 'עולות' }],
  sf:         [{ key: 'matchPoints', label: 'תוצאה' }, { key: 'advancementPoints', label: 'עולות' }],
  third:      [{ key: 'matchPoints', label: 'תוצאה' }, { key: 'thirdPlaceWinner', label: 'זוכה' }],
  final:      [{ key: 'matchPoints', label: 'תוצאה' }, { key: 'champion', label: 'אלופה' }],
  goldenBoot: [{ key: 'goalsPoints', label: 'שערים' }, { key: 'winnerBonus', label: 'מלך' }],
}

const PHASE_LABELS: Record<string, string> = {
  group:  'שלב הבתים',
  ko:     'נוקאאוט',
  golden: 'מלך השערים',
}

function getPhaseGroups(activeRounds: typeof ROUNDS) {
  const seen = new Set<string>()
  const groups: { phase: string; count: number; label: string }[] = []
  for (const r of activeRounds) {
    if (!seen.has(r.phase)) {
      seen.add(r.phase)
      groups.push({ phase: r.phase, count: 0, label: PHASE_LABELS[r.phase] })
    }
    groups[groups.length - 1].count++
  }
  return groups
}

export default function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
  const activeRounds = ROUNDS.filter(({ key }) =>
    rows.some(row => (row[key] as unknown as Record<string, number>).total > 0)
  )

  const phaseGroups = getPhaseGroups(activeRounds)
  const noPoints = activeRounds.length === 0

  return (
    <>
      {/* Desktop: each round cell stacks total + non-zero sub-fields below it */}
      <div className="lb-scroll lb-desktop">
        {noPoints ? (
          <div className="lb-empty-state">
            <div className="lb-empty-icon">⏳</div>
            <p className="lb-empty-text">טרם נצברו נקודות — הטבלה תתעדכן עם תחילת המשחקים</p>
          </div>
        ) : (
          <table className="lb-table">
            <thead>
              <tr className="lb-th-phase-row">
                <th className="lb-th lb-th--rank" rowSpan={2}>#</th>
                <th className="lb-th lb-th--name" rowSpan={2}>מהמר</th>
                {phaseGroups.map(g => (
                  <th
                    key={g.phase}
                    className={`lb-th lb-th--phase lb-th--phase-${g.phase}`}
                    colSpan={g.count}
                  >
                    {g.label}
                  </th>
                ))}
                <th className="lb-th lb-th--total" rowSpan={2}>סה"כ</th>
              </tr>
              <tr>
                {activeRounds.map(({ key, label }) => (
                  <th key={key} className="lb-th lb-th--round">{label}</th>
                ))}
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
                    {activeRounds.map(({ key }) => {
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
        )}
      </div>

      {/* Mobile: compact totals table */}
      <div className="lb-mobile">
        <table className="lb-table lb-table--mobile">
          <thead>
            <tr>
              <th className="lb-th lb-th--rank">#</th>
              <th className="lb-th lb-th--name">מהמר</th>
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
                  style={{ '--delay': `${i * 60}ms` } as React.CSSProperties}
                >
                  <td className="lb-td lb-td--rank">{rank <= 3 ? MEDALS[rank] : rank}</td>
                  <td className="lb-td lb-td--name">{row.label}</td>
                  <td className="lb-td lb-td--total">{row.total}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
