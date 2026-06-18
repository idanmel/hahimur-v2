/**
 * Win-probability HISTORY: reconstructs the win% of every contestant from
 * "before the tournament" (0 matches) through each played match, in
 * chronological order. Because it rebuilds deterministically from the known
 * results, the curve always covers match-0 → now and auto-extends as new
 * matches are played. Output: a line chart (per contestant) + a table.
 */
import { runSims, he } from './sim-core'
import { USERS } from './src/users'
import type { PlayedFixture } from './live-results'
import type { PredictionsState } from './src/shared/types'

export interface HistorySnapshot {
  step: number          // 0 = before tournament
  label: string         // the match that was added at this step (or "לפני הטורניר")
  kickoff: number       // epoch ms of that match (0 for step 0)
  win: Record<string, number>  // label -> win %
}

export function buildHistory(order: PlayedFixture[], n: number, seed: number): HistorySnapshot[] {
  const snaps: HistorySnapshot[] = []
  for (let k = 0; k <= order.length; k++) {
    const played: PredictionsState = {}
    for (let i = 0; i < k; i++) played[order[i].id] = order[i].scores
    const agg = runSims(played, n, seed)
    const win: Record<string, number> = {}
    for (const u of USERS) win[u.label] = (agg.win.get(u.label)! / n) * 100
    const last = k === 0 ? null : order[k - 1]
    const label = last ? `${he(last.home)} ${last.scores.home}-${last.scores.away} ${he(last.away)}` : 'לפני הטורניר'
    snaps.push({ step: k, label, kickoff: last ? last.kickoff : 0, win })
  }
  return snaps
}

// ---- HTML report -----------------------------------------------------------
const COLORS = (i: number, total: number) => {
  const hue = Math.round((360 * i) / Math.max(total, 1))
  return `hsl(${hue} 70% 60%)`
}

