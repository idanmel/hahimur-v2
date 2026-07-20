import { useState, useEffect, useRef, useMemo } from 'react'
import GoalScorerSection from './GoalScorerSection'
import PageLayout from '../../shared/PageLayout'
import MatchRow from '../../formView/groupStage/MatchRow'
import StandingsTable from '../../formView/groupStage/StandingsTable'
import Bracket from '../../shared/Bracket'
import ThirdPlaceTable from '../../formView/thirdPlace/ThirdPlaceTable'
import type { User } from '../../users/index'
import ScopedLeaderboard from '../../leaderboard/ScopedLeaderboard'
import { reportUsage } from '../../shared/reportUsage'
import type { Scope } from '../../leaderboard/leaderboardRows'
import { playedMatchesChrono, playedMatchChronoLabel } from '../../leaderboard/leaderboardRows'
import LeaderboardScopeBar from '../../leaderboard/LeaderboardScopeBar'
import { calculateStandings } from '../../shared/standings'
import { clearUnresolvedKOScores } from '../../formView/knockout/knockout'
import { allKO, predictedPairing, orientPrediction } from '../../formView/knockout/koRounds'
import { useTournament } from '../../shared/useTournament'
import { useCurrentUser } from '../../shared/useCurrentUser'
import { useLiveScores } from '../../shared/useLiveScores'
import { useScorerTotals } from '../../shared/useScorerTotals'
import { SCORER_ALIASES } from '../../shared/espnLive'
import { mergeLiveResults } from '../../shared/liveResults'
import { buildGoldenBootBoard } from './goldenBootBoard'
import { GOLDEN_BOOT_NAMES, TEAM_BY_PLAYER } from './goldenBootNames'
import { teamsWithNoMatchesLeft } from '../forms/compareStats'
import { GROUPS, ALL_GROUP_LETTERS, TEAMS } from '../../shared/groups'
import type { PredictionsState, MatchScores, TournamentResults } from '../../shared/types'
import { GROUP_MATCHES_BY_DATE, nextUnplayedMatchId, nextUnplayedKOMatchId } from '../../shared/matchesByDate'
import { tournamentResults as realTournamentResults } from '../../tournament-results'
import { getLockedMatchIds } from './resultsUtils'
import { possibleParticipation } from './possibleParticipation'
import '../../leaderboard/LeaderboardPage.css'
import '../../pages/form/FormPage.css'
import './ResultsPage.css'

const LOCKED_MATCH_IDS = getLockedMatchIds(realTournamentResults)
// The Golden Boot race is decided once the real winner is baked into the
// results — from then on the race board is display-only, like a played match.
const BOOT_RACE_LOCKED = realTournamentResults.goldenBootWinner != null
// Teams that can no longer add goals — eliminated AND with no match left to play
// (a semi-final loser still has the third-place match, so their strikers stay in
// the race; see teamsWithNoMatchesLeft). Drives the Golden Boot "out of the race"
// mark; based on committed reality, not the user's what-if edits.
const DONE_SCORING_TEAMS = teamsWithNoMatchesLeft(realTournamentResults)
const INITIAL_PLAYED_COUNT = playedMatchesChrono(realTournamentResults).length
// Frozen at load from the committed real scores — the by-date view scrolls here
const NEXT_MATCH_ID = nextUnplayedMatchId(realTournamentResults)
// The bracket's by-date twin: simulated what-if scores must not move the target
const NEXT_KO_MATCH_ID = nextUnplayedKOMatchId(realTournamentResults.knockoutStages)

function getInitialState(): PredictionsState {
  const state: PredictionsState = {}
  Object.values(realTournamentResults.groupMatches).flat().forEach(m => {
    state[m.id] = m.scores ?? { home: null, away: null }
  })
  for (let i = 73; i <= 104; i++) state[String(i)] = { home: null, away: null }
  Object.values(realTournamentResults.knockoutStages).flat().forEach(m => {
    if (m.scores?.home != null && m.scores?.away != null) state[String(m.matchNum)] = m.scores
  })
  return state
}

interface CollapsibleSectionProps {
  label: string
  children: React.ReactNode
  defaultOpen?: boolean
}

