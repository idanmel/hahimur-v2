import type { KnockoutMatch, KnockoutStages, MatchScores } from './types'
import TeamSlot from '../formView/knockout/TeamSlot'
import ScoreInput from '../formView/ScoreInput'
import { orderedRounds, type OrderedRounds } from './bracketLayout'
import './Bracket.css'

// Knockout bracket in the classic Wikipedia layout: one column per round, R32 on
// the right funnelling left to the final, joined by connector lines. The board is
// wider than the screen, so it scrolls horizontally. R32 carries real teams once
// the group stage is done; later rounds carry placeholders ("מנצח 74").
//
// Two modes from the same component:
//  • read-only (no `onChange`) — each card is a link to its match page. Used on /bracket.
//  • editable (`onChange` given) — each card holds score inputs and, for a level
//    scoreline, lets you click the advancing team. Drives the points table on Results.

const ROUND_LABELS: Record<keyof OrderedRounds, string> = {
  r32: 'שלב ה-32',
  r16: 'שמינית גמר',
  qf: 'רבע גמר',
  sf: 'חצי גמר',
}
const ORDER: (keyof OrderedRounds)[] = ['r32', 'r16', 'qf', 'sf']

interface CardCtx {
  predictions?: Record<string, MatchScores>
  onChange?: (matchId: string, scores: MatchScores) => void
  lockedMatchIds?: Set<string>
  // match numbers (as strings) the current user has a stake in — they predicted
  // both teams that meet here. Drives the "you're in this one" marker.
  participatingMatchIds?: Set<string>
}

// Corner chip flagging a match the current user participates in (they predicted
// both teams that meet here), so they can scan the bracket for the fixtures their
// bet rides on. Labelled, not just a colour — the word carries the meaning, the
// gold edge carries the glance. Wording mirrors the "לא משתתף" home-page card.
function MineMark() {
  return (
    <span className="bk-mine" title="ניחשת את שתי הנבחרות במשחק הזה">
      <span className="bk-mine-dot" aria-hidden="true" />
      משתתף
    </span>
  )
}

// The kickoff date + time, carried on each fixture from KO_DATES. Compact line at
// the top of every card so the bracket reads as a schedule, not just a tree.
function MatchMeta({ m }: { m: KnockoutMatch }) {
  if (!m.matchDate && !m.kickoffIST) return null
  return (
    <div className="bk-meta">
      {m.matchDate && <span>{m.matchDate}</span>}
      {m.matchDate && m.kickoffIST && <span className="bk-meta-sep">·</span>}
      {m.kickoffIST && <span dir="ltr">{m.kickoffIST}</span>}
    </div>
  )
}

function ReadOnlyCard({ m, mine, className = '' }: { m: KnockoutMatch; mine: boolean; className?: string }) {
  return (
    <a href={`/matches/${m.matchNum}`} className={`bk-match ${className}`}>
      {mine && <MineMark />}
      <MatchMeta m={m} />
      <TeamSlot name={m.home} />
      <TeamSlot name={m.away} />
    </a>
  )
}

function EditableCard({
  m, ctx, mine, className = '',
}: { m: KnockoutMatch; ctx: Required<Pick<CardCtx, 'onChange'>> & CardCtx; mine: boolean; className?: string }) {
  const { predictions, onChange, lockedMatchIds } = ctx
  const id = String(m.matchNum)
  const locked = lockedMatchIds?.has(id) ?? false
  const pred = predictions?.[id] ?? { home: null, away: null }

  // A knockout match can't end level, so a drawn scoreline means "pick who advances".
  const isDraw = m.resolved && pred.home !== null && pred.away !== null && pred.home === pred.away
  const needsDrawWinner = isDraw && !pred.drawWinner
  const selectable = !locked && isDraw

  const teamClass = (side: 'home' | 'away') =>
    `bk-team${
      selectable
        ? ` bk-team--selectable${pred.drawWinner === side ? ' bk-team--selected' : pred.drawWinner ? ' bk-team--unselected' : ''}`
        : isDraw && pred.drawWinner
          ? pred.drawWinner === side ? ' bk-team--selected' : ' bk-team--unselected'
          : ''
    }`

  const slot = (side: 'home' | 'away', name: string, value: MatchScores['home']) => (
    <div className="bk-match-row">
      <div
        className={teamClass(side)}
        onClick={selectable ? () => onChange(id, { ...pred, drawWinner: side }) : undefined}
        role={selectable ? 'button' : undefined}
        tabIndex={selectable ? 0 : undefined}
      >
        <TeamSlot name={name} />
      </div>
      {locked
        ? <span className="bk-score-static">{value ?? '–'}</span>
        : <ScoreInput
            label={name}
            value={value}
            disabled={!m.resolved}
            onChange={v => onChange(id, side === 'home' ? { home: v, away: pred.away } : { home: pred.home, away: v })}
          />}
    </div>
  )

  return (
    <div className={`bk-match bk-match--editable ${className}${m.resolved ? ' bk-match--resolved' : ''}${needsDrawWinner ? ' bk-match--draw-pending' : ''}`}>
      {mine && <MineMark />}
      <MatchMeta m={m} />
      {slot('home', m.home, pred.home)}
      <div className="bk-row-divider" />
      {slot('away', m.away, pred.away)}
      <a href={`/matches/${m.matchNum}`} className="bk-match-hint">
        <span className="bk-match-hint-label">לפרטים</span>
        <span className="bk-match-hint-chevron">›</span>
      </a>
    </div>
  )
}

function MatchCard({ m, ctx, className = '' }: { m: KnockoutMatch; ctx: CardCtx; className?: string }) {
  const mine = ctx.participatingMatchIds?.has(String(m.matchNum)) ?? false
  const cls = `${className}${mine ? ' bk-match--mine' : ''}`
  if (!ctx.onChange) return <ReadOnlyCard m={m} mine={mine} className={cls} />
  return <EditableCard m={m} ctx={ctx as Required<Pick<CardCtx, 'onChange'>> & CardCtx} mine={mine} className={cls} />
}

function Column({ rkey, matches, ctx }: { rkey: keyof OrderedRounds; matches: KnockoutMatch[]; ctx: CardCtx }) {
  return (
    <div className={`bk-col bk-col--${rkey}`}>
      <h2 className="bk-col-title">{ROUND_LABELS[rkey]}</h2>
      <div className="bk-col-body">
        {matches.map(m => <MatchCard key={m.matchNum} m={m} ctx={ctx} />)}
      </div>
    </div>
  )
}

interface BracketProps extends CardCtx {
  stages: KnockoutStages
}

export default function Bracket({ stages, predictions, onChange, lockedMatchIds, participatingMatchIds }: BracketProps) {
  const ctx: CardCtx = { predictions, onChange, lockedMatchIds, participatingMatchIds }
  const rounds = orderedRounds(stages)
  const final = stages.final[0]
  const thirdPlace = stages.thirdPlace[0]

  return (
    <div className={`bk${onChange ? ' bk--editable' : ''}`}>
      <div className="bk-board" dir="rtl">
        {ORDER.map(k => <Column key={k} rkey={k} matches={rounds[k]} ctx={ctx} />)}

        <div className="bk-col bk-col--final">
          <h2 className="bk-col-title">גמר</h2>
          <div className="bk-col-body">
            {final && <MatchCard m={final} ctx={ctx} className="bk-match--final" />}
            {thirdPlace && (
              <div className="bk-third">
                <h3 className="bk-third-title">מקום שלישי</h3>
                <MatchCard m={thirdPlace} ctx={ctx} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
