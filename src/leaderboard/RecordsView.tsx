import { useState } from 'react'
import './RecordsView.css'
import { buildRecords } from './recordsStats'
import type { RecordCategory, RecordEntry } from './recordsStats'
import { MEDALS } from './medals'
import { competitionRanks } from './rank'
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

export default function RecordsView({ users, results, me }: {
  users: User[]
  results: TournamentResults
  me?: string
}) {
  const cats = buildRecords(users, results, me)
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
    </div>
  )
}
