import { GROUP_HEBREW, GROUP_MATCHES } from '../../../shared/groups'
import type { GroupLetter } from '../../../shared/groups'
import { calculateStandings } from '../../../shared/standings'
import { computeGroupVotes } from '../../group/groupVotes'
import { USERS } from '../../../users/index'
import * as results from '../../../results'
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
  const { standings } = calculateStandings(matches, results.predictions)
  const votes = computeGroupVotes(USERS, groupLetter)
  const scores = Object.fromEntries(
    matches.map(m => [m.id, results.predictions[m.id] ?? { home: null, away: null }])
  )

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
            />
          ))}
        </section>
      </main>
    </PageLayout>
  )
}
