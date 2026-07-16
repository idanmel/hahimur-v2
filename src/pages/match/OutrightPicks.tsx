import type { User } from '../../users/index'
import { TEAMS } from '../../shared/groups'

// The last two matches' replacement for the qualifier Venn: on the third-place
// match nobody *advances* in (its teams are the semi losers), and on the final
// the interesting split is who called the champion — so both pages show each
// bettor's outright pick instead, one list per team actually playing. `pickOf`
// selects which pick (third-place winner / champion). A bettor whose pick isn't
// one of the two teams here is simply absent.
type Props = { home: string; away: string; users: User[]; pickOf: (u: User) => string | undefined }

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
          <li key={u.label} data-testid="outright-pick-name" className="venn__list-name">{u.label}</li>
        ))}
      </ul>
    </div>
  )
}

export default function OutrightPicks({ home, away, users, pickOf }: Props) {
  const pickedHome = users.filter(u => pickOf(u) === home)
  const pickedAway = users.filter(u => pickOf(u) === away)

  return (
    <div className="venn" dir="rtl">
      <div className="venn__lists">
        <PickList testid="outright-picks-home" modifier="a" team={home} users={pickedHome} />
        <PickList testid="outright-picks-away" modifier="b" team={away} users={pickedAway} />
      </div>
    </div>
  )
}
