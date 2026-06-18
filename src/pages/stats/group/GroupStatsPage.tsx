import { GROUP_HEBREW, GROUP_MATCHES } from '../../../shared/groups'
import type { GroupLetter } from '../../../shared/groups'
import { calculateStandings, liveGroupScores } from '../../../shared/standings'
import { computeGroupVotes, computeGroupVotePickers, computeGroupR32Pickers } from '../../group/groupVotes'
import { USERS } from '../../../users/index'
import { useLiveResults } from '../../../shared/useLiveResults'
import PageLayout from '../../../shared/PageLayout'
import GroupPicker from '../GroupPicker'
import StandingsTable from '../../../formView/groupStage/StandingsTable'
import GroupVoteMatrix from '../../group/GroupVoteMatrix'
import GroupAdvanceTable from '../../group/GroupAdvanceTable'
import MatchRow from '../../../formView/groupStage/MatchRow'

interface Props {
  groupLetter: GroupLetter
}

const noop = () => {}
const USER_LABELS = USERS.map(u => u.label)

export default function GroupStatsPage({ groupLetter }: Props) {
  const results = useLiveResults()
  const hebrew = GROUP_HEBREW[groupLetter]
  const matches = GROUP_MATCHES[groupLetter] ?? []
  const scores = liveGroupScores(results, groupLetter)
  const { standings } = calculateStandings(matches, scores)
  const votes = computeGroupVotes(USERS, groupLetter)
  const pickers = computeGroupVotePickers(USERS, groupLetter)
  const r32Pickers = computeGroupR32Pickers(USERS, groupLetter)

  return (
    <PageLayout title={`קבוצה ${hebrew}`}>
      <main>
        <GroupPicker activeGroup={groupLetter} />
        <section>
          <h2>טבלת הבית — בית {hebrew}</h2>
          <StandingsTable standings={standings} />
        </section>

        <section>
          <h2>תחזיות הקבוצה</h2>
          <GroupVoteMatrix votes={votes} pickers={pickers} />
        </section>

        <section>
          <h2>מי מתקדמת?</h2>
          <GroupAdvanceTable r32Pickers={r32Pickers} allUserLabels={USER_LABELS} />
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
