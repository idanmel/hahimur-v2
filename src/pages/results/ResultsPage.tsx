import { useState, useEffect, useRef, useMemo } from 'react'
import GoalScorerSection from './GoalScorerSection'
import PageLayout from '../../shared/PageLayout'
import MatchRow from '../../formView/groupStage/MatchRow'
import StandingsTable from '../../formView/groupStage/StandingsTable'
import KnockoutTable from '../../formView/knockout/KnockoutTable'
import ThirdPlaceTable from '../../formView/thirdPlace/ThirdPlaceTable'
import type { User } from '../../users/index'
import ScopedLeaderboard from '../../leaderboard/ScopedLeaderboard'
import { reportUsage } from '../../shared/reportUsage'
import type { Scope } from '../../leaderboard/leaderboardRows'
import { playedGroupMatchesChrono } from '../../leaderboard/leaderboardRows'
import LeaderboardScopeBar from '../../leaderboard/LeaderboardScopeBar'
import { calculateStandings } from '../../shared/standings'
import { clearUnresolvedKOScores } from '../../formView/knockout/knockout'
import { useTournament } from '../../shared/useTournament'
import { useCurrentUser } from '../../shared/useCurrentUser'
import { useLiveScores } from '../../shared/useLiveScores'
import { mergeLiveResults } from '../../shared/liveResults'
import { GROUPS, ALL_GROUP_LETTERS, TEAMS } from '../../shared/groups'
import type { PredictionsState, MatchScores, TournamentResults } from '../../shared/types'
import { GROUP_MATCHES_BY_DATE, nextUnplayedMatchId } from '../../shared/matchesByDate'
import { tournamentResults as realTournamentResults } from '../../tournament-results'
import { getLockedMatchIds, allTzelifotResults } from './resultsUtils'
import { TEAM_STRENGTH } from './teamStrength'
import '../../leaderboard/LeaderboardPage.css'
import '../../pages/form/FormPage.css'
import './ResultsPage.css'

const GROUP_MATCH_TEAMS: Record<string, { homeTeam: string; awayTeam: string }> = {}
Object.values(GROUPS).forEach(group =>
  group.matches.forEach(m => { GROUP_MATCH_TEAMS[m.id] = { homeTeam: m.homeTeam, awayTeam: m.awayTeam } })
)

const LOCKED_MATCH_IDS = getLockedMatchIds(realTournamentResults)
const INITIAL_PLAYED_COUNT = playedGroupMatchesChrono(realTournamentResults).length
// Frozen at load from the committed real scores — the by-date view scrolls here
const NEXT_MATCH_ID = nextUnplayedMatchId(realTournamentResults)

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
}

