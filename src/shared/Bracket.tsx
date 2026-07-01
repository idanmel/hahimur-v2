import type { KnockoutMatch, KnockoutStages, MatchScores } from './types'
import { TEAMS } from './groups'
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

// A fixture's live status as the bracket needs it: just the running minute (the
// score itself rides on the card's overlaid result).
type LiveClock = { clock: string | null }

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
  // the score the current user predicted for each participating match, already
  // oriented to the actual fixture's home/away. Shown under the marker so they
  // can see how their bet's scoreline compares to the real result.
  participatingPredictions?: Record<string, MatchScores>
  // match numbers (as strings) that are still *unresolved* but where a pairing the
  // user predicted could yet happen — both teams alive, converging on this slot.
  // Drives the "עדיין אפשרי" (still possible) marker, the future-facing twin of
  // the participating one.
  possibleMatchIds?: Set<string>
  // the two teams the user predicted to meet in each still-possible match, shown
  // in the frame so they can see which of their bets is riding on this fixture.
  possiblePredictions?: Record<string, { home: string; away: string }>
  // match numbers (as strings) currently in progress, from the live feed → the
  // card's score is a running live one, flagged with a "חי" badge and the minute.
  liveMatches?: Record<string, LiveClock>
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

// Future-facing twin of MineMark. This slot isn't decided yet, but a pairing the
// bettor predicted could still land here — both teams are alive and their real
// paths converge on this match. So instead of "משתתף" (locked in) we flag it
// "עדיין אפשרי" (still possible), and name the matchup they're rooting for.
function PossibleMark({ pred }: { pred?: { home: string; away: string } }) {
  const he = (name: string) => TEAMS[name]?.he ?? name
  const title = pred
    ? `ניחשת ${he(pred.home)} נגד ${he(pred.away)} כאן — עדיין אפשרי`
    : 'ניחוש שלך עדיין אפשרי במשחק הזה'
  return (
    <span className="bk-possible" title={title}>
      <span className="bk-possible-dot" aria-hidden="true" />
      עדיין אפשרי
    </span>
  )
}

// The participant's predicted scoreline, broken into one digit per team so it can
// sit on each team's own row — a gold "ghost" column read top-to-bottom exactly
// like the real scores, keeping the bet on the same vertical axis as the match.
// Null when no full scoreline was predicted (nothing to show). `advHome/advAway`
// flag the team they had advancing on a level bet (a knockout can't end drawn).
function predDigits(scores?: MatchScores) {
  if (!scores || scores.home === null || scores.away === null) return null
  const level = scores.home === scores.away
  return {
    home: scores.home,
    away: scores.away,
    advHome: level && scores.drawWinner === 'home',
    advAway: level && scores.drawWinner === 'away',
  }
}

// One gold digit of the participant's bet, on a team's own row beside the real
// score. A filled chip + caret marks the side they had advancing after a level bet.
function PredDigit({ value, advancing }: { value: number; advancing: boolean }) {
  return (
    <span
      className={`bk-pred${advancing ? ' bk-pred--adv' : ''}`}
      title={advancing ? 'הניחוש שלך — הנבחרת הזו עולה' : 'הניחוש שלך'}
    >
      {value}
      {advancing && <span className="bk-pred-caret" aria-hidden="true">▲</span>}
    </span>
  )
}

// The kickoff date + time, carried on each fixture from KO_DATES. Compact line at
// the top of every card so the bracket reads as a schedule, not just a tree. While
// the match is in progress the live "חי" badge (with the minute) stands in for it —
// the running score is what matters then, not the kickoff time.
function MatchMeta({ m, live }: { m: KnockoutMatch; live?: LiveClock | null }) {
  if (live) {
    return (
      <div className="bk-meta bk-meta--live" data-testid="bk-live" dir="rtl">
        <span className="bk-live-dot" aria-hidden="true" />
        <span>חי</span>
        {live.clock && <span className="bk-live-clock" dir="ltr">{live.clock}</span>}
      </div>
    )
  }
  if (!m.matchDate && !m.kickoffIST) return null
  return (
    <div className="bk-meta">
      {m.matchDate && <span>{m.matchDate}</span>}
      {m.matchDate && m.kickoffIST && <span className="bk-meta-sep">·</span>}
      {m.kickoffIST && <span dir="ltr">{m.kickoffIST}</span>}
    </div>
  )
}

