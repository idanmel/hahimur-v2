import { useState, useEffect } from 'react'
import PageLayout from '../../shared/PageLayout'
import MatchRow from '../../formView/groupStage/MatchRow'
import StandingsTable from '../../formView/groupStage/StandingsTable'
import KnockoutTable from '../../formView/knockout/KnockoutTable'
import ThirdPlaceTable from '../../formView/thirdPlace/ThirdPlaceTable'
import { computeUserPoints } from '../../leaderboard/points'
import type { User } from '../../users/index'
import LeaderboardTable from '../../leaderboard/LeaderboardTable'
import { calculateStandings } from '../../shared/standings'
import { clearUnresolvedKOScores } from '../../formView/knockout/knockout'
import { useTournament } from '../../shared/useTournament'
import { GROUPS, ALL_GROUP_LETTERS } from '../../shared/groups'
import type { PredictionsState, MatchScores, TournamentResults } from '../../shared/types'
import * as results from '../../results'
import { TEAM_STRENGTH } from './teamStrength'
import '../../leaderboard/LeaderboardPage.css'
import '../../pages/form/FormPage.css'
import './ResultsPage.css'

const GROUP_MATCH_TEAMS: Record<string, { homeTeam: string; awayTeam: string }> = {}
Object.values(GROUPS).forEach(group =>
  group.matches.forEach(m => { GROUP_MATCH_TEAMS[m.id] = { homeTeam: m.homeTeam, awayTeam: m.awayTeam } })
)

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

export default function ResultsPage({ users }: { users: User[] }) {
  const [editedResults, setEditedResults] = useState<PredictionsState>({ ...results.predictions })
  const [activeGroup, setActiveGroup] = useState('A')

  const updateMatch = (matchId: string, scores: MatchScores) => {
    setEditedResults(prev => ({ ...prev, [matchId]: scores }))
  }

  const randomize = () => {
    const poisson = (lambda: number) => {
      const L = Math.exp(-lambda)
      let k = 0, p = 1
      do { k++; p *= Math.random() } while (p > L)
      return k - 1
    }
    const BASE = 1.3
    setEditedResults(prev =>
      Object.fromEntries(Object.keys(prev).map(id => {
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

  const reset = () => {
    setEditedResults({ ...results.predictions })
  }

  const { thirdPlaceQual, allGroupsFilled, allGroupData, round32Matches, knockout, finalWinner } = useTournament(editedResults)

  useEffect(() => {
    const allKOMatches = [
      ...round32Matches,
      ...knockout.r16, ...knockout.qf, ...knockout.sf,
      knockout.thirdPlace, knockout.final,
    ]
    const cleaned = clearUnresolvedKOScores(allKOMatches, editedResults)
    if (cleaned !== editedResults) setEditedResults(cleaned)
  }, [round32Matches, knockout])

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
  }

  const rows = users.map(user => ({
    label: user.label,
    ...computeUserPoints(user, tournamentResults),
  })).sort((a, b) => b.total - a.total)

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
          <LeaderboardTable rows={rows} />
        </section>

        {/* Simulation callout */}
        <aside className="pg-sim-note">
          <span className="pg-sim-note-label">סימולטור תוצאות</span>
          <p className="pg-sim-note-body">
            ערכו תוצאות ידנית בכל שלב — הניקוד מתעדכן בזמן אמת.
            לחצו <strong>סימלוץ</strong> לתוצאות אקראיות, או <strong>איפוס</strong> לחזרה לתוצאות האמיתיות.
          </p>
        </aside>

        {/* Simulation actions — always visible, affect all stages */}
        <div className="pg-sim-actions">
          <button type="button" className="pg-random-btn" onClick={randomize}>סימלוץ</button>
          <button type="button" className="pg-reset-btn" onClick={reset}>איפוס</button>
        </div>

        {/* All stages — collapsible accordion */}
        <div className="pg-ko-stages">
          <CollapsibleSection label="שלב הבתים">
            <div className="pg-toolbar">
              <div className="pg-groups">
                {ALL_GROUP_LETTERS.map(letter => (
                  <button
                    key={letter}
                    type="button"
                    className={`pg-group-btn${activeGroup === letter ? ' pg-group-btn--active' : ''}`}
                    onClick={() => setActiveGroup(letter)}
                  >
                    {GROUPS[letter].he}
                  </button>
                ))}
              </div>
            </div>

            <div className="pg-matches">
              {GROUPS[activeGroup].matches.map(match => (
                <MatchRow
                  key={match.id}
                  match={match}
                  scores={editedResults[match.id] ?? { home: null, away: null }}
                  onChange={scores => updateMatch(match.id, scores)}
                  href={`/matches/${match.id.toLowerCase()}`}
                />
              ))}
            </div>

            <StandingsTable
              standings={calculateStandings(GROUPS[activeGroup].matches, editedResults).standings}
            />
          </CollapsibleSection>
          <CollapsibleSection label="דירוג נבחרות במקום השלישי">
            <ThirdPlaceTable qualification={thirdPlaceQual} allGroupsFilled={allGroupsFilled} />
          </CollapsibleSection>
          <CollapsibleSection label="שלב ה-32">
            <KnockoutTable matches={round32Matches} predictions={editedResults} onChange={updateMatch} />
          </CollapsibleSection>
          <CollapsibleSection label="שמינית גמר">
            <KnockoutTable matches={knockout.r16} predictions={editedResults} onChange={updateMatch} />
          </CollapsibleSection>
          <CollapsibleSection label="רבע גמר">
            <KnockoutTable matches={knockout.qf} predictions={editedResults} onChange={updateMatch} />
          </CollapsibleSection>
          <CollapsibleSection label="חצי גמר">
            <KnockoutTable matches={knockout.sf} predictions={editedResults} onChange={updateMatch} />
          </CollapsibleSection>
          <CollapsibleSection label="מקום שלישי">
            <KnockoutTable matches={[knockout.thirdPlace]} predictions={editedResults} onChange={updateMatch} />
          </CollapsibleSection>
          <CollapsibleSection label="גמר">
            <KnockoutTable matches={[knockout.final]} predictions={editedResults} onChange={updateMatch} />
          </CollapsibleSection>
        </div>

      </div>
    </PageLayout>
  )
}
