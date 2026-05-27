import PageLayout from '../shared/PageLayout'
import { USERS_SORTED } from '../users/index'
import { calculatePointsBreakdown } from './points'
import type { PointsBreakdown } from './points'
import * as results from '../results'
import './LeaderboardPage.css'

interface Row extends PointsBreakdown {
  label: string
}

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default function LeaderboardPage() {
  const rows: Row[] = USERS_SORTED.map(user => ({
    label: user.label,
    ...calculatePointsBreakdown(user.predictions, results.predictions),
  })).sort((a, b) => b.total - a.total)

  return (
    <PageLayout title="לוח המובילים">
      <div className="lb-page" dir="rtl">
        <div className="lb-scroll">
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
      </div>
    </PageLayout>
  )
}
