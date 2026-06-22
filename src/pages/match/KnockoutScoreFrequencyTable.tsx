import type { KnockoutMatch, MatchScores } from '../../shared/types'
import type { User } from '../../users/index'
import { TEAMS } from '../../shared/groups'
import { isPlayerParticipatingInKOMatch } from '../../formView/knockout/knockout'
import ScoreFrequencyTable from './ScoreFrequencyTable'

type Props = { actualMatch: KnockoutMatch; users: User[] }

function userMatch(user: User, matchNum: number): KnockoutMatch | undefined {
  const s = user.knockoutStages
  return [...s.r32, ...s.r16, ...s.qf, ...s.sf, ...s.thirdPlace, ...s.final]
    .find(m => m.matchNum === matchNum)
}

// Re-express a bettor's predicted score in the real match's home/away terms, so
// someone who had the two teams reversed still lands on the same scoreline — the
// penalty winner flips sides with the score.
function orientToActual(actualMatch: KnockoutMatch, userMatch: KnockoutMatch): MatchScores | null {
  const sc = userMatch.scores
  if (!sc) return null
  if (userMatch.home === actualMatch.home) return sc
  return {
    home: sc.away,
    away: sc.home,
    drawWinner: sc.drawWinner === 'home' ? 'away' : sc.drawWinner === 'away' ? 'home' : undefined,
  }
}

const teamHe = (name: string) => TEAMS[name]?.he ?? name

// The frequency table, but limited to bettors who are "participating" in this
// knockout match — i.e. predicted both of the teams that actually reached it.
export default function KnockoutScoreFrequencyTable({ actualMatch, users }: Props) {
  if (!actualMatch.resolved) return null

  const oriented = new Map<string, MatchScores>()
  const participants: User[] = []
  for (const u of users) {
    const um = userMatch(u, actualMatch.matchNum)
    if (!um || !isPlayerParticipatingInKOMatch(actualMatch, um)) continue
    const score = orientToActual(actualMatch, um)
    if (!score) continue
    oriented.set(u.label, score)
    participants.push(u)
  }

  if (participants.length === 0) return null

  const actualScore =
    actualMatch.scores && actualMatch.scores.home != null && actualMatch.scores.away != null
      ? actualMatch.scores
      : null

  return (
    <ScoreFrequencyTable
      matchId={String(actualMatch.matchNum)}
      users={participants}
      actualScore={actualScore}
      scoreFor={u => oriented.get(u.label)}
      homeLabel={teamHe(actualMatch.home)}
      awayLabel={teamHe(actualMatch.away)}
    />
  )
}
