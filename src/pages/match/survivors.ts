import { TEAMS } from '../../shared/groups'
import type { KnockoutMatch } from '../../shared/types'
import type { User } from '../../users/index'

// A slot string is "known" once it holds a real team name (in TEAMS) rather than
// a descriptor like "סגנית א" / "שלישית א/ב/ג".
const isRealTeam = (slot: string) => slot in TEAMS

function userMatch(user: User, matchNum: number): KnockoutMatch | undefined {
  const s = user.knockoutStages
  for (const stage of [s.r32, s.r16, s.qf, s.sf, s.thirdPlace, s.final]) {
    const m = stage.find(m => m.matchNum === matchNum)
    if (m) return m
  }
}

// The single resolved team of a half-resolved knockout match: exactly one of the
// two slots is a real team. Returns null when both or neither are real — i.e. the
// match is fully resolved or fully unresolved, neither of which is our case.
export function knownSideTeam(match: KnockoutMatch): string | null {
  const homeReal = isRealTeam(match.home)
  const awayReal = isRealTeam(match.away)
  if (homeReal === awayReal) return null
  return homeReal ? match.home : match.away
}

// Bettors still "alive" on the known side: those whose predicted version of this
// match includes the resolved team on either side.
export function knownSideCallers(match: KnockoutMatch, users: User[]): User[] {
  const team = knownSideTeam(match)
  if (!team) return []
  return users.filter(u => {
    const um = userMatch(u, match.matchNum)
    return !!um && (um.home === team || um.away === team)
  })
}
