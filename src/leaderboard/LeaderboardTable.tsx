import React, { useState } from 'react'
import type { PointsBreakdown } from './points'
import { MEDALS } from './medals'
import { competitionRanks } from './rank'
import { TEAMS } from '../shared/groups'
import RankTrajectoryChart from './RankTrajectoryChart'

export interface LeaderboardRow extends PointsBreakdown {
  label: string
  topGoalscorer?: string
  predictedChampion?: string
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

function NameLabel({ label, isMe }: { label: string; isMe: boolean }) {
  return (
    <>
      {label}
      {isMe && <span className="lb-me-badge">אני</span>}
    </>
  )
}

// Gold-leaf emblems for the two outright honours — stroked line icons that sit
// inside the medallion disc, matching the almanac's navy-ink-on-parchment hand.
const TrophyIcon = () => (
  <svg className="lb-pick-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
    <path d="M7 5H4v1a3 3 0 0 0 3 3" />
    <path d="M17 5h3v1a3 3 0 0 1-3 3" />
    <path d="M12 13v3" />
    <path d="M9 20h6l-1-3.5h-4L9 20Z" />
  </svg>
)

const MedalIcon = () => (
  <svg className="lb-pick-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m9 9-3-6M15 9l3-6" />
    <circle cx="12" cy="14.5" r="5.5" />
    <path d="m12 11.6 1 2 2.2.3-1.6 1.5.4 2.2-2-1.05-2 1.05.4-2.2-1.6-1.5 2.2-.3 1-2Z" />
  </svg>
)

// A single honour plaque: gold-ringed emblem, a tracked kicker, the pick itself
// (a flag chip for the champion), and a gold wax-seal when the pick came true.
function PickPlaque({ kicker, icon, value, iso, correct }: {
  kicker: string; icon: React.ReactNode; value: string; iso?: string; correct: boolean
}) {
  return (
    <div className={`lb-pick${correct ? ' lb-pick--correct' : ''}`}>
      <span className="lb-pick-emblem">{icon}</span>
      <span className="lb-pick-text">
        <span className="lb-pick-kicker">{kicker}</span>
        <span className="lb-pick-value">
          {iso && <span className={`fi fi-${iso} lb-pick-flag`} aria-hidden="true" />}
          {value}
        </span>
      </span>
      {correct && <span className="lb-pick-seal" aria-label="ניחוש נכון">✓</span>}
    </div>
  )
}

// A bettor's two outright picks (golden boot, champion), shown in the expand
// panel. Correctness rides on the points breakdown the row already carries.
function PicksPanel({ row }: { row: LeaderboardRow }) {
  if (!row.topGoalscorer && !row.predictedChampion) return null
  const champ = row.predictedChampion ? TEAMS[row.predictedChampion] : undefined
  return (
    <div className="lb-picks">
      {row.topGoalscorer && (
        <PickPlaque kicker="מלך השערים" icon={<MedalIcon />} value={row.topGoalscorer} correct={row.goldenBoot.winnerBonus > 0} />
      )}
      {row.predictedChampion && (
        <PickPlaque kicker="אלופת העולם" icon={<TrophyIcon />} value={champ?.he ?? row.predictedChampion} iso={champ?.iso} correct={row.final.champion > 0} />
      )}
    </div>
  )
}

function NameCell({ label, isMe }: { label: string; isMe: boolean }) {
  return (
    <td className="lb-td lb-td--name">
      <NameLabel label={label} isMe={isMe} />
    </td>
  )
}

export default function LeaderboardTable({ rows, me, trajectories }: { rows: LeaderboardRow[]; me?: string; trajectories?: Record<string, number[]> }) {
  // mobile: tap a bettor to reveal their rank trajectory beneath their row
  const [openLabel, setOpenLabel] = useState<string | null>(null)
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

  // A row expands if it has picks to reveal or a rank trajectory to chart.
  const hasDetail = (row: LeaderboardRow) =>
    !!row.topGoalscorer || !!row.predictedChampion || !!trajectories?.[row.label]

  // Name cell that toggles the expand panel, when there's detail to show.
  const renderName = (row: LeaderboardRow, isMe: boolean) => {
    if (!hasDetail(row)) return <NameCell label={row.label} isMe={isMe} />
    const open = openLabel === row.label
    return (
      <td className="lb-td lb-td--name">
        <button
          type="button"
          className="lb-name-btn"
          aria-expanded={open}
          onClick={() => setOpenLabel(open ? null : row.label)}
        >
          <NameLabel label={row.label} isMe={isMe} />
          <span className="lb-name-chevron" aria-hidden="true">‹</span>
        </button>
      </td>
    )
  }

  // Expansion row holding the bettor's picks and trajectory chart.
  const renderDetailRow = (row: LeaderboardRow, colSpan: number) => {
    if (!hasDetail(row) || openLabel !== row.label) return null
    const trajectory = trajectories?.[row.label]
    return (
      <tr className="lb-traj-row">
        <td className="lb-td lb-traj-cell" colSpan={colSpan} data-testid={`lb-traj-${row.label}`}>
          <PicksPanel row={row} />
          {trajectory && <RankTrajectoryChart ranks={trajectory} />}
        </td>
      </tr>
    )
  }

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
                  <React.Fragment key={row.label}>
                    <tr
                      className={`lb-row ${rankClass}${isMe ? ' lb-row--me' : ''}`}
                      style={{ '--delay': `${i * 90}ms` } as React.CSSProperties}
                    >
                      <td className="lb-td lb-td--rank">
                        {rank <= 3 ? MEDALS[rank] : rank}
                      </td>
                      {renderName(row, isMe)}
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
                    {renderDetailRow(row, 3 + roundColumns.length)}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile: same round columns as desktop, but each cell shows the round
          total only (no sub-breakdown) to stay compact on narrow screens */}
      <div className="lb-mobile">
        <table className="lb-table lb-table--mobile">
          <thead>
            <tr>
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
                <React.Fragment key={row.label}>
                  <tr
                    className={`lb-row ${rankClass}${isMe ? ' lb-row--me' : ''}`}
                    style={{ '--delay': `${i * 60}ms` } as React.CSSProperties}
                  >
                    <td className="lb-td lb-td--rank">{rank <= 3 ? MEDALS[rank] : rank}</td>
                    {renderName(row, isMe)}
                    {roundColumns.map(({ key }) => {
                      const data = row[key] as unknown as Record<string, number>
                      return (
                        <td key={key} className="lb-td lb-td--detail">
                          <span className="lb-td-total">{data.total || '—'}</span>
                        </td>
                      )
                    })}
                    <td className="lb-td lb-td--total">{row.total}</td>
                  </tr>
                  {renderDetailRow(row, 3 + roundColumns.length)}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
