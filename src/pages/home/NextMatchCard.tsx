import type { GroupMatch } from '../../shared/types'
import type { User } from '../../users/index'
import { nextMatches, SCORED_MATCHES } from './nextMatch'
import MatchCard from './MatchCard'

type Props = { users: User[]; now?: Date; matches?: GroupMatch[]; currentUser?: User; liveMatches?: Record<string, { clock: string | null }> }

export default function NextMatchCard({ users, now = new Date(), matches = SCORED_MATCHES, currentUser, liveMatches }: Props) {
  const upcoming = nextMatches(matches, now)
  // nextMatches is sorted by kickoff, so the earliest slot is upcoming[0]'s.
  // Every match sharing that slot is "next" (round 3 plays two simultaneously).
  const next = upcoming[0]

  return (
    <>
      {upcoming.map(match => (
        <MatchCard
          key={match.id}
          users={users}
          match={match}
          isNext={match.matchDate === next.matchDate && match.kickoffIST === next.kickoffIST}
          currentUser={currentUser}
          now={now}
          liveMatches={liveMatches}
        />
      ))}
    </>
  )
}
