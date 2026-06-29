import type { GroupMatch, KnockoutMatch } from '../../shared/types'
import type { User } from '../../users/index'
import { recentCards, koTopPrediction, SCORED_MATCHES, KO_FEED_MATCHES } from './nextMatch'
import { knockoutParticipantScore } from '../match/koParticipants'
import MatchCard from './MatchCard'

type Props = {
  users: User[]
  now?: Date
  matches?: GroupMatch[]
  koMatches?: KnockoutMatch[]
  currentUser?: User
  playerMatchGoals?: Record<string, Record<string, number>>
}

// The mirror of NextMatchCard: the last few played matches, newest first, each
// showing the real score and — for the selected user — how they did. Once the
// knockouts begin, finished KO fixtures join the group results in the feed.
export default function RecentMatchesCard({ users, now = new Date(), matches = SCORED_MATCHES, koMatches = KO_FEED_MATCHES, currentUser, playerMatchGoals }: Props) {
  const cards = recentCards(matches, koMatches, now)

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
          consensus={ko ? koTopPrediction(users, ko) : undefined}
          mine={ko ? (currentUser ? knockoutParticipantScore(ko, currentUser) : null) : undefined}
          currentUser={currentUser}
          result={match.scores}
          playerMatchGoals={playerMatchGoals}
        />
      ))}
    </>
  )
}
