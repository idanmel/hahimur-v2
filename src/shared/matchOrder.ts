// Orders matches chronologically. matchDate strings start with the day of
// month followed by a Hebrew month name, e.g. '11 ביוני' (June) / '11 ביולי' (July).
// Matches without a date sort last.
export function matchSortKey(matchDate: string | undefined, kickoffIST: string | undefined): number {
  const month = !matchDate ? 99 : matchDate.includes('ביולי') ? 7 : 6
  const day = matchDate ? parseInt(matchDate, 10) : 99
  const [hh = 0, mm = 0] = (kickoffIST ?? '').split(':').map(Number)
  return ((month * 100 + day) * 100 + hh) * 100 + mm
}
