import type { KnockoutMatch } from '../../shared/types'
import type { User } from '../../users/index'
import { TEAMS } from '../../shared/groups'
import { knownSideTeam, knownSideCallers } from './survivors'

type Props = { actualMatch: KnockoutMatch; users: User[] }

// Half-resolved view: one feeder group has finished so one team is locked in,
// but the other slot is still a descriptor. Shows who is "still alive" on the
// known side — the bettors who predicted that team into this match. Distinct
// from the full participants list (predicted both teams + a score), which only
// appears once both sides resolve.
export default function KnockoutSurvivorsList({ actualMatch, users }: Props) {
  const team = knownSideTeam(actualMatch)
  if (!team) return null // fully resolved or fully unresolved — not our case

  const callers = knownSideCallers(actualMatch, users)
  const teamHe = TEAMS[team]?.he ?? team
  const teamIso = TEAMS[team]?.iso

  return (
    <div className="match-predictions" data-testid="knockout-survivors">
      <header className="section-heading" dir="rtl">
        <span className="section-heading__eyebrow">עוד בחיים</span>
        <h2 className="section-heading__title">
          מי ניחש את
          {' '}
          <span className="match-participants__team">
            {teamIso && <span className={`fi fi-${teamIso} match-participants__flag`} />}
            {teamHe}
          </span>
        </h2>
        <span className="match-survivors__count">{callers.length} מתוך {users.length}</span>
      </header>

      <ol className="match-participants" dir="rtl">
        {callers.map((u, i) => (
          <li
            key={u.label}
            data-testid="survivor"
            className="match-participants__row"
            style={{ '--i': i } as React.CSSProperties}
          >
            <span className="match-participants__name">{u.label}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
