import { GROUP_HEBREW, GROUP_MATCHES } from '../../../shared/groups'
import type { GroupLetter } from '../../../shared/groups'
import { calculateStandings, liveGroupScores } from '../../../shared/standings'
import { computeGroupVotes, computeGroupVotePickers, computeGroupR32Pickers } from '../../group/groupVotes'
import { USERS } from '../../../users/index'
import { useLiveResults } from '../../../shared/useLiveResults'
import { useCurrentUser } from '../../../shared/useCurrentUser'
import PageLayout from '../../../shared/PageLayout'
import BestResultCard from '../../../formView/groupStage/BestResultCard'
import { bestRemainingResult } from '../../../leaderboard/bestResult'
import { settledState } from './recommendation'
import { thirdPickFromQualification, protectedThirdsForGroup } from './selfScore'
import GroupPicker from '../GroupPicker'
import StandingsTable from '../../../formView/groupStage/StandingsTable'
import GroupVoteMatrix from '../../group/GroupVoteMatrix'
import GroupAdvanceTable from '../../group/GroupAdvanceTable'
import MatchRow from '../../../formView/groupStage/MatchRow'
import type { Match, MatchScores } from '../../../shared/types'
import './GroupStatsPage.css'

interface Props {
  groupLetter: GroupLetter
}

const noop = () => {}
const USER_LABELS = USERS.map(u => u.label)

// A match counts as finished once it has both a home and away score recorded.
function isFinished(scores: MatchScores | undefined): boolean {
  return scores?.home != null && scores?.away != null
}

// Split the group's fixtures into the matches still to come (or in progress) and
// the ones already settled, so finished results can be tucked away while the
// remaining fixtures stay open.
export function splitByFinished(
  matches: Match[],
  scores: Record<string, MatchScores>,
): { remaining: Match[]; finished: Match[] } {
  const remaining: Match[] = []
  const finished: Match[] = []
  for (const match of matches) {
    ;(isFinished(scores[match.id]) ? finished : remaining).push(match)
  }
  return { remaining, finished }
}

export default function GroupStatsPage({ groupLetter }: Props) {
  const results = useLiveResults()
  const { currentUser } = useCurrentUser()
  const hebrew = GROUP_HEBREW[groupLetter]
  const matches = GROUP_MATCHES[groupLetter] ?? []
  const scores = liveGroupScores(results, groupLetter)
  const { standings } = calculateStandings(matches, scores)
  const votes = computeGroupVotes(USERS, groupLetter)
  const pickers = computeGroupVotePickers(USERS, groupLetter)
  const r32Pickers = computeGroupR32Pickers(USERS, groupLetter)
  const { remaining, finished } = splitByFinished(matches, scores)

  // The result to root for across this group's remaining matches, from your bet.
  const myGroupTable = currentUser?.groupTables[groupLetter]
  const myOrder = myGroupTable?.map(s => s.team) ?? []
  const bestResult = currentUser && myGroupTable
    ? bestRemainingResult({
        groupLetter,
        predictions: currentUser.predictions,
        predictedOrder: myOrder,
        thirdPick: thirdPickFromQualification(currentUser, groupLetter),
        settledAll: settledState(results),
        protectedThirds: protectedThirdsForGroup(currentUser.thirdPlaceQualification, groupLetter),
      })
    : null

  const renderRow = (match: Match) => (
    <MatchRow
      key={match.id}
      match={match}
      scores={scores[match.id]}
      onChange={noop}
      readOnly
      href={`/matches/${match.id.toLowerCase()}`}
    />
  )

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
          {finished.length > 0 && (
            <details className="match-history">
              <summary className="match-history__summary">
                משחקים שהסתיימו ({finished.length})
              </summary>
              <div className="match-history__list">
                {finished.map(renderRow)}
              </div>
            </details>
          )}
          {remaining.length > 0 ? (
            remaining.map(renderRow)
          ) : (
            <p className="match-history__empty">כל משחקי הבית הסתיימו</p>
          )}
        </section>

        {bestResult && (
          <section>
            <h2>מה הכי טוב לך?</h2>
            <BestResultCard result={bestResult} />
          </section>
        )}
      </main>
    </PageLayout>
  )
}
