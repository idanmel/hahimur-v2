import PageLayout from '../../shared/PageLayout'
import type { User } from '../../users/index'
import { findKnockoutMatch, roundLabel } from './koMatch'
import KnockoutScoreFrequencyTable from './KnockoutScoreFrequencyTable'
import './MatchPredictionsPage.css'

// One team slot. While unresolved it's a descriptor string ("סגנית א") with
// no flag. (Real name + flag for resolved slots lands in a later slice.)
function TeamSlot({ slot }: { slot: string }) {
  return (
    <div className="match-team">
      <span className="match-team__name">{slot}</span>
    </div>
  )
}

export default function KnockoutMatchPage({ matchNum, users = [] }: { matchNum: number; users?: User[] }) {
  const match = findKnockoutMatch(matchNum)

  if (!match) {
    return (
      <PageLayout title="ההימור 2026">
        <p style={{ textAlign: 'center', marginTop: '2rem' }}>משחק לא נמצא</p>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="ההימור 2026">
      <div className="match-header" data-testid="knockout-match-page">
        <span className="match-header__group-badge" dir="rtl">{roundLabel(matchNum)} · משחק {matchNum}</span>

        <div className="match-header__teams">
          <TeamSlot slot={match.away} />
          <div className="match-header__vs"><span className="match-header__vs-text">–</span></div>
          <TeamSlot slot={match.home} />
        </div>

        {match.matchDate && (
          <div className="match-header__meta">
            <span>{match.matchDate}</span>
            <span className="match-header__meta-dot" />
            <span>{match.kickoffIST}</span>
            <span className="match-header__meta-dot" />
            <span>שעון ישראל</span>
          </div>
        )}
      </div>

      {match.resolved && (
        <div className="match-predictions">
          <header className="section-heading" dir="rtl">
            <span className="section-heading__eyebrow">סטטיסטיקה</span>
            <h2 className="section-heading__title">התפלגות תוצאות</h2>
          </header>
          <KnockoutScoreFrequencyTable actualMatch={match} users={users} />
        </div>
      )}
    </PageLayout>
  )
}
