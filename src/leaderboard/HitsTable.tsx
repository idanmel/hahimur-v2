import React, { useState } from 'react'
import { HITS_SORTERS } from './leaderboardRows'
import type { HitsRow, HitsSortBy } from './leaderboardRows'
import { MEDALS } from './LeaderboardTable'

const COLS: Array<{ key: HitsSortBy; label: string; thClass: string }> = [
  { key: 'pgiya', label: 'פגיעות', thClass: 'lb-th--round' },
  { key: 'tzelifa', label: 'צליפות', thClass: 'lb-th--round' },
  { key: 'combined', label: 'סה"כ', thClass: 'lb-th--total' },
]

function HitsRows({ rows, delayMs }: { rows: HitsRow[]; delayMs: number }) {
  return rows.map((row, i) => {
    const rank = i + 1
    const rankClass = rank <= 3 ? `lb-row--rank-${rank}` : 'lb-row--other'
    return (
      <tr
        key={row.label}
        className={`lb-row ${rankClass}`}
        style={{ '--delay': `${i * delayMs}ms` } as React.CSSProperties}
      >
        <td className="lb-td lb-td--rank">{rank <= 3 ? MEDALS[rank] : rank}</td>
        <td className="lb-td lb-td--name">{row.label}</td>
        <td className="lb-td lb-td--scope-col">{row.pgiyaCount || '—'}</td>
        <td className="lb-td lb-td--scope-col">{row.tzelifaCount || '—'}</td>
        <td className="lb-td lb-td--total">{row.pgiyaCount + row.tzelifaCount || '—'}</td>
      </tr>
    )
  })
}

function HitsHeader({ sortCol, onSortCol }: {
  sortCol: HitsSortBy
  onSortCol: (col: HitsSortBy) => void
}) {
  return (
    <tr>
      <th className="lb-th lb-th--rank">#</th>
      <th className="lb-th lb-th--name">מהמר</th>
      {COLS.map(({ key, label, thClass }) => (
        <th
          key={key}
          className={`lb-th ${thClass}`}
          aria-sort={sortCol === key ? 'descending' : undefined}
        >
          <button
            type="button"
            className={`lb-th-sort-btn${sortCol === key ? ' lb-th-sort-btn--active' : ''}`}
            onClick={() => onSortCol(key)}
          >{label}</button>
        </th>
      ))}
    </tr>
  )
}

export default function HitsTable({ rows }: { rows: HitsRow[] }) {
  const [sortCol, setSortCol] = useState<HitsSortBy>('combined')
  const sortedRows = [...rows].sort(HITS_SORTERS[sortCol])

  return (
    <>
      <div className="lb-scroll lb-desktop">
        <table className="lb-table">
          <thead>
            <HitsHeader sortCol={sortCol} onSortCol={setSortCol} />
          </thead>
          <tbody>
            <HitsRows rows={sortedRows} delayMs={90} />
          </tbody>
        </table>
      </div>

      <div className="lb-mobile">
        <table className="lb-table lb-table--mobile">
          <thead>
            <HitsHeader sortCol={sortCol} onSortCol={setSortCol} />
          </thead>
          <tbody>
            <HitsRows rows={sortedRows} delayMs={60} />
          </tbody>
        </table>
      </div>
    </>
  )
}
