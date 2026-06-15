import React from 'react'
import type { PointsBreakdown } from './points'
import { MEDALS } from './medals'
import { competitionRanks } from './rank'

export interface LeaderboardRow extends PointsBreakdown {
  label: string
}

type RoundKey = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final' | 'goldenBoot'

const ROUNDS: { key: RoundKey; label: string }[] = [
  { key: 'group',      label: 'שלב הבתים' },
  { key: 'r32',        label: 'שלב 32'    },
  { key: 'r16',        label: 'שמינית'    },
  { key: 'qf',         label: 'רבע'       },
  { key: 'sf',         label: 'חצי'       },
  { key: 'third',      label: 'ארד'       },
  { key: 'final',      label: 'גמר'       },
  { key: 'goldenBoot', label: 'מלך שערים' },
]

type SubField = { key: string; label: string }

const SUB_FIELDS: Record<RoundKey, SubField[]> = {
  group:      [{ key: 'matchPoints', label: 'תוצאה' }, { key: 'advancementPoints', label: 'עולות' }, { key: 'placePoints', label: 'מיקומים' }],
  r32:        [{ key: 'matchPoints', label: 'תוצאה' }, { key: 'advancementPoints', label: 'עולות' }],
  r16:        [{ key: 'matchPoints', label: 'תוצאה' }, { key: 'advancementPoints', label: 'עולות' }],
  qf:         [{ key: 'matchPoints', label: 'תוצאה' }, { key: 'advancementPoints', label: 'עולות' }],
  sf:         [{ key: 'matchPoints', label: 'תוצאה' }, { key: 'advancementPoints', label: 'עולות' }],
  third:      [{ key: 'matchPoints', label: 'תוצאה' }, { key: 'thirdPlaceWinner', label: 'זוכה' }],
  final:      [{ key: 'matchPoints', label: 'תוצאה' }, { key: 'champion', label: 'אלופה' }],
  goldenBoot: [{ key: 'goalsPoints', label: 'שערים' }, { key: 'winnerBonus', label: 'מלך' }],
}

function NameCell({ label, isMe }: { label: string; isMe: boolean }) {
  return (
    <td className="lb-td lb-td--name">
      {label}
      {isMe && <span className="lb-me-badge">אני</span>}
    </td>
  )
}

export default function LeaderboardTable({ rows, me }: { rows: LeaderboardRow[]; me?: string }) {
  const activeRounds = ROUNDS.filter(({ key }) =>
    rows.some(row => (row[key] as unknown as Record<string, number>).total > 0)
  )

  const noPoints = activeRounds.length === 0
  // A lone active round equals the total — drop its column unless its
  // sub-breakdown splits (e.g. תוצאה + עולות), which the total can't show
  const hasSplit = (key: RoundKey) =>
    rows.some(row => {
      const data = row[key] as unknown as Record<string, number>
      return SUB_FIELDS[key].filter(sf => (data[sf.key] ?? 0) > 0).length > 1
    })
  const roundColumns =
    activeRounds.length > 1 || (activeRounds.length === 1 && hasSplit(activeRounds[0].key))
      ? activeRounds
      : []
  const ranks = competitionRanks(rows, row => row.total)

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
                <th className="lb-th lb-th--rank">#</th>
                <th className="lb-th lb-th--name">מהמר</th>
                {roundColumns.map(({ key, label }) => (
                  <th key={key} className="lb-th lb-th--round">{label}</th>
                ))}
                <th className="lb-th lb-th--total">סה"כ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const rank = ranks[i]
                const rankClass = rank <= 3 ? `lb-row--rank-${rank}` : 'lb-row--other'
                const isMe = row.label === me
                return (
                  <tr
                    key={row.label}
                    className={`lb-row ${rankClass}${isMe ? ' lb-row--me' : ''}`}
                    style={{ '--delay': `${i * 90}ms` } as React.CSSProperties}
                  >
                    <td className="lb-td lb-td--rank">
                      {rank <= 3 ? MEDALS[rank] : rank}
                    </td>
                    <NameCell label={row.label} isMe={isMe} />
                    {roundColumns.map(({ key }) => {
                      const data = row[key] as unknown as Record<string, number>
                      const activeSubs = SUB_FIELDS[key].filter(sf => (data[sf.key] ?? 0) > 0)
                      return (
                        <td key={key} className="lb-td lb-td--detail">
                          <span className="lb-td-total">{data.total || '—'}</span>
                          {activeSubs.length > 1 && (
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
              const rank = ranks[i]
              const rankClass = rank <= 3 ? `lb-row--rank-${rank}` : 'lb-row--other'
              const isMe = row.label === me
              return (
                <tr
                  key={row.label}
                  className={`lb-row ${rankClass}${isMe ? ' lb-row--me' : ''}`}
                  style={{ '--delay': `${i * 60}ms` } as React.CSSProperties}
                >
                  <td className="lb-td lb-td--rank">{rank <= 3 ? MEDALS[rank] : rank}</td>
                  <NameCell label={row.label} isMe={isMe} />
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
