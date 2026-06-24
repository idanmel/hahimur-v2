import { buildMatchLeaderboardRows } from '../../leaderboard/matchLeaderboardRows'
import type { TournamentResults } from '../../shared/types'
import type { User } from '../../users/index'
import MatchLeaderboardTable from './MatchLeaderboardTable'

type Props = { matchId: string; users: User[]; results: TournamentResults; me?: string }

export default function MatchLeaderboard({ matchId, users, results, me }: Props) {
  return <MatchLeaderboardTable rows={buildMatchLeaderboardRows(users, results, matchId)} me={me} />
}
