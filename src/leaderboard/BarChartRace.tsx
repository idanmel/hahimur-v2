import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { RaceFrame } from './raceFrames'
import './BarChartRace.css'

const BAR_H = 24
const GAP = 6
const ROW = BAR_H + GAP
const PAD = { top: 6, bottom: 6 }
const NAME_W = 124   // right-hand gutter: avatar + bettor name
const VALUE_W = 36   // left-hand margin: the running total at the bar's tip
const AVATAR = 16

// Per-match pacing. Each match gets time proportional to how much the standings
// reshuffle on it, so busy early rounds breathe and quiet late ones don't drag.
const BASE_MS = 640
const MIN_W = 0.5
const MAX_W = 2.6
const ACT_SCALE = 26   // total rank-distance that counts as "one match worth" of motion

// Each segment is spent moving for the first MOVE_FRAC of its time, then held
// perfectly still for the rest. Without the hold the bars never stop sliding and
// the eye has nothing to land on; with it, every match resolves to a readable,
// stationary standings before the next one starts shuffling.
const MOVE_FRAC = 0.7

// The dial is labelled in familiar 0.5×/1×/2× terms, but each maps to a much
// slower real multiplier than the label suggests — the race was too fast to
// follow. The middle (default) sits at the pace that reads best; the other two
// are gentle steps slower and faster around it.
const SPEEDS = [
  { label: '1×', mult: 0.25 },
  { label: '2×', mult: 0.4 },
] as const
const DEFAULT_MULT = 0.25

interface Engine {
  labels: string[]
  values: number[][] // values[frame][labelIndex] — cumulative total
  ranks: number[][]  // ranks[frame][labelIndex] — 0 = leader, for smooth reordering
  T: number[]        // T[frame] = animation start time of that frame (ms, 1×)
  dur: number[]      // dur[i] = duration of segment frame i → i+1
  total: number      // total animation time at 1×
  N: number
}

function buildEngine(frames: RaceFrame[]): Engine {
  const N = frames.length
  const labels = (frames[N - 1]?.bars ?? []).map(b => b.label)
  const idxOf = new Map(labels.map((l, i) => [l, i]))
  const values = frames.map(f => {
    const row = new Array(labels.length).fill(0)
    for (const b of f.bars) row[idxOf.get(b.label) ?? 0] = b.total
    return row
  })
  // rank of each label within each frame (0 = leader). Ties are broken by the
  // previous frame's order, not by a fixed index: when a climber gains points and
  // merely *reaches* the bettor above, that bettor keeps the higher slot and the
  // climber settles just beneath — so a tie never triggers a needless swap.
  const ranks: number[][] = []
  let prevRank = labels.map((_, i) => i)
  for (let fi = 0; fi < N; fi++) {
    const order = labels.map((_, i) => i)
      .sort((a, b) => values[fi][b] - values[fi][a] || prevRank[a] - prevRank[b] || a - b)
    const r = new Array(labels.length).fill(0)
    order.forEach((labelIdx, rank) => { r[labelIdx] = rank })
    ranks.push(r)
    prevRank = r
  }
  const dur: number[] = []
  for (let i = 0; i < N - 1; i++) {
    let activity = 0
    for (let k = 0; k < labels.length; k++) activity += Math.abs(ranks[i + 1][k] - ranks[i][k])
    const weight = Math.min(MAX_W, Math.max(MIN_W, MIN_W + activity / ACT_SCALE))
    dur.push(BASE_MS * weight)
  }
  const T = [0]
  for (let i = 0; i < dur.length; i++) T.push(T[i] + dur[i])
  return { labels, values, ranks, T, dur, total: T[N - 1] ?? 0, N }
}

function positionFromElapsed(elapsed: number, eng: Engine): number {
  if (eng.N <= 1 || elapsed <= 0) return 0
  if (elapsed >= eng.total) return eng.N - 1
  let i = 0
  while (i < eng.dur.length && eng.T[i + 1] <= elapsed) i++
  return i + (elapsed - eng.T[i]) / eng.dur[i]
}

