import { useState } from 'react'
import PageLayout from '../../shared/PageLayout'
import type { Match, MatchScores, Score, TournamentResults } from '../../shared/types'
import type { User } from '../../users/index'
import { isLive } from '../../shared/matchOrder'
import { useLiveResults } from '../../shared/useLiveResults'
import { useCurrentUser } from '../../shared/useCurrentUser'
import { GROUP_HEBREW, GROUP_MATCHES, TEAMS } from '../../shared/groups'
import { adjacentMatches, LAST_GROUP_MATCH } from './matchUtils'
import {
  FIRST_KO_MATCH_NUM,
  findKnockoutMatch,
  findInStages,
  roundLabel,
  vennStage,
  knockoutChronoNav,
} from './koMatch'
import { calculateStandings, liveGroupScores } from '../../shared/standings'
import StandingsTable from '../../formView/groupStage/StandingsTable'
import MatchHeader from './MatchHeader'
import OddsBar from '../../shared/OddsBar'
import PredictionSummary from './PredictionSummary'
import ScoreFrequencyTable from './ScoreFrequencyTable'
import MatchLeaderboard from './MatchLeaderboard'
import MatchLeaderboardTable from './MatchLeaderboardTable'
import { buildKnockoutMatchLeaderboardRows } from '../../leaderboard/knockoutMatchLeaderboardRows'
import KnockoutSurvivorsList from './KnockoutSurvivorsList'
import KnockoutVenn from './KnockoutVenn'
import BestResultCard from '../../formView/groupStage/BestResultCard'
import MatchRecommendation from './MatchRecommendation'
import PodiumOnAdvance from './PodiumOnAdvance'
import { bestRemainingResult } from '../../leaderboard/bestResult'
import { settledState } from '../stats/group/recommendation'
import { thirdPickFromQualification, protectedThirdsForGroup } from '../stats/group/selfScore'
import { koAsGroupMatch } from '../home/nextMatch'
import { knockoutParticipantScore } from './koParticipants'
import './MatchPredictionsPage.css'

type Team = { iso?: string; he: string }

type Props = {
  // Group mode: the resolved match + its two teams (from resolveMatch).
  match?: Match | null
  home?: Team | null
  away?: Team | null
  // Knockout mode: route a numbered match here. The page resolves the KO fixture
  // itself and renders the shared scaffolding via koAsGroupMatch, gating the
  // knockout-only sections behind the match kind.
  koMatchNum?: number
  users: User[]
  now?: Date
}

function realScoreFor(results: TournamentResults, matchId: string): MatchScores | null {
  const s = results.groupMatches[matchId[0]]?.find(m => m.id === matchId)?.scores
  return s && s.home !== null && s.away !== null ? s : null
}

// A resolved slot is a real team → flag + Hebrew name; an unresolved slot is a
// descriptor string ("סגנית א", "שלישית א/ב/ג/ד/ו"), shown as-is with no flag.
function teamForSlot(slot: string): Team {
  const team = TEAMS[slot]
  return team ? { iso: team.iso, he: team.he } : { he: slot }
}

// A scoreline only counts as the "real" result once both sides are filled in.
function completeScore(s: MatchScores | null | undefined): MatchScores | null {
  return s && s.home !== null && s.away !== null ? s : null
}