function ReadOnlyCard({ m, mine, minePred, possible, possiblePred, live, className = '' }: { m: KnockoutMatch; mine: boolean; minePred?: MatchScores; possible?: boolean; possiblePred?: { home: string; away: string }; live?: LiveClock | null; className?: string }) {
  const pd = predDigits(minePred)
  const teamLine = (name: string, value: number, advancing: boolean) =>
    pd
      ? (
        <div className="bk-ro-row">
          <TeamSlot name={name} />
          <PredDigit value={value} advancing={advancing} />
        </div>
      )
      : <TeamSlot name={name} />
  return (
    <a href={`/matches/${m.matchNum}`} className={`bk-match ${className}`}>
      {mine && <MineMark />}
      {possible && <PossibleMark pred={possiblePred} />}
      <MatchMeta m={m} live={live} />
      {teamLine(m.home, pd?.home ?? 0, pd?.advHome ?? false)}
      {teamLine(m.away, pd?.away ?? 0, pd?.advAway ?? false)}
    </a>
  )
}

function EditableCard({
  m, ctx, mine, minePred, possible, possiblePred, live, className = '',
}: { m: KnockoutMatch; ctx: Required<Pick<CardCtx, 'onChange'>> & CardCtx; mine: boolean; minePred?: MatchScores; possible?: boolean; possiblePred?: { home: string; away: string }; live?: LiveClock | null; className?: string }) {
  const { predictions, onChange, lockedMatchIds } = ctx
  const id = String(m.matchNum)
  const locked = lockedMatchIds?.has(id) ?? false
  const pred = predictions?.[id] ?? { home: null, away: null }
  const pd = predDigits(minePred)

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
      {pd && <PredDigit value={side === 'home' ? pd.home : pd.away} advancing={side === 'home' ? pd.advHome : pd.advAway} />}
    </div>
  )

  return (
    <div className={`bk-match bk-match--editable ${className}${m.resolved ? ' bk-match--resolved' : ''}${needsDrawWinner ? ' bk-match--draw-pending' : ''}${live ? ' bk-match--live' : ''}`}>
      {mine && <MineMark />}
      {possible && <PossibleMark pred={possiblePred} />}
      <MatchMeta m={m} live={live} />
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
  const id = String(m.matchNum)
  const mine = ctx.participatingMatchIds?.has(id) ?? false
  const minePred = mine ? ctx.participatingPredictions?.[id] : undefined
  // "Still possible" only applies to slots not already locked in as "משתתף" — the
  // two are mutually exclusive (resolved vs open), but guard so a slot never wears
  // both badges if the inputs ever overlap.
  const possible = !mine && (ctx.possibleMatchIds?.has(id) ?? false)
  const possiblePred = possible ? ctx.possiblePredictions?.[id] : undefined
  const live = ctx.liveMatches?.[id] ?? null
  const cls = `${className}${mine ? ' bk-match--mine' : ''}${possible ? ' bk-match--possible' : ''}`
  if (!ctx.onChange) return <ReadOnlyCard m={m} mine={mine} minePred={minePred} possible={possible} possiblePred={possiblePred} live={live} className={cls} />
  return <EditableCard m={m} ctx={ctx as Required<Pick<CardCtx, 'onChange'>> & CardCtx} mine={mine} minePred={minePred} possible={possible} possiblePred={possiblePred} live={live} className={cls} />
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

export default function Bracket({ stages, predictions, onChange, lockedMatchIds, participatingMatchIds, participatingPredictions, possibleMatchIds, possiblePredictions, liveMatches }: BracketProps) {
  const ctx: CardCtx = { predictions, onChange, lockedMatchIds, participatingMatchIds, participatingPredictions, possibleMatchIds, possiblePredictions, liveMatches }
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
