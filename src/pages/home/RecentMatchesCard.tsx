import type { GroupMatch } from '../../shared/types'
import type { User } from '../../users/index'
import { recentMatches, SCORED_MATCHES } from './nextMatch'
import MatchCard from './MatchCard'

type Props = { users: User[]; now?: Date; matches?: GroupMatch[]; currentUser?: User }

// The mirror of NextMatchCard: the last few played matches, newest first, each
// showing the real score and — for the selected user — how they did.
export default function RecentMatchesCard({ users, now = new Date(), matches = SCORED_MATCHES, currentUser }: Props) {
  const recent = recentMatches(matches, now)

  return (
    <>
      {recent.map(match => (
        <MatchCard
          key={match.id}
          users={users}
          match={match}
          currentUser={currentUser}
          result={match.scores}
        />
      ))}
    </>
  )
}
