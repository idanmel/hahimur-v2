import { GROUP_HEBREW, GROUP_MATCHES } from '../../../shared/groups'
import type { GroupLetter } from '../../../shared/groups'
import { calculateStandings } from '../../../shared/standings'
import { computeGroupVotes } from '../../group/groupVotes'
import { USERS } from '../../../users/index'
import { tournamentResults } from '../../../tournament-results'
import PageLayout from '../../../shared/PageLayout'
import StandingsTable from '../../../formView/groupStage/StandingsTable'
import GroupVoteMatrix from '../../group/GroupVoteMatrix'
import MatchRow from '../../../formView/groupStage/MatchRow'

interface Props {
  groupLetter: GroupLetter
}

const noop = () => {}

export default function GroupStatsPage({ groupLetter }: Props) {
  const hebrew = GROUP_HEBREW[groupLetter]
  const matches = GROUP_MATCHES[groupLetter] ?? []
  const groupMatches = tournamentResults.groupMatches[groupLetter] ?? []
  const scores = Object.fromEntries(groupMatches.map(m => [m.id, m.scores ?? { home: null, away: null }]))
  const { standings } = calculateStandings(matches, scores)
  const votes = computeGroupVotes(USERS, groupLetter)

  return (
    <PageLayout title={`קבוצה ${hebrew}`}>
      <main>
        <section>
          <h2>טבלת הבית</h2>
          <StandingsTable standings={standings} />
        </section>

        <section>
          <h2>תחזיות הקבוצה</h2>
          <GroupVoteMatrix votes={votes} />
        </section>

        <section>
          <h2>תוצאות הבית</h2>
          {matches.map(match => (
            <MatchRow
              key={match.id}
              match={match}
              scores={scores[match.id]}
              onChange={noop}
              readOnly
              href={`/matches/${match.id.toLowerCase()}`}
            />
          ))}
        </section>
      </main>
    </PageLayout>
  )
}
