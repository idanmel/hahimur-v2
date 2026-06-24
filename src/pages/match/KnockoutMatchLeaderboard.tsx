import { buildKnockoutMatchLeaderboardRows } from '../../leaderboard/knockoutMatchLeaderboardRows'
import type { KnockoutMatch, TournamentResults } from '../../shared/types'
import type { User } from '../../users/index'
import MatchLeaderboardTable from './MatchLeaderboardTable'

type Props = { match: KnockoutMatch; users: User[]; results: TournamentResults; me?: string }

export default function KnockoutMatchLeaderboard({ match, users, results, me }: Props) {
  return <MatchLeaderboardTable rows={buildKnockoutMatchLeaderboardRows(users, results, match)} me={me} />
}
