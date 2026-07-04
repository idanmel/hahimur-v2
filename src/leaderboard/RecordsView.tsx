import { useMemo, useState } from 'react'
import './RecordsView.css'
import { buildRecords, buildKnockoutStageRecords } from './recordsStats'
import type { RecordCategory, RecordEntry, StageRecords } from './recordsStats'
import { MEDALS } from './medals'
import { competitionRanks } from './rank'
import { realPlayedState } from './winprob/realPlayed'
import { useWinProbabilities } from './winprob/useWinProbabilities'
import type { TournamentResults } from '../shared/types'
import type { User } from '../users'

// The bettors tied for the top value (entries arrive sorted, highest first).
function topTied(entries: RecordEntry[]): RecordEntry[] {
  if (entries.length === 0) return []
  return entries.filter(e => e.value === entries[0].value)
}

// A single standing line inside a record card, with a bar scaled to the leader.
function Row({ entry, rank, unit, max }: { entry: RecordEntry; rank: number; unit: string; max: number }) {
  const rankClass = rank <= 3 ? `rec-row--rank-${rank}` : ''
  return (
    <li className={`rec-row ${rankClass}${entry.isMe ? ' rec-row--me' : ''}`}>
      <span className="rec-medal">{rank <= 3 ? MEDALS[rank] : rank}</span>
      <span className="rec-name">
        {entry.label}
        {entry.isMe && <span className="rec-me-badge">אני</span>}
      </span>
      <span className="rec-bar-wrap" aria-hidden="true">
        <span className="rec-bar" style={{ width: max > 0 ? `${(entry.value / max) * 100}%` : '0%' }} />
      </span>
      <span className="rec-val">
        {entry.value}<span className="rec-unit">{unit}</span>
      </span>
    </li>
  )
}

// One record, as a card. Collapsed it shows the top three plus — when the viewer
// isn't already there — their own standing, so everyone sees where they sit.
// Clicking the card opens the full ranked list.
function RecordCard({ cat, me }: { cat: RecordCategory; me?: string }) {
  const [open, setOpen] = useState(false)
  const ranks = competitionRanks(cat.entries, e => e.value)
  const max = cat.entries[0]?.value ?? 0
  const myIndex = cat.entries.findIndex(e => e.isMe)
  const meOutsideTop = myIndex >= 3

  const empty = cat.entries.length === 0
  const expandable = cat.entries.length > 3 || (meOutsideTop && !!me)

  return (
    <article className={`rec-card${open ? ' rec-card--open' : ''}`}>
      <button
        type="button"
        className="rec-card-head"
        aria-expanded={open}
        disabled={!expandable}
        onClick={() => setOpen(o => !o)}
      >
        <span className="rec-emblem" aria-hidden="true">{cat.emoji}</span>
        <span className="rec-card-titles">
          <span className="rec-card-title">{cat.title}</span>
          <span className="rec-card-blurb">{cat.blurb}</span>
        </span>
        {expandable && <span className="rec-card-chevron" aria-hidden="true">›</span>}
      </button>

      {empty ? (
        <p className="rec-card-empty">טרם נרשמו נתונים</p>
      ) : open ? (
        <ol className="rec-list">
          {cat.entries.map((e, i) => <Row key={e.label} entry={e} rank={ranks[i]} unit={cat.unit} max={max} />)}
        </ol>
      ) : (
        <>
          <ol className="rec-list">
            {cat.entries.slice(0, 3).map((e, i) => <Row key={e.label} entry={e} rank={ranks[i]} unit={cat.unit} max={max} />)}
          </ol>
          {meOutsideTop && (
            <ol className="rec-list rec-list--me">
              <li className="rec-gap" aria-hidden="true">⋯</li>
              <Row entry={cat.entries[myIndex]} rank={ranks[myIndex]} unit={cat.unit} max={max} />
            </ol>
          )}
        </>
      )}

      {expandable && (
        <button type="button" className="rec-more" onClick={() => setOpen(o => !o)}>
          {open ? 'הצג פחות' : `כל המדורגים (${cat.entries.length})`}
        </button>
      )}
    </article>
  )
}