export default function MatchPredictionsPage({ match: groupMatch, home: groupHome, away: groupAway, koMatchNum, users, now = new Date() }: Props) {
  const [homeScore, setHomeScore] = useState<Score>(null)
  const [awayScore, setAwayScore] = useState<Score>(null)
  // Live-overlaid results: a live score/scorers appear here in real time while
  // the match is in progress, then settle to the baked final when it ends.
  const results = useLiveResults()
  const { me, currentUser } = useCurrentUser()

  if (koMatchNum != null) {
    return (
      <KnockoutBody
        matchNum={koMatchNum}
        users={users}
        now={now}
        results={results}
        me={me}
        homeScore={homeScore}
        awayScore={awayScore}
        setHomeScore={setHomeScore}
        setAwayScore={setAwayScore}
      />
    )
  }

  const match = groupMatch ?? null
  const home = groupHome ?? null
  const away = groupAway ?? null

  if (!match || !home || !away) {
    return (
      <PageLayout title="ההימור 2026">
        <p style={{ textAlign: 'center', marginTop: '2rem' }}>משחק לא נמצא</p>
      </PageLayout>
    )
  }

  const live = isLive(match, now)
  const realScore = realScoreFor(results, match.id)
  // Present only while the match is actually being played (from the live feed),
  // which is how the header tells "in progress" from "finished".
  const liveScore = results.live?.[match.id] ?? null
  // "Decided" means a FINAL result — not a live, still-changing score. While the
  // match is in progress the recommendation stays useful (the result isn't locked
  // yet), so we only treat it as decided once it's final and no longer live.
  const decided = !!realScore && !liveScore
  const actualScore = realScore ?? (homeScore !== null && awayScore !== null ? { home: homeScore, away: awayScore } : null)
  const scorers = realScore
    ? Object.entries(results.playerMatchGoals ?? {})
        .filter(([, byMatch]) => (byMatch[match.id] ?? 0) > 0)
        .map(([player, byMatch]) => ({ player, goals: byMatch[match.id] }))
    : []

  // The group table as it stands right now, with this match's live score folded
  // in via useLiveResults — the two teams playing are highlighted.
  const groupLetter = match.id[0]
  const { standings } = calculateStandings(GROUP_MATCHES[groupLetter] ?? [], liveGroupScores(results, groupLetter))
  // The viewer's own predicted final table for this group, shown beneath the
  // live one so they can compare their call to how it's actually unfolding.
  const myGroupTable = currentUser?.groupTables[groupLetter]

  // The result to root for across this group's remaining matches, from your bet.
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

  // Step to the chronologically adjacent matches. The last group match steps
  // forward into the knockout opener.
  const { prev, next } = adjacentMatches(match.id)
  const nextId = next?.id ?? (match.id === LAST_GROUP_MATCH.id ? String(FIRST_KO_MATCH_NUM) : null)

  return (
    <PageLayout title="ההימור 2026">
      <MatchHeader
        match={match} home={home} away={away}
        homeScore={homeScore} awayScore={awayScore}
        onHomeScore={setHomeScore} onAwayScore={setAwayScore}
        realScore={realScore} live={live} liveScore={liveScore}
        prevId={prev?.id ?? null} nextId={nextId}
      />

      {/* Each side's chance to win, from the Elo win-model — pre-match and live. */}
      {!decided && <OddsBar home={match.homeTeam} away={match.awayTeam} />}

      <div className="match-predictions">
        {scorers.length > 0 && (
          <div className="match-scorers" data-testid="match-scorers" dir="rtl">
            {scorers.map(s => (
              <span key={s.player} className="match-scorers__item">
                ⚽ {s.player}{s.goals > 1 ? ` ×${s.goals}` : ''}
              </span>
            ))}
          </div>
        )}

        {users.length > 0 && (
          <>
            <header className="section-heading" dir="rtl">
              <span className="section-heading__eyebrow">דירוג</span>
              <h2 className="section-heading__title">טבלת המנחשים</h2>
            </header>
            <MatchLeaderboard matchId={match.id} users={users} results={results} me={me} />
          </>
        )}

        <MatchRecommendation
          matchId={match.id}
          currentUser={currentUser ?? undefined}
          results={results}
          decided={decided}
        />

        {bestResult && (
          <>
            <header className="section-heading" dir="rtl">
              <span className="section-heading__eyebrow">ההמלצה שלך</span>
              <h2 className="section-heading__title">הבית כולו</h2>
            </header>
            <BestResultCard result={bestResult} />
          </>
        )}

        <header className="section-heading" dir="rtl">
          <span className="section-heading__eyebrow">בית {GROUP_HEBREW[groupLetter]}</span>
          <h2 className="section-heading__title">טבלת הבית</h2>
        </header>
        <div data-testid="live-group-table">
          <StandingsTable standings={standings} highlightTeams={[match.homeTeam, match.awayTeam]} />
        </div>

        {myGroupTable && (
          <>
            <header className="section-heading" dir="rtl">
              <span className="section-heading__eyebrow">התחזית שלך</span>
              <h2 className="section-heading__title">טבלת הבית שלי</h2>
            </header>
            <div data-testid="my-group-table">
              <StandingsTable standings={myGroupTable} highlightTeams={[match.homeTeam, match.awayTeam]} />
            </div>
          </>
        )}

        <header className="section-heading" dir="rtl">
          <span className="section-heading__eyebrow">ניחושים</span>
          <h2 className="section-heading__title">סך הכל</h2>
        </header>
        <PredictionSummary matchId={match.id} homeLabel={home.he} awayLabel={away.he} users={users} actualScore={actualScore} />

        <header className="section-heading" dir="rtl">
          <span className="section-heading__eyebrow">סטטיסטיקה</span>
          <h2 className="section-heading__title">התפלגות תוצאות</h2>
        </header>
        {users.length === 0
          ? <p className="match-predictions__empty">אין תחזיות למשחק זה</p>
          : <ScoreFrequencyTable matchId={match.id} users={users} actualScore={actualScore} />}

      </div>
    </PageLayout>
  )
}