interface Props {
  frames: RaceFrame[]
  colors: Record<string, string>
  avatars?: Record<string, string>
  me?: string
  rival?: string
  autoPlay?: boolean
}

export default function BarChartRace({ frames, colors, avatars, me, rival, autoPlay = true }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const elapsedRef = useRef(0)
  const dispRef = useRef(0)

  const [width, setWidth] = useState(0)
  const [playing, setPlaying] = useState(autoPlay)
  const [speed, setSpeed] = useState<number>(DEFAULT_MULT)
  const [displayFrame, setDisplayFrame] = useState(0)

  const eng = useMemo(() => buildEngine(frames), [frames])
  const nBettors = eng.labels.length
  const height = PAD.top + nBettors * ROW + PAD.bottom
  const lastFrame = Math.max(eng.N - 1, 0)

  useEffect(() => {
    const measure = () => setWidth(wrapRef.current?.clientWidth || 0)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Draw the standings at a given animation time. Bars start at the right edge
  // (RTL) and grow leftward; the x-scale rescales to the current leader each
  // tick, so the field always fills the width and the story is the reordering.
  const renderAt = useCallback((elapsed: number) => {
    const svg = svgRef.current
    if (!svg || eng.N === 0) return
    const chartW = width || 360
    const xStart = chartW - NAME_W
    const innerW = Math.max(xStart - VALUE_W, 10)

    const p = positionFromElapsed(elapsed, eng)
    const i = Math.min(Math.floor(p), eng.N - 1)
    const j = Math.min(i + 1, eng.N - 1)
    // Compress the raw segment progress into the move window and ease it, so the
    // points are added and the order resolves over the first half of the segment
    // (decelerating into place), then f pins at 1 — bars hold still — for the rest.
    const f = d3.easeCubicOut(Math.min((p - i) / MOVE_FRAC, 1))
    // Both the value (bar length) and the rank (vertical slot) are interpolated
    // across the move window. Interpolating rank between the two frames' *settled*
    // orderings — rather than re-sorting the in-between values every tick — makes
    // bars glide past each other smoothly instead of snapping when totals cross.
    const cur = eng.labels.map((label, idx) => ({
      label, idx,
      value: eng.values[i][idx] + (eng.values[j][idx] - eng.values[i][idx]) * f,
      y: PAD.top + (eng.ranks[i][idx] * (1 - f) + eng.ranks[j][idx] * f) * ROW,
    }))
    const maxV = Math.max(1, ...cur.map(d => d.value))
    const len = (v: number) => (v / maxV) * innerW

    d3.select(svg).select<SVGGElement>('g.bcr-bars')
      .selectAll<SVGGElement, typeof cur[number]>('g.bcr-bar')
      .data(cur, d => d.label)
      .join(enter => {
        const g = enter.append('g').attr('class', 'bcr-bar')
        g.append('rect').attr('class', 'bcr-rect').attr('height', BAR_H).attr('rx', 2)
        g.append('text').attr('class', 'bcr-value').attr('y', BAR_H / 2).attr('dy', '0.35em').attr('text-anchor', 'end')
        g.append('text').attr('class', 'bcr-name').attr('y', BAR_H / 2).attr('dy', '0.35em').attr('text-anchor', 'end')
          .text(d => d.label)
        g.filter(d => !!avatars?.[d.label]).append('image').attr('class', 'bcr-avatar')
          .attr('width', AVATAR).attr('height', AVATAR).attr('y', (BAR_H - AVATAR) / 2)
          .attr('clip-path', 'inset(0% round 50%)')
          .attr('href', d => avatars![d.label])
        return g
      })
      .classed('bcr-bar--me', d => d.label === me)
      .classed('bcr-bar--rival', d => d.label === rival)
      .attr('transform', d => `translate(0, ${d.y})`)
      .each(function (d) {
        const g = d3.select(this)
        const barLen = len(d.value)
        const tipX = xStart - barLen
        const hasAvatar = !!avatars?.[d.label]
        const nameRight = hasAvatar ? chartW - AVATAR - 7 : chartW - 5
        // "You" gets a deep-navy bar and your rival a pink one — both unmistakable
        // in a field of bright categorical colors. Set here (not on enter) so the
        // override follows a late pick from the "מי אתה?" dropdown.
        const fill = d.label === me ? 'var(--navy)'
          : d.label === rival ? 'var(--pink)'
          : (colors[d.label] ?? 'var(--navy)')
        g.select('rect.bcr-rect').attr('x', tipX).attr('width', barLen).attr('fill', fill)
        g.select('text.bcr-value').attr('x', tipX - 5).text(Math.round(d.value))
        g.select('text.bcr-name').attr('x', nameRight)
        if (hasAvatar) g.select('image.bcr-avatar').attr('x', chartW - AVATAR - 3)
      })
  }, [eng, width, colors, avatars, me, rival])

  // Static redraw when paused / scrubbed / resized / data changed.
  useEffect(() => { renderAt(elapsedRef.current) }, [renderAt, displayFrame])

  // The playback clock. rAF advances animation time by wall-time × speed and
  // redraws; React state only flips at whole-match boundaries (for the date
  // counter and scrubber), keeping re-renders rare while the motion stays smooth.
  useEffect(() => {
    if (!playing || eng.total === 0) return
    let raf = 0
    let lastNow = performance.now()
    const tick = (now: number) => {
      elapsedRef.current = Math.min(elapsedRef.current + (now - lastNow) * speed, eng.total)
      lastNow = now
      renderAt(elapsedRef.current)
      const di = Math.round(positionFromElapsed(elapsedRef.current, eng))
      if (di !== dispRef.current) { dispRef.current = di; setDisplayFrame(di) }
      if (elapsedRef.current >= eng.total) { setPlaying(false); return }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed, eng, renderAt])

  if (eng.N === 0) {
    return <p className="bcr-empty" dir="rtl">עדיין אין משחקים ששוחקו — המירוץ יתחיל עם המשחק הראשון.</p>
  }

  const frame = frames[Math.min(displayFrame, lastFrame)]
  const atEnd = displayFrame >= lastFrame
  const seek = (idx: number) => {
    setPlaying(false)
    elapsedRef.current = eng.T[idx] ?? 0
    dispRef.current = idx
    setDisplayFrame(idx)
  }
  const togglePlay = () => {
    if (atEnd) { elapsedRef.current = 0; dispRef.current = 0; setDisplayFrame(0); setPlaying(true) }
    else setPlaying(p => !p)
  }

  return (
    <div className="bcr" dir="rtl">
      <div className="bcr-counter">
        <span className="bcr-counter-date" data-testid="bcr-date">{frame.date}</span>
        <span className="bcr-counter-match">{frame.matchLabel}</span>
      </div>

      <div className="bcr-stage" ref={wrapRef}>
        <svg ref={svgRef} className="bcr-svg" width={width || 360} height={height}
          role="img" aria-label="מירוץ ניקוד המנחשים לאורך הטורניר">
          <g className="bcr-bars" />
        </svg>
      </div>

      <div className="bcr-controls">
        <button type="button" className="bcr-play" onClick={togglePlay} aria-label={atEnd ? 'התחל מחדש' : playing ? 'השהה' : 'נגן'}>
          {atEnd ? '↻' : playing ? '❚❚' : '►'}
        </button>
        <input type="range" className="bcr-scrub" min={0} max={lastFrame} value={Math.min(displayFrame, lastFrame)}
          aria-label="מיקום בזמן" onChange={e => seek(Number(e.target.value))} />
        <div className="bcr-speeds" role="group" aria-label="מהירות">
          {SPEEDS.map(s => (
            <button key={s.label} type="button" className={`bcr-speed${speed === s.mult ? ' bcr-speed--active' : ''}`}
              onClick={() => setSpeed(s.mult)}>{s.label}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