// The marquee record: the overall points leader, plus the viewer's own rank.
function Hero({ cat }: { cat: RecordCategory }) {
  const champs = topTied(cat.entries)
  if (champs.length === 0) return null
  const ranks = competitionRanks(cat.entries, e => e.value)
  const myIndex = cat.entries.findIndex(e => e.isMe)
  const meIsChampion = champs.some(c => c.isMe)

  return (
    <div className="rec-hero">
      <span className="rec-hero-crown" aria-hidden="true">👑</span>
      <span className="rec-hero-kicker">מלך הניקוד</span>
      <span className={`rec-hero-name${meIsChampion ? ' rec-hero-name--me' : ''}`}>
        {champs.map(c => c.label).join(' · ')}
      </span>
      <span className="rec-hero-value">
        {champs[0].value}<span className="rec-hero-unit">{cat.unit}</span>
      </span>
      {myIndex >= 0 && !meIsChampion && (
        <span className="rec-hero-me">
          המקום שלך
          <b>#{ranks[myIndex]}</b>
          <span className="rec-hero-me-val">{cat.entries[myIndex].value} {cat.unit}</span>
        </span>
      )}
    </div>
  )
}

// Per-knockout-stage records: a stage switcher (defaulting to the deepest stage
// reached, since that's the freshest race) over the same card grid, so each
// knockout round gets its own leaderboard alongside the cumulative one above.
function KnockoutStageRecords({ stages, me }: { stages: StageRecords[]; me?: string }) {
  const latest = stages[stages.length - 1].key
  const [active, setActive] = useState<string>(latest)
  const current = stages.find(s => s.key === active) ?? stages[stages.length - 1]

  return (
    <section className="rec-stage" dir="rtl">
      <div className="rec-stage-head">
        <h3 className="rec-stage-title">🏟️ שיאים לפי שלב נוקאאוט</h3>
        <p className="rec-stage-sub">מי הוביל בכל שלב בנפרד — נקודות, צליפות, פגיעות והצלבות של אותו שלב בלבד.</p>
      </div>
      <div className="rec-stage-tabs" role="tablist" aria-label="שלב נוקאאוט">
        {stages.map(s => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={s.key === current.key}
            className={`rec-stage-tab${s.key === current.key ? ' rec-stage-tab--active' : ''}`}
            onClick={() => setActive(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="rec-grid">
        {current.categories.map(c => <RecordCard key={c.key} cat={c} me={me} />)}
      </div>
    </section>
  )
}

export default function RecordsView({ users, results, me }: {
  users: User[]
  results: TournamentResults
  me?: string
}) {
  // Same Monte-Carlo inputs as the crossings tab, so a 100%-certain knockout
  // pairing counts toward the crossings record (and the cache is shared). Feed the
  // odds in only once ready, mirroring computeUserCrossings' rule everywhere else.
  const played = useMemo(() => realPlayedState(results), [results])
  const { status, crossingProbByMatch } = useWinProbabilities(played, results.playerGoals ?? {})
  const probByMatch = status === 'ready' ? crossingProbByMatch : {}

  const cats = buildRecords(users, results, me, probByMatch)
  const stageRecords = buildKnockoutStageRecords(users, results, me, probByMatch)
  const points = cats.find(c => c.key === 'points')
  const cards = cats.filter(c => c.key !== 'points')
  const anyData = cats.some(c => c.entries.length > 0)

  if (!anyData) {
    return (
      <div className="rec-view rec-view--empty">
        <div className="rec-empty-icon">🏆</div>
        <p className="rec-empty-text">טרם נקבעו שיאים — העמוד יתמלא עם תחילת המשחקים</p>
      </div>
    )
  }

  return (
    <div className="rec-view">
      {points && points.entries.length > 0 && <Hero cat={points} />}
      <div className="rec-grid">
        {cards.map(c => <RecordCard key={c.key} cat={c} me={me} />)}
      </div>
      {stageRecords.length > 0 && <KnockoutStageRecords stages={stageRecords} me={me} />}
    </div>
  )
}
