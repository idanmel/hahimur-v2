import type { GroupMatch, KnockoutMatch } from '../../shared/types'
import type { User } from '../../users/index'
import { upcomingCards, topPrediction, SCORED_MATCHES, KO_FEED_MATCHES } from './nextMatch'
import { knockoutParticipantScore } from '../match/koParticipants'
import MatchCard from './MatchCard'

type Props = {
  users: User[]
  now?: Date
  matches?: GroupMatch[]
  koMatches?: KnockoutMatch[]
  currentUser?: User
  liveMatches?: Record<string, { clock: string | null; home?: number; away?: number }>
}

export default function NextMatchCard({ users, now = new Date(), matches = SCORED_MATCHES, koMatches = KO_FEED_MATCHES, currentUser, liveMatches }: Props) {
  const cards = upcomingCards(matches, koMatches, now)
  // upcomingCards is sorted by kickoff, so the earliest slot is cards[0]'s.
  // Every match sharing that slot is "next" (a round plays several at once).
  const next = cards[0]?.match

  return (
    <>
      {cards.map(({ match, heading, ko }) => (
        <MatchCard
          key={match.id}
          users={users}
          match={match}
          heading={heading}
          // Knockout predictions are matched by team, not id, so feed the card
          // the team-matched consensus and the user's own called score.
          consensus={ko ? topPrediction(users, { kind: 'ko', match: ko }) : undefined}
          mine={ko ? (currentUser ? knockoutParticipantScore(ko, currentUser) : null) : undefined}
          isNext={!!next && match.matchDate === next.matchDate && match.kickoffIST === next.kickoffIST}
          currentUser={currentUser}
          now={now}
          liveMatches={liveMatches}
        />
      ))}
    </>
  )
}