function CollapsibleSection({ label, children, defaultOpen = false }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`pg-collapsible${open ? ' pg-collapsible--open' : ''}`}>
      <button
        type="button"
        className="pg-collapsible-trigger"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="pg-collapsible-rule" aria-hidden="true" />
        <span className="pg-collapsible-label">{label}</span>
        <span className="pg-collapsible-rule" aria-hidden="true" />
        <span className="pg-collapsible-chevron" aria-hidden="true">›</span>
      </button>
      <div className="pg-collapsible-body">
        <div className="pg-collapsible-inner">
          {children}
        </div>
      </div>
    </div>
  )
}

// ESPN names that belong to picked players — their goals are rendered from the
// picked tally (playerGoals), so they must be excluded from the unpicked
// accumulation to avoid a duplicate row on the race board.
const PICKED_ESPN_NAMES = new Set(Object.keys(SCORER_ALIASES))

const predictedPlayers = (users: User[]) =>
  [...new Set(users.map(u => u.topGoalscorer).filter(Boolean))]

const pickersByPlayer = (users: User[]): Record<string, string[]> => {
  const map: Record<string, string[]> = {}
  for (const user of users) {
    if (user.topGoalscorer) {
      ;(map[user.topGoalscorer] ??= []).push(user.label)
    }
  }
  return map
}

