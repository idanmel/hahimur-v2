// A single bettor's rank over the played matches, drawn as an editorial
// "form line": navy ink on parchment, a faded area beneath, and a gold marker
// for where they stand now. The vertical span auto-fits to the ranks actually
// held so even a 1↔4 swing fills the frame. Numbers live in the caption below,
// keeping the line itself clean.
// viewBox in pixel-like units (≈1:1 on a phone) with preserveAspectRatio "meet"
// so the markers stay perfectly round instead of stretching into ellipses.
const W = 340
const H = 90
const PAD_X = 14
const PAD_Y = 16

export default function RankTrajectoryChart({ ranks }: { ranks: number[] }) {
  const best = Math.min(...ranks)
  const worst = Math.max(...ranks)
  const current = ranks[ranks.length - 1]
  const last = ranks.length - 1

  const x = (i: number) => ranks.length <= 1 ? W / 2 : PAD_X + (i / last) * (W - 2 * PAD_X)
  const y = (rank: number) => worst === best ? H / 2 : PAD_Y + ((rank - best) / (worst - best)) * (H - 2 * PAD_Y)

  const linePoints = ranks.map((rank, i) => `${x(i)},${y(rank)}`).join(' ')
  const areaPoints = `${x(0)},${H} ${linePoints} ${x(last)},${H}`

  // Key points worth labelling: the endpoints (start + current) and any turning
  // point, where the line reverses direction. Monotonic runs get just the ends.
  const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0)
  const keyPoints = new Set<number>([0, last])
  for (let i = 1; i < last; i++) {
    const before = sign(ranks[i] - ranks[i - 1])
    const after = sign(ranks[i + 1] - ranks[i])
    if (before !== 0 && after !== 0 && before !== after) keyPoints.add(i)
  }

  return (
    <div className="lb-traj">
      <svg
        className="lb-traj-chart"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="מסלול הדירוג לאורך המשחקים"
      >
        <defs>
          <linearGradient id="lb-traj-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0B2244" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#0B2244" stopOpacity="0" />
          </linearGradient>
        </defs>

        <polygon className="lb-traj-area" points={areaPoints} />
        <polyline
          data-testid="lb-traj-line"
          className="lb-traj-line"
          points={linePoints}
          fill="none"
          pathLength={1}
        />
        {ranks.map((rank, i) => (
          <circle key={i} className="lb-traj-dot" cx={x(i)} cy={y(rank)} r={2.6} />
        ))}
        <circle className="lb-traj-now" cx={x(last)} cy={y(current)} r={4.5} />
        {ranks.map((rank, i) =>
          keyPoints.has(i) ? (
            <text
              key={i}
              className="lb-traj-keylabel"
              x={x(i)}
              y={y(rank) <= H / 2 ? y(rank) - 9 : y(rank) + 17}
              textAnchor="middle"
            >{rank}</text>
          ) : null
        )}
      </svg>

      <dl className="lb-traj-stats" data-testid="lb-traj-caption">
        <div className="lb-traj-stat">
          <dd className="lb-traj-stat-num">{best}</dd>
          <dt className="lb-traj-stat-label">שיא</dt>
        </div>
        <div className="lb-traj-stat">
          <dd className="lb-traj-stat-num">{worst}</dd>
          <dt className="lb-traj-stat-label">שפל</dt>
        </div>
        <div className="lb-traj-stat lb-traj-stat--now">
          <dd className="lb-traj-stat-num">{current}</dd>
          <dt className="lb-traj-stat-label">עכשיו</dt>
        </div>
      </dl>
    </div>
  )
}
