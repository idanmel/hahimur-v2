import type { User } from '../../users/index'
import { TEAMS } from '../../shared/groups'

// The third-place page's replacement for the qualifier Venn: nobody *advances*
// into this match, so the interesting split is each bettor's outright pick for
// who finishes third — one list per team actually playing. A bettor who picked
// a team that didn't make it here (or picked nobody) is simply absent.
type Props = { home: string; away: string; users: User[] }

const teamHe = (name: string) => TEAMS[name]?.he ?? name

function Flag({ team }: { team: string }) {
  const iso = TEAMS[team]?.iso
  return iso ? <span className={`fi fi-${iso} venn__flag`} /> : null
}

// One team's pickers, in the venn's list clothing so the section reads like its
// sibling diagrams. Rendered even when empty — a 0 is honest, a missing list
// looks broken.
function PickList({
  testid, modifier, team, users,
}: { testid: string; modifier: string; team: string; users: User[] }) {
  return (
    <div className={`venn__list venn__list--${modifier}`} data-testid={testid}>
      <span className="venn__list-head">
        <Flag team={team} />
        <span className="venn__list-label">{teamHe(team)}</span>
        <span className="venn__list-count">{users.length}</span>
      </span>
      <ul className="venn__list-names">
        {users.map(u => (
          <li key={u.label} data-testid="third-pick-name" className="venn__list-name">{u.label}</li>
        ))}
      </ul>
    </div>
  )
}

export default function ThirdPlacePicks({ home, away, users }: Props) {
  const pickedHome = users.filter(u => u.predictedThirdPlaceWinner === home)
  const pickedAway = users.filter(u => u.predictedThirdPlaceWinner === away)

  return (
    <div className="venn" dir="rtl">
      <div className="venn__lists">
        <PickList testid="third-picks-home" modifier="a" team={home} users={pickedHome} />
        <PickList testid="third-picks-away" modifier="b" team={away} users={pickedAway} />
      </div>
    </div>
  )
}
