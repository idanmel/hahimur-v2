import { useMemo, useState, useRef, useEffect } from 'react'
import '../pages/results/ResultsPage.css'
import type { PredictionsState, Standing, ThirdPlaceQualification, KnockoutStages, MatchScores } from '../shared/types'
import { isUnpredicted } from '../shared/types'
import { GROUP_MATCHES, GROUPS, GROUP_HEBREW, ALL_GROUP_LETTERS, type GroupLetter } from '../shared/groups'
import { calculateStandings } from '../shared/standings'
import { useTournament } from '../shared/useTournament'
import { reportUsage } from '../shared/reportUsage'
import { GROUP_MATCHES_BY_DATE, nextUnplayedMatchId } from '../shared/matchesByDate'
import { singleMatchOutcome, singleMatchPoints, type MatchOutcome } from '../leaderboard/points'
import { tournamentResults } from '../tournament-results'
import MatchRow from './groupStage/MatchRow'
import StandingsTable from './groupStage/StandingsTable'
import ThirdPlaceTable from './thirdPlace/ThirdPlaceTable'
import KnockoutTable from './knockout/KnockoutTable'
import ChampionBanner from './knockout/ChampionBanner'

interface Props {
  predictions: PredictionsState
  topGoalscorer: string
  groupTables?: Record<string, Standing[]>
  thirdPlaceQualification?: ThirdPlaceQualification
  knockoutStages?: KnockoutStages
  predictedChampion?: string
}

const noop = () => {}

// Frozen at load from the committed real scores — the by-date view scrolls here
const NEXT_MATCH_ID = nextUnplayedMatchId(tournamentResults)