// The knockout branch of the unified page: shares the header/consensus
// scaffolding (rendered through koAsGroupMatch's group-shaped fixture), gating
// the knockout-only widgets — survivors list, KO leaderboard, the qualifier Venn
// and the round-label badge — behind the match being a resolved KO fixture.
type KnockoutBodyProps = {
  matchNum: number
  users: User[]
  now: Date
  results: TournamentResults
  me: string
  homeScore: Score
  awayScore: Score
  setHomeScore: (v: Score) => void
  setAwayScore: (v: Score) => void
}

function KnockoutBody({ matchNum, users, now, results, me, homeScore, awayScore, setHomeScore, setAwayScore }: KnockoutBodyProps) {
  const match = findKnockoutMatch(matchNum)

  if (!match) {
    return (
      <PageLayout title="ההימור 2026">
        <p style={{ textAlign: 'center', marginTop: '2rem' }}>משחק לא נמצא</p>
      </PageLayout>
    )
  }

  const matchId = String(matchNum)
  // Present only while the match is actually being played (from the live feed),
  // which is how the header tells "in progress" from "finished".
  const liveScore = results.live?.[matchId] ?? null
  // The score baked into the live-merged bracket: the hand-entered final once
  // it's in, and meanwhile the score the feed overlays. ESPN keeps reporting a
  // just-finished match's score here even after it drops the in-progress `live`
  // status, so reading it (not the static fixture) is what shows the result the
  // moment the whistle blows — before the final is hand-entered into
  // tournament-results. The static `match.scores` only carries a score for the
  // dev `?mockko` bracket, whose fixtures never reach the merged results.
  const mergedScore = completeScore(findInStages(results.knockoutStages, matchNum)?.scores)
  // The score to show: while in progress it's the running live score from the
  // feed (the home/away the badge carries) — NOT the bracket's m.scores, which
  // for a knockout match is frozen at the 90' regulation result for scoring and
  // would stop moving once the game reaches extra time. Otherwise the merged
  // bracket score (the running/final result), falling back to the static fixture
  // only for the mock bracket. Mirrors the group page's live-merged realScore.
  const realScore = liveScore && liveScore.home != null && liveScore.away != null
    ? { home: liveScore.home, away: liveScore.away }
    : mergedScore ?? (match.resolved ? completeScore(match.scores) : null)
  const live = isLive({ matchDate: match.matchDate, kickoffIST: match.kickoffIST }, now)
  // "Decided" = a settled final result that's no longer live. Mirrors the group
  // page: while the match is in progress (liveScore present) it isn't decided yet.
  const decided = !!realScore && !liveScore

  // The KO fixture flattened into the group-shaped match the shared header reads.
  const headerMatch = koAsGroupMatch(match)
  const home = teamForSlot(match.home)
  const away = teamForSlot(match.away)

  // Which "who predicted each team this far" Venn this match feeds, if any.
  const venn = vennStage(matchNum)

  // Step the prev/next arrows through the bracket in kickoff order, not by number.
  // The opener's "previous" steps back into the group stage's final match.
  const { prevNum, nextNum } = knockoutChronoNav(matchNum)
  const prevId = prevNum !== null ? String(prevNum) : LAST_GROUP_MATCH.id
  const nextId = nextNum !== null ? String(nextNum) : null

  // The bettors playing this knockout fixture — those who predicted both teams
  // that actually reached it — each mapped to their called score, oriented to the
  // real home/away. Feeds the score-distribution summary below.
  const koScoreFor = new Map(
    users
      .map(u => [u, knockoutParticipantScore(match, u)] as const)
      .filter(([, score]) => score !== null),
  )
  const participants = users.filter(u => koScoreFor.has(u))

  return (
    <PageLayout title="ההימור 2026">
      <div data-testid="knockout-match-page">
        <MatchHeader
          match={headerMatch}
          home={home} away={away}
          homeScore={homeScore} awayScore={awayScore} onHomeScore={setHomeScore} onAwayScore={setAwayScore}
          realScore={realScore} live={live} liveScore={liveScore}
          badge={{ label: `${roundLabel(matchNum)} · משחק ${matchNum}` }}
          prevId={prevId}
          nextId={nextId}
        />
      </div>

      {/* Each side's chance to advance this tie, from the Elo win-model — shown
          for a resolved fixture until it's decided (stays up through the live game). */}
      {match.resolved && !decided && <OddsBar home={match.home} away={match.away} knockout />}

      {!match.resolved && <KnockoutSurvivorsList actualMatch={match} users={users} />}

      {/* Fixture with known teams: which advancer most lifts your podium odds.
          Stays up through the live match — disappears only once it's decided. */}
      {match.resolved && !decided && (
        <PodiumOnAdvance currentUser={users.find(u => u.label === me)} results={results} matchNum={matchNum} live={!!liveScore} />
      )}

      {match.resolved && (
        <div className="match-predictions">
          {users.length > 0 && (
            <>
              <header className="section-heading" dir="rtl">
                <span className="section-heading__eyebrow">דירוג</span>
                <h2 className="section-heading__title">טבלת המנחשים</h2>
              </header>
              <MatchLeaderboardTable rows={buildKnockoutMatchLeaderboardRows(users, results, match)} me={me} />
            </>
          )}

          {participants.length > 0 && (
            <>
              <header className="section-heading" dir="rtl">
                <span className="section-heading__eyebrow">ניחושים</span>
                <h2 className="section-heading__title">סך הכל</h2>
              </header>
              <PredictionSummary
                matchId={matchId}
                homeLabel={home.he}
                awayLabel={away.he}
                users={participants}
                actualScore={realScore}
                scoreFor={u => koScoreFor.get(u)}
              />
            </>
          )}

          <header className="section-heading" dir="rtl">
            <span className="section-heading__eyebrow">סטטיסטיקה</span>
            <h2 className="section-heading__title">התפלגות תוצאות</h2>
          </header>
          {participants.length === 0
            ? <p className="match-predictions__empty" dir="rtl">אין משתתפים שניחשו את המשחק הזה</p>
            : <ScoreFrequencyTable
                matchId={matchId}
                users={participants}
                actualScore={realScore}
                scoreFor={u => koScoreFor.get(u)}
                homeLabel={home.he}
                awayLabel={away.he}
              />}

          {users.length > 0 && venn && (
            <>
              <header className="section-heading" dir="rtl">
                <span className="section-heading__eyebrow">{venn.label}</span>
                <h2 className="section-heading__title">
                  מי העלה את {away.he} ואת {home.he}
                </h2>
              </header>
              <KnockoutVenn teamA={match.home} teamB={match.away} stage={venn.stage} users={users} />
            </>
          )}
        </div>
      )}
    </PageLayout>
  )
}
