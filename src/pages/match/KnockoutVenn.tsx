import type { User } from '../../users/index'
import type { VennStage } from './koMatch'
import { TEAMS } from '../../shared/groups'

// Two overlapping team lobes instead of three flat lists: the diagram is the
// at-a-glance summary (lobe size ∝ how many bettors advanced that team, with the
// three region tallies), and the full name lists sit beneath it — so a lopsided
// split like 25 / 3 / 1 reads instantly up top and still names everyone below.
type Props = { teamA: string; teamB: string; stage: VennStage; users: User[] }

const teamHe = (name: string) => TEAMS[name]?.he ?? name

// Path-independent: a bettor "has the team in this stage" if it shows up in any of
// their predicted fixtures for that round, no matter how their bracket routed it
// there. Which stage to check is the match's own job (see vennStage).
function hasTeamInStage(user: User, stage: VennStage, team: string): boolean {
  return user.knockoutStages[stage].some(m => m.home === team || m.away === team)
}

// Lobe geometry, in % of the stage width. Centres are fixed (A right, B left) so
// the two always overlap and stay inside the frame; only the diameters flex with
// membership — area-weighted (√) so the circles read as proportional, with a
// floor so a lone pick is still a visible bubble.
const MIN_D = 34
const MAX_D = 58
const CENTER_A = 62
const CENTER_B = 38

function lobeDiameter(count: number, max: number): number {
  return MIN_D + (MAX_D - MIN_D) * Math.sqrt(count / max)
}

function Flag({ team }: { team: string }) {
  const iso = TEAMS[team]?.iso
  return iso ? <span className={`fi fi-${iso} venn__flag`} /> : null
}

// One labelled name list under the diagram, mirroring a region. Omitted when empty.
function RegionList({
  testid, modifier, label, team, users,
}: { testid: string; modifier: string; label: string; team?: string; users: User[] }) {
  if (users.length === 0) return null
  return (
    <div className={`venn__list venn__list--${modifier}`} data-testid={testid}>
      <span className="venn__list-head">
        {team && <Flag team={team} />}
        <span className="venn__list-label">{label}</span>
        <span className="venn__list-count">{users.length}</span>
      </span>
      <ul className="venn__list-names">
        {users.map(u => (
          <li key={u.label} data-testid="venn-name" className="venn__list-name">{u.label}</li>
        ))}
      </ul>
    </div>
  )
}

export default function KnockoutVenn({ teamA, teamB, stage, users }: Props) {
  const inA = users.filter(u => hasTeamInStage(u, stage, teamA))
  const inB = users.filter(u => hasTeamInStage(u, stage, teamB))
  const both = inA.filter(u => inB.includes(u))
  const aOnly = inA.filter(u => !inB.includes(u))
  const bOnly = inB.filter(u => !inA.includes(u))
  // the fourth region: outside both lobes — bettors who sent neither team this far
  const neither = users.filter(u => !inA.includes(u) && !inB.includes(u))

  const max = Math.max(inA.length, inB.length, 1)
  const dA = lobeDiameter(inA.length, max)
  const dB = lobeDiameter(inB.length, max)

  // Centre each tally in the middle of its sliver: the two outer crescents
  // (teamA-only / teamB-only) and the lens, derived from the circles' edges so
  // the numbers track the lobes as they resize.
  const rA = dA / 2
  const rB = dB / 2
  const aRight = CENTER_A + rA
  const bLeft = CENTER_B - rB
  const overlapL = Math.max(CENTER_A - rA, CENTER_B - rB)
  const overlapR = Math.min(aRight, CENTER_B + rB)
  const aTallyX = (overlapR + aRight) / 2
  const bTallyX = (bLeft + overlapL) / 2
  const bothTallyX = (overlapL + overlapR) / 2

  return (
    <div className="venn" dir="rtl">
      <div className="venn__legend">
        <span className="venn__legend-item venn__legend-item--a">
          <Flag team={teamA} />{teamHe(teamA)}
          <span className="venn__legend-count">{inA.length}</span>
        </span>
        <span className="venn__legend-item venn__legend-item--b">
          <Flag team={teamB} />{teamHe(teamB)}
          <span className="venn__legend-count">{inB.length}</span>
        </span>
      </div>

      <div className="venn__stage">
        <span
          className="venn__circle venn__circle--a"
          aria-hidden="true"
          style={{ width: `${dA}%`, left: `${CENTER_A - dA / 2}%` }}
        />
        <span
          className="venn__circle venn__circle--b"
          aria-hidden="true"
          style={{ width: `${dB}%`, left: `${CENTER_B - dB / 2}%` }}
        />

        <span
          className="venn__tally venn__tally--a"
          data-testid="venn-count-a"
          style={{ left: `${aTallyX}%` }}
        >
          {aOnly.length}
        </span>
        <span
          className="venn__tally venn__tally--both"
          data-testid="venn-count-both"
          style={{ left: `${bothTallyX}%` }}
        >
          <span className="venn__tally-label">שניהם</span>
          {both.length}
        </span>
        <span
          className="venn__tally venn__tally--b"
          data-testid="venn-count-b"
          style={{ left: `${bTallyX}%` }}
        >
          {bOnly.length}
        </span>

        {neither.length > 0 && (
          <span className="venn__tally venn__tally--neither" data-testid="venn-count-neither">
            <span className="venn__tally-label">אף אחת</span>
            {neither.length}
          </span>
        )}
      </div>

      <div className="venn__lists">
        <RegionList testid="venn-region-a" modifier="a" team={teamA} label={`רק ${teamHe(teamA)}`} users={aOnly} />
        <RegionList testid="venn-region-both" modifier="both" label="שניהם" users={both} />
        <RegionList testid="venn-region-b" modifier="b" team={teamB} label={`רק ${teamHe(teamB)}`} users={bOnly} />
        <RegionList testid="venn-region-neither" modifier="neither" label="אף אחת" users={neither} />
      </div>
    </div>
  )
}
