import type { KnockoutMatch, MatchScores } from '../../shared/types'
import type { User } from '../../users/index'
import { TEAMS } from '../../shared/groups'
import { isPlayerParticipatingInKOMatch } from '../../formView/knockout/knockout'

type Props = { actualMatch: KnockoutMatch; users: User[] }

function userMatch(user: User, matchNum: number): KnockoutMatch | undefined {
  const s = user.knockoutStages
  for (const stage of [s.r32, s.r16, s.qf, s.sf, s.thirdPlace, s.final]) {
    const m = stage.find(m => m.matchNum === matchNum)
    if (m) return m
  }
}

// Re-express a bettor's predicted score in the real match's home/away terms, so
// someone who stored the two teams reversed still reads in the same orientation
// as the page — the penalty winner flips sides along with the score.
function orientToActual(actualMatch: KnockoutMatch, predicted: KnockoutMatch): MatchScores | null {
  const sc = predicted.scores
  if (!sc) return null
  if (predicted.home === actualMatch.home) return sc
  return {
    home: sc.away,
    away: sc.home,
    drawWinner: sc.drawWinner === 'home' ? 'away' : sc.drawWinner === 'away' ? 'home' : undefined,
  }
}

const teamHe = (name: string) => TEAMS[name]?.he ?? name

// A scoreboard ledger of the bettors "participating" in this knockout match —
// the ones who predicted both teams that actually reached it — each with the
// score they called, oriented to the real fixture's home/away.
export default function KnockoutParticipantsList({ actualMatch, users }: Props) {
  if (!actualMatch.resolved) return null

  const participants: { label: string; score: MatchScores }[] = []
  for (const u of users) {
    const um = userMatch(u, actualMatch.matchNum)
    if (!um || !isPlayerParticipatingInKOMatch(actualMatch, um)) continue
    const score = orientToActual(actualMatch, um)
    if (!score) continue
    participants.push({ label: u.label, score })
  }

  if (participants.length === 0) {
    return (
      <p className="match-participants__empty" dir="rtl">
        אין משתתפים שניחשו את המשחק הזה
      </p>
    )
  }

  const homeHe = teamHe(actualMatch.home)
  const awayHe = teamHe(actualMatch.away)
  const homeIso = TEAMS[actualMatch.home]?.iso
  const awayIso = TEAMS[actualMatch.away]?.iso

  return (
    <ol className="match-participants" dir="rtl">
      {participants.map((p, i) => {
        const isDraw = p.score.home === p.score.away
        // A drawn knockout is settled in extra time or on penalties — either way
        // drawWinner just names who advances, so the label stays neutral.
        const advWinner =
          isDraw && p.score.drawWinner
            ? p.score.drawWinner === 'home' ? homeHe : awayHe
            : null
        return (
          <li
            key={p.label}
            data-testid="participant"
            className="match-participants__row"
            style={{ '--i': i } as React.CSSProperties}
          >
            <span className="match-participants__name">{p.label}</span>
            <span className="match-participants__result">
              {/* Same orientation as the match header: away team first (right in
                  RTL), then the away–home score, then the home team. */}
              <span className="match-participants__chip">
                <span className="match-participants__team">
                  {awayIso && <span className={`fi fi-${awayIso} match-participants__flag`} />}
                  {awayHe}
                </span>
                <span className="match-participants__score">{p.score.away}–{p.score.home}</span>
                <span className="match-participants__team">
                  {homeIso && <span className={`fi fi-${homeIso} match-participants__flag`} />}
                  {homeHe}
                </span>
              </span>
              {advWinner && (
                <span className="match-participants__adv">{advWinner} עולה</span>
              )}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