export function buildHistoryHtml(snaps: HistorySnapshot[], meta: { n: number; updatedAt: Date; live?: boolean }): string {
  const labels = USERS.map(u => u.label)
  const last = snaps[snaps.length - 1].win
  const ranked = [...labels].sort((a, b) => last[b] - last[a])

  // chart datasets (per contestant); only top 6 visible initially
  const datasets = ranked.map((lbl, idx) => {
    const color = COLORS(idx, ranked.length)
    return {
      label: lbl,
      data: snaps.map(s => Number(s.win[lbl].toFixed(2))),
      borderColor: color,
      backgroundColor: color,
      borderWidth: idx < 6 ? 3 : 1.5,
      tension: 0.25,
      pointRadius: 2,
      hidden: idx >= 6,
    }
  })
  const xLabels = snaps.map(s => (s.step === 0 ? 'התחלה' : `${s.step}`))
  const xTitles = snaps.map(s => s.label)

  // table: rows = contestants (by latest), cols = snapshots
  const headCols = snaps.map(s =>
    `<th title="${s.label.replace(/"/g, '&quot;')}">${s.step === 0 ? 'התחלה' : s.step}</th>`).join('')
  const bodyRows = ranked.map((lbl, ri) => {
    const cells = snaps.map((s, si) => {
      const v = s.win[lbl]
      const prev = si > 0 ? snaps[si - 1].win[lbl] : v
      const d = v - prev
      const arrow = si === 0 ? '' : d > 0.3 ? '<span class="up">▲</span>' : d < -0.3 ? '<span class="dn">▼</span>' : ''
      const strong = si === snaps.length - 1 ? ' class="cur"' : ''
      return `<td${strong}>${v.toFixed(1)} ${arrow}</td>`
    }).join('')
    return `      <tr>
        <td class="rk">${ri + 1}</td>
        <td class="nm">${lbl}</td>
${'        ' + cells}
      </tr>`
  }).join('\n')

  const legendRows = snaps.filter(s => s.step > 0)
    .map(s => `<li><b>${s.step}.</b> ${s.label}</li>`).join('')

  const liveBadge = meta.live ? '<span class="badge">● LIVE</span> • ' : ''

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>היסטוריית הסתברות זכייה — משחק 1</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; padding:24px; font-family:"Segoe UI",Arial,sans-serif; background:#0f1117; color:#e8eaf0; line-height:1.5; }
  h1 { font-size:24px; margin:0 0 4px; }
  .sub { color:#9aa3b2; font-size:13px; margin-bottom:16px; }
  .badge { color:#22d3ee; font-weight:700; }
  a.nav { display:inline-block; margin-bottom:16px; background:#2563eb; color:#fff; text-decoration:none; padding:8px 16px; border-radius:8px; font-weight:600; font-size:14px; }
  a.nav:hover { background:#1d4ed8; }
  .chart-box { background:#1a1d27; border:1px solid #2a2f3d; border-radius:12px; padding:16px; margin-bottom:20px; }
  .chart-box canvas { max-height:460px; }
  .hint { color:#9aa3b2; font-size:12px; margin:8px 2px 0; }
  .scroll { overflow-x:auto; border-radius:12px; }
  table { border-collapse:collapse; background:#1a1d27; font-size:13px; min-width:100%; }
  thead th { background:#232838; color:#cdd3e0; padding:8px 10px; font-weight:600; white-space:nowrap; text-align:center; }
  thead th:nth-child(-n+2) { position:sticky; right:0; background:#232838; z-index:2; }
  tbody td { padding:7px 10px; border-top:1px solid #262b38; text-align:center; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .rk { color:#aab2c2; font-weight:700; }
  .nm { text-align:right; font-weight:600; white-space:nowrap; position:sticky; right:34px; background:#1a1d27; }
  td.rk { position:sticky; right:0; background:#1a1d27; }
  tbody tr:hover td { background:#20242f; }
  tbody tr:hover .nm, tbody tr:hover td.rk { background:#20242f; }
  td.cur { color:#ffd54a; font-weight:700; }
  .up { color:#4ade80; font-size:10px; } .dn { color:#f87171; font-size:10px; }
  .legend { columns:2; gap:24px; color:#c4cbd8; font-size:13px; margin-top:14px; }
  .legend ul { margin:0; padding-inline-start:18px; }
  details { margin-top:14px; background:#1a1d27; border:1px solid #2a2f3d; border-radius:10px; padding:10px 14px; }
  summary { cursor:pointer; color:#cdd3e0; font-weight:600; }
</style>
</head>
<body>
  <h1>היסטוריית הסתברות זכייה — משחק 1</h1>
  <div class="sub">${liveBadge}שחזור מלא: לפני הטורניר → אחרי כל משחק • ${meta.n.toLocaleString()} ריצות לכל נקודה • עודכן: ${meta.updatedAt.toLocaleString('he-IL')}</div>
  <a class="nav" href="/">→ חזרה לטבלה הראשית</a>

  <div class="chart-box">
    <canvas id="chart"></canvas>
    <div class="hint">ציר X: 0 = לפני הטורניר, ואז מספר המשחק לפי הסדר הכרונולוגי. כברירת מחדל מוצגים 6 המובילים — לחץ על שם בלגנדה כדי להוסיף/להסתיר מתמודד.</div>
  </div>

  <div class="scroll">
    <table>
      <thead><tr><th>#</th><th>מתמודד</th>${headCols}</tr></thead>
      <tbody>
${bodyRows}
      </tbody>
    </table>
  </div>

  <details>
    <summary>מקרא המשחקים (מספר ← משחק)</summary>
    <div class="legend"><ul>${legendRows}</ul></div>
  </details>

  <script>
    const xTitles = ${JSON.stringify(xTitles)};
    new Chart(document.getElementById('chart'), {
      type: 'line',
      data: { labels: ${JSON.stringify(xLabels)}, datasets: ${JSON.stringify(datasets)} },
      options: {
        responsive: true,
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
          legend: { labels: { color: '#cdd3e0', boxWidth: 12, font: { size: 11 } } },
          tooltip: { callbacks: { title: (items) => xTitles[items[0].dataIndex] } },
        },
        scales: {
          x: { ticks: { color: '#9aa3b2' }, grid: { color: '#222' } },
          y: { ticks: { color: '#9aa3b2', callback: (v) => v + '%' }, grid: { color: '#222' }, title: { display: true, text: 'סיכוי זכייה', color: '#9aa3b2' } },
        },
      },
    });
  </script>
</body>
</html>`
}
