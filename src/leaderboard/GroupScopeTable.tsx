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
  { key: 'matchPoints',     label: 'משחקים',  value: r => r.matchPoints,      zone: 'points', zoneEdge: true },
  { key: 'goalsPoints',     label: 'שערים',   value: r => r.goalsPoints,      zone: 'points' },
  { key: 'total',           label: 'בטווח',   value: r => r.total,            zone: 'points' },
  { key: 'tournamentTotal', label: 'בטורניר', value: r => r.tournamentTotal,  zone: 'points' },
]

function makeVariant(pointCols: Col[], defaultSort: GroupSortBy, mobilePointCols: Col[]) {
  return {
    desktop: [...HIT_COLS, ...pointCols],
    mobile: [
      { ...HIT_COLS[0], label: 'פגיעה' },
      { ...HIT_COLS[1], label: 'צליפה' },
      ...mobilePointCols,
    ],
    pointCols,
    defaultSort,
  }
}

const COLS = {
  group: makeVariant(POINT_COLS, 'total', [
    { ...POINT_COLS[POINT_COLS.length - 1], label: 'נקודות', zoneEdge: true },
  ]),
  // window scopes (last-X, as-of game N, range) split points into in-range
  // (משחקים/שערים/בטווח) plus the full-tournament total (בטורניר) for context
  window: makeVariant(LASTX_POINT_COLS, 'total', [
    { key: 'total',           label: 'בטווח',   value: r => r.total,           zone: 'points', zoneEdge: true },
    { key: 'tournamentTotal', label: 'בטורניר', value: r => r.tournamentTotal, zone: 'points' },
  ]),
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

function MoveCell({ delta }: { delta: number | null | undefined }) {
  if (delta == null || delta === 0) return <td className="lb-td lb-td--move"><span className="lb-move lb-move--none">–</span></td>
  const up = delta > 0
  return (
    <td className="lb-td lb-td--move">
      <span className={`lb-move ${up ? 'lb-move--up' : 'lb-move--down'}`}>
        {up ? '▲' : '▼'} {Math.abs(delta)}
      </span>
    </td>
  )
}

// Compact movement indicator tucked under the rank number — used on mobile,
// where a dedicated תזוזה column won't fit alongside the score columns.
function InlineMove({ delta }: { delta: number | null | undefined }) {
  if (delta == null || delta === 0) return null
  const up = delta > 0
  return (
    <span className={`lb-move-inline ${up ? 'lb-move--up' : 'lb-move--down'}`}>
      {up ? '▲' : '▼'}{Math.abs(delta)}
    </span>
  )
}

function ScopeRows({ rows, ranks, cols, delayMs, movements, inlineMovement, me }: { rows: GroupScopeRow[]; ranks: number[]; cols: Col[]; delayMs: number; movements?: Record<string, number | null>; inlineMovement?: boolean; me?: string }) {
  return rows.map((row, i) => {
    const rank = ranks[i]
    const rankClass = rank <= 3 ? `lb-row--rank-${rank}` : 'lb-row--other'
    const isMe = row.label === me
    return (
      <tr
        key={row.label}
        className={`lb-row ${rankClass}${isMe ? ' lb-row--me' : ''}`}
        style={{ '--delay': `${i * delayMs}ms` } as React.CSSProperties}
      >
        <td className="lb-td lb-td--rank">
          <span className="lb-rank-num">{rank <= 3 ? MEDALS[rank] : rank}</span>
          {inlineMovement && movements && <InlineMove delta={movements[row.label]} />}
        </td>
        <td className="lb-td lb-td--name">
          {row.label}
          {isMe && <span className="lb-me-badge">אני</span>}
        </td>
        {movements && !inlineMovement && <MoveCell delta={movements[row.label]} />}
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

export default function GroupScopeTable({ rows, variant = 'group', movements, me }: { rows: GroupScopeRow[]; variant?: keyof typeof COLS; movements?: Record<string, number | null>; me?: string }) {
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
              {movements && <th className="lb-th lb-th--move" rowSpan={2}>תזוזה</th>}
              <th className="lb-th lb-th--phase lb-th--phase-hits" colSpan={HIT_COLS.length}>ניחושים נכונים</th>
              <th className="lb-th lb-th--phase lb-th--phase-points lb-zone-edge" colSpan={cols.pointCols.length}>נקודות</th>
            </tr>
            <tr>
              <SortableThs cols={cols.desktop} sortCol={sortCol} onSortCol={setSortCol} />
            </tr>
          </thead>
          <tbody>
            <ScopeRows rows={sortedRows} ranks={ranks} cols={cols.desktop} delayMs={90} movements={movements} me={me} />
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
            <ScopeRows rows={sortedRows} ranks={ranks} cols={cols.mobile} delayMs={60} movements={movements} inlineMovement me={me} />
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
