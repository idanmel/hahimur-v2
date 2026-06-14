import React, { useState } from 'react'
import { GROUP_SORTERS } from './leaderboardRows'
import type { GroupScopeRow, GroupSortBy } from './leaderboardRows'
import { MEDALS } from './medals'
import { competitionRanks } from './rank'

type Zone = 'hits' | 'points'

interface Col {
  key: GroupSortBy
  label: string
  value: (r: GroupScopeRow) => number
  zone: Zone
  zoneEdge?: boolean
}

const HIT_COLS: Col[] = [
  { key: 'pgiya',    label: 'פגיעות', value: r => r.pgiyaCount,                  zone: 'hits' },
  { key: 'tzelifa',  label: 'צליפות', value: r => r.tzelifaCount,                zone: 'hits' },
  { key: 'combined', label: 'ביחד',   value: r => r.pgiyaCount + r.tzelifaCount, zone: 'hits' },
]

const POINT_COLS: Col[] = [
  { key: 'matchPoints',       label: 'משחקים',  value: r => r.matchPoints,       zone: 'points', zoneEdge: true },
  { key: 'advancementPoints', label: 'עולות',   value: r => r.advancementPoints, zone: 'points' },
  { key: 'placePoints',       label: 'מיקומים', value: r => r.placePoints,       zone: 'points' },
  { key: 'total',             label: 'סה"כ',    value: r => r.total,             zone: 'points' },
]

const LASTX_POINT_COLS: Col[] = [
  { key: 'matchPoints', label: 'משחקים', value: r => r.matchPoints, zone: 'points', zoneEdge: true },
  { key: 'goalsPoints', label: 'שערים',  value: r => r.goalsPoints, zone: 'points' },
  { key: 'total',       label: 'סה"כ',   value: r => r.total,       zone: 'points' },
]

function makeVariant(pointCols: Col[], defaultSort: GroupSortBy) {
  const mobilePointCol = { ...pointCols[pointCols.length - 1], label: 'נקודות', zoneEdge: true }
  return {
    desktop: [...HIT_COLS, ...pointCols],
    mobile: [
      { ...HIT_COLS[0], label: 'פגיעה' },
      { ...HIT_COLS[1], label: 'צליפה' },
      mobilePointCol,
    ],
    pointCols,
    defaultSort,
  }
}

const COLS = {
  group: makeVariant(POINT_COLS, 'total'),
  // window scopes (last-X, as-of game N, range) all share match/goals/total columns
  window: makeVariant(LASTX_POINT_COLS, 'total'),
}

function thClass({ key, zone, zoneEdge }: Col): string {
  return [
    'lb-th lb-th--round',
    zone === 'hits' ? 'lb-th--hits-col' : 'lb-th--points-col',
    key === 'total' ? 'lb-th--total' : '',
    zoneEdge ? 'lb-zone-edge' : '',
  ].filter(Boolean).join(' ')
}

function tdClass({ key, zone, zoneEdge }: Col): string {
  return [
    'lb-td',
    zone === 'hits' ? 'lb-td--hits' : 'lb-td--scope-col lb-td--points',
    key === 'total' ? 'lb-td--total' : '',
    zoneEdge ? 'lb-zone-edge' : '',
  ].filter(Boolean).join(' ')
}

function SortableThs({ cols, sortCol, onSortCol }: {
  cols: Col[]
  sortCol: GroupSortBy
  onSortCol: (col: GroupSortBy) => void
}) {
  return cols.map(col => (
    <th
      key={col.key}
      className={thClass(col)}
      aria-sort={sortCol === col.key ? 'descending' : undefined}
    >
      <button
        type="button"
        className={`lb-th-sort-btn${sortCol === col.key ? ' lb-th-sort-btn--active' : ''}`}
        onClick={() => onSortCol(col.key)}
      >{col.label}</button>
    </th>
  ))
}

function ScopeRows({ rows, ranks, cols, delayMs }: { rows: GroupScopeRow[]; ranks: number[]; cols: Col[]; delayMs: number }) {
  return rows.map((row, i) => {
    const rank = ranks[i]
    const rankClass = rank <= 3 ? `lb-row--rank-${rank}` : 'lb-row--other'
    return (
      <tr
        key={row.label}
        className={`lb-row ${rankClass}`}
        style={{ '--delay': `${i * delayMs}ms` } as React.CSSProperties}
      >
        <td className="lb-td lb-td--rank">{rank <= 3 ? MEDALS[rank] : rank}</td>
        <td className="lb-td lb-td--name">{row.label}</td>
        {cols.map(col => {
          const v = col.value(row)
          return (
            <td key={col.key} className={tdClass(col)}>
              {v === 0 ? '—' : col.zone === 'hits' ? <span className="lb-hit-chip">{v}</span> : v}
            </td>
          )
        })}
      </tr>
    )
  })
}

export default function GroupScopeTable({ rows, variant = 'group' }: { rows: GroupScopeRow[]; variant?: keyof typeof COLS }) {
  const cols = COLS[variant]
  const [sortCol, setSortCol] = useState<GroupSortBy>(cols.defaultSort)
  const sortedRows = [...rows].sort(GROUP_SORTERS[sortCol])
  const sortValue = cols.desktop.find(c => c.key === sortCol)!.value
  const ranks = competitionRanks(sortedRows, sortValue)

  return (
    <>
      <div className="lb-scroll lb-desktop">
        <table className="lb-table">
          <thead>
            <tr className="lb-th-phase-row">
              <th className="lb-th lb-th--rank" rowSpan={2}>#</th>
              <th className="lb-th lb-th--name" rowSpan={2}>מהמר</th>
              <th className="lb-th lb-th--phase lb-th--phase-hits" colSpan={HIT_COLS.length}>ניחושים נכונים</th>
              <th className="lb-th lb-th--phase lb-th--phase-points lb-zone-edge" colSpan={cols.pointCols.length}>נקודות</th>
            </tr>
            <tr>
              <SortableThs cols={cols.desktop} sortCol={sortCol} onSortCol={setSortCol} />
            </tr>
          </thead>
          <tbody>
            <ScopeRows rows={sortedRows} ranks={ranks} cols={cols.desktop} delayMs={90} />
          </tbody>
        </table>
        <p className="lb-zone-hint">
          <span className="lb-hit-chip lb-hit-chip--hint">ניחושים</span> כמה פעמים קלעתם
          <span className="lb-zone-hint-sep">·</span>
          <strong>נקודות</strong> כמה זה הניב
        </p>
      </div>

      <div className="lb-mobile">
        <table className="lb-table lb-table--mobile">
          <thead>
            <tr>
              <th className="lb-th lb-th--rank">#</th>
              <th className="lb-th lb-th--name">מהמר</th>
              <SortableThs cols={cols.mobile} sortCol={sortCol} onSortCol={setSortCol} />
            </tr>
          </thead>
          <tbody>
            <ScopeRows rows={sortedRows} ranks={ranks} cols={cols.mobile} delayMs={60} />
          </tbody>
        </table>
        <p className="lb-zone-hint">
          <span className="lb-hit-chip lb-hit-chip--hint">ניחושים</span> כמה פעמים קלעתם
          <span className="lb-zone-hint-sep">·</span>
          <strong>נקודות</strong> כמה זה הניב
        </p>
      </div>
    </>
  )
}