function CollapsibleSection({ label, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(false)
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
  const [goalScorerState, setGoalScorerState] = useState(() => ({
    playerGoals: realTournamentResults.playerGoals ?? {} as Record<string, number>,
    goldenBootWinner: Array.isArray(realTournamentResults.goldenBootWinner)
      ? realTournamentResults.goldenBootWinner
      : realTournamentResults.goldenBootWinner ? [realTournamentResults.goldenBootWinner] : [],
  }))
  const [goalScorerResetKey, setGoalScorerResetKey] = useState(0)

  // Live overlay: while a match is in progress, its real score/goals flow into
  // the leaderboard automatically. Matches the user has edited or simulated are
  // recorded here so the live feed never overwrites their what-if scores.
  const liveOverlay = useLiveScores()
  const userEditedIds = useRef<Set<string>>(new Set())
  const livePlayerMatchGoals = useMemo(
    () => mergeLiveResults(realTournamentResults, liveOverlay).playerMatchGoals,
    [liveOverlay],
  )

  const players = predictedPlayers(users)
  const myUser = useMemo(() => users.find(u => u.label === me), [users, me])

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

  const randomize = () => {
    // fire-and-forget click counter — must never affect the simulation itself
    reportUsage('sim', me)
    const poisson = (lambda: number) => {
      const L = Math.exp(-lambda)
      let k = 0, p = 1
      do { k++; p *= Math.random() } while (p > L)
      return k - 1
    }
    const BASE = 1.3
    setEditedResults(prev =>
      Object.fromEntries(Object.keys(prev).map(id => {
        if (LOCKED_MATCH_IDS.has(id)) return [id, prev[id]]
        // A simulated score is a user choice — keep the live feed from overwriting it.
        userEditedIds.current.add(id)
        const teams = GROUP_MATCH_TEAMS[id]
        const avg = { att: 1.0, def: 1.0 }
        const homeStr = (teams && TEAM_STRENGTH[teams.homeTeam]) ?? avg
        const awayStr = (teams && TEAM_STRENGTH[teams.awayTeam]) ?? avg
        const home = poisson(BASE * homeStr.att * awayStr.def)
        const away = poisson(BASE * awayStr.att * homeStr.def)
        const isKO = !isNaN(Number(id))
        const drawWinner = isKO && home === away
          ? (Math.random() < 0.5 ? 'home' : 'away') as 'home' | 'away'
          : undefined
        return [id, { home, away, ...(drawWinner ? { drawWinner } : {}) }]
      }))
    )
  }

  // "הכל צליפות": paint every unplayed match with your own prediction, so your
  // whole bet comes true and you score צליפה on every undecided match. (Not a
  // true "best case" — locked results can reseed a group and reshuffle the
  // derived bracket; see allTzelifotResults for the caveat.)
  const showAllTzelifot = () => {
    reportUsage('all-tzelifot', me)
    if (!myUser) return
    setEditedResults(prev => {
      const next = allTzelifotResults(prev, myUser.predictions, LOCKED_MATCH_IDS)
      // A painted score is the user's choice — keep the live feed from overwriting it.
      for (const id of Object.keys(next)) {
        if (!LOCKED_MATCH_IDS.has(id)) userEditedIds.current.add(id)
      }
      return next
    })
  }

  const reset = () => {
    // Back to the real results — let the live feed drive untouched matches again.
    userEditedIds.current.clear()
    setEditedResults(getInitialState())
    setGoalScorerState({
      playerGoals: realTournamentResults.playerGoals ?? {},
      goldenBootWinner: Array.isArray(realTournamentResults.goldenBootWinner)
        ? realTournamentResults.goldenBootWinner
        : realTournamentResults.goldenBootWinner ? [realTournamentResults.goldenBootWinner] : [],
    })
    setGoalScorerResetKey(k => k + 1)
  }

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

  // chronological timeline the "טווח" selectors choose from (grows as you simulate)
  const playedMatchLabels = playedGroupMatchesChrono(tournamentResults).map(m =>
    `${TEAMS[m.homeTeam].he} ${m.scores!.home}–${m.scores!.away} ${TEAMS[m.awayTeam].he}`)
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
          <ScopedLeaderboard users={users} results={tournamentResults} realResults={realTournamentResults} scope={lbScope} rangeFrom={rangeFrom} rangeTo={rangeTo} me={me} />
        </section>

        {/* Simulation callout */}
        <aside className="pg-sim-note">
          <span className="pg-sim-note-label">סימולטור תוצאות</span>
          <p className="pg-sim-note-body">
            ערכו תוצאות ידנית בכל שלב — הניקוד מתעדכן בזמן אמת.
            לחצו <strong>הכל צליפות</strong> כדי למלא את כל המשחקים בניחושים שלכם — צליפה בכל משחק,
            <strong>סימלוץ</strong> לתוצאות אקראיות, או <strong>איפוס</strong> לחזרה לתוצאות האמיתיות.
          </p>
        </aside>

        {/* Simulation actions — always visible, affect all stages */}
        <div className="pg-sim-actions">
          {myUser && (
            <button type="button" className="pg-all-tzelifot-btn" onClick={showAllTzelifot}>הכל צליפות</button>
          )}
          <button type="button" className="pg-random-btn" onClick={randomize}>סימלוץ</button>
          <button type="button" className="pg-reset-btn" onClick={reset}>איפוס</button>
        </div>

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
          <CollapsibleSection label="שלב ה-32">
            <KnockoutTable matches={round32Matches} predictions={editedResults} onChange={updateMatch} lockedMatchIds={LOCKED_MATCH_IDS} />
          </CollapsibleSection>
          <CollapsibleSection label="שמינית גמר">
            <KnockoutTable matches={knockout.r16} predictions={editedResults} onChange={updateMatch} lockedMatchIds={LOCKED_MATCH_IDS} />
          </CollapsibleSection>
          <CollapsibleSection label="רבע גמר">
            <KnockoutTable matches={knockout.qf} predictions={editedResults} onChange={updateMatch} lockedMatchIds={LOCKED_MATCH_IDS} />
          </CollapsibleSection>
          <CollapsibleSection label="חצי גמר">
            <KnockoutTable matches={knockout.sf} predictions={editedResults} onChange={updateMatch} lockedMatchIds={LOCKED_MATCH_IDS} />
          </CollapsibleSection>
          <CollapsibleSection label="מקום שלישי">
            <KnockoutTable matches={[knockout.thirdPlace]} predictions={editedResults} onChange={updateMatch} lockedMatchIds={LOCKED_MATCH_IDS} />
          </CollapsibleSection>
          <CollapsibleSection label="גמר">
            <KnockoutTable matches={[knockout.final]} predictions={editedResults} onChange={updateMatch} lockedMatchIds={LOCKED_MATCH_IDS} />
          </CollapsibleSection>
          <CollapsibleSection label="מלך השערים">
            <GoalScorerSection
              key={goalScorerResetKey}
              players={players}
              realGoals={realTournamentResults.playerGoals ?? {}}
              defaultWinner={goalScorerState.goldenBootWinner}
              pickersByPlayer={pickersByPlayer(users)}
              onChange={(goals, winners) => setGoalScorerState({ playerGoals: goals, goldenBootWinner: winners })}
            />
          </CollapsibleSection>
        </div>

      </div>
    </PageLayout>
  )
}
