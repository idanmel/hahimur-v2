import { useMemo, useState } from 'react'
import type { PredictionsState } from '../shared/types'
import { GROUP_MATCHES, GROUP_HEBREW, ALL_GROUP_LETTERS, type GroupLetter } from '../shared/groups'
import { calculateStandings } from '../shared/standings'
import { useTournament } from '../shared/useTournament'
import MatchRow from './groupStage/MatchRow'
import StandingsTable from './groupStage/StandingsTable'
import ThirdPlaceTable from './thirdPlace/ThirdPlaceTable'
import KnockoutTable from './knockout/KnockoutTable'
import ChampionBanner from './knockout/ChampionBanner'

interface Props {
  predictions: PredictionsState
  topGoalscorer: string
}

const noop = () => {}

export default function PredictionsView({ predictions, topGoalscorer }: Props) {
  const [activeGroup, setActiveGroup] = useState<GroupLetter>('A')
  const activeMatches = GROUP_MATCHES[activeGroup] ?? []

  const { standings: activeStandings } = useMemo(
    () => calculateStandings(activeMatches, predictions),
    [activeGroup, predictions]
  )

  const { thirdPlaceQual, allGroupsFilled, round32Matches, knockout, finalWinner } = useTournament(predictions)

  return (
    <>
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

      <section className="content-section">
        {activeMatches.map(match => (
          <MatchRow
            key={match.id}
            match={match}
            scores={predictions[match.id] ?? { home: null, away: null }}
            onChange={noop}
            readOnly
          />
        ))}
        <StandingsTable standings={activeStandings} />
      </section>

      <section className="content-section">
        <div className="section-tag">דירוג נבחרות במקום השלישי</div>
        <ThirdPlaceTable qualification={thirdPlaceQual} allGroupsFilled={allGroupsFilled} />
      </section>

      <section className="content-section">
        <div className="section-tag">שלב ה-32</div>
        <KnockoutTable matches={round32Matches} predictions={predictions} onChange={noop} readOnly />
      </section>

      <section className="content-section">
        <div className="section-tag">שמינית גמר</div>
        <KnockoutTable matches={knockout.r16} predictions={predictions} onChange={noop} readOnly />
      </section>

      <section className="content-section">
        <div className="section-tag">רבע גמר</div>
        <KnockoutTable matches={knockout.qf} predictions={predictions} onChange={noop} readOnly />
      </section>

      <section className="content-section">
        <div className="section-tag">חצי גמר</div>
        <KnockoutTable matches={knockout.sf} predictions={predictions} onChange={noop} readOnly />
      </section>

      <section className="content-section">
        <div className="section-tag">מקום שלישי</div>
        <KnockoutTable matches={[knockout.thirdPlace]} predictions={predictions} onChange={noop} readOnly />
      </section>

      <section className="content-section">
        <div className="section-tag">גמר</div>
        <KnockoutTable matches={[knockout.final]} predictions={predictions} onChange={noop} readOnly />
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