export default function FormView({
  predictions,
  topGoalscorer,
  groupTables,
  thirdPlaceQualification,
  knockoutStages,
  predictedChampion,
}: Props) {
  const [activeGroup, setActiveGroup] = useState<GroupLetter>('A')
  const [groupStageView, setGroupStageView] = useState<'by-group' | 'by-date'>('by-group')
  const activeMatches = useMemo(() => GROUP_MATCHES[activeGroup] ?? [], [activeGroup])

  const { standings: computedStandings } = useMemo(
    () => calculateStandings(activeMatches, predictions),
    [activeMatches, predictions]
  )
  const activeStandings = groupTables?.[activeGroup] ?? computedStandings

  const tournament = useTournament(predictions)
  const thirdPlaceQual = thirdPlaceQualification ?? tournament.thirdPlaceQual
  const allGroupsFilled = thirdPlaceQualification != null ? true : tournament.allGroupsFilled
  const finalWinner = predictedChampion ?? tournament.finalWinner

  const r32   = knockoutStages?.r32        ?? tournament.round32Matches
  const r16   = knockoutStages?.r16        ?? tournament.knockout.r16
  const qf    = knockoutStages?.qf         ?? tournament.knockout.qf
  const sf    = knockoutStages?.sf         ?? tournament.knockout.sf
  const third = knockoutStages?.thirdPlace ?? [tournament.knockout.thirdPlace]
  const fin   = knockoutStages?.final      ?? [tournament.knockout.final]

  // Flatten actual group scores for quick lookup
  const actualScores = useMemo(() => {
    const scores: Record<string, MatchScores> = {}
    for (const groupMatches of Object.values(tournamentResults.groupMatches)) {
      for (const match of groupMatches) {
        if (match.scores) scores[match.id] = match.scores
      }
    }
    return scores
  }, [])

  // Real standings for the active group, always shown beside the prediction —
  // before kickoff it just lists the teams with empty stats
  const { standings: actualStandings } = useMemo(
    () => calculateStandings(activeMatches, actualScores),
    [activeMatches, actualScores]
  )

  const nextMatchRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (groupStageView === 'by-date') {
      nextMatchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [groupStageView])

  // Compute outcome and points for a finished match
  const getOutcomeAndPoints = (matchId: string): { outcome?: MatchOutcome; points?: number } => {
    const actual = actualScores[matchId]
    if (!actual || isUnpredicted(actual)) return {}
    const pred = predictions[matchId] ?? { home: null, away: null }
    return {
      outcome: singleMatchOutcome(pred, actual),
      points: singleMatchPoints(matchId, pred, actual),
    }
  }

  return (
    <>
      <div className="pg-view-toggle">
        <button
          type="button"
          className={`pg-group-btn${groupStageView === 'by-group' ? ' pg-group-btn--active' : ''}`}
          onClick={() => setGroupStageView('by-group')}
        >לפי בית</button>
        <button
          type="button"
          className={`pg-group-btn${groupStageView === 'by-date' ? ' pg-group-btn--active' : ''}`}
          onClick={() => { reportUsage('/api/date-view-click'); setGroupStageView('by-date') }}
        >לפי תאריך</button>
      </div>

      {groupStageView === 'by-group' && (
        <div className="group-grid">
          {ALL_GROUP_LETTERS.map(letter => {
            const hasData = letter in GROUP_MATCHES
            const cls = [
              'group-cell',
              activeGroup === letter && 'group-cell--active',
              !hasData && 'group-cell--empty',
            ].filter(Boolean).join(' ')
            return (
              <button
                key={letter}
                className={cls}
                onClick={() => hasData && setActiveGroup(letter)}
                disabled={!hasData}
              >
                {GROUP_HEBREW[letter]}
              </button>
            )
          })}
        </div>
      )}

      <section className="content-section">
        {groupStageView === 'by-group' ? (
          <>
            <StandingsTable standings={activeStandings} caption="התחזית" />
            <StandingsTable standings={actualStandings} caption="בפועל" />
            {activeMatches.map(match => {
              const { outcome, points } = getOutcomeAndPoints(match.id)
              const actual = actualScores[match.id]
              const isFinished = actual && actual.home !== null && actual.away !== null
              return (
                <MatchRow
                  key={match.id}
                  match={match}
                  scores={predictions[match.id] ?? { home: null, away: null }}
                  onChange={noop}
                  readOnly
                  href={`/matches/${match.id}`}
                  outcome={outcome}
                  points={points}
                  actualScore={isFinished ? actual : undefined}
                />
              )
            })}
          </>
        ) : (
          <>
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
                  const { outcome, points } = getOutcomeAndPoints(match.id)
                  const actual = actualScores[match.id]
                  const isFinished = actual && actual.home !== null && actual.away !== null
                  const isNext = match.id === NEXT_MATCH_ID
                  return (
                    <div
                      key={match.id}
                      ref={isNext ? nextMatchRef : undefined}
                      className={isNext ? 'pg-next-match' : undefined}
                    >
                      <MatchRow
                        match={match}
                        scores={predictions[match.id] ?? { home: null, away: null }}
                        onChange={noop}
                        readOnly
                        hideDate
                        groupLabel={GROUPS[group].he}
                        href={`/matches/${match.id}`}
                        outcome={outcome}
                        points={points}
                        actualScore={isFinished ? actual : undefined}
                      />
                    </div>
                  )
                })}
              </div>
            ))}
          </>
        )}
      </section>

      <section className="content-section">
        <div className="section-tag">דירוג נבחרות במקום השלישי</div>
        <ThirdPlaceTable qualification={thirdPlaceQual} allGroupsFilled={allGroupsFilled} />
      </section>

      <section className="content-section">
        <div className="section-tag">שלב ה-32</div>
        <KnockoutTable matches={r32} predictions={predictions} onChange={noop} readOnly />
      </section>

      <section className="content-section">
        <div className="section-tag">שמינית גמר</div>
        <KnockoutTable matches={r16} predictions={predictions} onChange={noop} readOnly />
      </section>

      <section className="content-section">
        <div className="section-tag">רבע גמר</div>
        <KnockoutTable matches={qf} predictions={predictions} onChange={noop} readOnly />
      </section>

      <section className="content-section">
        <div className="section-tag">חצי גמר</div>
        <KnockoutTable matches={sf} predictions={predictions} onChange={noop} readOnly />
      </section>

      <section className="content-section">
        <div className="section-tag">מקום שלישי</div>
        <KnockoutTable matches={third} predictions={predictions} onChange={noop} readOnly />
      </section>

      <section className="content-section">
        <div className="section-tag">גמר</div>
        <KnockoutTable matches={fin} predictions={predictions} onChange={noop} readOnly />
      </section>

      {topGoalscorer && (
        <section className="content-section">
          <div className="section-tag">מלך השערים</div>
          <div className="goalscorer-card" dir="rtl">
            <span className="goalscorer-input">{topGoalscorer}</span>
          </div>
        </section>
      )}

      {finalWinner && <ChampionBanner winner={finalWinner} />}
    </>
  )
}