export default function ResultsPage({ users }: { users: User[] }) {
  const { me } = useCurrentUser()
  const [editedResults, setEditedResults] = useState<PredictionsState>(getInitialState)
  const [lbScope, setLbScope] = useState<Scope>('all')
  const [lbRangeFrom, setLbRangeFrom] = useState(1)
  const [lbRangeTo, setLbRangeTo] = useState(INITIAL_PLAYED_COUNT)
  const [activeGroup, setActiveGroup] = useState('A')
  const [groupStageView, setGroupStageView] = useState<'by-group' | 'by-date'>('by-group')
  const [bracketView, setBracketView] = useState<'tree' | 'byDate'>('tree')
  const [goalScorerState, setGoalScorerState] = useState(() => ({
    playerGoals: realTournamentResults.playerGoals ?? {} as Record<string, number>,
    goldenBootWinner: Array.isArray(realTournamentResults.goldenBootWinner)
      ? realTournamentResults.goldenBootWinner
      : realTournamentResults.goldenBootWinner ? [realTournamentResults.goldenBootWinner] : [],
  }))
  const [goalScorerResetKey] = useState(0)

  // Live overlay: while a match is in progress, its real score/goals flow into
  // the leaderboard automatically. Matches the user has edited or simulated are
  // recorded here so the live feed never overwrites their what-if scores.
  const liveOverlay = useLiveScores()
  const userEditedIds = useRef<Set<string>>(new Set())
  const liveMerged = useMemo(() => mergeLiveResults(realTournamentResults, liveOverlay), [liveOverlay])
  const livePlayerMatchGoals = liveMerged.playerMatchGoals
  // In-progress knockout matches (final-baked ones already filtered out), so the
  // bracket can badge the live fixture with its running minute.
  const liveBracketMatches = liveMerged.live

  const players = predictedPlayers(users)
  const myUser = useMemo(() => users.find(u => u.label === me), [users, me])

  // Live tournament-wide scorer totals (raw ESPN names) → merge the picked
  // roster with the real leaders/chasers into one Golden Boot race board.
  const espnTotals = useScorerTotals()
  const raceBoard = useMemo(
    () => buildGoldenBootBoard({
      pickedPlayers: players,
      pickedGoals: realTournamentResults.playerGoals ?? {},
      espnTotals,
      pickedEspnNames: PICKED_ESPN_NAMES,
      nameMap: GOLDEN_BOOT_NAMES,
      teamByPlayer: TEAM_BY_PLAYER,
      doneScoringTeams: DONE_SCORING_TEAMS,
      raceDecided: BOOT_RACE_LOCKED,
    }),
    [players, espnTotals],
  )
  const pickedPlayerSet = useMemo(() => new Set(players), [players])
  // Race-board players whose national team has no match left to play. GoalScorerSection
  // combines this with the live lead to flag the ones that can no longer catch up.
  const eliminatedPlayers = useMemo(
    () => raceBoard.players.filter(p => {
      const team = TEAM_BY_PLAYER[p]
      return team != null && DONE_SCORING_TEAMS.has(team)
    }),
    [raceBoard.players],
  )

  const nextMatchRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (groupStageView === 'by-date') {
      nextMatchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [groupStageView])

  const updateMatch = (matchId: string, scores: MatchScores) => {
    userEditedIds.current.add(matchId)
    setEditedResults(prev => ({ ...prev, [matchId]: scores }))
  }

  // Apply live scores to matches the user hasn't touched (and that aren't
  // already locked to a final baked score).
  useEffect(() => {
    if (Object.keys(liveOverlay.scores).length === 0) return
    setEditedResults(prev => {
      let changed = false
      const next = { ...prev }
      for (const [id, sc] of Object.entries(liveOverlay.scores)) {
        if (userEditedIds.current.has(id) || LOCKED_MATCH_IDS.has(id)) continue
        const cur = prev[id]
        if (!cur || cur.home !== sc.home || cur.away !== sc.away) {
          next[id] = { home: sc.home, away: sc.away }
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [liveOverlay])

  const { thirdPlaceQual, allGroupsFilled, allGroupData, groupsWithTies, round32Matches, knockout, finalWinner } = useTournament(editedResults)

  const activeTournamentData = allGroupData.find(d => d.group === activeGroup)
  const activeTiedTeams = activeTournamentData?.tiedTeams ?? new Set<string>()
  const activeAllFilled = activeTournamentData?.allFilled ?? false

  // adjust state during render: drop scores of KO matches whose teams are no longer resolved
  const allKOMatches = [
    ...round32Matches,
    ...knockout.r16, ...knockout.qf, ...knockout.sf,
    knockout.thirdPlace, knockout.final,
  ]
  const cleaned = clearUnresolvedKOScores(allKOMatches, editedResults)
  if (cleaned !== editedResults) setEditedResults(cleaned)

  const thirdPred = editedResults['103']
  const thirdPlaceWinner: string | undefined =
    knockout.thirdPlace.resolved && thirdPred?.home != null && thirdPred?.away != null
      ? thirdPred.home > thirdPred.away ? knockout.thirdPlace.home
      : thirdPred.away > thirdPred.home ? knockout.thirdPlace.away
      : thirdPred.drawWinner === 'home' ? knockout.thirdPlace.home
      : thirdPred.drawWinner === 'away' ? knockout.thirdPlace.away
      : undefined
    : undefined

  const tournamentResults: TournamentResults = {
    groupMatches: Object.fromEntries(
      ALL_GROUP_LETTERS
        .filter(l => l in GROUPS)
        .map(l => [l, (GROUPS[l]?.matches ?? []).map(m => ({ ...m, scores: editedResults[m.id] }))])
    ),
    groupTables: Object.fromEntries(allGroupData.map(d => [d.group, d.standings])),
    thirdPlaceQualification: thirdPlaceQual,
    knockoutStages: {
      r32:        round32Matches.map(m => ({ ...m, scores: editedResults[String(m.matchNum)] })),
      r16:        knockout.r16.map(m => ({ ...m, scores: editedResults[String(m.matchNum)] })),
      qf:         knockout.qf.map(m => ({ ...m, scores: editedResults[String(m.matchNum)] })),
      sf:         knockout.sf.map(m => ({ ...m, scores: editedResults[String(m.matchNum)] })),
      thirdPlace: [{ ...knockout.thirdPlace, scores: thirdPred }],
      final:      [{ ...knockout.final,      scores: editedResults['104'] }],
    },
    champion: finalWinner ?? undefined,
    thirdPlaceWinner,
    goldenBootWinner: goalScorerState.goldenBootWinner.length > 0 ? goalScorerState.goldenBootWinner : undefined,
    playerGoals: goalScorerState.playerGoals,
    // real per-match goals + any live in-progress goals — simulated tally bumps
    // have no match to belong to, so they stay out of the per-match map
    playerMatchGoals: livePlayerMatchGoals,
  }

  // Matches I have a stake in — I predicted both teams that meet here — so the
  // bracket can flag them and show the scoreline I predicted (oriented to the
  // real fixture). Empty (and unmarked) until I'm signed in as a bettor.
  const myBracketMatchIds = new Set<string>()
  const myBracketPredictions: Record<string, MatchScores> = {}
  if (myUser) {
    for (const m of allKO(tournamentResults.knockoutStages)) {
      const predicted = predictedPairing(myUser.knockoutStages, m)
      if (!predicted) continue
      myBracketMatchIds.add(String(m.matchNum))
      const oriented = orientPrediction(predicted, m)
      if (oriented) myBracketPredictions[String(m.matchNum)] = oriented
    }
  }

  // The future-facing twin of the above: unresolved bracket slots where a pairing
  // I predicted could still happen — both teams alive and converging here. Flagged
  // "עדיין אפשרי" rather than "משתתף", since it isn't locked in yet.
  const { ids: possibleMatchIds, predictions: possiblePredictions } = myUser
    ? possibleParticipation(myUser, tournamentResults)
    : { ids: new Set<string>(), predictions: {} as Record<string, { home: string; away: string }> }

  // chronological timeline the "טווח" selectors choose from (grows as you simulate)
  const playedMatchLabels = playedMatchesChrono(tournamentResults).map(playedMatchChronoLabel)
  const rangeFrom = Math.min(lbRangeFrom, playedMatchLabels.length)
  const rangeTo = Math.min(lbRangeTo, playedMatchLabels.length)
  // keep the stretch valid (from ≤ to) as either end moves
  const setRangeFrom = (n: number) => { setLbRangeFrom(n); if (n > lbRangeTo) setLbRangeTo(n) }
  const setRangeTo = (n: number) => { setLbRangeTo(n); if (n < lbRangeFrom) setLbRangeFrom(n) }

  return (
    <PageLayout title="תוצאות">
      <div className="pg-page" dir="rtl">

        {/* Leaderboard — first and prominent */}
        <section className="pg-lb-section">
          <div className="pg-lb-header">
            <h2 className="pg-lb-title">טבלת ניקוד</h2>
            <span className="pg-lb-live-dot" aria-hidden="true" />
            <span className="pg-lb-subtitle">מתעדכן בזמן אמת</span>
          </div>
          <LeaderboardScopeBar
            scope={lbScope} onScopeChange={setLbScope}
            rangeFrom={rangeFrom} rangeTo={rangeTo} onRangeFromChange={setRangeFrom} onRangeToChange={setRangeTo}
            playedMatchLabels={playedMatchLabels}
          />
          <ScopedLeaderboard users={users} results={tournamentResults} realResults={realTournamentResults} scope={lbScope} rangeFrom={rangeFrom} rangeTo={rangeTo} me={me} bootRace={raceBoard.realGoals} teamByPlayer={TEAM_BY_PLAYER} />
        </section>

        {/* All stages — collapsible accordion */}
        <div className="pg-ko-stages">
          <CollapsibleSection label="שלב הבתים">
            <div className="pg-view-toggle">
              <button
                type="button"
                className={`pg-group-btn${groupStageView === 'by-group' ? ' pg-group-btn--active' : ''}`}
                onClick={() => setGroupStageView('by-group')}
              >לפי בית</button>
              <button
                type="button"
                className={`pg-group-btn${groupStageView === 'by-date' ? ' pg-group-btn--active' : ''}`}
                onClick={() => setGroupStageView('by-date')}
                aria-label="לפי תאריך — שלב הבתים"
              >לפי תאריך</button>
            </div>

            {groupStageView === 'by-group' ? (
              <>
                <div className="pg-toolbar">
                  <div className="pg-groups">
                    {ALL_GROUP_LETTERS.map(letter => (
                      <button
                        key={letter}
                        type="button"
                        className={`pg-group-btn${activeGroup === letter ? ' pg-group-btn--active' : ''}${groupsWithTies.has(letter) ? ' pg-group-btn--error' : ''}`}
                        onClick={() => setActiveGroup(letter)}
                      >
                        {GROUPS[letter].he}
                      </button>
                    ))}
                  </div>
                  <a href={`/stats/groups/${activeGroup.toLowerCase()}`} className="pg-group-stats-link">סטטיסטיקות בית {GROUPS[activeGroup].he} →</a>
                </div>

                {activeAllFilled && activeTiedTeams.size > 0 && (
                  <div role="alert" className="tie-warning">
                    {[...activeTiedTeams].map(t => TEAMS[t].he).join(' · ')} — שוות בכל הקריטריונים
                  </div>
                )}

                <div className="pg-matches">
                  {GROUPS[activeGroup].matches.map(match => (
                    <MatchRow
                      key={match.id}
                      match={match}
                      scores={editedResults[match.id] ?? { home: null, away: null }}
                      onChange={scores => updateMatch(match.id, scores)}
                      readOnly={LOCKED_MATCH_IDS.has(match.id)}
                      href={`/matches/${match.id.toLowerCase()}`}
                    />
                  ))}
                </div>

                <StandingsTable
                  standings={calculateStandings(GROUPS[activeGroup].matches, editedResults).standings}
                />
              </>
            ) : (
              <div className="pg-matches">
                {GROUP_MATCHES_BY_DATE.map(({ date, dayLabel, matches }) => (
                  <div key={date}>
                    <div className="pg-date-band">
                      <span className="pg-date-band__rule" />
                      <div className="pg-date-band__label">
                        <span className="pg-date-band__date">{date}</span>
                        <span className="pg-date-band__day">{dayLabel}</span>
                      </div>
                      <span className="pg-date-band__rule" />
                    </div>
                    {matches.map(({ match, group }) => {
                      const isNext = match.id === NEXT_MATCH_ID
                      return (
                        <div
                          key={match.id}
                          ref={isNext ? nextMatchRef : undefined}
                          className={isNext ? 'pg-next-match' : undefined}
                        >
                          <MatchRow
                            match={match}
                            scores={editedResults[match.id] ?? { home: null, away: null }}
                            onChange={scores => updateMatch(match.id, scores)}
                            readOnly={LOCKED_MATCH_IDS.has(match.id)}
                            href={`/matches/${match.id.toLowerCase()}`}
                            hideDate
                            groupLabel={GROUPS[group].he}
                          />
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>
          <CollapsibleSection label="דירוג נבחרות במקום השלישי">
            <ThirdPlaceTable qualification={thirdPlaceQual} allGroupsFilled={allGroupsFilled} />
          </CollapsibleSection>
          <CollapsibleSection label="בראקט" defaultOpen>
            <div className="pg-view-toggle">
              <button
                type="button"
                className={`pg-group-btn${bracketView === 'tree' ? ' pg-group-btn--active' : ''}`}
                onClick={() => setBracketView('tree')}
              >עץ הבראקט</button>
              <button
                type="button"
                className={`pg-group-btn${bracketView === 'byDate' ? ' pg-group-btn--active' : ''}`}
                onClick={() => { reportUsage('bracket-date-view', me); setBracketView('byDate') }}
                aria-label="לפי תאריך — בראקט"
              >לפי תאריך</button>
            </div>
            <Bracket
              view={bracketView}
              nextMatchId={NEXT_KO_MATCH_ID}
              stages={tournamentResults.knockoutStages}
              predictions={editedResults}
              onChange={updateMatch}
              lockedMatchIds={LOCKED_MATCH_IDS}
              participatingMatchIds={myBracketMatchIds}
              participatingPredictions={myBracketPredictions}
              possibleMatchIds={possibleMatchIds}
              possiblePredictions={possiblePredictions}
              liveMatches={liveBracketMatches}
            />
          </CollapsibleSection>
          <CollapsibleSection label="מלך השערים" defaultOpen>
            <GoalScorerSection
              key={`${goalScorerResetKey}-${JSON.stringify(raceBoard.realGoals)}`}
              players={raceBoard.players}
              realGoals={raceBoard.realGoals}
              defaultWinner={goalScorerState.goldenBootWinner}
              pickersByPlayer={pickersByPlayer(users)}
              eliminatedPlayers={eliminatedPlayers}
              locked={BOOT_RACE_LOCKED}
              onChange={(goals, winners) => setGoalScorerState({
                // Keep playerGoals picked-only: unpicked race-board rows must
                // never leak into points / the win-prob sim / Records, which all
                // read tournamentResults.playerGoals.
                playerGoals: Object.fromEntries(
                  Object.entries(goals).filter(([p]) => pickedPlayerSet.has(p))
                ),
                goldenBootWinner: winners,
              })}
            />
          </CollapsibleSection>
        </div>

      </div>
    </PageLayout>
  )
}
