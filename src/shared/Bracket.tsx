import type { KnockoutMatch, KnockoutStages } from './types'
import TeamSlot from '../formView/knockout/TeamSlot'
import { orderedRounds, type OrderedRounds } from './bracketLayout'
import './Bracket.css'

// Read-only knockout bracket in the classic Wikipedia layout: one column per round,
// R32 on the right funnelling left to the final, joined by connector lines. The board
// is wider than the screen, so it scrolls horizontally. R32 carries real teams once
// the group stage is done; later rounds carry placeholders ("מנצח 74").

const ROUND_LABELS: Record<keyof OrderedRounds, string> = {
  r32: 'שלב ה-32',
  r16: 'שמינית גמר',
  qf: 'רבע גמר',
  sf: 'חצי גמר',
}
const ORDER: (keyof OrderedRounds)[] = ['r32', 'r16', 'qf', 'sf']

function MatchCard({ m, className = '' }: { m: KnockoutMatch; className?: string }) {
  return (
    <div className={`bk-match ${className}`}>
      <TeamSlot name={m.home} />
      <TeamSlot name={m.away} />
    </div>
  )
}

function Column({ rkey, matches }: { rkey: keyof OrderedRounds; matches: KnockoutMatch[] }) {
  return (
    <div className={`bk-col bk-col--${rkey}`}>
      <h2 className="bk-col-title">{ROUND_LABELS[rkey]}</h2>
      <div className="bk-col-body">
        {matches.map(m => <MatchCard key={m.matchNum} m={m} />)}
      </div>
    </div>
  )
}

export default function Bracket({ stages }: { stages: KnockoutStages }) {
  const rounds = orderedRounds(stages)
  const final = stages.final[0]
  const thirdPlace = stages.thirdPlace[0]

  return (
    <div className="bk">
      <div className="bk-board" dir="rtl">
        {ORDER.map(k => <Column key={k} rkey={k} matches={rounds[k]} />)}

        <div className="bk-col bk-col--final">
          <h2 className="bk-col-title">גמר</h2>
          <div className="bk-col-body">
            {final && <MatchCard m={final} className="bk-match--final" />}
            {thirdPlace && (
              <div className="bk-third">
                <h3 className="bk-third-title">מקום שלישי</h3>
                <MatchCard m={thirdPlace} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
