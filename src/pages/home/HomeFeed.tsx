import { useState } from 'react'
import type { GroupMatch } from '../../shared/types'
import type { User } from '../../users/index'
import type { KnockoutMatch } from '../../shared/types'
import { recentMatches, upcomingCards, SCORED_MATCHES, KO_FEED_MATCHES } from './nextMatch'
import RecentMatchesCard from './RecentMatchesCard'
import NextMatchCard from './NextMatchCard'
import './HomeFeed.css'

type View = 'results' | 'fixtures'
type Props = {
  users: User[]
  currentUser?: User
  now?: Date
  matches?: GroupMatch[]
  koMatches?: KnockoutMatch[]
  playerMatchGoals?: Record<string, Record<string, number>>
  // The live feed's in-progress matches (match id → status). Drives the "live"
  // badge so it tracks the feed (and disappears the moment a match finishes)
  // rather than a 3h wall-clock window. Absent in tests / when no feed is wired up.
  // `home`/`away` carry the current live score so the card can show it live.
  liveMatches?: Record<string, { clock: string | null; home?: number; away?: number }>
}

// The home page's match feed: one tap swaps between the last few results and the
// next few fixtures, so the two never stack into a scroll wall. Opens on the
// upcoming fixtures — the "what's next" view.
export default function HomeFeed({ users, currentUser, now = new Date(), matches = SCORED_MATCHES, koMatches = KO_FEED_MATCHES, playerMatchGoals, liveMatches }: Props) {
  const [view, setView] = useState<View>('fixtures')
  const list = view === 'results' ? recentMatches(matches, now) : upcomingCards(matches, koMatches, now)

  return (
    <section className="home-feed" dir="rtl">
      <div className="home-feed__toggle" role="tablist" aria-label="תצוגת משחקים">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'results'}
          className={`home-feed__tab${view === 'results' ? ' home-feed__tab--active' : ''}`}
          onClick={() => setView('results')}
        >תוצאות אחרונות</button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'fixtures'}
          className={`home-feed__tab${view === 'fixtures' ? ' home-feed__tab--active' : ''}`}
          onClick={() => setView('fixtures')}
        >המשחקים הבאים</button>
      </div>

      {list.length === 0 ? (
        <p className="home-feed__empty">{view === 'results' ? 'עוד לא נגמרו משחקים' : 'אין משחקים קרובים'}</p>
      ) : view === 'results' ? (
        <RecentMatchesCard users={users} currentUser={currentUser} now={now} matches={matches} playerMatchGoals={playerMatchGoals} />
      ) : (
        <NextMatchCard users={users} currentUser={currentUser} now={now} matches={matches} koMatches={koMatches} liveMatches={liveMatches} />
      )}
    </section>
  )
}
